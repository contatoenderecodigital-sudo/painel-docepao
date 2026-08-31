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
//  E QUEM RESPONDE É A EQUIPE, NÃO A IA.
//
//  Decisão do dono, 26/08/2026, e ele está certo por dois motivos.
//
//  O primeiro é que **a padaria às vezes FAZ**. O `0% lactose` é sabor de bolo
//  de festa da faixa C: R$ 55,90 o quilo contra R$ 46,90 do brigadeiro, que é
//  faixa A. Nas palavras dele: *"se for por exemplo bolo de brigadeiro + o sem
//  lactose, lá eles devem fazer no bolo né, só fica mais caro"*.
//
//  Ou seja, responder "a gente não tem" é errado E perde venda de R$ 55,90 o
//  quilo. Quem sabe se dá para fazer, e por quanto, é a cozinha.
//
//  O segundo é que restrição de dieta é assunto de gente. É o mesmo padrão que
//  a dona já usa para desconto e para entrega: *"deixa eu ver a possibilidade e
//  eu já te retorno"*. A IA não promete e não recusa: ela passa adiante.
//
//  ENTÃO ISTO AQUI FAZ DUAS COISAS, e as duas importam:
//
//    1. TIRA a promessa da observação, para a comanda não mandar a cozinha
//       produzir uma coisa enquanto o resumo promete outra ao cliente;
//    2. CHAMA A EQUIPE, para alguém que sabe responder.
//
//  ISTO MORAVA NO CÉREBRO ANTIGO (`guardas.ts`), que foi apagado em 26/08/2026.
//  No levantamento feito antes de apagar (`O-QUE-O-VELHO-PROTEGIA.md`) esta era
//  a única regra que o fluxo não tinha e que continuava valendo.
// ============================================================================

import { produtosDaCasa } from "../dados/produtos";
import { semAcento } from "../texto";

// O mesmo normalizador de todo mundo.
const semAcMin = (t: unknown) => semAcento(String(t ?? ""));

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
 * A RESTRIÇÃO QUE A CASA FAZ MISTURANDO, EM VEZ DE RECUSAR.
 *
 * Decisão do dono em 31/08/2026, depois do pedido de festa da véspera: *"se tem
 * no cardapio tem q add mano, dps a equipe resolve isso se n puder fazer, se
 * ela mandou no audio q faz eh pq faz"*.
 *
 * O que aconteceu naquele pedido, e custou os dois lados:
 *
 *   cliente >> Vou querer de brigadeiro sem lactose
 *   padaria >> Sobre o sem lactose: deixa eu confirmar com a equipe...
 *   pedido  >> 2 kg de bolo brigadeiro   R$ 46,90/kg
 *
 * O sem lactose não entrou no pedido, e a equipe também nunca foi avisada: o
 * cliente ficou esperando um retorno que não existia e a dona não tinha como
 * saber. O item sumiu e não sobrou rastro, que é a família de defeito mais cara
 * deste projeto.
 *
 * A DONA JÁ TINHA RESPONDIDO ISSO, na transcrição `docepao1608 (3).txt`:
 *
 *   *"Sim, Emily, dá pra misturar. Sim, com certeza. A gente sempre vai cobrar
 *   o valor mais caro. (...) Se ela quiser o bolo zero lactose, que contenha,
 *   por exemplo, coco, que é o valor de frutas ali, ele vai ficar também
 *   R$ 55,90."*
 *
 * Então `0% lactose` não é sabor fechado: mistura como qualquer outro e vale a
 * faixa mais cara. O motor de preço já sabe cotar "bolo brigadeiro com 0%
 * lactose" (R$ 55,90/kg contra R$ 46,90), então aqui só se monta o nome.
 *
 * VALE SÓ PRO QUE O CATÁLOGO TEM. Docinho sem lactose continua caindo na regra
 * de cima e indo pra equipe: a casa não faz, e prometer isso pra quem tem
 * intolerância deixa de ser prejuízo e vira problema de saúde.
 */
export function misturaQueACasaFaz(produto: unknown, restricao: string): string | null {
  const nome = semAcMin(produto);
  if (!nome) return null;
  const chave = semAcMin(restricao).replace(/^(sem|zero|0 ?%) ?/, "").trim();
  if (!chave) return null;

  const esteAqui = produtosDaCasa().find((p) => semAcMin(p.nome) === nome);
  if (!esteAqui) return null;

  // Só bolo de festa: é onde a restrição é um SABOR do cardápio, com faixa de
  // preço própria. Em qualquer outra família ela seria promessa sem produto.
  if (esteAqui.categoria !== "bolo_festa") return null;
  if (semAcMin(esteAqui.nome).includes(chave)) return null;

  const oOutro = produtosDaCasa().find(
    (p) => p.categoria === "bolo_festa" && semAcMin(p.nome).includes(chave),
  );
  if (!oOutro) return null;

  // O sabor é o nome sem o prefixo da família: "bolo 0% lactose" vira
  // "0% lactose", que é como o motor e a tela do painel escrevem a mistura.
  const sabor = oOutro.nome.replace(/^bolo\s+/i, "").trim();
  if (!sabor) return null;
  return esteAqui.nome + " com " + sabor;
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
 * A CONTA DO PEDIDO NAO E RECADO PRA COZINHA.
 *
 * "coxinha e risoles, metade de cada" ja virou quantidade nas duas linhas.
 * O modelo ainda devolve `obs: metade`, e isso ia impresso na comanda como se
 * a cozinha tivesse que produzir metade de alguma coisa.
 *
 * `metade` aqui e fração, dado do mundo, igual a um numero: nao e lista de
 * produto. Recado de verdade ("sem cebola", "forminha rosa") passa.
 */
export function obsPraComanda(obs: unknown): string | null {
  const bruto = String(obs ?? "").trim();
  if (!bruto) return null;
  const limpo = bruto
    .split(/[,|]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const t = semAcMin(p);
      return t !== "metade" && t !== "metade de cada" && t !== "meio a meio";
    })
    .join(" | ");
  return limpo || null;
}

/**
 * O QUE DIZER PRO CLIENTE, quando a restrição foi tirada da observação.
 *
 * NÃO PROMETE E NÃO RECUSA. É o mesmo padrão que a dona já usa para desconto e
 * para entrega, e ela deu a frase nos áudios: *"deixa eu ver a possibilidade e
 * eu já te retorno"*.
 *
 * Recusar seria errado, porque o `0% lactose` existe no cardápio como sabor de
 * bolo da faixa C. Prometer seria pior, porque quem decide o que a cozinha faz
 * é a cozinha. Então ela passa adiante e avisa que passou.
 *
 * Devolve null quando não há o que dizer, que é o caso comum.
 */
export function avisoDaRestricao(tiradas: string[]): string | null {
  if (!tiradas.length) return null;
  const lista =
    tiradas.length === 1
      ? tiradas[0]
      : tiradas.slice(0, -1).join(", ") + " e " + tiradas[tiradas.length - 1];
  return (
    "Sobre o " + lista + ": deixa eu confirmar com a equipe se dá pra fazer e " +
    "quanto fica, que eu já te retorno por aqui."
  );
}
