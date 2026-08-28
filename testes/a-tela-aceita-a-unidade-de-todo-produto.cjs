// A TELA DA EQUIPE ACEITA A UNIDADE DE TODO PRODUTO DO CARDAPIO.
//
// POR QUE ISTO EXISTE
//
// Quando a equipe corrige um pedido, ela escolhe a categoria do item e a tela
// oferece as unidades daquela categoria. Essa tabela e escrita a mao no
// `PedidoMontado.tsx`:
//
//     const UNIDADES_POR_CATEGORIA = {
//       bolo_festa: ["kg"], docinho: ["un"], pizza: ["un", "kg"], ...
//     };
//
// E uma lista minha, e a regra da casa e clara sobre isso: so o cardapio e os
// valores sao dado fixo. O risco nao e teorico: se a dona cadastrar um produto
// vendido por quilo numa categoria que a tela so aceita "un", a equipe nao
// consegue reproduzir o item, e a unidade errada vira preco errado no papel.
//
// MEDIDO EM 28/08/2026: NAO HA DIVERGENCIA HOJE
//
//     86 produtos do cardapio, nenhum com unidade que a tela recusa
//     nenhuma categoria do `categoriaDoPedido` que a tela nao conheca
//
// Entao nao havia o que consertar. O que faltava era isto: alguem avisando no
// dia em que divergir.
//
// POR QUE UM TESTE E NAO UM CONSERTO
//
// Trocar a tabela por uma derivada do cardapio muda a TELA (a ordem dos itens no
// seletor, o rotulo de cada categoria, quais aparecem), e mexer em tela sem
// medida e como eu criei tres defeitos neste mesmo dia. A tabela concorda hoje;
// o teste garante que ela nao pare de concordar calada.
//
// O QUE ELE COBRA
//
//   1. todo produto do cardapio tem a unidade dele aceita na categoria dele
//   2. toda categoria que o `categoriaDoPedido` produz existe na tela
//   3. a tela nao inventa categoria que o sistema nao usa
//
// Roda com: node testes/a-tela-aceita-a-unidade-de-todo-produto.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");

// A TABELA SAI DO ARQUIVO, E NAO DA MINHA COPIA.
//
// Copiar a tabela pra ca seria medir a copia: foi assim que eu quase reportei um
// defeito que nao existia, hoje mesmo, reconstruindo uma montagem com as chaves
// erradas. Aqui ela e lida do proprio `PedidoMontado.tsx`.
const fonte = fs.readFileSync(path.join(raiz, "components", "PedidoMontado.tsx"), "utf8");
const bloco = fonte.slice(
  fonte.indexOf("const UNIDADES_POR_CATEGORIA"),
  fonte.indexOf("};", fonte.indexOf("const UNIDADES_POR_CATEGORIA")) + 2,
);

const DA_TELA = {};
for (const m of bloco.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
  DA_TELA[m[1]] = [...m[2].matchAll(/"(\w+)"/g)].map((x) => x[1]);
}

const falhas = [];
if (Object.keys(DA_TELA).length === 0) {
  falhas.push("nao achei a tabela `UNIDADES_POR_CATEGORIA` no PedidoMontado.tsx: ela mudou de forma");
}

const sonda = path.join(__dirname, "_sonda-unidade-categoria.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { produtosDaCasa, categoriaDoPedido } from '../lib/ia/dados/produtos.ts';",
    "const DA_TELA = " + JSON.stringify(DA_TELA) + ";",
    "",
    "const fora = [];",
    "const desconhecidas = new Set();",
    "for (const p of produtosDaCasa()) {",
    "  const cat = categoriaDoPedido(p.nome);",
    "  const aceitas = DA_TELA[cat];",
    "  if (!aceitas) { desconhecidas.add(cat); continue; }",
    "  if (!aceitas.includes(p.unidade)) {",
    "    fora.push(p.nome + ' (' + cat + ') e vendido por ' + p.unidade + ', e a tela so aceita ' + aceitas.join('/'));",
    "  }",
    "}",
    "",
    "// as categorias que o sistema produz de verdade, pra achar as que sobram",
    "const usadas = new Set(produtosDaCasa().map((p) => categoriaDoPedido(p.nome)));",
    "",
    "console.log(JSON.stringify({",
    "  produtos: produtosDaCasa().length,",
    "  fora,",
    "  desconhecidas: [...desconhecidas],",
    "  usadas: [...usadas],",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-unidade-categoria.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

// 3. a tela pode ter categoria a mais (`outro`, `por_quilo` pro que a equipe
// lanca na mao), mas nao pode ter MENOS do que o cardapio produz.
const naTela = new Set(Object.keys(DA_TELA));
const faltando = r.usadas.filter((c) => !naTela.has(c));

console.log("Produtos conferidos: " + r.produtos + " | categorias na tela: " + naTela.size);
console.log("");

const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("produto do cardapio com unidade que a tela da equipe recusa", r.fora);
cobra("categoria do cardapio que a tela nao conhece", [...r.desconhecidas, ...faltando]);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    a equipe consegue reproduzir qualquer item do cardapio, na unidade certa");
console.log("");
console.log("PASSOU");
