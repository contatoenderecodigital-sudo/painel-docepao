// ============================================================================
//  A LISTA FECHADA DO QUE A PADARIA VENDE.
//
//  Ate agora, na ferramenta anotar_item, `categoria` era enum e `produto` era
//  texto livre. Essa e a porta por onde entra produto que nao existe: ela
//  anotou "docinho sem lactose", que a padaria nao faz, e o cliente saiu
//  achando que ia receber.
//
//  Virando enum com `strict: true`, a API compila a lista numa gramatica e
//  mascara token invalido: ela deixa de CONSEGUIR escrever produto que nao
//  esta aqui. Nao e pedido no prompt, e impossibilidade.
//
//  A lista e a MESMA que o motor de preco conhece, montada da mesma forma, e
//  tem teste que quebra se as duas divergirem. Produto novo no catalogo entra
//  aqui sozinho.
//
//  FORA_DO_CARDAPIO existe de proposito: sem uma saida, a decodificacao
//  restrita obriga o modelo a escolher o vizinho mais parecido, calado, e
//  "docinho sem lactose" viraria "docinho" em vez de virar uma recusa honesta.
// ============================================================================

import catalogo from "./dados/catalogo.json";

// A escapatoria. Quando ela escolhe isto, o codigo recusa a anotacao e manda
// ela dizer que a padaria nao faz, ou chamar a equipe.
export const FORA_DO_CARDAPIO = "nao esta no cardapio";

// Nomes que o cliente usa antes de escolher o tipo ("300 salgados, metade
// frango"). Ficam na lista porque a montagem sabe abrir o generico depois.
const GENERICOS = [
  "salgado",
  "salgado frito",
  "salgado assado",
  "docinho",
  "bolo",
  "bolo recheado",
];

// Tudo que a padaria vende, do jeito que o cliente pede e que o motor cota.
export function produtosDoCardapio(): string[] {
  const nomes: string[] = [];
  for (const i of catalogo.salgados?.frito?.itens ?? []) nomes.push(String((i as { nome: string }).nome));
  for (const i of catalogo.salgados?.assado?.itens ?? []) nomes.push(String((i as { nome: string }).nome));
  for (const i of catalogo.doces?.itens ?? []) nomes.push(String((i as { nome: string }).nome));
  for (const f of catalogo.bolos_recheados?.faixas ?? [])
    for (const s of (f as { sabores?: string[] }).sabores ?? []) nomes.push("bolo " + s);
  for (const i of catalogo.bolos_caseiros?.itens ?? []) nomes.push("bolo " + String((i as { nome: string }).nome));
  for (const p of (catalogo.outros_produtos ?? []) as { nome: string }[]) nomes.push(String(p.nome));
  // A pizza de forma nao mora em outros_produtos: o motor cota pelos dois nomes.
  nomes.push("pizza inteira", "pizza meia");
  // O topo e uma linha propria do pedido, com valor que a equipe lanca depois.
  nomes.push("topo de bolo");
  return [...new Set([...nomes, ...GENERICOS])];
}

// A lista pronta pro enum da ferramenta, ja com a escapatoria no fim.
export function enumDeProdutos(): string[] {
  return [...produtosDoCardapio(), FORA_DO_CARDAPIO];
}
