// O CONTEXTO DESEMPATA O NOME QUE O CARDAPIO TEM EM DOIS LUGARES.
//
// POR QUE ISTO EXISTE
//
// O mesmo sabor vive em familias diferentes, e o preco muda dezenas de vezes:
//
//   brigadeiro           docinho, R$ 1,25 a unidade
//   bolo brigadeiro      festa,   R$ 46,90 o quilo
//   cafe                 docinho, R$ 1,25
//   bolo caseiro cafe    caseiro, R$ 35,90 a unidade
//   bolo caseiro cenoura caseiro, nao e festa
//
// Uma atendente olha a etapa (o que acabou de perguntar) e a frase (bolo,
// caseiro, kg). Sem isso o sistema chuta o caro, ou o barato no lugar do bolo.
//
// OS DOIS LADOS
//
//   pega o defeito: etapa do docinho nao cria bolo de festa; bolo caseiro
//                    nao vira festa; brigadeiro nao vira salgado_frito
//   deixa passar:   etapa do bolo anota o bolo com prefixo e kg; a frase
//                    com "bolo" no comeco tambem; pedido misto guarda cada
//                    familia na categoria do catalogo
//
// Roda com: node testes/o-contexto-desempata-nome-duplicado.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-contexto-nome.mts");
fs.writeFileSync(
  sonda,
  [
    'import { identificarProduto } from "../lib/ia/fluxo/produto.ts";',
    'import { etapaDesteProduto } from "../lib/ia/fluxo/leitura.ts";',
    'import { produtoPorNome } from "../lib/ia/dados/produtos.ts";',
    'import { responder, categoriaDaEtapa } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const ident = (nome, dica, frase) => identificarProduto(nome, dica, frase);",
    "const cat = (nome) => produtoPorNome(nome)?.categoria ?? null;",
    "const un = (nome, dica, frase) => ident(nome, dica, frase).unidade;",
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
    "};",
    "",
    "const naDocinho = {",
    "  ...festa,",
    "  itens:[{produto:'coxinha',categoria:'salgado_frito',qtd:100,obs:null}],",
    "  etapasJaPerguntadas:['quantas_pessoas','base_da_festa','salgado'],",
    "};",
    "const naBolo = {",
    "  ...festa,",
    "  itens:[",
    "    {produto:'coxinha',categoria:'salgado_frito',qtd:100,obs:null},",
    "    {produto:'brigadeiro',categoria:'docinho',qtd:50,obs:'forminha rosa'},",
    "  ],",
    "  forminha:'rosa',",
    "  etapasJaPerguntadas:['quantas_pessoas','base_da_festa','salgado','docinho'],",
    "};",
    "",
    "const depoisDocinhos = await responder(naDocinho as never,",
    "  { texto: 'brigadeiro' } as never,",
    "  (async () => ({ itens:[{produto:'brigadeiro',qtd:50}] })) as never);",
    "const depoisBolo = await responder(naBolo as never,",
    "  { texto: 'brigadeiro' } as never,",
    "  (async () => ({ itens:[{produto:'brigadeiro',qtd:2}] })) as never);",
    "const caseiro = await responder(VAZIO as never,",
    "  { texto: 'bolo caseiro cenoura' } as never,",
    "  (async () => ({ itens:[{produto:'bolo caseiro cenoura',qtd:1}] })) as never);",
    "const misto = await responder(VAZIO as never,",
    "  { texto: 'pizza, coxinha e brigadeiro' } as never,",
    "  (async () => ({ itens:[",
    "    {produto:'pizza redonda',qtd:1},",
    "    {produto:'coxinha',qtd:50},",
    "    {produto:'brigadeiro',qtd:80},",
    "  ] })) as never);",
    "const cafeDocinho = await responder(naDocinho as never,",
    "  { texto: 'cafe' } as never,",
    "  (async () => ({ itens:[{produto:'cafe',qtd:30}] })) as never);",
    "",
    "console.log(JSON.stringify({",
    "  ident: {",
    "    brigadeiroDocinho: ident('brigadeiro', 'docinho').produto,",
    "    brigadeiroDocinhoCat: cat(ident('brigadeiro', 'docinho').produto),",
    "    brigadeiroBolo: ident('brigadeiro', 'bolo').produto,",
    "    brigadeiroBoloUn: un('brigadeiro', 'bolo'),",
    "    brigadeiroPelado: ident('brigadeiro').produto,",
    "    brigadeiroPeladoCat: cat(ident('brigadeiro').produto),",
    "    boloBrigadeiro: ident('bolo brigadeiro').produto,",
    "    brigadeiroNaFrase: ident('brigadeiro', undefined, 'quero um bolo de brigadeiro de 2 kg').produto,",
    "    brigadeiroSalgado: ident('brigadeiro', 'salgado').produto,",
    "    brigadeiroSalgadoCat: cat(ident('brigadeiro', 'salgado').produto),",
    "    quatroLeites: ident('4 leites', 'bolo').produto,",
    "    cenoura: ident('cenoura', 'bolo').produto,",
    "    boloCaseiroCenoura: ident('bolo caseiro cenoura').produto,",
    "    boloCenoura: ident('bolo cenoura').produto,",
    "    cafeDocinho: ident('cafe', 'docinho').produto,",
    "    cafePelado: ident('cafe').produto,",
    "    cafeBolo: ident('cafe', 'bolo').produto,",
    "    boloCafe: ident('bolo cafe').produto,",
    "    boloSemTipo: ident('bolo').produto,",
    "  },",
    "  etapa: {",
    "    brigadeiro: etapaDesteProduto('brigadeiro'),",
    "    boloBrigadeiro: etapaDesteProduto('bolo brigadeiro'),",
    "    caseiroCenoura: etapaDesteProduto('bolo caseiro cenoura'),",
    "  },",
    "  catsEtapa: {",
    "    brigadeiroNaSalgado: categoriaDaEtapa('salgado', 'brigadeiro'),",
    "    boloCaseiro: categoriaDaEtapa('bolo', 'bolo caseiro cenoura'),",
    "    boloFesta: categoriaDaEtapa('bolo', 'bolo brigadeiro'),",
    "  },",
    "  depoisDocinhos: depoisDocinhos.estado.itens.map((i) => ({ produto:i.produto, categoria:i.categoria })),",
    "  depoisBolo: depoisBolo.estado.itens.map((i) => ({ produto:i.produto, categoria:i.categoria, qtd:i.qtd })),",
    "  caseiro: caseiro.estado.itens.map((i) => ({ produto:i.produto, categoria:i.categoria })),",
    "  misto: misto.estado.itens.map((i) => ({ produto:i.produto, categoria:i.categoria })),",
    "  cafeDocinho: cafeDocinho.estado.itens.map((i) => ({ produto:i.produto, categoria:i.categoria })),",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-contexto-nome.mts"], {
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

const i = r.ident;
cobra("na etapa do docinho, brigadeiro e o docinho",
  i.brigadeiroDocinhoCat === "docinho" && !/^bolo /.test(i.brigadeiroDocinho),
  i.brigadeiroDocinho + " / " + i.brigadeiroDocinhoCat);
cobra("na etapa do bolo, brigadeiro e bolo de festa por kg",
  i.brigadeiroBolo === "bolo brigadeiro" && i.brigadeiroBoloUn === "kg",
  i.brigadeiroBolo + " " + i.brigadeiroBoloUn);
cobra("brigadeiro pelado, sem etapa, e o docinho",
  i.brigadeiroPeladoCat === "docinho" && !/^bolo /.test(i.brigadeiroPelado),
  i.brigadeiroPelado + " / " + i.brigadeiroPeladoCat);
cobra("bolo brigadeiro na frase e o de festa",
  i.boloBrigadeiro === "bolo brigadeiro", i.boloBrigadeiro);
cobra("frase com bolo e kg promove o sabor ao bolo de festa",
  i.brigadeiroNaFrase === "bolo brigadeiro", i.brigadeiroNaFrase);
cobra("dica de salgado nao vira salgado_frito",
  i.brigadeiroSalgadoCat === "docinho",
  i.brigadeiroSalgado + " / " + i.brigadeiroSalgadoCat);
cobra("4 leites na etapa do bolo e bolo 4 leites",
  i.quatroLeites === "bolo 4 leites", i.quatroLeites);
cobra("cenoura na etapa do bolo e bolo caseiro, nao festa",
  i.cenoura === "bolo caseiro cenoura", i.cenoura);
cobra("bolo caseiro cenoura continua caseiro",
  i.boloCaseiroCenoura === "bolo caseiro cenoura", i.boloCaseiroCenoura);
cobra("bolo cenoura e o caseiro, nao um bolo de festa inventado",
  i.boloCenoura === "bolo caseiro cenoura", i.boloCenoura);
cobra("cafe na etapa do docinho e o docinho",
  i.cafeDocinho === "café" || i.cafeDocinho === "cafe", i.cafeDocinho);
cobra("cafe pelado e o docinho, nao o caseiro",
  !/^bolo /.test(i.cafePelado), i.cafePelado);
cobra("cafe na etapa do bolo e o caseiro",
  /^bolo caseiro /.test(i.cafeBolo), i.cafeBolo);
cobra("bolo cafe e o caseiro",
  /^bolo caseiro /.test(i.boloCafe), i.boloCafe);
cobra("bolo sozinho continua familia, nao um sabor chutado",
  i.boloSemTipo === "bolo", i.boloSemTipo);

cobra("etapaDesteProduto do brigadeiro e docinho",
  r.etapa.brigadeiro === "docinho", r.etapa.brigadeiro);
cobra("etapaDesteProduto do bolo brigadeiro e bolo",
  r.etapa.boloBrigadeiro === "bolo", r.etapa.boloBrigadeiro);
cobra("etapaDesteProduto do caseiro e bolo",
  r.etapa.caseiroCenoura === "bolo", r.etapa.caseiroCenoura);

cobra("categoriaDaEtapa nao carimba brigadeiro como frito",
  r.catsEtapa.brigadeiroNaSalgado === "docinho", r.catsEtapa.brigadeiroNaSalgado);
cobra("categoriaDaEtapa do caseiro e bolo_caseiro",
  r.catsEtapa.boloCaseiro === "bolo_caseiro", r.catsEtapa.boloCaseiro);
cobra("categoriaDaEtapa do bolo brigadeiro e bolo_festa",
  r.catsEtapa.boloFesta === "bolo_festa", r.catsEtapa.boloFesta);

const doc = (r.depoisDocinhos || []).find((x) => /brigadeiro/i.test(x.produto));
cobra("depois de quais docinhos, brigadeiro entra como docinho",
  doc && doc.categoria === "docinho" && !/^bolo /.test(doc.produto),
  JSON.stringify(r.depoisDocinhos));

const bolo = (r.depoisBolo || []).find((x) => x.produto === "bolo brigadeiro");
cobra("depois da pergunta do bolo de festa, brigadeiro e bolo brigadeiro",
  bolo && bolo.produto === "bolo brigadeiro" && bolo.categoria === "bolo_festa",
  JSON.stringify(r.depoisBolo));

const cen = (r.caseiro || []).find((x) => /cenoura/i.test(x.produto));
cobra("bolo caseiro cenoura nao vira festa",
  cen && cen.categoria === "bolo_caseiro" && /caseiro/.test(cen.produto),
  JSON.stringify(r.caseiro));

const pizza = (r.misto || []).find((x) => /pizza/i.test(x.produto));
const cox = (r.misto || []).find((x) => /coxinha/i.test(x.produto));
const brig = (r.misto || []).find((x) => /brigadeiro/i.test(x.produto));
cobra("pedido misto: pizza continua pizza",
  pizza && pizza.categoria === "pizza", JSON.stringify(r.misto));
cobra("pedido misto: coxinha continua salgado_frito",
  cox && cox.categoria === "salgado_frito", JSON.stringify(r.misto));
cobra("pedido misto: brigadeiro continua docinho",
  brig && brig.categoria === "docinho" && !/^bolo /.test(brig.produto),
  JSON.stringify(r.misto));

const cafe = (r.cafeDocinho || []).find((x) => /caf/i.test(x.produto));
cobra("cafe depois da pergunta de docinhos e docinho",
  cafe && cafe.categoria === "docinho" && !/^bolo /.test(cafe.produto),
  JSON.stringify(r.cafeDocinho));

console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: o contexto (etapa e a frase) desempata o nome duplicado.");
