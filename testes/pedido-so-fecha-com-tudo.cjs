// PEDIDO SO FECHA COM TUDO
//
// Ultima peca da festa: o cliente toca em Confirmar e a conversa vira pedido,
// que vai pra fila da dona e de la pra impressora.
//
// AS TRAVAS QUE ESTE TESTE PROTEGE
//
// 1. PEDIDO SEM ITEM NAO FECHA.
//    Ja aconteceu de um "Ok" do cliente zerar um pedido de verdade: a lista
//    vazia sobrescrevia as linhas e a encomenda dele virava R$ 0,00 na tela.
//
// 2. BOLO SEM SABOR NAO FECHA.
//    Quando o cliente aceita a base, o codigo anota "bolo" so com o peso, e o
//    sabor e escolha dele. Fechar assim manda pra cozinha um bolo que ninguem
//    sabe assar.
//
// 3. O TOTAL E O DO MOTOR.
//    O mesmo que escreveu a base e o resumo. Se o motor errar, erram os tres
//    juntos: o cliente nunca ve um numero na proposta, outro na confirmacao e
//    um terceiro na comanda.
//
// 4. QUEM APROVA E A EQUIPE.
//    Primeira regra que o dono deu neste projeto: a IA nunca confirma sozinha.
//    O pedido entra na fila esperando a dona.
//
// Nao chama banco nem OpenAI: so a conta e as travas.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-fechar.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { oQueFaltaPraFechar } from "../lib/ia/fluxo/fechar.ts";',
    'import { motorPadrao } from "../lib/ia/orcamento.ts";',
    "const cheio = {",
    "  ehFesta:true, pessoas:20, base:null, baseAceita:true, naoQuer:[], pecas:{topo:false,papelDeArroz:false},",
    "  itens:[",
    "    {produto:'coxinha', categoria:'salgado_frito', qtd:100, obs:null},",
    "    {produto:'brigadeiro', categoria:'docinho', qtd:50, obs:'forminha azul'},",
    "    {produto:'bolo morango', categoria:'bolo_festa', qtd:2, obs:null},",
    "  ],",
    "  dados:{nome:'Sandro', data:'12/09/2026', hora:'11:30', pagamento:'pix'},",
    "};",
    "const semItem = { ...cheio, itens: [] };",
    "const semSaborNoBolo = { ...cheio, itens: [...cheio.itens.slice(0,2), {produto:'bolo', categoria:'bolo_festa', qtd:2, obs:null}] };",
    "const semDados = { ...cheio, dados:{nome:null, data:'12/09/2026', hora:null, pagamento:null} };",
    "",
    // a conta que iria pro pedido
    "const cot = motorPadrao.cotarPorItens(cheio.itens.map((i) => ({ item: i.produto, qtd: i.qtd, obs: i.obs ?? undefined })));",
    "console.log(JSON.stringify({",
    "  cheio: oQueFaltaPraFechar(cheio),",
    "  semItem: oQueFaltaPraFechar(semItem),",
    "  semSaborNoBolo: oQueFaltaPraFechar(semSaborNoBolo),",
    "  semDados: oQueFaltaPraFechar(semDados),",
    "  cotacao: { total: cot.total, linhas: (cot.linhas ?? []).map((l) => ({ item: l.item, qtd: l.qtd, unidade: l.unidade, subtotal: l.subtotal })) },",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-fechar.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

// ------------------------------------------- pedido completo fecha
if (r.cheio.length) falhas.push("o pedido completo nao fecha, falta: " + r.cheio.join(", "));

// ------------------------------------------- sem item nao fecha
if (!r.semItem.length) falhas.push("pedido SEM ITEM fecharia; isso ja zerou a encomenda de um cliente");
if (!r.semItem.some((x) => /item/i.test(x))) falhas.push("o motivo de nao fechar sem item nao fala de item");

// ------------------------------------------- bolo sem sabor nao fecha
//
// A COBRANCA E O EFEITO, E NAO A FRASE.
//
// Isto exigia a expressao "sabor do bolo" no motivo. Em 28/08/2026 o
// fechamento parou de ter uma checagem propria pro bolo (era a terceira copia
// da mesma comparacao escrita a mao) e passou a usar o laco de familia, que
// diz "qual bolo voce quer". O comportamento ficou igual e ate melhor: antes o
// cliente ouvia a mesma falta DUAS vezes, com palavras diferentes.
//
// Teste que cobra a frase quebra quando a frase melhora. O que nao pode mudar e
// o bolo sem sabor nao fechar, e o motivo falar do bolo.
if (!r.semSaborNoBolo.length || !r.semSaborNoBolo.some((x) => /bolo/i.test(x))) {
  falhas.push("bolo sem sabor fecharia: a cozinha receberia um bolo que ninguem sabe assar");
}

// ------------------------------------------- sem dados nao fecha
for (const oQue of ["nome", "hora", "pagamento"]) {
  if (!r.semDados.some((x) => new RegExp(oQue, "i").test(x))) {
    falhas.push("pedido sem " + oQue + " fecharia");
  }
}

// ------------------------------------------- a conta bate
{
  const linhas = r.cotacao.linhas ?? [];
  if (!linhas.length) falhas.push("o motor nao cotou nenhum item do pedido");
  const soma = linhas.reduce((s, l) => s + Number(l.subtotal || 0), 0);
  if (Math.abs(soma - Number(r.cotacao.total || 0)) > 0.01) {
    falhas.push("o total (" + r.cotacao.total + ") nao e a soma das linhas (" + soma.toFixed(2) + ")");
  }
  // O bolo tem que sair por quilo, senao a padaria cobra 2 bolos em vez de 2 kg.
  const bolo = linhas.find((l) => /bolo/i.test(String(l.item)));
  if (bolo && bolo.unidade !== "kg") falhas.push("o bolo foi cotado em " + bolo.unidade + " em vez de kg");
}

// --------------------------------- a IA nunca confirma sozinha
//
// ATENCAO: "precisa confirmacao" NAO quer dizer "a equipe precisa aprovar".
//
// Eu li errado ate 23/08/2026 e marcava TODO pedido assim, e um pedido sem
// pendencia nenhuma caiu na tela de espera dizendo "falta confirmar detalhe com
// o cliente", sem detalhe nenhum a confirmar.
//
// As duas filas do painel sao coisas diferentes:
//
//   APROVACAO             o pedido esta completo e so espera a dona aprovar
//   AGUARDANDO CONFIRMACAO  a EQUIPE precisa resolver algo antes (o valor do
//                           topo, que nao tem preco de tabela)
//
// O que garante que a IA nunca confirma sozinha e o pedido passar por
// registrarPedido e ficar esperando a dona nas duas filas. O que este teste
// cobra e que a pendencia SAIA DO MOTIVO, em vez de ser ligada em todo pedido.
const fonte = fs.readFileSync(path.join(__dirname, "..", "lib/ia/fluxo/fechar.ts"), "utf8");
if (/precisaConfirmacao: true/.test(fonte)) {
  falhas.push("todo pedido voltou a entrar como 'precisa confirmacao'; pedido sem pendencia cai na fila errada");
}
if (!/precisaConfirmacao: Boolean\(motivoParaAEquipe/.test(fonte)) {
  falhas.push("a pendencia da equipe deixou de sair do motivo");
}
if (!/registrarPedido\(/.test(fonte)) {
  falhas.push("o pedido deixou de passar por registrarPedido; a IA estaria fechando sozinha");
}

console.log("Total cotado: R$ " + Number(r.cotacao.total).toFixed(2) + " em " + r.cotacao.linhas.length + " linhas");
console.log("Travas testadas: sem item, bolo sem sabor, sem dados, conta e aprovacao");
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: so fecha com tudo, o total e o do motor, e quem aprova e a equipe.");
