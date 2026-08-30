// A TELA /testar MOSTRA OS BOTOES QUE O WHATSAPP MOSTRARIA.
//
// POR QUE ISTO EXISTE
//
// A rota /api/testar-ia ja devolvia `botoes` e aceitava `botaoId`. A tela
// ignorava os dois: pagamento, fechar e a base da festa so existiam no celular.
// Quem testava no painel escrevia "pix" e exercitava OUTRO caminho.
//
// OS DOIS LADOS
//
//   1. a tela pinta os botoes que a rota devolveu
//   2. o toque manda botaoId, igual ao webhook
//   3. escrever texto NAO inventa botaoId
//   4. a tela NAO manda fecha_sim sozinha (a IA nunca confirma o pedido)
//
// Roda com: node testes/a-tela-de-teste-mostra-os-botoes.cjs
const path = require("node:path");
const fs = require("node:fs");

const raiz = path.join(__dirname, "..");
const semComentario = (...p) =>
  fs
    .readFileSync(path.join(raiz, ...p), "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
    .join("\n");

const tela = semComentario("app", "(painel)", "testar", "page.tsx");
const rota = semComentario("app", "api", "testar-ia", "route.ts");
const falhas = [];

if (!/dados\.botoes/.test(tela) || !/setBotoes\(/.test(tela)) {
  falhas.push("a tela parou de guardar os botoes que a rota devolve");
}
if (!/botoes\.map\(/.test(tela) || !/onClick=\{\(\) => enviar\(b\)\}/.test(tela)) {
  falhas.push("a tela parou de mostrar o toque nos botoes da fala");
}
if (!/botaoId: toque \? toque\.id : null/.test(tela)) {
  falhas.push("escrever texto voltou a nao distinguir toque de frase, ou o toque nao manda o id");
}
if (/botaoId:\s*["']fecha_sim["']/.test(tela)) {
  falhas.push("a tela passou a mandar fecha_sim sozinha: a IA nao confirma pedido");
}
if (!/corpo\.botaoId/.test(rota)) {
  falhas.push("a rota parou de ler o botaoId que a tela manda");
}

console.log("Conferidos: app/(painel)/testar/page.tsx e app/api/testar-ia/route.ts");
console.log("");

if (falhas.length) {
  console.log("ERRO  a tela de teste nao exercita os botoes (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o toque no botao vai com o id, e escrever nao inventa id");
console.log("");
console.log("PASSOU");
