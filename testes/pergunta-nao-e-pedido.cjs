// PERGUNTA NAO VIRA ITEM NO PEDIDO, E SABOR E ESCOLHA DO CLIENTE.
//
// Teste com clientes ao vivo, 19/08/2026. Uma cliente escreveu, com todas as
// letras, "Calma, eu nao quero pedir nada ainda, so estou pesquisando preco" e
// depois "Por favor nao anota nada". A Dora anotou cinco itens. Outro cliente
// perguntou o preco da torta e ganhou uma torta no pedido. Uma senhora escreveu
// "eu nao falei que queria 1 quilo minha filha" e o quilo continuou la.
//
// E ela inventou sabor: "porto alegre" (que e sabor DOCE) numa torta SALGADA,
// "frango com legumes" num empadao e "sem recheio" numa cuca. Nada disso o
// cliente falou. Sabor inventado vira producao errada e cliente recusando o
// pedido no balcao.
//
// As frases deste teste sao as REAIS das conversas, nao inventadas aqui.
//
// Roda com: node testes/pergunta-nao-e-pedido.cjs
const fs = require("fs");
const fonte = fs.readFileSync("lib/ia/cerebro.ts", "utf8");

function extrair(assinatura, ate) {
  const ini = fonte.indexOf(assinatura);
  const fim = fonte.indexOf(ate, ini);
  if (ini < 0 || fim < 0) throw new Error("nao achei no arquivo: " + assinatura);
  return fonte.slice(ini, fim);
}

const semTipos = (t) =>
  t
    .replace(/export function /g, "function ")
    .replace(/export const /g, "const ")
    .replace(/\(([a-zA-Z]+): [A-Za-z<>[\]| ]+, ([a-zA-Z]+): [A-Za-z<>[\]| ]+\)/g, "($1, $2)")
    .replace(/\(([a-zA-Z]+): [A-Za-z<>[\]| ]+\)/g, "($1)")
    .replace(/(const [a-zA-Z]+): [A-Za-z<>[\]| ]+ =/g, "$1 =")
    .replace(/\): [A-Za-z<>[\]| ]+ =>/g, ") =>")
    .replace(/\): [A-Za-z<>[\]| ]+ \{/g, ") {");

const corpo =
  semTipos(extrair("const semAcMin =", "// O cliente disse explicitamente")) +
  semTipos(extrair("export function clienteProibiuAnotar(", "// A fala do cliente e SO uma pergunta")) +
  semTipos(extrair("export function soPerguntouSemPedir(", "// Pedacos da observacao")) +
  semTipos(extrair("export function obsQueOClienteNaoDisse(", "// ENDERECO DITO QUE NAO E O DA PADARIA"));

const criar = new Function(
  corpo + "\nreturn { clienteProibiuAnotar, soPerguntouSemPedir, obsQueOClienteNaoDisse };",
);
const { clienteProibiuAnotar, soPerguntouSemPedir, obsQueOClienteNaoDisse } = criar();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log('== "nao anota nada" tem que travar a escrita ==');
for (const frase of [
  "Calma, eu nao quero pedir nada ainda, so estou pesquisando preco",
  "Espera, eu nao pedi torta salgada nenhuma, eu so perguntei o preco. Por favor nao anota nada",
  "so to pesquisando preco por enquanto",
  "e so uma pergunta, nao e pedido",
  "so queria saber quanto fica",
]) {
  conferir(clienteProibiuAnotar(frase), 'trava "' + frase.slice(0, 50) + '"', "passou batido");
}

console.log("");
console.log("== quem esta comprando NAO pode ser travado ==");
for (const frase of [
  "quero 100 coxinhas e 50 esfirras de calabresa",
  "pode ser",
  "anota 2 kg de cuca de goiaba",
  "vou querer o bolo de 3 kg",
  "fechado, pode mandar",
]) {
  conferir(!clienteProibiuAnotar(frase), 'deixa passar "' + frase + '"', "travou sem motivo");
}

console.log("");
console.log("== pergunta de preco NAO vira item ==");
for (const [frase, produto] of [
  ["quanto custa a torta doce?", "torta doce"],
  ["voces tem docinho sem lactose?", "docinho sem lactose"],
  ["qual o preco do empadao", "empadao"],
  ["quanto fica a mini pizza?", "mini pizza"],
  ["como funciona a cuca, e por quilo?", "cuca"],
]) {
  conferir(soPerguntouSemPedir(frase, produto), 'segura "' + frase + '"', "deixou virar item");
}

console.log("");
console.log("== decisao de verdade tem que passar ==");
for (const [frase, produto] of [
  ["quero 2 kg de torta doce", "torta doce"],
  ["me ve uma cuca de goiaba", "cuca"],
  ["pode ser", "coxinha"],
  ["100 coxinhas", "coxinha"],
  ["quanto custa a torta doce? pode anotar 1 kg", "torta doce"],
  ["a festa e dia 12/09, quero empadao", "empadao"],
]) {
  conferir(!soPerguntouSemPedir(frase, produto), 'deixa passar "' + frase + '"', "segurou uma venda");
}

console.log("");
console.log("== sabor que o cliente NUNCA falou tem que ser recusado ==");
const conversaReal = [
  "bom dia, queria saber o preco da torta salgada e do empadao",
  "e a mini pizza, quanto fica",
  "obrigada, vou pensar e falar com meu marido",
];
for (const obs of ["porto alegre", "frango com legumes", "sem recheio", "calabresa"]) {
  const fora = obsQueOClienteNaoDisse(obs, conversaReal);
  conferir(fora.length > 0, 'recusa a observacao "' + obs + '"', "aceitou o que ele nao disse");
}

console.log("");
console.log("== o que o cliente FALOU tem que ser aceito ==");
const conversaFesta = [
  "quero 50 esfirras de calabresa e 60 brigadeiros",
  "forminha dourada",
  "um bolo de laka com pao de lo branco, topo tema princesa",
  "a menina eh a Alice, faz 5 anos",
];
for (const obs of [
  "calabresa",
  "forminha dourada",
  "pao de lo branco, topo tema princesa",
  "sem foto",
  "prato aberto",
]) {
  const fora = obsQueOClienteNaoDisse(obs, conversaFesta);
  conferir(fora.length === 0, 'aceita a observacao "' + obs + '"', "recusou: " + fora.join(", "));
}

console.log("");
console.log(erros === 0 ? "PERGUNTA NAO VIRA PEDIDO E SABOR E DO CLIENTE" : erros + " FALHA(S) NO PORTAO");
process.exit(erros === 0 ? 0 : 1);
