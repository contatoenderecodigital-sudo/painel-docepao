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

// O nome so tira acento e baixa a caixa. Quem entende plural, artigo e
// diminutivo e `formasDoCliente`, usada nas buscas logo abaixo: aqui o texto
// so precisa ficar comparavel.
const limpo = (t: unknown) => semAcento(String(t ?? ""));

/**
 * Os nomes de família, e de que categoria são os produtos de cada uma.
 *
 * A montagem tinha uma copia disto e nao tem mais: ela pergunta pra ca. O
 * comentario abaixo conta a historia das tres listas que existiam.
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

/**
 * A FAMILIA LARGA DESTA CATEGORIA: salgado, docinho, bolo, pizza.
 *
 * Sai da propria `FAMILIAS`, invertida. Nao ha lista nova aqui: cadastrar uma
 * familia la em cima passa a valer aqui sozinho, que e o ponto.
 *
 * QUANDO DUAS CHAVES SERVEM, GANHA A MAIS LARGA. `salgado_frito` aparece em
 * "salgado" (que cobre as duas) e em "salgado frito" (que cobre uma). A
 * resposta certa e "salgado": quem procura a linha generica do salgado tem que
 * achar a coxinha e a esfiha na mesma familia. Empate desempata pela chave que
 * e igual a categoria ("docinho" ganha de "doce"), e depois por ordem
 * alfabetica, pra a resposta nunca depender da ordem em que o objeto foi
 * escrito.
 *
 * null quer dizer que a categoria nao pertence a familia nenhuma (`outro`,
 * `por_quilo`, `cupcake`...), e quem chama decide o que fazer com isso.
 */
let famPorCategoria: Map<string, string> | null = null;
export function familiaDaCategoria(categoria: unknown): string | null {
  if (!famPorCategoria) {
    const m = new Map<string, string>();
    const cats = new Set(Object.values(FAMILIAS).flat());
    for (const cat of cats) {
      const chaves = Object.entries(FAMILIAS)
        .filter(([, lista]) => lista.includes(cat))
        .map(([chave, lista]) => ({ chave, largura: lista.length }))
        .sort(
          (a, b) =>
            b.largura - a.largura ||
            Number(b.chave === cat) - Number(a.chave === cat) ||
            a.chave.localeCompare(b.chave),
        );
      if (chaves[0]) m.set(cat, chaves[0].chave);
    }
    famPorCategoria = m;
  }
  return famPorCategoria.get(String(categoria ?? "")) ?? null;
}

/**
 * A FAMILIA LARGA DE UM NOME QUE O CLIENTE ESCREVEU ("salgados", "doce").
 *
 * `nomeDaFamilia` devolve a chave que casou, que pode ser estreita ("salgado
 * frito"). Aqui ela vira a larga, que e a que serve pra juntar com a linha
 * generica. null quando o nome nao e familia.
 */
export function familiaDoNome(produto: unknown): string | null {
  const chave = nomeDaFamilia(produto);
  if (!chave) return null;
  const cats = FAMILIAS[chave] ?? [];
  return (cats[0] && familiaDaCategoria(cats[0])) || chave;
}

/**
 * A CATEGORIA DESTE NOME DE FAMILIA, quando ela e UMA so.
 *
 * POR QUE ISTO EXISTE
 *
 * "salgado assado" e nome de familia, e nao produto do cardapio. Quem da a
 * categoria fora das etapas de familia e o catalogo, e o catalogo nao conhece
 * nome de familia: devolvia `outro`. Medido contra a producao em 29/08/2026,
 * lendo a montagem de verdade:
 *
 *     {"produto": "salgado assado", "categoria": "outro", "qtd": 200}
 *
 * Com `outro`, `temCategoria(p, "salgado")` da falso, a etapa do salgado se
 * considera fora do assunto e e PULADA. Ninguem pergunta quais salgados, e a
 * cozinha recebe uma linha de 200 sem produto nenhum.
 *
 * A tabela `FAMILIAS` aqui em cima sabia a resposta o tempo todo. Faltava
 * alguem perguntar pra ela.
 *
 * UMA SO, DE PROPOSITO
 *
 * "salgado assado" aponta pra `salgado_assado`, e nao ha o que decidir. Mas
 * "salgado" sozinho aponta pra frito E assado, e ai escolher seria chutar a
 * bancada: se o item nunca for resolvido, a comanda sai na sala errada. Nesse
 * caso devolve null e quem chama segue como seguia.
 */
export function categoriaUnicaDaFamilia(produto: unknown): string | null {
  const chave = nomeDaFamilia(produto);
  if (!chave) return null;
  const cats = chavesReduzidas().get(semAcento(chave)) ?? [];
  return cats.length === 1 ? cats[0] : null;
}

/** Este nome é família, e não produto? */
export function ehNomeDeFamilia(produto: unknown): boolean {
  const chaves = chavesReduzidas();
  return formasDoCliente(String(produto ?? "")).some((f) => chaves.has(f));
}

/** As chaves canônicas (pizza, salgado, docinho...), pra o leitor achar na frase. */
export function chavesDeFamilia(): string[] {
  return Object.keys(FAMILIAS);
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
  // A PADARIA FALA CERTO, MESMO QUANDO O CLIENTE ESCREVE TORTO.
  //
  // Aqui ia a palavra CRUA que ele digitou, e o portao aceita plural, artigo e
  // diminutivo. Medido em 28/08/2026:
  //
  //   "bolos"      ->  "Qual bolos voce quer?"
  //   "uns bolos"  ->  "Qual uns bolos voce quer?"
  //   "doces"      ->  "Qual doces voce quer?"
  //
  // O mesmo defeito ja tinha sido consertado no fechamento, com `nomeDaFamilia`,
  // e esta e a outra porta: a pergunta da etapa da confirmacao.
  const nome = nomeDaFamilia(produto) ?? limpo(produto);
  if (opcoes.length > 4) return "Qual " + nome + " você quer?";
  const lista = opcoes.slice(0, -1).join(", ") + " ou " + opcoes[opcoes.length - 1];
  return "Qual " + nome + " você quer: " + lista + "?";
}
