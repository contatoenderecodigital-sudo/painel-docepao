// QUEM PERGUNTA "QUAIS TEM?" RECEBE A LISTA, E NAO O PRECO.
//
// Ultimo defeito da conversa dele de 02/09/2026:
//
//   16:22  padaria >> Qual salgado voce quer?
//   16:24  cliente >> quais tem?
//   16:24  padaria >> Do jeito que esta, seu pedido fica em R$ 77,65.
//
// Ele perguntou QUAIS existem e ouviu o total do pedido. Medido de novo aqui
// antes de consertar, e saiu pior: "seu pedido fica em R$ 0,00", porque nem
// havia item escolhido ainda.
//
// O modelo leu aquilo como pergunta de preco. Ele nao esta louco: "quais tem?"
// e curto e ambiguo. Quem tinha que desempatar era o CONTEXTO, e o contexto
// estava na mao: a padaria acabou de fazer uma pergunta de escolha.
//
// AS TRES CONDICOES, e nenhuma e lista de palavras solta:
//
//   1. a ultima fala da padaria foi uma ESCOLHA ("qual", "quais")
//   2. ele NAO nomeou nenhum produto ("quanto e a coxinha?" nomeia, e ali a
//      resposta certa e o preco da coxinha mesmo)
//   3. a frase dele pergunta pelas opcoes
//
// E A PERGUNTA VOLTA, com a peca do cardapio junto. Antes a etapa se dava por
// resolvida ("perguntado uma vez, perguntado pra sempre") e a conversa PULAVA
// pra oferta. Mas quem responde "quais tem?" nao mudou de assunto: esta
// respondendo, e precisa das opcoes pra escolher. O `insistiu` continua
// protegendo contra laco.
//
// A ISCA: tirando o `perguntouAsOpcoes` de `fluxo.ts`, os dois primeiros casos
// voltam a ouvir o total do pedido.
//
// Roda com: node testes/quem-pergunta-quais-tem-recebe-a-lista.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "'quais tem?' depois da pergunta do salgado devolve a lista",
    ultima: "Qual salgado você quer?",
    itens: [{ produto: "salgado", categoria: "salgado_frito", qtd: 0, obs: null }],
    ja: ["abertura", "salgado"],
    fala: "quais tem?",
    leitura: { perguntou: { sobre: "preco" } },
    tem: ["salgados"],
    naoTem: ["R$"],
    peca: "salgados",
    dano: "ele pergunta quais existem e ouve o total do pedido, que era R$ 0,00",
  },
  {
    nome: "'o que tem?' e a mesma pergunta",
    ultima: "Qual salgado você quer?",
    itens: [{ produto: "salgado", categoria: "salgado_frito", qtd: 0, obs: null }],
    ja: ["abertura", "salgado"],
    fala: "o que tem?",
    leitura: {},
    tem: ["salgados"],
    naoTem: ["R$"],
    peca: "salgados",
    dano: "o mesmo, com as outras palavras que a pessoa usa",
  },
  {
    // O PRECO CONTINUA SENDO RESPONDIDO. A trava nao pode virar mordaca.
    nome: "'quanto fica?' continua respondendo o total",
    ultima: "Qual salgado você quer?",
    itens: [{ produto: "coxinha", categoria: "salgado_frito", qtd: 100, obs: "frango" }],
    ja: ["abertura", "salgado"],
    fala: "quanto fica?",
    leitura: { perguntou: { sobre: "preco" } },
    tem: ["R$ 100,00"],
    dano: "quem pergunta o total e nao recebe fica sem saber quanto vai pagar",
  },
  {
    // ELE NOMEOU O PRODUTO: a pergunta e do preco DELE, e nao das opcoes.
    nome: "'quanto e a coxinha?' responde o preco dela",
    ultima: "Qual salgado você quer?",
    itens: [{ produto: "salgado", categoria: "salgado_frito", qtd: 0, obs: null }],
    ja: ["abertura", "salgado"],
    fala: "quanto e a coxinha?",
    leitura: { perguntou: { sobre: "preco" } },
    tem: ["coxinha", "R$ 1,00"],
    dano: "nomear o produto e perguntar dele; devolver a lista seria nao ouvir",
  },
];

const sonda = path.join(__dirname, "_sonda-quais-tem.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:c.itens,",
    "    dados:{nome:'Camila',data:'10/09/2026',hora:'18:30',pagamento:'cartao'},",
    "    pecas:null, topoNome:null, topoIdade:null, tema:null, forminha:null, prato:null,",
    "    ultimaFala:c.ultima, insistiu:0, retomarEm:null, assunto:null,",
    "    etapasJaPerguntadas:c.ja, etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, (async () => c.leitura) as never);",
    "  saiu.push({ texto: String(r.fala.texto || ''), peca: r.fala.cardapio ?? null });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-quais-tem.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== quem pergunta quais tem recebe a lista ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const baixo = String(r.texto || "").toLowerCase();
  const problemas = [];
  for (const parte of c.tem ?? []) {
    if (!baixo.includes(parte.toLowerCase())) {
      problemas.push('nao diz "' + parte + '": ' + JSON.stringify(r.texto.slice(0, 60)));
    }
  }
  for (const parte of c.naoTem ?? []) {
    if (baixo.includes(parte.toLowerCase())) {
      problemas.push('diz "' + parte + '": ' + JSON.stringify(r.texto.slice(0, 60)));
    }
  }
  if (c.peca && r.peca !== c.peca) {
    problemas.push('nao mandou a peca "' + c.peca + '" do cardapio (mandou ' + JSON.stringify(r.peca) + ')');
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
