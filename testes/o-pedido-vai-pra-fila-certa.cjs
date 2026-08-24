// O PEDIDO VAI PRA FILA CERTA, E O BOLO PRA BANCADA CERTA
//
// Terceiro teste do dono no celular, 23/08/2026, com os cupons impressos na mao.
// Tres defeitos, e o do bolo saiu no papel.
//
// 1. O BOLO DE FESTA FOI IMPRESSO COMO BOLO CASEIRO
//
//    A cliente escolheu bolo de festa sabor prestigio, 2,5 kg. No painel estava
//    certo: "Bolo de festa / prestigio / 2,5 quilos". Na comanda saiu:
//
//      == BOLO CASEIRO ==
//      2,5 un  bolo caseiro prestigio com ganache
//      2,5 un x R$ 33,90 = R$ 84,75
//
//    O motor casa o produto pelo NOME, e "prestigio" sozinho e o nome do bolo
//    CASEIRO prestigio com ganache. O bolo de festa prestigio custa R$ 46,90 o
//    QUILO e so aparece quando o nome comeca com "bolo".
//
//    O estrago passou do preco: o pedido foi pra bancada errada da cozinha.
//    Palavras do dono: "ta indo o bolo de festa recheado na aba de bolo caseiro,
//    isso nao pode acontecer, ele eh BOLO FESTA MANO".
//
// 2. PEDIDO SEM PENDENCIA NENHUMA CAIU NA FILA DE ESPERA
//
//    "Aprovacao" e a fila normal; "Aguardando confirmacao" e pra pedido que a
//    EQUIPE precisa resolver antes (hoje, so o topo, que nao tem preco de
//    tabela). Eu marcava todo pedido como "precisa confirmacao", e um pedido sem
//    topo nenhum caiu na tela de espera dizendo "falta confirmar detalhe com o
//    cliente", sem detalhe nenhum a confirmar.
//
// 3. O "SIM" DELE AO VALOR DA EQUIPE CAIA NO VAZIO
//
//    A equipe lancou o valor, a Dora mandou o total novo, ele respondeu "sim", e
//    o pedido nao saiu do lugar: o dono teve que aprovar na mao. E a Dora ainda
//    respondia "pronto, seu pedido foi pra fila da equipe", que era mentira.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-fila.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { motorPadrao } from "../lib/ia/orcamento.ts";',
    'import { paraOMotor } from "../lib/ia/fluxo/cotar.ts";',
    'import { respostaAoValor } from "../lib/ia/fluxo/falas-do-cliente.ts";',
    "",
    "// o pedido da Alice, do jeito que ficou no painel",
    "const itens = [",
    "  { produto:'prestígio', categoria:'bolo_festa', qtd:2.5, obs:'embalagem com tampa' },",
    "  { produto:'beijinho', categoria:'docinho', qtd:63, obs:'forminha amarelo' },",
    "  { produto:'papel de arroz', categoria:'papel_de_arroz', qtd:1, obs:'tema minions' },",
    "];",
    "const cot = motorPadrao.cotarPorItens(paraOMotor(itens));",
    "",
    "// e um bolo caseiro de verdade continua sendo caseiro",
    "const caseiro = motorPadrao.cotarPorItens(paraOMotor([",
    "  { produto:'bolo caseiro prestígio com ganache', categoria:'bolo_caseiro', qtd:1, obs:null },",
    "]));",
    "",
    "const respostas = {};",
    "for (const t of ['sim','ok','pode ser','fechado','nao','não quero','muito caro',",
    "                 'nao, pode ser mais barato?','e o bolo?','quanto?']) {",
    "  respostas[t] = respostaAoValor(t);",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  linhas: (cot.linhas ?? []).map((l) => ({ item: l.item, categoria: l.categoria, qtd: l.qtd, unidade: l.unidade, unit: l.unit })),",
    "  caseiro: (caseiro.linhas ?? []).map((l) => ({ item: l.item, categoria: l.categoria, unit: l.unit })),",
    "  respostas,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-fila.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

// ------------------------------- 1. o bolo de festa e cotado como bolo de festa
const bolo = r.linhas.find((l) => /bolo/i.test(String(l.item)));
if (!bolo) falhas.push("o bolo sumiu da cotacao");
else {
  if (/caseiro/i.test(String(bolo.item))) {
    falhas.push("o bolo de FESTA foi cotado como '" + bolo.item + "': vai pra bancada errada da cozinha");
  }
  if (bolo.unidade !== "kg") {
    falhas.push("o bolo de festa foi cotado em '" + bolo.unidade + "' em vez de kg: a padaria cobra por quilo");
  }
  if (Number(bolo.unit) !== 46.9) {
    falhas.push("o bolo de festa prestigio saiu a R$ " + bolo.unit + " em vez de R$ 46,90 o quilo");
  }
}
// E o caseiro de verdade continua caseiro: a correcao nao pode empurrar tudo
// pro bolo de festa.
if (!/caseiro/i.test(String(r.caseiro[0]?.item ?? ""))) {
  falhas.push("o bolo caseiro deixou de ser caseiro: " + JSON.stringify(r.caseiro));
}

// --------------------------- 2. a fila: pendencia so quando ha o que resolver
const fechar = fs.readFileSync(path.join(__dirname, "..", "lib/ia/fluxo/fechar.ts"), "utf8");
if (/precisaConfirmacao: true/.test(fechar)) {
  falhas.push(
    "todo pedido volta a entrar como 'precisa confirmacao': pedido sem pendencia nenhuma cai " +
      "na tela de espera em vez da fila de aprovacao",
  );
}
if (!/precisaConfirmacao: Boolean\(motivoParaAEquipe/.test(fechar)) {
  falhas.push("a pendencia da equipe deixou de sair do motivo; ela tem que existir so quando ha o que resolver");
}
// A regra que nao muda: a IA nunca confirma sozinha.
if (!/registrarPedido/.test(fechar)) falhas.push("o pedido deixou de passar por registrarPedido");

// ------------------------- 3. o sim e o nao dele ao valor da equipe
const esperado = {
  sim: "aceitou", ok: "aceitou", "pode ser": "aceitou", fechado: "aceitou",
  nao: "recusou", "não quero": "recusou", "muito caro": "recusou",
  "nao, pode ser mais barato?": "recusou", // o "nao" vem primeiro e manda
  "e o bolo?": null, "quanto?": null, // na duvida, pergunta de novo
};
for (const [fala, deve] of Object.entries(esperado)) {
  if (r.respostas[fala] !== deve) {
    falhas.push("'" + fala + "' foi lido como " + r.respostas[fala] + " em vez de " + deve);
  }
}
// E o aceite tem que mexer no pedido de verdade.
const atender = fs.readFileSync(path.join(__dirname, "..", "lib/ia/fluxo/atender.ts"), "utf8");
if (!/registrarAceiteCliente/.test(atender)) {
  falhas.push("o 'sim' dele nao move o pedido pra fila de aprovacao; volta o caso de aprovar na mao");
}
if (!/devolverPedidoParaEquipe/.test(atender)) {
  falhas.push("a recusa dele nao devolve o pedido pra equipe; ele fica no limbo");
}

console.log("Cotacao: " + r.linhas.map((l) => l.item + " " + l.qtd + l.unidade + " R$" + l.unit).join(" | "));
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: bolo de festa e bolo de festa, e o pedido espera na fila certa.");
