// SABOR SEM ACENTO E O MESMO SABOR.
//
// Achado no RASTRO DA PRODUCAO em 22/08/2026, ao vivo — nao no codigo:
//
//   anotar_item <- {"produto":"empadinha","qtd":50,"obs":"brocolis"}
//   anotar_item -> "Anotei 50 de empadinha, mas FALTA O SABOR. Pergunte AGORA
//                   citando as opcoes: palmito, frango, carne, brócolis?"
//
// O sabor ESTAVA na observacao. "brocolis" nao casava com "brócolis" porque a
// comparacao so baixava a caixa e nao tirava o acento — e no WhatsApp quase
// ninguem digita acento. O efeito e duplo e os dois doem:
//
//   1. ela pergunta o sabor que o cliente ACABOU de dar (a pergunta repetida
//      que mais irrita, e a que faz o cliente parar de responder)
//   2. o pedido nao fecha, porque o item fica marcado como "sem sabor"
//
// E as duas metades do codigo discordavam entre si: o portao de fechamento
// (cerebro.ts, `semSabor`) JA tirava o acento certo; o retorno da ferramenta
// nao tirava. Mesma pergunta, duas respostas, no mesmo arquivo.
//
// A licao ja estava escrita em portugues, trinta linhas acima, na guarda de
// sabor de bolo: "Sem acento dos dois lados: o cliente escreve prestigio,
// pessego, maracuja". Estava escrita e nao era cobrada por teste nenhum.
//
// Vale pra todo sabor acentuado da casa: brócolis, prestígio, risólis, chodó,
// limão, café, inglês, fubá.
//
// Roda com: node testes/sabor-sem-acento-e-o-mesmo-sabor.cjs
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const nl = String.fromCharCode(10);

// Cada caso: [observacao do item, opcoes de sabor, deveria faltar sabor?]
const CASOS = [
  // O CASO DO RASTRO.
  ["brocolis", ["palmito", "frango", "carne", "brócolis"], false],
  ["brócolis", ["palmito", "frango", "carne", "brócolis"], false],
  ["BROCOLIS", ["palmito", "frango", "carne", "brócolis"], false],
  ["palmito com requeijao", ["palmito", "frango", "carne", "brócolis"], false],
  // Os outros sabores acentuados da casa.
  ["prestigio", ["prestígio", "morango", "bombom"], false],
  ["risolis", ["risólis", "coxinha"], false],
  ["limao", ["limão", "café", "fuba"], false],
  ["cafe", ["limão", "café", "fuba"], false],
  ["ingles", ["inglês", "nega maluca"], false],
  ["chodo", ["chodó", "coxinha"], false],
  // E continua cobrando quando o sabor NAO foi dito.
  ["", ["palmito", "frango"], true],
  ["sem cebola", ["palmito", "frango"], true],
  ["forminha rosa", ["palmito", "frango"], true],
];

const sonda = path.join(__dirname, "_sonda-sabor.mts");
fs.writeFileSync(
  sonda,
  [
    'import { faltaSabor } from "../lib/ia/cerebro.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "console.log(JSON.stringify(CASOS.map(([obs, ops]) => faltaSabor(obs as string, ops as string[]))));",
  ].join(nl),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-sabor.mts"], {
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

console.log("== o sabor escrito sem acento conta como dito ==");
CASOS.forEach(([obs, ops, esperado], i) => {
  const rotulo = JSON.stringify(obs) + " em " + JSON.stringify(ops);
  conferir(
    deu[i] === esperado,
    rotulo + (esperado ? "  (tem que COBRAR o sabor)" : "  (o sabor JA foi dito)"),
    "faltaSabor devolveu " + deu[i],
  );
});

console.log("");
console.log(
  erros === 0
    ? "SABOR SEM ACENTO E O MESMO SABOR"
    : erros + " FALHA(S): ela pergunta o sabor que o cliente ja deu, e o pedido nao fecha",
);
process.exit(erros === 0 ? 0 : 1);
