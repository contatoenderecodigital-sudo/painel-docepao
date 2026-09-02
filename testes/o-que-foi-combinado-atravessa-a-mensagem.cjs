// O QUE FOI COMBINADO COM O CLIENTE ATRAVESSA A MENSAGEM.
//
// No WhatsApp cada mensagem e uma CHAMADA NOVA: o estado morre no fim do turno e
// renasce do banco no seguinte. O que nao for gravado simplesmente nao existiu.
//
// Foi assim que o pedido dele travou em 02/09/2026, e o defeito e velho:
//
//   padaria >> 200 salgados, 100 docinhos, 2 kg. Da pra ajustar o que quiser.
//   cliente >> quero 50 salgados a mais e 50 docinhos a mais
//   padaria >> (ajusta certo, responde certo)
//   cliente >> (mensagem seguinte)
//   padaria >> 200 salgados, 100 docinhos...     A BASE VOLTOU
//
// So `pessoas` e `base_aceita` atravessavam; a base em si era RECALCULADA pelo
// numero de pessoas em todo turno. Qualquer ajuste morria no caminho.
//
// NENHUM TESTE PEGAVA, e o motivo e o que este arquivo existe pra consertar: nos
// testes a conversa inteira roda dentro de UMA chamada, com o estado vivo em
// memoria. O banco nunca entrava no meio. Foi preciso conversar com a producao e
// ler o rastro pra ver a base nascendo de novo a cada mensagem.
//
// AQUI A REVISAO VIRA TESTE. Todo campo do estado precisa de uma decisao
// explicita: ou ele atravessa a mensagem (esta em `gravar.ts`), ou ele e aviso
// de um turno so e esta na lista de baixo, escrita por alguem. Campo novo que
// ninguem decidiu quebra este teste na hora, em vez de virar defeito daqui a um
// mes numa conversa de verdade.
//
// Roda com: node testes/o-que-foi-combinado-atravessa-a-mensagem.cjs
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const ler = (p) => fs.readFileSync(path.join(raiz, p), "utf8");

// OS AVISOS QUE VIVEM UM TURNO SO, por decisao de quem escreveu.
//
// Eles saem NA FRENTE da pergunta da etapa e nao esperam resposta: repetir na
// mensagem seguinte seria a padaria avisando duas vezes a mesma coisa. Por isso
// nao vao pro banco, e isso esta documentado em `fluxo.ts`.
const VIVEM_UM_TURNO = [
  "poucoPorSabor", // "20 e o minimo por sabor", dito junto com a pergunta
  "recheiosTrocados", // "o risolis eu anotei de carne", aviso do que foi ajustado
  "restricoesTiradas", // "sem lactose a gente nao faz", dito uma vez
  "saboresAConfirmar", // "anotei, a equipe confirma", dito uma vez
  // O PEDIDO APROVADO NAO E GUARDADO PORQUE JA TEM DONO.
  //
  // Ele vive na tabela `pedidos`, e quem manda nele e a equipe, apertando o
  // botao no painel. Guardar uma copia no rascunho da conversa criaria duas
  // verdades sobre a mesma coisa, que e o defeito que mais se repetiu neste
  // sistema. Ele e lido do banco a cada mensagem, junto do pedido em aberto.
  "pedidoAprovado",
];

function camposDoTipo(texto, nome) {
  const m = new RegExp("export type " + nome + "[^{]*\\{([\\s\\S]*?)\\n\\};").exec(texto);
  if (!m) return [];
  return [...m[1].matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)].map((x) => x[1]);
}

const fluxo = ler("lib/ia/fluxo/fluxo.ts");
const etapas = ler("lib/ia/fluxo/etapas.ts");
const gravar = ler("lib/ia/fluxo/gravar.ts");

const doEstado = [
  ...new Set([...camposDoTipo(fluxo, "Estado"), ...camposDoTipo(etapas, "PedidoEmMontagem")]),
];

// Quem volta do banco (`estadoDosDados`) e quem vai pro banco (`dadosQueMudaram`).
const volta = new Set([...gravar.matchAll(/^ {4}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((x) => x[1]));
const vai = new Set([...gravar.matchAll(/depois\.([a-zA-Z][a-zA-Z0-9]*)/g)].map((x) => x[1]));

let erros = 0;
console.log("== o que foi combinado atravessa a mensagem ==");

if (doEstado.length < 20) {
  console.log("ERRO  nao consegui ler os campos do estado (li " + doEstado.length + ")");
  console.log("        o teste virou decoracao: conserte a leitura antes de confiar nele");
  process.exit(1);
}

const orfaos = doEstado.filter((c) => !volta.has(c) && !vai.has(c) && !VIVEM_UM_TURNO.includes(c));
if (orfaos.length) {
  console.log("ERRO  campo do estado que ninguem decidiu se atravessa a mensagem: " + orfaos.join(", "));
  console.log("        no WhatsApp cada mensagem e uma chamada nova: o que nao e gravado nao existiu.");
  console.log("        ou grave em gravar.ts, ou declare como aviso de um turno na lista deste teste.");
  erros++;
} else {
  console.log("ok    todo campo do estado tem decisao: " + (doEstado.length - VIVEM_UM_TURNO.length) + " atravessam, " + VIVEM_UM_TURNO.length + " sao aviso de um turno");
}

// A BASE E O CASO QUE CUSTOU O PEDIDO. Cobrada pelo nome, pra nunca mais sair.
if (!volta.has("base") || !gravar.includes("fluxo_base")) {
  console.log("ERRO  a base combinada nao atravessa a mensagem");
  console.log("        foi exatamente isto que travou o pedido de festa de 02/09/2026");
  erros++;
} else {
  console.log("ok    a base combinada e gravada e lida de volta");
}

// A lista de "vive um turno" nao pode virar esconderijo: se um deles passar a
// ser gravado, ele sai da lista.
const mentirosos = VIVEM_UM_TURNO.filter((c) => vai.has(c));
if (mentirosos.length) {
  console.log("ERRO  declarado como aviso de um turno, mas esta sendo gravado: " + mentirosos.join(", "));
  erros++;
} else {
  console.log("ok    os avisos de um turno continuam sendo de um turno");
}

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
