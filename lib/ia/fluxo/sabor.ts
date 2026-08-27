// ============================================================================
//  SABOR EM ABERTO E BURACO NO PEDIDO
//
//  Regra do dono, 23/08/2026: "nunca pode produto com sabor ser fechado sem
//  sabor escolhido, tanto trufa, docinho, cuca, tudo; isso e geral da padaria".
//
//  E ele completou o desenho: "tem itens que ja tem sabor e nao precisa
//  selecionar, so os que precisa selecionar tem a regra". E exatamente o que o
//  catalogo ja diz, com as palavras da dona:
//
//    "FRITO = sabor fixo, a IA NAO pergunta recheio (o recheio ja esta no
//     campo 'recheio'). ASSADO = se tiver 'recheios', a IA PERGUNTA qual o
//     cliente quer. Frito com 'recheios' (risolis, mini bolha) a IA PERGUNTA
//     igual ao assado."
//
//  QUEM DECIDE E A TABELA, NAO EU
//
//  A lista do que pede escolha sai do proprio catalogo, item por item: o que
//  tiver 'recheios' ou 'sabores' pergunta, o resto nao. No dia em que a dona
//  acrescentar um sabor de cuca na tela, a regra passa a valer pra ele sozinha,
//  sem ninguem mexer em codigo.
//
//  Hoje sao 21 produtos que pedem escolha: coxinha nao pede (recheio fixo),
//  risolis pede, esfirra pede, trufa pede, cuca recheada pede, franciscano
//  pede, empadao pede, torta pede, cupcake pede.
//
//  POR QUE ISSO E DE PRODUCAO, NAO DE CONVERSA
//
//  Comanda com "2 kg de empadao" sem dizer se e de frango ou de palmito para a
//  cozinha no meio da manha, e alguem tem que ligar pro cliente. O pedido nao
//  pode fechar assim.
// ============================================================================

import catalogo from "../dados/catalogo.json";
import { produtosDaCasa } from "../dados/produtos";

type ItemDoCardapio = { nome?: string; recheios?: string[]; sabores?: string[] };

/**
 * Todo produto do cardapio que tem lista de sabor ou recheio pra escolher.
 *
 * SAI DA LISTA UNICA, e nao mais de quatro leituras do catalogo cru.
 *
 * A lista unica ja resolveu, num lugar so, a regra que aqui era implicita: o
 * `recheio` no singular quer dizer "ja vem pronto, nao pergunta" e virou
 * `saborFixo`; o `recheios` no plural quer dizer "pergunte qual" e virou
 * `sabores[]`. Um "s" mudava o comportamento e isso nao estava escrito em
 * lugar nenhum.
 *
 * E de quebra a PIZZA entrou. Ela e chave de primeiro nivel no catalogo, entao
 * as quatro leituras aqui nunca a alcancavam: `pizza inteira` e `pizza meia`
 * tem 31 sabores cada e NENHUM era perguntado. A cozinha recebia pizza sem
 * sabor. Medido em 26/08/2026, comparando este arquivo com a lista unica.
 */
function comEscolha(): { nome: string; opcoes: string[] }[] {
  return produtosDaCasa()
    .filter((p) => !p.saborFixo && p.sabores.length > 0)
    .map((p) => ({ nome: p.nome, opcoes: p.sabores }));
}

const semAcMin = (t: string) =>
  String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * ESTE ITEM PRECISA DE SABOR, E ELE JA FOI ESCOLHIDO?
 *
 * Devolve as opcoes que faltam escolher, ou null quando o item nao pede escolha
 * ou quando a escolha ja esta no pedido.
 *
 * A escolha vale escrita em QUALQUER lugar da linha: no nome do produto
 * ("esfirra de carne") ou na observacao ("carne"). O cliente escreve dos dois
 * jeitos e os dois chegam na cozinha igual.
 */
export function saborQueFalta(produto: string, obs?: string | null): { nome: string; opcoes: string[] } | null {
  const linha = semAcMin(produto) + " " + semAcMin(obs ?? "");
  const nome = semAcMin(produto);

  // Casamento pelo comeco do nome: "esfirra de carne" e uma esfirra. O mais
  // longo primeiro pra "empadao com palmito" nao virar "empadao".
  const candidatos = comEscolha()
    .filter((c) => nome.startsWith(semAcMin(c.nome)) || nome === semAcMin(c.nome))
    .sort((a, b) => b.nome.length - a.nome.length);
  const item = candidatos[0];
  if (!item) return null;

  // O SABOR TEM QUE ESTAR FORA DO NOME DO PRODUTO.
  //
  // A busca olhava a linha inteira, e ai o nome do produto respondia por si:
  //
  //     "empadao com palmito"  tem sabores ["palmito", "frango com palmito"]
  //
  // A palavra "palmito" esta no NOME, entao o codigo achava que o sabor ja
  // tinha sido escolhido e nunca perguntava. So que sao duas coisas
  // diferentes na cozinha: palmito puro ou frango com palmito. O mesmo vale
  // pra torta fria com palmito.
  //
  // Medido em 26/08/2026, comparando o que este arquivo decide com o que a
  // lista unica sabe: 82 dos 86 produtos concordavam, e estes dois eram
  // divergencia de verdade.
  //
  // Tirando o nome do produto, sobra o que o CLIENTE escreveu.
  const semONome = linha.slice(semAcMin(item.nome).length).trim();
  const escolhido = item.opcoes.some((o) => {
    // "frango com legumes" casa por inteiro; "carne" casa como palavra.
    const alvo = semAcMin(o);
    return semONome.includes(alvo);
  });
  return escolhido ? null : item;
}

/** O que falta escolher no pedido inteiro, em portugues, pra cobrar do cliente. */
export function saboresQueFaltam(
  itens: { produto: string; obs?: string | null }[],
): { produto: string; opcoes: string[] }[] {
  const falta: { produto: string; opcoes: string[] }[] = [];
  for (const i of itens) {
    const f = saborQueFalta(i.produto, i.obs);
    if (f && !falta.some((x) => x.produto === i.produto)) {
      falta.push({ produto: i.produto, opcoes: f.opcoes });
    }
  }
  return falta;
}

/**
 * AS CORES DE FORMINHA QUE ELE FALOU.
 *
 * Teste da Kemilly, 23/08/2026: ela pediu "quero azul e rosa" com dois docinhos
 * na mesa, e o sistema guardou UMA cor e escreveu "forminha azul e rosa" na
 * observacao dos dois. O painel marcou o chip azul e a producao ficaria sem
 * saber qual e qual.
 *
 * Duas cores para dois docinhos e a coisa mais natural do mundo, e uma
 * atendente resolveria sozinha: a primeira cor pro primeiro, a segunda pro
 * segundo. E o que o codigo faz aqui.
 *
 * Sai da lista do catalogo, entao "verde tiffany" e cor e "verde limao" nao e,
 * e quando ele pede o que a casa nao tem, da pra dizer o que a casa tem.
 */
export function coresDaForminha(texto: string): string[] {
  const t = semAcMin(texto);
  const cores = ((catalogo.forminhas_docinho?.cores ?? []) as string[]).map(String);

  // Do nome mais longo pro mais curto: "azul bebe" antes de "azul", senao a
  // primeira acha "azul" e sobra "bebe" perdido.
  const achadas: { cor: string; onde: number }[] = [];
  for (const cor of [...cores].sort((a, b) => b.length - a.length)) {
    const onde = t.indexOf(semAcMin(cor));
    if (onde < 0) continue;
    // Ja achei uma cor que contem esta? "azul bebe" ja cobre "azul".
    if (achadas.some((a) => semAcMin(a.cor).includes(semAcMin(cor)) && a.onde <= onde)) continue;
    achadas.push({ cor, onde });
  }
  // Na ordem em que ele falou, que e a ordem em que ele pensou.
  return achadas.sort((a, b) => a.onde - b.onde).map((a) => a.cor);
}

/** Todas as cores do cardapio, pra oferecer quando ele pedir uma que nao existe. */
export function coresDoCardapio(): string[] {
  return ((catalogo.forminhas_docinho?.cores ?? []) as string[]).map(String);
}
