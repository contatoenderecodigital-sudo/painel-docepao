// A BASE DA FESTA NAO PODE DEPENDER DA ORDEM DAS LINHAS DO CATALOGO.
//
// POR QUE ISTO EXISTE
//
// A proposta por pessoas escolhe UM produto de cada familia pra fazer a conta
// ("250 salgados, 125 docinhos, 2,5 kg de bolo"). Quem acha esse produto casa a
// categoria PELO COMECO, entao pedir um pedaco de categoria devolve o primeiro
// que aparecer no catalogo -- e a ordem das linhas do catalogo nao e decisao de
// ninguem, e o jeito que elas ficaram no arquivo.
//
// O bolo ja tinha sido consertado por isso, e o comentario dele dizia o preco:
// "pedir 'bolo' devolvia o primeiro da ORDEM DO CATALOGO, e hoje isso da certo
// por acidente". O salgado continuou de pe.
//
// MEDIDO EM 30/08/2026, numa festa de 25 pessoas:
//
//     como esta                            250 salgado frito    R$ 523,50
//     trocando de lugar as duas linhas
//     de salgado no catalogo               250 salgado assado   R$ 586,00
//
// R$ 62,50 de diferenca na proposta que o cliente le, sem ninguem ter mudado
// preco nenhum. E o tipo de defeito que este projeto mais pagou: nao da erro no
// dia em que e escrito, e aparece meses depois quando alguem mexe no cardapio.
//
// COMO ESTE TESTE DECIDE, E POR QUE OS DOIS LADOS
//
// 1. NENHUMA CHAMADA PEDE UM PEDACO DE CATEGORIA. Ele le as chamadas de
//    `primeiroDaCategoria` no `orcamento.ts` e confere cada argumento contra as
//    categorias do catalogo: argumento que alcanca DUAS e ambiguo, e quem
//    desempata passa a ser a ordem do arquivo. Chamada nova nasce coberta.
//
// 2. E A BASE CONTINUA SAINDO. Trava que apaga a proposta e pior que o defeito:
//    a festa de 25 pessoas tem que continuar com as tres linhas, e o preco do
//    salgado tem que ser o do catalogo, nao um numero escrito aqui.
//
// Roda com: node testes/a-base-da-festa-nao-depende-da-ordem-do-catalogo.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const RAIZ = path.join(__dirname, "..");

// As chamadas de verdade, lidas do arquivo, sem os comentarios: comentario
// citando a chamada errada e explicacao, e nao codigo.
const fonte = fs
  .readFileSync(path.join(RAIZ, "lib/ia/orcamento.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split(/\r?\n/)
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .map((l) => l.replace(/\/\/.*$/, ""))
  .join("\n");

const pedidos = [...fonte.matchAll(/primeiroDaCategoria\(\s*["']([^"']+)["']/g)].map((m) => m[1]);

const sonda = path.join(__dirname, "_sonda-base-ordem.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { produtosDaCasa } from "../lib/ia/dados/produtos.ts";',
    'import { motorPadrao } from "../lib/ia/orcamento.ts";',
    "",
    "const PEDIDOS = " + JSON.stringify(pedidos) + ";",
    "",
    "// As categorias que o motor enxerga sao as do catalogo.",
    "const todas = produtosDaCasa().map((p) => String(p.categoria).toLowerCase());",
    "const categorias = [...new Set(todas)];",
    "const ambiguos = PEDIDOS.map((arg) => {",
    "  const alcanca = categorias.filter((c) => c.startsWith(String(arg).toLowerCase()));",
    "  return { arg, alcanca };",
    "}).filter((x) => x.alcanca.length !== 1);",
    "",
    "// A base de uma festa de 25 pessoas, do motor de verdade.",
    "const c = motorPadrao.sugerirPorPessoas(25, { salgado: true, doce: true, bolo: true });",
    "const linhas = (c.linhas ?? []).map((l) => ({",
    "  item: String(l.item), categoria: String(l.categoria ?? ''), qtd: Number(l.qtd), unit: Number(l.unit),",
    "}));",
    "const frito = produtosDaCasa().find((p) => p.categoria === 'salgado_frito');",
    "",
    "console.log(JSON.stringify({",
    "  pedidos: PEDIDOS, categorias: categorias.length, ambiguos,",
    "  linhas, total: Number(c.total), precoDoFrito: frito ? frito.preco : null,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-base-ordem.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

console.log("Chamadas de primeiroDaCategoria: " + r.pedidos.length + " (" + r.pedidos.join(", ") + ")");
console.log("Categorias do catalogo: " + r.categorias);
console.log("");

// Detector que nao le nada passa verde escondendo a propria quebra.
if (!r.pedidos.length) {
  falhas.push("nenhuma chamada de primeiroDaCategoria foi achada: a leitura do orcamento.ts quebrou");
  console.log("ERRO  nenhuma chamada foi achada no orcamento.ts");
}

// 1. NENHUM ARGUMENTO AMBIGUO.
if (r.ambiguos.length) {
  for (const a of r.ambiguos) {
    const como =
      a.alcanca.length > 1
        ? "alcanca " + a.alcanca.length + " categorias (" + a.alcanca.join(", ") + "), e quem desempata e a ordem do catalogo"
        : "nao alcanca categoria nenhuma do catalogo";
    falhas.push("primeiroDaCategoria(" + JSON.stringify(a.arg) + ") " + como);
    console.log("ERRO  primeiroDaCategoria(" + JSON.stringify(a.arg) + ") " + como);
  }
} else {
  console.log("ok    toda chamada pede uma categoria inteira, e alcanca uma so");
}

// 2. E A BASE CONTINUA SAINDO, com o preco do catalogo.
const salgado = r.linhas.find((l) => l.categoria.startsWith("salgado"));
if (r.linhas.length !== 3) {
  falhas.push("a base de 25 pessoas saiu com " + r.linhas.length + " linhas em vez de 3");
  console.log("ERRO  a base de 25 pessoas saiu com " + r.linhas.length + " linhas: " + r.linhas.map((l) => l.item).join(", "));
} else if (!salgado) {
  falhas.push("a base saiu sem linha de salgado");
  console.log("ERRO  a base saiu sem linha de salgado");
} else if (salgado.categoria !== "salgado_frito" || salgado.unit !== r.precoDoFrito) {
  falhas.push(
    "a linha de salgado da base e " + salgado.item + " [" + salgado.categoria + "] a R$ " + salgado.unit +
      ", e o frito do catalogo custa R$ " + r.precoDoFrito,
  );
  console.log("ERRO  a base cotou " + salgado.item + " [" + salgado.categoria + "] a R$ " + salgado.unit);
} else {
  console.log(
    "ok    a base de 25 pessoas: " + r.linhas.map((l) => l.qtd + "x " + l.item).join(", ") +
      " (R$ " + r.total.toFixed(2) + ")",
  );
}

console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: a base pede categoria inteira, e o preco dela sai do catalogo.");
