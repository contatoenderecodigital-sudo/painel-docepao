// QUEM DELEGA SALGADO E DOCINHO NAO ENTREGA O SABOR DO BOLO PRA CASA.
//
// Medido conversando com a producao em 03/09/2026, festa pra 10 pessoas:
//
//   cliente >> pode ser assim sim, os tipos de salgado e docinho pode escolher voce, confio
//   rascunho >> 5 salgados x 20, 25 brigadeiro, 25 beijinho, 1 kg de bolo 4 LEITES
//
// Ninguem escolheu 4 leites. A delegacao montava o sortido das tres familias da
// base, inclusive a do bolo, e a padaria nunca perguntou o sabor. O modelo
// agora diz EM QUAIS familias ele delegou (`delegaEm`); sem dizer, vale tudo.
//
// Roda com: node testes/quem-delega-salgado-e-docinho-nao-entrega-o-bolo.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-delega-em.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const NA_BASE = {",
    "  ehFesta: true, pessoas: 10, base: { salgados: 100, docinhos: 50, boloKg: 1, totalCentavos: 20940 }, baseAceita: false,",
    "  itens: [], naoQuer: [], dados: { nome: null, data: null, hora: null, pagamento: null },",
    "  pecas: null, topoNome: null, topoIdade: null, tema: null, escrito: null, forminha: null, prato: null, ofereceu: false,",
    "  ultimaFala: 'Pra 10 pessoas, uma base boa é 100 salgados no total, 50 docinhos e 1 kg de bolo. Dá R$ 209,40.', insistiu: 0,",
    "  retomarEm: null, assunto: null, etapasJaPerguntadas: ['quantas_pessoas', 'base_da_festa'], etapasAdiadas: [],",
    "};",
    "const fala = 'pode ser assim sim, os tipos de salgado e docinho pode escolher voce, confio';",
    "const parcial = await responder(NA_BASE as never, { texto: fala }, (async () => ({ aceitouBase: true, delegaEscolha: true, delegaEm: ['salgado', 'docinho'] })) as never);",
    "const tudo = await responder(NA_BASE as never, { texto: 'escolhe voce tudo, confio' }, (async () => ({ aceitouBase: true, delegaEscolha: true })) as never);",
    "const bolos = (r) => r.estado.itens.filter((i) => String(i.categoria || '').startsWith('bolo')).map((i) => i.produto);",
    "const salgados = (r) => r.estado.itens.filter((i) => String(i.categoria || '').startsWith('salgado')).length;",
    "console.log(JSON.stringify({",
    "  parcial: { bolos: bolos(parcial), salgados: salgados(parcial), pergunta: parcial.fala.texto },",
    "  tudo: { bolos: bolos(tudo), salgados: salgados(tudo) },",
    "}));",
  ].join("\n"),
  "utf8",
);
let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-delega-em.mts"], { cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32" });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, ok, detalhe) => { console.log((ok ? "ok    " : "ERRO  ") + rotulo); if (!ok) { falhas.push(rotulo); if (detalhe) console.log("        " + detalhe); } };
console.log("== quem delega salgado e docinho nao entrega o bolo ==");
cobra("delegou salgado e docinho: os salgados sao montados pela casa", r.parcial.salgados > 1, JSON.stringify(r.parcial));
cobra("e o bolo NAO ganha sabor sozinho (a etapa do bolo continua aberta pra padaria perguntar)",
  r.parcial.bolos.every((b) => /^bolo$/i.test(b)), JSON.stringify(r.parcial.bolos));
cobra("delegou tudo: a casa escolhe o bolo tambem (como antes)", r.tudo.bolos.length === 1 && !/^bolo$/i.test(r.tudo.bolos[0]), JSON.stringify(r.tudo.bolos));
console.log("");
if (falhas.length) { console.log("REPROVOU EM " + falhas.length); process.exit(1); }
console.log("PASSOU");
