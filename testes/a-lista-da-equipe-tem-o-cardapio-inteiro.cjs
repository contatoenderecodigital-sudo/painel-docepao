// A LISTA QUE A EQUIPE ESCOLHE TEM O CARDAPIO INTEIRO.
//
// POR QUE ISTO EXISTE
//
// Quando a equipe corrige um pedido na tela, ela escolhe o produto numa lista em
// vez de digitar. Digitar erra o nome, e nome errado nao casa com a tabela de
// preco: o item entra sem valor e o pedido fecha menor do que o combinado.
//
// Essa lista e montada percorrendo o `catalogo.json` A MAO, ramo por ramo
// (`salgados.frito`, `doces`, `bolos_recheados.faixas`, `bolos_caseiros`,
// `outros_produtos`, e a pizza a parte). Entao ela pode divergir do cardapio de
// um jeito silencioso: a dona cadastra um produto num ramo que a montagem nao
// percorre, e ele simplesmente nao aparece pra equipe escolher.
//
// E o mesmo defeito que a primeira pergunta desta leitura ja pegou onze vezes:
// "essa lista e minha, ou e do cardapio?".
//
// A LICAO QUE FEZ ESTE TESTE NASCER
//
// A montagem morava dentro do route handler e nao era exportada, entao pra medir
// eu RECONSTRUI ela numa sonda. Errei as chaves do catalogo (usei `docinhos` e
// `outros`; o catalogo tem `doces` e `outros_produtos`) e quase reportei que 65
// produtos da casa nao apareciam pra equipe.
//
// Nao faltava nenhum: sao 86 dos dois lados. O que me salvou foi ler a funcao
// inteira antes de afirmar.
//
// Reconstruir o codigo pra medir e medir a reconstrucao. Por isso a montagem
// saiu pra `lib/cardapio-opcoes.ts`, e este teste importa A LISTA DE VERDADE.
//
// O QUE ELE COBRA
//
//   1. todo produto do cardapio esta na lista da equipe
//   2. a lista nao inventa produto que a casa nao vende
//   3. todo item da lista tem unidade valida e categoria
//   4. os sabores vem do cardapio: docinho e bolo de festa nao ficam sem
//
// Roda com: node testes/a-lista-da-equipe-tem-o-cardapio-inteiro.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-lista-equipe.mjs");

const SONDA = [
  "import { OPCOES } from '../lib/cardapio-opcoes.ts';",
  "import { produtosDaCasa } from '../lib/ia/dados/produtos.ts';",
  "",
  "const daLista = new Map(OPCOES.map((o) => [String(o.nome).toLowerCase(), o]));",
  "const daCasa = new Map(produtosDaCasa().map((p) => [p.nome.toLowerCase(), p]));",
  "",
  "// 1 e 2. os dois lados tem que ter os mesmos produtos",
  "const faltando = [...daCasa.keys()].filter((n) => !daLista.has(n));",
  "const sobrando = [...daLista.keys()].filter((n) => !daCasa.has(n));",
  "",
  "// 3. cada item da lista serve pra escolher: precisa de unidade e categoria",
  "const malFormados = [];",
  "for (const o of OPCOES) {",
  "  if (!o.nome || typeof o.nome !== 'string') malFormados.push('item sem nome');",
  "  else if (o.unidade !== 'un' && o.unidade !== 'kg') malFormados.push(o.nome + ': unidade ' + JSON.stringify(o.unidade));",
  "  else if (!o.categoria) malFormados.push(o.nome + ': sem categoria');",
  "  else if (!Array.isArray(o.sabores)) malFormados.push(o.nome + ': sabores nao e lista');",
  "}",
  "",
  "// 4. o sabor e metade da escolha: sem ele a equipe digita na mao de novo.",
  "//",
  "// Cobra por FAMILIA, e nao produto a produto: quem tem sabor no cardapio tem",
  "// que ter sabor aqui. A conta sai da propria lista unica, entao cadastrar",
  "// sabor novo passa a valer sozinho.",
  "const semSabor = [];",
  "for (const p of produtosDaCasa()) {",
  "  if (!(p.sabores && p.sabores.length)) continue;",
  "  const o = daLista.get(p.nome.toLowerCase());",
  "  if (o && o.sabores.length === 0) semSabor.push(p.nome + ' tem ' + p.sabores.length + ' sabores no cardapio e nenhum na lista');",
  "}",
  "",
  "console.log(JSON.stringify({",
  "  naLista: daLista.size, noCardapio: daCasa.size,",
  "  faltando, sobrando, malFormados, semSabor,",
  "}));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-lista-equipe.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Na lista da equipe: " + r.naLista + " | no cardapio: " + r.noCardapio);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista.slice(0, 15)) console.log("        " + l);
  if (lista.length > 15) console.log("        ... e mais " + (lista.length - 15));
  console.log("");
};

cobra("produto do cardapio que a equipe nao consegue escolher", r.faltando);
cobra("a lista oferece produto que a casa nao vende", r.sobrando);
cobra("item da lista sem unidade ou sem categoria", r.malFormados);
cobra("produto com sabor no cardapio e sem sabor na lista", r.semSabor);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    a equipe escolhe do cardapio inteiro, com os sabores");
console.log("");
console.log("PASSOU");
