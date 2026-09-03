// QUEM AGRADECE DEPOIS DE FECHAR NAO VE O RESUMO DE NOVO.
//
// POR QUE ISTO EXISTE
//
// Medido conversando com a producao em 03/09/2026, logo depois de "pode
// confirmar":
//
//   cliente >> obrigada!
//   padaria >> Fechando o pedido: - 20 coxinha (frango) ... *Total: R$ 221,40*
//
// O webhook devolve o pedido pendente pro rascunho a cada mensagem (pra ele
// poder mudar), a etapa da confirmacao nunca se da por cumprida, e o resumo
// saia de novo com o botao Confirmar. Na conversa da Renata (02/09) isso gerou
// um SEGUNDO pedido, de R$ 481,80, na fila.
//
// O QUE ELE COBRA
//
//   1. pedido na fila + mensagem que nao mudou nada ({} do modelo) = a padaria
//      diz que o pedido ja esta com a equipe, sem resumo e sem botao;
//   2. pedido na fila + mensagem que MUDA o pedido = o fluxo segue normal (o
//      cliente pode mudar, e o registrarPedido atualiza o pendente);
//   3. a ISCA: sem a marca `pedidoNaFila`, a mesma mensagem volta a mostrar o
//      resumo (que e o defeito).
//
// Roda com: node testes/quem-agradece-depois-de-fechar-nao-ve-o-resumo.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-agradece-depois-de-fechar.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "// Pedido completo e ja registrado: a etapa da vez e a confirmacao.",
    "const FECHADO = {",
    "  ehFesta: false, pessoas: null, base: null, baseAceita: false,",
    "  itens: [{ produto: 'coxinha', categoria: 'salgado_frito', qtd: 100, obs: 'frango' }],",
    "  naoQuer: [], dados: { nome: 'Carla', data: '10/09/2026', hora: '15:00', pagamento: 'pix' },",
    "  pecas: null, topoNome: null, topoIdade: null, tema: null, escrito: null,",
    "  forminha: null, prato: null, ofereceu: true,",
    "  ultimaFala: 'Pronto, seu pedido foi pra fila da equipe da padaria.', insistiu: 0, retomarEm: null, assunto: null,",
    "  etapasJaPerguntadas: ['oferta', 'dados', 'confirmacao'], pedidoNaFila: true,",
    "};",
    "",
    "const nada = async () => ({});",
    "const mudou = async () => ({ itens: [{ produto: 'coxinha', qtd: 150 }] });",
    "",
    "const r1 = await responder(FECHADO as never, { texto: 'obrigada!' }, nada as never);",
    "const r2 = await responder(FECHADO as never, { texto: 'muda pra 150 coxinha' }, mudou as never);",
    "const r3 = await responder({ ...FECHADO, pedidoNaFila: false } as never, { texto: 'obrigada!' }, nada as never);",
    "// O rascunho devolvido pelo webhook nao traz a memoria do fluxo: a oferta",
    "// ainda nao foi feita e a etapa da vez e outra. Medido em 03/09/2026:",
    "// 'obrigada!' ouvia 'Quer levar docinho ou bolo junto?'.",
    "const r4 = await responder({ ...FECHADO, ofereceu: false, etapasJaPerguntadas: [] } as never, { texto: 'obrigada!' }, nada as never);",
    "",
    "console.log(JSON.stringify({",
    "  agradeceu: { texto: r1.fala.texto, botoes: r1.fala.botoes.map((b) => b.id), etapa: r1.etapa },",
    "  semMemoria: { texto: r4.fala.texto },",
    "  mudou: { texto: r2.fala.texto, qtd: r2.estado.itens[0]?.qtd, etapa: r2.etapa },",
    "  isca: { texto: r3.fala.texto, botoes: r3.fala.botoes.map((b) => b.id) },",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-agradece-depois-de-fechar.mts"], {
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

console.log("== quem agradece depois de fechar nao ve o resumo ==");

cobra(
  "pedido na fila + 'obrigada!' = a padaria diz que ja esta com a equipe, sem resumo",
  /equipe/i.test(r.agradeceu.texto) && !/Fechando o pedido/i.test(r.agradeceu.texto),
  JSON.stringify(r.agradeceu.texto.slice(0, 120)),
);
cobra(
  "e sem o botao Confirmar",
  !r.agradeceu.botoes.includes("fecha_sim"),
  JSON.stringify(r.agradeceu.botoes),
);
cobra(
  "mesmo sem a memoria do fluxo (etapa da oferta), 'obrigada!' nao vira oferta nem resumo",
  /equipe/i.test(r.semMemoria.texto) && !/docinho ou bolo/i.test(r.semMemoria.texto),
  JSON.stringify(r.semMemoria.texto.slice(0, 120)),
);
cobra(
  "pedido na fila + 'muda pra 150' = o pedido muda e a conversa segue",
  r.mudou.qtd === 150,
  "qtd=" + JSON.stringify(r.mudou.qtd) + " texto=" + JSON.stringify(r.mudou.texto.slice(0, 80)),
);
cobra(
  "ISCA: sem a marca, 'obrigada!' volta a mostrar o resumo com Confirmar (o defeito)",
  /Fechando o pedido/i.test(r.isca.texto) && r.isca.botoes.includes("fecha_sim"),
  JSON.stringify(r.isca.texto.slice(0, 80)) + " " + JSON.stringify(r.isca.botoes),
);

console.log("");
if (falhas.length) {
  console.log("REPROVOU EM " + falhas.length);
  process.exit(1);
}
console.log("PASSOU");
