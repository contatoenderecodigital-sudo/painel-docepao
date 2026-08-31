// A RESTRICAO QUE O CARDAPIO TEM ENTRA NO PEDIDO. A QUE ELE NAO TEM VAI PRA EQUIPE.
//
// Do pedido de festa de 30/08/2026, o primeiro fechado ponta a ponta:
//
//   cliente >> Vou querer de brigadeiro sem lactose
//   padaria >> Sobre o sem lactose: deixa eu confirmar com a equipe e ja te
//              retorno por aqui.
//   pedido  >> 2 kg de bolo brigadeiro   R$ 46,90/kg = R$ 93,80
//
// Duas coisas erradas de uma vez. O sem lactose NAO entrou no pedido, e a
// equipe tambem NUNCA foi avisada: nao havia nada no painel, nem na fila de
// aprovacao, nem sino. O cliente ficou esperando um retorno que nao existia.
//
// Palavra do dono, 31/08/2026: *"se tem no cardapio tem q add mano, dps a
// equipe resolve isso se n puder fazer, se ela mandou no audio q faz eh pq
// faz"*.
//
// E a dona mandou no audio, em `docepao1608 (3).txt`:
//
//   *"Sim, Emily, da pra misturar. Sim, com certeza. A gente sempre vai cobrar
//   o valor mais caro. (...) Se ela quiser o bolo zero lactose, que contenha,
//   por exemplo, coco, que e o valor de frutas ali, ele vai ficar tambem
//   R$ 55,90."*
//
// Entao `0% lactose` e sabor de bolo de festa da faixa C e mistura como
// qualquer outro. Dois quilos passam de R$ 93,80 pra R$ 111,80, e a venda
// fecha sozinha.
//
// O QUE NAO PODE MUDAR JUNTO, e por isso os outros casos estao aqui: docinho
// sem lactose a casa nao faz, e prometer isso pra quem tem intolerancia deixa
// de ser prejuizo e vira problema de saude. Gluten, vegano e diet nao aparecem
// em lugar nenhum do cardapio nem nas 55 transcricoes. Esses continuam saindo
// da observacao e chamando a equipe.
//
// A ISCA: tirando o bloco `misturaQueACasaFaz` de `fluxo.ts`, o primeiro caso
// volta pra R$ 93,80 e este teste fica vermelho.
//
// Roda com: node testes/a-restricao-que-o-cardapio-tem-entra-no-pedido.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const BOLO_VAZIO = [{ produto: "bolo", categoria: "bolo_festa", qtd: 2, unidade: "kg", obs: null }];

const CASOS = [
  {
    nome: "bolo de brigadeiro sem lactose entra como misto e cobra a faixa C",
    itens: BOLO_VAZIO,
    ultima: "E o bolo, qual sabor?",
    fala: "Vou querer de brigadeiro sem lactose",
    leitura: { itens: [{ produto: "bolo brigadeiro", qtd: 2, obs: "sem lactose" }] },
    produto: "bolo brigadeiro com 0% lactose",
    total: 111.8,
    equipe: false,
    dano: "R$ 18,00 a menos no bolo, e o cliente esperando um retorno que ninguem ia dar",
  },
  {
    nome: "a observacao nao fica com o misto torto",
    itens: BOLO_VAZIO,
    ultima: "E o bolo, qual sabor?",
    fala: "Vou querer de brigadeiro sem lactose",
    leitura: { itens: [{ produto: "bolo brigadeiro", qtd: 2, obs: "sem lactose" }] },
    obsNaoTem: "misto: bolo brigadeiro com 0% lactose",
    dano: "a comanda saia com 'misto: bolo brigadeiro com 0% lactose e bolo brigadeiro'",
  },
  {
    nome: "docinho sem lactose a casa NAO faz: chama a equipe",
    itens: [],
    ultima: "Quais docinhos você quer?",
    fala: "quero 30 brigadeiro sem lactose",
    leitura: { itens: [{ produto: "brigadeiro", qtd: 30, obs: "sem lactose" }] },
    produto: "brigadeiro",
    total: 37.5,
    equipe: true,
    dano: "prometer sem lactose pra quem tem intolerancia vira problema de saude",
  },
  {
    nome: "bolo sem gluten nao existe no cardapio: chama a equipe",
    itens: BOLO_VAZIO,
    ultima: "E o bolo, qual sabor?",
    fala: "de brigadeiro sem gluten",
    leitura: { itens: [{ produto: "bolo brigadeiro", qtd: 2, obs: "sem gluten" }] },
    produto: "bolo brigadeiro",
    total: 93.8,
    equipe: true,
    dano: "gluten nao aparece no cardapio nem nas 55 transcricoes da dona",
  },
  {
    nome: "a promessa sai da observacao quando a casa nao faz",
    itens: BOLO_VAZIO,
    ultima: "E o bolo, qual sabor?",
    fala: "de brigadeiro sem gluten",
    leitura: { itens: [{ produto: "bolo brigadeiro", qtd: 2, obs: "sem gluten" }] },
    obsNaoTem: "gluten",
    dano: "a cozinha produz normal e o cliente leu a promessa na confirmacao",
  },
];

const sonda = path.join(__dirname, "_sonda-restricao-do-cardapio.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { cotarPorItens } from "../lib/ia/orcamento.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const pensar = (l) => (async () => l);",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:c.itens,",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:c.ultima,",
    "    insistiu:0, retomarEm:null, assunto:null, etapasJaPerguntadas:['bolo'], etapasAdiadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, pensar(c.leitura) as never);",
    "  const itens = r.estado.itens.map((i) => ({ p: i.produto, q: i.qtd, o: i.obs }));",
    "  saiu.push({",
    "    itens,",
    "    total: cotarPorItens(itens.map((i) => ({ item: i.p, qtd: i.q }))).total,",
    "    equipe: Boolean(r.precisaHumano),",
    "  });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-restricao-do-cardapio.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a restricao que o cardapio tem entra no pedido ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  if (c.produto && !r.itens.some((i) => i.p === c.produto)) {
    problemas.push("produto ficou " + JSON.stringify(r.itens.map((i) => i.p)) + ", esperado \"" + c.produto + "\"");
  }
  if (c.total != null && Math.abs(Number(r.total) - c.total) > 0.005) {
    problemas.push("total ficou R$ " + r.total + ", esperado R$ " + c.total);
  }
  if (c.equipe != null && r.equipe !== c.equipe) {
    problemas.push("chamar a equipe ficou " + r.equipe + ", esperado " + c.equipe);
  }
  if (c.obsNaoTem) {
    const achou = r.itens.some((i) => String(i.o ?? "").toLowerCase().includes(c.obsNaoTem.toLowerCase()));
    if (achou) problemas.push("a observacao tem \"" + c.obsNaoTem + "\": " + JSON.stringify(r.itens.map((i) => i.o)));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
