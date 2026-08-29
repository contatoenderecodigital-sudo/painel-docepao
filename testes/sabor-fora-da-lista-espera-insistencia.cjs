// SABOR FORA DA LISTA SO VAI PRA EQUIPE SE ELE INSISTIR.
//
// POR QUE ISTO EXISTE
//
// A dona: "se o cliente pedir outro sabor, a gente vai colocando". A lista e
// aberta. Mas a padaria mostra o cardapio primeiro: so anota e chama a equipe
// quando ele insiste no que nao esta na lista.
//
// OS DOIS LADOS
//
//   1. na primeira vez, pergunta o sabor do cardapio (nao marca "a confirmar")
//   2. depois de insistir na mesma pergunta, anota e chama a equipe
//   3. sabor que JA ESTA no cardapio nunca vira chamado
//
// Roda com: node testes/sabor-fora-da-lista-espera-insistencia.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-sabor-insistido.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { saborQueFalta } from "../lib/ia/fluxo/sabor.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[],",
    "};",
    "",
    "const pensarPistache = async () => ({ itens:[{ produto:'esfirra', qtd:50, sabor:'pistache' }] });",
    "const pensarCarne = async () => ({ itens:[{ produto:'esfirra', qtd:50, sabor:'carne' }] });",
    "",
    "let e = { ...VAZIO };",
    "const t1 = await responder(e, { texto: '50 esfirra de pistache' }, pensarPistache);",
    "const t2 = await responder(t1.estado, { texto: 'pistache' }, pensarPistache);",
    "const t3 = await responder(t2.estado, { texto: 'pistache' }, pensarPistache);",
    "",
    "const obs1 = t1.estado.itens[0] && t1.estado.itens[0].obs;",
    "const obs3 = t3.estado.itens[0] && t3.estado.itens[0].obs;",
    "",
    "const comCarne = await responder({ ...VAZIO }, { texto: '50 esfirra de carne' }, pensarCarne);",
    "",
    "console.log(JSON.stringify({",
    "  perguntouNoComeco: Boolean(saborQueFalta('esfirra', obs1)),",
    "  marcaNoComeco: /sabor a confirmar/i.test(String(obs1 || '')),",
    "  equipeNoComeco: t1.precisaHumano === true,",
    "  marcaDepois: /sabor a confirmar/i.test(String(obs3 || '')),",
    "  equipeDepois: t3.precisaHumano === true,",
    "  falaDepois: t3.fala.texto,",
    "  carneMarca: /sabor a confirmar/i.test(String((comCarne.estado.itens[0] && comCarne.estado.itens[0].obs) || '')),",
    "  carneEquipe: comCarne.precisaHumano === true,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-sabor-insistido.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, ok, detalhe) => {
  if (ok) {
    console.log("ok    " + rotulo);
    return;
  }
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo);
  if (detalhe) console.log("        " + detalhe);
};

cobra("na primeira vez a padaria ainda pergunta o sabor", r.perguntouNoComeco === true);
cobra("na primeira vez NAO marca sabor a confirmar", r.marcaNoComeco === false, String(r.marcaNoComeco));
cobra("na primeira vez NAO chama a equipe", r.equipeNoComeco === false);
cobra("depois de insistir, anota sabor a confirmar", r.marcaDepois === true, String(r.falaDepois || "").slice(0, 160));
cobra("depois de insistir, chama a equipe", r.equipeDepois === true);
cobra("sabor do cardapio nao vira chamado", r.carneMarca === false && r.carneEquipe === false);

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
