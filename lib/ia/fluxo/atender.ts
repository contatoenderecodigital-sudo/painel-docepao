// ============================================================================
//  O FLUXO NOVO ATENDENDO DE VERDADE
//
//  Junta tudo e responde uma mensagem do WhatsApp: le o que ja estava gravado,
//  passa pelo fluxo, grava o que mudou, fecha o pedido quando for a hora, e
//  devolve o texto e os botoes.
//
//  LIGADO SO PRA QUEM ESTIVER NA LISTA
//
//  Enquanto a versao antiga atende os clientes, esta atende so os numeros de
//  FLUXO_NOVO_PARA. E o unico jeito honesto de testar: o dono conversa com o
//  fluxo novo no celular dele e a padaria continua funcionando igual pra quem
//  esta comprando.
//
//  Sem a variavel preenchida, ninguem cai aqui. O padrao e nao mudar nada.
// ============================================================================

import type OpenAI from "openai";
import { responder, type Estado } from "./fluxo";
import { pensarComOpenAI } from "./pensar-openai";
import { dizerComJeito } from "./dizer";
import { lerEstadoDoBanco, gravarEstado, zerar } from "./gravar";
import { fecharPedido } from "./fechar";
import { falaDaEtapa } from "./pergunta";
import { ETAPAS_DA_FESTA } from "./etapas";
import { mandouRecomecar } from "../guardas";

export type RespostaDoFluxo = {
  texto: string;
  botoes: { id: string; titulo: string }[];
  cardapio: string | null;
  etapa: string;
  pedidoId?: string;
  rastro: string[];
  uso: { tokensIn: number; tokensOut: number; cacheRead: number; chamadas: number };
};

/**
 * QUEM CAI NO FLUXO NOVO.
 *
 * FLUXO_NOVO_PARA aceita:
 *
 *   vazio    ninguem. E o padrao: sem a variavel, nada muda.
 *   todos    todo mundo. Vale enquanto a padaria nao esta atendendo cliente de
 *            verdade, que e o caso agora (23/08/2026).
 *   numeros  so esses, separados por virgula. E o modo seguro pra quando
 *            houver cliente comprando: o dono testa no celular dele e a
 *            padaria continua no fluxo antigo.
 *
 * A CHAVE DE DESLIGAR IMPORTA MAIS QUE A DE LIGAR.
 *
 * Apagar a variavel no Coolify volta tudo pro fluxo antigo em segundos, sem
 * deploy e sem git. Se o fluxo novo fizer besteira com um cliente na linha,
 * ninguem precisa esperar build nenhum.
 */
export function ehDoFluxoNovo(telefone: string): boolean {
  const bruto = String(process.env.FLUXO_NOVO_PARA ?? "").trim();
  if (!bruto) return false;
  if (/^(todos|todas|all|1|sim|true)$/i.test(bruto)) return true;

  const lista = bruto.split(/[,;\s]+/).map((x) => x.replace(/\D/g, "")).filter(Boolean);
  if (!lista.length) return false;
  const meu = String(telefone ?? "").replace(/\D/g, "");
  // Compara pelos ultimos oito digitos: o WhatsApp manda o numero as vezes com
  // o nono digito e as vezes sem, e o mesmo celular chegava como dois numeros.
  return lista.some((n) => n.slice(-8) === meu.slice(-8));
}

const VAZIO: Estado = {
  ehFesta: true,
  pessoas: null,
  base: null,
  baseAceita: false,
  itens: [],
  naoQuer: [],
  dados: { nome: null, data: null, hora: null, pagamento: null },
  pecas: null,
  retomarEm: null,
};

export async function atenderComFluxoNovo(
  cliente: OpenAI,
  negocioId: string,
  clienteId: string,
  mensagem: { texto: string; botaoId?: string | null },
): Promise<RespostaDoFluxo> {
  const uso = { tokensIn: 0, tokensOut: 0, cacheRead: 0, chamadas: 0 };
  const contar = (u: { tokensIn: number; tokensOut: number; cacheRead?: number }) => {
    uso.tokensIn += u.tokensIn;
    uso.tokensOut += u.tokensOut;
    uso.cacheRead += u.cacheRead ?? 0;
    uso.chamadas++;
  };

  // O CLIENTE MANDOU RECOMECAR: apaga tudo e sai, sem passar pelo modelo.
  // Apagar o pedido de alguem nao e decisao de redacao, e de quebra sai de
  // graca.
  if (mandouRecomecar(mensagem.texto)) {
    await zerar(negocioId, clienteId);
    return {
      texto:
        "Apaguei tudo o que a gente tinha combinado e comecei do zero. " +
        "Me diz o que voce precisa que eu anoto de novo.",
      botoes: [],
      cardapio: null,
      etapa: "abertura",
      rastro: ["recomecar: zerei o pedido em montagem"],
      uso,
    };
  }

  // O que ja estava gravado manda: a dona pode ter editado na tela entre uma
  // mensagem e outra do cliente, e o que ela mexeu vale mais que a memoria.
  const doBanco = await lerEstadoDoBanco(negocioId, clienteId);
  const antes: Estado = { ...VAZIO, ...doBanco } as Estado;

  const r = await responder(antes, mensagem, pensarComOpenAI(cliente, contar), ETAPAS_DA_FESTA);

  await gravarEstado(negocioId, clienteId, antes, r.estado);

  // ---------------------------------------------------------- fechamento
  let pedidoId: string | undefined;
  if (mensagem.botaoId === "fecha_sim") {
    const fechado = await fecharPedido(negocioId, clienteId, r.estado);
    if (fechado) {
      pedidoId = fechado.pedidoId;
      r.rastro.push("pedido fechado: " + fechado.pedidoId + " (R$ " + (fechado.totalCentavos / 100).toFixed(2) + ")");
      const fim = falaDaEtapa(ETAPAS_DA_FESTA[ETAPAS_DA_FESTA.length - 1], r.estado);
      return { texto: fim.texto, botoes: [], cardapio: null, etapa: "registrado", pedidoId, rastro: r.rastro, uso };
    }
    r.rastro.push("tocou em confirmar mas o pedido ainda nao podia fechar");
  }

  // O jeito de falar vem por ultimo, e nao encosta onde tem dinheiro.
  const texto = await dizerComJeito(cliente, r.fala, mensagem.texto, contar);

  return {
    texto,
    botoes: r.fala.botoes,
    cardapio: r.fala.cardapio,
    etapa: r.etapa,
    rastro: r.rastro,
    uso,
  };
}
