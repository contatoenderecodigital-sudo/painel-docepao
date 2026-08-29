// A CATEGORIA FALA UMA LINGUA SO, DO MOTOR ATE A COMANDA.
//
// POR QUE ISTO EXISTE
//
// O sistema tinha DOIS vocabularios pro mesmo conceito:
//
//     o orcamento dizia   salgado · doce · bolo_recheado
//     o pedido dizia      salgado_frito · salgado_assado · docinho · bolo_festa
//
// E uma tabela de traducao costurava os dois, no `orcamento.ts`. Enquanto
// existirem duas linguas, toda regra nova precisa saber as duas, e o dia em que
// alguem souber so uma o defeito e MUDO: o pedido fecha bonito e a comanda sai
// na bancada errada.
//
// Nao e teoria. Em 29/08/2026 essa doenca mordeu uma camada acima: "salgado
// assado" chegava no pedido como `outro`, a etapa do salgado se considerava
// fora do assunto, ninguem perguntava quais, e a cozinha recebia 200 de nada.
//
// O QUE A UNIFICACAO GANHOU, ALEM DE UM NOME SO
//
// O motor dizia `salgado` pros dois: frito e assado, a distincao existia so no
// NOME do produto. Agora ela existe na categoria, que e o que decide a bancada.
//
//     salgado -> salgado_assado   10 produtos
//     salgado -> salgado_frito     9 produtos
//
// O QUE ELE COBRA
//
//   1. o motor nao volta a ter tabela de traducao de categoria
//   2. nenhum produto do motor sai com uma categoria do vocabulario velho
//   3. a categoria do motor e A MESMA da lista unica, produto por produto
//   4. a comanda continua entendendo o vocabulario VELHO
//
// A 4 e a que parece contraditoria e nao e: o banco esta cheio de pedidos
// gravados com `bolo_recheado`, e pedido velho tem que continuar saindo na
// bancada certa. Unificar o que se escreve DAQUI PRA FRENTE nao reescreve o
// passado, e o `departamentos.ts` diz isso com todas as letras.
//
// Roda com: node testes/a-categoria-fala-uma-lingua-so.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-categoria-lingua.mjs");

const falhas = [];

// -----------------------------------------------------------------------------
// 1. A tabela de traducao nao volta.
// -----------------------------------------------------------------------------
const semComentario = (rel) =>
  fs
    .readFileSync(path.join(raiz, rel), "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
    .join("\n");

const motor = semComentario("lib/ia/orcamento.ts");
if (/CATEGORIA_NO_ORCAMENTO/.test(motor)) {
  falhas.push(
    "o `orcamento.ts` voltou a ter tabela de traducao de categoria: sao duas " +
      "linguas de novo, e toda regra nova passa a precisar saber as duas",
  );
}

// -----------------------------------------------------------------------------
// 2 e 3. O que o motor REALMENTE devolve, comparado com a lista unica.
//
// Chama as duas funcoes de verdade. Refazer a conta aqui dentro seria medir a
// minha copia, que ja me custou um teste verde com o conserto desfeito.
// -----------------------------------------------------------------------------
const SONDA = [
  "import { motorPadrao } from '../lib/ia/orcamento.ts';",
  "import { produtosDaCasa } from '../lib/ia/dados/produtos.ts';",
  "",
  "// A categoria que o motor guarda pra cada nome. `cotarPorItens` devolve a",
  "// linha cotada, que e onde a categoria aparece pra quem consome o motor.",
  "const doMotor = {};",
  "for (const p of produtosDaCasa()) {",
  "  const c = motorPadrao.cotarPorItens([{ item: p.nome, qtd: 1 }]);",
  "  const linha = (c.linhas ?? [])[0];",
  "  if (linha) doMotor[p.nome] = String(linha.categoria ?? '');",
  "}",
  "",
  "const daLista = {};",
  "for (const p of produtosDaCasa()) daLista[p.nome] = String(p.categoria ?? '');",
  "",
  "console.log(JSON.stringify({ doMotor, daLista }));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");
let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-categoria-lingua.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const { doMotor, daLista } = JSON.parse(bruto.trim().split("\n").pop());

// O vocabulario velho, que nao pode mais SAIR de lugar nenhum.
const VELHO = new Set(["salgado", "doce", "bolo_recheado"]);
const divergem = [];
let conferidos = 0;

for (const [nome, cat] of Object.entries(doMotor)) {
  conferidos++;
  if (VELHO.has(cat)) {
    falhas.push(
      "o motor cotou " + JSON.stringify(nome) + " com a categoria VELHA " +
        JSON.stringify(cat) + ": o vocabulario se dividiu de novo",
    );
  }
  if (daLista[nome] !== undefined && daLista[nome] !== cat) {
    divergem.push(nome + ": motor diz " + JSON.stringify(cat) + ", lista unica diz " + JSON.stringify(daLista[nome]));
  }
}

console.log("Produtos conferidos nos dois lados: " + conferidos);

if (divergem.length) {
  falhas.push(
    "o motor e a lista unica discordam da categoria de " + divergem.length + " produto(s). " +
      "Quem decide a bancada e a categoria, entao isso e comanda na sala errada:",
  );
  for (const d of divergem.slice(0, 8)) falhas.push("    " + d);
}

// -----------------------------------------------------------------------------
// 4. A comanda continua entendendo o vocabulario velho, por causa do banco.
// -----------------------------------------------------------------------------
const comanda = semComentario("lib/departamentos.ts");
if (!/bolo_recheado/.test(comanda)) {
  falhas.push(
    "o `departamentos.ts` deixou de conhecer `bolo_recheado`: o banco esta cheio " +
      "de pedidos gravados com o vocabulario velho, e eles passariam a sair na " +
      "bancada errada. Unificar o que se escreve daqui pra frente nao reescreve o passado",
  );
}

console.log("");
if (falhas.length) {
  console.log("ERRO  a categoria voltou a falar duas linguas (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    do motor ate a comanda, a categoria e uma so");
console.log("");
console.log("PASSOU");
