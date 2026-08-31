// A FAMILIA QUE ELE DISSE QUE QUER ENTRA NO PEDIDO NA HORA.
//
// Medido conversando com a producao em 31/08/2026:
//
//   cliente >> queria encomendar um bolo de aniversario
//   cliente >> nao eh festa nao, so o bolo mesmo
//   padaria >> O que você vai querer?
//   cliente >> brigadeiro
//   comanda >> 1 brigadeiro          (o DOCINHO, R$ 1,25; o bolo nunca existiu)
//
// A conversa SABIA que o assunto era bolo, esta escrito no rastro dela. So que
// nada do bolo ia pro pedido: pra "queria encomendar um bolo" o modelo nao
// devolve item nenhum, porque nao ha produto na frase, so a familia.
//
// Sem item, tres coisas quebram de uma vez:
//
//   - a abertura nunca fica cumprida (ela mede o pedido, e o pedido esta vazio),
//     entao a padaria volta a perguntar "O que você vai querer?" pra sempre;
//   - a etapa do bolo nao tem o que perguntar, entao o sabor nunca e pedido;
//   - "brigadeiro" cai no docinho, que e um produto de verdade com esse nome
//     exato, e o bolo de R$ 46,90 o quilo vira um docinho de R$ 1,25.
//
// Familia em aberto ja e coisa deste sistema: e assim que "quero 50 de morango"
// guarda o 50 enquanto a padaria pergunta qual bolo.
//
// A ISCA: tirando o bloco que anota a familia em `fluxo.ts`, o primeiro caso
// volta a fechar sem bolo nenhum.
//
// Roda com: node testes/a-familia-que-ele-pediu-entra-no-pedido.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "quem pede um bolo fica com um bolo no pedido, e ouve a pergunta do sabor",
    turnos: [["um bolo de aniversario", { itens: [], falouDeOutraEtapa: "bolo" }]],
    produtos: ["bolo"],
    perguntaTem: "sabor",
    dano: "a padaria perguntava \"o que você vai querer?\" pra sempre",
  },
  {
    nome: "e o sabor cai no BOLO, e nao no docinho de mesmo nome",
    turnos: [
      ["um bolo de aniversario", { itens: [], falouDeOutraEtapa: "bolo" }],
      ["brigadeiro", { itens: [{ produto: "brigadeiro", qtd: 1 }] }],
    ],
    produtos: ["bolo brigadeiro"],
    dano: "bolo de R$ 46,90 o quilo virava docinho de R$ 1,25",
  },
  {
    nome: "quem ja tem bolo no pedido nao ganha um segundo",
    turnos: [
      ["um bolo de aniversario", { itens: [], falouDeOutraEtapa: "bolo" }],
      ["queria ver o bolo mesmo", { itens: [], falouDeOutraEtapa: "bolo" }],
    ],
    umItemSo: true,
    dano: "dois bolos numa comanda que o cliente pediu um",
  },
  {
    nome: "salgado tambem, que e a mesma regra",
    turnos: [["queria uns salgados pra amanha", { itens: [], falouDeOutraEtapa: "salgado" }]],
    produtos: ["salgado"],
    dano: "regra vale pra familia, e nao so pro bolo",
  },
];

const sonda = path.join(__dirname, "_sonda-familia-pedida.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  let estado = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:[],",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "    retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  let r;",
    "  for (const [fala, leitura] of c.turnos) {",
    "    r = await responder(estado as never, { texto: fala }, (async () => leitura) as never);",
    "    estado = r.estado as never;",
    "  }",
    "  saiu.push({ produtos: estado.itens.map((i) => i.produto), pergunta: String(r.fala.texto || '') });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-familia-pedida.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a familia que ele pediu entra no pedido ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  if (c.produtos && JSON.stringify(r.produtos) !== JSON.stringify(c.produtos)) {
    problemas.push("o pedido ficou " + JSON.stringify(r.produtos) + ", esperado " + JSON.stringify(c.produtos));
  }
  if (c.umItemSo && r.produtos.length !== 1) {
    problemas.push("ficou com " + r.produtos.length + " linhas: " + JSON.stringify(r.produtos));
  }
  if (c.perguntaTem && !new RegExp(c.perguntaTem, "i").test(r.pergunta)) {
    problemas.push("a padaria perguntou " + JSON.stringify(r.pergunta.slice(0, 50)));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
