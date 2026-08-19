// RODA TODOS OS TESTES E FALHA DE VERDADE SE UM SO QUEBRAR.
//
// Em 19/08/2026 eu rodei os testes num laco de shell, um deles quebrou, a tela
// mostrou FALHOU, e o commit foi feito assim mesmo: laco de shell nao propaga a
// falha pro && seguinte. Teste que nao trava o commit nao e teste, e enfeite.
//
// Este arquivo tambem descobre os testes sozinho. Antes a lista era digitada a
// mao em cada comando, e teste novo so entrava na conta se alguem lembrasse.
//
// Roda com: node testes/todos.cjs
const { readdirSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

// O medidor fica de fora de proposito: ele roda cada cenario cinco vezes
// falando com a IA de verdade, gasta uns 25 minutos e centenas de mensagens do
// teto da OpenAI. Serve pra DECIDIR, rodando na mao quando a gente quer saber
// se melhorou. Quem trava commit e este arquivo aqui, que roda em segundos.
const FORA = ["todos.cjs", "medidor.cjs"];

const aqui = __dirname;
const arquivos = readdirSync(aqui)
  // Arquivo com "_" na frente e utilitario dos testes, nao teste. Sem isto o
  // portao tentaria rodar o _guardas.cjs e contaria como falha.
  .filter((f) => f.endsWith(".cjs") && !f.startsWith("_") && !FORA.includes(f))
  .sort();

console.log("Rodando " + arquivos.length + " testes.");
console.log("");

const quebrados = [];
for (const arq of arquivos) {
  const nome = arq.replace(/\.cjs$/, "");
  const comeco = process.hrtime.bigint();
  try {
    execFileSync(process.execPath, [join(aqui, arq)], { stdio: "pipe", cwd: join(aqui, "..") });
    const ms = Number(process.hrtime.bigint() - comeco) / 1e6;
    console.log("ok     " + nome.padEnd(28) + Math.round(ms) + "ms");
  } catch (e) {
    const ms = Number(process.hrtime.bigint() - comeco) / 1e6;
    console.log("FALHOU " + nome.padEnd(28) + Math.round(ms) + "ms");
    quebrados.push({ nome, saida: String(e.stdout ?? "") + String(e.stderr ?? "") });
  }
}

console.log("");
if (!quebrados.length) {
  console.log("OS " + arquivos.length + " TESTES PASSARAM");
  process.exit(0);
}

for (const q of quebrados) {
  console.log("=".repeat(70));
  console.log("FALHA EM " + q.nome);
  console.log("=".repeat(70));
  // So as linhas que interessam: o que deu ERRO e o fim da saida.
  const linhas = q.saida.split("\n");
  const ruins = linhas.filter((l) => /^ERRO|Error|SyntaxError|falha|FALHA/i.test(l));
  console.log((ruins.length ? ruins : linhas.slice(-15)).join("\n").trim());
  console.log("");
}
console.log(quebrados.length + " DE " + arquivos.length + " TESTES QUEBRADOS: " + quebrados.map((q) => q.nome).join(", "));
process.exit(1);
