// QUEM PEDE INDICACAO NAO PODE RECEBER A PERGUNTA DE VOLTA.
//
// Teste de aceitacao de 19/08/2026. A secretaria pediu TRES vezes que a Dora
// montasse o sortido, e nas tres levou a pergunta de volta:
//
//   "Estou sem tempo de escolher um a um. Escolha voce os recheios mais pedidos"
//   -> "preciso que voce escolha o recheio de cada um, porque cada um tem
//       opcoes diferentes"
//
// O coffee break de 150 salgados e 100 docinhos NAO fechou por causa disso, e a
// conversa morreu no limite de mensagens. Devolver a pergunta pra quem pediu
// ajuda e o oposto de atender, e cada devolucao dessas queima duas mensagens:
// a dela perguntando e a do cliente repetindo.
//
// Roda com: node testes/ela-indica-quando-pedem.cjs
const { pediuQueVoceEscolha, sugestaoDeSortido } = require("./_guardas.cjs")();
const catalogo = require("../lib/ia/dados/catalogo.json");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== as frases REAIS de quem pede indicacao ==");
for (const frase of [
  "Estou sem tempo de escolher um a um. Escolha voce os recheios mais pedidos",
  "vc pode escolher pra mim? confio",
  "me fala oq costuma sair mais pra festa de crianca",
  "pode variar do jeito que voces acham melhor",
  "quero sortido mesmo",
  "eu nao sei os tipos",
  "o que voce indica?",
  "manda o que for melhor",
]) {
  conferir(pediuQueVoceEscolha(frase), 'reconhece "' + frase.slice(0, 46) + '"', "devolve a pergunta e queima 2 mensagens");
}

console.log("");
console.log("== quem JA escolheu nao pode cair nisso ==");
// Se disparar aqui, ela ignora o que o cliente pediu e empurra sugestao.
for (const frase of [
  "quero 100 coxinhas e 50 esfirras de calabresa",
  "brigadeiro e beijinho, 30 de cada",
  "vou querer 2 kg de bolo de laka",
  "pode ser",
  "qual o preco do empadao?",
]) {
  conferir(!pediuQueVoceEscolha(frase), 'nao dispara em "' + frase.slice(0, 46) + '"', "empurra sugestao por cima da escolha dele");
}

console.log("");
console.log("== a conta da sugestao tem que FECHAR exata ==");
// Foi disso que nasceu o pedido com 175 docinhos onde o cliente pediu 100: a
// soma das partes precisa bater com o total, sempre.
for (const [familia, total] of [
  ["salgado_assado", 150],
  ["salgado_frito", 200],
  ["docinho", 100],
  ["salgado_frito", 100],
  ["docinho", 50],
  ["salgado_assado", 37],
  ["docinho", 7],
]) {
  const s = sugestaoDeSortido(familia, total);
  const soma = s.reduce((a, i) => a + i.qtd, 0);
  conferir(soma === total, familia + " de " + total + ": as partes somam " + total, "somaram " + soma);
  conferir(s.every((i) => i.qtd > 0), "  e nenhum tipo fica com zero", JSON.stringify(s));
}

console.log("");
console.log("== so sugere produto que EXISTE no cardapio ==");
const nomesReais = new Set([
  ...catalogo.salgados.frito.itens.map((i) => i.nome.toLowerCase()),
  ...catalogo.salgados.assado.itens.map((i) => i.nome.toLowerCase()),
  ...catalogo.doces.itens.map((i) => i.nome.toLowerCase()),
]);
for (const familia of ["salgado_frito", "salgado_assado", "docinho"]) {
  const s = sugestaoDeSortido(familia, 100);
  const fora = s.map((i) => i.produto).filter((p) => !nomesReais.has(p.toLowerCase()));
  conferir(fora.length === 0, familia + ": todo tipo sugerido esta no cardapio", "nao existe: " + fora.join(", "));
}

console.log("");
console.log("== pedido pequeno nao se divide em cinco ==");
const pequeno = sugestaoDeSortido("docinho", 20);
conferir(pequeno.length <= 2, "20 docinhos viram no maximo 2 tipos", "virou " + pequeno.length + " tipos de " + Math.floor(20 / pequeno.length));
const grande = sugestaoDeSortido("salgado_frito", 300);
conferir(grande.length === 5, "300 salgados viram 5 tipos, como a dona sugere", "virou " + grande.length);

console.log("");
console.log("== zero nao gera sugestao ==");
conferir(sugestaoDeSortido("docinho", 0).length === 0, "total zero nao inventa item", "inventou");

console.log("");
console.log("== ela tem a FERRAMENTA, nao so o regex ==");
// O regex e rede de segurança e sempre vai ter buraco: gente pede indicacao de
// mil jeitos. Quem entende linguagem e ela; quem faz conta sem errar e o
// codigo. Por isso existe a ferramenta sugerir_sortido, que e o caminho
// principal, e o regex fica so pra quando ela entender e nao usar.
const fs = require("fs");
const cerebro = fs.readFileSync("lib/ia/cerebro.ts", "utf8");
conferir(cerebro.includes('name: "sugerir_sortido"'), "a ferramenta sugerir_sortido existe", "so sobrou o regex");
conferir(
  cerebro.includes('if (nome === "sugerir_sortido")'),
  "e tem executor que devolve a conta fechada",
  "a ferramenta existe mas nao faz nada",
);
conferir(
  /enum: \["salgado_frito", "salgado_assado", "docinho"\]/.test(cerebro),
  "a familia e lista fechada, entao ela nao inventa uma",
  "familia livre deixa ela pedir sortido de coisa que nao existe",
);

console.log("");
console.log(erros === 0 ? "ELA INDICA QUANDO PEDEM" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
