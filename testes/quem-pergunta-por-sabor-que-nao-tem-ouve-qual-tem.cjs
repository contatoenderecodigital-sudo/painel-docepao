// QUEM PERGUNTA POR UM SABOR QUE A CASA NAO FAZ OUVE QUAL ELA FAZ.
//
// Medido conversando com o servidor em 31/08/2026:
//
//   cliente >> tem coxinha de camarao?
//   padaria >> Coxinha sai de R$ 1,00 a R$ 1,25 a unidade.
//
// Ele perguntou SE TEM e ouviu o PRECO. A resposta esta no cardapio: coxinha e
// de frango (`saborFixo`), e camarao a casa nao faz.
//
// O pedido ja sabia responder isso quando ele PEDIA o sabor errado ("A gente faz
// coxinha de frango"). A pergunta nao sabia, porque o caminho da informacao so
// recebe a familia ("coxinha") e o sabor se perdia antes de chegar nele.
//
// O PRECO CONTINUA VINDO ATRAS, de proposito: quem pergunta por um sabor quase
// sempre quer saber o preco tambem, e cortar isso seria trocar um defeito por
// outro.
//
// A ISCA: tirando o bloco `naoTem` de `fluxo.ts`, o primeiro caso volta a
// responder so o preco.
//
// Roda com: node testes/quem-pergunta-por-sabor-que-nao-tem-ouve-qual-tem.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "pergunta por um sabor que a casa nao faz",
    fala: "tem coxinha de camarao?",
    perguntou: { sobre: "preco", familia: "coxinha" },
    tem: ["coxinha de frango"],
    dano: "ele fica sem saber se a padaria faz, e ainda leva um preco que nao perguntou",
  },
  {
    nome: "pergunta o preco, sem falar de sabor: nada muda",
    fala: "quanto custa a coxinha?",
    perguntou: { sobre: "preco", familia: "coxinha" },
    naoTem: ["A gente faz"],
    dano: "corrigir quem nao errou e ruido",
  },
  {
    nome: "pergunta por um sabor que a casa FAZ: nada muda",
    fala: "tem risoles de carne?",
    perguntou: { sobre: "preco", familia: "risolis" },
    naoTem: ["A gente faz"],
    dano: "carne e recheio de risolis no cardapio; dizer o contrario perde venda",
  },
  {
    nome: "pergunta de familia inteira continua igual",
    fala: "quanto custa o bolo?",
    perguntou: { sobre: "preco", familia: "bolo" },
    naoTem: ["A gente faz bolo de"],
    dano: "a familia bolo nao tem sabor fixo, e nao ha o que corrigir",
  },
];

const sonda = path.join(__dirname, "_sonda-pergunta-sabor.mts");
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
    "    itens:[{ produto:'salgado', categoria:'salgado_frito', qtd:100, unidade:'un', obs:null }],",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "    retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, pensar({ perguntou: c.perguntou }) as never);",
    "  saiu.push(String(r.fala.texto || ''));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pergunta-sabor.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let erros = 0;
console.log("== quem pergunta por sabor que nao tem ouve qual tem ==");
CASOS.forEach((c, n) => {
  const texto = saiu[n];
  const problemas = [];
  for (const parte of c.tem ?? []) {
    if (!semAc(texto).includes(semAc(parte))) problemas.push("faltou \"" + parte + "\"");
  }
  for (const parte of c.naoTem ?? []) {
    if (semAc(texto).includes(semAc(parte))) problemas.push("nao podia ter \"" + parte + "\"");
  }
  console.log(
    (problemas.length ? "ERRO  " : "ok    ") + c.nome +
    (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano + "  |  " + texto.slice(0, 90) : ""),
  );
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
