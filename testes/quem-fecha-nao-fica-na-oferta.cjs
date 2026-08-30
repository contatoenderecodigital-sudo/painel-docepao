// "PODE FECHAR" VENCE A OFERTA, SEM PULAR DADO OBRIGATORIO.
//
// Regra 28 do levantamento do cerebro apagado. Se o cliente manda o pedido
// completo, recusa o adicional e pede para fechar na mesma fala, a padaria nao
// pode oferecer o adicional de novo nem exigir uma segunda confirmacao.
//
// OS DOIS LADOS
//
//   1. pedido completo, oferta recusada e aprovacao chegam a confirmacao;
//   2. sem recusar a oferta ou faltando dado, a ordem nao fecha nada.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-fecha-oferta.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const BASE = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false,",
    "  itens:[{produto:'pão francês',categoria:'pao',qtd:1,obs:null}], naoQuer:[],",
    "  dados:{nome:'Carla',data:'10/09/2026',hora:'10:00',pagamento:'pix'},",
    "  pecas:null, topoNome:null, topoIdade:null, escrito:null, tema:null,",
    "  forminha:null, prato:null, ofereceu:false, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[],",
    "};",
    "const completa = await responder(BASE as never,",
    "  {texto:'so isso, pode fechar'} as never,",
    "  (async () => ({confirmou:true,naoQuer:['docinho','bolo']})) as never);",
    "const naoRecusou = await responder(BASE as never,",
    "  {texto:'pode fechar'} as never,",
    "  (async () => ({confirmou:true})) as never);",
    "const semHora = await responder({",
    "  ...BASE, dados:{...BASE.dados,hora:null}",
    "} as never, {texto:'so isso, pode fechar'} as never,",
    "  (async () => ({confirmou:true,naoQuer:['docinho','bolo']})) as never);",
    "console.log(JSON.stringify({",
    "  completa:{etapa:completa.etapa,fecha:completa.confirmouEscrevendo,fala:completa.fala.texto},",
    "  naoRecusou:{etapa:naoRecusou.etapa,fecha:naoRecusou.confirmouEscrevendo,fala:naoRecusou.fala.texto},",
    "  semHora:{etapa:semHora.etapa,fecha:semHora.confirmouEscrevendo,fala:semHora.fala.texto},",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-fecha-oferta.mts"], {
    cwd: __dirname,
    encoding: "utf8",
    timeout: 180000,
    shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
if (r.completa.etapa !== "confirmacao" || !r.completa.fecha) {
  falhas.push("pedido completo ficou preso depois de recusar a oferta: " + JSON.stringify(r.completa));
}
if (/levar docinho|levar bolo|junto/i.test(r.completa.fala)) {
  falhas.push("ofereceu de novo o que o cliente recusou: " + r.completa.fala);
}
if (r.naoRecusou.fecha || r.naoRecusou.etapa !== "oferta") {
  falhas.push("pularam a oferta sem o cliente recusar: " + JSON.stringify(r.naoRecusou));
}
if (r.semHora.fecha || r.semHora.etapa !== "dados" || !/hora/i.test(r.semHora.fala)) {
  falhas.push("a ordem de fechar pulou a hora obrigatoria: " + JSON.stringify(r.semHora));
}

console.log("completo=" + r.completa.etapa + " sem recusa=" + r.naoRecusou.etapa + " sem hora=" + r.semHora.etapa);
console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  for (const f of falhas) console.log("ERRO  " + f);
  process.exit(1);
}
console.log("ok    fechar vence a oferta, mas nao inventa resposta");
console.log("");
console.log("PASSOU");
