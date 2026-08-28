// O NOME QUE O CLIENTE FALA ALCANCA O PRODUTO. OS 86.
//
// POR QUE ISTO EXISTE
//
// O cliente nao fala o nome do cardapio. Ele fala o nome curto: "churros",
// "coxinha", "cenoura". Quem traduz isso pro nome do sistema e
// `identificarProduto`, e ele monta os candidatos a partir do nome do catalogo.
//
// Onze dos doze docinhos se chamam pelo sabor puro ("brigadeiro", "cafe"). UM
// se chama "docinho de churros". Essa palavra a mais tinha preco:
//
//     "churros" na etapa do docinho  ->  bolo caseiro churros, R$ 34,90
//     o certo                        ->  docinho de churros,   R$  1,75
//
// Vinte vezes, num item que a festa pede em dezenas. A palavra "churros"
// sozinha nao alcancava o docinho, entao o unico candidato que sobrava era o
// bolo caseiro e nao havia sequer ambiguidade pra etapa desempatar.
//
// O "cafe" nao sofria disso porque o docinho dele se chama so "cafe": os dois
// candidatos existem, a escolha fica ambigua, e a ETAPA desempata. Era esse
// desempate que o nome comprido impedia de acontecer.
//
// POR QUE E DE CLASSE, E NAO DO CHURROS
//
// Consertar o churros e trocar uma palavra. Nao resolve nada: no dia em que a
// dona cadastrar "docinho de maracuja" na tela, o defeito volta inteiro e
// ninguem vai lembrar deste comentario.
//
// Entao a cobranca aqui e sobre a CLASSE: pra todo produto da casa, o nome
// curto tem que chegar nele quando a conversa esta na familia dele. Quem
// cadastrar um nome comprido amanha quebra este teste hoje.
//
// Roda com: node testes/o-nome-curto-alcanca-o-produto.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-nome-curto.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { produtosDaCasa } from '../lib/ia/dados/produtos.ts';",
    "import { identificarProduto } from '../lib/ia/fluxo/produto.ts';",
    "",
    "// O prefixo de familia que o cliente nao fala. Mesma lista que o",
    "// resolvedor usa pra registrar o nome curto.",
    "const PREFIXO = /^(docinho|salgado|doce|torta|mini) (de|da|do) +/;",
    "",
    "const naoAlcanca = [];",
    "const conferidos = [];",
    "for (const p of produtosDaCasa()) {",
    "  const curto = p.nome.replace(PREFIXO, '');",
    "  if (curto === p.nome) continue;   // ja e curto, nada a provar",
    "  conferidos.push(p.nome);",
    "  const achou = identificarProduto(curto, p.categoria);",
    "  if (achou.produto !== p.nome) {",
    "    naoAlcanca.push(curto + ' [' + p.categoria + '] -> ' + achou.produto + ', esperado ' + p.nome);",
    "  }",
    "}",
    "",
    "// E o contrario: o nome COMPLETO nao pode ter deixado de funcionar. Um",
    "// candidato novo com nome curto poderia ganhar do longo no desempate.",
    "//",
    "// O NOME VAI COM UM SUFIXO, E ISSO NAO E DETALHE.",
    "//",
    "// Perguntar so `p.nome` e comparar com `p.nome` era um teste que nao podia",
    "// falhar: quando NENHUM candidato casa, `identificarProduto` devolve o texto",
    "// cru, e o texto cru E o nome. Eco contava como acerto.",
    "//",
    "// Foi assim que a chave `pizza` do catalogo ficou meses sem candidato nenhum",
    "// e este teste passou verde o tempo todo. Medido em 28/08/2026:",
    "//",
    "//     'pizza meia de frango' -> produto 'pizza meia de frango', sem recheio",
    "//",
    "// Com o sufixo, so passa quem REALMENTE casou: separar o produto do resto e",
    "// coisa que o eco nao faz.",
    "const perdeuOLongo = [];",
    "for (const p of produtosDaCasa()) {",
    "  const achou = identificarProduto(p.nome + ' de teste', p.categoria);",
    "  if (achou.produto !== p.nome) {",
    "    perdeuOLongo.push(p.nome + ' [' + p.categoria + '] -> ' + achou.produto);",
    "  }",
    "}",
    "",
    "console.log(JSON.stringify({ total: produtosDaCasa().length, conferidos, naoAlcanca, perdeuOLongo }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-nome-curto.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

console.log("Produtos da casa: " + r.total);
console.log("Com prefixo de familia no nome: " + r.conferidos.length +
  (r.conferidos.length ? " (" + r.conferidos.join(", ") + ")" : ""));
console.log("");

const cobra = (rotulo, lista) => {
  if (lista.length) {
    falhas.push(rotulo);
    console.log("ERRO  " + rotulo + " (" + lista.length + ")");
    for (const x of lista) console.log("        " + x);
  } else {
    console.log("ok    " + rotulo);
  }
};

cobra("nome curto nao alcanca o produto", r.naoAlcanca);
cobra("nome completo deixou de funcionar", r.perdeuOLongo);

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
