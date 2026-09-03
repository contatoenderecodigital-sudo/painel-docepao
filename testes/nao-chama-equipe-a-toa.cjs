// CHAMAR A EQUIPE E ULTIMO RECURSO, NAO O PADRAO DO MODELO VAZIO.
//
// O dono abriu a caixa e viu os fios de QA Automatizado todos em
// "Acho que nao estou conseguindo entender..." e "Precisa de voce". A IA
// chamava a equipe por qualquer coisa e nao tentava pensar.
//
// OS DOIS LADOS
//
//   1. festa + pizza, modelo {}, perguntou.outro ou situacao no meio do pedido
//      NAO acende precisaHumano, e NAO diz que nao entendeu;
//   2. "quero falar com a dona" AINDA acende, mesmo com modelo {}.
//
// Roda com: node testes/nao-chama-equipe-a-toa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-nao-chama-equipe.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
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
    "const nada = pensar({});",
    "",
    "const misturaVazia = await responder(festa as never,",
    "  { texto: 'quero pizza, e salgado tambem' } as never, nada as never);",
    "const misturaOutro = await responder(festa as never,",
    "  { texto: 'quero pizza e 50 coxinha' } as never,",
    "  pensar({ perguntou: { sobre: 'outro' } }) as never);",
    "const misturaSituacao = await responder(festa as never,",
    "  { texto: 'quero pizza e salgado pra festa' } as never,",
    "  pensar({ situacao: 'reclamacao' }) as never);",
    "",
    "let e = { ...festa };",
    "const curtas = [];",
    "for (const t of ['oi', 'hmm', 'ta']) {",
    "  const r = await responder(e as never, { texto: t } as never, nada as never);",
    "  e = r.estado as never;",
    "  curtas.push({ texto: r.fala.texto, precisaHumano: r.precisaHumano === true, cardapio: r.fala.cardapio });",
    "}",
    "",
    "const dona = await responder(VAZIO as never,",
    "  { texto: 'quero falar com a dona' } as never, nada as never);",
    "const gente = await responder(festa as never,",
    "  { texto: 'quero falar com a equipe' } as never, nada as never);",
    "const naoQuero = await responder(VAZIO as never,",
    "  { texto: 'nao quero falar com a dona, quero 50 coxinha' } as never, nada as never);",
    "",
    "console.log(JSON.stringify({",
    "  misturaVazia: { precisaHumano: misturaVazia.precisaHumano === true, texto: misturaVazia.fala.texto, itens: misturaVazia.estado.itens.length },",
    "  misturaOutro: { precisaHumano: misturaOutro.precisaHumano === true, texto: misturaOutro.fala.texto, itens: misturaOutro.estado.itens.length },",
    "  misturaSituacao: { precisaHumano: misturaSituacao.precisaHumano === true, texto: misturaSituacao.fala.texto, itens: misturaSituacao.estado.itens.length },",
    "  curtas,",
    "  dona: { precisaHumano: dona.precisaHumano === true, texto: dona.fala.texto },",
    "  gente: { precisaHumano: gente.precisaHumano === true, texto: gente.fala.texto },",
    "  naoQuero: { precisaHumano: naoQuero.precisaHumano === true, itens: naoQuero.estado.itens.length },",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-nao-chama-equipe.mts"], {
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
  } else {
    falhas.push(rotulo);
    console.log("ERRO  " + rotulo);
    if (detalhe) console.log("        " + detalhe);
  }
};

const naoEntendi = (t) => /nao estou conseguindo entender/i.test(String(t || ""));

cobra("festa+pizza com modelo vazio nao chama a equipe", r.misturaVazia.precisaHumano === false,
  JSON.stringify(r.misturaVazia));
cobra("festa+pizza com modelo vazio nao diz que nao entendeu", !naoEntendi(r.misturaVazia.texto),
  String(r.misturaVazia.texto || "").slice(0, 120));
cobra("festa+pizza com modelo vazio ainda anota o que a frase disse", r.misturaVazia.itens > 0,
  "itens = " + r.misturaVazia.itens);

cobra("perguntou.outro no meio do pedido nao chama a equipe", r.misturaOutro.precisaHumano === false,
  JSON.stringify(r.misturaOutro));
cobra("perguntou.outro nao diz que nao entendeu", !naoEntendi(r.misturaOutro.texto),
  String(r.misturaOutro.texto || "").slice(0, 120));

// DESDE 03/09/2026 A SITUACAO GANHA: o modelo ve a conversa e nao chama pedido
// de reclamacao (medido 3 de 3: "quero 2 pizzas pra festa" volta so com o
// item). Quando ele diz "reclamacao", e reclamacao, e reclamacao e da equipe.
cobra("situacao reclamacao no meio de festa+pizza chama a equipe", r.misturaSituacao.precisaHumano === true,
  JSON.stringify(r.misturaSituacao));
cobra("e responde a frase de reclamacao, nao a de pedido",
  /sinto muito|chamar agora uma pessoa/i.test(String(r.misturaSituacao.texto || "")),
  String(r.misturaSituacao.texto || "").slice(0, 120));

cobra(
  "frase curta repetida nao chama a equipe",
  r.curtas.every((p) => !p.precisaHumano),
  JSON.stringify(r.curtas),
);
cobra(
  "frase curta repetida nao diz que nao entendeu",
  r.curtas.every((p) => !naoEntendi(p.texto)),
  JSON.stringify(r.curtas.map((p) => String(p.texto || "").slice(0, 80))),
);
cobra(
  "frase curta repetida ainda pergunta a etapa",
  r.curtas.every((p) => String(p.texto || "").trim().length > 0),
  JSON.stringify(r.curtas.map((p) => String(p.texto || "").slice(0, 80))),
);

cobra("quero falar com a dona chama a equipe", r.dona.precisaHumano === true,
  JSON.stringify(r.dona));
cobra("quero falar com a equipe chama a equipe", r.gente.precisaHumano === true,
  JSON.stringify(r.gente));
cobra("NAO quero falar com a dona nao chama a equipe", r.naoQuero.precisaHumano === false,
  JSON.stringify(r.naoQuero));

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
