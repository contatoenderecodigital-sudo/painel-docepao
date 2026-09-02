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

import { produtosDaCasa, produtoNoComeco, produtoPorNome } from "../dados/produtos";
import { cercaDaPalavra, formasDoCliente, semAcento } from "../texto";

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
/**
 * OS AGRUPAMENTOS E APELIDOS QUE O CATALOGO NAO SABE DIZER.
 *
 * Sao decisoes, e por isso ficam escritas: "salgado" cobre frito E assado,
 * "bolo" cobre festa E caseiro (e NAO o bolo salgado, que e outro produto),
 * "doce" e como muita gente chama o docinho, e "torta" cobre a fria e a
 * recheada. Nenhuma dessas relacoes esta no cardapio; elas sao de quem atende.
 *
 * O RESTO SAI DO CATALOGO, logo abaixo. Aqui so entra o que precisa de decisao.
 */
const AGRUPAMENTOS: Record<string, string[]> = {
  salgado: ["salgado_frito", "salgado_assado"],
  // O cliente diz "salgado frito" sem escolher qual, e isso continua sendo
  // familia: o que falta e o produto, e nao o modo de preparo.
  "salgado frito": ["salgado_frito"],
  "salgado assado": ["salgado_assado"],
  doce: ["docinho"],
  bolo: ["bolo_festa", "bolo_caseiro"],
  "bolo recheado": ["bolo_festa"],
  // "torta" nao e nome de produto nenhum (os produtos sao "torta fria", "torta
  // doce", "torta especial"), entao ela pode agrupar as duas categorias.
  torta: ["torta_fria", "torta_recheada"],
};

/**
 * AS FAMILIAS QUE SAEM DO PROPRIO CARDAPIO.
 *
 * POR QUE ISTO DEIXOU DE SER LISTA MINHA
 *
 * Aqui havia oito nomes digitados a mao, e o cardapio tem QUINZE categorias.
 * Medido em 02/09/2026, conversando com a producao:
 *
 *   cliente >> quero bolo, salgados, docinhos e cupcakes
 *   rastro  >> TIREI DO PEDIDO, nao existe no cardapio: 1x cupcake
 *
 * Existem quatro cupcakes na casa. "cupcake" nao e nome de produto (os produtos
 * sao "cupcake pequeno", "cupcake grande"), e sim nome de GRUPO -- so que este
 * arquivo nao sabia disso, e a guarda que impede produto inventado apagou o
 * pedido do cliente. O proprio comentario acima ja dizia a regra do dono: "nada
 * pode ser so uma lista tua".
 *
 * AS DUAS CONDICOES, e as duas sao necessarias:
 *
 *   MAIS DE UM PRODUTO. Categoria de um produto so nao e grupo: nomear o
 *   calzone JA e escolher o calzone.
 *
 *   O NOME NAO PODE SER DE UM PRODUTO. Medido antes de escrever isto, e ele
 *   sozinho evitaria cinco regressoes: `empadao`, `calzone`, `franciscano`,
 *   `torta fria` e `bolo salgado` sao categoria E produto ao mesmo tempo. Nome
 *   de familia e tratado no fluxo como "ainda vai virar produto", entao a
 *   padaria NUNCA perguntaria a quantidade de um empadao.
 *
 * Cadastrar uma categoria nova com dois produtos passa a valer sozinho, que e o
 * ponto: o dia em que a dona criar "salgado de forno" ninguem precisa vir aqui.
 */
function familiasDoCardapio(): Record<string, string[]> {
  const quantos = new Map<string, number>();
  const nomes = new Set<string>();
  for (const p of produtosDaCasa()) {
    quantos.set(p.categoria, (quantos.get(p.categoria) ?? 0) + 1);
    nomes.add(semAcento(p.nome));
  }
  const saiu: Record<string, string[]> = {};
  for (const [categoria, n] of quantos) {
    if (n < 2) continue;
    const legivel = String(categoria).replace(/_/g, " ").trim();
    if (!legivel || nomes.has(semAcento(legivel))) continue;
    // O QUE UM AGRUPAMENTO JA COBRE NAO ENTRA DE NOVO POR AQUI.
    //
    // "bolo festa" e "bolo caseiro" vivem dentro de "bolo", e "torta recheada"
    // dentro de "torta". Cadastrar os dois nomes fazia a familia larga disputar
    // com a estreita, e o portao pegou na hora, em tres testes:
    //
    //   cliente >> quero 50 de morango
    //   virou   >> 50 ~ bolo festa      (esperado: 50 ~ bolo)
    //   conta   >> 50 kg de bolo morango, R$ 2.345,00
    //
    // Quem tem a decisao de como o grupo se chama e o agrupamento, escrito por
    // gente. A derivacao so preenche o que ninguem decidiu.
    const jaCoberto = Object.keys(AGRUPAMENTOS).some(
      (chave) => semAcento(legivel) === semAcento(chave) || semAcento(legivel).startsWith(semAcento(chave) + " "),
    );
    if (jaCoberto) continue;
    saiu[legivel] = [categoria];
  }
  return saiu;
}

// O agrupamento GANHA da derivacao quando os dois falam do mesmo nome: ele e
// decisao de quem atende, e a derivacao e so o que o cardapio revela.
const FAMILIAS: Record<string, string[]> = { ...familiasDoCardapio(), ...AGRUPAMENTOS };

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
export function categoriasDaFamilia(produto: unknown): string[] {
  const chave = nomeDaFamilia(produto);
  if (!chave) return [];
  return chavesReduzidas().get(semAcento(chave)) ?? [];
}

export function categoriaUnicaDaFamilia(produto: unknown): string | null {
  const cats = categoriasDaFamilia(produto);
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
  const texto = String(produto ?? "");
  const chaves = chavesReduzidas();
  // Mini pizza e produto de salgado. A chave "pizza" nao pode ganhar dela.
  for (const f of formasDoCliente(texto)) {
    const daCasa = produtoPorNome(f) ?? produtoNoComeco(f);
    if (daCasa && String(daCasa.categoria).startsWith("salgado")) return null;
    if (chaves.has(f)) return f;
  }
  return null;
}

/**
 * DE QUE FAMILIA E ESTE PRODUTO?
 *
 * Pergunta diferente da que `nomeDaFamilia` responde, e por isso ela existe.
 * `nomeDaFamilia` responde "este NOME e uma familia?", entao para "pizza
 * inteira" ela devolve null, que esta certo: "pizza inteira" e um produto,
 * nao uma familia.
 *
 * Quem precisa saber a que familia um PRODUTO pertence tinha que remontar a
 * conta por fora. O `fluxo.ts` fazia isso em linha, e o
 * `oClienteNomeouEsteProduto` nao fazia: por isso ele nao conseguia tirar o
 * prefixo de "pizza inteira" para procurar "inteira" na frase, e a resposta
 * do cliente era descartada.
 *
 * Duas contas do mesmo assunto em lugares diferentes e o defeito que mais se
 * repetiu neste projeto. Agora e uma so, e a resposta sai do CATALOGO:
 * `opcoesDaFamilia` ja lista os produtos de cada familia.
 */
export function familiaDoProduto(produto: unknown): string | null {
  const nome = limpo(String(produto ?? ""));
  if (!nome) return null;
  const direto = nomeDaFamilia(produto);
  if (direto) return direto;
  return chavesDeFamilia().find((chave) =>
    opcoesDaFamilia(chave).some((o) => limpo(o) === nome),
  ) ?? null;
}

/**
 * ELE RESPONDEU QUAL, DENTRE AS OPCOES QUE A PADARIA OFERECEU?
 *
 * A padaria pergunta "inteira, meia ou redonda?" e o cliente responde
 * "2 inteiras". Nenhuma dessas palavras e o nome do produto ("pizza
 * inteira"), e cacar "inteira" solta na frase seria pior que o defeito:
 * "quero a torta inteira" viraria uma pizza.
 *
 * Entao a busca e presa ao contexto: so vale para as opcoes que a padaria
 * ACABOU de oferecer, e as opcoes saem do catalogo (`opcoesDaFamilia`). O que
 * se procura e a parte que DISTINGUE uma da outra, ou seja, o nome do produto
 * sem o prefixo da familia: "inteira", "meia", "redonda".
 *
 * Medido contra a producao em 30/08/2026: das tres respostas que a propria
 * padaria oferece, "inteira" era a unica que ela nao lia. "redonda" e "meia"
 * tem apelido proprio no catalogo; "inteira" nao tinha, e o pedido do Rodrigo
 * ficou num laco de quatro mensagens ate morrer sem fechar.
 *
 * O plural entra pela gramatica, do mesmo jeito e na mesma ordem do
 * `formasDoCliente`: a forma fiel primeiro, a reduzida so se a fiel nao achou.
 */
export function opcaoDaFamiliaNaFrase(familia: unknown, frase: unknown): string | null {
  const opcoes = opcoesDaFamilia(familia);
  if (opcoes.length < 2) return null;

  const t = limpo(frase);
  if (!t) return null;
  const semPlural = t.replace(/(aes|oes|aos)\b/g, "ao").replace(/s\b/g, "");
  const nomeFam = limpo(nomeDaFamilia(familia) ?? String(familia ?? ""));

  const achou: string[] = [];
  for (const opcao of opcoes) {
    const inteiro = limpo(opcao);
    // "pizza inteira" menos "pizza" e "inteira": e o que separa uma da outra.
    const soOQueDistingue = inteiro.replace(nomeFam, " ").replace(/ +/g, " ").trim();
    const alvos = [inteiro, soOQueDistingue].filter((a) => a.length >= 3);
    const bateu = alvos.some((a) => {
      const cerca = cercaDaPalavra(a);
      return cerca.test(t) || cerca.test(semPlural);
    });
    if (bateu) achou.push(opcao);
  }

  // DUAS OPCOES NA MESMA FRASE NAO E RESPOSTA, E DUVIDA.
  //
  // "pode ser inteira ou meia?" nao escolheu nada. Devolver a primeira seria
  // a padaria decidindo pelo cliente, que e o defeito que este projeto mais
  // pagou caro.
  return achou.length === 1 ? achou[0] : null;
}

// O LIMITE DESTA FUNCAO, ESCRITO PRA QUEM VIER DEPOIS.
//
// Ela nao le a frase inteira: se o cliente escrever "quero uma pizza e a
// torta inteira", o "inteira" e da torta e ela vai devolver `pizza inteira`.
// Quem chama so pergunta quando o MODELO ja disse que a linha e daquela
// familia, entao o caso exige o modelo errar junto.
//
// Nao foi resolvido de proposito: o conserto seria olhar a distancia entre as
// palavras, e isso e leitura de frase, que e trabalho do modelo. O que estava
// em jogo era um laco que nao fechava pedido nenhum.

/**
 * PIZZA DE VERDADE, NAO SALGADINHO.
 *
 * Mini pizza e salgado assado e fica na etapa do salgado. Pizza, pizza
 * redonda, pizza inteira, pizza meia e calzone nao sao essa etapa: carimbar
 * `salgado_frito` nelas era o pulo da festa pra pizza (ou o contrario).
 */
export function ehPizzaQueNaoESalgado(produto: unknown): boolean {
  const texto = String(produto ?? "");
  for (const f of formasDoCliente(texto)) {
    const daCasa = produtoPorNome(f) ?? produtoNoComeco(f);
    if (daCasa) return daCasa.categoria === "pizza" || daCasa.categoria === "calzone";
  }
  if (ehNomeDeFamilia(texto) && nomeDaFamilia(texto) === "pizza") return true;
  const reduzido = formasDoCliente(texto)[1] || formasDoCliente(texto)[0] || limpo(texto);
  if (/^calzone\b/.test(reduzido)) return true;
  return /^pizzas?\b/.test(reduzido) || reduzido.startsWith("pizza ");
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
