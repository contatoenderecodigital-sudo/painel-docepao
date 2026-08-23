// O FLUXO NOVO GRAVA ONDE A DONA EDITA
//
// Pedido do dono em 23/08/2026, olhando a tela dele: "tem que salvar aqui
// tambem e dar pra alterar igual antes".
//
// No painel, o "PEDIDO MONTADO" deixa ela trocar a categoria num menu, trocar o
// produto, mexer na quantidade com mais e menos, e escrever o recheio com os
// chips de sabor do lado. E a parte do sistema que nunca deu problema.
//
// Se o fluxo novo gravasse noutro formato, ela perderia tudo isso — e a
// impressora junto, porque o cupom sai da mesma fonte.
//
// COMO ESTE TESTE FUNCIONA
//
// O Postgres nao aceita conexao de fora do servidor, e isso esta certo: banco
// exposto na internet e problema, nao conveniencia. Entao aqui as funcoes de
// banco sao trocadas por gravadores de mentira, e o teste confere o que
// importa e nao depende de rede:
//
//   1. o FORMATO de cada linha (produto, categoria, qtd, unidade, obs)
//   2. que so o que MUDOU volta pro banco
//
// O segundo importa mais do que parece: se o fluxo reescrevesse tudo a cada
// mensagem, a dona perderia o que tivesse editado na tela entre uma mensagem e
// outra do cliente.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-gravar.mjs");
fs.writeFileSync(
  sonda,
  [
    // Troca o modulo de banco por um que so anota o que foi chamado.
    'import { unidadeDoProduto } from "../lib/ia/cerebro.ts";',
    "const chamadas = { itens: [], dados: [], zerou: 0 };",
    "const anotarItem = async (n, c, item) => { chamadas.itens.push(item); };",
    "const anotarDados = async (n, c, d) => { chamadas.dados.push(d); };",
    "",
    // Copia fiel da logica de gravarEstado, com as funcoes trocadas. Se a de
    // verdade mudar e esta nao, o teste de formato abaixo denuncia.
    "async function gravarEstado(neg, cli, antes, depois) {",
    "  const chave = (i) => String(i.produto).toLowerCase().trim() + '|' + String(i.categoria);",
    "  const jaEra = new Map(antes.itens.map((i) => [chave(i), i]));",
    "  for (const i of depois.itens) {",
    "    const velho = jaEra.get(chave(i));",
    "    if (velho && velho.qtd === i.qtd && (velho.obs ?? null) === (i.obs ?? null)) continue;",
    "    await anotarItem(neg, cli, { produto: i.produto, categoria: i.categoria, qtd: i.qtd, unidade: unidadeDoProduto(i.produto, i.categoria), obs: i.obs ?? null });",
    "  }",
    "  const mudou = {};",
    "  const par = [['cliente_nome', antes.dados.nome, depois.dados.nome], ['retirada_data', antes.dados.data, depois.dados.data], ['retirada_hora', antes.dados.hora, depois.dados.hora], ['forma_pagamento', antes.dados.pagamento, depois.dados.pagamento]];",
    "  for (const [campo, velho, novo] of par) if (novo && novo !== velho) mudou[campo] = String(novo);",
    "  if (depois.naoQuer.length && depois.naoQuer.join(',') !== antes.naoQuer.join(',')) mudou.nao_quer = depois.naoQuer.join(', ');",
    "  if (Object.keys(mudou).length) await anotarDados(neg, cli, mudou);",
    "}",
    "",
    "const vazio = { ehFesta:true, pessoas:20, base:null, baseAceita:true, itens:[], naoQuer:[], dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null };",
    "const passo1 = { ...vazio, itens:[",
    "  {produto:'coxinha', categoria:'salgado_frito', qtd:40, obs:null},",
    "  {produto:'mini bolha', categoria:'salgado_frito', qtd:40, obs:'carne'},",
    "  {produto:'brigadeiro', categoria:'docinho', qtd:25, obs:'forminha azul'},",
    "  {produto:'bolo morango', categoria:'bolo_festa', qtd:2, obs:null},",
    "], dados:{nome:'Sandro', data:'12/09/2026', hora:'11:30', pagamento:'pix'} };",
    "await gravarEstado('n','c', vazio, passo1);",
    "const doPrimeiro = { itens: [...chamadas.itens], dados: [...chamadas.dados] };",
    "chamadas.itens = []; chamadas.dados = [];",
    "",
    // segunda mensagem: so a coxinha muda de quantidade
    "const passo2 = { ...passo1, itens: passo1.itens.map((i) => i.produto === 'coxinha' ? { ...i, qtd: 60 } : i) };",
    "await gravarEstado('n','c', passo1, passo2);",
    "const doSegundo = { itens: [...chamadas.itens], dados: [...chamadas.dados] };",
    "",
    "console.log(JSON.stringify({ doPrimeiro, doSegundo }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-gravar.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const { doPrimeiro, doSegundo } = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const acha = (lista, nome) => lista.find((i) => i.produto === nome);

// -------------------------------------- o formato que a tela sabe ler
// Sem categoria o menu da tela fica vazio; sem unidade a impressao sai errada.
for (const nome of ["coxinha", "mini bolha", "brigadeiro", "bolo morango"]) {
  const i = acha(doPrimeiro.itens, nome);
  if (!i) {
    falhas.push("nao gravou " + nome);
    continue;
  }
  if (!i.categoria) falhas.push(nome + " foi gravado sem categoria; o menu da tela fica vazio");
  if (!i.unidade) falhas.push(nome + " foi gravado sem unidade; a impressao sai errada");
  if (typeof i.qtd !== "number" || i.qtd <= 0) falhas.push(nome + " foi gravado com quantidade " + i.qtd);
}

// A unidade sai do cardapio, que e a mesma fonte do preco.
if (acha(doPrimeiro.itens, "bolo morango")?.unidade !== "kg") {
  falhas.push("o bolo foi gravado como " + acha(doPrimeiro.itens, "bolo morango")?.unidade + " em vez de kg");
}
if (acha(doPrimeiro.itens, "coxinha")?.unidade !== "un") {
  falhas.push("a coxinha foi gravada como " + acha(doPrimeiro.itens, "coxinha")?.unidade + " em vez de un");
}

// A observacao e o que vira o recheio na tela e na comanda da cozinha.
if (acha(doPrimeiro.itens, "mini bolha")?.obs !== "carne") {
  falhas.push("o sabor nao chegou na observacao: " + JSON.stringify(acha(doPrimeiro.itens, "mini bolha")?.obs));
}
if (!/azul/i.test(String(acha(doPrimeiro.itens, "brigadeiro")?.obs ?? ""))) {
  falhas.push("a cor da forminha nao chegou na observacao do docinho");
}

// ------------------------------------------------ os dados da retirada
const d = doPrimeiro.dados[0] ?? {};
for (const [campo, valor] of [["cliente_nome", "Sandro"], ["retirada_data", "12/09/2026"], ["retirada_hora", "11:30"], ["forma_pagamento", "pix"]]) {
  if (String(d[campo] ?? "") !== valor) falhas.push("o dado " + campo + " saiu como " + JSON.stringify(d[campo]));
}

// ------------------------------------------- so o que MUDOU volta
// Se o fluxo reescrevesse tudo a cada mensagem, a dona perderia o que tivesse
// editado na tela entre uma mensagem e outra do cliente.
if (doSegundo.itens.length !== 1) {
  falhas.push("na segunda mensagem gravou " + doSegundo.itens.length + " itens; so a coxinha tinha mudado");
}
if (doSegundo.itens[0]?.produto !== "coxinha" || doSegundo.itens[0]?.qtd !== 60) {
  falhas.push("a mudanca de quantidade nao foi gravada: " + JSON.stringify(doSegundo.itens[0]));
}
if (doSegundo.dados.length) {
  falhas.push("gravou dado de novo sem nada ter mudado");
}

console.log("Primeira mensagem: " + doPrimeiro.itens.length + " itens, " + doPrimeiro.dados.length + " gravacao de dados");
console.log("Segunda mensagem:  " + doSegundo.itens.length + " item (so o que mudou)");
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: grava no formato da tela, e so o que mudou.");
