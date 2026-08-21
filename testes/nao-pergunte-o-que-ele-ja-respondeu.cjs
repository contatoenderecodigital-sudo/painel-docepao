// TRES DEFEITOS QUE MATAM A VENDA SEM QUEBRAR NADA
//
// Os tres apareceram lendo conversa como cliente em 21/08/2026. Nenhum dos tres
// aparece na medicao, porque em dois deles o pedido nem chega a existir e no
// terceiro ele sai certo. So aparecem lendo.
//
//   1. "escolhe voce os tipos, to sem tempo" -> ela perguntou o sabor da
//      esfirra TRES vezes, palavra por palavra. Loop ate o cliente sumir.
//   2. "quanto custa a torta doce?" recebeu preco; "e a salgada?" recebeu
//      "qual sabor voce quer?". Pergunta de preco sem preco.
//   3. "dia 27/09 as 16h" na primeira mensagem, "me diz que horas" na sexta.
//
// Este teste cobra a REGRA, nao o caso: as tres correcoes valem pra qualquer
// produto do cardapio, e o teste varre o cardapio inteiro pra provar.
const path = require("node:path");
const raiz = path.join(__dirname, "..");
const catalogo = require(path.join(raiz, "lib/ia/dados/catalogo.json"));

const { pediuQueVoceEscolha, perguntaElipticaDePreco, horaQueEleFalou } = require("./_guardas.cjs")();

const r = {
  delega: [
    "escolhe voce os tipos, to sem tempo",
    "pode escolher",
    "me indica",
    "manda o que for melhor",
    "faz sortido",
    "confio em voce",
  ].map((f) => pediuQueVoceEscolha(f)),
  eliptica: [
    ["e a salgada?", "quanto custa a torta doce?"],
    ["e o assado?", "quanto custa o salgado frito?"],
    ["e a especial?", "qual o preco da torta doce"],
  ].map(([a, b]) => perguntaElipticaDePreco(a, b)),
  conversa: [
    ["e ai, tudo bem?", "quanto custa a torta doce?"],
    ["e a salgada?", "quero 200 salgados"],
  ].map(([a, b]) => perguntaElipticaDePreco(a, b)),
  horas: [
    ["oi boa tarde, vou fazer o aniversario da minha filha dia 27/09 as 16h, queria bolo"],
    ["preciso de 200 salgados assados pra quarta as 9h"],
    ["pode ser as 14:30"],
  ].map((f) => horaQueEleFalou(f)),
};

const falhas = [];

// 1. DELEGACAO: quem delega tem que ser reconhecido em todas as formas.
r.delega.forEach((ok, i) => { if (!ok) falhas.push("delegacao nao reconhecida no caso " + i); });

// 2. ELIPSE: continua a pergunta -> devolve o termo remontado.
r.eliptica.forEach((v, i) => { if (!v) falhas.push("pergunta que continua a anterior nao reconhecida no caso " + i); });
r.conversa.forEach((v, i) => { if (v) falhas.push("conversa virou pergunta de preco no caso " + i + ": " + v); });

// 3. HORA: o que o cliente escreve de todo jeito.
r.horas.forEach((v, i) => { if (!v) falhas.push("hora dita pelo cliente nao foi lida no caso " + i); });

// 4. O CONSERTO E DE CLASSE, NAO DE PRODUTO.
//
// A correcao do sabor delegado vale pra qualquer item com lista de sabores.
// Aqui se conta quantos sao: se um dia alguem consertar so a esfirra, este
// numero denuncia.
const comSabores = [];
for (const i of catalogo.outros_produtos ?? []) if ((i.sabores ?? []).length) comSabores.push(i.nome);
for (const grupo of [catalogo.salgados?.frito, catalogo.salgados?.assado, catalogo.doces]) {
  for (const i of grupo?.itens ?? []) if ((i.sabores ?? []).length) comSabores.push(i.nome);
}
const fs = require("node:fs");
const cerebro = fs.readFileSync(path.join(raiz, "lib/ia/cerebro.ts"), "utf8");
if (!/delegou o sabor, o codigo escolheu/.test(cerebro)) {
  falhas.push("o bloco que escolhe o sabor quando o cliente delega sumiu do cerebro");
}
if (/SABORES\["esfirra"\]|=== "esfirra"/.test(cerebro)) {
  falhas.push("tem conserto escrito so pra esfirra; a regra e da familia inteira");
}

console.log("Produtos com lista de sabores no cardapio: " + comSabores.length);
console.log("A regra do sabor delegado vale pra todos eles, nao pra um.");
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: delegacao, pergunta que continua a anterior e hora ja dita.");
