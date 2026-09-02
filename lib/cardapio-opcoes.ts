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

import { produtosDaCasa, categoriaDoPedido, coresDoCardapio, pedeEscolhaDeSabor } from "@/lib/ia/dados/produtos";
import { unidadeDoItem } from "@/lib/tipos";

export type Opcao = {
  nome: string;
  categoria: string;
  unidade: "un" | "kg";
  sabores: string[];
  /**
   * ESTE PRODUTO PEDE QUE ALGUEM ESCOLHA O SABOR?
   *
   * A RESPOSTA VAI PRONTA, e nao so a lista de sabores. Ate 02/09/2026 daqui
   * saia apenas `sabores`, e o painel era obrigado a decidir por conta propria
   * "tem sabor pra escolher?" olhando o tamanho da lista. Ele inventou a regra
   * antiga (`sabores.length > 0`) e passou a discordar da conversa:
   *
   *   coxinha        cardapio: recheio FIXO de frango
   *   a IA           nunca pergunta, certo
   *   o painel       marcava "Sabor *" em vermelho e avisava
   *                  "sem o sabor a cozinha nao sabe o que fazer"
   *
   * A equipe via um alarme num item que nao tem escolha nenhuma, e os dois lados
   * do sistema diziam coisas opostas sobre a mesma linha.
   *
   * Nao dava pro painel chamar `pedeEscolhaDeSabor` sozinho: o campo que ela le
   * (`saborFixo`) nem chegava ate la. Agora a decisao e tomada AQUI, uma vez, na
   * mesma funcao que a conversa usa, e o painel so le o sim ou nao.
   */
  pedeSabor: boolean;
};

/** A lista pronta: o cardapio inteiro, uma vez so. */
export const OPCOES: Opcao[] = produtosDaCasa().map((p) => ({
  nome: p.nome,
  // O vocabulario do PEDIDO, que e o que a tela e a montagem usam.
  categoria: categoriaDoPedido(p.nome),
  unidade: unidadeDoItem(p.unidade),
  sabores: p.sabores ?? [],
  pedeSabor: pedeEscolhaDeSabor(p),
}));

/**
 * AS CORES DE FORMINHA, PRA TELA OFERECER PRONTAS.
 *
 * A tela do pedido tinha as 21 cores REESCRITAS A MAO. E a mesma copia que o
 * `nao-copiar-o-catalogo-pro-codigo` conta na sua propria abertura como o
 * primeiro dos tres defeitos que ele nasceu pra achar: "as 21 CORES da
 * forminha, reescritas a mao numa regex em montagem.ts. O dia em que a dona
 * cadastrasse uma cor nova na tela, a copia nao saberia". Saiu de la e ficou de
 * pe no painel, porque o detector varria so `lib/`.
 *
 * A cor nao e enfeite: a dona monta a forminha antes de rechear, e cor digitada
 * errada nao casa com o que a cozinha usa. Cadastrar uma cor no catalogo passa a
 * valer nos dois lados, na conversa e na tela, sozinha.
 */
export const CORES_DE_FORMINHA: string[] = coresDoCardapio();
