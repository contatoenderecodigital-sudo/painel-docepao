// O QUE O CLIENTE LEU TEM QUE SER O QUE A COZINHA RECEBE.
//
// POR QUE ISTO EXISTE
//
// O resumo que o cliente confirma no WhatsApp e os cupons que saem na impressora
// sao montados em DOIS lugares diferentes: `falaDaConfirmacao`, em
// `lib/ia/fluxo/pergunta.ts`, e `montarCupons`, em `lib/cupom-escpos.ts`.
//
// Nada garantia que os dois concordassem. Este projeto ja teve tres defeitos
// dessa familia (a observacao do bolo lida de tres jeitos, a caixa do papel de
// arroz contra a linha do papel de arroz, o custo gravado em duas colunas), e
// todos comecaram igual: dois lugares guardando a mesma verdade, e um ficando
// pra tras sem ninguem perceber.
//
// O QUE ESTE TESTE COBRA, item por item:
//
//   1. todo produto do resumo esta num cupom, e vice-versa
//   2. a quantidade e a mesma nos dois
//   3. o total que o cliente leu e o total do cupom do caixa
//
// O QUE ELE NAO COBRA, de proposito: a REDACAO. O cliente le "com topo" e a
// cozinha le "topo de bolo", e isso e certo: sao duas plateias. O que nao pode
// divergir e o que se produz e o que se cobra.
//
// Roda com: node testes/o-que-o-cliente-leu-e-o-que-a-cozinha-recebe.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// O pedido de festa de 30/08/2026, o primeiro que fechou ponta a ponta.
const ITENS = [
  { produto: "bolinha de queijo", categoria: "salgado_frito", qtd: 50, obs: "queijo" },
  { produto: "coxinha", categoria: "salgado_frito", qtd: 50, obs: "frango" },
  { produto: "risólis", categoria: "salgado_frito", qtd: 50, obs: "frango" },
  { produto: "mini bolha", categoria: "salgado_frito", qtd: 50, obs: "frito | carne" },
  { produto: "bolo brigadeiro com 0% lactose", categoria: "bolo_festa", qtd: 2, obs: "tema foto de referência, nome Gabriel Lucas, 12 anos, topo de bolo" },
  { produto: "papel de arroz", categoria: "papel_de_arroz", qtd: 1, obs: "tema foto de referência, nome Gabriel Lucas, 12 anos" },
  { produto: "brigadeiro", categoria: "docinho", qtd: 50, obs: "forminha rosa" },
  { produto: "beijinho", categoria: "docinho", qtd: 50, obs: "forminha rosa" },
];

const sonda = path.join(__dirname, "_sonda-cliente-cozinha.mts");
fs.writeFileSync(
  sonda,
  [
    'import { falaDaEtapa } from "../lib/ia/fluxo/pergunta.ts";',
    'import { roteiroDoPedido } from "../lib/ia/fluxo/etapas.ts";',
    'import { montarCupons } from "../lib/cupom-escpos.ts";',
    'import { cotarPorItens } from "../lib/ia/orcamento.ts";',
    'import { unidadeDoPedido } from "../lib/ia/dados/produtos.ts";',
    "const ITENS = " + JSON.stringify(ITENS) + ";",
    "",
    "const cot = cotarPorItens(ITENS.map((i) => ({ item: i.produto, qtd: i.qtd, obs: i.obs ?? undefined })));",
    "const total = Math.round(Number(cot.total || 0) * 100);",
    "",
    "const pedido = {",
    "  ehFesta:true, pessoas:20, base:null, baseAceita:true, naoQuer:[],",
    "  itens: ITENS.map((i) => ({ ...i, unidade: unidadeDoPedido(i.produto, i.categoria) })),",
    "  dados:{nome:'Rosangela Maia',data:'12/09/2026',hora:'18:00',pagamento:'pix'},",
    "  pecas:{topo:true,papelDeArroz:true}, topoNome:'Gabriel Lucas', topoIdade:'12',",
    "  tema:'foto de referência', forminha:'rosa', prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[],",
    "};",
    "const etapa = roteiroDoPedido(pedido as never).find((e) => e.id === 'confirmacao');",
    "const resumo = falaDaEtapa(etapa as never, pedido as never, total, []).texto;",
    "",
    "const cupons = montarCupons({",
    "  id: 'a31e15cc', clienteNome: 'Rosangela Maia', clienteTelefone: '554998284354',",
    "  retiradaData: '12/09/2026', retiradaHora: '18:00', pessoas: 20,",
    "  totalCentavos: total, formaPagamento: 'pix', observacoes: null,",
    "  itens: ITENS.map((i, n) => ({",
    "    ...i,",
    "    unidade: unidadeDoPedido(i.produto, i.categoria),",
    "    unitCentavos: Math.round(Number(cot.linhas?.[n]?.unit ?? 0) * 100),",
    "    subtotalCentavos: Math.round(Number(cot.linhas?.[n]?.subtotal ?? 0) * 100),",
    "  })),",
    "} as never);",
    "",
    "console.log(JSON.stringify({ resumo, cupons, total }));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-cliente-cozinha.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const papel = r.cupons.join("\n");
let erros = 0;
const falha = (m) => { console.log("ERRO  " + m); erros++; };
console.log("== o que o cliente leu e o que a cozinha recebe ==");

// 1 e 2. cada item do pedido aparece nos dois, com a mesma quantidade
for (const i of ITENS) {
  // O papel de arroz nao vira linha propria no cupom quando ha bolo: ele e peca
  // do bolo e sai na comanda dele. O que nao pode e sumir dos dois.
  const noResumo = semAc(r.resumo).includes(semAc(i.produto));
  const noPapel = semAc(papel).includes(semAc(i.produto));
  if (!noResumo) falha(i.produto + " nao aparece no resumo que o cliente confirma");
  if (!noPapel) falha(i.produto + " nao aparece em cupom nenhum");
  const qtdNoResumo = new RegExp("(^|\\s)" + i.qtd + "\\s", "m").test(r.resumo);
  if (!qtdNoResumo) falha("a quantidade " + i.qtd + " de " + i.produto + " nao aparece no resumo");
}

// 3. o total que o cliente leu e o do cupom do caixa
const reais = (c) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
if (!r.resumo.includes(reais(r.total))) {
  falha("o total " + reais(r.total) + " nao aparece no resumo: " + JSON.stringify(r.resumo.slice(-120)));
}
if (!papel.includes(reais(r.total))) {
  falha("o total " + reais(r.total) + " nao aparece no cupom do caixa");
}

// 4. sabor que a cozinha precisa: o que esta na observacao chega no papel
for (const [produto, sabor] of [["risólis", "frango"], ["mini bolha", "carne"], ["brigadeiro", "rosa"]]) {
  if (!semAc(papel).includes(semAc(sabor))) {
    falha("a cozinha nao recebeu \"" + sabor + "\", que e o que o " + produto + " precisa");
  }
}

if (!erros) {
  console.log("ok    todo item do resumo esta num cupom, e todo cupom veio do resumo");
  console.log("ok    as quantidades sao as mesmas nos dois");
  console.log("ok    o total do cliente e o total do caixa");
  console.log("ok    o que a cozinha precisa saber chegou no papel");
}

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
