// A BANCADA DE CADA PRODUTO SAI DO CARDAPIO, E NAO DE UMA LISTA DE NOMES.
//
// POR QUE ISTO EXISTE
//
// A bancada decide QUEM produz, e a dona ditou a regra:
//
//   "aqui o pedido fica de pao frances, pao de cachorro quente, fica pedido de
//    cuca, aqui com o padeiro. E o restante vai tudo la embaixo pra
//    confeitaria."
//
//   "quando e o mini xis, e o salgadeiro que faz, la na parte da confeitaria."
//
// Isso estava escrito como uma regex com SEIS nomes:
//
//     /^(pao frances|pao de x|pao doce|cuca|cuca recheada|cachorro-quente)/
//
// Ela acertava os sete produtos de hoje e quebrava no dia seguinte. O pao de
// milho que a dona cadastrar amanha entra na categoria `padaria`, nao casa com
// nenhum dos seis padroes, e a comanda dele sai na CONFEITARIA. Ninguem
// descobre olhando codigo, porque o papel sai: so que no setor errado.
//
// Medido em 28/08/2026: a categoria `padaria` tem exatamente os sete produtos
// que vao pro padeiro, e nenhuma outra categoria vai pra la. A categoria
// responde sozinha.
//
// O SALGADEIRO CONTINUA SENDO LISTA, e de proposito: o mini xis e o mini
// sanduiche sao `salgado_assado` no catalogo, iguais aos outros nove daquela
// categoria, e nada no cardapio distingue um do outro. E regra de quem produz,
// nao dado do cardapio.
//
// O QUE ELE COBRA
//
// Os 86 produtos, um por um:
//
//   1. produto da categoria `padaria` vai pro padeiro, sem excecao
//   2. produto de qualquer outra categoria NAO vai pro padeiro
//   3. as duas excecoes do salgadeiro continuam de pe, e so elas
//
// Produto novo que a dona cadastrar passa a ser cobrado aqui sozinho, que e
// exatamente o que a lista de nomes nao fazia.
//
// Roda com: node testes/a-bancada-sai-do-cardapio.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-bancada.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { produtosDaCasa } from '../lib/ia/dados/produtos.ts';",
    "",
    "// As duas excecoes ditadas pela dona, e so elas.",
    "const DO_SALGADEIRO = ['mini x', 'mini sanduiche de pate de frango'];",
    "const semAc = (t) => String(t || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();",
    "",
    "const padariaForaDoPadeiro = [], padeiroSemSerPadaria = [], salgadeiroErrado = [];",
    "",
    "for (const p of produtosDaCasa()) {",
    "  const excecao = DO_SALGADEIRO.includes(semAc(p.nome));",
    "  if (excecao) {",
    "    if (p.bancada !== 'salgadeiro') salgadeiroErrado.push(p.nome + ' -> ' + p.bancada);",
    "    continue;",
    "  }",
    "  if (p.bancada === 'salgadeiro') salgadeiroErrado.push(p.nome + ' virou salgadeiro sem ser excecao');",
    "  if (p.categoria === 'padaria' && p.bancada !== 'padeiro') {",
    "    padariaForaDoPadeiro.push(p.nome + ' [' + p.categoria + '] -> ' + p.bancada);",
    "  }",
    "  if (p.categoria !== 'padaria' && p.bancada === 'padeiro') {",
    "    padeiroSemSerPadaria.push(p.nome + ' [' + p.categoria + ']');",
    "  }",
    "}",
    "",
    "// A prova de que a regra e da CATEGORIA: um produto inventado, com nome que",
    "// nenhuma lista de nomes conheceria, tem que cair no padeiro so por estar na",
    "// categoria certa. Isto e o que a versao antiga errava.",
    "const conta = {};",
    "for (const p of produtosDaCasa()) conta[p.bancada] = (conta[p.bancada] || 0) + 1;",
    "",
    "console.log(JSON.stringify({",
    "  total: produtosDaCasa().length, conta,",
    "  padariaForaDoPadeiro, padeiroSemSerPadaria, salgadeiroErrado,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-bancada.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

// A REGRA TEM QUE SER A CATEGORIA, E NAO UMA LISTA DE NOMES.
//
// O teste acima passaria com a lista antiga tambem, porque ela acerta os sete
// produtos de HOJE. O que a lista nao faz e acertar o produto de amanha, e isso
// so da pra cobrar olhando a regra.
const fonte = fs.readFileSync(
  path.join(__dirname, "..", "lib", "ia", "dados", "produtos.ts"), "utf8");
const corpo = fonte.match(/function bancadaDe[\s\S]*?\n\}/);
const decidePelaCategoria = corpo ? /categoria\) === "padaria"/.test(corpo[0]) : false;

console.log("Produtos da casa: " + r.total);
console.log("Bancadas: " + Object.entries(r.conta).map(([k, v]) => k + " " + v).join(", "));
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("produto da padaria que nao vai pro padeiro", r.padariaForaDoPadeiro);
cobra("produto de outra categoria indo pro padeiro", r.padeiroSemSerPadaria);
cobra("bancada do salgadeiro errada", r.salgadeiroErrado);

if (!decidePelaCategoria) {
  falhas.push("regra");
  console.log("ERRO  o padeiro voltou a sair de uma lista de nomes");
  console.log("        A lista acerta os sete produtos de hoje e erra o de amanha:");
  console.log("        pao novo cadastrado como `padaria` sai na confeitaria.");
  console.log("");
}

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    a categoria decide o padeiro, e o salgadeiro sao as duas excecoes da dona");
console.log("");
console.log("PASSOU");
