// BOLO MISTO PEDIDO NUM ITEM SO NAO FAZ A PADARIA REPETIR A PERGUNTA.
//
// Cliente real em 31/08/2026:
//
//   padaria >> E o bolo, qual sabor?
//   cliente >> Laka e biz
//   padaria >> E o bolo, qual sabor?          (a MESMA pergunta)
//   cliente >> Laka e biz                     (ele repetiu)
//
// O modelo devolveu a FAMILIA com os dois sabores num item so
// (`{produto: "bolo", sabor: "laka e biz"}`). Os sabores ficavam na observacao e
// o produto continuava sendo "bolo", que e o marcador de "ainda nao escolheu":
// a etapa via generico e perguntava de novo.
//
// Quando o modelo manda os dois bolos SEPARADOS, o mesmo pedido resolve certo,
// porque a fusao do bolo misto junta os dois numa linha so. Entao aqui e so
// abrir do mesmo jeito e deixar a fusao fazer o que ela ja faz.
//
// NO BOLO O SABOR E O PROPRIO NOME DO PRODUTO ("bolo laka"), e nao uma lista
// `sabores` dentro dele. Por isso a busca que serve pra pizza e salgado nao
// achava nada aqui, e os nomes precisam sair de `opcoesDaFamilia`.
//
// SO PRA BOLO. Pizza com dois sabores e UMA pizza: abrir viraria duas linhas de
// R$ 120, que e o defeito que ja custou R$ 240 num pedido de festa. A fusao que
// junta de volta e do bolo, e nao existe pra pizza.
//
// A ISCA: tirando o galho `saboresDeBolo.length > 1` de `fluxo.ts`, o primeiro
// caso volta a repetir a pergunta.
//
// Roda com: node testes/o-bolo-misto-num-item-so-nao-repete-a-pergunta.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "familia com dois sabores vira um bolo misto, e a pergunta anda",
    itens: [{ produto: "bolo", categoria: "bolo_festa", qtd: 0, unidade: "kg", obs: null }],
    ultima: "E o bolo, qual sabor?",
    fala: "Laka e biz",
    leitura: { itens: [{ produto: "bolo", qtd: 1, sabor: "laka e biz" }] },
    umItemSo: true,
    naoEGenerico: true,
    perguntaNaoTem: "qual sabor",
    dano: "a padaria repetia a mesma pergunta e o cliente tinha que responder duas vezes",
  },
  {
    nome: "e a comanda diz os dois sabores",
    itens: [{ produto: "bolo", categoria: "bolo_festa", qtd: 0, unidade: "kg", obs: null }],
    ultima: "E o bolo, qual sabor?",
    fala: "Laka e biz",
    leitura: { itens: [{ produto: "bolo", qtd: 1, sabor: "laka e biz" }] },
    obsTem: ["laka", "biz"],
    dano: "a cozinha faria um sabor so num bolo que o cliente pediu misto",
  },
  {
    nome: "um sabor so continua igual",
    itens: [{ produto: "bolo", categoria: "bolo_festa", qtd: 0, unidade: "kg", obs: null }],
    ultima: "E o bolo, qual sabor?",
    fala: "brigadeiro",
    leitura: { itens: [{ produto: "bolo", qtd: 1, sabor: "brigadeiro" }] },
    umItemSo: true,
    naoEGenerico: true,
    dano: "o caso mais comum do bolo nao pode mudar",
  },
  {
    nome: "pizza com dois sabores continua UMA pizza",
    itens: [{ produto: "pizza inteira", categoria: "pizza", qtd: 1, unidade: "un", obs: null }],
    ultima: "Qual sabor da pizza?",
    fala: "calabresa e frango com catupiry",
    leitura: { itens: [{ produto: "pizza inteira", qtd: 1, sabor: "calabresa e frango com catupiry" }] },
    umItemSo: true,
    dano: "duas linhas de R$ 120: e o defeito que ja custou R$ 240 num pedido de festa",
  },
];

const sonda = path.join(__dirname, "_sonda-bolo-misto-um-item.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { ehNomeDeFamilia } from "../lib/ia/fluxo/generico.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const pensar = (l) => (async () => l);",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:c.itens,",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:c.ultima, insistiu:0,",
    "    retomarEm:null, assunto:null, etapasJaPerguntadas:['bolo','bolo:sabor'],",
    "    etapasAdiadas:[], pecasMandadas:['bolos-festa'],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, pensar(c.leitura) as never);",
    "  saiu.push({",
    "    itens: r.estado.itens.map((i) => ({ p: i.produto, o: i.obs, generico: ehNomeDeFamilia(i.produto) })),",
    "    pergunta: String(r.fala.texto || ''),",
    "  });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-bolo-misto-um-item.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let erros = 0;
console.log("== o bolo misto num item so nao repete a pergunta ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  if (c.umItemSo && r.itens.length !== 1) {
    problemas.push("ficou com " + r.itens.length + " linhas: " + JSON.stringify(r.itens.map((i) => i.p)));
  }
  if (c.naoEGenerico && r.itens.some((i) => i.generico)) {
    problemas.push("o produto continuou sendo o marcador de familia: " + JSON.stringify(r.itens.map((i) => i.p)));
  }
  for (const parte of c.obsTem ?? []) {
    if (!r.itens.some((i) => semAc(i.o).includes(semAc(parte)))) {
      problemas.push("a comanda nao diz \"" + parte + "\": " + JSON.stringify(r.itens.map((i) => i.o)));
    }
  }
  if (c.perguntaNaoTem && new RegExp(c.perguntaNaoTem, "i").test(r.pergunta)) {
    problemas.push("repetiu a pergunta: " + JSON.stringify(r.pergunta.slice(0, 50)));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
