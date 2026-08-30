// ERRO DO WHATSAPP NAO SOME NO CATCH VAZIO.
//
// POR QUE ISTO EXISTE
//
// Recibo de entrega nunca gravou e ninguem viu: `.catch(() => {})` engolia a
// falha. Sem log, o proximo conserto e chute. Recibo continua nao se inventando:
// o que muda e aparecer o erro.
//
// OS DOIS LADOS
//
//   1. o caminho do webhook nao volta a ter catch vazio
//   2. catch COM log (console.error) continua valendo: o turno nao pode cair
//
// Roda com: node testes/o-erro-do-whatsapp-nao-some.cjs
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const arquivos = [
  "app/api/whatsapp/route.ts",
  "lib/whatsapp/api.ts",
  "lib/whatsapp/transcrever.ts",
  "lib/banco/conversas.ts",
];
const vazio = /\.catch\(\(\)\s*=>\s*\{\s*\}\)/;
const falhas = [];

for (const rel of arquivos) {
  const texto = fs.readFileSync(path.join(raiz, rel), "utf8");
  const linhas = texto.split(/\n/);
  const ruins = [];
  linhas.forEach((l, i) => {
    if (vazio.test(l)) ruins.push((i + 1) + ": " + l.trim());
  });
  if (ruins.length) {
    falhas.push(rel + " ainda engole erro: " + ruins.join(" | "));
    console.log("ERRO  " + rel);
    for (const r of ruins) console.log("        " + r);
  } else {
    console.log("ok    " + rel + " nao tem catch vazio");
  }
}

const rota = fs.readFileSync(path.join(raiz, "app/api/whatsapp/route.ts"), "utf8");
if (!/statusesDoWebhook/.test(rota)) {
  falhas.push("o webhook deixou de passar o status pelo leitor que nao some no pacote");
  console.log("ERRO  o webhook nao usa statusesDoWebhook");
} else {
  console.log("ok    o webhook le o status mesmo quando vem mensagem no pacote");
}

const api = fs.readFileSync(path.join(raiz, "lib/whatsapp/api.ts"), "utf8");
if (!/131009/.test(api)) {
  falhas.push("marcar lida/digitando deixou de nomear o 131009 da Meta");
  console.log("ERRO  api.ts nao cita 131009");
} else {
  console.log("ok    o 131009 da Meta esta nomeado no log, sem inventar recibo");
}

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
