// A CONVERSA AO VIVO, TURNO A TURNO, COM O QUE O MODELO DEVOLVEU NO AR.
//
// POR QUE ISTO EXISTE
//
// Medido em 30/08/2026, /api/testar-ia, gravado em
// /opt/cursor/artifacts/conversa-depois-merge.json. origin/main ja era 901e47c.
// A bateria a-festa-nao-reparte-pizza / o-pedido-mistura-tudo nao reproduz
// este caminho: o modelo devolveu PRIMEIRO o nome de familia "pizza", depois
// "redonda" com pizzas de bacon inventadas. O rastro:
//
//     achei na frase e anotei: pizza
//     reparti 200 de salgado entre 1 escolha(s)
//
// Resultado: 200 x pizza [salgado_frito]. Depois inventou bacon. 50 coxinha
// e 30 mini pizza viraram 66. Calabresa grudou na mini. "escolhe voce a
// forminha" nao escolheu cor. Dados da Marina nao entraram.
//
// Este arquivo manda as MESMAS falas e as MESMAS leituras do modelo. Se o
// caminho vivo ainda carimba pizza como frito, o merge nao consertou o
// caminho que o cliente usa.
//
// O OUTRO LADO: coxinha e risoles, sem numero, os 200 se repartem. Quem nao
// delega a forminha continua ouvindo a pergunta da cor.
//
// Roda com: node testes/a-conversa-ao-vivo-nao-reparte-pizza.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-conversa-ao-vivo.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder, categoriaDaEtapa } from "../lib/ia/fluxo/fluxo.ts";',
    'import { ehNomeDeFamilia } from "../lib/ia/fluxo/generico.ts";',
    'import { coresDoCardapio } from "../lib/ia/dados/produtos.ts";',
    'import { juntarComAFrase } from "../lib/ia/fluxo/leitor-da-frase.ts";',
    'import { etapaDaVez, roteiroDoPedido } from "../lib/ia/fluxo/etapas.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[],",
    "};",
    "const pensar = (leitura) => (async () => leitura);",
    "const linhas = (e) => (e.itens || []).map((i) => ({",
    "  produto:i.produto, categoria:i.categoria, qtd:i.qtd, obs:i.obs,",
    "}));",
    "const etapaDe = (e) => etapaDaVez(e as never, roteiroDoPedido(e as never)).id;",
    "",
    "const t1 = await responder(VAZIO as never,",
    "  { texto: 'boa noite, quero fazer uma festa uns 20 pessoas, pra sexta' } as never,",
    "  pensar({ ehFesta:true, pessoas:20 }) as never);",
    "const t2 = await responder(t1.estado as never,",
    "  { texto: 'pode ser' } as never,",
    "  pensar({ aceitouBase:true }) as never);",
    "const t3 = await responder(t2.estado as never,",
    "  { texto: 'quero pizza e salgado tambem' } as never,",
    "  pensar({ itens:[{produto:'pizza',qtd:1}] }) as never);",
    "const t4 = await responder(t3.estado as never,",
    "  { texto: 'redonda' } as never,",
    "  pensar({ itens:[",
    "    {produto:'pizza redonda',qtd:1},",
    "    {produto:'pizza inteira',qtd:1,sabor:'bacon'},",
    "    {produto:'pizza meia',qtd:1,sabor:'bacon'},",
    "    {produto:'pizza redonda',qtd:1,sabor:'bacon'},",
    "  ] }) as never);",
    "const t5 = await responder(t4.estado as never,",
    "  { texto: '50 coxinha e 30 mini pizza' } as never,",
    "  pensar({ itens:[{produto:'coxinha',qtd:50},{produto:'mini pizza',qtd:30}] }) as never);",
    "const t6 = await responder(t5.estado as never,",
    "  { texto: 'calabresa' } as never,",
    // O MODELO LE ISTO (medido 3 de 3 em 03/09/2026, vendo a conversa). O bloco
    // que distribuia o sabor da frase por conta propria saiu.
    "  pensar({ itens:[{produto:'pizza redonda',qtd:1,sabor:'calabresa'}] }) as never);",
    "const t7 = await responder(t6.estado as never,",
    "  { texto: 'e 80 brigadeiro' } as never,",
    "  pensar({ itens:[{produto:'brigadeiro',qtd:80}] }) as never);",
    "const t8 = await responder(t7.estado as never,",
    "  { texto: 'escolhe voce a forminha' } as never,",
    "  pensar({ delegaEscolha:true }) as never);",
    "const t9 = await responder(t8.estado as never,",
    "  { texto: 'sexta as 16h, nome Marina Costa, pix' } as never,",
    "  pensar({}) as never);",
    "",
    "const dadosComForminhaAberta = juntarComAFrase({}, 'sexta as 16h, nome Marina Costa, pix');",
    "const t9semDelega = await responder(t7.estado as never,",
    "  { texto: 'sexta as 16h, nome Marina Costa, pix' } as never,",
    "  pensar({}) as never);",
    "",
    "const doisSalgados = await responder(t2.estado as never,",
    "  { texto: 'coxinha e risoles' } as never,",
    "  pensar({ itens:[{produto:'coxinha',qtd:0},{produto:'risoles',qtd:0}] }) as never);",
    "",
    "const forminhaSemDelega = await responder({",
    "  ...t7.estado,",
    "  forminha:null,",
    "} as never,",
    "  { texto: 'forminha rosa' } as never,",
    "  pensar({ forminha:'rosa' }) as never);",
    "",
    "console.log(JSON.stringify({",
    "  cats: {",
    "    pizzaFamiliaNaSalgado: categoriaDaEtapa('salgado', 'pizza'),",
    "    pizzaRedondaNaSalgado: categoriaDaEtapa('salgado', 'pizza redonda'),",
    "    miniNaSalgado: categoriaDaEtapa('salgado', 'mini pizza'),",
    "    coxinhaNaSalgado: categoriaDaEtapa('salgado', 'coxinha'),",
    "  },",
    "  ehFamiliaPizza: ehNomeDeFamilia('pizza'),",
    "  primeiraCor: coresDoCardapio()[0],",
    "  etapaT2: etapaDe(t2.estado),",
    "  t3: linhas(t3.estado),",
    "  rastroT3: t3.rastro || [],",
    "  falaT3: t3.fala.texto,",
    "  etapaT3: etapaDe(t3.estado),",
    "  t4: linhas(t4.estado),",
    "  rastroT4: t4.rastro || [],",
    "  t5: linhas(t5.estado),",
    "  t6: linhas(t6.estado),",
    "  rastroT6: t6.rastro || [],",
    "  t7: linhas(t7.estado),",
    "  t8: { forminha: t8.estado.forminha, itens: linhas(t8.estado), fala: t8.fala.texto, rastro: t8.rastro || [] },",
    "  t9: { dados: t9.estado.dados, forminha: t9.estado.forminha, itens: linhas(t9.estado) },",
    "  dadosFrase: dadosComForminhaAberta.dados,",
    "  t9semDelega: t9semDelega.estado.dados,",
    "  doisSalgados: linhas(doisSalgados.estado),",
    "  rastroDois: doisSalgados.rastro || [],",
    "  forminhaSemDelega: forminhaSemDelega.estado.forminha,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-conversa-ao-vivo.mts"], {
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

const porNome = (lista, nome) => (lista || []).find((i) => String(i.produto).toLowerCase() === nome);
const porTrecho = (lista, nome) => (lista || []).find((i) => String(i.produto).toLowerCase().includes(nome));
const rastroTem = (lista, re) => (lista || []).some((x) => re.test(String(x)));

cobra("familia pizza na etapa do salgado continua pizza", r.cats.pizzaFamiliaNaSalgado === "pizza",
  JSON.stringify(r.cats.pizzaFamiliaNaSalgado));
cobra("pizza redonda na etapa do salgado continua pizza", r.cats.pizzaRedondaNaSalgado === "pizza",
  JSON.stringify(r.cats.pizzaRedondaNaSalgado));
cobra("mini pizza na etapa do salgado e salgado do catalogo",
  String(r.cats.miniNaSalgado).startsWith("salgado"),
  JSON.stringify(r.cats.miniNaSalgado));
cobra("coxinha na etapa do salgado continua frito", r.cats.coxinhaNaSalgado === "salgado_frito",
  JSON.stringify(r.cats.coxinhaNaSalgado));
cobra("pizza e nome de familia", r.ehFamiliaPizza === true, JSON.stringify(r.ehFamiliaPizza));

cobra("depois do pode ser a etapa e salgado", r.etapaT2 === "salgado", JSON.stringify(r.etapaT2));

const pizzaT3 = porNome(r.t3, "pizza") || porTrecho(r.t3, "pizza");
cobra("familia pizza nao vira linha de salgado", pizzaT3 && pizzaT3.categoria === "pizza",
  JSON.stringify(r.t3));
cobra("os 200 nao caem na familia pizza", pizzaT3 && Number(pizzaT3.qtd) !== 200,
  JSON.stringify(pizzaT3));
cobra("o rastro nao reparte 200 numa pizza so",
  !rastroTem(r.rastroT3, /reparti 200 de salgado entre 1/),
  JSON.stringify(r.rastroT3));
cobra("nao existe linha pizza com categoria salgado",
  !(r.t3 || []).some((i) => /pizza/i.test(i.produto) && String(i.categoria).startsWith("salgado")),
  JSON.stringify(r.t3));

const redonda = porNome(r.t4, "pizza redonda") || porTrecho(r.t4, "pizza redonda");
const inteira = (r.t4 || []).find((i) => /pizza inteira/i.test(i.produto));
const meia = (r.t4 || []).find((i) => /pizza meia/i.test(i.produto));
const bacon = (r.t4 || []).filter((i) => /bacon/i.test(String(i.obs || "")));
cobra("redonda vira pizza redonda do catalogo", redonda && redonda.categoria === "pizza",
  JSON.stringify(r.t4));
cobra("redonda nao leva os 200", redonda && Number(redonda.qtd) !== 200 && Number(redonda.qtd) <= 2,
  JSON.stringify(redonda));
cobra("nao inventa pizza inteira de bacon", !inteira, JSON.stringify(r.t4));
cobra("nao inventa pizza meia de bacon", !meia, JSON.stringify(r.t4));
cobra("nao inventa sabor bacon em pizza nenhuma", bacon.length === 0, JSON.stringify(r.t4));
cobra("o rastro do redonda nao reparte 200 numa pizza",
  !rastroTem(r.rastroT4, /reparti 200 de salgado/),
  JSON.stringify(r.rastroT4));

const cox5 = porNome(r.t5, "coxinha") || porTrecho(r.t5, "coxinha");
const mini5 = porNome(r.t5, "mini pizza") || porTrecho(r.t5, "mini pizza");
const pizza5 = porNome(r.t5, "pizza redonda") || porTrecho(r.t5, "pizza redonda");
cobra("50 coxinha fica 50 quando ele disse 50", cox5 && Number(cox5.qtd) === 50,
  JSON.stringify(r.t5));
cobra("30 mini pizza fica 30 quando ele disse 30", mini5 && Number(mini5.qtd) === 30,
  JSON.stringify(r.t5));
cobra("mini pizza e salgado do catalogo", mini5 && String(mini5.categoria).startsWith("salgado"),
  JSON.stringify(mini5));
cobra("pizza redonda continua pizza depois da coxinha", pizza5 && pizza5.categoria === "pizza",
  JSON.stringify(r.t5));

const cox6 = porNome(r.t6, "coxinha") || porTrecho(r.t6, "coxinha");
const mini6 = porNome(r.t6, "mini pizza") || porTrecho(r.t6, "mini pizza");
const pizza6 = porNome(r.t6, "pizza redonda") || porTrecho(r.t6, "pizza redonda");
cobra("calabresa nao reescreve 50 coxinha", cox6 && Number(cox6.qtd) === 50, JSON.stringify(r.t6));
cobra("calabresa nao reescreve 30 mini pizza", mini6 && Number(mini6.qtd) === 30, JSON.stringify(r.t6));
cobra("calabresa vai pra pizza redonda", pizza6 && /calabresa/i.test(String(pizza6.obs || "")),
  JSON.stringify(r.t6));
cobra("calabresa nao gruda na mini pizza", mini6 && !/calabresa/i.test(String(mini6.obs || "")),
  JSON.stringify(mini6));
cobra("calabresa nao reabre o rateio de 200",
  !rastroTem(r.rastroT6, /reparti 200 de salgado/),
  JSON.stringify(r.rastroT6));

const brig = porNome(r.t7, "brigadeiro") || porTrecho(r.t7, "brigadeiro");
cobra("80 brigadeiro fica 80 e e docinho", brig && brig.categoria === "docinho" && Number(brig.qtd) === 80,
  JSON.stringify(r.t7));

const primeira = r.primeiraCor;
cobra("delega a forminha escolhe a primeira cor do cardapio",
  Boolean(r.t8.forminha) && String(r.t8.forminha).toLowerCase() === String(primeira || "").toLowerCase(),
  JSON.stringify({ forminha: r.t8.forminha, primeira }));
cobra("delega a forminha nao pergunta a cor de novo",
  !/qual cor|de que cor/i.test(String(r.t8.fala || "")),
  String(r.t8.fala || "").slice(0, 160));
cobra("80 brigadeiro nao vira 100 na delegacao",
  (r.t8.itens || []).some((i) => /brigadeiro/i.test(i.produto) && Number(i.qtd) === 80),
  JSON.stringify(r.t8.itens));
cobra("50 e 30 nao viram 66 na delegacao",
  (r.t8.itens || []).some((i) => /coxinha/i.test(i.produto) && Number(i.qtd) === 50) &&
    (r.t8.itens || []).some((i) => /mini pizza/i.test(i.produto) && Number(i.qtd) === 30),
  JSON.stringify(r.t8.itens));

cobra("juntarComAFrase le data, hora, nome e pix da Marina",
  r.dadosFrase && /marina/i.test(String(r.dadosFrase.nome || "")) &&
    r.dadosFrase.pagamento === "pix" && r.dadosFrase.data && r.dadosFrase.hora,
  JSON.stringify(r.dadosFrase));
cobra("dados entram no pedido depois da forminha",
  r.t9.dados && /marina/i.test(String(r.t9.dados.nome || "")) &&
    r.t9.dados.pagamento === "pix" && r.t9.dados.data && r.t9.dados.hora,
  JSON.stringify(r.t9.dados));
cobra("dados entram mesmo com a forminha ainda aberta",
  r.t9semDelega && /marina/i.test(String(r.t9semDelega.nome || "")) &&
    r.t9semDelega.pagamento === "pix" && r.t9semDelega.data && r.t9semDelega.hora,
  JSON.stringify(r.t9semDelega));

const qtds = (r.doisSalgados || []).map((i) => Number(i.qtd) || 0);
const soma = qtds.reduce((s, n) => s + n, 0);
const catsSalgado = [...new Set((r.doisSalgados || []).map((i) => i.categoria))];
cobra("coxinha e risoles ainda repartem os 200", qtds.length === 2 && soma === 200 && qtds.every((q) => q > 0),
  JSON.stringify(r.doisSalgados));
cobra("o rateio legitimo so pega salgado de verdade",
  catsSalgado.every((c) => c === "salgado_frito" || c === "salgado_assado"),
  JSON.stringify(catsSalgado));
cobra("quem escolhe a cor pelo nome ainda anota a cor",
  Boolean(r.forminhaSemDelega) && /rosa/i.test(String(r.forminhaSemDelega)),
  JSON.stringify(r.forminhaSemDelega));

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
