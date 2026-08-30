// CUMPRIMENTA UMA VEZ, E NUNCA MANDA EMOJI
//
// O print do dono em 23/08/2026, quatro mensagens seguidas:
//
//   cliente: Boa noite, tudo bem?   Dora: Boa noite, tudo bem? Como posso ajudar?
//   cliente: vcs fazem bolo?        Dora: Boa noite, tudo bem? O que voce gostaria? :)
//   cliente: vcs fazem bolo?        Dora: Boa noite, tudo bem? Qual bolo voce quer?
//
// Dois defeitos num print so.
//
// 1. CUMPRIMENTO EM TODA MENSAGEM. Educacao na primeira fala, tique de robo da
//    segunda em diante. Ninguem diz "boa noite" tres vezes pra mesma pessoa em
//    dois minutos.
//
// 2. EMOJI. Regra do dono desde o primeiro dia, e escapou assim mesmo: a
//    instrucao "sem emoji" estava no prompt da reescrita, e prompt PEDE, nao
//    garante. O que garante e a peneira que roda depois e nao pergunta.
//
// Nao encosta em banco nem em OpenAI: sao funcoes puras.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-cumprimento.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { comCumprimento, tirarCumprimento, semEmoji, saudacaoDaHora } from "../lib/ia/fluxo/falas-do-cliente.ts";',
    "",
    "const manha = new Date(2026, 7, 23, 9, 0);",
    "const tarde = new Date(2026, 7, 23, 15, 0);",
    "const noite = new Date(2026, 7, 23, 21, 0);",
    "",
    "console.log(JSON.stringify({",
    "  hora: [saudacaoDaHora(manha), saudacaoDaHora(tarde), saudacaoDaHora(noite)],",
    "  primeira: comCumprimento('Qual bolo você quer?', noite),",
    "  naoDuplica: comCumprimento('Boa noite, tudo bem? Qual bolo você quer?', noite),",
    "  tira: [",
    "    tirarCumprimento('Boa noite, tudo bem? Qual bolo você quer?'),",
    "    tirarCumprimento('Bom dia! Qual o sabor?'),",
    "    tirarCumprimento('Oi, tudo bem? Me diz a hora da retirada.'),",
    "    tirarCumprimento('Qual bolo você quer?'),",
    "    tirarCumprimento('Boa noite'),",
    "  ],",
    "  meio: tirarCumprimento('Retiro boa tarde ou boa noite?'),",
    "  emoji: [",
    "    semEmoji('Boa noite, tudo bem? O que você gostaria? \\u{1F642}'),",
    "    semEmoji('Fechou \\u2705 seu pedido \\u{1F382} sai amanhã'),",
    "    semEmoji('Tudo certo \\u2764\\uFE0F'),",
    "    semEmoji('R$ 418,80 no total'),",
    "    semEmoji('Pedido certo \\u2014 pode fechar.'),",
    "  ],",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-cumprimento.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

// ------------------------------------------------------- a hora manda
if (JSON.stringify(r.hora) !== JSON.stringify(["Bom dia", "Boa tarde", "Boa noite"])) {
  falhas.push("a saudacao nao segue o relogio: " + JSON.stringify(r.hora));
}

// ------------------------------------------- a primeira fala cumprimenta
if (!/^Boa noite, tudo bem\? Qual bolo/.test(r.primeira)) {
  falhas.push("a primeira fala saiu sem cumprimento: " + r.primeira);
}
if ((r.naoDuplica.match(/Boa noite/g) ?? []).length !== 1) {
  falhas.push("cumprimentou duas vezes na mesma frase: " + r.naoDuplica);
}

// ------------------------------------------ da segunda em diante, sai fora
const esperado = [
  "Qual bolo você quer?",
  "Qual o sabor?",
  "Me diz a hora da retirada.",
  "Qual bolo você quer?", // nao tinha cumprimento: fica igual
];
for (let i = 0; i < esperado.length; i++) {
  if (r.tira[i] !== esperado[i]) {
    falhas.push("tirar o cumprimento deu '" + r.tira[i] + "' em vez de '" + esperado[i] + "'");
  }
}
// Fala que E so cumprimento nao pode virar mensagem vazia: melhor repetir.
if (!r.tira[4]) falhas.push("uma fala que so tem cumprimento virou mensagem vazia");

// "boa tarde" falando de horario de retirada nao e cumprimento e fica inteiro.
if (r.meio !== "Retiro boa tarde ou boa noite?") {
  falhas.push("comeu 'boa tarde' no meio da frase: " + r.meio);
}

// ------------------------------------------------------------ sem emoji
for (const saiu of r.emoji) {
  if (/\p{Extended_Pictographic}/u.test(saiu)) falhas.push("passou emoji: " + saiu);
}
if (r.emoji[0] !== "Boa noite, tudo bem? O que você gostaria?") {
  falhas.push("tirar o emoji estragou o texto: '" + r.emoji[0] + "'");
}
if (r.emoji[3] !== "R$ 418,80 no total") {
  falhas.push("a peneira de emoji mexeu num texto que nao tinha emoji: " + r.emoji[3]);
}
if (r.emoji[4] !== "Pedido certo, pode fechar.") {
  falhas.push("o travessao passou na resposta: " + r.emoji[4]);
}

// ------------------------- e a peneira roda em TUDO que sai pro cliente
const atender = fs.readFileSync(path.join(__dirname, "..", "lib/ia/fluxo/atender.ts"), "utf8");
const saidas = [...atender.matchAll(/texto:\s*([^,\n]*)/g)]
  .map((m) => m[1].trim())
  // "texto: string" e a declaracao do tipo la em cima, nao uma resposta.
  .filter((s) => s && !/^string\b/.test(s));
for (const s of saidas) {
  // Texto escrito aqui dentro nao precisa de peneira: emoji nao entra sozinho
  // num literal do codigo, e quem escrever um vai ver na hora de escrever.
  const ehLiteral = s.startsWith('"') || s.startsWith("'");
  if (!ehLiteral && !s.startsWith("semEmoji(")) {
    falhas.push("uma saida do fluxo nao passa pela peneira de emoji: " + s);
  }
}

console.log("Saidas do fluxo conferidas: " + saidas.length);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: cumprimenta na primeira e so nela, e emoji nao sai daqui.");
