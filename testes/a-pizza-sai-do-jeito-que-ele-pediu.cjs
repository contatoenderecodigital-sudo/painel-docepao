// A PIZZA SAI DO JEITO QUE ELE PEDIU.
//
// A pizza e o item mais caro da casa (R$ 120,00 a inteira) e a unica familia com
// meia e inteira. Errar uma linha aqui e errar R$ 120,00.
//
// OS DOIS ERROS SAO OPOSTOS, e os dois foram medidos conversando com a producao
// em 02/09/2026:
//
//   cliente >> quero uma pizza inteira meio calabresa meio frango com catupiry
//   modelo  >> 1x pizza [calabresa] ;; 1x pizza [frango com catupiry]
//   pedido  >> 2 pizzas = R$ 240,00              (juntar de menos)
//
//   cliente >> quero duas pizzas, uma de calabresa e uma de frango
//   modelo  >> 1x pizza inteira [calabresa] ;; 1x pizza inteira [frango]
//   pedido  >> 1 pizza = R$ 120,00               (juntar demais)
//
// O modelo devolve DUAS nos dois casos, porque le ao pe da letra. Quem sabe a
// diferenca e a casa: "meio X meio Y" e uma pizza com dois sabores, "duas
// pizzas" sao duas.
//
// A guarda que cortava a segunda pizza nao foi somada agora: ela ja existia, pra
// impedir o modelo de inventar pizza em cima de um sabor (defeito que custou
// R$ 240 num pedido de festa). O que mudou e que ela deixa passar quando o
// cliente escreveu o NUMERO.
//
// Roda com: node testes/a-pizza-sai-do-jeito-que-ele-pediu.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const DUAS = [
  { produto: "pizza inteira", qtd: 1, sabor: "calabresa" },
  { produto: "pizza inteira", qtd: 1, sabor: "frango" },
];

const CASOS = [
  {
    nome: "meia a meia e UMA pizza com os dois sabores",
    fala: "quero uma pizza inteira meio calabresa meio frango",
    leitura: { itens: DUAS },
    linhas: 1,
    obsTem: ["calabresa", "frango"],
    dano: "R$ 120,00 a mais num pedido de R$ 120,00",
  },
  {
    nome: "duas pizzas sao DUAS pizzas",
    fala: "quero duas pizzas, uma de calabresa e uma de frango",
    leitura: { itens: DUAS },
    linhas: 2,
    dano: "R$ 120,00 a menos, e ele chega pra buscar duas e leva uma",
  },
  {
    nome: "2 escrito em numero tambem",
    fala: "quero 2 pizzas inteiras, calabresa e frango",
    leitura: { itens: DUAS },
    linhas: 2,
    dano: "a mesma perda, com o cliente escrevendo o numero",
  },
  {
    nome: "uma pizza de um sabor continua uma",
    fala: "quero uma pizza de calabresa",
    leitura: { itens: [{ produto: "pizza inteira", qtd: 1, sabor: "calabresa" }] },
    linhas: 1,
    dano: "o pedido mais comum de pizza nao pode virar dois",
  },
];

const sonda = path.join(__dirname, "_sonda-pizza.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:[],",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "    retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, (async () => c.leitura) as never);",
    "  const pizzas = r.estado.itens.filter((i) => String(i.categoria || '') === 'pizza');",
    "  saiu.push(pizzas.map((i) => ({ p: i.produto, q: Number(i.qtd), o: String(i.obs ?? '') })));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pizza.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let erros = 0;
console.log("== a pizza sai do jeito que ele pediu ==");
CASOS.forEach((c, n) => {
  const pizzas = saiu[n];
  const problemas = [];
  if (pizzas.length !== c.linhas) {
    problemas.push(
      "ficou com " + pizzas.length + " pizza(s), esperado " + c.linhas + ": " +
      JSON.stringify(pizzas.map((i) => i.q + "x " + i.p + " ~ " + i.o)),
    );
  }
  for (const parte of c.obsTem ?? []) {
    if (!pizzas.some((i) => semAc(i.o).includes(semAc(parte)))) {
      problemas.push('a comanda nao diz "' + parte + '": ' + JSON.stringify(pizzas.map((i) => i.o)));
    }
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
