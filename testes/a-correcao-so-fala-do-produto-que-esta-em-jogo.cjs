// A PADARIA SO CORRIGE O PRODUTO DE QUE SE ESTAVA FALANDO.
//
// Do pedido de festa de 30/08/2026:
//
//   padaria >> Qual sabor você quer para o mini bolha?
//   cliente >> quero carne
//   padaria >> A gente faz coxinha de frango. Quais docinhos você quer?
//
// Palavra do dono: "respondi e ele falou um negocio da coxinha nada ver nem
// entendi". Ele nao entendeu porque nao havia o que entender: estava
// respondendo sobre o MINI BOLHA.
//
// O que acontecia: a coxinha ja estava no pedido, o "carne" da frase alcancou
// ela tambem, e como coxinha e de frango no cardapio a padaria "corrigiu" um
// pedido que ninguem tinha feito. Corrigir o cliente sobre coisa que ele nao
// pediu e pior do que ficar calado: ele para a conversa pra decifrar uma frase
// que nao era pra ele.
//
// O QUE NAO PODE SUMIR JUNTO, e por isso os outros dois casos existem: quem
// pede "coxinha de carne" com todas as letras PRECISA ouvir que ela e de
// frango, senao a comanda sai com uma coisa e o cliente espera outra. E quem
// responde so o sabor logo depois da padaria perguntar da coxinha tambem.
//
// A ISCA: tirando o `if (!eleNomeou && !aPerguntaEraDele)` de `fluxo.ts`, o
// primeiro caso volta a falar de coxinha e este teste fica vermelho.
//
// Roda com: node testes/a-correcao-so-fala-do-produto-que-esta-em-jogo.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "responde o sabor do mini bolha: a coxinha nao entra na conversa",
    ultima: "Qual sabor você quer para o mini bolha?",
    fala: "quero carne",
    leitura: { itens: [{ produto: "mini bolha", qtd: 50, sabor: "carne" }, { produto: "coxinha", qtd: 50, sabor: "carne" }] },
    citaCoxinha: false,
    dano: "o cliente le uma correcao sobre um produto que ele nao pediu e para pra entender",
  },
  {
    nome: "pede coxinha de carne com todas as letras: precisa ouvir que e de frango",
    ultima: null,
    fala: "quero 50 coxinha de carne",
    leitura: { itens: [{ produto: "coxinha", qtd: 50, sabor: "carne" }] },
    citaCoxinha: true,
    dano: "a comanda sairia de frango e o cliente esperaria carne",
  },
  {
    nome: "a padaria perguntou da coxinha e ele respondeu so o sabor",
    ultima: "Qual sabor você quer na coxinha?",
    fala: "de carne",
    leitura: { itens: [{ produto: "coxinha", qtd: 50, sabor: "carne" }] },
    citaCoxinha: true,
    dano: "quem responde a pergunta da coxinha esta falando da coxinha",
  },
];

const sonda = path.join(__dirname, "_sonda-correcao-do-produto.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const pensar = (l) => (async () => l);",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[],",
    "    itens:[",
    "      { produto:'coxinha', categoria:'salgado_frito', qtd:50, unidade:'un', obs:'frango' },",
    "      { produto:'mini bolha', categoria:'salgado_frito', qtd:50, unidade:'un', obs:'frito' },",
    "    ],",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:c.ultima, insistiu:0,",
    "    retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, pensar(c.leitura) as never);",
    "  saiu.push({ texto: String(r.fala.texto || '') });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-correcao-do-produto.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a correcao so fala do produto que esta em jogo ==");
CASOS.forEach((c, n) => {
  const citou = /coxinha de frango/i.test(saiu[n].texto);
  const ok = citou === c.citaCoxinha;
  console.log(
    (ok ? "ok    " : "ERRO  ") + c.nome +
    (ok ? "" : "  ->  " + (citou ? "falou" : "nao falou") + " da coxinha; " + c.dano +
      "  |  resposta: " + saiu[n].texto.replace(/\n/g, " ").slice(0, 120)),
  );
  if (!ok) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
