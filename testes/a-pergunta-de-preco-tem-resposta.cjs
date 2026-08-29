// A PERGUNTA DE PRECO TEM RESPOSTA, E ELA SAI DO CARDAPIO.
//
// POR QUE ISTO EXISTE
//
// "Quanto e o cento de salgado?" e a pergunta mais feita da padaria. Quem
// responde e o codigo, com o dado da casa, porque preco dito pela IA ja saiu
// errado: ela chegou a responder "R$ 44,90 o quilo" pra uma torta de R$ 36,90.
//
// So que responder SO algumas familias e quase tao ruim quanto responder
// errado: o cliente pergunta e a padaria cai na saudacao, como se nao tivesse
// ouvido.
//
// O comentario do arquivo prometia que "a familia que a dona cadastrar amanha
// ja e respondida sozinha". Nao era: a busca passava por uma lista de nomes de
// familia com cinco entradas. Medido em 28/08/2026, perguntando o preco de cada
// palavra de familia e de produto do catalogo:
//
//     36 das 43 palavras nao tinham resposta nenhuma
//
//     "quanto e a cuca?"      ->  nada
//     "quanto e o cupcake?"   ->  nada
//     "quanto e a coxinha?"   ->  nada
//
// E o galho do salgado era o unico do arquivo que ainda lia o `catalogo.json`
// cru, num lugar onde o docinho, o bolo e o resto ja perguntavam pra lista
// unica.
//
// O QUE ELE COBRA
//
//   1. toda palavra de familia, grupo e produto da casa tem resposta de preco
//   2. o que a casa NAO vende continua sem resposta (melhor calar que chutar)
//   3. o numero da resposta e o numero do cardapio, centavo por centavo
//
// A terceira e a que impede o conserto de virar defeito: responder mais nao
// pode significar responder diferente do que a casa cobra.
//
// Roda com: node testes/a-pergunta-de-preco-tem-resposta.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-preco.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { produtosDaCasa, gruposDaCasa } from '../lib/ia/dados/produtos.ts';",
    "import { respostaDeInformacao } from '../lib/ia/fluxo/informacao.ts';",
    "",
    "const preco = (familia) => respostaDeInformacao({ sobre: 'preco', familia });",
    "",
    "// 1. as palavras que o cliente usa: o nome do produto, o nome curto, e o",
    "// grupo. Pedaco de nome de grupo ('festa', 'caseiro', 'fria') fica de fora:",
    "// ninguem pergunta 'quanto e a festa?'.",
    "const alvos = new Set();",
    "for (const p of produtosDaCasa()) {",
    "  alvos.add(p.nome.split(' ')[0].toLowerCase());",
    "  alvos.add(p.nomeCurto.toLowerCase());",
    "  alvos.add(p.nome.toLowerCase());",
    "}",
    "for (const g of gruposDaCasa()) alvos.add(g.split(/[-_]/)[0].toLowerCase());",
    "const semResposta = [...alvos].filter((a) => a.length >= 4 && !preco(a));",
    "",
    "// 2. o que a casa nao vende nao pode ganhar preco",
    "const FORA = ['xilofone', 'sushi', 'churrasco', 'lasanha', 'hamburguer'];",
    "const inventou = FORA.filter((x) => preco(x));",
    "",
    "// 3. o numero da resposta e o do cardapio",
    "//",
    "// Pra cada produto, o preco dele tem que aparecer escrito na resposta da",
    "// familia dele. E o que impede 'responder mais' de virar 'responder outro",
    "// numero'.",
    "const brl = (n) => 'R$ ' + n.toFixed(2).replace('.', ',');",
    "const numeroErrado = [];",
    "",
    "// O NOME QUE SERVE A DUAS FAMILIAS NAO TEM RESPOSTA UNICA, E ISSO E REGRA",
    "// DA CASA, NAO DEFEITO.",
    "//",
    "// \"brigadeiro\" e docinho de R$ 1,25 E sabor de bolo de R$ 46,90 o quilo. A",
    "// palavra sozinha quer dizer o docinho, que e o mesmo desempate que",
    "// `identificarProduto` usa no sistema inteiro. Cobrar o preco do bolo aqui",
    "// seria cobrar o contrario do que a casa decidiu.",
    "const familiasDoNome = (curto) => new Set(produtosDaCasa()",
    "  .filter((x) => x.nomeCurto.toLowerCase() === curto)",
    "  .map((x) => x.grupo)).size;",
    "",
    "for (const p of produtosDaCasa()) {",
    "  if (familiasDoNome(p.nomeCurto.toLowerCase()) > 1) continue;",
    "  const r = preco(p.nomeCurto.toLowerCase());",
    "  if (!r) continue;",
    "  // A resposta pode ser uma FAIXA: basta o preco dele estar dentro dela.",
    "  const numeros = [...r.texto.matchAll(/R\\$\\s*([0-9]+),([0-9]{2})/g)]",
    "    .map((m) => Number(m[1]) + Number(m[2]) / 100);",
    "  if (!numeros.length) { numeroErrado.push(p.nome + ': resposta sem numero'); continue; }",
    "  const dentro = numeros.some((n) => Math.abs(n - p.preco) < 0.005) ||",
    "    (Math.min(...numeros) <= p.preco && p.preco <= Math.max(...numeros));",
    "  if (!dentro) {",
    "    numeroErrado.push(p.nome + ' custa ' + brl(p.preco) + ' e a resposta diz ' +",
    "      numeros.map(brl).join(', '));",
    "  }",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  alvos: alvos.size, produtos: produtosDaCasa().length,",
    "  semResposta, inventou, numeroErrado,",
    "  redonda: preco('pizza redonda')?.texto ?? null,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-preco.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Palavras de preco testadas: " + r.alvos + " | produtos: " + r.produtos);
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

cobra("o cliente perguntou o preco e a padaria nao respondeu", r.semResposta);
cobra("a padaria deu preco do que ela nao vende", r.inventou);
cobra("o numero da resposta nao e o do cardapio", r.numeroErrado);
if (!r.redonda || !/35/.test(r.redonda) || !/45/.test(r.redonda)) {
  falhas.push("redonda");
  console.log("ERRO  pizza redonda nao fala a faixa que costuma sair: " + r.redonda);
  console.log("");
}

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    toda familia da casa tem preco, com o numero do cardapio");
console.log("");
console.log("PASSOU");
