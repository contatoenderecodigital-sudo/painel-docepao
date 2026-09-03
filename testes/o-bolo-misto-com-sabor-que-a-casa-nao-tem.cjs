// O BOLO MISTO COM UM SABOR QUE A CASA NAO TEM VIRA "MISTO A CONFIRMAR", E NAO SOME.
//
// Medido em 03/09/2026: "misto de brigadeiro com ninho". Ninho nao e sabor de
// bolo de festa da casa. O modelo (com a regra do cardapio) devolve dois itens:
// "bolo brigadeiro" e "bolo" com sabor "ninho". Antes disto, a familia "bolo"
// solta virava ajuste da base (1 kg), a fusao do misto escrevia "brigadeiro e
// brigadeiro", e ninguem chamava a equipe.
//
// O QUE ELE COBRA, pelo catalogo:
//   1. "bolo" + sabor que EXISTE como bolo (laka) vira o produto de verdade;
//   2. "bolo" + sabor que nao existe, com outro bolo na leitura, vira "misto
//      com ninho (sabor a confirmar)" nesse bolo, e a equipe e chamada;
//   3. "bolo" + sabor que nao existe, sozinho, fica como familia: a etapa do
//      bolo pergunta de novo (caminho da insistencia, que ja existia).
//
// Roda com: node testes/o-bolo-misto-com-sabor-que-a-casa-nao-tem.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-misto-fora-da-lista.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const NA_FESTA = {",
    "  ehFesta: true, pessoas: 20, base: { salgados: 200, docinhos: 100, boloKg: 2, totalCentavos: 41880 }, baseAceita: true,",
    "  itens: [{ produto: 'brigadeiro', categoria: 'docinho', qtd: 100, obs: null }], naoQuer: [],",
    "  dados: { nome: null, data: null, hora: null, pagamento: null }, pecas: null, forminha: 'rosa',",
    "  ultimaFala: 'E o bolo, qual sabor?', insistiu: 0, retomarEm: null, assunto: null,",
    "  etapasJaPerguntadas: ['base_da_festa', 'docinho', 'bolo', 'bolo:sabor'], etapasAdiadas: [],",
    "};",
    "const pensar = (l) => (async () => l);",
    "const misto = await responder(NA_FESTA as never, { texto: 'misto de brigadeiro com ninho' },",
    "  pensar({ itens: [{ produto: 'bolo brigadeiro', qtd: 1, sabor: null }, { produto: 'bolo', qtd: 1, sabor: 'ninho' }] }) as never);",
    "const laka = await responder(NA_FESTA as never, { texto: 'de laka' },",
    "  pensar({ itens: [{ produto: 'bolo', qtd: 2, sabor: 'laka' }] }) as never);",
    "const pistache = await responder(NA_FESTA as never, { texto: 'de pistache' },",
    "  pensar({ itens: [{ produto: 'bolo', qtd: 2, sabor: 'pistache' }] }) as never);",
    "const bolos = (r) => r.estado.itens.filter((i) => /^bolo/i.test(i.produto)).map((i) => i.produto + ' x' + i.qtd + ' [' + (i.obs || '') + ']');",
    "console.log(JSON.stringify({",
    "  misto: { bolos: bolos(misto), humano: misto.precisaHumano === true, motivo: misto.motivoHumano || '', fala: misto.fala.texto.slice(0, 120) },",
    "  laka: { bolos: bolos(laka), humano: laka.precisaHumano === true },",
    "  pistache: { bolos: bolos(pistache) },",
    "}));",
  ].join("\n"),
  "utf8",
);
let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-misto-fora-da-lista.mts"], { cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32" });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, ok, detalhe) => { console.log((ok ? "ok    " : "ERRO  ") + rotulo); if (!ok) { falhas.push(rotulo); if (detalhe) console.log("        " + detalhe); } };
console.log("== o bolo misto com sabor que a casa nao tem ==");
cobra("misto: UMA linha de bolo brigadeiro, com o ninho como misto a confirmar",
  r.misto.bolos.length === 1 && /^bolo brigadeiro/.test(r.misto.bolos[0]) && /misto com ninho/.test(r.misto.bolos[0]) && /sabor a confirmar/.test(r.misto.bolos[0]),
  JSON.stringify(r.misto.bolos));
cobra("misto: nao escreve 'brigadeiro e brigadeiro'", !/brigadeiro e brigadeiro/.test(r.misto.bolos.join(" ")), JSON.stringify(r.misto.bolos));
cobra("misto: a equipe e chamada com o motivo, e o cliente ouve que a casa confirma",
  r.misto.humano && /ninho/.test(r.misto.motivo) && /equipe confirma/i.test(r.misto.fala), JSON.stringify(r.misto));
cobra("sabor que existe como bolo vira o produto de verdade (bolo laka), sem chamar ninguem",
  r.laka.bolos.length === 1 && /^bolo laka x2/.test(r.laka.bolos[0]) && !r.laka.humano, JSON.stringify(r.laka));
cobra("sabor que nao existe, sozinho, fica como familia com o sabor (a etapa pergunta de novo)",
  r.pistache.bolos.length === 1 && /^bolo x2 \[pistache/.test(r.pistache.bolos[0]), JSON.stringify(r.pistache));
console.log("");
if (falhas.length) { console.log("REPROVOU EM " + falhas.length); process.exit(1); }
console.log("PASSOU");
