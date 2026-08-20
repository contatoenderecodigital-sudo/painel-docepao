// A FORMA DE PAGAMENTO E A ULTIMA QUE O CLIENTE FALOU.
//
// Bateria ao vivo de 19/08/2026. O cliente nunca falou pix. A Dora anotou pix.
// Ele corrigiu pra cartao, ela respondeu "Anotei que o pagamento sera no
// cartao", e o pedido fechou com "*Forma de pagamento:* pix". Foi pra producao
// com o dado errado, e quando ele reclamou ela disse que nao dava mais pra
// mexer porque a cozinha podia ter comecado.
//
// A causa era boba: a funcao testava numa ORDEM FIXA, pix primeiro. Quem
// falasse pix e depois corrigisse continuava com pix pra sempre.
//
// Corrigir de ideia e normal. Quem manda e a ultima palavra dele.
//
// Roda com: node testes/pagamento-e-o-ultimo.cjs
const { pagamentoQueEleFalou } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== o caso real: ele corrigiu e a correcao tem que valer ==");
const CONVERSA_DO_RODRIGO = [
  "quero 50 coxinhas e 30 brigadeiros pra quinta as 17h",
  "vou pagar no pix",
  "na verdade nao, quero pagar no cartao",
].join("\n");
conferir(
  pagamentoQueEleFalou(CONVERSA_DO_RODRIGO) === "cartao",
  "a correcao pra cartao vence o pix dito antes",
  "veio: " + pagamentoQueEleFalou(CONVERSA_DO_RODRIGO),
);

console.log("");
console.log("== corrigir vale pros dois lados ==");
for (const [conversa, esperado] of [
  ["pago no cartao\nna verdade e pix mesmo", "pix"],
  ["vai ser dinheiro\npensando bem, cartao", "cartao"],
  ["pix\ndinheiro na retirada", "dinheiro"],
  ["cartao de credito\nmelhor dinheiro", "dinheiro"],
]) {
  const veio = pagamentoQueEleFalou(conversa);
  conferir(veio === esperado, 'de "' + conversa.replace(/\n/g, " -> ") + '" vem ' + esperado, "veio: " + veio);
}

console.log("");
console.log("== quem fala uma vez so continua funcionando ==");
for (const [fala, esperado] of [
  ["pago no pix", "pix"],
  ["no cartao", "cartao"],
  ["dinheiro", "dinheiro"],
  ["vou pagar em especie", "dinheiro"],
  ["parcelado no credito", "cartao"],
  ["as 16h, nome Fernanda Klein, cartao", "cartao"],
]) {
  const veio = pagamentoQueEleFalou(fala);
  conferir(veio === esperado, '"' + fala + '" vira ' + esperado, "veio: " + veio);
}

console.log("");
console.log("== TRANSFERENCIA e BOLETO existem, e cliente de empresa usa ==");
// A secretaria do coffee break informou "transferencia" TRES vezes e o pedido
// fechou perguntando "vai ser pix, cartao ou dinheiro na retirada?". O jeito de
// pagar dela simplesmente nao existia no codigo.
for (const [fala, esperado] of [
  ["pago em transferencia", "transferencia"],
  ["vou fazer uma transferencia", "transferencia"],
  ["pode mandar por TED", "transferencia"],
  ["faco um deposito", "transferencia"],
  ["a empresa paga em boleto", "boleto"],
  ["precisa ser faturado com nota fiscal", "boleto"],
  ["passo na maquininha", "cartao"],
  ["nome Cristiane Balestrin, pago em transferencia", "transferencia"],
]) {
  const veio = pagamentoQueEleFalou(fala);
  conferir(veio === esperado, '"' + fala + '" vira ' + esperado, "veio: " + veio);
}

console.log("");
console.log("== quem nao falou pagamento nao ganha um inventado ==");
for (const fala of [
  "quero 100 coxinhas pra sabado",
  "qual o preco do bolo de festa?",
  "a festa e dia 12/09, umas 25 pessoas",
  "",
]) {
  const veio = pagamentoQueEleFalou(fala);
  conferir(veio === undefined, 'nao inventa em "' + fala.slice(0, 40) + '"', "inventou: " + veio);
}

console.log("");
console.log(erros === 0 ? "O PAGAMENTO E A ULTIMA PALAVRA DELE" : erros + " FALHA(S) NO PAGAMENTO");
process.exit(erros === 0 ? 0 : 1);
