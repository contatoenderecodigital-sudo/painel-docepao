// TODO SINONIMO QUE A CASA CONHECE ENTRA NO PEDIDO.
//
// POR QUE ISTO EXISTE
//
// A casa mantem uma lista de sinonimos em `apelidos.ts` porque o cliente nao
// escreve o nome do cardapio: escreve "risoles" e nao "risólis", "esfiha" e nao
// "esfirra". O portao que decide o que cabe na etapa nao conhecia essa lista.
//
// Medido em 27/08/2026, numa festa de 30 pessoas:
//
//   cliente >> coxinha e risoles de carne, metade de cada
//   rastro  >> barrado nesta etapa: risoles de carne
//
// Os 300 salgados foram TODOS pra coxinha, e o risoles sumiu do pedido. Se o
// cliente nao repetir, a padaria produz metade do que ele pediu e ninguem
// descobre antes da retirada. Item que some e a coisa mais grave que este
// sistema faz, e e a regra que o dono repete: "NAO EH PRA NADA SUMIR DO PEDIDO".
//
// O proprio `apelidos.ts` ja avisava disso no cabecalho: "se as duas camadas
// usassem listas diferentes, uma aceitaria o que a outra recusa, e isso ja
// aconteceu neste projeto". Aconteceu de novo.
//
// ESTE TESTE PERCORRE A LISTA INTEIRA, e nao so o risoles: todo apelido de todo
// produto de salgado e de docinho tem que passar no portao da etapa dele, com e
// sem sabor colado no nome ("risoles de carne").
//
// Roda com: node testes/o-apelido-passa-no-portao-da-etapa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-apelido.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { APELIDOS } from "../lib/ia/dados/apelidos.ts";',
    'import { vocabularioDaEtapa, leituraQueCabeNaEtapa } from "../lib/ia/fluxo/leitura.ts";',
    "",
    "const semAc = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim();",
    "",
    "const barrados = [];",
    "const conferidos = [];",
    "for (const etapa of ['salgado', 'docinho']) {",
    "  // Os canonicos DESTA etapa, direto do catalogo (sem os apelidos, senao a",
    "  // conta ficaria circular).",
    "  const vocab = vocabularioDaEtapa(etapa);",
    "  for (const [canonico, lista] of Object.entries(APELIDOS)) {",
    "    if (!vocab.some((v) => semAc(v) === semAc(canonico))) continue;",
    "    for (const apelido of lista) {",
    "      // O nome sozinho, e o nome com sabor colado, que e como o cliente",
    "      // escreve de verdade.",
    "      for (const escrito of [apelido, apelido + ' de carne']) {",
    "        conferidos.push(escrito + ' [' + etapa + ']');",
    "        const r = leituraQueCabeNaEtapa(etapa, { itens: [{ produto: escrito, qtd: 10 }] });",
    "        if (!r.limpa.itens || !r.limpa.itens.length) {",
    "          barrados.push(escrito + ' [' + etapa + '] -> ' + canonico + ' nao passou');",
    "        }",
    "      }",
    "    }",
    "  }",
    "}",
    "",
    "// E O CONTRARIO: o portao nao pode virar peneira. O que a casa NAO vende",
    "// continua barrado. (Desde 03/09/2026 produto de outra familia passa: o",
    "// modelo ve o cardapio inteiro e quem separa e o aplicar, pelo catalogo.)",
    "const passouOQueNaoDevia = [];",
    "for (const [etapa, fora] of [['salgado', 'cadeira de praia'], ['docinho', 'xilofone']]) {",
    "  const r = leituraQueCabeNaEtapa(etapa, { itens: [{ produto: fora, qtd: 10 }] });",
    "  if (r.limpa.itens && r.limpa.itens.length) passouOQueNaoDevia.push(fora + ' passou na etapa ' + etapa);",
    "}",
    "",
    "console.log(JSON.stringify({ conferidos: conferidos.length, barrados, passouOQueNaoDevia }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-apelido.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

console.log("Jeitos de escrever conferidos: " + r.conferidos);
console.log("");

if (!r.conferidos) {
  // Detector que nao detecta nada passa verde e esconde a quebra da leitura.
  console.log("ERRO  nenhum apelido conferido: a lista mudou ou a leitura quebrou");
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

const cobra = (rotulo, lista) => {
  if (lista.length) {
    falhas.push(rotulo);
    console.log("ERRO  " + rotulo + " (" + lista.length + ")");
    for (const x of lista.slice(0, 12)) console.log("        " + x);
  } else {
    console.log("ok    " + rotulo);
  }
};

cobra("apelido barrado no portao da etapa", r.barrados);
cobra("o portao virou peneira e deixou passar o que nao e da etapa", r.passouOQueNaoDevia);

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
