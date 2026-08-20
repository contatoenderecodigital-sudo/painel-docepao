// "PODE FECHAR" VENCE QUALQUER OFERTA.
//
// Teste ao vivo de 20/08/2026, com o dono esperando a tela ficar pronta:
//
//   cliente: nao, so o bolo mesmo. nome Patricia Loureiro, pago no pix
//   Dora:    So pra confirmar, vai querer algum salgado pra festa tambem?
//   cliente: ja falei que nao quero salgado, so o bolo. pode fechar
//   Dora:    Agora, vai querer docinho tambem pra festa? Tem ainda pizza,
//            torta e empadao, se quiser.
//
// A maquina de etapas tratava "ainda nao ofereci docinho" como PENDENCIA, do
// mesmo jeito que "falta a data da retirada". Nao e a mesma coisa: uma e
// informacao que a cozinha precisa, a outra e venda a mais que seria bom ter.
//
// Enquanto sobrasse uma oferta por fazer, o pedido nao fechava, e quem mandou
// fechar levava mais uma pergunta. E a mesma coisa que fez a secretaria
// desistir, com outra roupa.
//
// Oferecer e bom. Insistir depois de "pode fechar" e o oposto de atender.
//
// Roda com: node testes/pode-fechar-fecha.cjs
const { mandouFechar } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== o cliente mandou fechar ==");
for (const falas of [
  ["ja falei que nao quero salgado, so o bolo. pode fechar"],
  ["quero 100 coxinhas pra sexta", "so isso mesmo. nome Roberta, pix"],
  ["era so isso"],
  ["pode passar pra equipe"],
  ["pode registrar assim"],
  ["nao quero mais nada, finaliza"],
  ["manda pra equipe por favor"],
  ["quero um bolo de 2 kg", "mais nada", "nome Ana, pix"],
]) {
  conferir(mandouFechar(falas), '"' + falas.join(" / ").slice(0, 46) + '"', "nao reconheceu a ordem de fechar");
}

console.log("");
console.log("== e quem NAO mandou continua sendo atendido ==");
// O outro lado importa: cortar a oferta cedo demais perde venda de festa, que
// e o pedido mais caro da padaria.
for (const falas of [
  ["boa tarde, quero um bolo"],
  ["quanto custa o cento de salgado?"],
  ["vou fazer uma festa dia 12/09 pra 40 pessoas"],
  ["queria orcamento de salgado e docinho"],
  ["nao, so o bolo mesmo. nome Patricia Loureiro, pago no pix"],
]) {
  conferir(!mandouFechar(falas), '"' + falas.join(" / ").slice(0, 46) + '"', "cortou a oferta sem o cliente pedir");
}

console.log("");
console.log("== a ordem vale da conversa inteira ==");
// Ele mandou fechar numa mensagem e respondeu o nome na seguinte: a ordem
// continua valendo, senao a oferta volta no ultimo passo.
conferir(
  mandouFechar(["pode fechar", "nome Patricia Loureiro", "pix"]),
  "dito na primeira, vale na ultima",
  "a ordem se perdeu no caminho",
);
conferir(mandouFechar([]) === false, "conversa vazia nao fecha nada", "fecharia sozinho");

console.log("");
console.log(erros === 0 ? "QUEM MANDA FECHAR E O CLIENTE" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
