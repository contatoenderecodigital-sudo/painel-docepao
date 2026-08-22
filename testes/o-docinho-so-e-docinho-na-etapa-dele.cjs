// O DOCINHO SO E DOCINHO NA ETAPA DELE
//
// Terceira peca do fluxo novo: a IA le a frase SABENDO em que etapa esta.
//
// O CASO QUE MOTIVOU O PROJETO INTEIRO
//
// Conversa real da kemilly, 22/08/2026, festa do filho Arthur:
//
//   cliente: 4 leites 1kg e 100 brigadeiros e 100 beijinhos
//   Dora:    Anotei o bolo 4 leites COM BRIGADEIRO, 1 kg
//
// Brigadeiro e sabor de bolo E nome de docinho. Sem etapa, a mesma palavra tem
// dois significados e nada sabe desempatar: nasceram tres guardas so pra isso,
// o bolo foi recusado duas vezes, e a cliente teve que cobrar "ta e os doces q
// eu pedi?".
//
// DUAS TRAVAS, E A SEGUNDA E A QUE IMPORTA
//
// 1. VOCABULARIO: na etapa do salgado so entra salgado. Resolve o caso facil.
//
// 2. QUANTIDADE: o vocabulario sozinho NAO resolve o caso da kemilly, porque
//    bolo de brigadeiro existe de verdade e passa no vocabulario do bolo. O que
//    separa e a unidade: bolo se vende por quilo (1, 2, 3) e docinho por
//    unidade (25, 50, 100). Ninguem encomenda um bolo de 100 quilos.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-leitura.mts");
fs.writeFileSync(
  sonda,
  [
    'import { leituraQueCabeNaEtapa, vocabularioDaEtapa, instrucaoDaEtapa } from "../lib/ia/fluxo/leitura.ts";',
    "const vazio = { ehFesta:true, pessoas:20, base:null, baseAceita:true, itens:[], naoQuer:[], dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null };",
    "const r = {",
    // o caso da kemilly, na etapa do bolo
    "  kemilly: leituraQueCabeNaEtapa('bolo', { itens:[{produto:'4 leites',qtd:1},{produto:'brigadeiro',qtd:100},{produto:'beijinho',qtd:100}] }),",
    // bolo de brigadeiro de verdade
    "  boloDeBrigadeiro: leituraQueCabeNaEtapa('bolo', { itens:[{produto:'brigadeiro',qtd:2}] }),",
    // docinho na etapa certa
    "  docinhoNaEtapa: leituraQueCabeNaEtapa('docinho', { itens:[{produto:'brigadeiro',qtd:100},{produto:'beijinho',qtd:100}] }),",
    // salgado com sabor colado no nome
    "  saborColado: leituraQueCabeNaEtapa('salgado', { itens:[{produto:'esfirra de carne',qtd:40},{produto:'brigadeiro',qtd:20}] }),",
    "  vocab: { salgado: vocabularioDaEtapa('salgado').length, docinho: vocabularioDaEtapa('docinho').length, bolo: vocabularioDaEtapa('bolo').length },",
    "  instrucoes: ['bolo','docinho','salgado','dados','pecas_do_bolo'].map((e) => ({ e, n: instrucaoDaEtapa(e as never, vazio as never).length })),",
    "};",
    "console.log(JSON.stringify(r));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-leitura.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const nomes = (x) => (x.limpa.itens ?? []).map((i) => i.produto);

// ------------------------------------------------------ o caso da kemilly
{
  const dentro = nomes(r.kemilly);
  if (!dentro.includes("4 leites")) falhas.push("o bolo de 4 leites nao entrou: " + dentro.join(", "));
  if (dentro.includes("brigadeiro")) {
    falhas.push("os 100 brigadeiros entraram como BOLO de novo (o defeito da kemilly voltou)");
  }
  if (dentro.includes("beijinho")) falhas.push("os 100 beijinhos entraram como bolo");
  if (!r.kemilly.barrados.some((b) => /brigadeiro/.test(b))) {
    falhas.push("o brigadeiro foi descartado calado, sem dizer o motivo no rastro");
  }
  // Sumir calado foi o que fez os 200 docinhos dela desaparecerem do pedido.
  if (!r.kemilly.barrados.some((b) => /docinho/.test(b))) {
    falhas.push("o motivo do descarte nao diz que era docinho");
  }
}

// -------------------------------------- bolo de brigadeiro DE VERDADE passa
if (!nomes(r.boloDeBrigadeiro).includes("brigadeiro")) {
  falhas.push("bolo de brigadeiro de 2 kg foi barrado; a trava da quantidade ficou apertada demais");
}

// --------------------------------------------- docinho na etapa do docinho
{
  const d = nomes(r.docinhoNaEtapa);
  if (d.length !== 2) falhas.push("na etapa do docinho os docinhos foram barrados: " + d.join(", "));
}

// -------------------------------------------- nome com sabor colado passa
{
  const s = nomes(r.saborColado);
  if (!s.includes("esfirra de carne")) falhas.push("'esfirra de carne' foi barrado na etapa do salgado");
  if (s.includes("brigadeiro")) falhas.push("brigadeiro entrou na etapa do salgado");
}

// ------------------------------------------- o vocabulario existe mesmo
if (r.vocab.salgado < 10) falhas.push("o vocabulario do salgado esta pequeno demais: " + r.vocab.salgado);
if (r.vocab.docinho < 5) falhas.push("o vocabulario do docinho sumiu: " + r.vocab.docinho);
if (r.vocab.bolo < 5) falhas.push("o vocabulario do bolo sumiu: " + r.vocab.bolo);

// ---------------------------------- a instrucao e curta, e tem que continuar
// A carta de trinta paginas da versao antiga ia em TODA mensagem e era parte do
// problema: a IA precisava saber tudo porque decidia tudo. Aqui ela decide uma
// coisa so, entao a instrucao cabe em um paragrafo.
for (const { e, n } of r.instrucoes) {
  if (n > 1500) falhas.push("a instrucao da etapa " + e + " ja tem " + n + " caracteres; esta virando carta");
}

console.log("Vocabulario: salgado " + r.vocab.salgado + ", docinho " + r.vocab.docinho + ", bolo " + r.vocab.bolo);
console.log("Instrucoes: " + r.instrucoes.map((x) => x.e + " " + x.n).join(", ") + " caracteres");
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: o docinho so e docinho na etapa dele, e o bolo de brigadeiro continua existindo.");
