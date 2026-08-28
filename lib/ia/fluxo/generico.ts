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
import { formasDoCliente, semAcento } from "../texto";

// O NOME CHEGA DO JEITO QUE O CLIENTE FALOU, E "bolos" E "bolo".
//
// Aqui era a setima copia do normalizador de texto, e ela so tirava acento:
// a busca depois e por chave exata, entao qualquer plural, artigo ou
// diminutivo errava. Medido em 28/08/2026:
//
//   ehNomeDeFamilia("bolo")   ->  true
//   ehNomeDeFamilia("bolos")  ->  false
//
// E o efeito era a etapa do bolo se dar por cumprida com "bolos" no lugar do
// sabor: a festa fechava e a cozinha recebia um bolo sem saber o que assar.
//
// `comoOCardapioEscreve` e a mesma reducao que o portao da etapa e a recusa da
// familia ja usam.
const limpo = (t: unknown) => semAcento(String(t ?? ""));

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
// ESTA E A UNICA LISTA DE NOMES DE FAMILIA DO SISTEMA.
//
// Ate 27/08/2026 havia TRES, e elas divergiam:
//
//   generico.ts    pizza, salgado, doce, docinho, bolo, bolo recheado
//   etapas.ts      salgado, salgado frito, salgado assado, docinho, doce, bolo,
//                  bolo recheado
//   montagem.ts    igual a de etapas, escrita noutra ordem
//
// "pizza" era nome de familia num arquivo e nao era nos outros dois, e "salgado
// frito" era nos outros dois e nao aqui. Cada arquivo decidia uma coisa
// diferente sobre a mesma palavra, que e o defeito que mais se repetiu neste
// projeto: uma camada minha discordando da outra.
//
// Regra do dono, 27/08/2026: "nada pode ser so uma lista tua". Nome de familia
// nao e opiniao de arquivo: e uma coisa so, escrita num lugar so.
const FAMILIAS: Record<string, string[]> = {
  pizza: ["pizza"],
  salgado: ["salgado_frito", "salgado_assado"],
  // O cliente diz "salgado frito" sem escolher qual, e isso continua sendo
  // familia: o que falta e o produto, e nao o modo de preparo.
  "salgado frito": ["salgado_frito"],
  "salgado assado": ["salgado_assado"],
  doce: ["docinho"],
  docinho: ["docinho"],
  bolo: ["bolo_festa", "bolo_caseiro"],
  "bolo recheado": ["bolo_festa"],
};

/**
 * As chaves de `FAMILIAS` reduzidas do mesmo jeito que a entrada, pra os dois
 * lados se encontrarem. Sem isto, reduzir so a entrada faria "salgado frito"
 * deixar de casar no dia em que a chave ganhasse um plural.
 */
let chavesCache: Map<string, string[]> | null = null;
function chavesReduzidas(): Map<string, string[]> {
  if (chavesCache) return chavesCache;
  // A chave entra fiel: ela ja e a forma canonica da familia.
  chavesCache = new Map(Object.entries(FAMILIAS).map(([k, v]) => [semAcento(k), v]));
  return chavesCache;
}

/** Este nome é família, e não produto? */
export function ehNomeDeFamilia(produto: unknown): boolean {
  const chaves = chavesReduzidas();
  return formasDoCliente(String(produto ?? "")).some((f) => chaves.has(f));
}

/**
 * O NOME CANONICO DESTA FAMILIA, pra frase que vai pro cliente.
 *
 * `ehNomeDeFamilia` aceita o jeito que ele escreveu, e o fechamento devolvia
 * essa palavra crua na pergunta:
 *
 *     "qual bolos voce quer"
 *
 * A padaria fala com o cliente, entao ela fala certo. Devolve null quando o
 * nome nao e familia.
 */
export function nomeDaFamilia(produto: unknown): string | null {
  const chaves = chavesReduzidas();
  return formasDoCliente(String(produto ?? "")).find((f) => chaves.has(f)) ?? null;
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
  const chaves = chavesReduzidas();
  const cats = formasDoCliente(String(produto ?? "")).map((f) => chaves.get(f)).find(Boolean);
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
