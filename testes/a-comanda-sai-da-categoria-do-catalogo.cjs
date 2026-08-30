// DE QUE COMANDA O ITEM SAI E O CATALOGO QUE DIZ, NAO UMA LISTA DE NOMES.
//
// POR QUE ISTO EXISTE
//
// Regra do dono, 27/08/2026: "nada pode ser so uma lista tua assim, so o
// cardapio e valores, o que e fixo mesmo".
//
// O `deptoDe` decidia em tres camadas: a categoria gravada no item, depois uma
// lista de NOMES escrita a mao, depois os acessorios do bolo. Quando a
// categoria vem vazia -- linha antiga, pedido corrigido na mao pela equipe --
// quem respondia era a lista de nomes, e ela nao sabe o que o catalogo sabe.
//
// MEDIDO EM 30/08/2026 nos 86 produtos da casa, com o item chegando sem
// categoria gravada. QUATRO saiam na comanda errada:
//
//     mini pizza             salgado_assado  ->  ia pra comanda da PIZZA
//     leite ninho com avela  docinho         ->  ia pra comanda do BOLO FESTA
//     mini pao de queijo     salgado_frito   ->  ia pros DOCINHOS
//     chodo                  salgado_frito   ->  ia pros DOCINHOS
//
// Nos quatro o catalogo sabia a resposta. A mini pizza e salgadinho de festa, e
// o "avela" do leite ninho acendia o `vela` do acessorio de bolo, entao um
// docinho ia parar no papel de quem monta bolo.
//
// COMO ESTE TESTE DECIDE, E POR QUE OS TRES LADOS
//
// 1. O CATALOGO MANDA. Todo produto da casa cai na mesma comanda com ou sem a
//    categoria gravada. Produto novo que a dona cadastrar nasce coberto aqui.
//
// 2. A REDE EMBAIXO CONTINUA. Nome que o cardapio NAO conhece ("quibe",
//    "esfiha de carne", "vela numero 5") continua achando a comanda pela lista
//    de nomes. Guarda que trava producao e pior que o defeito: sem a rede,
//    "torta salgada de frango" digitado pela equipe cairia nos docinhos.
//
// 3. O PAPEL DO SALGADO CONTINUA UM SO. A dona, com a impressora na mao,
//    30/08/2026: "SALGADOS EH SALGADOS, NAO MUDA NA COMANDA DA COZINHA
//    FABRICAR". Frito e assado saem no mesmo papel; o que separa e a linha.
//
// Roda com: node testes/a-comanda-sai-da-categoria-do-catalogo.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// OS NOMES QUE O CARDAPIO NAO CONHECE, e a comanda que a padaria espera deles.
//
// Nao e catalogo copiado: nenhum destes existe no cardapio, e e isso que se
// mede. Sao as grafias e os acessorios que a equipe digita na mao.
const DE_FORA = [
  ["quibe", "salgados"],
  ["esfiha de carne", "salgados"],
  ["risoles de carne", "salgados"],
  ["bisnaguinha", "padaria"],
  ["torta salgada de frango", "torta_fria"],
  ["vela numero 5", "bolo_festa"],
  ["prato aberto", "bolo_festa"],
  ["caixa com tampa", "bolo_festa"],
];

const sonda = path.join(__dirname, "_sonda-comanda.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { produtosDaCasa, produtoPorNome, produtoNoComeco } from "../lib/ia/dados/produtos.ts";',
    'import { deptoDe, nomeDaComanda } from "../lib/departamentos.ts";',
    "",
    "const DE_FORA = " + JSON.stringify(DE_FORA) + ";",
    "",
    "// 1. A CATEGORIA GRAVADA E O NOME TEM QUE CONCORDAR, NOS 86.",
    "const divergem = [];",
    "const saborColado = [];",
    "for (const p of produtosDaCasa()) {",
    "  const comCategoria = deptoDe({ produto: p.nome, categoria: p.categoria });",
    "  const semCategoria = deptoDe({ produto: p.nome, categoria: null });",
    "  if (comCategoria !== semCategoria) {",
    "    divergem.push(p.nome + ' [' + p.categoria + ']: gravada -> ' + comCategoria + ', pelo nome -> ' + semCategoria);",
    "  }",
    "  // O nome chega com o sabor colado atras ('mini pizza de calabresa'), e a",
    "  // comanda nao pode mudar por causa disso.",
    "  const sabor = (p.sabores ?? [])[0];",
    "  if (sabor) {",
    "    const comSabor = deptoDe({ produto: p.nome + ' de ' + sabor, categoria: null });",
    "    if (comSabor !== comCategoria) {",
    "      saborColado.push(p.nome + ' de ' + sabor + ': ' + comSabor + ' em vez de ' + comCategoria);",
    "    }",
    "  }",
    "}",
    "",
    "// 2. A REDE EMBAIXO: nome de fora do cardapio ainda acha a comanda.",
    "const redeFurada = [], jaConhecidos = [];",
    "for (const [nome, esperado] of DE_FORA) {",
    "  // Se um dia a dona cadastrar este nome, o caso deixa de medir a rede: o",
    "  // teste avisa em vez de passar verde medindo outra coisa.",
    "  if (produtoPorNome(nome) || produtoNoComeco(nome)) { jaConhecidos.push(nome); continue; }",
    "  const saiu = deptoDe({ produto: nome, categoria: null });",
    "  if (saiu !== esperado) redeFurada.push(nome + ': ' + saiu + ' em vez de ' + esperado);",
    "}",
    "",
    "// 3. O PAPEL DO SALGADO E UM SO.",
    "const salgados = produtosDaCasa().filter((p) => String(p.categoria).startsWith('salgado'));",
    "const papeis = [...new Set(salgados.map((p) => deptoDe({ produto: p.nome, categoria: p.categoria })))];",
    "",
    "console.log(JSON.stringify({",
    "  produtos: produtosDaCasa().length, divergem, saborColado, redeFurada, jaConhecidos,",
    "  salgados: salgados.length, papeis, titulo: nomeDaComanda('salgados'),",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-comanda.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

console.log("Produtos da casa medidos: " + r.produtos);
console.log("Nomes de fora do cardapio medidos: " + (DE_FORA.length - r.jaConhecidos.length));
console.log("");

const cobra = (rotulo, lista) => {
  if (lista.length) {
    falhas.push(rotulo + ": " + lista.join(" | "));
    console.log("ERRO  " + rotulo + " (" + lista.length + ")");
    for (const x of lista.slice(0, 10)) console.log("        " + x);
  } else {
    console.log("ok    " + rotulo + ": nenhum");
  }
};

cobra("produto cuja comanda muda quando a categoria nao vem gravada", r.divergem);
cobra("produto cuja comanda muda com o sabor colado no nome", r.saborColado);
cobra("nome de fora do cardapio que perdeu a comanda", r.redeFurada);

// A rede tem que estar sendo MEDIDA. Se todo caso virar produto do cardapio, o
// teste passa sem provar nada, e detector que nao detecta e o pior resultado.
if (r.jaConhecidos.length === DE_FORA.length) {
  falhas.push("nenhum nome de fora sobrou: a rede embaixo nao esta sendo medida");
  console.log("ERRO  nenhum nome de fora sobrou pra medir a rede");
} else if (r.jaConhecidos.length) {
  console.log("aviso o cardapio passou a conhecer: " + r.jaConhecidos.join(", "));
}

// O PAPEL DO SALGADO CONTINUA UM SO.
if (r.papeis.length !== 1 || r.papeis[0] !== "salgados") {
  falhas.push("o salgado saiu em " + r.papeis.length + " papeis: " + r.papeis.join(", "));
  console.log("ERRO  o salgado saiu em mais de um papel: " + r.papeis.join(", "));
} else {
  console.log("ok    os " + r.salgados + " salgados saem num papel so, '== " + r.titulo + " =='");
}

console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: a comanda sai da categoria do catalogo, e o nome de fora ainda acha a dela.");
