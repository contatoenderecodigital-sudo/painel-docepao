// A PADARIA NAO PROMETE O QUE A COZINHA NAO FAZ.
//
// POR QUE ISTO EXISTE
//
// Medicao de 20/08/2026: o pedido fechou com
//
//     30 brigadeiro (sem lactose, forminha rosa)
//
// A cliente tinha PERGUNTADO se tem docinho sem lactose, a padaria respondeu
// certo que nao tem, e mesmo assim a restricao foi parar na observacao do item.
//
// A observacao vai pra comanda da cozinha E pro resumo que o cliente recebe. A
// cozinha produz brigadeiro normal e entrega pra alguem que leu "sem lactose"
// na confirmacao. Se essa pessoa tem intolerancia, deixa de ser prejuizo e vira
// problema de saude.
//
// A guarda disso morava no cerebro antigo, apagado em 26/08/2026. No
// levantamento feito antes de apagar (O-QUE-O-VELHO-PROTEGIA.md) esta era a
// unica regra que o fluxo nao tinha e que continuava valendo.
//
// O TESTE COBRA OS DOIS LADOS, e o segundo e o que importa:
//
//   1. o que a casa NAO faz sai da observacao;
//   2. o que a casa FAZ nao pode ser tocado.
//
// A Doce Pao TEM bolo "0% lactose", sabor de festa da faixa C, R$ 55,90 o
// quilo. Uma guarda larga demais diria que a padaria nao trabalha com sem
// lactose e derrubaria essa venda. Guarda que trava venda e pior que o defeito
// que ela conserta, e isso ja aconteceu mais de uma vez neste projeto.
//
// E ela nao vale pra casa inteira: a padaria fazer UM bolo sem lactose nao quer
// dizer que o brigadeiro seja sem lactose. Por isso a checagem e amarrada ao
// PRODUTO do item, e nao ao cardapio em geral.
//
// Roda com: node testes/promessa-que-a-cozinha-nao-cumpre.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-promessa.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { restricoesQueACasaNaoFaz, obsSemRestricao, avisoDaRestricao } from "../lib/ia/fluxo/restricao.ts";',
    "",
    "const casos = [",
    "  // O QUE A CASA NAO FAZ: sai da observacao, e o item FICA.",
    "  ['brigadeiro',      'sem lactose, forminha rosa', ['sem lactose'], 'forminha rosa'],",
    "  ['brigadeiro',      'sem lactose',                ['sem lactose'], null],",
    "  ['coxinha',         'sem gluten',                 ['sem gluten'],  null],",
    "  ['torta doce',      'diet',                       ['diet'],        null],",
    "  ['torta doce',      'sem acucar',                 ['diet'],        null],",
    "  ['pao frances',     'integral',                   ['integral'],    null],",
    "  ['beijinho',        'vegano',                     ['vegano'],      null],",
    "  // A CASA FAZ ESTE BOLO. Nao pode ser tocado, e nao pode virar recusa.",
    "  ['bolo 0% lactose', '0% lactose',                 [],              '0% lactose'],",
    "  ['bolo 0% lactose', 'sem lactose',                [],              'sem lactose'],",
    "  ['bolo 0% lactose', 'pao de lo branco',           [],              'pao de lo branco'],",
    "  // E O QUE A CASA FAZ CONTINUA INTOCADO. 'sem cebola' e 'sem palmito' sao",
    "  // pedidos legitimos que a cozinha atende, e nao restricao de dieta.",
    "  ['brigadeiro',      'forminha rosa',              [],              'forminha rosa'],",
    "  ['quiche',          'frango',                     [],              'frango'],",
    "  ['empadao',         'sem palmito',                [],              'sem palmito'],",
    "  ['coxinha',         'sem cebola',                 [],              'sem cebola'],",
    "  ['bolo laka',       'pao de lo branco | topo tema princesa', [],   'pao de lo branco | topo tema princesa'],",
    "];",
    "",
    "const saida = casos.map(([produto, obs, tira, sobra]) => ({",
    "  produto, obs, tiraEsperado: tira, sobraEsperada: sobra,",
    "  tirou: restricoesQueACasaNaoFaz(obs, produto).map((x) => x.normalize('NFD').replace(/[^ -~]/g, '')),",
    "  sobrou: obsSemRestricao(obs, produto),",
    "}));",
    "console.log(JSON.stringify({ saida, frase: avisoDaRestricao(['sem lactose']) }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-promessa.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const { saida, frase } = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

for (const r of saida) {
  const bateTira = JSON.stringify(r.tirou) === JSON.stringify(r.tiraEsperado);
  const bateSobra = r.sobrou === r.sobraEsperada;
  const ok = bateTira && bateSobra;
  if (!ok) {
    falhas.push(
      r.produto + ' com "' + r.obs + '": tirou ' + JSON.stringify(r.tirou) +
      " e sobrou " + JSON.stringify(r.sobrou) +
      " (esperava tirar " + JSON.stringify(r.tiraEsperado) +
      " e sobrar " + JSON.stringify(r.sobraEsperada) + ")",
    );
  }
  console.log(
    (ok ? "ok    " : "ERRO  ") + r.produto.padEnd(18) + ('"' + r.obs + '"').padEnd(42) +
    "tira " + JSON.stringify(r.tirou),
  );
}

// A frase tem que EXISTIR e nao pode pedir desculpa nem prometer que vai passar
// a fazer. A padaria nao errou, e prometer o que ela nao faz e o defeito que
// este arquivo inteiro combate.
console.log("");
console.log("a frase pro cliente: " + JSON.stringify(frase));
if (!frase || !/n[aã]o tem/i.test(frase)) falhas.push("a frase nao diz que a casa nao tem");
if (/desculp|perd[aã]o|sinto muito/i.test(String(frase))) falhas.push("a frase pede desculpa por algo que nao e erro da padaria");
if (/vamos (passar a )?fazer|em breve|por enquanto/i.test(String(frase))) falhas.push("a frase promete que a casa vai passar a fazer");

console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: o que a casa nao faz sai do pedido, o que ela faz continua vendido.");
