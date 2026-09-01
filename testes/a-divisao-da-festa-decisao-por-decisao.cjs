// A DIVISÃO DA FESTA, DECISÃO POR DECISÃO.
//
// Auditoria pedida por ele em 02/09/2026: *"não é mais fácil revisar todos os
// códigos linha por linha, ver quais guardas estão ruins e deixar só a coisa
// boa?"*. Ler não achou os defeitos de hoje (um deles era o bloco CERTO dentro
// do `if` errado, e lendo parecia perfeito), então a revisão virou isto: cada
// decisão do rateio com o dano que ela evita, medido.
//
// A ÁREA É ESTA PORQUE É ONDE O DINHEIRO MORA. Os três defeitos de 02/09 eram
// todos aqui: a proposta que não ajustava, o marcador que comia 64 salgados, e a
// divisão que não rodava.
//
// REGRA DA AUDITORIA: decisão sem dano que a justifique é decisão que sai. Todas
// as nove abaixo têm dano medido, e por isso todas ficam.
//
// Roda com: node testes/a-divisao-da-festa-decisao-por-decisao.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const BASE = { salgados: 200, docinhos: 100, boloKg: 2, totalCentavos: 41880 };

const CASOS = [
  {
    // 1. `!e.baseAceita` — proposta ainda na mesa não divide nada.
    nome: "proposta nao aceita nao reparte",
    base: BASE,
    baseAceita: false,
    itens: [{ produto: "coxinha", categoria: "salgado_frito", qtd: 0, obs: null }],
    fala: "coxinha",
    leitura: { itens: [{ produto: "coxinha", qtd: 1 }] },
    esperado: { coxinha: 1 },
    dano: "repartir 200 salgados numa proposta que ele ainda vai mudar",
  },
  {
    // 2. `!total` — família recusada tem zero, e zero não se divide.
    nome: "familia recusada nao ganha quantidade",
    base: { ...BASE, docinhos: 0 },
    baseAceita: true,
    // O SALGADO PRECISA ESTAR RESOLVIDO pra conversa estar no docinho: a etapa
    // sai do ESTADO, e nao da ultima frase. Sem isto o caso mede outra coisa
    // (o brigadeiro guardado pra depois, que e o comportamento certo).
    itens: [
      { produto: "coxinha", categoria: "salgado_frito", qtd: 200, obs: "frango" },
      { produto: "brigadeiro", categoria: "docinho", qtd: 0, obs: null },
    ],
    fala: "brigadeiro",
    leitura: { itens: [{ produto: "brigadeiro", qtd: 1 }] },
    ultimaFala: "E os docinhos, quais você vai querer?",
    esperado: { brigadeiro: 1 },
    dano: "cobrar docinho de quem disse que nao queria docinho",
  },
  {
    // 3 e 4. O lugar vazio só divide quando é o único da família.
    nome: "com escolha de verdade, o lugar vazio nao divide",
    base: BASE,
    baseAceita: true,
    itens: [
      { produto: "salgado", categoria: "salgado_frito", qtd: 0, obs: null },
      { produto: "coxinha", categoria: "salgado_frito", qtd: 0, obs: null },
    ],
    fala: "coxinha mesmo",
    leitura: { itens: [{ produto: "coxinha", qtd: 1 }] },
    esperado: { coxinha: 200 },
    naoTem: ["salgado"],
    dano: "64 salgados numa linha que ninguem produz (medido em 02/09)",
  },
  {
    // 5. `disseNumero` — quando ele diz o número, o número dele manda.
    nome: "numero dito pelo cliente manda",
    base: BASE,
    baseAceita: true,
    itens: [{ produto: "coxinha", categoria: "salgado_frito", qtd: 0, obs: null }],
    fala: "quero 50 coxinha",
    leitura: { itens: [{ produto: "coxinha", qtd: 50 }] },
    esperado: { coxinha: 50 },
    dano: "transformar as 50 coxinhas dele em 200 sem ele pedir",
  },
  {
    // 6. `!temQtd` — quem está em zero recebe.
    nome: "quem esta em zero recebe a divisao",
    base: BASE,
    baseAceita: true,
    itens: [
      { produto: "coxinha", categoria: "salgado_frito", qtd: 0, obs: null },
      { produto: "risólis", categoria: "salgado_frito", qtd: 0, obs: null },
    ],
    fala: "coxinha e risoles",
    leitura: { itens: [{ produto: "coxinha", qtd: 1 }, { produto: "risólis", qtd: 1 }] },
    esperado: { coxinha: 100, "risólis": 100 },
    dano: "festa fechando com 1 coxinha e 1 risoles (o teste da Kemilly, 23/08)",
  },
  {
    // 7. `nomeouEsteItemNaFala` — o que ele já tinha não é redividido.
    nome: "o que ele ja tinha dito nao e redividido",
    base: BASE,
    baseAceita: true,
    itens: [
      { produto: "coxinha", categoria: "salgado_frito", qtd: 50, obs: null },
      { produto: "risólis", categoria: "salgado_frito", qtd: 0, obs: null },
    ],
    fala: "e risoles tambem",
    leitura: { itens: [{ produto: "risólis", qtd: 1 }] },
    esperado: { coxinha: 50, "risólis": 150 },
    dano: "as 50 coxinhas dele virarem 100 porque ele pediu outra coisa depois",
  },
  {
    // 8. `!sobra` — nada sobrando, nada a fazer.
    nome: "sem sobra, ninguem muda",
    base: BASE,
    baseAceita: true,
    itens: [
      { produto: "coxinha", categoria: "salgado_frito", qtd: 200, obs: null },
      { produto: "risólis", categoria: "salgado_frito", qtd: 0, obs: null },
    ],
    fala: "e risoles",
    leitura: { itens: [{ produto: "risólis", qtd: 1 }] },
    esperado: { coxinha: 200, "risólis": 1 },
    dano: "tirar salgado de quem ja estava fechado pra dar pro sabor novo",
  },
  {
    // 9. O mínimo por sabor da casa, que é regra da dona.
    nome: "muitos sabores avisam do minimo da casa",
    base: BASE,
    baseAceita: true,
    itens: [
      { produto: "coxinha", categoria: "salgado_frito", qtd: 0, obs: null },
      { produto: "risólis", categoria: "salgado_frito", qtd: 0, obs: null },
      { produto: "esfirra", categoria: "salgado_assado", qtd: 0, obs: null },
      { produto: "croquete", categoria: "salgado_frito", qtd: 0, obs: null },
      { produto: "empadinha", categoria: "salgado_assado", qtd: 0, obs: null },
      { produto: "almofadinha", categoria: "salgado_frito", qtd: 0, obs: null },
      { produto: "chodó", categoria: "salgado_frito", qtd: 0, obs: null },
      { produto: "croissant", categoria: "salgado_assado", qtd: 0, obs: null },
      { produto: "quiche", categoria: "salgado_assado", qtd: 0, obs: null },
      { produto: "pastel assado", categoria: "salgado_assado", qtd: 0, obs: null },
      { produto: "mini pizza", categoria: "salgado_assado", qtd: 0, obs: null },
    ],
    fala: "quero um pouco de cada um desses",
    leitura: { itens: [] },
    somaDaFamilia: { salgado: 200 },
    dano: "a dona pede 20 por sabor; sem aviso a cozinha recebe 18 de cada",
  },
];

const sonda = path.join(__dirname, "_sonda-divisao.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:true, pessoas:20, base:c.base, baseAceita:c.baseAceita, naoQuer:[], itens:c.itens,",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null,",
    "    ultimaFala: c.ultimaFala ?? 'Quais salgados você quer?', insistiu:0, retomarEm:null, assunto:null,",
    "    etapasJaPerguntadas:['abertura','quantas_pessoas','base_da_festa','salgado','docinho'],",
    "    etapasAdiadas:[], pecasMandadas:['salgados','docinhos'],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, (async () => c.leitura) as never);",
    "  saiu.push(r.estado.itens.map((i) => ({ p: i.produto, c: i.categoria, q: Number(i.qtd) })));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-divisao.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a divisao da festa, decisao por decisao ==");
CASOS.forEach((c, n) => {
  const itens = saiu[n];
  const problemas = [];
  for (const [produto, qtd] of Object.entries(c.esperado ?? {})) {
    const achado = itens.find((i) => String(i.p).toLowerCase() === produto.toLowerCase());
    if (!achado) problemas.push(produto + " sumiu do pedido");
    else if (achado.q !== qtd) problemas.push(produto + " ficou " + achado.q + ", esperado " + qtd);
  }
  for (const produto of c.naoTem ?? []) {
    if (itens.some((i) => String(i.p).toLowerCase() === produto.toLowerCase())) {
      problemas.push('"' + produto + '" continua no pedido, e ninguem produz isso');
    }
  }
  for (const [familia, soma] of Object.entries(c.somaDaFamilia ?? {})) {
    const total = itens
      .filter((i) => String(i.c || "").startsWith(familia))
      .reduce((t, i) => t + i.q, 0);
    if (total !== soma) problemas.push("a familia " + familia + " somou " + total + ", esperado " + soma);
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
