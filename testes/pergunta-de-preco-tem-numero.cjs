// PERGUNTA DE PRECO SE RESPONDE COM NUMERO, EM QUALQUER ORDEM DE PALAVRAS.
//
// Conversa real de 20/08/2026:
//
//   cliente: bom dia, quanto custa o cento de salgado
//   Dora:    Salgado frito sai R$ 1,00 a unidade (R$ 100,00 o cento) e o
//            assado R$ 1,25 (R$ 125,00 o cento).
//   cliente: e o docinho, quanto fica
//   Dora:    Te mandei o cardapio de docinhos aqui. Quer que eu te diga o preco
//            de algum sabor especifico?
//
// A mesma pergunta, feita com as palavras em outra ordem, ficou sem numero. O
// codigo tinha a resposta na mao e nao entrou, porque o gatilho exigia "quanto
// custa o docinho" nessa ordem exata. A cliente parou de responder ali.
//
// Este teste cobra a deteccao nos dois sentidos: pergunta de preco com familia
// dispara, e o que nao e pergunta de preco nao dispara. O segundo lado importa
// tanto quanto: "quantos salgados por pessoa" e pergunta de rendimento, e a
// tabela de preco no meio dela e resposta errada.
//
// Roda com: node testes/pergunta-de-preco-tem-numero.cjs
const { perguntouPrecoDeFamilia } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}
const dispara = (f) => perguntouPrecoDeFamilia(f);

console.log("== pergunta de preco, em qualquer ordem ==");
for (const fala of [
  "e o docinho, quanto fica",
  "bom dia, quanto custa o cento de salgado",
  "quanto custa o docinho",
  "qual o preco do bolo",
  "preco do docinho por favor",
  "e o salgado assado, quanto sai",
  "quanto fica o cento de docinho",
  "qual o valor do bolo de festa",
]) {
  conferir(dispara(fala), '"' + fala.slice(0, 42) + '" responde com numero', "ficou sem preco");
}

console.log("");
console.log("== o que NAO e pergunta de preco ==");
for (const fala of [
  "quantos salgados por pessoa?",
  "quantos docinhos vc recomenda pra 30 pessoas",
  "quero 100 salgados",
  "bom dia",
  "voces tem salgado assado?",
  "o bolo vai de que sabor",
]) {
  conferir(!dispara(fala), '"' + fala.slice(0, 42) + '" nao vira tabela de preco', "despejou preco sem pedir");
}

console.log("");
console.log(erros === 0 ? "PERGUNTA DE PRECO SEMPRE TEM NUMERO" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
