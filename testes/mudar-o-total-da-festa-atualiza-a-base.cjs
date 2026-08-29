// MUDAR O TOTAL DA FESTA E CONTA, NAO NEGOCIACAO.
//
// POR QUE ISTO EXISTE
//
// Regra 27 do cerebro velho: "vamos fazer 150 salgados entao" tem que atualizar
// a base. Recalcular pelas pessoas devolvia os 200 da proposta original e o
// cliente ouvia a mesma conta que ele acabara de trocar.
//
// O QUE ELE COBRA (OS DOIS LADOS)
//
//   1. familia com quantidade NOVA atualiza a base daquela perna;
//   2. o numero de pessoas NAO refaz a conta;
//   3. quem so escolhe sabor, sem numero novo, NAO zera nem troca o total.
//
// Roda com: node testes/mudar-o-total-da-festa-atualiza-a-base.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-total-da-festa.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[],",
    "};",
    "const festa = {",
    "  ...VAZIO, ehFesta:true, pessoas:20, baseAceita:true,",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "  etapasJaPerguntadas:['quantas_pessoas','base_da_festa'],",
    "};",
    "",
    "const mudou = await responder(festa as never,",
    "  { texto: 'vamos fazer 150 salgados entao' } as never,",
    "  (async () => ({ itens:[{produto:'salgado',qtd:150}] })) as never);",
    "",
    "const escolheu = await responder(festa as never,",
    "  { texto: 'quero coxinha e risoles' } as never,",
    "  (async () => ({ itens:[{produto:'coxinha',qtd:0},{produto:'risoles',qtd:0}] })) as never);",
    "",
    "console.log(JSON.stringify({",
    "  pessoas: mudou.estado.pessoas,",
    "  baseDepois: mudou.estado.base,",
    "  baseDepoisDeEscolher: escolheu.estado.base,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-total-da-festa.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

if (r.pessoas !== 20) falhas.push("o numero de pessoas mudou sozinho: " + r.pessoas);
if (!r.baseDepois || r.baseDepois.salgados !== 150) {
  falhas.push("150 salgados nao atualizou a base: " + JSON.stringify(r.baseDepois));
}
if (r.baseDepois && r.baseDepois.docinhos !== 100) {
  falhas.push("mudar salgado bagunçou os docinhos: " + r.baseDepois.docinhos);
}
if (r.baseDepois && r.baseDepois.boloKg !== 2) {
  falhas.push("mudar salgado bagunçou o bolo: " + r.baseDepois.boloKg);
}
if (!r.baseDepoisDeEscolher || r.baseDepoisDeEscolher.salgados !== 200) {
  falhas.push("escolher sabor sem numero novo mexeu no total: " + JSON.stringify(r.baseDepoisDeEscolher));
}

console.log("base depois de 150 salgados: " + JSON.stringify(r.baseDepois));
console.log("");

if (falhas.length) {
  console.log("ERRO  mudar o total da festa quebrou (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}
console.log("ok    o total novo da festa entra na base, e escolher sabor nao refaz a conta");
console.log("");
console.log("PASSOU");
