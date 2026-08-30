// O NOME CURTO DESEMPATA PELA ETAPA. TODO PAR DO CATALOGO.
//
// POR QUE ISTO EXISTE
//
// "brigadeiro" e docinho de R$ 1,25 e bolo de R$ 46,90 o quilo. Consertar so
// o brigadeiro e trocar uma palavra. No dia em que a dona cadastrar
// "maracuja" no docinho e "bolo maracuja", o defeito volta e ninguem lembra
// deste arquivo.
//
// Entao a cobranca e sobre a CLASSE: dois produtos com o mesmo nomeCurto e
// categorias diferentes. O teste ANDA a lista. Par novo nasce coberto.
//
// O resolvedor nao recebe a lista desses nomes. Ele usa a familia da etapa
// (a categoria) e as palavras de familia na frase, que saem da categoria e
// do grupo do catalogo.
//
// Roda com: node testes/o-nome-curto-desempata-pela-etapa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-colisao-nome.mjs");
fs.writeFileSync(
  sonda,
  [
    "import {",
    "  produtosDaCasa, pedeEscolhaDeSabor, palavrasDaFamilia,",
    "} from '../lib/ia/dados/produtos.ts';",
    "import { identificarProduto } from '../lib/ia/fluxo/produto.ts';",
    "",
    "const semAc = (t) => String(t || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();",
    "",
    "const por = new Map();",
    "for (const p of produtosDaCasa()) {",
    "  const k = semAc(p.nomeCurto);",
    "  if (!k) continue;",
    "  const arr = por.get(k) ?? [];",
    "  arr.push(p);",
    "  por.set(k, arr);",
    "}",
    "const pares = [];",
    "for (const [nomeCurto, produtos] of por) {",
    "  const cats = new Set(produtos.map((p) => p.categoria));",
    "  if (cats.size > 1) pares.push({ nomeCurto, produtos });",
    "}",
    "",
    "const falhouEtapa = [];",
    "const falhouFrase = [];",
    "for (const par of pares) {",
    "  for (const p of par.produtos) {",
    "    const pelaEtapa = identificarProduto(par.nomeCurto, p.categoria);",
    "    if (pelaEtapa.produto !== p.nome) {",
    "      falhouEtapa.push(par.nomeCurto + ' na categoria ' + p.categoria + ' -> ' + pelaEtapa.produto + ', esperado ' + p.nome);",
    "    }",
    "    const unicas = palavrasDaFamilia(p).filter((w) =>",
    "      par.produtos.every((outro) => outro === p || !palavrasDaFamilia(outro).includes(w)));",
    "    for (const w of unicas) {",
    "      const pelaFrase = identificarProduto(w + ' ' + par.nomeCurto);",
    "      if (pelaFrase.produto !== p.nome) {",
    "        falhouFrase.push(w + ' ' + par.nomeCurto + ' -> ' + pelaFrase.produto + ', esperado ' + p.nome);",
    "      }",
    "    }",
    "  }",
    "}",
    "",
    "const pedemSabor = produtosDaCasa().filter((p) => pedeEscolhaDeSabor(p)).map((p) => p.nome);",
    "console.log(JSON.stringify({",
    "  pares: pares.map((x) => ({ nomeCurto: x.nomeCurto, nomes: x.produtos.map((p) => p.nome + ' [' + p.categoria + ']') })),",
    "  qtdPares: pares.length,",
    "  falhouEtapa, falhouFrase, pedemSabor,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-colisao-nome.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

console.log("Pares de nome curto em categorias diferentes: " + r.qtdPares);
for (const p of r.pares) {
  console.log("  " + p.nomeCurto + " -> " + p.nomes.join(" | "));
}
console.log("");

const cobra = (rotulo, lista) => {
  if (lista.length) {
    falhas.push(rotulo);
    console.log("ERRO  " + rotulo + " (" + lista.length + ")");
    for (const x of lista) console.log("        " + x);
  } else {
    console.log("ok    " + rotulo);
  }
};

cobra("etapa da categoria nao desempata o nome curto", r.falhouEtapa);
cobra("palavra de familia na frase nao desempata o nome curto", r.falhouFrase);

const quemTem = fs.readFileSync(path.join(__dirname, "quem-tem-sabor-tem-que-escolher.cjs"), "utf8");
const percorreCatalogo = quemTem.includes("produtosDaCasa().filter((p) => pedeEscolhaDeSabor(p))");
const cortaLista = /\bcomSabor\.slice\s*\(/.test(quemTem);
if (!percorreCatalogo) {
  falhas.push("quem-tem-sabor parou de percorrer produtosDaCasa()");
  console.log("ERRO  quem-tem-sabor parou de percorrer produtosDaCasa()");
} else {
  console.log("ok    quem-tem-sabor percorre produtosDaCasa() via pedeEscolhaDeSabor");
}
if (cortaLista) {
  falhas.push("quem-tem-sabor cortou a lista de quem pede sabor");
  console.log("ERRO  quem-tem-sabor cortou a lista de quem pede sabor");
} else {
  console.log("ok    quem-tem-sabor nao corta a lista de quem pede sabor");
}
if (!r.pedemSabor.length) {
  falhas.push("nenhum produto pede sabor: pedeEscolhaDeSabor quebrou");
  console.log("ERRO  nenhum produto pede sabor");
} else {
  console.log("ok    pedeEscolhaDeSabor cobre " + r.pedemSabor.length + " produtos da lista unica");
}

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
