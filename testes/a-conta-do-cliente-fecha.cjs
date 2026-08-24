// A CONTA DO CLIENTE FECHA
//
// Segundo teste da Kemilly no celular dela, 23/08/2026. O pedido inteiro saiu
// errado, e a raiz foi UMA coisa que estragou todo o resto.
//
// 1. A PROPOSTA NAO ERA REPARTIDA
//
//    Ela aceitou "200 salgados no total, 100 docinhos e 2 kg de bolo" e depois
//    escreveu "coxinha e mini bolha de carne", sem numero nenhum.
//
//    O pedido saiu com 1 COXINHA e 1 MINI BOLHA. Total do pedido: R$ 114,55,
//    quando a proposta que ela aceitou dava R$ 418,80.
//
//    Minha instrucao mandava o modelo devolver quantidade ZERO quando o cliente
//    nao dissesse numero, e o modelo devolveu 1. Prompt pede, codigo garante:
//    quem sabe se houve numero e a MENSAGEM DELE, nao o modelo. Sem digito na
//    fala, a quantidade vem da proposta e o que o modelo mandou nao vale.
//
// 2. "4 LEITES E BIZ" VIROU DOIS BOLOS
//
//    Ela queria UM bolo com dois sabores, que e o que qualquer pessoa entende.
//    Saiu "1 kg de bolo 4 leites" e "1 kg de bolo de bizcoito", dois bolos de um
//    quilo. Nota da dona no cardapio: "bolo misto vale o sabor mais caro".
//
// 3. O RESUMO NAO MOSTRAVA O VALOR DE CADA LINHA
//
//    Pedido do dono: "ja tem que colocar o valor de cada produto do lado de cada
//    um, igual na comanda, quantidade x preco". Resumo que so mostra o total
//    obriga o cliente a confiar, e cliente que nao consegue conferir liga pra
//    padaria.
//
// 4. ELA PERGUNTOU O NOME DO TOPO PRA QUEM RECUSOU O TOPO
//
//    Kemilly respondeu NAO pro topo e SIM pro papel de arroz, e levou "qual nome
//    e idade vao no TOPO?".
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-conta.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { falaDaEtapa } from "../lib/ia/fluxo/pergunta.ts";',
    'import { ROTEIRO_DA_FESTA } from "../lib/ia/fluxo/etapas.ts";',
    'import { motorPadrao } from "../lib/ia/orcamento.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ofereceu:false,",
    "  ultimaFala:null, insistiu:0, retomarEm:null, assunto:null,",
    "};",
    "",
    "// A conversa da Kemilly, do jeito que ela fez, com o modelo devolvendo",
    "// quantidade 1 em tudo (que foi o que aconteceu de verdade).",
    "const passos = [",
    "  ['Quero encomendar pra uma festa bolo e docinhos e salgados', { ehFesta:true, itens:[{produto:'bolo',qtd:1}] }],",
    "  ['20 pessoas', { pessoas:20 }],",
    "  ['', {}, 'base_sim'],",
    "  ['coxinha e mini bolha de carne', { itens:[{produto:'coxinha',qtd:1},{produto:'mini bolha',qtd:1,obs:'carne'}] }],",
    "  ['beijinho e cafe e brigadeiro', { itens:[{produto:'beijinho',qtd:1},{produto:'café',qtd:1},{produto:'brigadeiro',qtd:1}] }],",
    "  ['pode ser tudo rosa', { forminha:'rosa' }],",
    "  ['4 leites e biz', { itens:[{produto:'4 leites',qtd:1},{produto:'biz',qtd:1}] }],",
    "  ['', {}, 'prato_tampa'],",
    "  ['', {}, 'topo_nao'],",
    "  ['', {}, 'papel_sim'],",
    "  ['quero do homem aranha', { tema:'Homem Aranha' }],",
    "];",
    "let e: Record<string, unknown> = VAZIO;",
    "const falas = [];",
    "for (const [texto, leitura, botao] of passos as never[]) {",
    "  const r = await responder(e as never, { texto, botaoId: botao ?? null } as never,",
    "    (async () => leitura) as never);",
    "  e = r.estado as never;",
    "  falas.push({ entrada: botao ?? texto, etapa: r.etapa, texto: r.fala.texto });",
    "}",
    "",
    "// e o resumo, com os dados de retirada preenchidos",
    "const fechado = { ...e, dados:{nome:'Kemilly',data:'02/09/2026',hora:'18:30',pagamento:'pix'},",
    "  topoNome:'Arthur', topoIdade:'3 anos' };",
    "const cot = motorPadrao.cotarPorItens((fechado.itens as never[]).map((i: never) =>",
    "  ({ item: i.produto, qtd: i.qtd, obs: i.obs ?? undefined })));",
    "const total = Math.round(Number(cot.total || 0) * 100);",
    "const resumo = falaDaEtapa(ROTEIRO_DA_FESTA.find((x) => x.id === 'confirmacao')!, fechado as never, total);",
    "",
    "",
    "// CADA CLIENTE ESCREVE DE UM JEITO.",
    "//",
    "// Pergunta do dono: 'vc corrigiu pra agora funcionar ou pra todos os casos,",
    "// pq cada cliente eh de um jeito ne mano'. Ele estava certo: a primeira",
    "// versao procurava DIGITO na mensagem, e 'quero cinquenta coxinhas' virava",
    "// 200 coxinhas, porque o codigo achava que ele nao tinha dito numero.",
    "const soSalgado = { ...VAZIO, ehFesta:true, pessoas:20, baseAceita:true, naoQuer:['docinho','bolo'],",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880} };",
    "const jeitos = [];",
    "for (const [fala, itens] of [",
    "  ['coxinha e risoles', [{produto:'coxinha',qtd:1},{produto:'risólis',qtd:1}]],",
    "  ['quero cinquenta coxinhas', [{produto:'coxinha',qtd:50}]],",
    "  ['meia duzia de coxinha', [{produto:'coxinha',qtd:6}]],",
    "  ['so coxinha mesmo', [{produto:'coxinha',qtd:1}]],",
    "  ['100 coxinhas', [{produto:'coxinha',qtd:100}]],",
    "] as never[]) {",
    "  const r = await responder(soSalgado as never, { texto: fala } as never, (async () => ({ itens })) as never);",
    "  jeitos.push({ fala, itens: (r.estado.itens as never[]).map((i: never) => i.qtd + ' ' + i.produto) });",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  itens: e.itens, falas, resumo: resumo.texto, total, jeitos,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-conta.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const qtd = (nome) => Number((r.itens.find((i) => i.produto === nome) ?? {}).qtd || 0);

// ------------------------------- 1. a proposta virou quantidade de verdade
const salgados = r.itens.filter((i) => String(i.categoria).startsWith("salgado")).reduce((s, i) => s + Number(i.qtd), 0);
const docinhos = r.itens.filter((i) => String(i.categoria).startsWith("docinho")).reduce((s, i) => s + Number(i.qtd), 0);
const bolo = r.itens.filter((i) => String(i.categoria).startsWith("bolo")).reduce((s, i) => s + Number(i.qtd), 0);
if (salgados !== 200) falhas.push("a proposta era de 200 salgados e o pedido ficou com " + salgados);
if (docinhos !== 100) falhas.push("a proposta era de 100 docinhos e o pedido ficou com " + docinhos);
if (bolo !== 2) falhas.push("a proposta era de 2 kg de bolo e o pedido ficou com " + bolo);
if (qtd("coxinha") === 1) falhas.push("a coxinha ficou com quantidade 1: a proposta nao foi repartida");

// ------------------------------------------- 2. "4 leites e biz" e UM bolo
const bolos = r.itens.filter((i) => String(i.categoria).startsWith("bolo"));
if (bolos.length !== 1) falhas.push("'4 leites e biz' virou " + bolos.length + " bolos; era um bolo misto");
if (bolos[0] && !/misto/i.test(String(bolos[0].obs ?? ""))) {
  falhas.push("o bolo misto nao diz os dois sabores na observacao: " + bolos[0]?.obs);
}
// O misto vale o sabor mais caro (nota da dona no cardapio): biz e faixa B.
if (bolos[0] && bolos[0].produto !== "biz") {
  falhas.push("o bolo misto foi cotado por '" + bolos[0].produto + "'; a dona cobra o sabor mais caro");
}
if (String(bolos[0]?.obs ?? "").includes("misto: bolo")) {
  falhas.push("o 'bolo' sem sabor entrou na mistura; ele e marcador de lugar, nao sabor");
}

// ------------------------------------- 3. cada linha do resumo com valor
for (const parte of ["R$ 1,00 cada", "R$ 49,90/kg", "R$ 12,00 cada"]) {
  if (!r.resumo.includes(parte)) falhas.push("o resumo nao mostra '" + parte + "'; o dono pediu valor em cada linha");
}
// E o total tem que ser a soma do que esta escrito.
const somaDasLinhas = [...r.resumo.matchAll(/= R\$ ([\d.]+),(\d{2})/g)]
  .reduce((s, m) => s + Number(m[1].replace(".", "")) * 100 + Number(m[2]), 0);
if (Math.abs(somaDasLinhas - r.total) > 1) {
  falhas.push("o total (" + r.total + ") nao e a soma das linhas do resumo (" + somaDasLinhas + ")");
}

// -------------------------------- 4. a pergunta fala da peca que ele pediu
const perguntaDoNome = r.falas.find((f) => /nome/i.test(f.texto) && /idade/i.test(f.texto));
if (!perguntaDoNome) {
  falhas.push("ela nao perguntou nome e idade pra quem pediu papel de arroz");
} else if (/topo/i.test(perguntaDoNome.texto)) {
  falhas.push("ela falou em TOPO pra quem recusou o topo: " + perguntaDoNome.texto);
}

// ------------------- e a ordem: a proposta vem antes de escolher o bolo
const ordem = r.falas.map((f) => f.etapa);
if (ordem.indexOf("bolo") >= 0 && ordem.indexOf("base_da_festa") > ordem.indexOf("bolo")) {
  falhas.push("ela perguntou o sabor do bolo antes da proposta; o cliente escolhe sem saber quanto da");
}

// ------------------- 5. cada cliente escreve a quantidade de um jeito
const jeito = (fala) => (r.jeitos.find((j) => j.fala === fala) ?? {}).itens?.join(", ") ?? "";
const esperado = {
  "coxinha e risoles": "100 coxinha, 100 risólis", // sem numero: reparte a proposta
  "quero cinquenta coxinhas": "50 coxinha", // por extenso, e a dele manda
  "meia duzia de coxinha": "6 coxinha",
  "so coxinha mesmo": "200 coxinha", // um sabor so leva a proposta inteira
  "100 coxinhas": "100 coxinha",
};
for (const [fala, deve] of Object.entries(esperado)) {
  if (jeito(fala) !== deve) {
    falhas.push("'" + fala + "' virou '" + jeito(fala) + "' em vez de '" + deve + "'");
  }
}

console.log("Jeitos de dizer a quantidade: " + r.jeitos.map((j) => j.fala + " -> " + j.itens.join("+")).join(" | "));
console.log("Pedido: " + r.itens.map((i) => i.qtd + " " + i.produto).join(", "));
console.log("Total: R$ " + (r.total / 100).toFixed(2));
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: a proposta vira quantidade, o misto e um bolo so, e cada linha mostra o seu valor.");
