// O CLIENTE LÊ COM ACENTO, E O SISTEMA CONTINUA BUSCANDO SEM.
//
// Medido conversando com a producao em 31/08/2026, e ele reparou:
//
//   padaria >> O pao frances é vendido por quilo, R$ 11,99 o quilo.
//
// O cardapio da dona foi digitado sem alguns acentos, e o MESMO texto serve pra
// duas coisas que nao sao a mesma: a chave que casa o que o cliente escreveu com
// o produto da casa, e o nome que ele le na tela.
//
// Acentuar o catalogo direto quebrou OITO testes em 31/08: meia duzia de
// comparacoes espera a forma crua. Entao a grafia virou a ultima coisa que
// acontece com a frase, num ponto so, e o catalogo continua intacto.
//
// ISTO NAO E LISTA DE PRODUTO, e o teste cobra isso: toda entrada da grafia
// precisa casar com um produto de verdade da casa. Lista que nao casa com nada e
// lista fantasma, e neste projeto lista minha ja custou um produto inventado.
//
// A ISCA: tirando a chamada de `comoOClienteLe` no fim de `responder`, a
// primeira pergunta volta a sair sem acento.
//
// Roda com: node testes/o-cliente-le-com-acento.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-acento.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { GRAFIA, comoOClienteLe } from "../lib/ia/dados/grafia.ts";',
    'import { produtosDaCasa, produtoPorNome } from "../lib/ia/dados/produtos.ts";',
    "",
    "// A conversa de verdade: ele pede o pao e ouve a pergunta do peso.",
    "const base = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[], pecasMandadas:[],",
    "};",
    "const leitura = { itens: [{ produto: 'pao frances', qtd: 50 }] };",
    "const r = await responder(base as never, { texto: 'quero 50 pao frances pra amanha' }, (async () => leitura) as never);",
    "",
    "// A grafia nao pode inventar produto: toda entrada casa com a casa.",
    "const orfas = GRAFIA.filter(([cru]) => !produtoPorNome(cru));",
    "",
    "// E o catalogo continua guardando a forma crua, que e a chave de busca.",
    "const catalogoIntacto = produtosDaCasa().some((p) => p.nome === 'pao frances');",
    "",
    "console.log(JSON.stringify({",
    "  pergunta: String(r.fala.texto || ''),",
    "  itens: r.estado.itens.map((i) => i.produto),",
    "  orfas: orfas.map(([cru]) => cru),",
    "  catalogoIntacto,",
    "  frases: [",
    "    comoOClienteLe('O pao frances é vendido por quilo'),",
    "    comoOClienteLe('empadao com palmito e empadao'),",
    "    comoOClienteLe('bolo de morango'),",
    "  ],",
    "}));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-acento.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
const falha = (m) => { console.log("ERRO  " + m); erros++; };
console.log("== o cliente le com acento ==");

if (/pao frances/i.test(r.pergunta)) {
  falha("a pergunta saiu sem acento: " + JSON.stringify(r.pergunta.slice(0, 70)));
} else if (!/pão francês/i.test(r.pergunta)) {
  falha("a pergunta nao fala do pao: " + JSON.stringify(r.pergunta.slice(0, 70)));
} else {
  console.log("ok    a pergunta sai \"pão francês\", e nao \"pao frances\"");
}

if (!r.itens.includes("pao frances")) {
  falha("o pedido devia guardar a forma do catalogo: " + JSON.stringify(r.itens));
} else {
  console.log("ok    o pedido continua guardando a forma do catalogo, que e a chave");
}

if (!r.catalogoIntacto) {
  falha("o catalogo foi alterado: a grafia e camada de tela, e nao mexe na fonte");
} else {
  console.log("ok    o catalogo continua intacto");
}

if (r.orfas.length) {
  falha("grafia sem produto correspondente (lista fantasma): " + JSON.stringify(r.orfas));
} else {
  console.log("ok    toda entrada da grafia casa com um produto da casa");
}

const [uma, duas, tres] = r.frases;
if (!/pão francês/.test(uma)) falha("nao trocou na frase solta: " + JSON.stringify(uma));
else if (duas !== "empadão com palmito e empadão") {
  falha("o nome longo foi comido pelo curto: " + JSON.stringify(duas));
} else if (tres !== "bolo de morango") {
  falha("mexeu numa frase que nao tinha nada pra trocar: " + JSON.stringify(tres));
} else {
  console.log("ok    troca palavra inteira, do mais longo pro mais curto, e nao mexe no resto");
}

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
