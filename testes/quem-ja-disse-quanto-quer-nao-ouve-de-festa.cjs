// QUEM JA DISSE QUANTO QUER NAO OUVE PERGUNTA DE FESTA.
//
// Medido conversando com a producao em 01/09/2026, na PRIMEIRA mensagem:
//
//   cliente >> oi, quero 100 coxinha pra sabado as 9h
//   padaria >> Quantas pessoas vao para a festa?
//
// Ele disse o que quer, quanto quer e pra quando. O numero de pessoas so serve
// pra SUGERIR uma base, e ninguem precisa de sugestao depois de ter decidido:
// ali a pergunta e burocracia, na mensagem em que o cliente mais desiste. Quem
// chamou aquilo de festa foi o modelo, e nao ele.
//
// O LADO QUE NAO PODE QUEBRAR, e ele ja quebrou uma vez nesta mesma tarde:
//
//   cliente >> Quero encomendar pra uma festa bolo e docinhos e salgados
//   padaria >> Quantas pessoas vao na festa?          (isto esta CERTO)
//
// Aqui o item tambem chega com quantidade 1, porque o modelo devolve 1 pra "um
// bolo" mesmo sem ninguem falar numero. A primeira versao desta regra pulou a
// pergunta nos dois casos, e a festa perdeu a proposta inteira: a padaria passou
// a perguntar o sabor do bolo antes de dizer quanto custa. Um teste que ja
// existia pegou antes de subir.
//
// O que separa os dois e o numero que o CLIENTE ditou: "100 coxinha" e escolha
// feita; "bolo" e assunto aberto.
//
// A ISCA: tirando a terceira condicao do `pulavel` em `etapas.ts`, o primeiro
// caso volta a ouvir a pergunta da festa.
//
// Roda com: node testes/quem-ja-disse-quanto-quer-nao-ouve-de-festa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "quantidade ditada na primeira mensagem: nao pergunta de festa",
    fala: "oi, quero 100 coxinha pra sabado as 9h",
    leitura: { ehFesta: true, itens: [{ produto: "coxinha", qtd: 100 }] },
    perguntaNaoTem: "pessoas",
    dano: "burocracia na mensagem em que o cliente mais desiste",
  },
  {
    nome: "festa sem quantidade ditada CONTINUA ouvindo a pergunta",
    fala: "Quero encomendar pra uma festa bolo e docinhos e salgados",
    leitura: { ehFesta: true, itens: [{ produto: "bolo", qtd: 1 }] },
    perguntaTem: "pessoas",
    dano: "sem o numero de pessoas a festa perde a proposta, e ele escolhe sem saber o preco",
  },
  {
    nome: "quem diz o numero de pessoas nao e atropelado",
    fala: "vou fazer uma festa pra 30 pessoas",
    leitura: { ehFesta: true, pessoas: 30, itens: [] },
    perguntaNaoTem: "quantas pessoas",
    dano: "perguntar de novo o que ele acabou de dizer",
  },
  {
    nome: "pedido simples segue simples",
    fala: "quero 50 pao frances pra amanha",
    leitura: { itens: [{ produto: "pao frances", qtd: 50 }] },
    perguntaNaoTem: "festa",
    dano: "quem nao falou de festa nunca deveria ouvir sobre festa",
  },
];

const sonda = path.join(__dirname, "_sonda-festa-burocracia.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:[],",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "    retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, (async () => c.leitura) as never);",
    "  saiu.push({ pergunta: String(r.fala.texto || ''), etapa: r.etapa });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-festa-burocracia.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== quem ja disse quanto quer nao ouve pergunta de festa ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  if (c.perguntaTem && !new RegExp(c.perguntaTem, "i").test(r.pergunta)) {
    problemas.push("nao perguntou: " + JSON.stringify(r.pergunta.slice(0, 60)) + " (etapa " + r.etapa + ")");
  }
  if (c.perguntaNaoTem && new RegExp(c.perguntaNaoTem, "i").test(r.pergunta)) {
    problemas.push("perguntou sem precisar: " + JSON.stringify(r.pergunta.slice(0, 60)));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
