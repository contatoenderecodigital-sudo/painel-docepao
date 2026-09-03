// O PESO QUE JA ESTAVA NAO SOME QUANDO O MODELO REPETE O ITEM.
//
// Medido na bateria dos cinco jeitos em 03/09/2026 (cenario "mudando de ideia",
// 1 execucao de 5): em "isso mesmo, pode confirmar" o modelo re-emitiu o pedido
// inteiro, inclusive "2x bolo 4 leites". A frase nao tem peso, a regra "sem
// peso dito, produto por quilo fica 0" zerou o bolo, e a padaria perguntou
// "Quantos quilos?" em vez de fechar. O pedido nao foi registrado.
//
// A regra do zero continua valendo pra item NOVO (nao chutar 1 kg). Item que
// ja estava com peso e foi repetido sem peso novo fica com o peso de antes:
// nada some do pedido.
//
// Roda com: node testes/o-peso-que-ja-estava-nao-some-na-confirmacao.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-peso-nao-some.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const COMPLETO = {",
    "  ehFesta: false, pessoas: null, base: null, baseAceita: false, naoQuer: [],",
    "  itens: [",
    "    { produto: 'coxinha', categoria: 'salgado_frito', qtd: 100, obs: 'frango' },",
    "    { produto: 'bolo 4 leites', categoria: 'bolo_festa', qtd: 2, obs: null },",
    "  ],",
    "  dados: { nome: 'Carla Menezes', data: '05/09/2026', hora: '15:00', pagamento: 'pix' },",
    "  pecas: { topo: false, papelDeArroz: false }, topoNome: null, topoIdade: null, tema: null, escrito: null,",
    "  forminha: null, prato: null, ofereceu: true,",
    "  ultimaFala: 'Fechando o pedido: ... *Total: R$ 193,80*', insistiu: 0, retomarEm: null, assunto: null,",
    "  etapasJaPerguntadas: ['abertura', 'bolo', 'pecas_do_bolo', 'dados', 'confirmacao'], etapasAdiadas: [],",
    "};",
    "// O modelo re-emitindo tudo, sem peso na frase, e confirmando.",
    "const repete = async () => ({ itens: [{ produto: 'coxinha', qtd: 100 }, { produto: 'bolo 4 leites', qtd: 2 }], confirmou: true });",
    "const r = await responder(COMPLETO as never, { texto: 'isso mesmo, pode confirmar' }, repete as never);",
    "const bolo = r.estado.itens.find((i) => /bolo 4 leites/.test(i.produto));",
    "// E a ISCA do outro lado: bolo NOVO sem peso na frase continua em 0.",
    "const NOVO = { ...COMPLETO, itens: [{ produto: 'coxinha', categoria: 'salgado_frito', qtd: 100, obs: 'frango' }], etapasJaPerguntadas: ['abertura'] };",
    "const novo = async () => ({ itens: [{ produto: 'bolo 4 leites', qtd: 1 }] });",
    "const r2 = await responder(NOVO as never, { texto: 'e um bolo de 4 leites tambem' }, novo as never);",
    "const bolo2 = r2.estado.itens.find((i) => /bolo 4 leites/.test(i.produto));",
    "console.log(JSON.stringify({ peso: bolo ? bolo.qtd : null, confirmou: r.confirmouEscrevendo, pesoNovo: bolo2 ? bolo2.qtd : null, pergunta: r2.fala.texto.slice(0, 80) }));",
  ].join("\n"),
  "utf8",
);
let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-peso-nao-some.mts"], { cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32" });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, ok, detalhe) => { console.log((ok ? "ok    " : "ERRO  ") + rotulo); if (!ok) { falhas.push(rotulo); if (detalhe) console.log("        " + detalhe); } };
console.log("== o peso que ja estava nao some na confirmacao ==");
cobra("o bolo de 2 kg repetido sem peso na frase continua com 2 kg", r.peso === 2, JSON.stringify(r));
cobra("e a confirmacao escrita vale", r.confirmou === true, JSON.stringify(r));
cobra("ISCA: bolo novo sem peso na frase continua em 0, e a padaria pergunta o peso", r.pesoNovo === 0 && /quilo/i.test(r.pergunta), JSON.stringify(r));
console.log("");
if (falhas.length) { console.log("REPROVOU EM " + falhas.length); process.exit(1); }
console.log("PASSOU");
