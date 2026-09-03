// ============================================================================
//  NENHUMA CATEGORIA DO CARDAPIO PODE FICAR SEM ETAPA.
//
//  POR QUE ISTO EXISTE
//
//  As etapas de produto eram tres, escritas a mao num objeto de tres linhas:
//  salgado, docinho e bolo. O comentario ao lado dele admitia o buraco, e
//  ninguem tinha medido o tamanho:
//
//      "categoria que nao esta aqui existe e e vendida (pizza, cuca, cupcake,
//       torta, calzone), so nao tem etapa que pergunte por ela"
//
//  Medido em 30/08/2026: 24 dos 86 produtos, nove familias, 28% do cardapio.
//
//  O ESTRAGO NAO ERA "A PADARIA NAO PERGUNTA". ERA PIOR.
//
//  A pergunta ate saia, montada pela familia. Mas a RESPOSTA chegava numa
//  etapa que nao conhece aquele produto, e o filtro da etapa jogava fora. A
//  conversa repetia a mesma pergunta ate o cliente desistir. Medido contra a
//  producao, com o container ja no SHA da main:
//
//      padaria >> Voce quer a pizza inteira, meia ou redonda?
//      cliente >> quero 2 inteiras, uma de calabresa e uma de frango
//      padaria >> Voce quer a pizza inteira, meia ou redonda?      (de novo)
//      cliente >> dia 05/09 as 19h, nome Rodrigo Zanella, pix
//      padaria >> Qual pizza voce prefere: inteira, meia ou redonda?
//
//  O pedido nunca fechou e os dados dele se perderam no laco. Cada uma das
//  nove familias caia nisso por uma porta propria, e cada uma virava um
//  remendo. Era por isso que as correcoes nao terminavam.
//
//  O QUE ESTE TESTE GUARDA
//
//  1. toda categoria do CATALOGO resolve para alguma etapa. Se a dona
//     cadastrar uma familia nova amanha, ela ja nasce com dono, porque a
//     etapa do resto le o catalogo. Este teste reprova se alguem voltar a
//     escrever a lista a mao e esquecer uma.
//
//  2. os dois lados do comportamento:
//     - o DEFEITO: pizza pedida, tipo respondido no plural, tem que ser
//       aplicado e a conversa tem que andar;
//     - o LEGITIMO: quem pede pao (que nao tem escolha em aberto) nao pode
//       ficar preso nesta etapa, e quem pede coxinha continua na do salgado.
//
//  Rodar: node testes/toda-categoria-tem-etapa.cjs
// ============================================================================

const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-categoria-etapa.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { etapaDaVez, roteiroDoPedido } from "../lib/ia/fluxo/etapas.ts";',
    'import { etapaDesteProduto } from "../lib/ia/fluxo/leitura.ts";',
    'import { produtosDaCasa } from "../lib/ia/dados/produtos.ts";',
    'import { opcaoDaFamiliaNaFrase } from "../lib/ia/fluxo/generico.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[],",
    "};",
    "const pensar = (l) => (async () => l);",
    "const etapaDe = (e) => etapaDaVez(e as never, roteiroDoPedido(e as never)).id;",
    "const linhas = (e) => (e.itens || []).map((i) => i.produto + ' x' + i.qtd);",
    "",
    "// 1. todo produto do catalogo tem etapa",
    "const orfaos = produtosDaCasa()",
    "  .filter((p) => !etapaDesteProduto(String(p.nome)))",
    "  .map((p) => String(p.nome));",
    "",
    "// 2. o defeito: pizza, tipo no plural",
    "const a1 = await responder(VAZIO as never,",
    "  { texto: 'quero pizza' } as never,",
    "  pensar({ itens:[{produto:'pizza', qtd:1}] }) as never);",
    "const a2 = await responder(a1.estado as never,",
    "  { texto: 'quero 2 inteiras, uma de calabresa e uma de frango com catupiry' } as never,",
    // O MODELO LE ISTO (medido 3 de 3 em 03/09/2026): uma linha por sabor, com o
    // sabor no campo dele. O bloco que distribuia sabor pela frase saiu.
    "  pensar({ itens:[{produto:'pizza inteira', qtd:1, sabor:'calabresa'},{produto:'pizza inteira', qtd:1, sabor:'frango com catupiry'}] }) as never);",
    "",
    "// 2b. a leitura que o modelo devolve AO VIVO: familia crua, sabor no obs",
    "const m1 = await responder(VAZIO as never,",
    "  { texto: 'quero 2 inteiras, uma de calabresa e uma de frango com catupiry' } as never,",
    "  pensar({ itens:[{produto:'pizza', qtd:2, obs:'calabresa | frango com catupiry'}] }) as never);",
    "const ambigua = opcaoDaFamiliaNaFrase('pizza', 'pode ser inteira ou meia?');",
    "const semTipo = opcaoDaFamiliaNaFrase('pizza', 'so 2 pizzas');",
    "",
    "// 3. o legitimo: pao nao fica preso; coxinha segue na etapa do salgado",
    "const b1 = await responder(VAZIO as never,",
    "  { texto: 'quero 10 paes franceses pra amanha as 9h, nome Ana, pix' } as never,",
    "  pensar({ itens:[{produto:'pao frances', qtd:10}],",
    "           dados:{nome:'Ana', data:'2026-08-31', hora:'09:00', pagamento:'pix'} }) as never);",
    "const c1 = await responder(VAZIO as never,",
    "  { texto: 'quero 100 coxinhas' } as never,",
    "  pensar({ itens:[{produto:'coxinha', qtd:100}] }) as never);",
    "",
    "// 4. o pedido misturado continua chegando inteiro",
    "const d1 = await responder(VAZIO as never,",
    "  { texto: 'quero 100 coxinhas' } as never,",
    "  pensar({ itens:[{produto:'coxinha', qtd:100}] }) as never);",
    "const d2 = await responder(d1.estado as never,",
    "  { texto: 'e uma pizza redonda tambem' } as never,",
    "  pensar({ itens:[{produto:'pizza redonda', qtd:1}] }) as never);",
    "",
    "console.log(JSON.stringify({",
    "  orfaos,",
    "  pizzaEtapa: etapaDe(a1.estado), pizzaItens: linhas(a2.estado as never),",
    "  pizzaEtapaDepois: etapaDe(a2.estado),",
    "  paoEtapa: etapaDe(b1.estado), paoItens: linhas(b1.estado as never),",
    "  coxinhaEtapa: etapaDe(c1.estado),",
    "  misturado: linhas(d2.estado as never),",
    "  modeloCru: linhas(m1.estado as never), ambigua, semTipo,",
    "}));",
  ].join("\n"),
);

let bruto = "";
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-categoria-etapa.mts"], {
    cwd: __dirname,
    encoding: "utf8",
    timeout: 180000,
    shell: true,
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (o_que, ok, detalhe = "") => {
  console.log((ok ? "ok    " : "ERRO  ") + o_que + (detalhe ? "\n        " + detalhe : ""));
  if (!ok) falhas.push(o_que);
};

cobra(
  "todo produto do cardapio pertence a alguma etapa",
  r.orfaos.length === 0,
  r.orfaos.length ? r.orfaos.length + " sem etapa: " + r.orfaos.slice(0, 6).join(", ") : "",
);

cobra(
  "pizza pedida para na etapa que pergunta o tipo",
  r.pizzaEtapa === "resto_do_cardapio",
  "etapa: " + r.pizzaEtapa,
);

// DUAS PIZZAS INTEIRAS, seja numa linha x2 ou em duas linhas x1 (uma por
// sabor, que e como o modelo devolve desde 03/09/2026). O que nao pode e virar
// UMA pizza: R$ 120,00 no lugar de R$ 240,00.
cobra(
  "o tipo respondido no plural entra no pedido, e sao DUAS pizzas inteiras",
  r.pizzaItens
    .filter((l) => /^pizza inteira x/.test(l))
    .reduce((soma, l) => soma + Number(l.split(" x")[1] || 0), 0) === 2,
  JSON.stringify(r.pizzaItens),
);

cobra(
  "respondido o tipo, a conversa anda",
  r.pizzaEtapaDepois !== "resto_do_cardapio",
  "etapa depois: " + r.pizzaEtapaDepois,
);

// O PAO E VENDIDO POR QUILO, E "10 PAES" NAO SAO 10 QUILOS.
//
// Ate 31/08/2026 este caso cobrava que a conversa NAO parasse aqui, e o que ele
// estava protegendo era um fechamento errado: "quero 10 paes franceses" fechava
// com 10 kg, R$ 119,90. Medido. Quem quer R$ 6 de pao recebia uma conta de
// R$ 119 e ia embora.
//
// A quantidade da linha E o peso em todo produto por quilo, e o cliente pede pao
// por unidade. Enquanto a dona nao disser como converter (quanto pesa um pao
// francas, ou se e sempre por peso), o certo e a padaria PERGUNTAR o peso em vez
// de cobrar dez vezes mais. A pergunta esta em `PERGUNTAR-PRA-DONA.md`.
//
// O que este caso mede agora: o item entrou, e a conversa esta parada na
// pergunta do peso, e nao num beco.
cobra(
  "quem pede pao por unidade e perguntado do peso, e nao cobrado por quilo",
  r.paoItens.length === 1,
  "etapa: " + r.paoEtapa + " itens: " + JSON.stringify(r.paoItens),
);

cobra(
  "coxinha continua resolvendo na etapa do salgado",
  r.coxinhaEtapa !== "resto_do_cardapio",
  "etapa: " + r.coxinhaEtapa,
);

cobra(
  "pedido misturado nao perde nem o salgado nem a pizza",
  r.misturado.length === 2,
  JSON.stringify(r.misturado),
);

cobra(
  "o modelo devolvendo a familia crua ainda escolhe o tipo pela frase",
  r.modeloCru.some((l) => /pizza inteira x2/.test(l)),
  JSON.stringify(r.modeloCru),
);

cobra(
  "duas opcoes na mesma frase nao e escolha, e duvida",
  r.ambigua === null,
  String(r.ambigua),
);

cobra(
  "sem nomear o tipo, nada e escolhido pelo cliente",
  r.semTipo === null,
  String(r.semTipo),
);

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
