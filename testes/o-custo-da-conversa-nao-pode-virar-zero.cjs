// O CUSTO DE UMA CONVERSA NAO PODE VIRAR ZERO.
//
// Medido no banco de producao em 31/08/2026, depois de o dono levar um susto
// com a fatura da OpenAI:
//
//   dia         chamadas   tokens/chamada   custo gravado
//   20 a 23/08    21.000        22.000        R$ 321
//   27/08 pra ca   2.400           778        R$ 0,00
//
// Nao ficou de graca: parou de ser anotado. Sao 1,2 milhao de tokens gastos com
// custo ZERO nas duas colunas, e o painel mostrava "Custo de IA: -" pro dono.
//
// A CAUSA, e ela e a doenca mais repetida deste projeto: dois lugares, e um
// arredondava. `uso.ts` tinha consertado a precisao do lado dele, com
// comentario explicando ("fracionario de proposito, custo_cent e inteiro e
// rejeitava virgula"), e o conserto morria uma funcao abaixo, num `Math.round`
// dentro de `estimarCustoCentBRL`.
//
// Ate 26/08 cada chamada mandava 22 mil tokens e custava mais de um centavo,
// entao o arredondamento nao aparecia. Com o fluxo novo cada chamada manda 778
// tokens e custa fracao de centavo: arredondar zera TODAS.
//
// ISTO E ESTIMATIVA, E NAO FATURA. O numero sai da tabela de preco, e a verdade
// mora na fatura da OpenAI. O que este teste garante e que a estimativa nao
// mente dizendo zero.
//
// A ISCA: voltando o `Math.round` em `precos.ts`, o primeiro caso vira zero.
//
// Roda com: node testes/o-custo-da-conversa-nao-pode-virar-zero.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// Os tamanhos sao os medidos no banco, e nao inventados.
const CASOS = [
  {
    nome: "uma chamada do fluxo novo custa mais que zero",
    modelo: "gpt-4.1-mini",
    tin: 778,
    tout: 36,
    maiorQue: 0,
    dano: "2.400 chamadas foram gravadas com custo zero e o dono ficou sem saber quanto gastava",
  },
  {
    nome: "uma conversa inteira de festa tambem",
    modelo: "gpt-4.1-mini",
    // 17 mensagens, duas chamadas cada (leitura e reescrita).
    tin: 778 * 34,
    tout: 36 * 34,
    maiorQue: 0,
    dano: "o custo por atendimento e o numero que decide se o sistema se paga",
  },
  {
    nome: "modelo desconhecido nao vira zero calado",
    modelo: "modelo-que-nao-existe",
    tin: 5000,
    tout: 500,
    maiorQue: 0,
    dano: "trocar de modelo e perder a conta de custo sem nenhum aviso",
  },
  {
    nome: "sem token nao ha custo",
    modelo: "gpt-4.1-mini",
    tin: 0,
    tout: 0,
    igual: 0,
    dano: "cobrar por chamada que nao consumiu nada",
  },
];

const sonda = path.join(__dirname, "_sonda-custo-zero.mts");
fs.writeFileSync(
  sonda,
  [
    'import { estimarCustoCentBRL } from "../lib/ia/precos.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "console.log(JSON.stringify(CASOS.map((c) => estimarCustoCentBRL(c.modelo, c.tin, c.tout))));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-custo-zero.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== o custo da conversa nao pode virar zero ==");
CASOS.forEach((c, n) => {
  const v = Number(saiu[n]);
  const ok = c.igual != null ? v === c.igual : v > c.maiorQue;
  console.log(
    (ok ? "ok    " : "ERRO  ") + c.nome + "  (" + v.toFixed(6) + " centavos)" +
    (ok ? "" : "  ->  " + c.dano),
  );
  if (!ok) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
