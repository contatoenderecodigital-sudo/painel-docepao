// A IA ANOTA O QUE ELE PEDIU, MESMO QUANDO O MODELO SO CONFIRMA.
//
// POR QUE ISTO EXISTE
//
// Dor de entrega: o modelo responde como se fosse pergunta ("voce quer
// coxinha, certo?") e NAO devolve o item. O codigo recebia {} ou perguntou
// e a linha nunca chegava em estado.itens. Quem escreveu o produto com
// quantidade via o pedido vazio.
//
// OS DOIS LADOS
//
//   1. "quero 50 coxinha" com modelo vazio, com confirmou, ou com perguntou
//      entra coxinha 50 no pedido
//   2. "quanto e a coxinha?" nao inventa linha
//
// Roda com: node testes/a-frase-anota-mesmo-quando-o-modelo-hedgeia.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-hedge.mts");
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
    "",
    "const vazio = async () => ({});",
    "const confirmou = async () => ({ confirmou: true });",
    "const perguntouPreco = async () => ({ perguntou: { sobre: 'preco', familia: 'salgado' } });",
    "",
    "const a = await responder({ ...VAZIO }, { texto: 'quero 50 coxinha' }, vazio);",
    "const b = await responder({ ...VAZIO }, { texto: 'quero 50 coxinha' }, confirmou);",
    "const c = await responder({ ...VAZIO }, { texto: 'quero 50 coxinha' }, perguntouPreco);",
    "const d = await responder({ ...VAZIO }, { texto: 'quanto e a coxinha?' }, vazio);",
    "const e = await responder({ ...VAZIO }, { texto: 'quanto e a coxinha?' }, perguntouPreco);",
    "",
    "const linha = (r) => (r.estado.itens || []).map((i) => i.produto + ':' + i.qtd);",
    "",
    "console.log(JSON.stringify({",
    "  vazio: linha(a),",
    "  confirmou: linha(b),",
    "  perguntou: linha(c),",
    "  perguntaVazio: linha(d),",
    "  perguntaModelo: linha(e),",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-hedge.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, ok, detalhe) => {
  if (ok) {
    console.log("ok    " + rotulo);
    return;
  }
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo);
  if (detalhe) console.log("        " + detalhe);
};

const temCoxinha50 = (linhas) => (linhas || []).some((x) => /^coxinha:50$/i.test(x));

cobra("modelo vazio anota 50 coxinha", temCoxinha50(r.vazio), JSON.stringify(r.vazio));
cobra("modelo so confirmou e mesmo assim anota 50 coxinha", temCoxinha50(r.confirmou), JSON.stringify(r.confirmou));
cobra("modelo perguntou preco e mesmo assim anota 50 coxinha", temCoxinha50(r.perguntou), JSON.stringify(r.perguntou));
cobra("quanto e a coxinha, modelo vazio, NAO inventa linha", (r.perguntaVazio || []).length === 0, JSON.stringify(r.perguntaVazio));
cobra("quanto e a coxinha, modelo perguntou, NAO inventa linha", (r.perguntaModelo || []).length === 0, JSON.stringify(r.perguntaModelo));

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
