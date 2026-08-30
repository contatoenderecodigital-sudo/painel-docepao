// CADA PEDIDO TEM SEU ROTEIRO
//
// Pedido do dono, 23/08/2026: "preciso que voce tenha uma lista de ordem de
// coisas que voce tem que perguntar, mas apenas se o cliente responder que sim
// para querer o produto em questao".
//
// Ate aqui existia UMA lista, a da festa, e cada etapa carregava uma marca
// dizendo quando ela nao se aplicava. O resultado pro cliente era o mesmo, mas
// pra saber o que acontece num pedido comum era preciso ler as treze etapas
// marcando na cabeca quais sao puladas. Foi lendo assim que eu me perdi antes.
//
// O QUE ESTE TESTE COBRA
//
// 1. Os dois roteiros existem e tem a ordem certa.
// 2. Festa e conclusao, nao ponto de partida: quem so cumprimentou segue o
//    roteiro comum, e a troca acontece quando ele fala de festa.
// 3. O BOLO AVULSO PERGUNTA O SABOR. Ate 23/08/2026 a etapa do bolo era pulada
//    em todo pedido que nao fosse festa, entao quem encomendava um bolo sozinho
//    nunca era perguntado do sabor: a comanda saia com "1 kg de bolo" e a
//    cozinha sem saber o que assar.
// 4. O ORDER BUMP. Ideia do dono: "tem que pedir se quer docinhos e bolo
//    recheado ne, tem que ter os order bump kkk". Quem leva cem salgados pra
//    sabado quase sempre leva docinho junto, e ninguem oferecia.
//    So oferece o que ele NAO pediu, uma vez so, e nunca na festa: la a
//    proposta ja traz salgado, docinho e bolo juntos.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-roteiro.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { ROTEIRO_DA_FESTA, ROTEIRO_COMUM, roteiroDoPedido } from "../lib/ia/fluxo/etapas.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ofereceu:false,",
    "  ultimaFala:null, insistiu:0, retomarEm:null, assunto:null,",
    "};",
    "const com = (p) => ({ ...VAZIO, ...p });",
    "",
    "// pedido comum, do zero ate a oferta",
    "const salgados = await responder(VAZIO as never, { texto: '100 coxinhas pra sabado' } as never,",
    "  (async () => ({ itens:[{produto:'coxinha',qtd:100}], dados:{data:'29/08/2026'} })) as never);",
    "",
    "// e o bolo avulso, que precisa do sabor igual ao da festa",
    "const boloAvulso = await responder(VAZIO as never, { texto: 'quero um bolo de 2 kg' } as never,",
    "  (async () => ({ itens:[{produto:'bolo',qtd:2}] })) as never);",
    "",
    "// na festa nao se oferece nada: a proposta ja traz tudo",
    "const naFesta = com({ ehFesta:true, pessoas:20, baseAceita:true, naoQuer:['docinho','bolo'],",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "  itens:[{produto:'coxinha',categoria:'salgado_frito',qtd:200,obs:null}] });",
    "const festaSegue = await responder(naFesta as never, { texto: 'so isso' } as never, (async () => ({})) as never);",
    "",
    "console.log(JSON.stringify({",
    "  festa: ROTEIRO_DA_FESTA.map((e) => e.id),",
    "  comum: ROTEIRO_COMUM.map((e) => e.id),",
    "  escolhaSemFesta: roteiroDoPedido(VAZIO as never).map((e) => e.id),",
    "  escolhaComFesta: roteiroDoPedido(com({ ehFesta:true }) as never).map((e) => e.id),",
    "  salgados: { etapa: salgados.etapa, texto: salgados.fala.texto, botoes: salgados.fala.botoes.map((b) => b.id) },",
    "  boloAvulso: { etapa: boloAvulso.etapa, texto: boloAvulso.fala.texto },",
    "  festaSegue: { etapa: festaSegue.etapa, texto: festaSegue.fala.texto },",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-roteiro.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

// ---------------------------------------------- 1. os dois roteiros
// A festa NAO tem a etapa da oferta, de proposito: a proposta ja combinou
// salgado, docinho e bolo juntos, e oferecer de novo o que ele acabou de
// aceitar e empurra, nao atendimento.
// `resto_do_cardapio` entrou em 30/08/2026, depois do bolo e antes das pecas.
//
// Ate ali as etapas de produto eram tres (salgado, docinho, bolo) e cobriam
// 62 dos 86 produtos. Os outros 24 (pizza, torta, empadao, cupcake, pao,
// cuca, calzone, franciscano, bolo salgado) nao tinham etapa nenhuma, e por
// isso a resposta do cliente sobre o TIPO deles chegava numa etapa que nao os
// conhecia e era descartada. A conversa repetia a mesma pergunta ate morrer.
//
// Ela e pulavel e nunca pergunta por iniciativa propria: so entra quando ja
// existe item DELE com o tipo ou o recheio em aberto.
const festaEsperada = [
  "abertura", "quantas_pessoas", "base_da_festa", "salgado", "docinho",
  "bolo", "resto_do_cardapio", "pecas_do_bolo", "dados", "confirmacao", "registrado",
];
if (JSON.stringify(r.festa) !== JSON.stringify(festaEsperada)) {
  falhas.push("o roteiro da festa mudou de ordem: " + r.festa.join(" -> "));
}
// O comum nao tem proposta nem numero de pessoas: ele ja disse o que quer.
for (const proibida of ["quantas_pessoas", "base_da_festa"]) {
  if (r.comum.includes(proibida)) falhas.push("o roteiro comum tem '" + proibida + "', que e coisa de festa");
}
for (const obrigatoria of ["bolo", "pecas_do_bolo", "oferta", "dados", "confirmacao"]) {
  if (!r.comum.includes(obrigatoria)) falhas.push("o roteiro comum nao tem '" + obrigatoria + "'");
}

// ------------------------------- 2. festa e conclusao, nao ponto de partida
if (r.escolhaSemFesta.includes("quantas_pessoas")) {
  falhas.push("quem so cumprimentou ja entrou no roteiro da festa");
}
if (!r.escolhaComFesta.includes("quantas_pessoas")) {
  falhas.push("falou de festa e nao entrou no roteiro da festa");
}

// ------------------------------------------ 3. o bolo avulso pede sabor
if (!/sabor/i.test(r.boloAvulso.texto)) {
  falhas.push("bolo avulso nao perguntou o sabor: a comanda sai com '1 kg de bolo' e a cozinha sem saber o que assar");
}
if (r.boloAvulso.etapa !== "bolo") {
  falhas.push("bolo avulso parou em " + r.boloAvulso.etapa + " em vez da etapa do bolo");
}

// ---------------------------------------------------- 4. o order bump
if (r.salgados.etapa !== "oferta") {
  falhas.push("pedido de cem coxinhas nao passou pela oferta; parou em " + r.salgados.etapa);
}
if (!/docinho/i.test(r.salgados.texto) || !/bolo/i.test(r.salgados.texto)) {
  falhas.push("a oferta nao ofereceu docinho e bolo: " + r.salgados.texto);
}
if (!r.salgados.botoes.includes("oferta_nao")) {
  falhas.push("a oferta nao tem como recusar: sem 'so isso' ela vira empurra");
}
if (r.salgados.botoes.length > 3) {
  falhas.push("a oferta tem mais de tres botoes; o WhatsApp recusa");
}
// Na festa a proposta ja traz tudo: oferecer de novo e empurrar.
if (r.festaSegue.etapa === "oferta" || r.festa.includes("oferta")) {
  falhas.push("ofereceu docinho e bolo dentro da festa, onde a proposta ja combinou os dois");
}

console.log("Festa: " + r.festa.join(" -> "));
console.log("Comum: " + r.comum.join(" -> "));
console.log("Oferta: " + r.salgados.texto + "  [" + r.salgados.botoes.join(", ") + "]");
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: cada pedido segue o seu roteiro, e a oferta so vai onde falta.");
