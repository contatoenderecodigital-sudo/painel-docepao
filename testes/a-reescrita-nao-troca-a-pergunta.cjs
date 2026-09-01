// A REESCRITA NAO PODE TROCAR A PERGUNTA.
//
// A IA reescreve as frases pra padaria nao falar como robo, e isso e bom. So que
// ela reescreve o TEXTO, e volta e meia leva junto o assunto.
//
// Medido conversando com a producao em 02/09/2026, numa conversa com festa,
// pizza e pao na mesma mensagem:
//
//   codigo >> Qual pizza voce quer: pizza inteira, pizza meia ou pizza redonda?
//   saiu   >> Qual forminha dourada voce quer, brigadeiro ou beijinho?
//
// Ela trocou o assunto pelo do turno anterior. O cliente recebe uma escolha que
// nao existe, responde qualquer coisa, e a conversa anda pro lado errado com o
// pedido no meio.
//
// A GUARDA DE NUMERO JA EXISTIA AQUI, e e a mesma ideia: numero e opcao sao
// CONTEUDO do codigo, e nao jeito de falar. Faltando uma opcao, vai a frase do
// motor, que e feia e certa.
//
// Roda com: node testes/a-reescrita-nao-troca-a-pergunta.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ORIGINAL = "Qual pizza você quer: pizza inteira, pizza meia ou pizza redonda?";
const OPCOES = ["pizza inteira", "pizza meia", "pizza redonda"];

const CASOS = [
  {
    nome: "reescrita que troca o assunto e descartada",
    reescrita: "Qual forminha dourada você quer, brigadeiro ou beijinho?",
    esperado: ORIGINAL,
    dano: "o cliente escolhe entre opcoes que nao existem, e o pedido anda errado",
  },
  {
    nome: "reescrita que perde UMA opcao tambem",
    reescrita: "Você quer pizza inteira ou pizza meia?",
    esperado: ORIGINAL,
    dano: "a redonda some do cardapio sem ninguem decidir isso",
  },
  {
    nome: "reescrita que mantem as opcoes passa",
    reescrita: "Me diz qual pizza: pizza inteira, pizza meia ou pizza redonda?",
    esperado: "Me diz qual pizza: pizza inteira, pizza meia ou pizza redonda?",
    dano: "sem deixar passar, a padaria volta a falar como robo",
  },
  {
    nome: "e acento nao derruba a reescrita",
    reescrita: "Qual você prefere: pizza inteira, pizza meia ou pizza redonda?",
    esperado: "Qual você prefere: pizza inteira, pizza meia ou pizza redonda?",
    dano: "comparar com acento faria toda reescrita cair",
  },
];

const sonda = path.join(__dirname, "_sonda-reescrita.mts");
fs.writeFileSync(
  sonda,
  [
    'import { dizerComJeito } from "../lib/ia/fluxo/dizer.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const ORIGINAL = " + JSON.stringify(ORIGINAL) + ";",
    "const OPCOES = " + JSON.stringify(OPCOES) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  // Cliente falso: devolve a reescrita do caso, como a OpenAI devolveria.",
    "  const cliente = {",
    "    chat: { completions: { create: async () => ({",
    "      choices: [{ message: { content: c.reescrita } }],",
    "      usage: { prompt_tokens: 1, completion_tokens: 1 },",
    "    }) } },",
    "  };",
    "  const fala = { texto: ORIGINAL, botoes: [], cardapio: null, podeReescrever: true, opcoes: OPCOES };",
    "  saiu.push(await dizerComJeito(cliente as never, fala as never));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-reescrita.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a reescrita nao troca a pergunta ==");
CASOS.forEach((c, n) => {
  const problemas = [];
  if (String(saiu[n]).trim() !== c.esperado.trim()) {
    problemas.push("saiu " + JSON.stringify(String(saiu[n]).slice(0, 70)));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
