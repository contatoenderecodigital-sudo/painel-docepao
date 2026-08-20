// GENERICO NAO PODE SUMIR DO PEDIDO.
//
// O rastro de 20/08/2026 pegou o estrago no ato. A cliente pediu 200 salgados
// assados, a Dora ofereceu o sortido CERTO (40 esfirra, 40 empadinha, 40 pastel
// assado, 40 quiche, 40 croissant), a cliente aceitou, e na hora de registrar
// ela mandou:
//
//   registrar_pedido <- {"item":"salgado assado","qtd":200}
//
// O motor nao sabe cobrar "salgado assado", que e nome de CATEGORIA e nao de
// produto. Resultado: os 200 salgados sumiram do pedido, em silencio, e o
// pedido fechou so com os docinhos. R$ 250 evaporando sem ninguem ver, nem a
// cliente nem a padaria.
//
// Este teste garante que o generico e ABERTO nos tipos, com a conta fechada, em
// vez de virar item sem preco.
//
// Roda com: node testes/generico-nao-some.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { sugestaoDeSortido } = require("./_guardas.cjs")();

const pasta = mkdtempSync(join(tmpdir(), "gen-"));
execFileSync(
  "npx",
  ["tsc", "lib/ia/orcamento.ts", "lib/tipos.ts", "--outDir", pasta, "--module", "commonjs",
   "--target", "es2020", "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule"],
  { stdio: "pipe", shell: true },
);
const { cotarPorItens } = require(join(pasta, "ia", "orcamento.js"));

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== o motor NAO cobra generico (por isso ele nao pode chegar la) ==");
for (const nome of ["salgado assado", "salgado frito", "salgado", "docinho"]) {
  const c = cotarPorItens([{ item: nome, qtd: 200 }]);
  const l = c.linhas[0];
  const semPreco = !l || !l.subtotal || l.subtotal <= 0;
  console.log("      " + nome.padEnd(16) + (semPreco ? "sem preco" : "R$ " + l.subtotal.toFixed(2)));
}

console.log("");
console.log("== o generico aberto vira itens que o motor COBRA ==");
for (const [familia, total] of [
  ["salgado_assado", 200],
  ["salgado_frito", 150],
  ["docinho", 100],
]) {
  const partes = sugestaoDeSortido(familia, total);
  conferir(partes.length > 0, familia + " de " + total + " abre em tipos", "nao abriu");
  const soma = partes.reduce((a, p) => a + p.qtd, 0);
  conferir(soma === total, "  e a soma bate: " + total, "somou " + soma);
  const c = cotarPorItens(partes.map((p) => ({ item: p.produto, qtd: p.qtd })));
  const semPreco = c.linhas.filter((l) => !l.subtotal || l.subtotal <= 0).map((l) => l.item);
  conferir(semPreco.length === 0, "  e todos tem preco no motor", "sem preco: " + semPreco.join(", "));
  const total_ = c.total;
  conferir(total_ > 0, "  e o total do bloco e maior que zero (R$ " + total_.toFixed(2) + ")", "zerado");
}

console.log("");
console.log("== o caso REAL: 200 salgados assados nao podem virar zero ==");
const partes = sugestaoDeSortido("salgado_assado", 200);
const cot = cotarPorItens(partes.map((p) => ({ item: p.produto, qtd: p.qtd })));
conferir(
  Math.abs(cot.total - 250) < 1,
  "200 salgados assados custam perto de R$ 250 (R$ " + cot.total.toFixed(2) + ")",
  "deu R$ " + cot.total.toFixed(2) + ", confira o preco do assado",
);

console.log("");
console.log("== e o codigo do cerebro abre o generico de verdade ==");
const fs = require("fs");
const cerebro = fs
  .readFileSync("lib/ia/cerebro.ts", "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");
conferir(
  /GENERICO NAO ENTRA EM PEDIDO REGISTRADO|brutosCrus\.flatMap/.test(fs.readFileSync("lib/ia/cerebro.ts", "utf8")),
  "o registrar_pedido abre o generico antes de cotar",
  "o generico volta a sumir",
);
conferir(
  cerebro.includes("sugestaoDeSortido(familia"),
  "e usa a MESMA divisao da ferramenta de sortido",
  "duas divisoes diferentes vao divergir",
);

console.log("");
console.log(erros === 0 ? "GENERICO NAO SOME" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
