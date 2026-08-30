// PERGUNTA DE OUTRA FAMILIA NAO GRUDA NA ETAPA
//
// Print do dono, 30/08/2026, Rodrigo Zanella 15:31:
//
//   cliente >> boa tarde, voces fazem pizza de forma?
//   padaria >> E o bolo, qual sabor?  + cardapio BOLOS DE FESTA
//              papel de arroz, topo a equipe orca
//              A IA parou e esta esperando voce
//
// Ele perguntou PIZZA DE FORMA. A etapa era bolo, o assunto nao se cumpre
// sem item de bolo, e a mesma pergunta saiu de novo ate chamar a equipe.
//
// OS DOIS LADOS
//
//   1. na etapa do bolo, "voces fazem pizza de forma?" (modelo vazio, ou
//      falouDeOutraEtapa bolo, ou perguntou outro) responde pizza de forma,
//      manda o cardapio de pizza, nao chama humano
//   2. ainda na etapa do bolo, "4 leites" continua anotando o bolo
//
// Roda com: node testes/pergunta-nao-gruda-etapa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-pergunta-nao-gruda.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { produtoPorNome } from "../lib/ia/dados/produtos.ts";',
    'import { brl } from "../lib/ia/orcamento.ts";',
    "",
    "const ULTIMA =",
    "  'E o bolo, qual sabor?' +",
    "  '\\n\\nSe quiser, dá pra misturar dois sabores no mesmo bolo. Nesse caso vale o valor do mais caro dos dois.';",
    "",
    "const NO_BOLO = {",
    "  ehFesta:true, pessoas:20, baseAceita:true,",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "  itens:[",
    "    {produto:'coxinha',categoria:'salgado_frito',qtd:200,obs:null},",
    "    {produto:'brigadeiro',categoria:'docinho',qtd:100,obs:null},",
    "  ],",
    "  naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ofereceu:true,",
    "  ultimaFala:ULTIMA, insistiu:1, retomarEm:null, assunto:'bolo',",
    "  etapasJaPerguntadas:['bolo','bolo:sabor'],",
    "};",
    "",
    "const FRASE = 'boa tarde, voces fazem pizza de forma?';",
    "const pensar = {",
    "  vazio: async () => ({}),",
    "  bolo: async () => ({ falouDeOutraEtapa: 'bolo' }),",
    "  outro: async () => ({ perguntou: { sobre: 'outro' } }),",
    "};",
    "",
    "const pizza = await responder(NO_BOLO as never, { texto: FRASE } as never, pensar.vazio as never);",
    "const pizzaBolo = await responder(NO_BOLO as never, { texto: FRASE } as never, pensar.bolo as never);",
    "const pizzaOutro = await responder(NO_BOLO as never, { texto: FRASE } as never, pensar.outro as never);",
    "const leites = await responder(NO_BOLO as never, { texto: '4 leites' } as never, pensar.vazio as never);",
    "",
    "const inteira = produtoPorNome('pizza inteira');",
    "const meia = produtoPorNome('pizza meia');",
    "",
    "console.log(JSON.stringify({",
    "  pizza: {",
    "    texto: pizza.fala.texto,",
    "    cardapio: pizza.fala.cardapio,",
    "    precisaHumano: pizza.precisaHumano,",
    "    assunto: pizza.estado.assunto,",
    "    etapa: pizza.etapa,",
    "    itens: pizza.estado.itens.map((i) => i.produto),",
    "  },",
    "  pizzaBolo: { texto: pizzaBolo.fala.texto, cardapio: pizzaBolo.fala.cardapio, precisaHumano: pizzaBolo.precisaHumano, assunto: pizzaBolo.estado.assunto },",
    "  pizzaOutro: { texto: pizzaOutro.fala.texto, cardapio: pizzaOutro.fala.cardapio, precisaHumano: pizzaOutro.precisaHumano, assunto: pizzaOutro.estado.assunto },",
    "  leites: {",
    "    produtos: leites.estado.itens.map((i) => i.produto + ':' + i.qtd),",
    "    texto: leites.fala.texto,",
    "    cardapio: leites.fala.cardapio,",
    "  },",
    "  precos: { inteira: inteira && brl(inteira.preco), meia: meia && brl(meia.preco) },",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pergunta-nao-gruda.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

const cobraPizza = (rotulo, x) => {
  if (x.precisaHumano) falhas.push(rotulo + ": chamou a equipe; pergunta de pizza nao para a IA");
  if (x.cardapio !== "pizza") falhas.push(rotulo + ": cardapio " + x.cardapio + " (queria pizza, nao bolo)");
  if (x.cardapio === "bolos-festa") falhas.push(rotulo + ": mandou bolos de festa pra quem perguntou pizza");
  if (/bolo|papel de arroz|topo/i.test(x.texto) && !/pizza/i.test(x.texto)) {
    falhas.push(rotulo + ": falou de bolo: " + x.texto);
  }
  if (x.assunto === "bolo") falhas.push(rotulo + ": assunto continua bolo");
  if (!/pizza/i.test(x.texto)) falhas.push(rotulo + ": nao falou de pizza: " + x.texto);
  if (!x.texto.includes(r.precos.inteira)) {
    falhas.push(rotulo + ": nao disse o preco da inteira do catalogo (" + r.precos.inteira + "): " + x.texto);
  }
  if (!x.texto.includes(r.precos.meia)) {
    falhas.push(rotulo + ": nao disse o preco da meia do catalogo (" + r.precos.meia + "): " + x.texto);
  }
};

cobraPizza("modelo vazio", r.pizza);
cobraPizza("modelo grudou no bolo", r.pizzaBolo);
cobraPizza("modelo mandou outro", r.pizzaOutro);

if ((r.pizza.itens || []).some((p) => /pizza/i.test(p))) {
  falhas.push("perguntar pizza de forma anotou pizza no pedido; perguntar nao e pedir");
}

const temBolo = (r.leites.produtos || []).some((p) => /4 leites|bolo/i.test(p));
if (!temBolo) {
  falhas.push("4 leites na etapa do bolo nao anotou bolo: " + JSON.stringify(r.leites.produtos));
}
if (r.leites.cardapio === "pizza") {
  falhas.push("4 leites mandou cardapio de pizza");
}

console.log("Pizza:     " + r.pizza.texto);
console.log("Cardapio:  " + r.pizza.cardapio + "  humano=" + r.pizza.precisaHumano + "  assunto=" + r.pizza.assunto);
console.log("4 leites:  " + r.leites.produtos.join(", "));
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: pergunta de pizza sai da etapa do bolo, e 4 leites continua bolo.");
