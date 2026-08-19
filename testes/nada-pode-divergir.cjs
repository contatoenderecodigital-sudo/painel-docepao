// NADA PODE DIVERGIR: CATALOGO, IA E COMANDA FALANDO A MESMA COISA.
//
// Todo erro caro deste projeto foi a mesma doenca: o mesmo fato escrito em dois
// lugares, e um deles ficando pra tras.
//
//   - o prompt dizia chodo "de calabresa"; o catalogo dizia presunto e queijo.
//     A IA oferecia e o proprio codigo recusava depois.
//   - o prompt oferecia bolo salgado de calabresa; a casa faz frango, presunto
//     ou legumes.
//   - a comanda da impressora tinha PIZZA separada; a tela juntava com salgados.
//   - o cupom vivia na maquina da padaria e ficou uma versao atras do painel.
//
// Nenhuma dessas aparecia em teste, porque ninguem testa texto. Este teste
// existe pra quebrar quando alguem escrever um sabor que a casa nao faz, ou
// esquecer um produto do lado de fora das comandas.
//
// Roda com: node testes/nada-pode-divergir.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const pasta = mkdtempSync(join(tmpdir(), "divergir-"));
execFileSync(
  "npx",
  ["tsc", "lib/ia/catalogo-em-texto.ts", "lib/departamentos.ts", "lib/tipos.ts",
   "--outDir", pasta, "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule"],
  { stdio: "pipe", shell: true },
);
const { catalogoEmTexto, coresDaForminha } = require(join(pasta, "ia", "catalogo-em-texto.js"));
const { deptoDe, DEPARTAMENTOS } = require(join(pasta, "departamentos.js"));
const catalogo = require("../lib/ia/dados/catalogo.json");

let erros = 0;
function conferir(ok, oque) {
  console.log((ok ? "ok    " : "ERRO  ") + oque);
  if (!ok) erros++;
}

const semAcento = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------------------------------------------------------------------------
// 1. O PROMPT NAO PODE INVENTAR SABOR.
//
// Junta todo sabor que existe no catalogo e procura, no texto do prompt, a
// combinacao "produto de sabor" que nao exista. E o erro do chodo de calabresa.
// ---------------------------------------------------------------------------
console.log("== o prompt so fala do que existe ==");
const persona = readFileSync("lib/ia/persona.ts", "utf8");

// Frases que ja nos custaram venda ou contradicao, uma por linha.
const proibidas = [
  ['"Chodó" é o de calabresa', "chodó de calabresa (a casa faz presunto e queijo)"],
  ["bolo salgado (frango, calabresa", "bolo salgado de calabresa (a casa faz frango, presunto ou legumes)"],
  ["o empadão com palmito é mais caro e só de palmito", "empadão com palmito só de palmito (existe frango com palmito)"],
  // "pizza de metro" pode e deve aparecer, mas so como APELIDO que ela entende.
  // O que nao pode e virar produto oferecido: a casa faz de forma 60x40 e
  // redonda de 30 cm.
  ["docinho, bolo, pizza de metro", "pizza de metro na lista do que a casa oferece"],
];
for (const [frase, oque] of proibidas) {
  conferir(!persona.includes(frase), "o prompt nao diz: " + oque);
}

// A lista de produtos no prompt tem que ser a GERADA, nao escrita a mao.
// O apelido da regiao tem que estar ensinado: quem pede 'duas pizzas de
// metro' esta pedindo a de forma, e sem isso a Dora trata como produto que
// nao existe.
conferir(/pizza de metro/i.test(persona), "a Dora entende 'pizza de metro', que e como a regiao chama a de forma");

conferir(
  persona.includes("${catalogoEmTexto()}"),
  "a lista de produtos do prompt vem do catalogo, nao escrita a mao",
);
conferir(
  persona.includes("${coresDaForminha()}"),
  "as cores da forminha vem do catalogo",
);

// ---------------------------------------------------------------------------
// 2. O TEXTO GERADO TEM QUE TRAZER TODO PRODUTO DO CATALOGO.
//
// Produto que existe na tabela de preco e nao aparece pra IA e produto que ela
// nunca vai oferecer: dinheiro parado.
// ---------------------------------------------------------------------------
console.log("");
console.log("== todo produto do catalogo chega na IA ==");
const texto = semAcento(catalogoEmTexto());
const todos = [
  ...catalogo.salgados.frito.itens.map((i) => i.nome),
  ...catalogo.salgados.assado.itens.map((i) => i.nome),
  ...catalogo.doces.itens.map((i) => i.nome),
  ...catalogo.bolos_caseiros.itens.map((i) => i.nome),
  ...catalogo.outros_produtos.map((i) => i.nome),
];
const faltando = todos.filter((n) => !texto.includes(semAcento(n)));
conferir(faltando.length === 0, "nenhum produto fica de fora" + (faltando.length ? ": " + faltando.join(", ") : ""));

const sabores = [
  ...catalogo.bolos_recheados.faixas.flatMap((f) => f.sabores),
  ...catalogo.pizza.sabores_salgados,
  ...catalogo.pizza.sabores_doces,
];
const saborFaltando = sabores.filter((n) => !texto.includes(semAcento(n)));
conferir(saborFaltando.length === 0, "nenhum sabor de bolo ou pizza fica de fora" + (saborFaltando.length ? ": " + saborFaltando.join(", ") : ""));

conferir(coresDaForminha().split(",").length === catalogo.forminhas_docinho.cores.length, "todas as cores de forminha chegam na IA");

// ---------------------------------------------------------------------------
// 3. TODO PRODUTO TEM UMA COMANDA, E E A CERTA.
//
// Produto sem comanda cai numa generica e a cozinha nao acha. Foi o que
// aconteceu com o "EXTRAS" impresso de verdade na padaria.
// ---------------------------------------------------------------------------
console.log("");
console.log("== todo produto tem a comanda dele ==");
const esperado = {
  torta_fria: "torta_fria",
  empadao: "empadao",
  torta_recheada: "torta_doce",
  bolo_salgado: "bolo_salgado",
  calzone: "calzone",
  pizza: "pizza",
  cupcake: "cupcake",
  franciscano: "franciscano",
  padaria: "padaria",
  por_unidade: null, // decidido pelo nome
  por_quilo: null,
};
let semComanda = [];
let comandaErrada = [];
for (const p of catalogo.outros_produtos) {
  const deu = deptoDe({ produto: p.nome, categoria: p.categoria });
  if (!DEPARTAMENTOS.some((d) => d.id === deu)) semComanda.push(p.nome);
  const alvo = esperado[p.categoria];
  if (alvo && deu !== alvo) comandaErrada.push(`${p.nome} (${p.categoria}) foi pra ${deu}, esperado ${alvo}`);
}
conferir(semComanda.length === 0, "nenhum produto fica sem comanda" + (semComanda.length ? ": " + semComanda.join(", ") : ""));
conferir(comandaErrada.length === 0, "nenhum produto vai pra comanda errada" + (comandaErrada.length ? ": " + comandaErrada.join("; ") : ""));

// Salgado e docinho, que sao o grosso do movimento.
for (const i of catalogo.salgados.frito.itens.concat(catalogo.salgados.assado.itens)) {
  const deu = deptoDe({ produto: i.nome, categoria: "salgado" });
  if (deu !== "salgados") comandaErrada.push(`${i.nome} foi pra ${deu}`);
}
conferir(comandaErrada.length === 0, "todo salgado vai pra comanda de salgados");

for (const i of catalogo.doces.itens) {
  const deu = deptoDe({ produto: i.nome, categoria: "doce" });
  if (deu !== "docinhos") comandaErrada.push(`${i.nome} foi pra ${deu}`);
}
conferir(comandaErrada.length === 0, "todo docinho vai pra comanda de docinhos");

// ---------------------------------------------------------------------------
// 4. QUEM E POR QUILO NO CATALOGO E POR QUILO NO PAPEL.
//
// O bolo de 3 kg ja saiu como "3x BOLO" e a cozinha assou tres bolos.
// ---------------------------------------------------------------------------
console.log("");
console.log("== peso e peso nos dois lados ==");
const { unidadeDoItem } = require(join(pasta, "departamentos.js"));
const unidadeErrada = [];
for (const p of catalogo.outros_produtos) {
  if (p.unidade !== "kg") continue;
  const deu = unidadeDoItem({ produto: p.nome, categoria: p.categoria, qtd: 2, unidade: null });
  if (deu !== "kg") unidadeErrada.push(`${p.nome} (${p.categoria}) saiu como ${deu}`);
}
conferir(unidadeErrada.length === 0, "produto por quilo no catalogo sai como kg no papel" + (unidadeErrada.length ? ": " + unidadeErrada.join("; ") : ""));

console.log("");
console.log(erros === 0 ? "TODOS OS CASOS PASSARAM" : erros + " CASO(S) FALHARAM");
process.exit(erros === 0 ? 0 : 1);
