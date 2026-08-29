// SABOR EM ABERTO NAO PASSA, ESCREVA O CLIENTE COMO ESCREVER.
//
// POR QUE ISTO EXISTE
//
// Regra do dono, 23/08/2026: "nunca pode produto com sabor ser fechado sem
// sabor escolhido, tanto trufa, docinho, cuca, tudo; isso e geral da padaria".
// Comanda com "2 kg de empadao" sem dizer se e de frango ou de palmito para a
// cozinha no meio da manha, e alguem tem que ligar pro cliente.
//
// A trava existe. O que ela nao tinha era alcance, e foram dois buracos, os
// dois medidos em 28/08/2026:
//
//   1. O APELIDO NAO CHEGAVA NELA
//
//      saborQueFalta("risolis")  ->  pergunta o sabor
//      saborQueFalta("risoles")  ->  NAO PERGUNTA
//      saborQueFalta("esfiha")   ->  NAO PERGUNTA
//
//      A busca comparava letra por letra com o nome do cardapio. "risoles" e
//      "esfiha" sao apelidos que a casa mantem em `apelidos.ts` justamente
//      porque e assim que o cliente escreve. Item que entrasse no pedido com
//      esse nome atravessava a trava do fechamento em silencio.
//
//   2. O SABOR NEGADO CONTAVA COMO ESCOLHIDO
//
//      esfirra, obs "sem carne"  ->  achava que ele ja tinha escolhido
//
//      A conferida era so "a palavra esta na linha?". A padaria parava de
//      perguntar e a comanda ia pra cozinha com uma esfirra sem recheio
//      nenhum, carregando "sem carne" no recado.
//
// O QUE ELE COBRA
//
// Pra TODO produto do catalogo que pede escolha, e em todos os jeitos de
// escrever o nome dele (o do cardapio e os apelidos da casa):
//
//   sem sabor          tem que perguntar
//   com o sabor        nao pode perguntar
//   negando o sabor    tem que perguntar
//
// A lista de produtos e de apelidos sai do catalogo. Produto novo que a dona
// cadastrar com lista de sabor passa a ser cobrado aqui sozinho.
//
// Roda com: node testes/o-sabor-em-aberto-nao-passa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-sabor-aberto.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { produtosDaCasa } from '../lib/ia/dados/produtos.ts';",
    "import { APELIDOS } from '../lib/ia/dados/apelidos.ts';",
    "import { saborQueFalta } from '../lib/ia/fluxo/sabor.ts';",
    "",
    "const pedemEscolha = produtosDaCasa().filter((p) => !p.saborFixo && p.sabores.length > 0);",
    "",
    "const naoPerguntou = [], perguntouAtoa = [], negadoPassou = [];",
    "let medidos = 0;",
    "",
    "for (const p of pedemEscolha) {",
    "  // Todo jeito de escrever ESTE produto: o nome do cardapio e os apelidos.",
    "  const jeitos = [p.nome, ...(APELIDOS[p.nome] ?? [])];",
    "  const sabor = p.sabores[0];",
    "  for (const jeito of jeitos) {",
    "    medidos++;",
    "    // 1. sem sabor nenhum: TEM que perguntar",
    "    if (!saborQueFalta(jeito, null)) naoPerguntou.push(jeito + ' [' + p.nome + ']');",
    "    // 2. com o sabor escolhido: NAO pode perguntar de novo",
    "    if (saborQueFalta(jeito, sabor)) perguntouAtoa.push(jeito + ' + ' + sabor);",
    "    // 4. sabor fora da lista, ja anotado pra equipe: NAO pergunta de novo",
    "    if (saborQueFalta(jeito, 'pistache (sabor a confirmar)')) perguntouAtoa.push(jeito + ' + sabor a confirmar');",
    "    // 3. negando o sabor: nao escolheu nada, TEM que perguntar",
    "    for (const negacao of ['sem ' + sabor, 'nao quero ' + sabor]) {",
    "      if (!saborQueFalta(jeito, negacao)) negadoPassou.push(jeito + ' + \"' + negacao + '\"');",
    "    }",
    "  }",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  produtos: pedemEscolha.length, medidos, naoPerguntou, perguntouAtoa, negadoPassou,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-sabor-aberto.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Produtos que pedem escolha: " + r.produtos);
console.log("Jeitos de escrever medidos: " + r.medidos);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista.slice(0, 20)) console.log("        " + l);
  if (lista.length > 20) console.log("        ... e mais " + (lista.length - 20));
  console.log("");
};

cobra("produto sem sabor escolhido passou sem ninguem perguntar", r.naoPerguntou);
cobra("o sabor ja estava escolhido e a padaria perguntou de novo", r.perguntouAtoa);
cobra("o cliente NEGOU o sabor e o sistema achou que ele escolheu", r.negadoPassou);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    nenhum sabor em aberto atravessa a trava");
console.log("");
console.log("PASSOU");
