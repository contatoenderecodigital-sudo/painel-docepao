// UMA LETRA TROCADA NAO PODE FAZER A PADARIA NEGAR O QUE ELA VENDE.
//
// POR QUE ISTO EXISTE
//
// Bateria dos cinco jeitos, cenario "com erro de digitacao", cinco execucoes de
// cinco em 27/08/2026:
//
//   cliente >> 50 brigadero, forminha rosa
//   padaria >> A gente nao faz brigadero.
//   no banco >> 100 coxinha, 100 quiche, 2 kg de bolo   (o brigadeiro sumiu)
//
// Perdeu o docinho E a cor da forminha, que nao tinha mais em que linha morar.
// E a padaria mentiu: ela faz brigadeiro, e faz mais brigadeiro do que qualquer
// outra coisa.
//
// PASSAVA POR SORTE
//
// Este mesmo cenario estava verde de manha. O que mudou nao foi o codigo do
// portao: foi o modelo, que costumava corrigir a digitacao antes de devolver o
// nome e nessa rodada devolveu "brigadero" como veio. Sistema que depende do
// modelo acertar a digitacao nao tem defesa nenhuma, so nao tinha falhado ainda.
//
// A FOLGA E DE UMA LETRA, E TEM MOTIVO
//
// O `apelidos.ts` avisa, com razao, que afrouxar por distancia de letra casa
// produto errado: "esfirra" e "esfiha" estao a tres letras. Aqui a folga e de
// UMA letra, o nome precisa ter cinco ou mais, e o quase acerto so vale quando
// UM UNICO PRODUTO esta a essa distancia.
//
// Unicidade de PRODUTO, e nao de grafia: dos 35 nomes do vocabulario do
// salgado, 21 pares estao a duas letras um do outro e todos os 21 sao apelidos
// da mesma coisa ("risoles", "risole", "rissoles" e o `risólis` do cardapio).
// Contar grafia recusaria o quase acerto justamente nos produtos que o cliente
// mais escreve errado.
//
// OS DOIS LADOS
//
//   1. o erro de digitacao alcanca o produto;
//   2. o que a casa NAO faz continua barrado, e o que e de outra etapa tambem.
//      Sem isso o conserto viraria uma peneira, e peneira aqui custa dinheiro:
//      um nome estranho viraria o produto mais parecido do cardapio.
//
// Roda com: node testes/uma-letra-trocada-nao-nega-o-produto.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-digitacao.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { leituraQueCabeNaEtapa, vocabularioDaEtapa } from "../lib/ia/fluxo/leitura.ts";',
    'import { produtosNaFrase } from "../lib/ia/fluxo/leitor-da-frase.ts";',
    "",
    "// [etapa, o que o cliente escreveu, o que tem que entrar (null = barrado)]",
    "const CASOS = [",
    "  ['docinho', 'brigadero', 'brigadeiro'],",
    "  ['docinho', 'beijino', 'beijinho'],",
    "  ['docinho', 'cajuzino', 'cajuzinho'],",
    "  ['salgado', 'coxinia', 'coxinha'],",
    "  ['salgado', 'coxinia de frango', 'coxinha de frango'],",
    "  ['salgado', 'esfihaa', 'esfirra'],",
    "  ['salgado', 'risolez', 'risólis'],",
    "  // Sem erro nenhum, tudo continua como era.",
    "  ['docinho', 'brigadeiro', 'brigadeiro'],",
    "  ['salgado', 'coxinha', 'coxinha'],",
    "  ['salgado', 'chique', 'chique'],",
    "  ['salgado', 'risoles', 'risoles'],",
    "  // O que a casa nao faz continua barrado.",
    "  ['docinho', 'macaron', null],",
    "  ['salgado', 'hamburguer', null],",
    "  ['docinho', 'cheesecake', null],",
    "  // E o que e de outra etapa tambem: coxinha nao vira docinho.",
    "  ['docinho', 'coxinha', null],",
    "  ['salgado', 'brigadeiro', null],",
    "];",
    "",
    "const erros = [];",
    "for (const [etapa, escrito, esperado] of CASOS) {",
    "  const r = leituraQueCabeNaEtapa(etapa, { itens: [{ produto: escrito, qtd: 50 }] });",
    "  const saiu = (r.limpa.itens && r.limpa.itens[0] && r.limpa.itens[0].produto) || null;",
    "  const ok = esperado === null",
    "    ? saiu === null",
    "    : String(saiu).toLowerCase() === String(esperado).toLowerCase();",
    "  if (!ok) erros.push(etapa + \" / '\" + escrito + \"' -> \" + JSON.stringify(saiu) + ', esperado ' + JSON.stringify(esperado));",
    "}",
    "",
    "",
    "// O OUTRO LADO DA MESMA REGUA: a frase nao pode INVENTAR produto.",
    "//",
    "// O leitor da frase tinha duas letras de folga em nome de sete, e",
    "// 'frango' esta a exatamente duas de 'morango':",
    "//",
    "//   '100 quiche de frango'  ->  quiche, MORANGO",
    "//",
    "// O morango fantasma nao virava linha do pedido, mas fazia a frase 'ter",
    "// nomeado um produto', e isso derruba a regra de que SABOR SOLTO NAO E",
    "// ASSUNTO NOVO: quem responde 'de frango' saia da etapa em que estava.",
    "const NA_FRASE = [",
    "  ['quero 200 coxinha e 100 quiche de frango', ['coxinha', 'quiche']],",
    "  ['de frango', []],",
    "  ['de calabresa', []],",
    "  ['chique de frango', ['quiche']],",
    "  ['50 brigadero, forminha rosa', ['brigadeiro']],",
    "  ['100 coxinia', ['coxinha']],",
    "  // E o morango de verdade continua sendo achado.",
    "  ['quero um bolo de morango', ['morango']],",
    "];",
    "const errosDaFrase = [];",
    "for (const [frase, esperado] of NA_FRASE) {",
    "  const saiu = produtosNaFrase(frase);",
    "  const igual = JSON.stringify([...saiu].sort()) === JSON.stringify([...esperado].sort());",
    "  if (!igual) errosDaFrase.push(\"'\" + frase + \"' -> \" + JSON.stringify(saiu) + ', esperado ' + JSON.stringify(esperado));",
    "}",
    "",
    "console.log(JSON.stringify({ conferidos: CASOS.length + NA_FRASE.length, erros, errosDaFrase, vocab: vocabularioDaEtapa('docinho').length }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-digitacao.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Jeitos de escrever conferidos: " + r.conferidos);
console.log("Nomes no vocabulario do docinho: " + r.vocab);
console.log("");

if (!r.vocab) {
  console.log("ERRO  vocabulario vazio: a leitura do catalogo quebrou");
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

let reprovou = false;
if (r.erros.length) {
  reprovou = true;
  console.log("ERRO  o portao da etapa decidiu errado (" + r.erros.length + ")");
  for (const x of r.erros) console.log("        " + x);
} else {
  console.log("ok    erro de digitacao alcanca o produto");
  console.log("ok    o que a casa nao faz continua barrado");
  console.log("ok    o que e de outra etapa continua barrado");
}

if (r.errosDaFrase.length) {
  reprovou = true;
  console.log("ERRO  a frase inventou ou perdeu produto (" + r.errosDaFrase.length + ")");
  for (const x of r.errosDaFrase) console.log("        " + x);
} else {
  console.log("ok    a frase nao inventa produto que ninguem pediu");
}

console.log("");
if (reprovou) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
