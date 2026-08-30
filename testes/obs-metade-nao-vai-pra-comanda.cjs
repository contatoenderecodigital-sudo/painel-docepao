// A CONTA DO PEDIDO NAO VIRA LIXO NA COMANDA.
//
// POR QUE ISTO EXISTE
//
// O cliente diz "coxinha e risoles, metade de cada". A quantidade ja foi
// partida nas duas linhas. O modelo ainda devolve `obs: metade`, e isso ia
// impresso na comanda como se a cozinha tivesse que produzir metade de alguma
// coisa.
//
// O TESTE COBRA OS DOIS LADOS:
//
//   1. `metade` / `metade de cada` / `meio a meio` saem da observacao
//   2. recado de verdade (forminha, sem cebola) continua
//
// Roda com: node testes/obs-metade-nao-vai-pra-comanda.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-obs-metade.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { obsPraComanda } from "../lib/ia/fluxo/restricao.ts";',
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[],",
    "};",
    "",
    "const direto = [",
    "  ['metade', null],",
    "  ['metade de cada', null],",
    "  ['meio a meio', null],",
    "  ['metade | forminha rosa', 'forminha rosa'],",
    "  ['forminha rosa', 'forminha rosa'],",
    "  ['sem cebola', 'sem cebola'],",
    "  ['carne', 'carne'],",
    "];",
    "",
    "const festa = {",
    "  ...VAZIO, ehFesta:true, pessoas:20, baseAceita:true,",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "  etapasJaPerguntadas:['quantas_pessoas','base_da_festa'],",
    "};",
    "",
    "const lixo = await responder(festa,",
    "  { texto: 'coxinha e risoles, metade de cada' },",
    "  async () => ({ itens: [",
    "    { produto: 'coxinha', qtd: 100, obs: 'metade' },",
    "    { produto: 'risoles', qtd: 100, obs: 'metade de cada' },",
    "  ] }));",
    "",
    "const recado = await responder(festa,",
    "  { texto: '100 coxinha sem cebola' },",
    "  async () => ({ itens: [{ produto: 'coxinha', qtd: 100, sabor: 'frango', obs: 'sem cebola' }] }));",
    "",
    "console.log(JSON.stringify({",
    "  direto: direto.map(([obs, esperado]) => ({ obs, esperado, veio: obsPraComanda(obs) })),",
    "  lixo: lixo.estado.itens.map((i) => ({ produto: i.produto, obs: i.obs, qtd: i.qtd })),",
    "  recado: recado.estado.itens.map((i) => ({ produto: i.produto, obs: i.obs })),",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-obs-metade.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

for (const c of r.direto) {
  if (c.veio !== c.esperado) {
    falhas.push("obsPraComanda(" + JSON.stringify(c.obs) + ") veio " + JSON.stringify(c.veio));
  }
}

if (!r.lixo.length) falhas.push("o pedido com metade de cada nao anotou item nenhum");
for (const i of r.lixo) {
  if (i.obs) falhas.push(i.produto + " ficou com obs de conta: " + JSON.stringify(i.obs));
  if (!(i.qtd > 0)) falhas.push(i.produto + " perdeu a quantidade");
}

const coxinha = (r.recado || []).find((i) => String(i.produto).includes("coxinha"));
if (!coxinha) falhas.push("coxinha com recado nao entrou");
else if (!/sem cebola/i.test(String(coxinha.obs || ""))) {
  falhas.push("o recado da cozinha sumiu: " + JSON.stringify(coxinha.obs));
}

console.log(falhas.length ? "ERRO  " + falhas.join("\n        ") : "ok    metade sai, recado fica");
console.log("");
console.log(falhas.length ? "REPROVOU" : "PASSOU");
if (falhas.length) process.exit(1);
