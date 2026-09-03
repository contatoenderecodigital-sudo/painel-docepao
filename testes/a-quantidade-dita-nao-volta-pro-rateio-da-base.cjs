// A QUANTIDADE QUE O CLIENTE DISSE NAO VOLTA PRO RATEIO DA BASE.
//
// Matriz de entrega, conversa 4, 03/09/2026 (festa de 20, base com 100
// docinhos): o cliente recusou docinho, depois voltou atras com "coloca 50
// brigadeiro sim", e no turno do bolo escreveu "brigadeiro com maracuja". O
// rateio da base casava a palavra "brigadeiro" da frase com o DOCINHO
// brigadeiro e mandava os 100 da base por cima dos 50 ditos. O pedido fechou
// com 100 brigadeiros.
//
// Item com quantidade ja dita nao volta pro rateio: a base e sugestao, e o
// que ele disse com numero e decisao. Mudar e com numero novo, pelo modelo.
//
// Roda com: node testes/a-quantidade-dita-nao-volta-pro-rateio-da-base.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-rateio-dito.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const ESTADO = {",
    "  ehFesta: true, pessoas: 20, base: { salgados: 300, docinhos: 100, boloKg: 2, totalCentavos: 39380 }, baseAceita: true,",
    "  itens: [",
    "    { produto: 'coxinha', categoria: 'salgado_frito', qtd: 150, obs: 'frango' },",
    "    { produto: 'brigadeiro', categoria: 'docinho', qtd: 50, obs: 'forminha rosa' },",
    "    { produto: 'bolo', categoria: 'bolo_festa', qtd: 2, obs: null },",
    "  ],",
    "  naoQuer: [], dados: { nome: null, data: null, hora: null, pagamento: null }, pecas: null, forminha: 'rosa',",
    "  ultimaFala: 'E o bolo, qual sabor?', insistiu: 0, retomarEm: null, assunto: null,",
    "  etapasJaPerguntadas: ['base_da_festa', 'salgado', 'bolo', 'bolo:sabor'], etapasAdiadas: [],",
    "};",
    "const pensar = (l) => (async () => l);",
    "// O bolo de brigadeiro com maracuja: a palavra 'brigadeiro' esta na frase, mas o docinho nao foi falado.",
    "const r = await responder(ESTADO as never, { texto: 'brigadeiro com maracuja' },",
    "  pensar({ itens: [{ produto: 'bolo brigadeiro com maracujá', qtd: 2 }] }) as never);",
    "const doc = r.estado.itens.find((i) => i.produto === 'brigadeiro');",
    "// E falar do brigadeiro de novo, sem numero, tambem nao mexe nos 50: a base e sugestao.",
    "const r2 = await responder(ESTADO as never, { texto: 'e brigadeiro tambem' },",
    "  pensar({ itens: [{ produto: 'brigadeiro', qtd: 0 }] }) as never);",
    "const doc2 = r2.estado.itens.find((i) => i.produto === 'brigadeiro');",
    "console.log(JSON.stringify({ qtd: doc ? doc.qtd : null, qtd2: doc2 ? doc2.qtd : null }));",
  ].join("\n"),
  "utf8",
);
let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-rateio-dito.mts"], { cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32" });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, ok, detalhe) => { console.log((ok ? "ok    " : "ERRO  ") + rotulo); if (!ok) { falhas.push(rotulo); if (detalhe) console.log("        " + detalhe); } };
console.log("== a quantidade dita nao volta pro rateio da base ==");
cobra("'brigadeiro com maracuja' (o bolo) nao mexe nos 50 brigadeiros ditos", r.qtd === 50, JSON.stringify(r));
cobra("falar do brigadeiro de novo sem numero tambem nao mexe nos 50 ditos", r.qtd2 === 50, JSON.stringify(r));
console.log("");
if (falhas.length) { console.log("REPROVOU EM " + falhas.length); process.exit(1); }
console.log("PASSOU");
