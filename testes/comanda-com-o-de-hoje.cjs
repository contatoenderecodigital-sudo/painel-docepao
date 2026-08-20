// A COMANDA TEM QUE ACOMPANHAR O QUE ENTROU NO CATALOGO HOJE.
//
// Em 19/08/2026 entraram no sistema: pizza redonda com as regras da dona (2
// sabores, por peso), o topo de bolo como linha propria com valor lancado pela
// equipe, e o sortido montado pelo codigo. Produto novo que a cozinha nao sabe
// produzir e pedido que sai errado no balcao.
//
// Este teste monta um pedido com TUDO isso junto e olha o papel que sairia.
//
// Roda com: node testes/comanda-com-o-de-hoje.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const pasta = mkdtempSync(join(tmpdir(), "comanda-"));
execFileSync(
  "npx",
  ["tsc", "lib/ia/orcamento.ts", "lib/departamentos.ts", "lib/cupom-escpos.ts", "lib/tipos.ts",
   "--outDir", pasta, "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule"],
  { stdio: "pipe", shell: true },
);
const { cotarPorItens } = require(join(pasta, "ia", "orcamento.js"));
const { deptoDe, DEPARTAMENTOS } = require(join(pasta, "departamentos.js"));
const { montarCupons } = require(join(pasta, "cupom-escpos.js"));

const limpo = (t) => String(t).replace(/\x1B.|\x1D.|[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
const semAcento = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

// Um pedido com o que entrou hoje, mais o que ja existia, pra ver tudo junto.
const ITENS = [
  { produto: "pizza redonda", qtd: 1.2, unidade: "kg", obs: "calabresa e frango com catupiry" },
  { produto: "pizza inteira", qtd: 1, unidade: "un", obs: "portuguesa, bacon com brócolis" },
  { produto: "topo de bolo", qtd: 1, unidade: "un", obs: "tema dinossauro, Théo, 7 anos" },
  { produto: "bolo bombom", qtd: 2, unidade: "kg", obs: "pão de ló branco, topo de bolo" },
  { produto: "coxinha", qtd: 50, unidade: "un", obs: null },
  { produto: "esfirra", qtd: 50, unidade: "un", obs: "calabresa" },
  { produto: "brigadeiro", qtd: 25, unidade: "un", obs: "forminha azul" },
  { produto: "cuca recheada", qtd: 3, unidade: "kg", obs: "goiaba" },
];

console.log("== todo item novo tem comanda de cozinha ==");
for (const i of ITENS) {
  const d = deptoDe(i.produto, i.obs ?? "");
  conferir(!!d && d !== "outros", `"${i.produto}" vai pra uma comanda propria`, "caiu em: " + d);
}

console.log("");
console.log("== o motor cobra por todos eles ==");
const cot = cotarPorItens(ITENS.map((i) => ({ item: i.produto, qtd: i.qtd, obs: i.obs ?? undefined })));
for (const l of cot.linhas) {
  conferir(l.subtotal > 0, `"${l.item}" tem preco`, "saiu zerado, a padaria produz de graca");
}
conferir(cot.total > 0, "o total do pedido e maior que zero", "total zerado");

console.log("");
console.log("== a pizza redonda sai POR PESO, nao por unidade ==");
const redonda = cot.linhas.find((l) => /redonda/i.test(l.item));
conferir(!!redonda, "a pizza redonda entrou no orcamento", "sumiu do pedido");
conferir(redonda && (redonda.unidade ?? "un") === "kg", "e sai em kg", "saiu em " + (redonda && redonda.unidade));
conferir(
  redonda && Math.abs(redonda.unit - 41.9) < 0.01,
  "ao preco que a dona falou no audio, R$ 41,90 o quilo",
  "saiu a R$ " + (redonda && redonda.unit),
);

console.log("");
console.log("== o papel que sairia ==");
// A COMANDA SAI DOS ITENS DO PEDIDO, NAO DA COTACAO.
//
// A primeira versao deste teste montava o papel a partir de cotarPorItens, e o
// TOPO DE BOLO sumia: ele nao tem preco de tabela, quem lanca o valor e a dona
// na tela, entao o motor descarta. Na vida real o topo esta em pedido_itens com
// o valor dela, e e de la que a comanda sai. Testar pelo caminho errado me
// faria "consertar" a comanda que estava certa.
const precoDe = (nome) => {
  const l = cot.linhas.find((x) => semAcento(x.item) === semAcento(nome));
  return l ? Math.round(l.subtotal * 100) : 3500; // topo: valor lancado pela dona
};
const pedido = {
  id: "teste-comanda",
  clienteNome: "Juliana Ravazzi",
  telefone: "5511999990000",
  retiradaData: "2026-09-20",
  retiradaHora: "15:00",
  formaPagamento: "pix",
  observacoes: null,
  totalCentavos: Math.round(cot.total * 100) + 3500,
  itens: ITENS.map((i) => ({
    produto: i.produto,
    qtd: i.qtd,
    unidade: i.unidade,
    obs: i.obs ?? null,
    subtotalCentavos: precoDe(i.produto),
  })),
};
const cupons = montarCupons(pedido);
const papel = limpo(Array.isArray(cupons) ? cupons.join("\n") : String(cupons));

conferir(cupons.length >= 2, "sai mais de uma comanda (" + cupons.length + ")", "tudo numa comanda so");

for (const [oque, procura] of [
  ["o nome do cliente", /juliana/i],
  ["a data da retirada", /20\/09|2026-09-20/],
  ["a hora da retirada", /15:00/],
  ["a pizza redonda", /redonda/i],
  ["o peso da redonda em kg", /1,2 kg|1\.2 kg/i],
  ["o topo com o nome do aniversariante", /th[ée]o/i],
  ["a idade", /7 anos/i],
  ["a cor da forminha", /azul/i],
  ["o recheio da esfirra", /calabresa/i],
  ["o sabor da cuca", /goiaba/i],
]) {
  conferir(procura.test(papel), "o papel traz " + oque, "nao achei no cupom");
}

console.log("");
console.log("== o total so aparece no ticket do caixa ==");
const doCaixa = cupons.filter((c) => /caixa/i.test(limpo(c)));
conferir(doCaixa.length === 1, "existe UM ticket de caixa", doCaixa.length + " tickets de caixa");

console.log("");
console.log("== nenhuma comanda sai vazia ==");
for (const c of cupons) {
  const t = limpo(c).replace(/[^a-zA-Z0-9]/g, "");
  conferir(t.length > 40, "comanda com conteudo (" + t.length + " caracteres)", "comanda praticamente vazia");
}

console.log("");
console.log(erros === 0 ? "A COMANDA ACOMPANHA O CATALOGO DE HOJE" : erros + " FALHA(S) NA COMANDA");
process.exit(erros === 0 ? 0 : 1);
