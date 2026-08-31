// SO ENTRA NO PEDIDO O QUE ESTA NO CARDAPIO.
//
// Regra do dono, dita mais de uma vez e por fim aos berros em 31/08/2026:
// "o que tem no cardapio nao mexe; nao tem como colocar um produto que nao
// existe o nome, pra isso que separei tudo bonitinho".
//
// Ele esta certo, e este teste existe porque eu vinha tratando isso caso a
// caso, guarda por guarda, em vez de tratar como o que e: uma coisa que NUNCA
// pode acontecer.
//
// O QUE FEZ VIRAR TRAVA, medido conversando com o servidor:
//
//   cliente >> frango                     (respondendo o recheio do risolis)
//   modelo  >> 1x mini sanduiche de pate de frango
//   guarda  >> "ele nao falou sanduiche, pate; fiquei com mini frango"
//   pedido  >> 1 ~ mini frango
//   motor   >> pizza inteira strogonoff de frango, R$ 120,00
//
// Quem inventou o nome nao foi o modelo: foi a MINHA guarda anti-invencao,
// montando um nome a partir de pedacos do outro. E nome que nao existe nunca
// fica sem preco, porque o motor casa por pedaco e escolhe o mais parecido, que
// pode ser o mais caro da casa.
//
// O NOME DE FAMILIA CONTINUA VALENDO. "pizza" e "bolo" sem sabor sao marcador
// de lugar: o cliente disse a familia e ainda vai escolher o tipo. Derrubar
// esses quebraria a conversa inteira, e por isso o terceiro caso esta aqui.
//
// A ISCA: tirando o bloco da trava em `fluxo.ts` (o que fala "TIREI DO
// PEDIDO"), o primeiro caso volta a deixar o nome inventado no pedido.
//
// Roda com: node testes/so-entra-no-pedido-o-que-esta-no-cardapio.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "nome que nao existe no cardapio nao fica no pedido",
    itens: [
      { produto: "mini frango", categoria: "salgado_frito", qtd: 1, unidade: "un", obs: "frango" },
      { produto: "coxinha", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: "frango" },
    ],
    fica: ["coxinha"],
    sai: ["mini frango"],
    dano: "o motor cotava a linha fantasma como pizza inteira de strogonoff, R$ 120,00",
  },
  {
    nome: "outro nome montado por pedaco tambem sai",
    itens: [
      { produto: "bolo frango", categoria: "bolo_festa", qtd: 2, unidade: "kg", obs: null },
      { produto: "brigadeiro", categoria: "docinho", qtd: 50, unidade: "un", obs: "forminha rosa" },
    ],
    fica: ["brigadeiro"],
    sai: ["bolo frango"],
    dano: "bolo que nao existe seria cotado pelo bolo mais parecido, por quilo",
  },
  {
    nome: "nome de FAMILIA continua no pedido, que e marcador de lugar",
    itens: [
      { produto: "pizza", categoria: "pizza", qtd: 1, unidade: "un", obs: null },
      { produto: "bolo", categoria: "bolo_festa", qtd: 2, unidade: "kg", obs: null },
      { produto: "coxinha", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: "frango" },
    ],
    fica: ["pizza", "bolo", "coxinha"],
    sai: [],
    dano: "derrubar o marcador de lugar quebra a conversa: e como o cliente diz a familia antes de escolher o tipo",
  },
  {
    nome: "produto do cardapio com nome comprido continua",
    itens: [
      { produto: "mini sanduíche de patê de frango", categoria: "salgado_assado", qtd: 50, unidade: "un", obs: null },
    ],
    fica: ["mini sanduíche de patê de frango"],
    sai: [],
    dano: "a trava nao pode derrubar venda de verdade",
  },
];

const sonda = path.join(__dirname, "_sonda-so-do-cardapio.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const pensar = () => (async () => ({ itens: [] }));",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:c.itens,",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "    retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: 'ok' }, pensar() as never);",
    "  saiu.push(r.estado.itens.map((i) => i.produto));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-so-do-cardapio.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let erros = 0;
console.log("== so entra no pedido o que esta no cardapio ==");
CASOS.forEach((c, n) => {
  const ficaram = saiu[n];
  const problemas = [];
  for (const p of c.fica) {
    if (!ficaram.some((x) => semAc(x) === semAc(p))) problemas.push("sumiu \"" + p + "\", que existe no cardapio");
  }
  for (const p of c.sai) {
    if (ficaram.some((x) => semAc(x) === semAc(p))) problemas.push("ficou \"" + p + "\", que nao existe no cardapio");
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
