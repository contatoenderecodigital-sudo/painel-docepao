// QUEM PERGUNTA POR RESTRICAO OUVE UMA RESPOSTA, E NAO A TABELA DE PRECO.
//
// Medido conversando com a producao em 31/08/2026:
//
//   cliente >> oi, voces fazem bolo sem lactose?
//   padaria >> Bolo de festa sai de R$ 46,90 a R$ 55,90 o quilo, conforme o
//              sabor e o caseiro de R$ 30,90 a R$ 35,90 a unidade.
//
// Ela respondeu o preco do bolo e NAO respondeu a pergunta. E a casa FAZ: o
// `0% lactose` e sabor de bolo de festa da faixa C, R$ 55,90 o quilo. Quem
// pergunta por restricao pergunta ANTES de qualquer outra coisa, e vai embora
// com o silencio: e a venda mais facil de perder que existe aqui.
//
// A decisao do dono, em 31/08/2026: o sem lactose FECHA A VENDA SOZINHO, porque
// esta no cardapio. O que a casa nao faz continua indo pra equipe, com a frase
// que o pedido ja usa: ela nao promete nada, so diz que alguem confirma.
//
// O nome e o preco saem do catalogo e do motor. Nenhuma lista minha.
//
// A ISCA: tirando o bloco de `fluxo.ts`, a primeira pergunta volta a ouvir so a
// tabela de preco.
//
// Roda com: node testes/a-pergunta-da-restricao-tem-resposta.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "sem lactose: a casa faz, e ela diz qual bolo e quanto e",
    fala: "oi, voces fazem bolo sem lactose?",
    tem: ["0% lactose", "55,90"],
    equipe: false,
    dano: "a venda mais facil de perder: ele pergunta isso antes de tudo",
  },
  {
    nome: "e o cliente nao precisa da equipe pra isso",
    fala: "tem bolo zero lactose?",
    tem: ["0% lactose"],
    equipe: false,
    dano: "decisao do dono em 31/08: o que esta no cardapio fecha sozinho",
  },
  {
    nome: "sem gluten: a casa nao faz, entao a equipe confirma",
    fala: "voces fazem bolo sem gluten?",
    tem: ["equipe"],
    naoTem: ["fazemos sim"],
    equipe: true,
    dano: "prometer o que a cozinha nao faz, ou deixar a pergunta no ar",
  },
  {
    nome: "pergunta sem restricao nenhuma continua igual",
    fala: "quanto custa o bolo?",
    tem: ["46,90"],
    naoTem: ["fazemos sim", "confirmar com a equipe"],
    equipe: false,
    dano: "a pergunta mais comum da padaria nao pode mudar",
  },
];

const sonda = path.join(__dirname, "_sonda-pergunta-restricao.mts");
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
    "  const leitura = { itens: [], perguntou: { sobre: 'preco', familia: 'bolo' } };",
    "  const r = await responder(base as never, { texto: c.fala }, (async () => leitura) as never);",
    "  saiu.push({ texto: String(r.fala.texto || ''), equipe: !!r.precisaHumano, itens: r.estado.itens.length });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pergunta-restricao.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a pergunta da restricao tem resposta ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const baixo = r.texto.toLowerCase();
  const problemas = [];
  for (const parte of c.tem ?? []) {
    if (!baixo.includes(parte.toLowerCase())) {
      problemas.push("nao diz \"" + parte + "\": " + JSON.stringify(r.texto.slice(0, 70)));
    }
  }
  for (const parte of c.naoTem ?? []) {
    if (baixo.includes(parte.toLowerCase())) problemas.push("diz \"" + parte + "\", e nao devia");
  }
  if (r.equipe !== c.equipe) {
    problemas.push(c.equipe ? "nao chamou a equipe" : "chamou a equipe sem precisar");
  }
  if (r.itens !== 0) problemas.push("perguntar virou pedido: " + r.itens + " linha(s)");
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
