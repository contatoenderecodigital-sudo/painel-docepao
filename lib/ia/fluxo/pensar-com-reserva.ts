// ============================================================================
//  O CÉREBRO RESERVA: quando o primeiro provedor cai, outro assume.
//
//  Ideia dele, em 02/09/2026: *"e quando cair um tu troca pro outro, que troca a
//  config toda também, não é bom?"*.
//
//  Hoje, se a OpenAI cai ou demora demais, a padaria responde "tive um
//  probleminha aqui agora" para TODO cliente até alguém perceber. Não é hipótese:
//  aconteceu duas vezes nesta mesma tarde, testando modelos que estouravam o
//  tempo, e o cliente do outro lado não sabe que foi a IA que caiu — ele acha que
//  a padaria é ruim.
//
//  A RESERVA NÃO É O MODELO MELHOR, É O QUE ESTIVER DE PÉ. O Claude Haiku lê
//  pior que o gpt-4.1-mini nesta padaria (medido: numa festa ele devolveu os
//  itens com quantidade zero). Mesmo assim ele é melhor que o silêncio: as
//  guardas do fluxo continuam valendo em cima do que ele ler, e a equipe vê a
//  conversa no painel.
//
//  SÓ ENTRA QUANDO O PRIMEIRO FALHA DE VERDADE. Enquanto a OpenAI responde, a
//  reserva não é chamada e não custa nada. Uma chamada com resposta ruim não é
//  falha: trocar de cérebro no meio da conversa por causa de leitura fraca faria
//  a padaria falar com duas cabeças diferentes na mesma conversa.
// ============================================================================

import type OpenAI from "openai";
import type { Pensar } from "./fluxo";
import { pensarComOpenAI } from "./pensar-openai";
import { clienteDoCerebro } from "../cliente-do-cerebro";

/** O que o negócio configurou como cérebro reserva, se configurou. */
export type Reserva = { modelo: string | null; url: string | null };

/**
 * Pensa com o primeiro; se ele falhar, tenta a reserva UMA vez.
 *
 * Sem reserva configurada, o erro sobe igual a antes: quem trata é o fluxo, que
 * já sabe responder "tive um probleminha" sem inventar pedido.
 */
export function pensarComReserva(
  cliente: OpenAI,
  registrar: ((uso: { tokensIn: number; tokensOut: number; cacheRead: number }) => void) | undefined,
  modeloDoNegocio: string | null,
  reserva: Reserva | null,
): Pensar {
  const primeiro = pensarComOpenAI(cliente, registrar, modeloDoNegocio);
  if (!reserva?.modelo) return primeiro;

  return async (entrada) => {
    try {
      return await primeiro(entrada);
    } catch (erro) {
      // O motivo vai pro log inteiro: sem ele, "a reserva assumiu" não diz se
      // foi cota, chave, formato ou demora, e cada um desses pede uma ação
      // diferente de quem opera.
      console.warn(
        "[cerebro] o primeiro caiu, chamando a reserva " + reserva.modelo + ":",
        erro instanceof Error ? erro.message : String(erro),
      );
      const deReserva = pensarComOpenAI(
        clienteDoCerebro({ url: reserva.url }),
        registrar,
        reserva.modelo,
      );
      return await deReserva(entrada);
    }
  };
}
