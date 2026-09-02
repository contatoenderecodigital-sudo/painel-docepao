// ============================================================================
//  A RODADA DE LEMBRETES: le o banco, decide, escreve, marca.
//
//  A DECISAO nao mora aqui: mora em `lembrete.ts`, que e funcao pura e tem
//  teste com o relogio na mao. Aqui e o encanamento, e ele nao decide nada
//  sozinho de proposito.
//
//  A JANELA DE 24 HORAS DA META E O QUE MANDA NO FORMATO.
//
//  Quem nao escreve pra padaria ha mais de 24 horas so pode ser abordado com um
//  TEMPLATE APROVADO pela Meta. E quase sempre o caso do lembrete: o cliente
//  fechou o pedido na semana passada e a mensagem sai na vespera da retirada.
//
//  Entao a rodada tenta o template quando a janela esta fechada, e texto puro
//  quando esta aberta. Sem template aprovado, ela NAO manda e diz no log qual e
//  o nome que falta. Mandar texto puro fora da janela nao chega no cliente: a
//  Meta recusa, e a padaria acharia que avisou sem ter avisado.
// ============================================================================

import {
  pedidosQuePodemPrecisarDeLembrete,
  marcarLembreteEnviado,
  desmarcarLembrete,
} from "../banco/pedidos";
import { carregarCredsWhatsapp } from "../banco/negocios";
import { enviarTexto, enviarTemplate } from "../whatsapp/api";
import { salvarMensagem } from "../banco/conversas";
import {
  estaNaHora,
  textoDoLembrete,
  quandoEmPalavras,
  agoraEmSaoPaulo,
  minutosDaParede,
} from "./lembrete";

/**
 * O TEMPLATE DO LEMBRETE, quando a janela de 24h esta fechada.
 *
 * O nome e fixo porque template e cadastrado uma vez na Meta e vive la; o corpo
 * dele precisa ser, palavra por palavra:
 *
 *   Oi, {{1}}! Passando pra lembrar do seu pedido na Doce Pão que fica pronto
 *   {{2}}. Qualquer coisa é só me chamar por aqui.
 *
 * Categoria UTILITY (nao MARKETING): e aviso de um pedido que a pessoa fez, e a
 * Meta aprova utility rapido e cobra menos.
 */
export const TEMPLATE_LEMBRETE = "lembrete_retirada";
export const TEMPLATE_IDIOMA = "pt_BR";

/** Quantas horas sem o cliente escrever fecham a janela da Meta. */
const JANELA_HORAS = 24;

/**
 * NAO RODA MAIS DE UMA VEZ POR MINUTO.
 *
 * A rodada e chamada de dois lugares (a rota do relogio e a batida da ponte da
 * impressora, que acontece a cada poucos segundos). Sem esta trava a ponte faria
 * a consulta rodar o dia inteiro sem necessidade. Nao substitui a marca no
 * banco: aquela e a que garante uma mensagem so, esta so evita trabalho.
 */
let ultimaRodada = 0;

export type ResultadoDaRodada = {
  olhados: number;
  enviados: number;
  /** Motivo -> quantos. Pra quem investiga "por que o cliente nao foi avisado". */
  pulados: Record<string, number>;
};

export async function rodarLembretes(
  negocioId: string,
  opcoes?: { padaria?: string; forcar?: boolean },
): Promise<ResultadoDaRodada> {
  const resultado: ResultadoDaRodada = { olhados: 0, enviados: 0, pulados: {} };
  const agoraMs = Date.now();
  if (!opcoes?.forcar && agoraMs - ultimaRodada < 60_000) return resultado;
  ultimaRodada = agoraMs;

  const pular = (motivo: string) => {
    resultado.pulados[motivo] = (resultado.pulados[motivo] ?? 0) + 1;
  };

  const pedidos = await pedidosQuePodemPrecisarDeLembrete(negocioId);
  resultado.olhados = pedidos.length;
  if (!pedidos.length) return resultado;

  const agora = agoraEmSaoPaulo();
  const creds = await carregarCredsWhatsapp(negocioId);
  const padaria = opcoes?.padaria ?? "";

  for (const p of pedidos) {
    const decisao = estaNaHora(p, agora);
    if (!decisao.avisar) {
      pular(decisao.porque);
      continue;
    }

    // A MARCA VEM ANTES DO ENVIO, e nao depois.
    //
    // Duas rodadas podem se cruzar. Quem consegue marcar e quem manda; a outra
    // acha o pedido ja marcado e passa. Se o envio falhar, a marca sai e a
    // proxima rodada tenta de novo: perder um lembrete e ruim, mandar cinco
    // vezes o mesmo lembrete e pior.
    const meu = await marcarLembreteEnviado(p.id, negocioId);
    if (!meu) {
      pular("outra rodada pegou primeiro");
      continue;
    }

    const ultima = p.ultimaDoCliente
      ? minutosDaParede(p.ultimaDoCliente.slice(0, 10), p.ultimaDoCliente.slice(11))
      : null;
    const janelaAberta = ultima !== null && agora - ultima < JANELA_HORAS * 60;
    const texto = textoDoLembrete(p, agora, padaria);

    try {
      let wamid: string | null = null;
      if (janelaAberta) {
        wamid = await enviarTexto(String(p.telefone), texto, creds);
      } else {
        const nome = String(p.clienteNome ?? "").trim().split(/\s+/)[0] || "tudo bem";
        await enviarTemplate(String(p.telefone), TEMPLATE_LEMBRETE, TEMPLATE_IDIOMA, creds, [
          nome,
          quandoEmPalavras(p, agora),
        ]);
      }
      // A CONVERSA PRECISA SABER QUE A PADARIA FALOU.
      //
      // Sem isto o lembrete nao aparece no painel, e quem abre a conversa ve o
      // cliente respondendo "pode ser" a uma mensagem que nao existe. E o autor
      // proprio ('lembrete') e o que deixa a dona saber, olhando o chat, que
      // aquilo saiu do relogio e nao da IA conversando.
      await salvarMensagem(negocioId, p.clienteId, "assistant", texto, {
        autor: "lembrete",
        wamid: wamid ?? undefined,
      }).catch((e: unknown) => console.error("[lembrete] nao gravei a mensagem:", e));
      resultado.enviados++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[lembrete] falhei em " + p.id + ":", msg.slice(0, 400));
      // Sem o template aprovado a Meta recusa, e o motivo precisa estar legivel
      // no log: e a acao que resolve, e ninguem adivinha ela lendo "erro 400".
      if (!janelaAberta && /template/i.test(msg)) {
        console.error(
          "[lembrete] a janela de 24h esta fechada e o template \"" + TEMPLATE_LEMBRETE +
            "\" nao esta aprovado nesta conta da Meta. Cadastre em categoria UTILITY, " +
            "idioma " + TEMPLATE_IDIOMA + ", com duas variaveis.",
        );
      }
      await desmarcarLembrete(p.id, negocioId).catch(() => {});
      pular("falhou no envio");
    }
  }

  return resultado;
}
