// ============================================================================
//  GENÉRICO NÃO É PRODUTO: É UMA ESCOLHA QUE AINDA FALTA
//
//  POR QUE ISTO EXISTE
//
//  "pizza", "bolo", "salgado" e "docinho" são nomes de FAMÍLIA. O cliente usa
//  eles antes de escolher o que quer, e a padaria entende: numa loja, "me vê
//  duas pizzas" é o começo de uma conversa, não um pedido pronto.
//
//  No sistema não era. Medido em 26/08/2026, com uma conversa contra o banco:
//
//      cliente >> boa noite, queria 2 pizzas pra sexta as 19h
//      cliente >> nome Marcos Alves, pix
//      cliente >> pode confirmar
//
//      no banco: 2 x "pizza inteira filé ao molho madeira com fritas"
//      cobrado:  R$ 240,00
//
//  Ele não escolheu o tipo nem o sabor, e levou a pizza de NOME MAIS LONGO do
//  cardápio, que foi a que o casamento por pedaço alcançou primeiro. Não era a
//  mais cara nem a mais pedida: era a mais comprida.
//
//  E as três pizzas da casa são produtos bem diferentes:
//
//      pizza de forma    60x40 cm, R$ 120,00 inteira, até 4 sabores
//      pizza meia        R$ 60,00
//      pizza redonda     30 cm, R$ 41,90 o quilo, sai entre R$ 35 e R$ 45
//
//  Quem queria a redonda de R$ 40 recebia uma conta de R$ 240.
//
//  A MESMA DOENÇA JÁ TINHA APARECIDO DUAS VEZES neste projeto, com outros
//  nomes: `docinho` cotado como docinho de churros (R$ 1,75 no lugar de
//  R$ 1,25) e `salgado` cotado como assado (R$ 1,25 no lugar de R$ 1,00).
//
//  O QUE ESTE ARQUIVO FAZ
//
//  Diz quais nomes são família e quais produtos existem em cada uma. A escolha
//  sai da lista única, então o dia em que a dona cadastrar outra pizza a
//  pergunta passa a oferecer ela sozinha.
//
//  E o item NÃO é recusado. Ele fica no pedido com o nome que ele deu, e o que
//  acontece é a padaria PERGUNTAR qual. Recusar seria o defeito da família que
//  já custou caro aqui: guarda que bloqueia registro faz o modelo apagar o item.
// ============================================================================

import { produtosDaCasa } from "../dados/produtos";

const limpo = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Os nomes de família, e de que categoria são os produtos de cada uma.
 *
 * A mesma lista que a montagem conhece em `lib/banco/montagem.ts`, mais a
 * pizza, que nunca tinha entrado em lugar nenhum.
 *
 * `salgado frito` e `salgado assado` NÃO estão aqui de propósito: os dois têm
 * preço próprio de tabela (R$ 1,00 e R$ 1,25, o sabor não muda o valor) e a
 * montagem sabe abrir os dois num sortido. Eles são produto, não família.
 */
const FAMILIAS: Record<string, string[]> = {
  pizza: ["pizza"],
  salgado: ["salgado_frito", "salgado_assado"],
  doce: ["docinho"],
  docinho: ["docinho"],
  bolo: ["bolo_festa", "bolo_caseiro"],
  "bolo recheado": ["bolo_festa"],
};

/** Este nome é família, e não produto? */
export function ehNomeDeFamilia(produto: unknown): boolean {
  return Object.prototype.hasOwnProperty.call(FAMILIAS, limpo(produto));
}

/**
 * OS PRODUTOS QUE ESSA FAMÍLIA TEM, para a padaria perguntar qual.
 *
 * Sai da lista única, então cadastrar um produto novo no cardápio faz ele
 * aparecer na pergunta sozinho, sem ninguém mexer aqui.
 *
 * Vazio quer dizer que o nome não é família, e quem chama trata isso.
 */
export function opcoesDaFamilia(produto: unknown): string[] {
  const cats = FAMILIAS[limpo(produto)];
  if (!cats) return [];
  return produtosDaCasa()
    .filter((p) => cats.includes(p.categoria))
    .map((p) => p.nome);
}

/**
 * A PERGUNTA, em português, ou null quando não há o que perguntar.
 *
 * Família curta (a pizza tem três) mostra as opções pelo nome. Família longa
 * (docinho tem doze, bolo tem quinze) não cabe numa frase: aí a padaria manda o
 * cardápio, que é o que ela já faz nas etapas de família.
 */
export function perguntaDaFamilia(produto: unknown): string | null {
  const opcoes = opcoesDaFamilia(produto);
  if (!opcoes.length) return null;
  const nome = limpo(produto);
  if (opcoes.length > 4) return "Qual " + nome + " você quer?";
  const lista = opcoes.slice(0, -1).join(", ") + " ou " + opcoes[opcoes.length - 1];
  return "Qual " + nome + " você quer: " + lista + "?";
}
