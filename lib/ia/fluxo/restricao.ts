// ============================================================================
//  RESTRIÇÃO QUE A CASA NÃO FAZ NÃO ENTRA NO PEDIDO
//
//  POR QUE ISTO EXISTE
//
//  Medição de 20/08/2026: o pedido fechou com
//
//      30 brigadeiro (sem lactose, forminha rosa)
//
//  A cliente tinha PERGUNTADO se tem docinho sem lactose, a padaria respondeu
//  certo que não tem, e mesmo assim a restrição foi parar na observação do item.
//
//  A observação vai pra comanda da cozinha e pro resumo que o cliente recebe.
//  Ou seja: a padaria produz brigadeiro normal e entrega para alguém que leu
//  "sem lactose" na confirmação. **Se essa pessoa tem intolerância, isso deixa
//  de ser prejuízo e vira problema de saúde.**
//
//  O ITEM NÃO É RECUSADO. O brigadeiro é uma venda de verdade; o que sai é a
//  promessa que a casa não cumpre. Recusar o item seria o defeito da família
//  que já custou caro neste projeto: guarda que bloqueia registro faz o modelo
//  apagar o item inteiro, e aí o pedido perde os trinta brigadeiros também.
//
//  E O CLIENTE PRECISA SABER. Tirar calado é melhor que prometer, mas é pior
//  que avisar: quem pediu sem lactose tem motivo, e merece ouvir que a casa não
//  faz antes de receber. Por isso a função devolve o que tirou, e quem chama
//  transforma isso numa frase.
//
//  ISTO MORAVA NO CÉREBRO ANTIGO (`guardas.ts`), que foi apagado em 26/08/2026.
//  No levantamento feito antes de apagar (`O-QUE-O-VELHO-PROTEGIA.md`) esta era
//  a única regra que o fluxo não tinha e que continuava valendo.
// ============================================================================

import { produtosDaCasa } from "../dados/produtos";

const semAcMin = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * O que a Doce Pão não faz, e como o cliente escreve cada coisa.
 *
 * As fronteiras são classes de caractere e não limite de palavra: a barra
 * invertida é comida no caminho até o arquivo quando o patch passa pelo shell,
 * e a regra para de casar sem dar erro nenhum. Já custou horas três vezes.
 */
const NAO_FAZ: [string, RegExp][] = [
  ["sem lactose", /(^|[^a-z])(sem|0 ?%|zero) ?lactose([^a-z]|$)|lactose ?free|deslactosad/],
  ["sem glúten", /(^|[^a-z])(sem|0 ?%|zero) ?gluten([^a-z]|$)|gluten ?free/],
  ["vegano", /(^|[^a-z])vegan[oa]s?([^a-z]|$)|sem (ingredientes? de )?origem animal/],
  ["diet", /(^|[^a-z])diet([^a-z]|$)|(sem|0 ?%|zero) ?a[cç]ucar/],
  ["integral", /(^|[^a-z])integral([^a-z]|$)/],
];

/**
 * O QUE A CASA FAZ, PERGUNTANDO PRO CATÁLOGO E NÃO PRA UMA LISTA À MÃO.
 *
 * A Doce Pão TEM bolo `0% lactose`, sabor de bolo de festa da faixa C, R$ 55,90
 * o quilo. Com a lista fixa, quem pedisse esse bolo ouvia que a padaria não
 * trabalha com sem lactose e perdia uma venda de verdade.
 *
 * Guarda que trava venda é pior que o defeito que ela conserta. Já aconteceu
 * mais de uma vez neste projeto, e por isso a lista do que a casa NÃO faz agora
 * é conferida contra o catálogo antes de valer.
 */
function esteProdutoJaEAssim(produto: unknown, restricao: string): boolean {
  const nome = semAcMin(produto);
  if (!nome) return false;
  // A palavra que importa, sem o "sem" na frente: "sem lactose" vira "lactose".
  const chave = semAcMin(restricao).replace(/^(sem|zero|0 ?%) ?/, "").trim();
  if (!chave) return false;
  // O produto tem que EXISTIR no cardápio com essa palavra no nome. Não basta o
  // cliente escrever: "bolo sem lactose de brigadeiro" não é produto nenhum.
  return produtosDaCasa().some((p) => {
    const n = semAcMin(p.nome);
    return n.includes(chave) && (nome.includes(chave) || n.includes(nome) || nome.includes(n));
  });
}

/**
 * As restrições citadas neste texto que a casa não faz para ESTE produto.
 *
 * O `produto` não é opcional por acaso. A casa faz UM bolo `0% lactose`, e isso
 * não quer dizer que ela tenha linha sem lactose: o brigadeiro continua sendo
 * brigadeiro normal.
 *
 * Sem amarrar ao produto, a checagem viraria "a casa trabalha com lactose zero"
 * e o defeito original voltaria inteiro, com o cliente intolerante recebendo
 * trinta brigadeiros comuns.
 */
export function restricoesQueACasaNaoFaz(texto: unknown, produto?: unknown): string[] {
  const t = semAcMin(texto);
  if (!t) return [];
  return NAO_FAZ
    .filter(([nome, re]) => re.test(t) && !esteProdutoJaEAssim(produto ?? texto, nome))
    .map(([nome]) => nome);
}

/**
 * A MESMA OBSERVAÇÃO, SEM A PROMESSA QUE A CASA NÃO CUMPRE.
 *
 * Tira só o pedaço da restrição. "sem lactose, forminha rosa" vira "forminha
 * rosa": a cor continua, porque a cor a padaria faz.
 */
export function obsSemRestricao(obs: unknown, produto?: unknown): string | null {
  const bruto = String(obs ?? "").trim();
  if (!bruto) return null;
  // A observação é separada por vírgula e por barra: os dois separadores são
  // usados no fluxo, e o recheio entra com barra.
  const limpo = bruto
    .split(/[,|]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => restricoesQueACasaNaoFaz(p, produto).length === 0)
    .join(" | ");
  return limpo || null;
}

/**
 * O QUE DIZER PRO CLIENTE, quando alguma coisa foi tirada.
 *
 * Uma frase só, direta, sem pedir desculpa por algo que não é erro da padaria e
 * sem prometer que ela vai passar a fazer.
 *
 * Devolve null quando não há o que dizer, que é o caso comum.
 */
export function avisoDaRestricao(tiradas: string[]): string | null {
  if (!tiradas.length) return null;
  const lista =
    tiradas.length === 1
      ? tiradas[0]
      : tiradas.slice(0, -1).join(", ") + " e " + tiradas[tiradas.length - 1];
  // "nao trabalha com sem lactose" fica torto. A restricao vira OPCAO, que e
  // como gente fala: "a gente nao tem opcao sem lactose".
  const opcao = tiradas.length === 1 ? "opção" : "opções";
  return (
    "Só te adianto que a gente não tem " + opcao + " " + lista +
    ", então anotei o pedido sem isso."
  );
}
