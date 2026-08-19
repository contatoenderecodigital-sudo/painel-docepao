// ELA NAO PODE FALAR PRECO QUE A PADARIA NAO COBRA, NEM ENDERECO QUE NAO E O DELA.
//
// Os dois defeitos sairam do teste com clientes ao vivo, em 19/08/2026:
//
//   "Ela custa R$ 70 o quilo"     torta doce custa R$ 33,90
//   "Cada quilo custa R$ 50,00"   cuca custa R$ 22,90
//   "Rua XV de Novembro, 123"     a padaria fica na Rua Independencia 855
//
// Num dos casos ela montou o total inteiro em cima do preco falso e so admitiu
// quando o cliente conferiu linha por linha. No outro, uma senhora de 68 anos
// ia buscar o bolo no endereco errado.
//
// O teste roda o codigo REAL do cerebro, extraido do arquivo, e nao uma copia
// digitada aqui que poderia divergir sem ninguem notar.
//
// Roda com: node testes/nao-inventa-preco.cjs
const fs = require("fs");
const catalogo = require("../lib/ia/dados/catalogo.json");
const fonte = fs.readFileSync("lib/ia/cerebro.ts", "utf8");

function extrair(assinatura, ate) {
  const ini = fonte.indexOf(assinatura);
  const fim = fonte.indexOf(ate, ini);
  if (ini < 0 || fim < 0) throw new Error("nao achei no arquivo: " + assinatura);
  return fonte.slice(ini, fim);
}

// Tira as anotacoes de tipo pra rodar como JavaScript puro. Generico de
// proposito: lista de casos especiais quebra toda vez que o codigo muda.
const semTipos = (t) =>
  t
    .replace(/export function /g, "function ")
    // (x as { ... }) vira x, e ... as { ... }[] some
    .replace(/\((\w+) as \{[^}]*\}\[?\]?\)/g, "$1")
    .replace(/ as \{[^}]*\}\[?\]?/g, "")
    // generico<...> vira generico
    .replace(/Set<[^>]*>/g, "Set")
    // parametros anotados, um ou dois
    .replace(/\(([a-zA-Z]+): [A-Za-z<>[\]| ]+, ([a-zA-Z]+): [A-Za-z<>[\]| ]+\)/g, "($1, $2)")
    .replace(/\(([a-zA-Z]+): [A-Za-z<>[\]| ]+\)/g, "($1)")
    // const x: tipo =
    .replace(/(const [a-zA-Z]+): [A-Za-z<>[\]| ]+ =/g, "$1 =")
    // retorno anotado da funcao
    .replace(/\): [A-Za-z<>[\]| ]+ \{/g, ") {");

const corpo =
  semTipos(extrair("function precosDaCasa()", "// PRECOS UNITARIOS QUE ELA ESCREVEU")) +
  semTipos(extrair("export function precosInventados(", "// ENDERECO DITO QUE NAO E O DA PADARIA")) +
  semTipos(extrair("export function corrigirEndereco(", "const MODELO = process.env"));

const criar = new Function("catalogo", corpo + "\nreturn { precosInventados, corrigirEndereco };");
const { precosInventados, corrigirEndereco } = criar(catalogo);

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== preco que a padaria NAO cobra tem que ser pego ==");
for (const frase of [
  "Ela custa R$ 70 o quilo",
  "Cada quilo custa R$ 50,00",
  "O salgado sai R$ 2,50 cada",
  "Fica R$ 180,00 o cento",
  "O quilo sai R$ 61,00",
]) {
  conferir(precosInventados(frase).length > 0, 'pega "' + frase + '"', "passou batido");
}

console.log("");
console.log("== limite conhecido: valor que existe, mas de outro produto ==");
// O cupcake pequeno custa R$ 2,00 de verdade, entao dizer que o salgado custa
// isso passa pela guarda. Esta linha existe pra ninguem achar que a guarda
// cobre mais do que cobre.
conferir(
  precosInventados("O salgado sai R$ 2,00 cada").length === 0,
  "documentado: preco de OUTRO produto passa (cupcake pequeno custa R$ 2,00)",
  "mudou de comportamento, atualize o comentario da guarda",
);

console.log("");
console.log("== preco DA TABELA tem que passar ==");
const acha = (nome) => catalogo.outros_produtos.find((i) => i.nome === nome).preco;
const brl = (n) => "R$ " + n.toFixed(2).replace(".", ",");
for (const frase of [
  "Salgado frito sai " + brl(catalogo.salgados.frito.preco) + " cada",
  "O assado fica " + brl(catalogo.salgados.assado.preco) + " a unidade",
  "A cuca custa " + brl(acha("cuca")) + " o quilo",
  "A torta doce sai " + brl(acha("torta doce")) + " o quilo",
  "Sai " + brl(catalogo.salgados.frito.preco * 100) + " o cento",
  "A pizza inteira custa " + brl(catalogo.pizza.inteira.preco) + " cada",
]) {
  const achou = precosInventados(frase);
  conferir(achou.length === 0, 'deixa passar "' + frase + '"', "acusou: " + achou.join(", "));
}

console.log("");
console.log("== total de pedido continua livre (quem soma e o motor) ==");
for (const frase of [
  "Total: R$ 458,00",
  "Deu R$ 536,00 no total",
  "100 coxinha: R$ 100,00",
  "3 kg de bolo laka: R$ 140,70",
]) {
  const achou = precosInventados(frase);
  conferir(achou.length === 0, 'nao mexe em "' + frase + '"', "acusou: " + achou.join(", "));
}

console.log("");
console.log("== endereco inventado vira o certo ==");
const CERTO = "Centro, Rua Independência 855, Xanxerê SC";
for (const [frase, deviaTrocar] of [
  ["O endereço da padaria é Rua XV de Novembro, 123, no centro de Xanxerê.", true],
  ["Fica na Avenida Brasil 4000, pertinho.", true],
  ["A gente fica na Rua Independência 855, no centro.", false],
  ["Estamos na rua independencia, 855", false],
]) {
  const saida = corrigirEndereco(frase, CERTO);
  const trocou = saida !== frase;
  conferir(
    trocou === deviaTrocar,
    (deviaTrocar ? "troca" : "mantem") + ' "' + frase.slice(0, 45) + '"',
    "saiu: " + saida,
  );
  if (deviaTrocar && trocou) {
    conferir(saida.includes("Independência 855"), "  e poe o endereco certo", saida);
  }
}

console.log("");
console.log(erros === 0 ? "ELA NAO INVENTA PRECO NEM ENDERECO" : erros + " FALHA(S) NA GUARDA");
process.exit(erros === 0 ? 0 : 1);
