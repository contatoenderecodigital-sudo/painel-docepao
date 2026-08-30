// O SABOR QUE ELE NAO FALOU NAO ENTRA, NEM QUANDO VEM NO NOME DO PRODUTO.
//
// Medido na bancada em 30/08/2026, com a IA de verdade:
//
//   cliente >> o bolo eu quero misto de brigadeiro com ninho
//   modelo  >> 1x brigadeiro com maracuja [brigadeiro com ninho]
//   pedido  >> 3 kg de bolo brigadeiro com maracuja   R$ 140,70
//
// Ninho NAO e sabor de bolo de festa: a lista tem "brigadeiro" e "brigadeiro
// com maracuja". Em vez de dizer isso, o modelo trocou pelo mais parecido do
// cardapio. A cozinha faria maracuja, e o cliente leria maracuja na confirmacao
// de um bolo que ele pediu de ninho.
//
// A casa ja tem a regra certa pra sabor fora da lista: o item fica, o sabor vai
// no recado, e na insistencia a equipe confere. Ela nao pegava este caso porque
// so olhava o campo `sabor`, e aqui a invencao veio no campo do PRODUTO.
//
// POR QUE ESTE TESTE INJETA A LEITURA: o modelo nao erra sempre. Na rodada
// seguinte da bancada ele devolveu "brigadeiro com ninho" e a guarda nem
// disparou. Guarda que so da pra ver quando o modelo tem um mau dia nao se
// prende com conversa: prende-se com a leitura errada escrita a mao.
//
// Roda com: node testes/o-modelo-nao-troca-o-sabor-pedido.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    oque: "o maracuja que ele nao falou nao entra no lugar do ninho",
    fala: "o bolo eu quero de brigadeiro com ninho",
    leitura: { itens: [{ produto: "brigadeiro com maracujá", qtd: 2, sabor: "brigadeiro com ninho" }] },
    espera: "bolo brigadeiro",
    dano: "a cozinha faz maracuja e o cliente le maracuja num bolo que pediu de ninho",
  },
  {
    oque: "o que ele FALOU continua valendo inteiro",
    fala: "o bolo eu quero de brigadeiro com maracuja",
    leitura: { itens: [{ produto: "brigadeiro com maracujá", qtd: 2 }] },
    espera: "bolo brigadeiro com maracujá",
    dano: "quem pede maracuja leva brigadeiro puro, e a padaria cobra menos do que vendeu",
  },
  {
    oque: "nome simples que ele falou passa direto",
    fala: "quero um bolo de brigadeiro de 2 kg",
    leitura: { itens: [{ produto: "bolo brigadeiro", qtd: 2 }] },
    espera: "bolo brigadeiro",
    dano: "a guarda nao pode mexer no que ja estava certo",
  },
];

const sonda = path.join(__dirname, "_sonda-troca-sabor.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[],",
    "};",
    "const pensar = (l) => (async () => l);",
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const r = await responder(VAZIO as never, { texto: c.fala }, pensar(c.leitura) as never);",
    "  const bolos = (r.estado.itens || []).filter((i) => String(i.categoria || '').startsWith('bolo'));",
    "  saiu.push(bolos.map((b) => b.produto).join(' + ') || '(nenhum bolo)');",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-troca-sabor.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== o modelo nao troca o sabor que o cliente pediu ==");
CASOS.forEach((c, n) => {
  const ok = saiu[n] === c.espera;
  console.log(
    (ok ? "ok    " : "ERRO  ") + c.oque +
    (ok ? "" : "  ->  ficou " + JSON.stringify(saiu[n]) + ", esperado " + JSON.stringify(c.espera) + "; " + c.dano),
  );
  if (!ok) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
