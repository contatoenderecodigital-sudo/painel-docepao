// MUDAR O TOTAL E UMA CONTA, NAO UMA NEGOCIACAO.
//
// Ponto exato em que a secretaria desistiu, em 20/08/2026. O pedido estava
// fechado em 200 salgados e ela mandou baixar pra 150:
//
//   ela:  vamos fazer 150 salgados entao
//   Dora: quer que eu ajuste pra 150?
//   ela:  sim
//   Dora: como voce prefere dividir os 150?
//   Dora: posso aplicar a divisao igual?
//
// Seis mensagens numa divisao, com ela ja com pressa. Quem manda mudar ja
// autorizou a mudanca: perguntar de novo nao e cuidado, e devolver o trabalho
// pra quem pediu ajuda.
//
// Agora o codigo refaz a conta sozinho. Este teste cobra as tres coisas que
// nao podem falhar: reconhecer a mudanca, nao confundir com o primeiro pedido,
// e a soma bater EXATA (149 salgados so aparecem na hora de produzir).
//
// Roda com: node testes/mudou-o-total-refaz-a-conta.cjs
const { novoTotalQueElePediu, reescalarParaOTotal, totalQueElePediu } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== o jeito que o cliente fala que mudou ==");
for (const [fala, familia, total] of [
  ["vamos fazer 150 salgados entao", "salgado", 150],
  ["na verdade muda pra 150 salgados", "salgado", 150],
  ["deixa 100 docinhos", "docinho", 100],
  ["de 200 pra 150", "salgado", 150],
  ["pensando bem, melhor 120 salgados", "salgado", 120],
  ["reduz os salgados pra 150", "salgado", 150],
  ["aumenta pra 250 salgados", "salgado", 250],
  ["so 80 docinhos", "docinho", 80],
  ["ajusta pra 150 salgados por favor", "salgado", 150],
]) {
  const r = novoTotalQueElePediu(fala);
  conferir(
    r && r.familia === familia && r.total === total,
    '"' + fala + '" -> ' + total + " " + familia,
    "veio: " + JSON.stringify(r),
  );
}

console.log("");
console.log("== numero que NAO e mudanca de total ==");
for (const fala of [
  "sao 200 convidados",
  "a festa e as 16h",
  "quero pro dia 30/08",
  "tem 80 pessoas confirmadas",
  "quanto fica o cento?",
  "obrigada, ate sabado",
]) {
  const r = novoTotalQueElePediu(fala);
  conferir(r === null, '"' + fala + '" nao mexe no total', "veio: " + JSON.stringify(r));
}

console.log("");
console.log("== o numero que vale e o colado na familia ==");
const misto = novoTotalQueElePediu("muda pra 150 salgados, sao 80 convidados");
conferir(misto && misto.total === 150, "pega 150 e nao 80", "veio: " + JSON.stringify(misto));

console.log("");
console.log("== a soma bate EXATA, sempre ==");
const casos = [
  [[40, 40, 40, 40, 40], 150],
  [[40, 40, 40, 40, 40], 200],
  [[100, 100], 150],
  [[50, 30, 20], 111],
  [[40, 40, 40, 40, 40], 7],
  [[33, 33, 34], 250],
  [[60, 40], 1],
];
let somaOk = true;
const detalhes = [];
for (const [qtds, alvo] of casos) {
  const itens = qtds.map((q, i) => ({ produto: "p" + i, qtd: q }));
  const r = reescalarParaOTotal(itens, alvo);
  const soma = r.reduce((s, i) => s + i.qtd, 0);
  if (soma !== alvo) {
    somaOk = false;
    detalhes.push("[" + qtds.join(",") + "] -> " + alvo + " deu " + soma);
  }
}
conferir(somaOk, "as " + casos.length + " divisoes fecham no total pedido", detalhes.join(" | "));

console.log("");
console.log("== reescalar mantem os sabores que ele escolheu ==");
const escolhidos = [
  { produto: "coxinha", qtd: 100 },
  { produto: "risólis", qtd: 100 },
];
const menor = reescalarParaOTotal(escolhidos, 150);
conferir(
  menor.length === 2 && menor.every((i) => ["coxinha", "risólis"].includes(i.produto)),
  "150 continua sendo coxinha e risólis, nao um sortido novo",
  JSON.stringify(menor),
);
conferir(
  menor.every((i) => i.qtd === 75),
  "100 e 100 viram 75 e 75",
  JSON.stringify(menor),
);

console.log("");
console.log("== proporcao desigual continua desigual ==");
const desigual = reescalarParaOTotal([{ produto: "a", qtd: 150 }, { produto: "b", qtd: 50 }], 100);
conferir(
  desigual.find((i) => i.produto === "a").qtd === 75 && desigual.find((i) => i.produto === "b").qtd === 25,
  "3 pra 1 continua 3 pra 1",
  JSON.stringify(desigual),
);

console.log("");
console.log("== lixo na entrada nao quebra nada ==");
let quebrou = false;
try {
  reescalarParaOTotal([], 100);
  reescalarParaOTotal([{ produto: "a", qtd: 0 }], 100);
  reescalarParaOTotal([{ produto: "a", qtd: 10 }], 0);
  novoTotalQueElePediu("");
} catch (e) {
  quebrou = true;
}
conferir(!quebrou, "aguenta lista vazia, zero e texto vazio", "estourou");

console.log("");
console.log("== quantos ele pediu sai da CONVERSA, nao da ultima frase ==");
// A secretaria disse "200 salgados assados e 100 docinhos" na segunda mensagem.
// Duas mensagens depois pediu o sortido sem repetir o numero, e a sugestao veio
// com 100 salgados. Ela corrigiu tres vezes.
const conversa = [
  "Oi, bom dia! Preciso de salgados e docinhos pra um coffee break aqui na empresa",
  "Isso mesmo, 200 salgados assados e 100 docinhos. Quarta-feira as 9h. Nao tenho tempo de escolher um a um, pode montar o sortido pra mim?",
  "Forminha branca ta otimo. Mas eu nao vou conseguir olhar cardapio nao, to correndo aqui. Escolhe voce os salgados e os docinhos e me diz o que ficou",
];
conferir(totalQueElePediu(conversa, "salgado") === 200, "acha os 200 salgados tres mensagens atras", "veio " + totalQueElePediu(conversa, "salgado"));
conferir(totalQueElePediu(conversa, "docinho") === 100, "e os 100 docinhos, sem misturar com os salgados", "veio " + totalQueElePediu(conversa, "docinho"));
conferir(
  totalQueElePediu(["quero 200 salgados", "na verdade 150 salgados"], "salgado") === 150,
  "vale o ultimo que ele falou",
  "veio " + totalQueElePediu(["quero 200 salgados", "na verdade 150 salgados"], "salgado"),
);
conferir(
  totalQueElePediu(["quero salgados pra quarta as 9h, dia 26/08"], "salgado") === 0,
  "hora e data nao viram quantidade",
  "veio " + totalQueElePediu(["quero salgados pra quarta as 9h, dia 26/08"], "salgado"),
);
conferir(totalQueElePediu([], "salgado") === 0, "conversa vazia devolve zero", "quebrou");

console.log("");
console.log(erros === 0 ? "MUDAR O TOTAL E SO UMA CONTA" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
