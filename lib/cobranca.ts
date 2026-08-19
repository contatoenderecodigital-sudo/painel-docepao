// ============================================================================
//  A COBRANÇA DO ORÇAMENTO PARADO.
//
//  Quem montou pedido com a Dora e sumiu recebe uma mensagem lembrando que o
//  orçamento está de pé. É a única parte do sistema que fala com o cliente sem
//  ele ter escrito antes, então tudo aqui é conservador de propósito:
//
//  1. Vem DESLIGADA. Só cobra com COBRANCA_AUTOMATICA=1 nas variáveis. Mandar
//     mensagem pra cliente de verdade é irreversível, e ligar isso é decisão da
//     dona, não do código.
//  2. Uma cobrança por cliente, no máximo duas. Insistir queima o cliente e
//     queima o número no WhatsApp.
//  3. Só dentro da janela de 24h da Meta. Fora dela, texto livre é recusado
//     pela API: só vale template aprovado. Sem template configurado, a gente
//     NÃO cobra e diz por quê, em vez de fingir que mandou.
//  4. Nunca cobra quem está em horário de dormir. Mensagem de padaria às 3h da
//     manhã é motivo pra bloquear o número.
// ============================================================================

import { query } from "./banco/db";
import { carregarCredsWhatsapp, carregarMsgCobranca, carregarCobrancaAtiva } from "./banco/negocios";
import { salvarMensagem } from "./banco/conversas";
import { listarParados, cobrancasDoCliente, AUTOR_COBRANCA } from "./banco/parados";
import { enviarTexto } from "./whatsapp/api";
import { brl } from "./tipos";

export const MSG_PADRAO =
  "Oi {nome}! Seu orçamento ainda está de pé. Quer confirmar? É só responder por aqui.";

// Mais que isso vira perseguição.
const MAX_COBRANCAS = 2;
// A Meta só aceita texto livre dentro de 24h da última mensagem do cliente.
const JANELA_HORAS = 24;
// Padaria não manda mensagem de madrugada.
const HORA_INICIO = 8;
const HORA_FIM = 20;

export type Resultado = {
  ligada: boolean;
  simulacao: boolean;
  candidatos: number;
  enviados: number;
  motivo: string;
  detalhe: Array<{
    cliente: string;
    telefone: string;
    total: string;
    paradoHoras: number;
    acao: "enviaria" | "enviada" | "pulada";
    porque?: string;
  }>;
};

function horaEmSaoPaulo(): number {
  const s = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(s);
}

function montarTexto(modelo: string, nome: string, totalCentavos: number): string {
  const primeiro = (nome || "").trim().split(/\s+/)[0] || "tudo bem";
  return (modelo || MSG_PADRAO)
    .replaceAll("{nome}", primeiro)
    .replaceAll("{total}", brl(totalCentavos));
}

// ---------------------------------------------------------------------------
// A RODADA.
//
// `simular` faz a volta inteira sem mandar nada: mostra exatamente quem seria
// cobrado, com que texto e por quê. É assim que dá pra testar isso sem escrever
// pra cliente de verdade.
// ---------------------------------------------------------------------------
export async function rodarCobranca(
  negocioId: string,
  opcoes: { simular?: boolean; apenasCliente?: string } = {},
): Promise<Resultado> {
  const simulacao = opcoes.simular !== false;
  // Duas travas, e as duas precisam estar abertas.
  const permitido = process.env.COBRANCA_AUTOMATICA === "1";
  const escolhida = await carregarCobrancaAtiva(negocioId);
  const ligada = permitido && escolhida;
  const detalhe: Resultado["detalhe"] = [];

  const parados = await listarParados(negocioId);
  const alvos = opcoes.apenasCliente ? parados.filter((p) => p.id === opcoes.apenasCliente) : parados;

  if (!alvos.length) {
    return {
      ligada,
      simulacao,
      candidatos: 0,
      enviados: 0,
      motivo: "nenhum orçamento parado no momento",
      detalhe,
    };
  }

  const hora = horaEmSaoPaulo();
  const dentroDoHorario = hora >= HORA_INICIO && hora < HORA_FIM;
  const modelo = (await carregarMsgCobranca(negocioId)) || MSG_PADRAO;
  const creds = await carregarCredsWhatsapp(negocioId);
  let enviados = 0;

  for (const p of alvos) {
    const paradoHoras = Math.floor((Date.now() - new Date(p.criadoEm).getTime()) / 3_600_000);
    const base = {
      cliente: p.clienteNome,
      telefone: p.clienteTelefone,
      total: brl(p.totalCentavos),
      paradoHoras,
    };

    const jaCobrado = await cobrancasDoCliente(negocioId, p.id);
    if (jaCobrado >= MAX_COBRANCAS) {
      detalhe.push({ ...base, acao: "pulada", porque: `já recebeu ${jaCobrado} cobranças` });
      continue;
    }

    // A janela de 24h da Meta conta da última mensagem DO CLIENTE. Passou
    // disso, texto livre é recusado: só template aprovado entra, e isso ainda
    // não está configurado. Dizer isso é melhor que tentar e falhar calado.
    const ultimaDele = await query<{ q: string }>(
      `select max(criado_em) as q from mensagens
        where negocio_id = $1 and cliente_id = $2 and papel = 'user'`,
      [negocioId, p.id],
    );
    const quando = ultimaDele[0]?.q ? new Date(ultimaDele[0].q).getTime() : 0;
    const horasDesde = quando ? (Date.now() - quando) / 3_600_000 : 999;
    if (horasDesde >= JANELA_HORAS) {
      detalhe.push({
        ...base,
        acao: "pulada",
        porque: `fora da janela de 24h (${Math.floor(horasDesde)}h), precisaria de template aprovado`,
      });
      continue;
    }

    if (!dentroDoHorario) {
      detalhe.push({ ...base, acao: "pulada", porque: `fora do horário de contato (${hora}h)` });
      continue;
    }

    const texto = montarTexto(modelo, p.clienteNome, p.totalCentavos);

    if (simulacao || !ligada) {
      detalhe.push({
        ...base,
        acao: "enviaria",
        porque: simulacao
          ? "simulação"
          : !permitido
            ? "a trava do ambiente está fechada"
            : "a dona não ligou a cobrança automática",
      });
      continue;
    }

    try {
      const wamid = await enviarTexto(p.clienteTelefone, texto, creds);
      // Guardada como mensagem da conversa, com autor 'cobranca': a dona vê no
      // chat o que foi mandado em nome dela, e é essa marca que conta quantas
      // cobranças o cliente já recebeu.
      await salvarMensagem(negocioId, p.id, "assistant", texto, {
        autor: AUTOR_COBRANCA,
        wamid: wamid ?? undefined,
      });
      enviados++;
      detalhe.push({ ...base, acao: "enviada" });
    } catch (e) {
      detalhe.push({
        ...base,
        acao: "pulada",
        porque: "falha no envio: " + (e instanceof Error ? e.message : String(e)),
      });
    }
  }

  return {
    ligada,
    simulacao,
    candidatos: alvos.length,
    enviados,
    motivo: ligada
      ? simulacao
        ? "simulação, nada foi enviado"
        : "rodada real"
      : !permitido
        ? "a trava do ambiente (COBRANCA_AUTOMATICA) está fechada: nada é enviado"
        : "a dona não ligou a cobrança automática: nada é enviado",
    detalhe,
  };
}
