// NOME DE GRUPO SAI DO CARDAPIO, E NAO DE UMA LISTA ESCRITA A MAO.
//
// O DEFEITO, medido conversando com a producao em 02/09/2026:
//
//   cliente >> quero bolo, salgados, docinhos e cupcakes
//   rastro  >> modelo leu: 1x bolo ;; 1x salgado ;; 1x docinho ;; 1x cupcake
//   rastro  >> TIREI DO PEDIDO, nao existe no cardapio: 1x cupcake
//
// Existem QUATRO cupcakes na casa. "cupcake" nao e nome de produto (os produtos
// sao "cupcake pequeno", "cupcake grande"), e sim nome de GRUPO. A guarda que
// impede produto inventado estava certa em desconfiar, e apagou o pedido do
// cliente porque a lista de nomes de grupo tinha OITO nomes pra QUINZE
// categorias do cardapio.
//
// Regra do dono, e ela ja estava escrita no proprio arquivo: "nada pode ser so
// uma lista tua, so o cardapio e valores".
//
// AS DUAS CONDICOES PRA UMA CATEGORIA VIRAR GRUPO:
//
//   MAIS DE UM PRODUTO. Categoria de um produto so nao e grupo: nomear o
//   calzone JA e escolher o calzone.
//
//   O NOME NAO PODE SER DE UM PRODUTO. Esta condicao sozinha evitou CINCO
//   regressoes, medidas antes de escrever o codigo: empadao, calzone,
//   franciscano, torta fria e bolo salgado sao categoria E produto ao mesmo
//   tempo. Nome de grupo e tratado no fluxo como "ainda vai virar produto",
//   entao a padaria nunca perguntaria a quantidade de um empadao.
//
// A ISCA: tirando o `familiasDoCardapio()` de `generico.ts`, o cupcake volta a
// nao ser grupo e o primeiro caso fica vermelho.
//
// Roda com: node testes/a-familia-do-cardapio-nao-vira-lista-minha.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-familia-cardapio.mts");
fs.writeFileSync(
  sonda,
  [
    'import { produtosDaCasa } from "../lib/ia/dados/produtos.ts";',
    'import { ehNomeDeFamilia, categoriasDaFamilia } from "../lib/ia/fluxo/generico.ts";',
    'import { semAcento } from "../lib/ia/texto.ts";',
    "",
    "// 1. TODA CATEGORIA COM MAIS DE UM PRODUTO PRECISA SER ALCANCAVEL por algum",
    "//    nome de grupo. Senao o cliente que pedir pelo grupo tem o pedido apagado.",
    "const quantos = new Map();",
    "const nomes = new Set();",
    "for (const p of produtosDaCasa()) {",
    "  quantos.set(p.categoria, (quantos.get(p.categoria) ?? 0) + 1);",
    "  nomes.add(semAcento(p.nome));",
    "}",
    "const inalcancaveis = [];",
    "for (const [cat, n] of quantos) {",
    "  if (n < 2) continue;",
    "  if (cat === 'adicional_bolo') continue;",
    "  // Categoria cujo nome E um produto nao precisa de grupo: nomear ja escolhe.",
    "  const legivel = String(cat).replace(/_/g, ' ');",
    "  if (nomes.has(semAcento(legivel))) continue;",
    "  const alcancada = ['salgado','doce','docinho','bolo','torta','pizza','cupcake','padaria','salgado frito','salgado assado','bolo recheado']",
    "    .some((f) => ehNomeDeFamilia(f) && categoriasDaFamilia(f).includes(cat));",
    "  if (!alcancada) inalcancaveis.push(cat + ' (' + n + ' produtos)');",
    "}",
    "",
    "// 2. NOME QUE E PRODUTO NAO PODE SER GRUPO. Se virar, a padaria para de",
    "//    perguntar a quantidade dele, porque grupo e 'ainda vai virar produto'.",
    "const viraramGrupo = [];",
    "for (const p of produtosDaCasa()) {",
    "  if (ehNomeDeFamilia(p.nome)) viraramGrupo.push(p.nome);",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  cupcakeEGrupo: ehNomeDeFamilia('cupcake'),",
    "  cupcakeAponta: categoriasDaFamilia('cupcake'),",
    "  tortaEGrupo: ehNomeDeFamilia('torta'),",
    "  tortaAponta: categoriasDaFamilia('torta'),",
    "  boloAponta: categoriasDaFamilia('bolo'),",
    "  salgadoAponta: categoriasDaFamilia('salgado'),",
    "  inalcancaveis, viraramGrupo,",
    "}));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-familia-cardapio.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== nome de grupo sai do cardapio ==");

const cobra = (nome, ok, detalhe, dano) => {
  console.log((ok ? "ok    " : "ERRO  ") + nome + (ok ? "" : "  ->  " + detalhe + "; " + dano));
  if (!ok) erros++;
};

cobra(
  "cupcake e nome de grupo, e aponta pra categoria cupcake",
  r.cupcakeEGrupo && r.cupcakeAponta.includes("cupcake"),
  "cupcake -> " + JSON.stringify(r.cupcakeAponta),
  "quem pede cupcake tem o pedido APAGADO, que foi o defeito medido em 02/09",
);
cobra(
  "torta e nome de grupo, e cobre a fria e a recheada",
  r.tortaEGrupo && r.tortaAponta.includes("torta_fria") && r.tortaAponta.includes("torta_recheada"),
  "torta -> " + JSON.stringify(r.tortaAponta),
  "quem pede torta sem dizer qual fica sem resposta",
);
cobra(
  "bolo continua cobrindo festa e caseiro, e NAO o bolo salgado",
  r.boloAponta.includes("bolo_festa") && r.boloAponta.includes("bolo_caseiro") && !r.boloAponta.includes("bolo_salgado"),
  "bolo -> " + JSON.stringify(r.boloAponta),
  "bolo salgado entrando em 'bolo' faria ele virar sabor de bolo doce",
);
cobra(
  "salgado continua cobrindo frito e assado",
  r.salgadoAponta.includes("salgado_frito") && r.salgadoAponta.includes("salgado_assado"),
  "salgado -> " + JSON.stringify(r.salgadoAponta),
  "a familia mais usada da casa parar de agrupar",
);
cobra(
  "nenhuma categoria com mais de um produto ficou inalcancavel",
  r.inalcancaveis.length === 0,
  "sem grupo que alcance: " + r.inalcancaveis.join(", "),
  "quem pedir por esse grupo tem o pedido apagado, igual ao cupcake",
);
cobra(
  "nenhum NOME DE PRODUTO virou nome de grupo",
  r.viraramGrupo.length === 0,
  "viraram grupo: " + r.viraramGrupo.join(", "),
  "a padaria para de perguntar a quantidade deles, porque grupo nao e produto ainda",
);

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
