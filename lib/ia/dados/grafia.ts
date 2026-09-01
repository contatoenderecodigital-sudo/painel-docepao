// ============================================================================
//  COMO O CLIENTE LÊ, E COMO O SISTEMA BUSCA
//
//  O cardápio da dona foi digitado sem alguns acentos, e o mesmo texto serve
//  para DUAS coisas que não são a mesma:
//
//    - a CHAVE, que casa o que o cliente escreveu com o produto da casa;
//    - o NOME, que o cliente lê na tela.
//
//  Enquanto os dois forem o mesmo texto, arrumar um estraga o outro: acentuar
//  o catálogo direto quebrou oito testes em 31/08/2026, porque meia dúzia de
//  comparações espera a forma crua.
//
//  Aqui só existe a segunda: a grafia com que a frase sai para o cliente. O
//  catálogo continua sendo a fonte única do que existe e de quanto custa, e
//  este arquivo não inventa produto nenhum. O teste cobra isso: toda entrada
//  precisa casar com um produto de verdade, senão vira lista fantasma.
//
//  ISTO NÃO É LISTA DE PRODUTO. É ortografia da mesma palavra: "pao frances" e
//  "pão francês" são o mesmo pão, com a mesma chave e o mesmo preço.
// ============================================================================

/** [como o catálogo escreve, como se escreve em português] */
export const GRAFIA: [string, string][] = [
  ["pao frances", "pão francês"],
  ["pao doce", "pão doce"],
  // O que é o "de x" ninguém confirmou ainda, e por isso ele fica como está:
  // acentuar "pão" é ortografia, adivinhar o resto seria inventar produto.
  // Está anotado em PERGUNTAR-PRA-DONA.md.
  ["pao de x", "pão de x"],
  ["empadao com palmito", "empadão com palmito"],
  ["empadao", "empadão"],
];

/**
 * A MESMA FRASE, ESCRITA DO JEITO QUE SE LÊ.
 *
 * Roda no texto inteiro, no último instante antes de a mensagem sair. É um
 * ponto só: a frase da etapa, o resumo do pedido e a resposta de preço passam
 * todas por aqui, e nenhuma delas precisa saber que isto existe.
 *
 * A ordem importa: "empadao com palmito" vem antes de "empadao", senão a troca
 * curta come a longa e sobra "empadão com palmito" pela metade.
 */
export function comoOClienteLe(texto: unknown): string {
  let t = String(texto ?? "");
  if (!t) return t;
  for (const [cru, certo] of GRAFIA) {
    // Só palavra inteira: sem isto, um nome que contém o outro se corrompe.
    t = t.replace(new RegExp("(^|[^a-zà-ú0-9])" + cru + "(?![a-zà-ú0-9])", "gi"), (_todo, antes) => antes + certo);
  }
  return t;
}
