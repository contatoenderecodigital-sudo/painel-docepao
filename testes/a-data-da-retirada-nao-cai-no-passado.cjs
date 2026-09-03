// A DATA DA RETIRADA NAO CAI NO PASSADO, E QUEM DECIDE ISSO E UMA FUNCAO SO.
//
// POR QUE ISTO EXISTE
//
// Teste do dono em 23/08/2026: ele disse "dia 05 de setembro" e o pedido foi
// anotado pra 05/09/2024. O conserto foi o `dataDeRetirada`, que joga a data
// pra frente quando o ano cai pra tras -- e ele e testado.
//
// So que na hora de GRAVAR, o `conversas.ts` tinha um SEGUNDO interpretador de
// data, escrito do zero, e mais fraco justamente nesse ponto:
//
//     parseDataRetirada("05/01")  ->  "2026-01-05"     (rodando em 28/08/2026)
//
// Ele carimbava `new Date().getFullYear()` e pronto. Pedido feito em dezembro
// pra 05 de janeiro nascia com a data do janeiro que JA PASSOU -- e dezembro e
// justamente quando se encomenda bolo pro ano novo numa padaria.
//
// Um conserto na entrada nao vale nada se a ultima linha do caminho refaz a
// conta do jeito antigo.
//
// O QUE ELE COBRA
//
//   1. a data sem ano vai pro futuro, inclusive na virada do ano
//   2. o `conversas.ts` nao tem interpretador de data proprio
//
// Roda com: node testes/a-data-da-retirada-nao-cai-no-passado.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-data.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { dataDeRetirada } from '../lib/ia/fluxo/falas-do-cliente.ts';",
    "",
    "const erros = [];",
    "const cobra = (rotulo, deu, esperado, entrada) => {",
    "  if (deu !== esperado) erros.push(rotulo + ' ' + JSON.stringify(entrada) + ': deu ' + JSON.stringify(deu) + ', esperado ' + JSON.stringify(esperado));",
    "};",
    "",
    "// 20 de dezembro de 2026: o cliente encomenda o bolo do ano novo.",
    "const DEZEMBRO = new Date(2026, 11, 20, 10, 0, 0);",
    "cobra('virada do ano', dataDeRetirada('05/01', DEZEMBRO), '05/01/2027', '05/01');",
    "cobra('virada do ano', dataDeRetirada('31/12', DEZEMBRO), '31/12/2026', '31/12');",
    "cobra('virada do ano', dataDeRetirada('20/12', DEZEMBRO), '20/12/2026', '20/12');",
    "",
    "// meio do ano: nada muda pra data que ainda vem",
    "const AGOSTO = new Date(2026, 7, 28, 10, 0, 0);",
    "cobra('mesmo ano', dataDeRetirada('05/09', AGOSTO), '05/09/2026', '05/09');",
    "cobra('ano que o modelo chutou pra tras', dataDeRetirada('05/09/2024', AGOSTO), '05/09/2026', '05/09/2024');",
    "",
    "// ROLAR O ANO E CERTO PRA POUCOS MESES, E ABSURDO PRA MUITOS.",
    "//",
    "// Medido na conversa dele de 02/09/2026: ele escreveu 'dia 02/05', maio ja",
    "// tinha passado, e o pedido foi gravado pra 02/05/2027 -- DAQUI A OITO",
    "// MESES. Nao esta no passado, e por isso a guarda antiga achou que tinha",
    "// resolvido. Mas padaria nao agenda com oito meses: aquilo era erro de",
    "// digitacao. Melhor perguntar do que a cozinha produzir em maio do ano que",
    "// vem.",
    "const SETEMBRO = new Date(2026, 8, 2, 10, 0, 0);",
    "cobra('rolagem longa demais', dataDeRetirada('02/05', SETEMBRO), null, '02/05');",
    "cobra('rolagem longa demais', dataDeRetirada('dia 02/05', SETEMBRO), null, 'dia 02/05');",
    "// E A ROLAGEM CURTA CONTINUA VALENDO: o ano novo encomendado em setembro e",
    "// pedido de verdade, e e por ele que esta guarda existe.",
    "cobra('rolagem curta', dataDeRetirada('05/01', SETEMBRO), '05/01/2027', '05/01');",
    "cobra('rolagem curta', dataDeRetirada('20/12', SETEMBRO), '20/12/2026', '20/12');",
    "// QUEM DIZ O ANO E RESPEITADO: casamento se encomenda com um ano.",
    "cobra('ano dito com todas as letras', dataDeRetirada('02/05/2027', SETEMBRO), '02/05/2027', '02/05/2027');",
    "",
    "// dia que nao existe no calendario: perguntar de novo e melhor que anotar",
    "cobra('dia impossivel', dataDeRetirada('31/02', AGOSTO), null, '31/02');",
    "cobra('sem data nenhuma', dataDeRetirada('qualquer coisa', AGOSTO), null, 'qualquer coisa');",
    "",
    "console.log(JSON.stringify({ medidas: 13, erros }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-data.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

// -----------------------------------------------------------------------------
// 2. O `conversas.ts` NAO PODE TER INTERPRETADOR DE DATA PROPRIO.
//
// Ele grava. Quem entende o que o cliente falou e o `dataDeRetirada`. Um regex
// de data neste arquivo e o segundo interpretador voltando.
// -----------------------------------------------------------------------------
const fonte = fs.readFileSync(path.join(raiz, "lib", "banco", "conversas.ts"), "utf8");
const proprios = [];
fonte.split("\n").forEach((linha, i) => {
  const codigo = linha.replace(/\r/g, "").replace(/\/\/.*$/, "");
  // um regex com dois grupos de 1-2 digitos separados por barra ou traco
  if (/\{1,\s*2\}\)\[.{0,6}\]\(/.test(codigo) || /getFullYear\(\)/.test(codigo)) {
    proprios.push("lib/banco/conversas.ts:" + (i + 1) + "  " + linha.trim());
  }
});
const delega = /dataDeRetirada\(/.test(fonte);

console.log("Datas medidas: " + r.medidas);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("a data da retirada foi lida errado", r.erros);
cobra("o conversas.ts voltou a interpretar data por conta propria", proprios);
if (!delega) {
  falhas.push("delegacao");
  console.log("ERRO  o conversas.ts parou de chamar dataDeRetirada: quem grava nao decide");
  console.log("");
}

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    a retirada e sempre no futuro, e a conta e feita num lugar so");
console.log("");
console.log("PASSOU");
