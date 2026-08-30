// O INTERRUPTOR OFF CALA A IA.
//
// FLUXO_NOVO_PARA=off nao escolhe outro cerebro e nao manda resposta
// automatica. A mensagem do cliente ja foi salva no painel antes desta
// decisao. Ligado ou sem variavel, o fluxo continua atendendo normalmente.
//
// OS DOIS LADOS
//
//   1. sem variavel e com valor ligado, o fluxo atende;
//   2. com off, o webhook sai sem modelo, envio ou handoff automatico.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-interruptor.mts");
fs.writeFileSync(
  sonda,
  [
    'import { ehDoFluxoNovo } from "../lib/ia/fluxo/atender.ts";',
    "",
    "delete process.env.FLUXO_NOVO_PARA;",
    "const padrao = ehDoFluxoNovo('5511999999999');",
    "process.env.FLUXO_NOVO_PARA = 'off';",
    "const desligado = ehDoFluxoNovo('5511999999999');",
    "process.env.FLUXO_NOVO_PARA = 'on';",
    "const ligado = ehDoFluxoNovo('5511999999999');",
    "console.log(JSON.stringify({ padrao, desligado, ligado }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-interruptor.mts"], {
    cwd: __dirname,
    encoding: "utf8",
    timeout: 180000,
    shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
if (!r.padrao) falhas.push("sem variavel o fluxo ficou desligado");
if (r.desligado) falhas.push("off ainda liga o fluxo");
if (!r.ligado) falhas.push("on nao liga o fluxo");

const rota = fs.readFileSync(path.join(__dirname, "..", "app", "api", "whatsapp", "route.ts"), "utf8");
const inicio = rota.indexOf("if (!ehDoFluxoNovo(telefone)) {");
const fim = inicio < 0 ? -1 : rota.indexOf("\n      try {", inicio);
if (inicio < 0 || fim < 0) {
  falhas.push("nao achei a saida imediata do webhook quando a IA esta off");
} else {
  const guarda = rota.slice(inicio, fim);
  if (!/continue;/.test(guarda)) falhas.push("off nao encerra o turno");
  if (/atenderComFluxoNovo|new OpenAI|enviarTexto|enviarBotoes|definirHandoff/.test(guarda)) {
    falhas.push("off ainda chama modelo, envia resposta ou cria handoff automatico");
  }
}

console.log("padrao=" + r.padrao + " off=" + r.desligado + " on=" + r.ligado);
console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  for (const f of falhas) console.log("ERRO  " + f);
  process.exit(1);
}
console.log("ok    off salva a fala do cliente e nao responde");
console.log("");
console.log("PASSOU");
