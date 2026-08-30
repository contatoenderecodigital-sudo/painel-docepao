// O RECIBO DO WHATSAPP NAO SOME QUANDO CHEGA JUNTO COM MENSAGEM.
//
// POR QUE ISTO EXISTE
//
// O webhook so lia `statuses` quando `messages` vinha vazio. Pacote com os
// dois (a Meta junta) pulava o UPDATE, e entregue/lida nunca gravava. Recibo
// nao se inventa: o que falta e NAO DESCARTAR o evento que ja chegou.
//
// OS DOIS LADOS
//
//   1. pacote so de status devolve o recibo
//   2. pacote com mensagem E status TAMBEM devolve o recibo
//   3. pacote so de mensagem nao inventa status
//
// Roda com: node testes/o-status-do-whatsapp-nao-some-no-pacote.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-status-whatsapp.mts");
fs.writeFileSync(
  sonda,
  [
    'import { statusesDoWebhook, pacoteTemMensagem } from "../lib/whatsapp/status.ts";',
    "",
    "const soStatus = statusesDoWebhook({",
    "  statuses: [{ id: 'wamid.A', status: 'delivered' }, { id: 'wamid.B', status: 'read' }],",
    "});",
    "const osDois = statusesDoWebhook({",
    "  messages: [{ id: 'wamid.CLIENTE' }],",
    "  statuses: [{ id: 'wamid.A', status: 'delivered' }],",
    "});",
    "const soMensagem = statusesDoWebhook({ messages: [{ id: 'wamid.CLIENTE' }] });",
    "const falhou = statusesDoWebhook({",
    "  messages: [{ id: 'wamid.CLIENTE' }],",
    "  statuses: [{ id: 'wamid.C', status: 'failed', errors: [{ title: 'janela fechada' }] }],",
    "});",
    "const vazio = statusesDoWebhook({});",
    "",
    "console.log(JSON.stringify({",
    "  soStatus,",
    "  osDois,",
    "  soMensagem,",
    "  falhou,",
    "  vazio,",
    "  temMensagemNosDois: pacoteTemMensagem({ messages: [{ id: 'x' }], statuses: [{ id: 'y', status: 'read' }] }),",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-status-whatsapp.mts"], {
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

cobra("pacote so de status devolve os dois recibos", r.soStatus.length === 2, JSON.stringify(r.soStatus));
cobra("pacote com mensagem E status NAO some o recibo", r.osDois.length === 1 && r.osDois[0].id === "wamid.A", JSON.stringify(r.osDois));
cobra("pacote so de mensagem nao inventa recibo", r.soMensagem.length === 0, JSON.stringify(r.soMensagem));
cobra("falha chega com o motivo", r.falhou[0] && r.falhou[0].erro === "janela fechada", JSON.stringify(r.falhou));
cobra("pacote vazio nao inventa recibo", r.vazio.length === 0);
cobra("mensagem no mesmo pacote continua sendo mensagem", r.temMensagemNosDois === true);

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
