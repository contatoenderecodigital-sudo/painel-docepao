// A FAMILIA DO ITEM SAI DA TABELA DAS FAMILIAS, E NAO DE UMA REGEX A PARTE.
//
// POR QUE ISTO EXISTE
//
// Quando o cliente pede "300 assados" e depois diz quais sao, o codigo precisa
// achar a LINHA GENERICA daquela familia pra subtrair. Sem isso o pedido fecha
// com 450 salgados, e ja sobrou um "salgado 200" fantasma num pedido de
// verdade.
//
// Quem respondia "de que familia e este item" dentro do `montagem.ts` era isto:
//
//   const familia = (c, p) =>
//     /^salgado/.test(c) || /^salgado/.test(p) ? "salgado"
//     : c === "docinho" || /^(docinho|doce)s?$/.test(p) ? "docinho"
//     : /^bolo/.test(c) || /^bolos?$/.test(p) ? "bolo" : c;
//
// E a tabela `FAMILIAS` do `generico.ts` escrita de novo, ao contrario e com
// regex. Duas consequencias:
//
//   1. a PIZZA nao existia nessa regra. Uma linha generica de pizza nunca era
//      encontrada, entao nunca era subtraida.
//   2. cadastrar uma familia nova em `FAMILIAS` nao valia aqui: teria que
//      lembrar de escrever a regex tambem.
//
// A regra da casa e essa mesma: nada pode ser uma lista minha, so o cardapio e
// os valores.
//
// COMO A TROCA FOI MEDIDA, E NAO DEDUZIDA
//
// Antes de trocar, os 194 pares que o sistema PRODUZ de verdade (todo produto
// do catalogo com a categoria que o `categoriaDoPedido` da pra ele, mais as
// palavras genericas com a categoria errada, que e como a linha generica
// chega) foram passados pelas duas versoes. Uma unica divergencia:
//
//     outro | "pizza"    velha = outro     nova = pizza
//
// Que e o defeito 1 sendo consertado.
//
// (Fora dos pares reais existem 30 divergencias, todas do mesmo tipo: a
// categoria diz uma familia e o NOME diz outra, como categoria `pizza` com
// produto "docinho". Sao estados contraditorios que o sistema nao produz.)
//
// O QUE ELE COBRA
//
//   1. todo produto do catalogo cai na familia certa
//   2. a linha generica com categoria errada e encontrada, pizza inclusive
//   3. a resposta sai da `FAMILIAS`: acrescentar familia la vale aqui sozinho
//   4. ninguem volta a escrever a regra de familia com regex no `montagem.ts`
//
// Roda com: node testes/a-familia-do-item-sai-de-uma-tabela-so.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-familia.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { familiaDoItem } from '../lib/banco/montagem.ts';",
    "import { familiaDaCategoria, familiaDoNome } from '../lib/ia/fluxo/generico.ts';",
    "import { produtosDaCasa, categoriaDoPedido } from '../lib/ia/dados/produtos.ts';",
    "",
    "const erros = [];",
    "const cobra = (rotulo, deu, esperado, entrada) => {",
    "  if (deu !== esperado) erros.push(rotulo + ' ' + entrada + ': deu ' + JSON.stringify(deu) + ', esperado ' + JSON.stringify(esperado));",
    "};",
    "",
    "// 1. A CATEGORIA MANDA, e ela vem da tabela.",
    "cobra('categoria', familiaDaCategoria('salgado_frito'), 'salgado', 'salgado_frito');",
    "cobra('categoria', familiaDaCategoria('salgado_assado'), 'salgado', 'salgado_assado');",
    "cobra('categoria', familiaDaCategoria('bolo_festa'), 'bolo', 'bolo_festa');",
    "cobra('categoria', familiaDaCategoria('bolo_caseiro'), 'bolo', 'bolo_caseiro');",
    "cobra('categoria', familiaDaCategoria('docinho'), 'docinho', 'docinho');",
    "cobra('categoria', familiaDaCategoria('pizza'), 'pizza', 'pizza');",
    "// o que nao e familia devolve null, e quem chama decide",
    "for (const c of ['outro', 'por_quilo', 'por_unidade', 'cupcake', 'papel_de_arroz']) {",
    "  cobra('categoria sem familia', familiaDaCategoria(c), null, c);",
    "}",
    "",
    "// 2. A LINHA GENERICA COM A CATEGORIA ERRADA e achada pelo NOME.",
    "//",
    "// E assim que ela chega: a IA anota 'salgado 300' e poe categoria `outro`.",
    "for (const [palavra, esperado] of [",
    "  ['salgado', 'salgado'], ['salgados', 'salgado'], ['salgado frito', 'salgado'],",
    "  ['salgado assado', 'salgado'], ['docinho', 'docinho'], ['docinhos', 'docinho'],",
    "  ['doce', 'docinho'], ['doces', 'docinho'], ['bolo', 'bolo'], ['bolos', 'bolo'],",
    "  ['pizza', 'pizza'],",
    "]) {",
    "  cobra('generico com categoria errada', familiaDoItem('outro', palavra), esperado, JSON.stringify(palavra));",
    "  cobra('nome', familiaDoNome(palavra), esperado, JSON.stringify(palavra));",
    "}",
    "",
    "// 3. TODO PRODUTO DA CASA cai na familia da categoria dele.",
    "//",
    "// Sem lista escrita aqui: a familia esperada sai da propria tabela, entao o",
    "// que este pedaco cobra e a CONSISTENCIA -- o caminho do item ate a familia",
    "// nao pode depender de quem pergunta.",
    "const semFamilia = [];",
    "for (const p of produtosDaCasa()) {",
    "  for (const nome of [p.nome, p.nomeCurto]) {",
    "    const cat = categoriaDoPedido(nome);",
    "    const esperado = familiaDaCategoria(cat) ?? familiaDoNome(nome) ?? cat;",
    "    if (familiaDoItem(cat, nome) !== esperado) {",
    "      semFamilia.push(nome + ' (' + cat + '): ' + familiaDoItem(cat, nome) + ' != ' + esperado);",
    "    }",
    "  }",
    "}",
    "",
    "console.log(JSON.stringify({ produtos: produtosDaCasa().length, erros, semFamilia }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-familia.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

// -----------------------------------------------------------------------------
// 4. NINGUEM ESCREVE A REGRA DE FAMILIA COM REGEX DE NOVO
// -----------------------------------------------------------------------------
const montagem = fs.readFileSync(path.join(raiz, "lib", "banco", "montagem.ts"), "utf8");
const naMao = [];
montagem.split(/\r?\n/).forEach((linha, i) => {
  const codigo = linha.replace(/\r/g, "").replace(/\/\/.*$/, "");
  if (/\/\^salgado\/|\/\^bolos\?\$\/|docinho\|doce/.test(codigo)) {
    naMao.push("lib/banco/montagem.ts:" + (i + 1) + "  " + linha.trim());
  }
});

console.log("Produtos do catalogo conferidos: " + r.produtos);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista.slice(0, 15)) console.log("        " + l);
  if (lista.length > 15) console.log("        ... e mais " + (lista.length - 15));
  console.log("");
};

cobra("a familia do item saiu errada", r.erros);
cobra("produto do catalogo caiu em familia diferente da da categoria dele", r.semFamilia);
cobra("a regra de familia voltou a ser regex no montagem.ts", naMao);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    a familia sai da tabela, e a linha generica de pizza tambem e achada");
console.log("");
console.log("PASSOU");
