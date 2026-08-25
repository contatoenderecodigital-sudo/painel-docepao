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

export type SituacaoDaConversa = "reclamacao" | "cancelar" | "status";

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
): RespostaDaSituacao {
  switch (situacao) {
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
