// O RESUMO DIZ A UNIDADE EM QUE A CASA COBRA.
//
// Conversando com a producao em 31/08/2026, com o pao dele:
//
//   cliente >> quero 50 pao frances pra amanha
//   padaria >> O pao frances é vendido por quilo, R$ 11,99 o quilo. Quantos
//              quilos você quer?
//   cliente >> 2 kg
//   resumo  >> - 2 pao frances  R$ 11,99/kg = R$ 23,98
//
// A conta esta certa e a linha engana: quem le "2 pao frances" entende dois
// paes por R$ 23,98, e sao dois QUILOS. O "kg de" estava preso ao BOLO, e por
// quilo a casa vende 31 produtos: cuca, empadao, torta, pizza redonda, pao.
//
// Quem decide a unidade e o motor de preco, que e quem cobra. Nao a categoria.
//
// A ISCA: trocando `ehKg` por `ehBolo` em `pergunta.ts`, o pao volta a sair sem
// o kg.
//
// Roda com: node testes/o-resumo-diz-a-unidade-que-a-casa-cobra.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "pao frances, vendido por quilo, sai em kg",
    itens: [{ produto: "pao frances", categoria: "padaria", qtd: 2, unidade: "kg", obs: null }],
    tem: "2 kg de pao frances",
    dano: "o cliente le dois paes onde a padaria vai cobrar dois quilos",
  },
  {
    nome: "empadao tambem, que e a outra familia por quilo",
    itens: [{ produto: "empadao de frango", categoria: "empadao", qtd: 1, unidade: "kg", obs: null }],
    tem: "1 kg de empadao de frango",
    dano: "mesma confusao, em onze familias fora o bolo",
  },
  {
    nome: "o bolo continua igual",
    itens: [{ produto: "bolo brigadeiro", categoria: "bolo_festa", qtd: 2, unidade: "kg", obs: null }],
    tem: "2 kg de bolo brigadeiro",
    dano: "o caso que ja funcionava nao pode quebrar",
  },
  {
    nome: "quem e vendido por unidade NAO ganha kg",
    itens: [{ produto: "coxinha", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: null }],
    tem: "50 coxinha",
    naoTem: "kg de coxinha",
    dano: "50 kg de coxinha em vez de 50 coxinhas",
  },
  {
    nome: "e o docinho tambem nao",
    itens: [{ produto: "brigadeiro", categoria: "docinho", qtd: 100, unidade: "un", obs: null }],
    tem: "100 brigadeiro",
    naoTem: "kg de brigadeiro",
    dano: "o item mais vendido da casa saindo em quilo",
  },
];

const sonda = path.join(__dirname, "_sonda-resumo-unidade.mts");
fs.writeFileSync(
  sonda,
  [
    'import { falaDaConfirmacao } from "../lib/ia/fluxo/pergunta.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = CASOS.map((c) => falaDaConfirmacao({",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:c.itens,",
    "  dados:{nome:'Eliezer',data:'01/09/2026',hora:'08:00',pagamento:'pix'},",
    "  pecas:null, topoNome:null, topoIdade:null, tema:null, forminha:null, prato:null,",
    "} as never, 2398));",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-resumo-unidade.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let erros = 0;
console.log("== o resumo diz a unidade que a casa cobra ==");
CASOS.forEach((c, n) => {
  const linha = semAc(saiu[n]);
  const problemas = [];
  if (!linha.includes(semAc(c.tem))) {
    problemas.push("nao diz \"" + c.tem + "\": " + JSON.stringify(String(saiu[n]).split("\n")[1] || ""));
  }
  if (c.naoTem && linha.includes(semAc(c.naoTem))) {
    problemas.push("diz \"" + c.naoTem + "\", e nao devia");
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
