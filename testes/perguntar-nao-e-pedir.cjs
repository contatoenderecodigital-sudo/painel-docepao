// PERGUNTAR NAO E PEDIR, E ELA ESPERA VOCE TERMINAR DE FALAR
//
// As duas ultimas coisas que faltavam do que o dono pediu, e ele foi claro:
// "nao eh pra deixar nada pra tras".
//
// 1. O TERCEIRO ROTEIRO: QUANDO ELE SO QUER SABER
//
//    "Quanto e o cento de salgado?" e a pergunta mais comum da padaria. Nao e
//    pedido de salgado, e a resposta tem que sair certa: o numero vem do
//    cardapio, a mesma fonte do preco do pedido.
//
//    A regra que da nome a este teste vem de defeito real do sistema antigo: a
//    cliente perguntou "0% lactose nao e sem acucar ne?" e ganhou um bolo 0%
//    lactose no pedido dela. Ela nao pediu bolo nenhum.
//
//    E entrega NAO se responde sozinha. Audio da dona: "sempre pedir ajuda pro
//    humano quando e entrega, e dai a gente responde". Depende do entregador e
//    do dia, e prometer entrega que nao acontece e pior que nao ter entrega.
//
// 2. ELA ESPERA O CLIENTE TERMINAR DE FALAR
//
//    Pedido do dono, duas vezes. No teste da Kemilly:
//
//      Kemilly: Bom dia!      Dora: Bom dia, tudo bem? Como posso ajudar?
//      Kemilly: Tudo bem?     Dora: Posso ajudar em algo?
//
//    Duas respostas pra uma pessoa que ainda nem tinha dito o que queria.
//    Ninguem escreve no WhatsApp em paragrafo unico.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-informacao.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ofereceu:false,",
    "  ultimaFala:null, insistiu:0, retomarEm:null, assunto:null,",
    "};",
    "const perguntar = async (leitura) =>",
    "  responder(VAZIO as never, { texto: 'pergunta' } as never, (async () => leitura) as never);",
    "",
    "// A ROTA C: reclamacao, cancelamento e status nao sao pedido.",
    "const situacoes = {};",
    "for (const s of ['reclamacao', 'cancelar', 'status']) {",
    "  const x = await responder(VAZIO as never, { texto: 'nao importa' } as never,",
    "    (async () => ({ situacao: s })) as never);",
    "  situacoes[s] = { texto: x.fala.texto, itens: x.estado.itens.length,",
    "                   precisaHumano: x.precisaHumano, podeReescrever: x.fala.podeReescrever };",
    "}",
    "",
    "const r = {",
    "  salgado: await perguntar({ perguntou: { sobre: 'preco', familia: 'salgado' } }),",
    "  docinho: await perguntar({ perguntou: { sobre: 'preco', familia: 'docinho' } }),",
    "  bolo:    await perguntar({ perguntou: { sobre: 'preco', familia: 'bolo' } }),",
    "  horario: await perguntar({ perguntou: { sobre: 'horario' } }),",
    "  endereco:await perguntar({ perguntou: { sobre: 'endereco' } }),",
    "  entrega: await perguntar({ perguntou: { sobre: 'entrega' } }),",
    "  pagamento: await perguntar({ perguntou: { sobre: 'pagamento' } }),",
    "};",
    "",
    "console.log(JSON.stringify({ ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, {",
    "  texto: v.fala.texto, itens: v.estado.itens.length, precisaHumano: v.precisaHumano,",
    "  podeReescrever: v.fala.podeReescrever,",
    "}])), situacoes }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-informacao.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

// -------------------------------------------- perguntar nao anota nada
for (const [caso, x] of Object.entries(r)) {
  if (x.itens > 0) {
    falhas.push("perguntar sobre " + caso + " anotou " + x.itens + " item no pedido; perguntar nao e pedir");
  }
}

// ------------------------------------------ o preco sai do cardapio
if (!/R\$ 100,00/.test(r.salgado.texto)) falhas.push("o cento de salgado nao saiu do cardapio: " + r.salgado.texto);
if (!/R\$ 1,25/.test(r.docinho.texto)) falhas.push("o preco do docinho nao saiu do cardapio: " + r.docinho.texto);
if (!/46,90|55,90/.test(r.bolo.texto)) falhas.push("o preco do bolo nao saiu do cardapio: " + r.bolo.texto);
// E onde tem valor, a IA nao reescreve.
for (const caso of ["salgado", "docinho", "bolo"]) {
  if (r[caso].podeReescrever) falhas.push("a resposta de preco de " + caso + " pode ser reescrita pela IA");
}

// ------------------------------------ horario e endereco sao os da casa
if (!/6h30/.test(r.horario.texto)) falhas.push("o horario respondido nao e o da padaria: " + r.horario.texto);
if (!/Independ/.test(r.endereco.texto)) falhas.push("o endereco respondido nao e o da padaria: " + r.endereco.texto);

// ------------------------------------------- entrega e sempre humano
if (!r.entrega.precisaHumano) {
  falhas.push("ela respondeu sobre entrega sozinha; a dona pediu que isso sempre passe pra equipe");
}
for (const caso of ["salgado", "horario", "endereco", "pagamento"]) {
  if (r[caso].precisaHumano) falhas.push("chamou a equipe pra responder " + caso + ", que ela sabe responder");
}

// ------------------------------------- 2. a espera, conferida no codigo
const rota = fs.readFileSync(path.join(__dirname, "..", "app/api/whatsapp/route.ts"), "utf8");
if (!/ESPERA_ANTES_DE_RESPONDER/.test(rota)) {
  falhas.push("a espera sumiu: ela volta a responder duas vezes quem manda duas mensagens seguidas");
}
if (!/clienteFalouDepois\(negocioId, clienteId, marco\)/.test(rota)) {
  falhas.push("ela espera mas nao confere se o cliente falou de novo; a espera sozinha nao resolve nada");
}
if (!/falasSemResposta/.test(rota)) {
  falhas.push("ela nao junta as mensagens pendentes: responderia so a ultima e ignoraria as outras");
}
// Botao nao espera: o toque e a fala inteira, nao tem continuacao.
if (!/if \(!botaoId\)/.test(rota)) {
  falhas.push("o toque em botao passou a esperar tambem; botao nao tem continuacao");
}

// ---------------------------- A ROTA C: reclamacao nunca vira pedido
//
// O conselho que o dono trouxe em 24/08/2026 da o exemplo exato do buraco que
// tinhamos: "Meu pao veio queimado. Corta a IA e chama um atendente humano."
//
// Ate aqui isso caia no fluxo de pedido e a Dora tentava montar uma encomenda.
// E o momento em que o cliente esta bravo e a IA esta oferecendo docinho.
for (const [caso, x] of Object.entries(r.situacoes)) {
  if (x.itens > 0) falhas.push("'" + caso + "' anotou item no pedido; nada disso e pedido");
  if (x.podeReescrever) falhas.push("a resposta de '" + caso + "' pode ser reescrita pela IA");
}
// Reclamacao e cancelamento sao SEMPRE da equipe: mexem com dinheiro e com
// producao que talvez ja tenha comecado.
for (const caso of ["reclamacao", "cancelar"]) {
  if (!r.situacoes[caso].precisaHumano) {
    falhas.push("'" + caso + "' nao chamou a equipe; isso nao e decisao de robo");
  }
}
// E ela nao promete nada no lugar da dona.
if (/desconto|devolv|refaz|reembols/i.test(r.situacoes.reclamacao.texto)) {
  falhas.push("ela prometeu solucao de reclamacao no lugar da equipe: " + r.situacoes.reclamacao.texto);
}

console.log("Reclamacao: " + r.situacoes.reclamacao.texto);
console.log("Salgado:  " + r.salgado.texto);
console.log("Docinho:  " + r.docinho.texto);
console.log("Entrega:  chama a equipe = " + r.entrega.precisaHumano);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: quem pergunta recebe resposta e nao ganha pedido, e ela espera ele terminar.");
