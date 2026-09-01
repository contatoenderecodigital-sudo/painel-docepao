// A CONTA DA FESTA NAO SOME NO LUGAR VAZIO.
//
// Medido conversando com a producao em 02/09/2026, e custou dois pedacos de
// festa na mesma conversa:
//
//   base    >> 250 salgados, 150 docinhos (ele tinha pedido 50 a mais de cada)
//   cliente >> coxinha, bolinha de queijo e risoles de carne
//   pedido  >> 62 + 62 + 62 = 186 salgados          (faltaram 64)
//   cliente >> brigadeiro e beijinho
//   pedido  >> 50 + 50 = 100 docinhos               (faltaram 50)
//
// O MARCADOR DE FAMILIA entrava na divisao como se fosse um sabor escolhido.
// Ele nasce quando o cliente diz que quer aquilo sem dizer qual ("quero
// docinho"), pra etapa ter o que perguntar, e ate 01/09 quase nunca convivia
// com escolha de verdade. Passou a conviver, e virou uma boca a mais na mesa.
//
// AS DUAS METADES, e nenhuma sozinha:
//
//   com escolha de verdade  ->  o lugar vazio NAO divide, e sai do pedido
//   sem escolha nenhuma     ->  ele divide, senao a familia inteira some da
//                               proposta ("quero docinho" viraria 0 docinho)
//
// A ISCA: voltando o `temEscolhaDeVerdade` pra `true` em `fluxo.ts`, os dois
// primeiros casos voltam a perder pedaco.
//
// Roda com: node testes/a-conta-da-festa-nao-some-no-lugar-vazio.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const BASE = { salgados: 250, docinhos: 150, boloKg: 2, totalCentavos: 53130 };
// Os nomes que sao LUGAR VAZIO, e nao comida.
const FAMILIAS = ["salgado", "docinho", "doce", "bolo"];

const CASOS = [
  {
    nome: "tres salgados escolhidos dividem os 250 inteiros",
    itens: [{ produto: "salgado", categoria: "salgado_frito", qtd: 0, obs: null }],
    ultima: "Quais salgados você quer?",
    fala: "coxinha, bolinha de queijo e risoles de carne",
    leitura: { itens: [{ produto: "coxinha", qtd: 1 }, { produto: "bolinha de queijo", qtd: 1 }, { produto: "risólis", qtd: 1, sabor: "carne" }] },
    soma: 250,
    familia: "salgado",
    dano: "64 salgados a menos numa festa que ele pediu 250",
  },
  {
    nome: "dois docinhos escolhidos dividem os 150 inteiros",
    itens: [{ produto: "docinho", categoria: "docinho", qtd: 0, obs: null }],
    ultima: "E os docinhos, quais você vai querer?",
    fala: "brigadeiro e beijinho, forminha rosa",
    leitura: { itens: [{ produto: "brigadeiro", qtd: 1 }, { produto: "beijinho", qtd: 1 }], forminha: "rosa" },
    soma: 150,
    familia: "docinho",
    dano: "50 docinhos a menos, e a dona so descobre na hora de montar",
  },
  {
    // A OUTRA METADE: sem escolha, o lugar vazio E a quantidade.
    //
    // Sem isto a familia inteira sumiria da proposta: quem diz "quero docinho"
    // sem dizer qual ficaria com zero docinho no pedido, e a padaria fecharia
    // uma festa sem doce.
    nome: "sem escolha nenhuma, o lugar vazio leva a quantidade",
    itens: [{ produto: "docinho", categoria: "docinho", qtd: 0, obs: null }],
    ultima: "E os docinhos, quais você vai querer?",
    fala: "pode ser o que voces tiverem",
    leitura: { itens: [] },
    soma: 150,
    familia: "docinho",
    dano: "festa fechando sem docinho nenhum",
  },
];

const sonda = path.join(__dirname, "_sonda-lugar-vazio.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const BASE = " + JSON.stringify(BASE) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:true, pessoas:20, base:BASE, baseAceita:true, naoQuer:[], itens:c.itens,",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:c.ultima,",
    "    insistiu:0, retomarEm:null, assunto:null,",
    "    etapasJaPerguntadas:['abertura','quantas_pessoas','base_da_festa','salgado','docinho'],",
    "    etapasAdiadas:[], pecasMandadas:['salgados','docinhos'],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, (async () => c.leitura) as never);",
    "  saiu.push(r.estado.itens.map((i) => ({ p: i.produto, c: i.categoria, q: Number(i.qtd) })));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-lugar-vazio.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a conta da festa nao some no lugar vazio ==");
CASOS.forEach((c, n) => {
  const itens = saiu[n];
  // SO CONTA O QUE O CLIENTE VAI COMER.
  //
  // A primeira versao deste teste somava a familia inteira, marcador incluido, e
  // por isso passava com o defeito no ar: dividir 250 entre quatro dava 62 pra
  // cada, e a soma continuava 250 — so que 62 deles eram de uma linha que nao
  // existe. Teste que soma o lugar vazio nao mede nada.
  const daFamilia = itens.filter(
    (i) => String(i.c || "").startsWith(c.familia) && !FAMILIAS.includes(String(i.p || "").toLowerCase()),
  );
  const soma = daFamilia.reduce((t, i) => t + i.q, 0);
  const lugarVazio = itens.find(
    (i) => String(i.c || "").startsWith(c.familia) && FAMILIAS.includes(String(i.p || "").toLowerCase()),
  );
  const problemas = [];
  // SEM ESCOLHA, quem carrega a quantidade E o lugar vazio: ali ele conta.
  const total = c.leitura.itens?.length ? soma : soma + Number(lugarVazio?.q ?? 0);
  if (total !== c.soma) {
    problemas.push(
      "a familia somou " + total + ", esperado " + c.soma + ": " +
      JSON.stringify(daFamilia.map((i) => i.q + "x " + i.p)),
    );
  }
  // Com escolha de verdade, o lugar vazio nao pode ficar com quantidade: ele nao
  // e um sabor, e ninguem vai produzir "docinho".
  if (c.leitura.itens?.length && lugarVazio && lugarVazio.q > 0) {
    problemas.push("o lugar vazio ficou com " + lugarVazio.q + ", e ninguem produz \"" + lugarVazio.p + "\"");
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
