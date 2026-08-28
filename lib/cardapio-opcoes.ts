// ============================================================================
//  O CARDAPIO EM FORMA DE LISTA, pro painel oferecer produto e sabor prontos em
//  vez de deixar a equipe digitar na mao. Digitar na mao erra o nome (e nome
//  errado nao casa com a tabela de preco) e esquece o sabor.
//
//  SAI DA LISTA UNICA, E NAO DE UM PASSEIO PELO catalogo.json.
//
//  Isto morava dentro do route handler e percorria o catalogo ramo por ramo
//  (`salgados.frito`, `doces`, `bolos_recheados.faixas`, `bolos_caseiros`,
//  `outros_produtos`, e a pizza a parte). Duas coisas davam errado:
//
//  1. PROCURAVA UMA CHAVE QUE O CATALOGO NAO TEM. Lia `it.recheios` (plural) e
//     o cardapio escreve `recheio` (singular). Entao o recheio da coxinha, da
//     bolinha de queijo e de mais cinco salgados NUNCA chegava na lista.
//
//  2. IGNORAVA A CATEGORIA QUE O CATALOGO DA. Em `outros_produtos` cada item
//     traz a sua (`"categoria": "pizza"`, `"categoria": "salgado"`), e a
//     montagem decidia so pela unidade: kg virava `por_quilo`, o resto virava
//     `por_unidade`. Resultado medido:
//
//       pizza redonda      a mao = por_quilo     cardapio = pizza
//       mini bolha doce    a mao = por_unidade   cardapio = salgado_frito
//
//     A pizza redonda como `por_quilo` nao junta sabores como pizza, que e uma
//     regra que o `montagem.ts` aplica por categoria.
//
//  A `produtosDaCasa` ja faz esse trabalho, ja le o `recheio` e ja respeita a
//  categoria do item, e ela e a lista que o resto do sistema usa. Cadastrar
//  produto novo passa a aparecer aqui sozinho.
//
//  Movido e trocado na leitura do `app/`, 28/08/2026.
// ============================================================================

import { produtosDaCasa, categoriaDoPedido } from "@/lib/ia/dados/produtos";
import { unidadeDoItem } from "@/lib/tipos";

export type Opcao = { nome: string; categoria: string; unidade: "un" | "kg"; sabores: string[] };

/** A lista pronta: o cardapio inteiro, uma vez so. */
export const OPCOES: Opcao[] = produtosDaCasa().map((p) => ({
  nome: p.nome,
  // O vocabulario do PEDIDO, que e o que a tela e a montagem usam.
  categoria: categoriaDoPedido(p.nome),
  unidade: unidadeDoItem(p.unidade),
  sabores: p.sabores ?? [],
}));
