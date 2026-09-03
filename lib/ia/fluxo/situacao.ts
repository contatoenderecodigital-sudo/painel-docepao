// ============================================================================
//  QUANDO A CONVERSA NAO E UM PEDIDO
//
//  A ROTA C, que faltava.
//
//  O conselho que o dono trouxe em 24/08/2026 chama isso de roteador de
//  intencoes, e da o exemplo exato do buraco que a gente tinha:
//
//    Rota C (Reclamacao/Humano): "Meu pao veio queimado." Corta a IA e chama um
//    atendente humano.
//
//  Ate aqui, quem escrevesse "meu pao veio queimado" caia no fluxo de pedido e
//  a Dora ia tentar montar uma encomenda. Isso e ruim de um jeito diferente de
//  todos os outros defeitos: e o momento em que o cliente esta bravo e a IA
//  esta oferecendo docinho.
//
//  TRES SITUACOES, E NENHUMA DELAS E PEDIDO
//
//    RECLAMACAO   "veio queimado", "faltou item", "estava velho"
//    CANCELAR     "quero cancelar", "nao vou mais precisar"
//    STATUS       "meu pedido ta pronto?", "que horas fica pronto?"
//
//  AS DUAS PRIMEIRAS SAO SEMPRE DA EQUIPE
//
//  Reclamacao mexe com dinheiro (refazer, devolver, desconto) e com a cara da
//  padaria no bairro. Cancelamento mexe com producao que talvez ja tenha
//  comecado. Nenhuma das duas e decisao de robo, e nas duas o cliente prefere
//  falar com gente.
//
//  A TERCEIRA A DORA RESPONDE, se souber
//
//  Se existe pedido fechado, ela diz em que pe esta. Se nao existe, chama a
//  equipe em vez de inventar.
// ============================================================================

import { avisoDeEspera } from "../../padaria-aberta";

/**
 * AS TRES SITUACOES, EM ARRAY E NAO SO EM TIPO.
 *
 * O array existe porque quem recebe a resposta do modelo precisa CONFERIR em
 * tempo de execucao: uniao de tipo o compilador apaga, e o que chega do modelo e
 * texto. Mesmo motivo do `SOBRE_O_QUE`.
 *
 * Havia tres declaracoes desta lista: aqui, no tipo `Leitura` e escrita a mao no
 * limpador do `pensar-openai.ts`.
 */
// FORA DO ASSUNTO entrou em 03/09/2026. Medido em producao em 02/09: um numero
// errado ("nesse numero falo com Ademir?") e uma propaganda de IPVA ouviram
// "O que voce precisa?" tres vezes seguidas, e depois a tabela de pagamento.
// A padaria se apresenta uma vez; na segunda, chama gente.
// HUMANO entrou em 03/09/2026: "quero falar com a dona" era lido por regex
// (`pediuPraFalarComGente`), e o modelo com contexto devolvia fora_do_assunto
// por nao ter onde por isso.
export const SITUACOES = ["reclamacao", "cancelar", "status", "fora_do_assunto", "humano"] as const;
export type SituacaoDaConversa = (typeof SITUACOES)[number];

export type RespostaDaSituacao = { texto: string; precisaHumano: boolean };

/**
 * O QUE A PADARIA RESPONDE, POR SITUACAO.
 *
 * `temPedido` diz se existe pedido fechado deste cliente, e serve so pro
 * status: nao da pra dizer "esta em producao" pra quem nunca encomendou.
 */
export function respostaDaSituacao(
  situacao: SituacaoDaConversa,
  temPedido: boolean,
  /** Quantas vezes seguidas a padaria ja repetiu a mesma pergunta. */
  insistiu = 0,
): RespostaDaSituacao {
  switch (situacao) {
    case "humano":
      // Ele pediu gente. Gente e o ultimo recurso do resto do fluxo, mas quem
      // pede gente com todas as letras recebe gente, sem tentar convencer.
      return { texto: "Claro. " + avisoDeEspera(), precisaHumano: true };
    case "fora_do_assunto":
      // Numero errado, propaganda, assunto de outro negocio. A padaria diz quem
      // e, uma vez. Se a pessoa continua, e caso de gente, nao de repetir.
      return insistiu >= 1
        ? {
            texto: "Vou chamar alguém da equipe da padaria pra te ajudar com isso por aqui.",
            precisaHumano: true,
          }
        : {
            texto:
              "Oi! Aqui é o WhatsApp da padaria. Se for encomenda ou alguma informação " +
              "sobre a gente, é só me dizer.",
            precisaHumano: false,
          };
    case "reclamacao":
      // NAO PEDE DESCULPA POR ALGO QUE ELA NAO SABE SE ACONTECEU, e nao promete
      // nada: quem resolve reclamacao e a dona, e prometer refazer ou devolver
      // no lugar dela e pior que nao responder.
      return {
        texto:
          "Poxa, sinto muito por isso. Vou chamar agora uma pessoa da equipe da padaria " +
          "pra falar com você e resolver.",
        precisaHumano: true,
      };

    case "cancelar":
      // Cancelar mexe com producao que pode ja ter comecado, e as vezes com
      // dinheiro ja pago. A Dora nao cancela nada sozinha.
      return {
        texto:
          "Entendi. Vou passar pra equipe da padaria pra eles verem isso com você, " +
          "porque cancelamento eles conferem na hora.",
        precisaHumano: true,
      };

    case "status":
      return temPedido
        ? {
            texto:
              "Seu pedido está com a equipe da padaria. Assim que eles confirmarem eu te aviso " +
              "por aqui, e ele fica pronto no dia e hora que a gente combinou.",
            precisaHumano: false,
          }
        : {
            texto:
              "Deixa eu confirmar isso com a equipe pra não te passar informação errada. " +
              "Já te respondo por aqui.",
            precisaHumano: true,
          };
  }
}
