// O RESUMO DO PEDIDO CHEGA INTEIRO NO CLIENTE.
//
// O corpo com botoes aceita 1024 caracteres e o texto comum aceita 4096.
// Cortar no primeiro limite fazia o fim do resumo desaparecer, inclusive a
// retirada e o total.
//
// OS DOIS LADOS
//
//   1. ate 1024 caracteres, a mensagem continua interativa;
//   2. acima disso, o texto inteiro sai sem botoes e, se necessario, em partes.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-resumo-inteiro.mts");
fs.writeFileSync(
  sonda,
  [
    'import { enviarBotoes, partesDaMensagem } from "../lib/whatsapp/api.ts";',
    "",
    "const chamadas: Array<Record<string, unknown>> = [];",
    "globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {",
    "  chamadas.push(JSON.parse(String(init?.body ?? '{}')));",
    "  return { ok:true, json:async () => ({messages:[{id:'wamid.' + chamadas.length}]}) };",
    "}) as typeof fetch;",
    "const creds = {token:'teste', phoneId:'123'};",
    "const botoes = [{id:'fecha_sim',titulo:'Confirmar'}];",
    "",
    "const noLimite = 'A'.repeat(1024);",
    "await enviarBotoes('5511999999999', noLimite, botoes, creds);",
    "const chamadaNoLimite = chamadas.splice(0);",
    "",
    "const acima = 'B'.repeat(1025);",
    "await enviarBotoes('5511999999999', acima, botoes, creds);",
    "const chamadaAcima = chamadas.splice(0);",
    "",
    "const resumo = ('linha do pedido com valor e retirada\\n').repeat(260) + '*Total: R$ 543,00*';",
    "await enviarBotoes('5511999999999', resumo, botoes, creds);",
    "const chamadasResumo = chamadas.splice(0);",
    "const partes = partesDaMensagem(resumo);",
    "const fronteira = partesDaMensagem('A'.repeat(4095) + ' B');",
    "",
    "console.log(JSON.stringify({",
    "  noLimite:{quantidade:chamadaNoLimite.length,tipo:chamadaNoLimite[0]?.type,",
    "    texto:(chamadaNoLimite[0]?.interactive as {body?:{text?:string}})?.body?.text},",
    "  acima:{quantidade:chamadaAcima.length,tipo:chamadaAcima[0]?.type,",
    "    texto:(chamadaAcima[0]?.text as {body?:string})?.body},",
    "  resumo:{tipos:chamadasResumo.map((c) => c.type),",
    "    textos:chamadasResumo.map((c) => (c.text as {body?:string})?.body ?? '')},",
    "  partes, fronteira, original:resumo,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-resumo-inteiro.mts"], {
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
if (r.noLimite.quantidade !== 1 || r.noLimite.tipo !== "interactive" || r.noLimite.texto.length !== 1024) {
  falhas.push("texto que cabia perdeu os botoes: " + JSON.stringify(r.noLimite));
}
if (r.acima.quantidade !== 1 || r.acima.tipo !== "text" || r.acima.texto.length !== 1025) {
  falhas.push("texto acima de 1024 foi cortado: " + JSON.stringify(r.acima));
}
if (r.resumo.tipos.some((tipo) => tipo !== "text")) {
  falhas.push("resumo grande tentou sair como corpo interativo");
}
if (r.resumo.textos.join("") !== r.original || r.partes.join("") !== r.original) {
  falhas.push("uma parte do resumo desapareceu");
}
if (r.partes.some((parte) => parte.length > 4096)) {
  falhas.push("uma parte passou do limite de 4096 caracteres");
}
if (r.fronteira.some((parte) => parte.length > 4096) || r.fronteira.join("") !== "A".repeat(4095) + " B") {
  falhas.push("a quebra no ultimo espaco passou do limite");
}
if (!r.resumo.textos.join("").endsWith("*Total: R$ 543,00*")) {
  falhas.push("o total nao chegou no fim do resumo");
}

console.log("partes=" + r.partes.length + " caracteres=" + r.original.length);
console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  for (const f of falhas) console.log("ERRO  " + f);
  process.exit(1);
}
console.log("ok    o resumo chega inteiro, com o total");
console.log("");
console.log("PASSOU");
