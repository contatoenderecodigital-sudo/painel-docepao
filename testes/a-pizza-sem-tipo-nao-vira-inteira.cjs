// PIZZA SEM TIPO NAO VIRA A DE FORMA A R$ 120.
//
// POR QUE ISTO EXISTE
//
// Medido em 26/08/2026: "uma pizza" era apelido de pizza inteira. Quem escrevia
// pizza ou uma pizza levava R$ 120 sem escolher forma, meia ou redonda.
//
// A dona, 19/08/2026: se a pessoa nao falar em pizza de forma, a padaria tem
// que perguntar, e mandar o cardapio com as opcoes.
//
// OS DOIS LADOS
//
//   1. "uma pizza" e "2 pizzas" ficam familia, nao pizza inteira
//   2. "pizza redonda" continua sendo a redonda
//   3. a pergunta manda a peca de cardapio "pizza"
//
// Roda com: node testes/a-pizza-sem-tipo-nao-vira-inteira.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-pizza-tipo.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { identificarProduto } from '../lib/ia/fluxo/produto.ts';",
    "import { produtosNaFrase } from '../lib/ia/fluxo/leitor-da-frase.ts';",
    "import { falaDaEtapa } from '../lib/ia/fluxo/pergunta.ts';",
    "import { ROTEIRO_COMUM } from '../lib/ia/fluxo/etapas.ts';",
    "",
    "const ident = (t) => identificarProduto(t).produto;",
    "const dados = ROTEIRO_COMUM.find((e) => e.id === 'dados');",
    "const pedido = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false,",
    "  itens:[{ produto:'pizza', categoria:'pizza', qtd:1, obs:null }],",
    "  naoQuer:[], dados:{ nome:null, data:null, hora:null, pagamento:null },",
    "  pecas:null, insistiu:0, etapasJaPerguntadas:[],",
    "};",
    "const fala = falaDaEtapa(dados, pedido, 0, []);",
    "console.log(JSON.stringify({",
    "  uma: ident('uma pizza'),",
    "  duas: ident('2 pizzas'),",
    "  pizza: ident('pizza'),",
    "  redonda: ident('pizza redonda'),",
    "  metro: ident('pizza de metro'),",
    "  naFrase: produtosNaFrase('quero uma pizza'),",
    "  redondaNaFrase: produtosNaFrase('quero uma pizza redonda'),",
    "  texto: fala.texto,",
    "  cardapio: fala.cardapio,",
    "  opcoes: fala.opcoes,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pizza-tipo.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, ok, detalhe) => {
  if (ok) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo);
  if (detalhe) console.log("        " + detalhe);
};

cobra('"uma pizza" e familia', r.uma === "pizza", JSON.stringify(r.uma));
cobra('"2 pizzas" e familia', r.duas === "pizza", JSON.stringify(r.duas));
cobra('"pizza" e familia', r.pizza === "pizza", JSON.stringify(r.pizza));
cobra("pizza redonda continua redonda", r.redonda === "pizza redonda", JSON.stringify(r.redonda));
cobra("pizza de metro continua a de forma", r.metro === "pizza inteira", JSON.stringify(r.metro));
cobra("a frase 'quero uma pizza' acha familia", JSON.stringify(r.naFrase) === JSON.stringify(["pizza"]), JSON.stringify(r.naFrase));
cobra("a frase 'quero uma pizza redonda' acha so a redonda", JSON.stringify(r.redondaNaFrase) === JSON.stringify(["pizza redonda"]), JSON.stringify(r.redondaNaFrase));
cobra("a pergunta manda o cardapio de pizza", r.cardapio === "pizza", JSON.stringify(r.cardapio));
cobra("a pergunta lista as tres", Array.isArray(r.opcoes) && r.opcoes.includes("pizza inteira") && r.opcoes.includes("pizza meia") && r.opcoes.includes("pizza redonda"), JSON.stringify(r.opcoes));
cobra("a pergunta nao cota R$ 120", !/120/.test(String(r.texto || "")), String(r.texto || "").slice(0, 160));

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("ok    pizza sem tipo pergunta, e manda o cardapio");
console.log("");
console.log("PASSOU");
