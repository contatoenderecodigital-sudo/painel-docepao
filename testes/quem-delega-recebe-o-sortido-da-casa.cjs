// QUEM DELEGA A ESCOLHA RECEBE O SORTIDO DA CASA.
//
// POR QUE ISTO EXISTE
//
// Regras 25 e 26 do cerebro velho: "escolhe voce, confio" nao pode devolver a
// pergunta dos tipos. A dona ditou o padrao nos audios (20 de cada, 5 sabores
// no cento), e o catalogo ja guarda isso em `_minimo_por_sabor`.
//
// A IA so marca a intencao (`delegaEscolha`). Os produtos saem do catalogo, na
// ordem da casa. Lista de palavra-chave nao entra: o modelo le o pedido do
// jeito dele.
//
// O QUE ELE COBRA (OS DOIS LADOS)
//
//   1. quem delega na etapa do salgado ganha o sortido, e a etapa fecha;
//   2. quem NOMEIA os tipos continua com o que nomeou, mesmo se o modelo
//      mandar o booleano por engano;
//   3. aceitar a proposta ("Pode ser") NAO escolhe sabor nenhum.
//
// Roda com: node testes/quem-delega-recebe-o-sortido-da-casa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-delega-sortido.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { ehNomeDeFamilia } from "../lib/ia/fluxo/generico.ts";',
    'import { etapaDaVez, roteiroDoPedido } from "../lib/ia/fluxo/etapas.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[],",
    "};",
    "const com = (p) => ({ ...VAZIO, ...p });",
    "",
    "const festa = com({",
    "  ehFesta:true, pessoas:20, baseAceita:true,",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "  etapasJaPerguntadas:['quantas_pessoas','base_da_festa'],",
    "});",
    "",
    "const delegou = await responder(festa as never,",
    "  { texto: 'escolhe voce, confio' } as never,",
    "  (async () => ({ delegaEscolha: true })) as never);",
    "",
    "const nomeou = await responder(festa as never,",
    "  { texto: 'quero coxinha e risoles' } as never,",
    "  (async () => ({ itens:[{produto:'coxinha',qtd:0},{produto:'risoles',qtd:0}], delegaEscolha: true })) as never);",
    "",
    "const aceitou = await responder(com({",
    "  ehFesta:true, pessoas:20, baseAceita:false,",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "  etapasJaPerguntadas:['quantas_pessoas'],",
    "}) as never, { texto: '', botaoId: 'base_sim' } as never, (async () => ({})) as never);",
    "",
    "const soFrito = await responder(festa as never,",
    "  { texto: 'pode ser sortido de salgado frito' } as never,",
    "  (async () => ({ itens:[{produto:'salgado frito',qtd:100}], delegaEscolha: true })) as never);",
    "",
    "const propostaNaMesa = com({",
    "  ehFesta:true, pessoas:30, baseAceita:false,",
    "  base:{salgados:300,docinhos:150,boloKg:3,totalCentavos:62820},",
    "  etapasJaPerguntadas:['quantas_pessoas','base_da_festa'],",
    "  dados:{nome:'Carla',data:'10/09',hora:'15:00',pagamento:null},",
    "});",
    "const modeloVazio = await responder(propostaNaMesa as never,",
    "  { texto: 'escolhe voce os tipos, confio' } as never,",
    "  (async () => ({})) as never);",
    "",
    "console.log(JSON.stringify({",
    "  delegou: {",
    "    itens: delegou.estado.itens.map((i) => ({ produto: i.produto, categoria: i.categoria, qtd: i.qtd, obs: i.obs })),",
    "    etapa: etapaDaVez(delegou.estado as never, roteiroDoPedido(delegou.estado as never)).id,",
    "    generico: delegou.estado.itens.some((i) => ehNomeDeFamilia(i.produto)),",
    "  },",
    "  nomeou: nomeou.estado.itens.map((i) => i.produto),",
    "  aceitou: {",
    "    itens: aceitou.estado.itens.map((i) => i.produto),",
    "    baseAceita: aceitou.estado.baseAceita,",
    "  },",
    "  soFrito: soFrito.estado.itens.map((i) => i.categoria),",
    "  modeloVazio: {",
    "    etapa: etapaDaVez(modeloVazio.estado as never, roteiroDoPedido(modeloVazio.estado as never)).id,",
    "    itens: modeloVazio.estado.itens.length,",
    "    fala: modeloVazio.fala.texto,",
    "  },",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-delega-sortido.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

const soma = r.delegou.itens.reduce((s, i) => s + Number(i.qtd || 0), 0);
if (r.delegou.itens.length < 5) {
  falhas.push("quem delegou nao ganhou o sortido da casa: " + r.delegou.itens.length + " item(ns)");
}
if (soma !== 200) {
  falhas.push("o sortido nao somou os 200 da proposta: somou " + soma);
}
if (r.delegou.generico) {
  falhas.push("o sortido deixou nome de familia no pedido");
}
if (r.delegou.itens[0] && r.delegou.itens[0].produto !== "coxinha") {
  falhas.push("o sortido nao comeca pelo catalogo: veio " + r.delegou.itens[0].produto);
}
if (r.delegou.etapa === "salgado") {
  falhas.push("depois de delegar, a etapa do salgado continuou aberta");
}

const nomeados = (r.nomeou || []).map((n) => String(n).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
if (!nomeados.some((n) => n.includes("coxinha")) || !nomeados.some((n) => n.includes("risol"))) {
  falhas.push("quem nomeou coxinha e risoles perdeu o que escolheu: " + nomeados.join(", "));
}
if (nomeados.length > 4) {
  falhas.push("a delegacao apagou a escolha dele e botou sortido em cima: " + nomeados.join(", "));
}

if (!r.aceitou.baseAceita) falhas.push("o botao Pode ser nao aceitou a base");
if (r.aceitou.itens.length) {
  falhas.push("aceitar a proposta escolheu sabor sozinho: " + r.aceitou.itens.join(", "));
}

if (!r.soFrito.length) falhas.push("sortido de salgado frito saiu vazio");
if (r.soFrito.some((c) => c !== "salgado_frito")) {
  falhas.push("sortido de salgado frito misturou assado: " + [...new Set(r.soFrito)].join(", "));
}

if (r.modeloVazio.etapa === "dados") {
  falhas.push("modelo vazio na proposta pulou pro pagamento: " + r.modeloVazio.fala);
}
if (r.modeloVazio.itens !== 0) {
  falhas.push("modelo vazio inventou item: " + r.modeloVazio.itens);
}
if (r.modeloVazio.etapa !== "base_da_festa") {
  falhas.push("modelo vazio saiu da proposta: etapa " + r.modeloVazio.etapa);
}

console.log("itens do sortido: " + r.delegou.itens.length + ", soma " + soma);
console.log("proxima etapa depois de delegar: " + r.delegou.etapa);
console.log("");

if (falhas.length) {
  console.log("ERRO  a delegacao da escolha quebrou (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}
console.log("ok    quem delega recebe o sortido da casa, quem escolhe fica com o que escolheu");
console.log("");
console.log("PASSOU");
