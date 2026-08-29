// NOME DE FAMILIA NAO CHEGA NO PEDIDO COMO "OUTRO".
//
// O DEFEITO, MEDIDO CONTRA A PRODUCAO EM 29/08/2026
//
// Li a montagem de verdade no banco, e nao deduzi:
//
//     {"produto": "salgado assado", "categoria": "outro", "qtd": 200}
//
// "salgado assado" e NOME DE FAMILIA, e nao produto do cardapio. Quem da a
// categoria fora das etapas de familia e o catalogo, e o catalogo nao conhece
// nome de familia: devolvia `outro`.
//
// E `outro` desliga a etapa. `temCategoria(p, "salgado")` casa por
// `startsWith("salgado")`, entao com `outro` a etapa do salgado se considera
// fora do assunto e e PULADA. O log da producao mostra a conversa inteira
// passando por fora dela:
//
//     [fluxo-novo] etapa: abertura / proxima: quantas_pessoas
//     [fluxo-novo] etapa: dados / proxima: dados
//     [fluxo-novo] etapa: dados / proxima: confirmacao
//
// Ninguem perguntou quais salgados, e a cozinha recebeu uma linha de 200 sem
// produto nenhum. A tabela `FAMILIAS` sabia a resposta o tempo todo.
//
// O QUE ELE COBRA
//
//   1. familia de UMA categoria resolve: "salgado assado" -> salgado_assado
//   2. familia AMBIGUA nao chuta: "salgado" aponta pra frito e assado, e
//      escolher ali seria mandar a comanda pra bancada errada
//   3. produto de verdade continua mandando: o catalogo ganha da familia
//   4. o que nao e nem produto nem familia continua `outro`, que e honesto
//
// A 2 e a que impede o conserto de virar um defeito pior. A 3 impede que a
// familia atropele o cardapio.
//
// Roda com: node testes/nome-de-familia-nao-vira-outro.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-familia-outro.mjs");

const SONDA = [
  "import { categoriaDaEtapa } from '../lib/ia/fluxo/fluxo.ts';",
  "",
  "// CHAMA A FUNCAO DE VERDADE, e nao uma copia da regra dela.",
  "//",
  "// A primeira versao desta sonda refazia a conta aqui dentro, e por isso",
  "// ficou VERDE com o conserto desfeito no fluxo.ts: media a copia. Quarta vez",
  "// em dois dias que reconstruir pra medir vira medir a reconstrucao.",
  "//",
  "// `abertura` e de proposito: e uma etapa FORA das familias, que e o caminho",
  "// onde o defeito vivia.",
  "const comoOFluxoDecide = (nome) => categoriaDaEtapa('abertura', nome);",
  "",
  "const NOMES = [",
  "  'salgado assado', 'salgado frito', 'salgados assados',",
  "  'salgado', 'salgados',",
  "  'docinho', 'doce', 'bolo recheado', 'pizza',",
  "  'bolo',",
  "  'coxinha', 'esfirra', 'brigadeiro', 'bolo 4 leites',",
  "  'guarda-chuva', 'sei la o que',",
  "];",
  "",
  "const r = {};",
  "for (const n of NOMES) r[n] = comoOFluxoDecide(n);",
  "console.log(JSON.stringify(r));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");
let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-familia-outro.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Que categoria cada nome recebe:");
for (const [nome, cat] of Object.entries(r)) {
  console.log("  " + nome.padEnd(20) + " -> " + cat);
}

const falhas = [];

// 1. familia de uma categoria so RESOLVE, e a etapa da familia enxerga
const RESOLVEM = [
  ["salgado assado", "salgado_assado"],
  ["salgado frito", "salgado_frito"],
  ["salgados assados", "salgado_assado"],
  ["docinho", "docinho"],
  ["doce", "docinho"],
  ["bolo recheado", "bolo_festa"],
  ["pizza", "pizza"],
];
for (const [nome, esperado] of RESOLVEM) {
  if (r[nome] !== esperado) {
    falhas.push(
      JSON.stringify(nome) + " recebeu " + JSON.stringify(r[nome]) + " e devia ser " +
        JSON.stringify(esperado) + ". Com `outro` a etapa da familia e pulada, " +
        "ninguem pergunta qual, e a cozinha recebe a linha sem produto",
    );
  }
}

// 2. familia AMBIGUA nao chuta bancada
//
// So "salgado" e "salgados" entram aqui. "bolo" tambem aponta pra duas
// categorias na tabela FAMILIAS, mas o CATALOGO ja o resolve como `bolo_festa`
// por conta propria, desde antes deste conserto: `categoriaDoPedido("bolo")`
// devolve `bolo_festa` sem passar pela familia. A primeira versao deste teste
// cobrou "bolo" junto e reprovou codigo que estava certo; a expectativa e que
// estava errada. Aqui se cobra a MINHA regra, e nao a decisao antiga do
// catalogo, que tem motivo proprio escrito no `categoriaDaEtapa`.
for (const nome of ["salgado", "salgados"]) {
  if (/^salgado_|^bolo_/.test(String(r[nome] ?? ""))) {
    falhas.push(
      JSON.stringify(nome) + " virou " + JSON.stringify(r[nome]) + ": esse nome aponta " +
        "pra MAIS DE UMA categoria, e escolher aqui manda a comanda pra bancada errada",
    );
  }
}

// 3. produto de verdade continua mandando
const DO_CATALOGO = [
  ["coxinha", "salgado_frito"],
  ["esfirra", "salgado_assado"],
  ["brigadeiro", "docinho"],
];
for (const [nome, esperado] of DO_CATALOGO) {
  if (r[nome] !== esperado) {
    falhas.push(
      "o catalogo parou de mandar em " + JSON.stringify(nome) + ": veio " +
        JSON.stringify(r[nome]) + " em vez de " + JSON.stringify(esperado),
    );
  }
}

// 4. o que nao e nada continua `outro`
for (const nome of ["guarda-chuva", "sei la o que"]) {
  if (r[nome] !== "outro") {
    falhas.push(
      JSON.stringify(nome) + " virou " + JSON.stringify(r[nome]) + ": o que a casa nao " +
        "conhece tem que continuar `outro`, pra dona ver na tela e corrigir",
    );
  }
}

console.log("");
if (falhas.length) {
  console.log("ERRO  nome de familia chegando errado no pedido (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    nome de familia chega com familia, e o ambiguo nao chuta");
console.log("");
console.log("PASSOU");
