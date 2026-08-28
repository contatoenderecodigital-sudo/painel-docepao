// NADA SOME NO PORTAO DA ETAPA.
//
// POR QUE ISTO EXISTE
//
// O portao (`leituraQueCabeNaEtapa`) decide se o item que a IA leu entra no
// pedido agora, espera a etapa dele, ou e recusado. Sao tres saidas, e o
// defeito que este teste cobra e sempre o mesmo: existir uma QUARTA saida, a
// que nao devolve nada e nao avisa ninguem.
//
// O caso fundador esta escrito dentro do proprio arquivo, e mesmo assim
// quebrava. A frase da kemilly, 22/08/2026, na etapa do bolo:
//
//     4 leites 1kg e 100 brigadeiros e 100 beijinhos
//
// O bloco que separa bolo de docinho pela quantidade barrava os 200 docinhos
// (certo: ninguem encomenda bolo de 100 quilos) e terminava em `return []`
// seco. Os docinhos nao entravam, nao ficavam guardados e nao eram recusados:
// sumiam. Com um item valido na mesma frase, o desvio pra etapa do docinho nem
// disparava, porque ele exige que NADA tenha entrado.
//
// Item que some e a pior coisa que este sistema faz. Se o cliente nao repetir,
// a padaria produz metade do que ele pediu e ninguem descobre antes da
// retirada.
//
// O QUE ELE COBRA
//
// Para cada item que entra, uma das tres saidas tem que conte-lo:
//
//     entrou no pedido        limpa.itens
//     esperando a etapa dele  paraDepois
//     a casa nao vende        naoExistem
//
// E cobra o contrario tambem: `naoExistem` so pode citar o que a casa
// realmente nao vende. Negar o que ela vende e mentir pro cliente, e ja
// aconteceu com o brigadeiro na etapa do salgado.
//
// Roda com: node testes/nada-some-no-portao-da-etapa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-nada-some.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { leituraQueCabeNaEtapa, existeNoCardapio } from '../lib/ia/fluxo/leitura.ts';",
    "",
    "// Cada caso e uma frase que ja aconteceu, ou que acontece toda semana.",
    "const CASOS = [",
    "  ['a frase da kemilly, na etapa do bolo', 'bolo',",
    "    [{produto:'4 leites',qtd:1},{produto:'brigadeiro',qtd:100},{produto:'beijinho',qtd:100}]],",
    "  ['docinho citado na etapa do salgado', 'salgado',",
    "    [{produto:'coxinha',qtd:100},{produto:'brigadeiro',qtd:50}]],",
    "  ['familia que nenhuma etapa cobre', 'salgado', [{produto:'torta fria',qtd:1}]],",
    "  ['produto que a casa nao vende', 'docinho', [{produto:'xilofone',qtd:50}]],",
    "  ['uma letra trocada', 'docinho', [{produto:'brigadero',qtd:50}]],",
    "  ['o nome do catalogo na etapa dele', 'bolo', [{produto:'bolo brigadeiro',qtd:2}]],",
    "  ['bolo caseiro citado no docinho', 'docinho', [{produto:'bolo caseiro cenoura',qtd:1}]],",
    "  ['apelido do cliente', 'salgado', [{produto:'risoles de carne',qtd:100}]],",
    "  ['peso de bolo carimbado em docinho', 'bolo', [{produto:'bolo brigadeiro',qtd:100}]],",
    "];",
    "",
    "const sumiram = [], mentiu = [];",
    "for (const [rotulo, etapa, itens] of CASOS) {",
    "  const r = leituraQueCabeNaEtapa(etapa, { itens });",
    "  const entrou = (r.limpa.itens ?? []).length;",
    "  const guardou = r.paraDepois.length;",
    "  const recusou = r.naoExistem.length;",
    "  // A conta e por CABECA: cada item de entrada tem que ter uma saida.",
    "  if (entrou + guardou + recusou !== itens.length) {",
    "    sumiram.push(rotulo + ' [' + etapa + ']: entraram ' + itens.length +",
    "      ', sairam ' + (entrou + guardou + recusou) +",
    "      ' (pedido ' + entrou + ', guardado ' + guardou + ', recusado ' + recusou + ')');",
    "  }",
    "  // Recusar o que a casa vende e mentir. So o que nao existe pode entrar aqui.",
    "  for (const n of r.naoExistem) {",
    "    if (existeNoCardapio(n)) mentiu.push(rotulo + ': recusou \"' + n + '\", que a casa vende');",
    "  }",
    "}",
    "console.log(JSON.stringify({ casos: CASOS.length, sumiram, mentiu }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-nada-some.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Casos medidos: " + r.casos);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("item entrou no portao e nao saiu por saida nenhuma", r.sumiram);
cobra("a padaria recusou o que ela vende", r.mentiu);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    todo item entrou no pedido, ficou guardado ou foi recusado com verdade");
console.log("");
console.log("PASSOU");
