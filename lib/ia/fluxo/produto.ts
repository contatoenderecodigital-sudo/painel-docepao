// ============================================================================
//  UM NOME SÓ POR PRODUTO.
//
//  POR QUE ISTO EXISTE
//
//  Até 26/08/2026 o nome de um produto era decidido em quatro lugares
//  diferentes: o modelo escrevia do jeito dele, `separarProdutoERecheio`
//  resolvia de um jeito, o motor de preço de outro, e o item guardado de outro.
//  Quatro caminhos escrevendo o nome da mesma coisa.
//
//  O preço disso foi medido: na bateria dos cinco jeitos, as execuções que
//  passavam gravavam `bolo 4 leites` e as que falhavam gravavam `4 leites`, o
//  mesmo bolo com dois nomes. A comparação falhava, o item entrava duas vezes,
//  e o cupom da cozinha saiu com "misto: bolo 4 leites e 4 leites".
//
//  O PREFIXO "bolo" NÃO É ENFEITE. É ELE QUE SEPARA DOCINHO DE BOLO:
//
//      brigadeiro        -> docinho,  R$ 1,25   a unidade
//      bolo brigadeiro   -> bolo,     R$ 46,90  o quilo
//
//  Um sabor sem o prefixo vira o docinho de mesmo nome, e o pedido sai com
//  R$ 2,50 no lugar de R$ 93,80. Por isso o nome canônico do bolo carrega o
//  "bolo" na frente, que é como a tabela de preço guarda.
//
//  Todo mundo que precisa saber o que é um item passa por aqui.
// ============================================================================

import catalogo from "../dados/catalogo.json";
import { APELIDOS } from "../dados/apelidos";
import { unidadeDoPedido as unidadeDoProduto } from "@/lib/ia/dados/produtos";

const semAcMin = (t: string) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Os sabores de bolo de festa, que no cardápio vêm sem o prefixo. */
function saboresDeBolo(): string[] {
  const c = catalogo as unknown as { bolos_recheados?: { faixas?: { sabores?: string[] }[] } };
  return (c.bolos_recheados?.faixas ?? []).flatMap((f) => f.sabores ?? []).map(String);
}

/**
 * Os bolos caseiros, que no cardápio vêm sem o "caseiro" no nome ("cenoura").
 *
 * O nome do catálogo e o nome do sistema são "bolo caseiro cenoura", porque é
 * assim que a tabela de preço guarda e é assim que a comanda roteia.
 */
function bolosCaseiros(): string[] {
  const c = catalogo as unknown as { bolos_caseiros?: { itens?: { nome?: string }[] } };
  return (c.bolos_caseiros?.itens ?? []).map((i) => String(i?.nome ?? "")).filter(Boolean);
}

/** Nome de produto vendido avulso, fora os bolos (de festa e caseiros). */
function produtosDoCatalogo(): string[] {
  const c = catalogo as unknown as Record<string, unknown>;
  const de = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map((x) => String((x as { nome?: string })?.nome ?? "")).filter(Boolean)
      : [];
  const s = c.salgados as { frito?: { itens?: unknown }; assado?: { itens?: unknown } } | undefined;
  return [
    ...de(s?.frito?.itens),
    ...de(s?.assado?.itens),
    ...de((c.doces as { itens?: unknown } | undefined)?.itens),
    ...de(c.outros_produtos),
  ];
}

export type Identidade = {
  /** O nome como o resto do sistema tem que escrever, sempre igual. */
  produto: string;
  /** O que veio grudado no nome e não é o produto: "frango" em "quiche de frango". */
  recheio: string | null;
  /** kg ou un, tirado do cardápio. */
  unidade: "kg" | "un";
  /** true quando o nome só existe num lugar do cardápio. */
  unico: boolean;
};

/**
 * O QUE É ESTE ITEM, RESOLVIDO CONTRA O CARDÁPIO.
 *
 * `categoria` é a dica de onde a conversa está. Ela decide o desempate quando o
 * nome existe em mais de um lugar: "brigadeiro" na etapa do bolo é bolo, na
 * etapa do docinho é docinho. Sem ela, um nome ambíguo fica como veio, e quem
 * resolve é a pergunta ao cliente.
 */
export function identificarProduto(nomeBruto: string, categoria?: string): Identidade {
  const bruto = String(nomeBruto || "").trim();
  // "bolo DE cenoura" e "bolo cenoura" são o mesmo bolo, e antes viravam dois
  // nomes diferentes no pedido: o "de" fazia o nome não casar com candidato
  // nenhum, e o fluxo devolvia o texto cru. Era exatamente a doença que este
  // arquivo foi criado pra curar, sobrevivendo numa preposição.
  const t = semAcMin(bruto).replace(/^bolo (de |do |da ) */, "bolo ");
  if (!t) return { produto: bruto, recheio: null, unidade: "un", unico: false };

  const ehEtapaDeBolo = String(categoria || "").startsWith("bolo");

  // ------------------------------------------------------------ candidatos
  // Cada candidato sabe o nome que o sistema deve escrever (o canônico) e a
  // forma pela qual o cliente pode ter escrito.
  // `apelido` marca o candidato que veio da lista de sinonimos. Ele so vale
  // quando o que o cliente escreveu NAO e um produto do cardapio: ver o porque
  // logo abaixo, na escolha.
  const cand: { canonico: string; casa: string; deBolo: boolean; apelido: boolean }[] = [];

  for (const s of saboresDeBolo()) {
    // O sabor sozinho E com o prefixo casam, e os dois viram "bolo <sabor>".
    cand.push({ canonico: "bolo " + s, casa: semAcMin(s), deBolo: true, apelido: false });
    cand.push({ canonico: "bolo " + s, casa: semAcMin("bolo " + s), deBolo: true, apelido: false });
  }
  // O BOLO CASEIRO TAMBÉM PRECISA DE UM NOME SÓ.
  //
  // Ele não tinha. O fluxo devolvia o que o cliente escrevesse, e o mesmo bolo
  // saía como "cenoura", "bolo cenoura" ou "bolo de cenoura". Funcionava por
  // sorte, no casamento parcial do motor de preço. Medido em 26/08/2026, a
  // sorte já tinha acabado em três casos:
  //
  //   "café" sozinho     -> cotava o DOCINHO de café, R$ 1,25 no lugar de
  //                         R$ 35,90. É o mesmo defeito do brigadeiro, que já
  //                         tinha transformado um bolo de 2 kg em R$ 2,50.
  //   "bolo banana caramelizada"   -> cotava a LARANJA caramelizada, R$ 34,90
  //                                   no lugar de R$ 30,90.
  //   "bolo prestígio com ganache" -> cotava o bolo de FESTA de prestígio,
  //                                   R$ 46,90 o quilo no lugar de R$ 33,90 a
  //                                   unidade. Errava preço, produto E unidade.
  //
  // Marcado como bolo (`deBolo`) de propósito: "café" é docinho e é bolo
  // caseiro, e quem desempata é a etapa da conversa, igual ao brigadeiro.
  for (const n of bolosCaseiros()) {
    const canonico = "bolo caseiro " + n;
    for (const jeito of [n, "bolo " + n, "bolo caseiro " + n]) {
      cand.push({ canonico, casa: semAcMin(jeito), deBolo: true, apelido: false });
    }
  }
  for (const p of produtosDoCatalogo()) {
    cand.push({ canonico: p, casa: semAcMin(p), deBolo: false, apelido: false });
  }
  for (const [canonico, lista] of Object.entries(APELIDOS)) {
    for (const a of lista) cand.push({ canonico, casa: semAcMin(a), deBolo: false, apelido: true });
  }

  const servem = cand
    .filter((c) => c.casa && (t === c.casa || t.startsWith(c.casa + " ")))
    // Nome mais longo primeiro: "mini bolha de carne" é "mini bolha" + "carne",
    // nunca "mini" + "bolha de carne".
    .sort((a, b) => b.casa.length - a.casa.length);

  if (!servem.length) {
    return {
      produto: bruto,
      recheio: null,
      unidade: unidadeDoProduto(bruto, categoria),
      unico: false,
    };
  }

  // O nome existe em mais de um lugar? Só é ambíguo de verdade quando os
  // candidatos discordam sobre SER BOLO OU NÃO: "brigadeiro" é docinho e é
  // sabor de bolo, e isso muda o preço em quarenta vezes.
  // O NOME DO CARDAPIO GANHA DO APELIDO. SEMPRE.
  //
  // A lista de apelidos mistura duas coisas. Sinonimo de verdade ("esfiha" e
  // "esfirra", "chique" e "quiche") tem o mesmo preco e pode virar nome
  // canonico. Mas ela tambem tem "cuca" apontando pra "cuca recheada", que a
  // casa usa pra NAO RECUSAR o pedido, e essas mudam o preco:
  //
  //     cuca        R$ 22,90  ->  cuca recheada           +R$ 4,00
  //     empadao     R$ 34,90  ->  empadao com palmito     +R$ 5,00
  //     torta fria  R$ 36,90  ->  torta fria com palmito  +R$ 3,00
  //
  // Usar a lista inteira pra renomear cobraria a mais de quem pediu o simples.
  // Entao: se o que ele escreveu JA E um produto do cardapio, e ele mesmo.
  const tamanhoDoMelhor = servem[0].casa.length;
  const noTamanho = servem.filter((c) => c.casa.length === tamanhoDoMelhor);
  const proprios = noTamanho.filter((c) => !c.apelido);
  const empatados = proprios.length ? proprios : noTamanho;
  const ambiguo = new Set(empatados.map((c) => c.deBolo)).size > 1;

  // A etapa desempata. Sem ela, fica o primeiro e quem resolve é a pergunta.
  const escolhido = ambiguo
    ? (empatados.find((c) => c.deBolo === ehEtapaDeBolo) ?? empatados[0])
    : empatados[0];

  const resto = t
    .slice(escolhido.casa.length)
    .replace(/^ *(de|da|do|com) +/, "")
    .trim();

  return {
    produto: escolhido.canonico,
    recheio: resto || null,
    unidade: unidadeDoProduto(escolhido.canonico, categoria),
    unico: !ambiguo,
  };
}
