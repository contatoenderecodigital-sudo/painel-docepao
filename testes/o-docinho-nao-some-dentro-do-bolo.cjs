// O DOCINHO NAO SOME DENTRO DO BOLO.
//
// Medido em 31/08/2026, numa frase que qualquer cliente escreve:
//
//   cliente >> 50 brigadeiro e um bolo de 2 kg de 4 leites
//   modelo  >> 50x brigadeiro
//   pedido  >> 2 kg de bolo 4 leites, e NENHUM docinho
//
// OS 50 DOCINHOS DESAPARECERAM. A cadeia, lida no rastro:
//
//   1. o resolvedor viu a palavra "bolo" na frase (que era do OUTRO item) e
//      transformou o docinho brigadeiro em "bolo brigadeiro"
//   2. a guarda do peso viu que 50 nao e peso de bolo e rebaixou pra familia
//      "bolo", ou seja, "nao sei qual, pergunta"
//   3. a fusao dos bolos juntou essa familia com o bolo de 4 leites: "o bolo
//      sem sabor virou o bolo de 4 leites"
//
// Tres regras certas, uma atras da outra, terminando num item sumido. E a regra
// que este projeto mais repete: NADA SOME DO PEDIDO.
//
// O CONSERTO E NO PASSO 2. A guarda ja sabia que o numero era "de outro
// produto"; ela so nao perguntava ao cardapio QUAL. Quando existe um produto com
// esse nome fora dos bolos, e ele: "50 brigadeiro" e o docinho de R$ 1,25, e
// esta escrito no catalogo. Quando nao existe, continua devolvendo a familia,
// que e o caso de "50 de morango".
//
// A ISCA: voltando `return String(familia)` em `naoCabeNoBolo`, o primeiro caso
// perde os 50 docinhos de novo.
//
// Roda com: node testes/o-docinho-nao-some-dentro-do-bolo.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "o docinho e o bolo na mesma frase: os dois entram",
    fala: "50 brigadeiro e um bolo de 2 kg de 4 leites",
    leitura: { itens: [{ produto: "brigadeiro", qtd: 50 }] },
    espera: ["50x brigadeiro", "2x bolo 4 leites"],
    dano: "50 docinhos sumiam dentro do bolo, sem aviso nenhum",
  },
  {
    nome: "nome que so existe como bolo continua virando familia",
    fala: "quero 50 de morango",
    leitura: { itens: [{ produto: "morango", qtd: 50 }] },
    espera: ["50x bolo"],
    dano: "50 kg de bolo morango, R$ 2.345,00; e nao ha docinho chamado morango pra escolher",
  },
  {
    nome: "docinho pedido sozinho continua docinho",
    fala: "quero 100 brigadeiro",
    leitura: { itens: [{ produto: "brigadeiro", qtd: 100 }] },
    espera: ["100x brigadeiro"],
    dano: "o caso mais comum da casa nao pode mudar",
  },
  {
    nome: "bolo de verdade, com peso de bolo, continua bolo",
    fala: "quero um bolo de 3 kg de brigadeiro",
    leitura: { itens: [{ produto: "bolo brigadeiro", qtd: 3 }] },
    espera: ["3x bolo brigadeiro"],
    dano: "quem pede bolo de 3 kg leva bolo, e nao 3 docinhos",
  },
];

const sonda = path.join(__dirname, "_sonda-docinho-nao-some.mts");
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
    "  saiu.push(r.estado.itens.map((i) => i.qtd + 'x ' + i.produto));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-docinho-nao-some.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let erros = 0;
console.log("== o docinho nao some dentro do bolo ==");
CASOS.forEach((c, n) => {
  const veio = saiu[n];
  const faltou = c.espera.filter((e) => !veio.some((v) => semAc(v) === semAc(e)));
  const ok = faltou.length === 0;
  console.log(
    (ok ? "ok    " : "ERRO  ") + c.nome +
    (ok ? "" : "  ->  ficou " + JSON.stringify(veio) + ", faltou " + JSON.stringify(faltou) + "; " + c.dano),
  );
  if (!ok) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
