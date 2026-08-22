// O NUMERO QUEM ESCREVE E O CODIGO
//
// Segunda peca do fluxo novo: dada a etapa da vez, montar o que a padaria diz.
//
// A REGRA QUE ESTE TESTE PROTEGE
//
// Onde tem dinheiro, a IA nao encosta no texto. Na versao antiga ela escrevia o
// valor e uma guarda corria atras conferindo; ela chegou a responder "R$ 44,90
// o quilo" pra uma torta que custa R$ 36,90, e a guarda de preco inventado
// nasceu desse dia.
//
// Aqui o numero sai do mesmo motor que faz a conta do pedido. Se o motor errar,
// erram os dois juntos: nao existe divergencia possivel entre o que o cliente
// le e o que a padaria cobra.
//
// E UMA PERGUNTA POR VEZ
//
// A etapa dos dados pergunta dia, depois hora, depois nome, depois pagamento.
// Perguntar os quatro na mesma frase e formulario, e ja fez cliente responder
// so o primeiro e ignorar o resto.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-pergunta.mts");
fs.writeFileSync(
  sonda,
  [
    'import { etapaDaVez } from "../lib/ia/fluxo/etapas.ts";',
    'import { falaDaEtapa } from "../lib/ia/fluxo/pergunta.ts";',
    "const vazio = { ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[], dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null };",
    "const p = (x: Record<string, unknown>) => ({ ...vazio, ...x });",
    "const base = { salgados:200, docinhos:100, boloKg:2, totalCentavos:41880 };",
    "const festa = { ehFesta:true, pessoas:20, base, baseAceita:true };",
    "const bolo = [{produto:'bolo ninho',categoria:'bolo_festa',qtd:2,obs:null}];",
    "const soBolo = { ...festa, naoQuer:['salgado','docinho'], itens:bolo };",
    "const estados: [string, unknown][] = [",
    "  ['base', p({ehFesta:true, pessoas:20, base})],",
    "  ['salgado', p(festa)],",
    "  ['pecas', p({...soBolo, pecas:null})],",
    "  ['dados_dia', p({...soBolo, pecas:{topo:true,papelDeArroz:true}})],",
    "  ['dados_pagamento', p({...soBolo, pecas:{topo:true,papelDeArroz:true}, dados:{nome:'Sandro',data:'12/09',hora:'11:30',pagamento:null}})],",
    "  ['confirmacao', p({...soBolo, pecas:{topo:true,papelDeArroz:true}, dados:{nome:'Sandro',data:'12/09',hora:'11:30',pagamento:'pix'}})],",
    "];",
    "const saida = estados.map(([nome, est]) => {",
    "  const e = etapaDaVez(est as never);",
    "  const f = falaDaEtapa(e, est as never, 41880);",
    "  return { nome, etapa: e.id, texto: f.texto, botoes: f.botoes, cardapio: f.cardapio, podeReescrever: f.podeReescrever };",
    "});",
    "console.log(JSON.stringify(saida));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pergunta.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const saida = JSON.parse(bruto.trim().split("\n").pop());
const por = (nome) => saida.find((x) => x.nome === nome);
const falhas = [];

// ------------------------------------ onde tem dinheiro, a IA nao encosta
for (const x of saida) {
  const temDinheiro = /R\$\s?[0-9]/.test(x.texto);
  if (temDinheiro && x.podeReescrever) {
    falhas.push("a etapa " + x.etapa + " tem valor no texto e esta liberada pra IA reescrever");
  }
}
if (por("base").podeReescrever) falhas.push("a base da festa voltou a poder ser reescrita pela IA");
if (por("confirmacao").podeReescrever) falhas.push("o resumo do pedido voltou a poder ser reescrito pela IA");

// ------------------------------------------ o numero e o do motor
const base = por("base");
if (!/200 salgados/.test(base.texto)) falhas.push("a base perdeu a quantidade de salgados");
if (!/100 docinhos/.test(base.texto)) falhas.push("a base perdeu a quantidade de docinhos");
if (!/2 kg de bolo/.test(base.texto)) falhas.push("a base perdeu o peso do bolo");
if (!/R\$ 418,80/.test(base.texto)) falhas.push("a base perdeu o total: " + base.texto.slice(0, 80));

// ------------------------------------------- uma pergunta por vez
for (const x of saida) {
  const perguntas = (x.texto.match(/\?/g) ?? []).length;
  if (perguntas > 1) {
    falhas.push("a etapa " + x.etapa + " faz " + perguntas + " perguntas na mesma mensagem");
  }
}
if (!/dia/i.test(por("dados_dia").texto)) falhas.push("a etapa de dados nao comeca pelo dia da retirada");
if (!/pagar/i.test(por("dados_pagamento").texto)) falhas.push("o pagamento nao e a ultima coisa perguntada");

// --------------------------------------- botao dentro do limite da Meta
for (const x of saida) {
  if (x.botoes.length > 3) falhas.push("a etapa " + x.etapa + " tem mais de tres botoes");
  for (const b of x.botoes) {
    if (b.titulo.length > 20) falhas.push("botao com " + b.titulo.length + " caracteres em " + x.etapa + ": " + b.titulo);
    if (!/^[a-z0-9_]+$/.test(b.id)) falhas.push("id de botao invalido em " + x.etapa + ": " + b.id);
  }
}

// ------------------------------- o cardapio vem da ETAPA, nao do texto
// Foi o defeito de 23/08: ela perguntou de salgados e mandou o cardapio de
// docinhos, porque uma guarda fazia a imagem seguir o texto que a IA escreveu.
if (por("salgado").cardapio !== "salgados") {
  falhas.push("a etapa do salgado nao manda o cardapio de salgados: " + por("salgado").cardapio);
}
if (por("pecas").cardapio) falhas.push("a etapa das pecas do bolo manda cardapio sem precisar");

console.log("Etapas conferidas: " + saida.length);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: o numero e do motor, uma pergunta por vez, e o cardapio vem da etapa.");
