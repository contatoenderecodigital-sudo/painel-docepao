// OITO PALAVRAS DO CARDAPIO SAO PRODUTO E SABOR DE OUTRO PRODUTO AO MESMO TEMPO.
//
// Levantadas em 30/08/2026 contra o catalogo inteiro, e nao a mao:
//
//   brigadeiro     docinho E bolo de festa E sabor de trufa, pizza, cupcake...
//   cafe           docinho E bolo caseiro E sabor de trufa
//   4 leites       bolo de festa E sabor de cupcake
//   prestigio      bolo de festa E sabor de pizza, torta doce, calzone
//   porto alegre   bolo de festa E sabor de torta doce
//   bombom         bolo de festa E sabor de torta doce
//   morango        bolo de festa E sabor de trufa e torta doce
//   limao          bolo caseiro E sabor de trufa, torta doce, cuca recheada
//
// O DOCUMENTO CITAVA TRES. Sao oito, e as cinco que faltavam eram as caras.
//
// O que acontecia, medido antes do conserto:
//
//   "quero 50 de morango"    ->  50 kg de bolo morango      R$ 2.345,00
//   "quero 50 de limao"      ->  50 bolos caseiros limao    R$ 1.545,00
//   "quero 50 bombom"        ->  50 kg de bolo bombom
//   "quero 50 prestigio"     ->  50 kg de bolo prestigio
//
// E o codigo ainda marcava `unico: true`, ou seja, se dava por certo: a marca de
// ambiguidade so olhava se o NOME batia com produtos de categorias diferentes, e
// nao sabia que a palavra tambem era sabor. A marca, alias, nao era lida por
// ninguem: existia e nao fazia nada.
//
// AS DUAS REGUAS, e nenhuma sozinha resolve:
//
//   1. bolo por quilo nao passa de 6, que e o maior da casa ("quadrado de
//      2,5 kg a 6 kg", do proprio catalogo). 50 nao e peso de bolo.
//   2. bolo por UNIDADE nao tem teto de peso, e escapava da primeira. Ali o que
//      denuncia e o nome ter palavra que o cliente NAO disse ("caseiro") junto
//      com a palavra dita ser sabor de outro produto. Sozinhas as duas erram:
//      "cenoura" tambem vira "bolo caseiro cenoura" sem ele dizer "caseiro", e
//      ali esta certo, porque cenoura nao e sabor de mais nada.
//
// No lugar do bolo entra a FAMILIA, que e a forma que o fluxo ja usa pra "nao
// sei qual, pergunta". A padaria pergunta em vez de anotar dois mil reais.
//
// Roda com: node testes/palavra-que-e-produto-e-sabor.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  { fala: "quero 50 de morango", leitura: { itens: [{ produto: "morango", qtd: 50 }] }, espera: ["50 ~ bolo"], dano: "50 kg de bolo morango, R$ 2.345,00" },
  { fala: "quero 50 de limao", leitura: { itens: [{ produto: "limao", qtd: 50 }] }, espera: ["50 ~ bolo"], dano: "50 bolos caseiros de limao, R$ 1.545,00" },
  { fala: "quero 50 bombom", leitura: { itens: [{ produto: "bombom", qtd: 50 }] }, espera: ["50 ~ bolo"], dano: "50 kg de bolo bombom" },
  { fala: "quero 50 prestigio", leitura: { itens: [{ produto: "prestigio", qtd: 50 }] }, espera: ["50 ~ bolo"], dano: "50 kg de bolo prestigio" },
  { fala: "quero 50 de porto alegre", leitura: { itens: [{ produto: "porto alegre", qtd: 50 }] }, espera: ["50 ~ bolo"], dano: "50 kg de bolo porto alegre" },
  { fala: "quero 50 de 4 leites", leitura: { itens: [{ produto: "4 leites", qtd: 50 }] }, espera: ["50 ~ bolo"], dano: "50 kg de bolo 4 leites" },

  // O QUE NAO PODE QUEBRAR. Cada um destes ja custou dinheiro na direcao
  // contraria, e a guarda nova nao pode desfazer nenhum.
  { fala: "quero 50 de cafe", leitura: { itens: [{ produto: "cafe", qtd: 50 }] }, espera: ["50 ~ café"], dano: "cafe E docinho de verdade; virar familia faria a padaria perguntar o obvio" },
  { fala: "quero 100 brigadeiro", leitura: { itens: [{ produto: "brigadeiro", qtd: 100 }] }, espera: ["100 ~ brigadeiro"], dano: "brigadeiro E docinho de verdade" },
  { fala: "quero um bolo de 3 kg de morango", leitura: { itens: [{ produto: "bolo morango", qtd: 3 }] }, espera: ["3 ~ bolo morango"], dano: "quem pede bolo de morango de 3 kg leva bolo de morango" },
  { fala: "quero um bolo caseiro de limao", leitura: { itens: [{ produto: "bolo caseiro limao", qtd: 1 }] }, espera: ["1 ~ bolo caseiro limão"], dano: "ele disse caseiro; a palavra que ele falou vale" },
  { fala: "quero um bolo de cenoura", leitura: { itens: [{ produto: "cenoura", qtd: 1 }] }, espera: ["1 ~ bolo caseiro cenoura"], dano: "cenoura nao e sabor de mais nada: nao ha ambiguidade pra resolver" },
  { fala: "quero 2 pizzas inteiras", leitura: { itens: [{ produto: "pizza inteira", qtd: 2 }] }, espera: ["2 ~ pizza inteira"], dano: "a guarda nao pode encostar em produto que nao e bolo" },
  { fala: "quero 200 coxinhas", leitura: { itens: [{ produto: "coxinha", qtd: 200 }] }, espera: ["200 ~ coxinha"], dano: "200 salgados e o pedido mais comum da casa" },
];

const sonda = path.join(__dirname, "_sonda-produto-e-sabor.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[],",
    "};",
    "const pensar = (l) => (async () => l);",
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const r = await responder(VAZIO as never, { texto: c.fala }, pensar(c.leitura) as never);",
    "  saiu.push((r.estado.itens || []).map((i) => i.qtd + ' ~ ' + i.produto));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-produto-e-sabor.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== palavra que e produto e tambem sabor de outro ==");
CASOS.forEach((c, n) => {
  const ok = JSON.stringify(saiu[n]) === JSON.stringify(c.espera);
  console.log(
    (ok ? "ok    " : "ERRO  ") + c.fala +
    (ok ? "" : "  ->  ficou " + JSON.stringify(saiu[n]) + ", esperado " + JSON.stringify(c.espera) + "; " + c.dano),
  );
  if (!ok) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
