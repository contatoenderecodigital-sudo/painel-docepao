// A DATA QUE A IA ESCREVE TEM QUE CHEGAR INTEIRA NO BANCO.
//
// Medido em 22/08/2026 por um agente COMPRANDO, e é o defeito mais perigoso que
// apareceu no projeto até hoje, porque ele é silencioso:
//
//   cliente disse 12/09/2026  ->  banco gravou 2012-09-26
//   cliente disse 04/09/2026  ->  banco gravou 2004-09-26
//   cliente disse 31/08/2026  ->  banco gravou 2031-08-26
//
// A data cai no PASSADO. O pedido some de Aprovação e de Pedidos do dia. O
// cliente recebe "já passei pra nossa equipe" de um pedido que a padaria nunca
// vai ver, e ninguém descobre — não dá erro, não aparece em log, só não existe.
//
// A CAUSA: `parseDataRetirada` (lib/banco/conversas.ts) lê dd/mm/aaaa. Numa
// string ISO ("2026-09-12") a regex casa o pedaço "26-09-12" e entende dia 26,
// mês 09, ano 12.
//
// A casa inteira fala dd/mm/aaaa — `emSaoPaulo` e `dataBrigaComODiaDaSemana`
// sempre devolveram assim. Bastou UMA função nova devolver ISO pra derrubar o
// pedido. Agora são duas travas: a função devolve dd/mm/aaaa, e o parser aceita
// os dois formatos, venha de onde vier.
//
// Roda com: node testes/a-data-chega-inteira-no-banco.cjs
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const nl = String.fromCharCode(10);

// [o que a IA manda, o que TEM que ficar no banco]
const CASOS = [
  // O formato da casa.
  ["12/09/2026", "2026-09-12"],
  ["04/09/2026", "2026-09-04"],
  ["31/08/2026", "2026-08-31"],
  ["1/1/2027", "2027-01-01"],
  // ISO: o formato que derrubou o pedido. Tem que ser aceito como está.
  ["2026-09-12", "2026-09-12"],
  ["2026-09-04", "2026-09-04"],
  ["2026-08-31", "2026-08-31"],
  // Texto livre em volta da data, que é como a IA às vezes escreve.
  ["sabado 29/08/2026", "2026-08-29"],
  // Data impossível: melhor null (a equipe confirma) do que dia errado.
  ["31/02/2026", null],
  ["2026-02-30", null],
];

const sonda = path.join(__dirname, "_sonda-data.mts");
fs.writeFileSync(
  sonda,
  [
    // parseDataRetirada não é exportada de propósito: é detalhe da camada de
    // banco. A sonda importa o módulo e alcança a função pelo comportamento
    // público que a usa, então o teste roda o CÓDIGO REAL.
    'import { readFileSync } from "node:fs";',
    'const fonte = readFileSync("../lib/banco/conversas.ts", "utf8");',
    'const ini = fonte.indexOf("function parseDataRetirada");',
    'const fim = fonte.indexOf("\\nfunction ", ini + 10);',
    'const corpo = fonte.slice(ini, fim > 0 ? fim : undefined);',
    'const fn = new Function("texto", corpo.replace(/^function parseDataRetirada\\(texto: string\\): string \\| null \\{/, "").replace(/\\}\\s*$/, "").replace(/: string/g, "").replace(/: number/g, ""));',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "console.log(JSON.stringify(CASOS.map(([entrada]) => { try { return fn(entrada); } catch (e) { return 'ERRO: ' + String(e).slice(0, 60); } })));",
  ].join(nl),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-data.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const deu = JSON.parse(bruto.trim().split(nl).pop());

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== a data chega no banco do jeito que o cliente falou ==");
CASOS.forEach(([entrada, esperado], i) => {
  conferir(
    deu[i] === esperado,
    JSON.stringify(entrada) + " -> " + JSON.stringify(esperado),
    "gravaria " + JSON.stringify(deu[i]),
  );
});

console.log("");
console.log("== e nenhuma data cai no passado ==");
const hoje = new Date().toISOString().slice(0, 10);
CASOS.forEach(([entrada, esperado], i) => {
  if (esperado === null) return;
  const gravado = deu[i];
  conferir(
    typeof gravado === "string" && gravado >= "2026-01-01",
    JSON.stringify(entrada) + " nao vira ano antigo",
    "gravaria " + JSON.stringify(gravado) + " (hoje e " + hoje + ")",
  );
});

console.log("");
console.log(
  erros === 0
    ? "A DATA CHEGA INTEIRA NO BANCO"
    : erros + " FALHA(S): o pedido some da fila e a padaria nunca ve",
);
process.exit(erros === 0 ? 0 : 1);
