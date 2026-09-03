// O PEDIDO MISTURA TUDO NA MESMA CONVERSA.
//
// POR QUE ISTO EXISTE
//
// A dona, sobre o que entra num pedido: "nunca se sabe". Festa, pizza, salgado,
// docinho e bolo cabem na MESMA conversa. O defeito ao vivo, 30/08/2026: festa
// pra 20, base 200/100/2 kg aceita, "quero pizza, e salgado tambem", "redonda",
// "50 coxinha", brigadeiro. A pizza saiu como salgado_frito e comeu os 200 da
// base. A coxinha nao ficou 50. O brigadeiro entrou no rateio do salgado.
// Uma das linhas sumiu.
//
// Mini pizza e o unico "pizza" que e salgado: esta no catalogo como assado.
// Pizza redonda, inteira, meia e calzone nao entram no balde dos 200.
//
// O OUTRO LADO: so coxinha e risoles, sem numero, os 200 se repartem entre os
// dois. Misturar nao pode quebrar o rateio legitimo da festa.
//
// Roda com: node testes/o-pedido-mistura-tudo.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-pedido-mistura.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder, categoriaDaEtapa } from "../lib/ia/fluxo/fluxo.ts";',
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
    "const pensar = (leitura) => (async () => leitura);",
    "",
    "const pizzaESalgado = await responder(festa as never,",
    "  { texto: 'quero pizza, e salgado tambem' } as never,",
    "  pensar({ itens:[{produto:'pizza',qtd:1}] }) as never);",
    "const redonda = await responder(pizzaESalgado.estado as never,",
    "  { texto: 'redonda entao' } as never,",
    "  pensar({ itens:[{produto:'pizza redonda',qtd:1}] }) as never);",
    "const coxinha = await responder(redonda.estado as never,",
    "  { texto: 'me ve 50 coxinha tbm' } as never,",
    "  pensar({ itens:[{produto:'coxinha',qtd:50}] }) as never);",
    "const brigadeiro = await responder(coxinha.estado as never,",
    "  { texto: 'e brigadeiro' } as never,",
    "  pensar({ itens:[{produto:'brigadeiro',qtd:0}] }) as never);",
    "const saborPizza = await responder(brigadeiro.estado as never,",
    "  { texto: 'calabresa' } as never,",
    // O MODELO LE ISTO (medido 3 de 3 em 03/09/2026, vendo a conversa). O bloco
    // que distribuia o sabor da frase por conta propria saiu.
    "  pensar({ itens:[{produto:'pizza redonda',qtd:1,sabor:'calabresa'}] }) as never);",
    "const forminha = await responder(saborPizza.estado as never,",
    "  { texto: 'forminha rosa' } as never,",
    "  pensar({ forminha:'rosa' }) as never);",
    "const dados = await responder(forminha.estado as never,",
    "  { texto: 'retiro dia 05/09 as 16h, nome Renata Alves, pix' } as never,",
    "  pensar({}) as never);",
    "",
    "const soSalgado = await responder(festa as never,",
    "  { texto: 'coxinha e risoles' } as never,",
    "  pensar({ itens:[{produto:'coxinha',qtd:0},{produto:'risoles',qtd:0}] }) as never);",
    "",
    "const miniNoMeio = await responder(festa as never,",
    "  { texto: 'uma pizza redonda e mini pizza' } as never,",
    "  pensar({ itens:[{produto:'pizza redonda',qtd:1},{produto:'mini pizza',qtd:0}] }) as never);",
    "",
    "const linhas = (e) => (e.itens || []).map((i) => ({",
    "  produto:i.produto, categoria:i.categoria, qtd:i.qtd, obs:i.obs,",
    "}));",
    "const porNome = (lista, nome) => (lista || []).find((i) => String(i.produto).toLowerCase().includes(nome));",
    "",
    "console.log(JSON.stringify({",
    "  cats: {",
    "    pizzaNaSalgado: categoriaDaEtapa('salgado', 'pizza redonda'),",
    "    pizzaFamiliaNaSalgado: categoriaDaEtapa('salgado', 'pizza'),",
    "    miniNaSalgado: categoriaDaEtapa('salgado', 'mini pizza'),",
    "    coxinhaNaSalgado: categoriaDaEtapa('salgado', 'coxinha'),",
    "    brigadeiroNaSalgado: categoriaDaEtapa('salgado', 'brigadeiro'),",
    "  },",
    "  depoisPizza: linhas(pizzaESalgado.estado),",
    "  falaPizza: pizzaESalgado.fala.texto,",
    "  depoisRedonda: linhas(redonda.estado),",
    "  depoisCoxinha: linhas(coxinha.estado),",
    "  rastroCoxinha: coxinha.rastro || [],",
    "  depoisBrigadeiro: linhas(brigadeiro.estado),",
    "  depoisSabor: linhas(saborPizza.estado),",
    "  forminha: forminha.estado.forminha,",
    "  falaForminha: forminha.fala.texto,",
    "  dados: dados.estado.dados,",
    "  soSalgado: linhas(soSalgado.estado),",
    "  miniNoMeio: linhas(miniNoMeio.estado),",
    "  rastroMini: miniNoMeio.rastro || [],",
    "  etapaDepoisCoxinha: etapaDaVez(coxinha.estado as never, roteiroDoPedido(coxinha.estado as never)).id,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pedido-mistura.mts"], {
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

const porNome = (lista, nome) => (lista || []).find((i) => String(i.produto).toLowerCase().includes(nome));

cobra("pizza redonda na etapa do salgado continua pizza", r.cats.pizzaNaSalgado === "pizza",
  JSON.stringify(r.cats.pizzaNaSalgado));
cobra("familia pizza na etapa do salgado continua pizza", r.cats.pizzaFamiliaNaSalgado === "pizza",
  JSON.stringify(r.cats.pizzaFamiliaNaSalgado));
cobra("mini pizza na etapa do salgado e salgado do catalogo",
  r.cats.miniNaSalgado === "salgado_assado" || r.cats.miniNaSalgado === "salgado_frito",
  JSON.stringify(r.cats.miniNaSalgado));
cobra("coxinha na etapa do salgado continua frito", r.cats.coxinhaNaSalgado === "salgado_frito",
  JSON.stringify(r.cats.coxinhaNaSalgado));
cobra("brigadeiro na etapa do salgado continua docinho", r.cats.brigadeiroNaSalgado === "docinho",
  JSON.stringify(r.cats.brigadeiroNaSalgado));

const pizzaDepois = porNome(r.depoisPizza, "pizza");
cobra("pizza entra na festa sem virar salgado", pizzaDepois && pizzaDepois.categoria === "pizza",
  JSON.stringify(r.depoisPizza));
cobra("os 200 nao caem na pizza sozinha", pizzaDepois && Number(pizzaDepois.qtd) !== 200,
  JSON.stringify(pizzaDepois));

const pizzaRedonda = porNome(r.depoisRedonda, "pizza redonda");
const familiaPizza = (r.depoisRedonda || []).find((i) => String(i.produto).toLowerCase() === "pizza");
cobra("redonda vira pizza redonda do catalogo", pizzaRedonda && pizzaRedonda.categoria === "pizza",
  JSON.stringify(r.depoisRedonda));
cobra("a linha generica de pizza sai quando ele escolhe o tipo", !familiaPizza,
  JSON.stringify(r.depoisRedonda));

const pizzaComCoxinha = porNome(r.depoisCoxinha, "pizza redonda");
const coxinha = porNome(r.depoisCoxinha, "coxinha");
cobra("nada some: pizza redonda continua depois da coxinha", pizzaComCoxinha && pizzaComCoxinha.categoria === "pizza",
  JSON.stringify(r.depoisCoxinha));
cobra("nada some: coxinha entra junto", coxinha && coxinha.categoria === "salgado_frito",
  JSON.stringify(r.depoisCoxinha));
cobra("50 coxinha fica 50 quando ele disse 50", coxinha && Number(coxinha.qtd) === 50,
  JSON.stringify(coxinha));
cobra("os 200 nao vao pra pizza depois da coxinha", pizzaComCoxinha && Number(pizzaComCoxinha.qtd) !== 200,
  JSON.stringify(pizzaComCoxinha));
cobra("o rastro nao reparte 200 numa pizza",
  !(r.rastroCoxinha || []).some((x) => /reparti 200 de salgado entre 1/.test(String(x))),
  JSON.stringify(r.rastroCoxinha));

const pizzaComDoce = porNome(r.depoisBrigadeiro, "pizza redonda");
const coxinhaComDoce = porNome(r.depoisBrigadeiro, "coxinha");
const brig = porNome(r.depoisBrigadeiro, "brigadeiro");
cobra("brigadeiro e docinho", brig && brig.categoria === "docinho",
  JSON.stringify(r.depoisBrigadeiro));
cobra("brigadeiro nao vira sabor da pizza",
  pizzaComDoce && !/brigadeiro/i.test(String(pizzaComDoce.obs || "")),
  JSON.stringify(pizzaComDoce));
cobra("pizza e coxinha continuam com o brigadeiro",
  pizzaComDoce && coxinhaComDoce && Number(coxinhaComDoce.qtd) === 50,
  JSON.stringify(r.depoisBrigadeiro));
cobra("os 200 nao caem no brigadeiro", brig && Number(brig.qtd) !== 200,
  JSON.stringify(brig));

const pizzaSabor = porNome(r.depoisSabor, "pizza redonda");
const coxSabor = porNome(r.depoisSabor, "coxinha");
cobra("calabresa depois vai pra pizza",
  pizzaSabor && /calabresa/i.test(String(pizzaSabor.obs || "")),
  JSON.stringify(r.depoisSabor));
cobra("calabresa nao gruda na coxinha",
  coxSabor && !/calabresa/i.test(String(coxSabor.obs || "")),
  JSON.stringify(coxSabor));
cobra("coxinha continua 50 depois do sabor da pizza", coxSabor && Number(coxSabor.qtd) === 50,
  JSON.stringify(coxSabor));

cobra("forminha do docinho entra no pedido misturado", Boolean(r.forminha) && /rosa/i.test(String(r.forminha)),
  JSON.stringify(r.forminha));
cobra("forminha nao pergunta quais docinhos de novo",
  !/quais docinhos/i.test(String(r.falaForminha || "")),
  String(r.falaForminha || "").slice(0, 120));
cobra("dados entram no pedido misturado",
  r.dados && /renata/i.test(String(r.dados.nome || "")) && r.dados.pagamento === "pix" &&
    r.dados.data && r.dados.hora,
  JSON.stringify(r.dados));

const qtds = (r.soSalgado || []).map((i) => Number(i.qtd) || 0);
const soma = qtds.reduce((s, n) => s + n, 0);
const catsSalgado = [...new Set((r.soSalgado || []).map((i) => i.categoria))];
cobra("so salgado ainda reparte os 200", qtds.length === 2 && soma === 200 && qtds.every((q) => q > 0),
  JSON.stringify(r.soSalgado));
cobra("o rateio legitimo so pega salgado de verdade",
  catsSalgado.every((c) => c === "salgado_frito" || c === "salgado_assado"),
  JSON.stringify(catsSalgado));

const pizzaMini = porNome(r.miniNoMeio, "pizza redonda");
const mini = porNome(r.miniNoMeio, "mini pizza");
cobra("no mesmo pedido, pizza redonda e pizza e mini e salgado",
  pizzaMini && pizzaMini.categoria === "pizza" && mini && String(mini.categoria).startsWith("salgado"),
  JSON.stringify(r.miniNoMeio));
cobra("os 200 da base vao pra mini pizza, nao pra redonda",
  mini && Number(mini.qtd) === 200 && pizzaMini && Number(pizzaMini.qtd) !== 200,
  JSON.stringify(r.miniNoMeio) + " rastro=" + JSON.stringify(r.rastroMini));

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
