// QUEM JA TEM O SABOR ANOTADO NAO ROUBA A RESPOSTA DE QUEM ESTA ESPERANDO.
//
// Medido conversando de verdade em 31/08/2026, refazendo o pedido de festa do
// dono contra o servidor:
//
//   padaria >> O risólis é de carne ou frango?
//   cliente >> frango
//   padaria >> O risólis é de quê? Tem carne e frango.
//   banco   >> 50 ~ risólis ~ SEM OBS
//
// A coxinha e de frango no cardapio (recheio FIXO) e ja estava anotada com
// frango desde que entrou no pedido. Mesmo assim ela entrava na disputa, e como
// recheio fixo recebe primeiro, o "frango" morria nela: o risolis continuava
// sem sabor e a padaria repetia a pergunta. A conversa nao andava.
//
// A REGRA DE CIMA CONTINUA VALENDO, e o segundo caso e ela: "50 coxinha" e
// depois "de frango", com a pizza redonda esperando sabor. Ali a coxinha ainda
// NAO tem sabor anotado, e e ela mesma que esta esperando. Sem esse caso aqui,
// consertar um lado quebraria o outro, que ja aconteceu neste arquivo.
//
// A ISCA: tirando o `if (semAc(String(i.obs ?? "")).includes(alvo)) return false;`
// de `fluxo.ts`, o primeiro caso volta a deixar o risolis sem sabor.
//
// Roda com: node testes/quem-ja-tem-o-sabor-nao-rouba-a-resposta.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "a coxinha ja anotada nao rouba o frango do risolis",
    itens: [
      { produto: "bolinha de queijo", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: "queijo" },
      { produto: "coxinha", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: "frango" },
      { produto: "risólis", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: null },
      { produto: "mini bolha", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: "frito" },
    ],
    ultima: "O risólis é de carne ou frango?",
    fala: "frango",
    espera: { "risólis": "frango" },
    dano: "a padaria repete a mesma pergunta e a conversa nao sai do lugar",
  },
  {
    nome: "a coxinha SEM sabor anotado continua recebendo o dela",
    itens: [
      { produto: "coxinha", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: null },
      { produto: "pizza redonda", categoria: "pizza", qtd: 1, unidade: "un", obs: null },
    ],
    ultima: "Qual sabor você quer na pizza redonda?",
    fala: "de frango",
    espera: { coxinha: "frango" },
    dano: "era o defeito que a regra do recheio fixo nasceu pra consertar",
  },
  {
    nome: "e o frango nao gruda na pizza, que nem tem frango na lista",
    itens: [
      { produto: "coxinha", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: null },
      { produto: "pizza redonda", categoria: "pizza", qtd: 1, unidade: "un", obs: null },
    ],
    ultima: "Qual sabor você quer na pizza redonda?",
    fala: "de frango",
    naoTem: { "pizza redonda": "frango" },
    dano: "o recheio da coxinha ia pra pizza e a cozinha recebia pizza de frango",
  },
];

const sonda = path.join(__dirname, "_sonda-sabor-nao-roubado.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const pensar = (l) => (async () => l);",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:c.itens,",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:c.ultima, insistiu:1,",
    "    retomarEm:null, assunto:null, etapasJaPerguntadas:['salgado'], etapasAdiadas:[],",
    "    pecasMandadas:['salgados'],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, pensar({ itens: [] }) as never);",
    "  saiu.push(r.estado.itens.map((i) => ({ p: i.produto, o: i.obs })));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-sabor-nao-roubado.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let erros = 0;
console.log("== quem ja tem o sabor nao rouba a resposta ==");
CASOS.forEach((c, n) => {
  const itens = saiu[n];
  const problemas = [];
  for (const [produto, sabor] of Object.entries(c.espera ?? {})) {
    const item = itens.find((i) => semAc(i.p) === semAc(produto));
    if (!item || !semAc(item.o).includes(semAc(sabor))) {
      problemas.push(produto + " ficou com " + JSON.stringify(item ? item.o : null) + ", esperado " + JSON.stringify(sabor));
    }
  }
  for (const [produto, sabor] of Object.entries(c.naoTem ?? {})) {
    const item = itens.find((i) => semAc(i.p) === semAc(produto));
    if (item && semAc(item.o).includes(semAc(sabor))) {
      problemas.push(produto + " recebeu \"" + sabor + "\", que nao era dele");
    }
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
