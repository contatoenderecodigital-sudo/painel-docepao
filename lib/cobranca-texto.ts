// ============================================================================
//  O TEXTO DA COBRANCA, E QUEM MONTA ELE. UM LUGAR SO.
//
//  POR QUE ISTO EXISTE SEPARADO DO `lib/cobranca.ts`
//
//  O `cobranca.ts` fala com o banco (lista os parados, le se a dona ligou a
//  cobranca). Um componente de tela que importasse dele arrastaria o driver do
//  Postgres pro bundle do navegador. Entao o TEXTO mora aqui, puro, e os dois
//  lados importam daqui.
//
//  O DEFEITO QUE ISTO CONSERTA
//
//  A tela de Recuperar mostrava uma PREVIEW da mensagem escrita a mao no JSX:
//
//    "Oi {nome}! Seu orcamento da {padaria} pro dia {data} ainda esta de pe, no
//     valor de R$ 218,80. Quer confirmar?"
//
//  E o servidor mandava o `MSG_PADRAO`:
//
//    "Oi {nome}! Seu orcamento ainda esta de pe. Quer confirmar? E so responder
//     por aqui."
//
//  Tres diferencas, e a do meio e a que doi: a preview mostrava o NOME DA
//  PADARIA, o DIA da retirada e o VALOR EM DESTAQUE, e o modelo padrao nao tem
//  nenhum dos tres. A dona aprovava uma mensagem com o valor e o cliente recebia
//  uma sem valor nenhum.
//
//  E se ela tivesse personalizado a mensagem, a preview ignorava o que ela
//  escreveu e mostrava o texto fixo do JSX.
//
//  Achado na leitura do `components/`, 28/08/2026.
// ============================================================================

import { brl } from "./tipos";

/** O modelo que vale quando a dona nao personalizou. */
export const MSG_PADRAO =
  "Oi {nome}! Seu orçamento ainda está de pé. Quer confirmar? É só responder por aqui.";

/**
 * O texto que o cliente recebe, montado do modelo.
 *
 * O primeiro nome, e nao o nome inteiro: "Oi Maria!" e como gente escreve, e
 * "Oi Maria Aparecida da Silva!" nao e.
 *
 * Sem nome, vira "Oi tudo bem!", que e o que a padaria falaria de verdade.
 */
export function montarTextoDaCobranca(modelo: string, nome: string, totalCentavos: number): string {
  const primeiro = (nome || "").trim().split(/\s+/)[0] || "tudo bem";
  return (modelo || MSG_PADRAO)
    .replaceAll("{nome}", primeiro)
    .replaceAll("{total}", brl(totalCentavos));
}
