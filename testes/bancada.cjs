// ============================================================================
//  A BANCADA: roda uma conversa com a IA DE VERDADE, aqui na maquina.
//
//  POR QUE EXISTE
//
//  Pra saber se uma guarda do codigo ainda serve, o jeito honesto e desligar
//  ela e ver o que a IA faz sozinha. Fazendo isso pela producao, cada tentativa
//  custa portao, build, deploy e a espera do container: uns quinze minutos por
//  guarda, e sao mais de dez guardas.
//
//  Aqui a mesma conversa roda em segundos, contra o mesmo modelo e o mesmo
//  catalogo. O que muda e so o banco: nada e gravado, o estado passa de uma
//  fala pra outra em memoria.
//
//  O QUE ELA MEDE E O QUE ELA NAO MEDE
//
//  MEDE: o que a IA le e o que o fluxo faz com isso. E o suficiente pra decidir
//  se uma guarda esta ajudando ou atrapalhando, porque a comparacao e com a
//  MESMA conversa, ligada e desligada.
//
//  NAO MEDE: gravacao, cupom, painel, fila da equipe. Isso continua sendo a
//  conversa de verdade pelo WhatsApp, com o `falar.cjs`.
//
//  E ELA NAO SUBSTITUI CONVERSAR. As falas vem de um .json, entao a proxima nao
//  depende do que a padaria respondeu. Serve pra COMPARAR duas versoes do
//  codigo com a mesma entrada, que e outra coisa.
//
//  Uso:
//    OPENAI_API_KEY=... node testes/bancada.cjs falas.json
//
//  FICA FORA DO PORTAO: gasta token e depende de rede.
// ============================================================================

const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const arq = process.argv[2];
if (!arq) {
  console.error("uso: node testes/bancada.cjs falas.json");
  process.exit(2);
}
if (!process.env.OPENAI_API_KEY) {
  console.error("falta OPENAI_API_KEY no ambiente");
  process.exit(2);
}

const FALAS = JSON.parse(fs.readFileSync(arq, "utf8"));

const sonda = path.join(__dirname, "_sonda-bancada-viva.mts");
fs.writeFileSync(
  sonda,
  [
    'import OpenAI from "openai";',
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { pensarComOpenAI } from "../lib/ia/fluxo/pensar-openai.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[],",
    "};",
    "const FALAS = " + JSON.stringify(FALAS) + ";",
    "const pensar = pensarComOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));",
    "let estado: Record<string, unknown> = { ...VAZIO };",
    "for (const fala of FALAS) {",
    "  const r = await responder(estado as never, { texto: fala }, pensar);",
    "  estado = r.estado as never;",
    '  console.log("cliente >> " + fala);',
    // SEM CORTAR. A primeira versao cortava em 240 caracteres e escondeu
    // justamente a linha do bolo e o total no fechamento da festa, que e a
    // parte que decide se a conta esta certa. Instrumento que corta o dinheiro
    // mente igual medidor que nao espera resposta.
    '  console.log("padaria >> " + String(r.fala.texto || "").replace(/\\n/g, " "));',
    // O rastro e o unico jeito de saber QUEM decidiu o que, e e pra isso que
    // esta bancada existe: comparar resultado sem saber a causa nao decide nada.
    '  console.log("  rastro: " + r.rastro.join(" / "));',
    '  console.log("");',
    "}",
    'console.log("=== O PEDIDO NO FIM ===");',
    "for (const i of (estado.itens as any[]) ?? []) {",
    '  console.log("  " + i.qtd + " ~ " + i.produto + " ~ " + (i.obs ?? "sem obs"));',
    "}",
    'console.log("=== DADOS === " + JSON.stringify(estado.dados) + " pecas=" + JSON.stringify(estado.pecas) + " forminha=" + String(estado.forminha) + " adiadas=" + JSON.stringify(estado.etapasAdiadas));',
  ].join("\n"),
);

try {
  console.log(
    execFileSync("npx", ["tsx", "_sonda-bancada-viva.mts"], {
      cwd: __dirname,
      encoding: "utf8",
      timeout: 300000,
      shell: process.platform === "win32",
      env: process.env,
    }),
  );
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
