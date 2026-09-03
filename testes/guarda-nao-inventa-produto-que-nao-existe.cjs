// A GUARDA ANTI-INVENCAO NAO PODE INVENTAR.
//
// Medido conversando com o servidor em 31/08/2026, e o log do container guardou
// a cadeia inteira:
//
//   padaria >> Qual recheio do risólis você prefere, carne ou frango?
//   cliente >> frango
//   modelo  >> 1x mini sanduíche de patê de frango [frango]
//   guarda  >> "ele nao falou sanduiche, pate; fiquei com mini frango"
//   pedido  >> 1 ~ mini frango
//   padaria >> O risólis é de que sabor? Tem carne e frango.
//
// TRES DEFEITOS NA MESMA CADEIA, e os tres de guarda minha:
//
// 1. O modelo inventou um produto a partir da palavra "frango". A guarda que
//    existe pra barrar invencao arrancou as palavras que o cliente nao disse e
//    produziu "mini frango", que NAO EXISTE no cardapio. Invencao pior que a
//    original: o motor de preco casa nome por pedaco, e o mais longo terminado
//    em "frango" e "pizza inteira strogonoff de frango". A linha fantasma seria
//    cotada em R$ 120,00.
//
// 2. O item entrava no pedido mesmo o cliente tendo so respondido um sabor.
//
// 3. O sabor ficava preso no item descartado. `donoNaFrase` marca como "ja tem
//    dono" todo sabor que o modelo amarrou a um item, e era montado da leitura
//    CRUA: o risolis nunca recebia o frango e a padaria repetia a pergunta pra
//    sempre.
//
// Nenhum dos 127 testes pegava isso. Quem pegou foi conversar.
//
// Roda com: node testes/guarda-nao-inventa-produto-que-nao-existe.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ITENS = [
  { produto: "bolinha de queijo", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: "queijo" },
  { produto: "coxinha", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: "frango" },
  { produto: "risólis", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: null },
  { produto: "mini bolha", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: "frito" },
];

const CASOS = [
  {
    nome: "o produto que o modelo montou em cima do sabor nao vira linha",
    fala: "frango",
    leitura: { itens: [{ produto: "mini sanduíche de patê de frango", qtd: 1, sabor: "frango" }] },
    naoTemProduto: ["mini frango", "mini sanduíche de patê de frango"],
    dano: "linha fantasma no pedido, e o motor cotava R$ 120,00 nela",
  },
  {
    nome: "e o sabor chega em quem a padaria perguntou",
    // O MODELO LE ISTO (medido 3 de 3 em 03/09/2026, vendo a conversa).
    fala: "frango",
    leitura: { itens: [{ produto: "risólis", qtd: 50, sabor: "frango" }] },
    sabor: { "risólis": "frango" },
    dano: "a padaria repetia a mesma pergunta e a conversa nunca fechava",
  },
  {
    nome: "quem pede o sanduiche com todas as letras continua sendo atendido",
    fala: "quero 50 mini sanduiche de pate de frango",
    leitura: { itens: [{ produto: "mini sanduíche de patê de frango", qtd: 50 }] },
    temProduto: ["mini sanduíche de patê de frango"],
    dano: "a guarda derrubaria uma venda de verdade",
  },
];

const sonda = path.join(__dirname, "_sonda-guarda-nao-inventa.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const ITENS = " + JSON.stringify(ITENS) + ";",
    "const pensar = (l) => (async () => l);",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:true, pessoas:20, base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "    baseAceita:true, naoQuer:[], itens:ITENS,",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null,",
    "    ultimaFala:'Qual recheio do risólis você prefere, carne ou frango?', insistiu:1,",
    "    retomarEm:null, assunto:null,",
    "    etapasJaPerguntadas:['abertura','base_da_festa','salgado','salgado:sabor'],",
    "    etapasAdiadas:[], pecasMandadas:['salgados'],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, pensar(c.leitura) as never);",
    "  saiu.push(r.estado.itens.map((i) => ({ p: i.produto, o: i.obs })));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-guarda-nao-inventa.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let erros = 0;
console.log("== a guarda anti-invencao nao pode inventar ==");
CASOS.forEach((c, n) => {
  const itens = saiu[n];
  const problemas = [];
  for (const p of c.naoTemProduto ?? []) {
    if (itens.some((i) => semAc(i.p) === semAc(p))) problemas.push("entrou \"" + p + "\" no pedido");
  }
  for (const p of c.temProduto ?? []) {
    if (!itens.some((i) => semAc(i.p) === semAc(p))) problemas.push("faltou \"" + p + "\" no pedido");
  }
  for (const [produto, sabor] of Object.entries(c.sabor ?? {})) {
    const item = itens.find((i) => semAc(i.p) === semAc(produto));
    if (!item || !semAc(item.o).includes(semAc(sabor))) {
      problemas.push(produto + " ficou com " + JSON.stringify(item ? item.o : null) + ", esperado " + JSON.stringify(sabor));
    }
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
