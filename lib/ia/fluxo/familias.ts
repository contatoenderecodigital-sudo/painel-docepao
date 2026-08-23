// ============================================================================
//  AS FAMILIAS DO CARDAPIO
//
//  Uma lista so, e dela sai TODO o resto: o vocabulario de cada etapa, a
//  unidade, a peca de cardapio que vai junto, o piso de quantidade.
//
//  POR QUE UMA LISTA E NAO UMA ETAPA POR FAMILIA
//
//  Pedido do dono em 23/08/2026: "temos que fazer as mesmas regras em todas pra
//  elas nao quebrarem e terem um padrao".
//
//  Ele esta certo, e a versao antiga prova: la cada familia tinha o seu pedaco
//  de codigo, escrito num dia diferente, e as regras divergiram sozinhas. O
//  sabor do salgado era tratado num lugar, o do bolo em outro, o da pizza num
//  terceiro — e cada defeito precisava ser consertado tres vezes. Mais de uma
//  vez consertei um e esqueci o irmao.
//
//  Aqui a familia e DADO. Quem quiser mudar a regra muda num lugar, e ela vale
//  pra todas de uma vez.
// ============================================================================

import catalogo from "../dados/catalogo.json";

export type FamiliaId =
  | "salgado"
  | "docinho"
  | "bolo_festa"
  | "bolo_caseiro"
  | "pizza"
  | "torta"
  | "empadao"
  | "cuca"
  | "cupcake"
  | "padaria";

export type Familia = {
  id: FamiliaId;
  /** Como a padaria chama isso na conversa. */
  nome: string;
  /** Plural, pra escrever "quais salgados voce quer?". */
  plural: string;
  /** Unidade de venda. Sai do cardapio, que e a mesma fonte do preco. */
  unidade: "un" | "kg";
  /** A peca de cardapio que vai junto quando ela pergunta. */
  cardapio: string | null;
  /** O que pode ser pedido nesta familia. Lista fechada. */
  itens: string[];
  /**
   * Sabores que o item aceita, quando o item e um so e o sabor e a escolha
   * (pizza, bolo). Vazio quando cada item ja e a escolha (coxinha, esfirra).
   */
  sabores: string[];
  /**
   * QUANTIDADE MAXIMA PLAUSIVEL.
   *
   * E o que separa "brigadeiro" docinho de "brigadeiro" sabor de bolo: bolo se
   * vende por quilo (1, 2, 3) e docinho por unidade (25, 50, 100). Ninguem
   * encomenda bolo de 100 quilos. O caso inteiro esta no comentario de
   * leitura.ts, e foi ele que motivou a reescrita.
   */
  qtdMaxima: number;
  /** Entra na base calculada da festa? */
  naFesta: boolean;
};

const nomes = (lista: unknown[]) =>
  (lista as { nome: string }[]).map((i) => String(i.nome)).filter(Boolean);

const outrosPor = (cat: string) =>
  ((catalogo.outros_produtos ?? []) as { nome: string; categoria?: string }[])
    .filter((o) => String(o.categoria ?? "") === cat)
    .map((o) => String(o.nome));

const saboresDeBolo = ((catalogo.bolos_recheados?.faixas ?? []) as { sabores?: string[] }[])
  .flatMap((f) => f.sabores ?? [])
  .map(String);

const saboresDePizza = [
  ...((catalogo.pizza?.sabores_salgados ?? []) as string[]),
  ...((catalogo.pizza?.sabores_doces ?? []) as string[]),
].map(String);

export const FAMILIAS: Familia[] = [
  {
    id: "salgado",
    nome: "salgado",
    plural: "salgados",
    unidade: "un",
    cardapio: "salgados",
    itens: [
      ...nomes(catalogo.salgados?.frito?.itens ?? []),
      ...nomes(catalogo.salgados?.assado?.itens ?? []),
    ],
    // O sabor do salgado (carne, frango) vem do proprio cardapio por item.
    sabores: [],
    qtdMaxima: 5000,
    naFesta: true,
  },
  {
    id: "docinho",
    nome: "docinho",
    plural: "docinhos",
    unidade: "un",
    cardapio: "docinhos",
    itens: nomes(catalogo.doces?.itens ?? []),
    sabores: [],
    qtdMaxima: 5000,
    naFesta: true,
  },
  {
    id: "bolo_festa",
    nome: "bolo de festa",
    plural: "bolos de festa",
    unidade: "kg",
    cardapio: "bolos-festa",
    // No bolo o ITEM e o sabor: "bolo de morango" e um bolo, nao um item com
    // observacao.
    itens: saboresDeBolo,
    sabores: saboresDeBolo,
    // Bolo de festa nao passa de vinte quilos: acima disso e docinho contado
    // como se fosse peso.
    qtdMaxima: 20,
    naFesta: true,
  },
  {
    id: "bolo_caseiro",
    nome: "bolo caseiro",
    plural: "bolos caseiros",
    unidade: "un",
    cardapio: "bolos-caseiros",
    itens: nomes(catalogo.bolos_caseiros?.itens ?? []),
    sabores: [],
    qtdMaxima: 100,
    naFesta: false,
  },
  {
    id: "pizza",
    nome: "pizza",
    plural: "pizzas",
    unidade: "un",
    cardapio: "pizza",
    // O tamanho e o item; o sabor e escolha a parte. Pizza inteira aceita ate
    // quatro sabores na mesma forma.
    itens: ["pizza inteira", "pizza meia", "pizza redonda", "calzone"],
    sabores: saboresDePizza,
    qtdMaxima: 100,
    naFesta: false,
  },
  {
    id: "torta",
    nome: "torta",
    plural: "tortas",
    unidade: "kg",
    cardapio: "tortas-empadao",
    itens: [...outrosPor("torta_fria"), ...outrosPor("torta_recheada"), ...outrosPor("bolo_salgado")],
    sabores: [],
    qtdMaxima: 50,
    naFesta: false,
  },
  {
    id: "empadao",
    nome: "empadão",
    plural: "empadões",
    unidade: "kg",
    cardapio: "tortas-empadao",
    itens: outrosPor("empadao"),
    sabores: [],
    qtdMaxima: 50,
    naFesta: false,
  },
  {
    id: "cuca",
    nome: "cuca",
    plural: "cucas",
    unidade: "kg",
    cardapio: "cucas-paes",
    itens: outrosPor("padaria").filter((n) => /cuca|p[ãa]o doce/i.test(n)),
    sabores: [],
    qtdMaxima: 50,
    naFesta: false,
  },
  {
    id: "cupcake",
    nome: "cupcake",
    plural: "cupcakes",
    unidade: "un",
    cardapio: "cupcakes-franciscano",
    itens: [...outrosPor("cupcake"), ...outrosPor("franciscano")],
    sabores: [],
    qtdMaxima: 1000,
    naFesta: false,
  },
  {
    id: "padaria",
    nome: "item de padaria",
    plural: "itens de padaria",
    unidade: "un",
    cardapio: null,
    // Pao frances, cachorro-quente, pao de x. Entra como pedido igual aos
    // outros: decisao do dono em 23/08/2026.
    itens: outrosPor("padaria").filter((n) => !/cuca|p[ãa]o doce/i.test(n)),
    sabores: [],
    qtdMaxima: 2000,
    naFesta: false,
  },
];

export const familia = (id: FamiliaId): Familia =>
  FAMILIAS.find((f) => f.id === id) ?? FAMILIAS[0];

/**
 * DE QUE FAMILIA E ESTE PRODUTO?
 *
 * Casamento pelo comeco do nome, sem acento: o cliente escreve "esfirra de
 * carne" e o cardapio diz "esfirra". Devolve null quando a padaria nao faz.
 */
export function familiaDoProduto(produto: string): Familia | null {
  const semAc = (t: string) =>
    String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const alvo = semAc(produto);
  if (!alvo) return null;

  // O mais especifico ganha: "torta fria com palmito" antes de "torta fria".
  let achada: { f: Familia; tamanho: number } | null = null;
  for (const f of FAMILIAS) {
    for (const item of f.itens) {
      const nome = semAc(item);
      if (!nome) continue;
      if (alvo === nome || alvo.startsWith(nome + " ")) {
        if (!achada || nome.length > achada.tamanho) achada = { f, tamanho: nome.length };
      }
    }
  }
  return achada?.f ?? null;
}
