// O PAINEL MOSTRA O RECIBO QUE O BANCO GRAVOU, E NADA ALEM.
//
// POR QUE ISTO EXISTE
//
// O webhook ja grava entregue_em e lida_em. A tela ou fingia tique azul (lido
// que a Meta nao confirmou) ou nao mostrava nada. Recibo nao se inventa: sem
// campo no banco, a palavra nao aparece.
//
// OS DOIS LADOS
//
//   1. entregue sem lida escreve "entregue", nao "lida"
//   2. lida escreve "lida"
//   3. nenhum campo: nao inventa palavra
//   4. falha escreve "nao chegou"
//   5. a tela usa essa funcao, e nao tique azul
//
// Roda com: node testes/o-recibo-nao-se-inventa-na-tela.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-recibo.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { rotuloDoRecibo } from '../lib/whatsapp/recibo.ts';",
    "",
    "console.log(JSON.stringify({",
    "  entregue: rotuloDoRecibo({ entregue: true, lidaWpp: false }),",
    "  lida: rotuloDoRecibo({ entregue: true, lidaWpp: true }),",
    "  nada: rotuloDoRecibo({}),",
    "  falha: rotuloDoRecibo({ falhaEnvio: 'janela fechada', entregue: true, lidaWpp: true }),",
    "  soEntregueNulo: rotuloDoRecibo({ entregue: false, lidaWpp: false }),",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-recibo.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

const falhas = [];
const cobra = (rotulo, ok, detalhe) => {
  if (ok) {
    console.log("ok    " + rotulo);
    return;
  }
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo);
  if (detalhe) console.log("        " + detalhe);
};

cobra("entregue sem lida e entregue", r.entregue === "entregue", JSON.stringify(r.entregue));
cobra("lida e lida, nao tique azul", r.lida === "lida", JSON.stringify(r.lida));
cobra("sem campo no banco nao inventa recibo", r.nada === null, JSON.stringify(r.nada));
cobra("falha e nao chegou, mesmo se vier entregue junto", r.falha === "nao chegou", JSON.stringify(r.falha));
cobra("false no campo tambem nao inventa", r.soEntregueNulo === null, JSON.stringify(r.soEntregueNulo));

const semComentario = (rel) =>
  fs
    .readFileSync(path.join(raiz, rel), "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
    .join("\n");

const tela = semComentario("components/Atendimentos.tsx");
const banco = semComentario("lib/banco/atendimentos.ts");

if (!/rotuloDoRecibo\(/.test(tela)) {
  falhas.push("a tela do WhatsApp parou de usar o rotulo do recibo");
  console.log("ERRO  Atendimentos.tsx nao chama rotuloDoRecibo");
} else {
  console.log("ok    a tela mostra o rotulo que sai do banco");
}

if (/text-sky-800/.test(tela)) {
  falhas.push("a tela voltou a pintar tique azul, que a Meta nao confirmou nesta tela");
  console.log("ERRO  tique azul de novo em Atendimentos.tsx");
} else {
  console.log("ok    nao ha tique azul inventado");
}

if (!/entregue_em is not null/.test(banco) || !/lida_em is not null/.test(banco)) {
  falhas.push("a lista de conversas parou de ler entregue_em/lida_em");
  console.log("ERRO  atendimentos.ts nao le os campos do recibo no banco");
} else {
  console.log("ok    a lista le entregue_em e lida_em, e nao inventa");
}

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
