// A BASE DA FESTA NAO VIRA PIZZA, NEM DOCINHO.
//
// POR QUE ISTO EXISTE
//
// Medido em 30/08/2026, conversa ao vivo via /api/testar-ia. Festa pra 20,
// base 200 salgados / 100 docinhos / 2 kg de bolo aceita. Cliente: "quero
// pizza, e salgado tambem", depois "redonda". Rastro:
//
//     reparti 200 de salgado entre 1 escolha(s)
//
// Resultado: 200 kg de pizza redonda com categoria salgado_frito. Inventou
// pizza inteira de bacon. "de frango" depois de 50 coxinha grudou na pizza.
// 50 coxinha virou 100, depois 66. 80 brigadeiro entrou como salgado_frito e
// foi comido pelo mesmo rateio. Forminha "escolhe voce" repetiu "quais
// docinhos". Data, nome e pix na mesma frase nao entraram.
//
// O balde `salgados: 200` e CONTA de salgadinho. Pizza nao e salgado de festa.
// Brigadeiro e docinho. Quem disse 50 coxinha disse 50, mesmo com base 200.
//
// O OUTRO LADO: so coxinha e risoles, sem numero, os 200 se repartem entre os
// dois. Quem delega e quem ajusta a base continuam nos testes deles.
//
// Roda com: node testes/a-festa-nao-reparte-pizza.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-festa-nao-pizza.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { categoriaDaEtapa } from "../lib/ia/fluxo/fluxo.ts";',
    'import { juntarComAFrase } from "../lib/ia/fluxo/leitor-da-frase.ts";',
    'import { etapaDaVez, roteiroDoPedido } from "../lib/ia/fluxo/etapas.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[],",
    "};",
    "const festa = {",
    "  ...VAZIO, ehFesta:true, pessoas:20, baseAceita:true,",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "  etapasJaPerguntadas:['quantas_pessoas','base_da_festa'],",
    "};",
    "",
    "const redonda = await responder(festa as never,",
    "  { texto: 'redonda entao' } as never,",
    "  (async () => ({ itens:[",
    "    {produto:'pizza redonda',qtd:1},",
    "    {produto:'pizza inteira',qtd:1,sabor:'bacon'},",
    "  ] })) as never);",
    "const pizzaECoxinha = await responder(redonda.estado as never,",
    "  { texto: 'me ve 50 coxinha tbm' } as never,",
    "  (async () => ({ itens:[{produto:'coxinha',qtd:50}] })) as never);",
    "",
    "const soCinquenta = await responder(festa as never,",
    "  { texto: 'me ve 50 coxinha tbm' } as never,",
    "  (async () => ({ itens:[{produto:'coxinha',qtd:50}] })) as never);",
    "const depoisSemNumero = await responder(soCinquenta.estado as never,",
    "  { texto: 'pode ser' } as never,",
    "  (async () => ({})) as never);",
    "",
    "const comPizzaEsperando = {",
    "  ...festa,",
    "  itens:[",
    "    {produto:'pizza redonda',categoria:'pizza',qtd:1,obs:null},",
    "    {produto:'coxinha',categoria:'salgado_frito',qtd:50,obs:null},",
    "  ],",
    "};",
    "const deFrango = await responder(comPizzaEsperando as never,",
    "  { texto: 'de frango' } as never,",
    "  (async () => ({})) as never);",
    "",
    "const brigadeiro = await responder(festa as never,",
    "  { texto: 'e 80 brigadeiro' } as never,",
    "  (async () => ({ itens:[{produto:'brigadeiro',qtd:80}] })) as never);",
    "",
    "const doisSalgados = await responder(festa as never,",
    "  { texto: 'coxinha e risoles' } as never,",
    "  (async () => ({ itens:[{produto:'coxinha',qtd:0},{produto:'risoles',qtd:0}] })) as never);",
    "",
    "const comBrigadeiro = {",
    "  ...festa,",
    "  itens:[{produto:'brigadeiro',categoria:'docinho',qtd:80,obs:null}],",
    "  etapasJaPerguntadas:['quantas_pessoas','base_da_festa','salgado','docinho'],",
    "};",
    "const forminha = await responder(comBrigadeiro as never,",
    "  { texto: 'escolhe voce a cor da forminha, confio' } as never,",
    "  (async () => ({ delegaEscolha: true })) as never);",
    "",
    "const dadosNaFrase = juntarComAFrase({}, 'retiro dia 05/09 as 16h, nome Renata Alves, pix');",
    "const dadosNoFluxo = await responder(comBrigadeiro as never,",
    "  { texto: 'retiro dia 05/09 as 16h, nome Renata Alves, pix' } as never,",
    "  (async () => ({})) as never);",
    "",
    "console.log(JSON.stringify({",
    "  cats: {",
    "    pizzaNaSalgado: categoriaDaEtapa('salgado', 'pizza redonda'),",
    "    brigadeiroNaSalgado: categoriaDaEtapa('salgado', 'brigadeiro'),",
    "    coxinhaNaSalgado: categoriaDaEtapa('salgado', 'coxinha'),",
    "  },",
    "  pizzaECoxinha: pizzaECoxinha.estado.itens.map((i) => ({ produto:i.produto, categoria:i.categoria, qtd:i.qtd })),",
    "  rastroPizza: [...(redonda.rastro||[]), ...(pizzaECoxinha.rastro||[])],",
    "  soCinquenta: soCinquenta.estado.itens.map((i) => ({ produto:i.produto, qtd:i.qtd, categoria:i.categoria })),",
    "  depoisSemNumero: depoisSemNumero.estado.itens.map((i) => ({ produto:i.produto, qtd:i.qtd })),",
    "  deFrango: deFrango.estado.itens.map((i) => ({ produto:i.produto, obs:i.obs, qtd:i.qtd })),",
    "  brigadeiro: brigadeiro.estado.itens.map((i) => ({ produto:i.produto, categoria:i.categoria, qtd:i.qtd })),",
    "  doisSalgados: doisSalgados.estado.itens.map((i) => ({ produto:i.produto, categoria:i.categoria, qtd:i.qtd })),",
    "  forminha: forminha.estado.forminha,",
    "  falaForminha: forminha.fala.texto,",
    "  etapaForminha: etapaDaVez(forminha.estado as never, roteiroDoPedido(forminha.estado as never)).id,",
    "  dadosNaFrase: dadosNaFrase.dados,",
    "  dadosNoFluxo: dadosNoFluxo.estado.dados,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-festa-nao-pizza.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

const cobra = (rotulo, ok, detalhe) => {
  if (ok) console.log("ok    " + rotulo);
  else {
    falhas.push(rotulo);
    console.log("ERRO  " + rotulo);
    if (detalhe) console.log("        " + detalhe);
  }
};

cobra("pizza na etapa do salgado continua pizza", r.cats.pizzaNaSalgado === "pizza",
  JSON.stringify(r.cats.pizzaNaSalgado));
cobra("brigadeiro na etapa do salgado continua docinho", r.cats.brigadeiroNaSalgado === "docinho",
  JSON.stringify(r.cats.brigadeiroNaSalgado));
cobra("coxinha na etapa do salgado continua frito", r.cats.coxinhaNaSalgado === "salgado_frito",
  JSON.stringify(r.cats.coxinhaNaSalgado));

const porNome = (lista, nome) => (lista || []).find((i) => String(i.produto).toLowerCase().includes(nome));
const pizza = porNome(r.pizzaECoxinha, "pizza redonda");
const coxinha = porNome(r.pizzaECoxinha, "coxinha");
const inteira = (r.pizzaECoxinha || []).find((i) => /pizza inteira/i.test(i.produto));

cobra("pizza redonda nao leva os 200 da base", pizza && Number(pizza.qtd) !== 200 && Number(pizza.qtd) <= 2,
  JSON.stringify(pizza));
cobra("pizza redonda nao e salgado_frito", pizza && pizza.categoria === "pizza",
  JSON.stringify(pizza));
cobra("coxinha fica 50 quando ele disse 50", coxinha && Number(coxinha.qtd) === 50,
  JSON.stringify(coxinha));
cobra("nao inventa pizza inteira de bacon", !inteira,
  JSON.stringify(r.pizzaECoxinha));
cobra("o rastro nao reparte 200 numa pizza so",
  !(r.rastroPizza || []).some((x) => /reparti 200 de salgado entre 1/.test(String(x))),
  JSON.stringify(r.rastroPizza));

const cox50 = porNome(r.soCinquenta, "coxinha");
cobra("50 coxinha sozinha fica 50", cox50 && Number(cox50.qtd) === 50, JSON.stringify(r.soCinquenta));
const coxDepois = porNome(r.depoisSemNumero, "coxinha");
cobra("50 coxinha nao vira 200 numa fala sem numero", coxDepois && Number(coxDepois.qtd) === 50,
  JSON.stringify(r.depoisSemNumero));

const pizzaFrango = porNome(r.deFrango, "pizza");
const coxFrango = porNome(r.deFrango, "coxinha");
cobra("de frango depois da coxinha nao vai pra pizza",
  pizzaFrango && !/frango/i.test(String(pizzaFrango.obs || "")),
  JSON.stringify(r.deFrango));
cobra("de frango fica na coxinha",
  coxFrango && /frango/i.test(String(coxFrango.obs || "")),
  JSON.stringify(r.deFrango));
cobra("coxinha continua 50 depois de de frango", coxFrango && Number(coxFrango.qtd) === 50,
  JSON.stringify(coxFrango));

const brig = porNome(r.brigadeiro, "brigadeiro");
cobra("80 brigadeiro fica docinho", brig && brig.categoria === "docinho" && Number(brig.qtd) === 80,
  JSON.stringify(r.brigadeiro));

const qtds = (r.doisSalgados || []).map((i) => Number(i.qtd) || 0);
const soma = qtds.reduce((s, n) => s + n, 0);
const cats = [...new Set((r.doisSalgados || []).map((i) => i.categoria))];
cobra("coxinha e risoles repartem os 200", qtds.length === 2 && soma === 200 && qtds.every((q) => q > 0),
  JSON.stringify(r.doisSalgados));
cobra("o rateio legitimo so pega salgado de verdade",
  cats.every((c) => c === "salgado_frito" || c === "salgado_assado"),
  JSON.stringify(cats));

cobra("delega a forminha escolhe uma cor do cardapio", Boolean(r.forminha),
  JSON.stringify(r.forminha));
cobra("delega a forminha nao pergunta quais docinhos",
  !/quais docinhos/i.test(String(r.falaForminha || "")),
  String(r.falaForminha || "").slice(0, 120));

cobra("a frase traz data, nome e pix mesmo fora da etapa",
  r.dadosNaFrase && r.dadosNaFrase.data && r.dadosNaFrase.nome && r.dadosNaFrase.pagamento === "pix",
  JSON.stringify(r.dadosNaFrase));
cobra("dados na etapa do docinho entram no pedido",
  r.dadosNoFluxo && r.dadosNoFluxo.nome && /renata/i.test(String(r.dadosNoFluxo.nome)) &&
    r.dadosNoFluxo.pagamento === "pix" && r.dadosNoFluxo.data && r.dadosNoFluxo.hora,
  JSON.stringify(r.dadosNoFluxo));

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
