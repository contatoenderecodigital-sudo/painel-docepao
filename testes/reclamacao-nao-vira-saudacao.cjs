// RECLAMACAO CITA O PRODUTO, E ISSO NAO A TRANSFORMA EM PEDIDO.
//
// Medido conversando com o servidor em 31/08/2026:
//
//   cliente >> o pedido que retirei ontem veio com salgado queimado
//   padaria >> Bom dia, tudo bem? Como posso ajudar?
//
// O cliente reclamou e ouviu uma SAUDACAO. Numa padaria de bairro isso e o tipo
// de coisa que faz a pessoa nao voltar mais.
//
// E o modelo tinha classificado certo. Quem descartou foi o codigo, EM SILENCIO:
// a guarda tratava "produto citado na frase" como pedido, e reclamacao quase
// sempre cita o produto ("o SALGADO veio queimado", "o BOLO estava seco").
//
// Nao havia nem rastro, porque a linha "situacao: ..." so e escrita DENTRO do
// bloco que a guarda pulava. De fora parecia falha do modelo, e eu perdi tempo
// achando que era.
//
// A GUARDA CONTINUA EXISTINDO, e o quarto caso e o motivo dela: o modelo, vendo
// festa e pizza na mesma frase, devolvia "reclamacao" e o painel acendia
// "Precisa de voce" sem ninguem ter pedido gente. So que ali ele devolve ITENS
// junto, e e isso que separa. Frase que so MENCIONA um produto, sem pedir
// nenhum, nao e pedido.
//
// A ISCA: voltando `produtosNaFrase(falaCru).length > 0` direto no
// `temProdutoNesteTurno`, os dois primeiros casos voltam a virar saudacao.
//
// Roda com: node testes/reclamacao-nao-vira-saudacao.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "reclamacao citando o produto chama a equipe",
    fala: "o pedido que retirei ontem veio com salgado queimado",
    leitura: { situacao: "reclamacao" },
    equipe: true,
    itens: 0,
    dano: "cliente bravo ouvindo 'bom dia, como posso ajudar' e nenhuma pessoa avisada",
  },
  {
    nome: "cancelamento citando o produto chama a equipe",
    fala: "quero cancelar o bolo que encomendei",
    leitura: { situacao: "cancelar" },
    equipe: true,
    itens: 0,
    dano: "cancelamento mexe com producao que talvez ja tenha comecado",
  },
  {
    nome: "pedido de verdade continua sendo pedido",
    fala: "quero 100 coxinhas",
    leitura: { itens: [{ produto: "coxinha", qtd: 100 }] },
    equipe: false,
    itens: 1,
    dano: "o caso mais comum da casa nao pode virar chamado de equipe",
  },
  {
    nome: "modelo erra e diz reclamacao num pedido: vale o pedido",
    fala: "quero 2 pizzas pra festa",
    leitura: { situacao: "reclamacao", itens: [{ produto: "pizza", qtd: 2 }] },
    equipe: false,
    itens: 1,
    dano: "e o defeito que a guarda nasceu pra impedir: painel acendendo sem ninguem pedir gente",
  },
  {
    nome: "pergunta de pedido ja feito chama a equipe",
    fala: "meu pedido ta pronto?",
    leitura: { situacao: "status" },
    equipe: true,
    itens: 0,
    dano: "so a equipe sabe o que ja saiu do forno",
  },
];

const sonda = path.join(__dirname, "_sonda-reclamacao.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const pensar = (l) => (async () => l);",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:[],",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "    retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, pensar(c.leitura) as never);",
    "  saiu.push({ equipe: Boolean(r.precisaHumano), itens: r.estado.itens.length, texto: String(r.fala.texto || '') });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-reclamacao.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== reclamacao nao vira saudacao ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  if (r.equipe !== c.equipe) problemas.push("chamar a equipe ficou " + r.equipe + ", esperado " + c.equipe);
  if (r.itens !== c.itens) problemas.push("ficou com " + r.itens + " item(ns), esperado " + c.itens);
  // Saudacao pra quem reclamou e o defeito em si.
  if (c.equipe && /como posso ajudar|o que voc[êe] precisa/i.test(r.texto)) {
    problemas.push("respondeu com saudacao: " + JSON.stringify(r.texto.slice(0, 60)));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
