// A TELA DE TESTE MANDA PRO CEREBRO O MESMO QUE O WHATSAPP MANDA.
//
// POR QUE ISTO EXISTE
//
// O `/testar` existe pra o dono conversar com a IA sem WhatsApp e ver o que o
// cliente veria. O cabecalho do arquivo promete: "usa o MESMO cerebro da
// producao", "nada de mock". E ele proprio escreve a regra que se aplica quando
// isso deixa de ser verdade:
//
//     "uma tela de teste que testa outra coisa e pior do que nao ter tela de
//      teste"
//
// Ja aconteceu antes: ate 26/08/2026 a tela chamava o cerebro ANTIGO enquanto a
// producao ja usava o novo.
//
// O DEFEITO ACHADO NA LEITURA DO `app/`, EM 28/08/2026
//
// Quando o dono anexa uma FOTO, o cerebro precisa saber. Ele procura o recado no
// TEXTO da mensagem (o `falaDeFotoRecebida`, no `fluxo.ts`) pra decidir que o
// tema da peca veio pela foto: "quem manda a foto do Homem Aranha ja disse o
// tema, e insistir depois da foto e o tipo de coisa que faz o cliente achar que
// ninguem olhou".
//
// O webhook grudava o recado no texto. A tela de teste injetava no array
// `historico`, que o cerebro NUNCA VE: o que ela manda e `ultima.texto`.
//
// Entao anexar foto no `/testar` nao exercitava o caminho da foto. A tela dizia
// testar a producao e testava outra coisa, exatamente o que o arquivo condena.
//
// E ERAM TRES COPIAS DA MESMA COMBINACAO
//
// O webhook escrevia a frase, a tela escrevia a MESMA frase de novo, e o
// `fluxo.ts` procurava por uma expressao que casava com as duas. Bastava alguem
// mexer numa pra as outras pararem de se entender, sem erro nenhum aparecer.
//
// O QUE ELE COBRA
//
//   1. quem ESCREVE o recado e quem o LE usam a mesma coisa
//   2. o recado que o webhook manda e entendido pelo cerebro
//   3. o recado que a tela de teste manda e entendido pelo cerebro
//   4. as duas rotas nao escrevem a frase a mao de novo
//   5. a tela de teste gruda o recado no TEXTO, e nao no historico
//
// Roda com: node testes/a-tela-de-teste-manda-o-mesmo-que-o-whatsapp.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-recado-foto.mjs");

const SONDA = [
  "import { RECADO_DE_FOTO, comORecadoDaFoto, falaDeFotoRecebida } from '../lib/ia/texto.ts';",
  "",
  "const erros = [];",
  "",
  "// 1 e 2. quem escreve e quem le se entendem",
  "if (!falaDeFotoRecebida(RECADO_DE_FOTO)) {",
  "  erros.push('o cerebro nao reconhece o proprio recado que as rotas mandam');",
  "}",
  "",
  "// 3. o texto do turno, com e sem o que o cliente escreveu junto",
  "const soFoto = comORecadoDaFoto('');",
  "const comTexto = comORecadoDaFoto('quero um bolo assim');",
  "if (!falaDeFotoRecebida(soFoto)) erros.push('foto sem legenda nao e reconhecida');",
  "if (!falaDeFotoRecebida(comTexto)) erros.push('foto com legenda nao e reconhecida');",
  "if (!comTexto.includes('quero um bolo assim')) {",
  "  erros.push('o que o cliente escreveu se perdeu ao grudar o recado: ' + JSON.stringify(comTexto));",
  "}",
  "",
  "// e o que NAO e foto continua nao sendo",
  "for (const t of ['quero 100 coxinhas', 'dia 12/09 as 10h', '']) {",
  "  if (falaDeFotoRecebida(t)) erros.push('achou foto onde nao tem: ' + JSON.stringify(t));",
  "}",
  "",
  "// as formas antigas continuam entendidas: conversa gravada ontem vale hoje",
  "for (const t of ['[imagem]', 'o cliente enviou uma foto', 'foto de referencia']) {",
  "  if (!falaDeFotoRecebida(t)) erros.push('a forma antiga deixou de ser entendida: ' + JSON.stringify(t));",
  "}",
  "",
  "console.log(JSON.stringify({ erros, recado: RECADO_DE_FOTO }));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-recado-foto.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

// -----------------------------------------------------------------------------
// 4 e 5. AS ROTAS. Comentario nao conta como codigo: ele e cortado antes.
// -----------------------------------------------------------------------------
const semComentario = (...p) =>
  fs
    .readFileSync(path.join(raiz, ...p), "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
    .join("\n");

const naRota = [];
const webhook = semComentario("app", "api", "whatsapp", "route.ts");
const testar = semComentario("app", "api", "testar-ia", "route.ts");

if (/const nota = "\[o cliente enviou uma foto/.test(webhook)) {
  naRota.push("o webhook voltou a escrever a frase da foto a mao, em vez de usar a constante");
}
if (!/RECADO_DE_FOTO/.test(webhook)) {
  naRota.push("o webhook parou de usar a constante do recado da foto");
}
if (!/comORecadoDaFoto\(/.test(testar)) {
  naRota.push("a tela de teste parou de grudar o recado da foto no texto");
}
if (/historico\.push\(\{ role: "user", content: nota \}\)/.test(testar)) {
  naRota.push("a tela de teste voltou a injetar o recado no historico, que o cerebro nunca ve");
}
// O texto do turno tem que ser o que vai pro cerebro.
if (!/texto: textoDoTurno/.test(testar)) {
  naRota.push("a tela de teste nao manda mais o `textoDoTurno` pro cerebro: o recado da foto se perde");
}

// E o cerebro nao pode ter a expressao escrita a mao de novo.
const fluxo = semComentario("lib", "ia", "fluxo", "fluxo.ts");
if (/foto de refer\|enviou uma foto/.test(fluxo)) {
  naRota.push("o `fluxo.ts` voltou a ter a expressao da foto escrita a mao, fora da funcao unica");
}
if (!/falaDeFotoRecebida\(/.test(fluxo)) {
  naRota.push("o `fluxo.ts` parou de usar o `falaDeFotoRecebida`");
}

console.log("O recado: " + JSON.stringify(r.recado));
console.log("");

const falhas = [...r.erros, ...naRota];
if (falhas.length) {
  console.log("ERRO  a tela de teste e o WhatsApp mandam coisas diferentes (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o recado da foto sai de um lugar so, e chega no cerebro pelos dois caminhos");
console.log("");
console.log("PASSOU");
