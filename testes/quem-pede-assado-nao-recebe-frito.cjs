// QUEM PEDE ASSADO NAO PODE RECEBER FRITO.
//
// Medicao de 21/08/2026, 3 rodadas de 5 com a MESMA falha. Conversa literal:
//
//   cliente: "bom dia, preciso de 200 salgados assados pra quarta as 9h"
//   cliente: "pode escolher voce os tipos, confio"
//   Dora:    "- 67 coxinha, 67 mini bolha de carne e 66 esfirra de calabresa"
//   cliente: "isso mesmo, nome Juliana Reis, boleto faturado"
//   pedido:  esfirra 40, empadinha 40, pastel assado 40, quiche 40, croissant 40
//
// Tres coisas erradas de uma vez:
//   1. coxinha e mini bolha sao FRITOS, e ele pediu ASSADOS
//   2. o recheio (carne, calabresa) foi decidido pelo codigo; ninguem escolheu
//   3. a lista que ele ACEITOU nao e a lista que foi ANOTADA
//
// A causa nao estava nas funcoes: `familiaQueElePediu` e `sugestaoDeSortido`
// sempre estiveram certas e sempre passaram no teste. Estava em QUEM AS CHAMAVA
// — um bloco no cerebro com os nomes escritos na mao. Por isso este teste roda
// `indicacaoDeFesta`, que e a ligacao, e nao as pecas separadas.
//
// Roda com: node testes/quem-pede-assado-nao-recebe-frito.cjs
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const nl = String.fromCharCode(10);

// Nomes da casa, conferidos no catalogo. Frito e assado sao bancadas e
// preparos diferentes: trocar um pelo outro e entregar comida errada.
const FRITOS = ["coxinha", "mini bolha", "risólis", "bolinha de queijo", "croquete"];
const ASSADOS = ["esfirra", "empadinha", "pastel assado", "quiche", "croissant"];

const CASOS = [
  { nome: "pediu assado na PRIMEIRA mensagem e delegou na segunda",
    falas: ["bom dia, preciso de 200 salgados assados pra quarta as 9h", "pode escolher voce os tipos, confio"],
    base: "200 salgados", esperado: "assado" },
  { nome: "pediu frito",
    falas: ["quero 100 salgados fritos pra sabado", "escolhe voce"],
    base: "100 salgados", esperado: "frito" },
  { nome: "nao disse nada: vale o padrao da casa",
    falas: ["preciso de 100 salgados pra domingo", "escolhe voce"],
    base: "100 salgados", esperado: "frito" },
  { nome: "mudou de ideia no meio: vale o ULTIMO",
    falas: ["queria 200 salgados fritos", "na verdade pode ser assados", "escolhe voce"],
    base: "200 salgados", esperado: "assado" },
];

const sonda = path.join(__dirname, "_sonda-assado.mts");
fs.writeFileSync(
  sonda,
  [
    'import { indicacaoDeFesta } from "../lib/ia/cerebro.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "console.log(JSON.stringify(CASOS.map((c) => ({ ...c, saiu: indicacaoDeFesta(c.falas, c.base) }))));",
  ].join(nl),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-assado.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const resultados = JSON.parse(bruto.trim().split(nl).pop());

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== a familia que ele pediu e a familia que ele recebe ==");
for (const r of resultados) {
  const salgados = r.saiu.propostos.filter((p) => String(p.categoria).startsWith("salgado"));
  const nomes = salgados.map((p) => p.produto);
  const proibidos = r.esperado === "assado" ? FRITOS : ASSADOS;
  const intrusos = nomes.filter((n) => proibidos.includes(n));
  conferir(nomes.length > 0, r.nome + ": veio sortido", "veio vazio");
  conferir(!intrusos.length, r.nome + ": so " + r.esperado, "veio " + JSON.stringify(intrusos));
  conferir(
    salgados.every((p) => p.categoria === (r.esperado === "assado" ? "salgado_assado" : "salgado_frito")),
    r.nome + ": a categoria bate com a familia",
    JSON.stringify(salgados.map((p) => p.categoria)),
  );
}

console.log("");
console.log("== a lista que ele aceita e a lista que fica anotada ==");
for (const r of resultados) {
  const texto = r.saiu.linhas.join(" | ");
  const faltando = r.saiu.propostos
    .filter((p) => String(p.categoria).startsWith("salgado"))
    .filter((p) => !texto.includes(p.produto) || !texto.includes(String(p.qtd)));
  conferir(!faltando.length, r.nome, "anotado sem estar no texto: " + JSON.stringify(faltando[0] || ""));
}

console.log("");
console.log("== a soma bate com o que ele pediu ==");
for (const r of resultados) {
  const total = r.saiu.propostos
    .filter((p) => String(p.categoria).startsWith("salgado"))
    .reduce((s, p) => s + p.qtd, 0);
  const pedido = Number((r.base.match(/([0-9]+) *salgados/) || [])[1] || 0);
  conferir(total === pedido, r.nome + ": " + pedido + " salgados", "somou " + total);
}

console.log("");
console.log("== recheio nao se inventa ==");
for (const r of resultados) {
  const comObs = r.saiu.propostos.filter((p) => p.obs);
  conferir(!comObs.length, r.nome, "o codigo decidiu o sabor: " + JSON.stringify(comObs[0] || ""));
}

console.log("");
console.log(erros === 0 ? "A FAMILIA PEDIDA E A FAMILIA ENTREGUE" : erros + " FALHA(S): o cliente receberia outra coisa");
process.exit(erros === 0 ? 0 : 1);
