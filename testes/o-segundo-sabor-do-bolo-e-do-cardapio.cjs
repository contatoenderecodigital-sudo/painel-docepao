// O SEGUNDO SABOR DO BOLO SAI DO CARDAPIO, E NAO DE UMA REGEX.
//
// POR QUE ISTO EXISTE
//
// Bolo misto tem dois sabores, e o NOME do item precisa dizer os dois: e o nome
// que a cozinha le e o que o motor cota. A montagem lia o segundo sabor da
// observacao com uma regex que pega qualquer par de palavras ligado por "e" ou
// "com". Medido em 28/08/2026, com o que ela devolve de verdade:
//
//     "pao de lo branco e tema Frozen"  ->  a="pao de lo branco"  b="tema frozen"
//     "prato aberto e papel de arroz"   ->  a="prato aberto"      b="papel de arroz"
//     "massa branca com recheio ninho"  ->  a="massa branca"      b="recheio ninho"
//
// O caso caro e o que CASA. Item "bolo prestigio", observacao "prestigio com
// ganache": o nome virava "bolo prestigio com ganache", que existe no cardapio
// como bolo CASEIRO, R$ 33,90 a unidade no lugar de R$ 46,90 o quilo. Uma
// palavra na observacao trocava o produto E o preco.
//
// E o filtro de tres letras que protegia isso derrubava um sabor de verdade:
// "biz", de R$ 49,90. O motor de preco ja tinha registrado esse mesmo defeito
// no comentario dele: "todo bolo misto com biz saia cobrado pelo OUTRO sabor".
//
// O QUE ELE COBRA
//
// A classe inteira, dos dois lados:
//
//   1. TODO sabor de bolo da casa, dito como segundo sabor, tem que entrar no
//      nome. Inclusive os de tres letras. Sabor novo que a dona cadastrar passa
//      a ser cobrado aqui sozinho.
//   2. O que NAO e sabor do cardapio nao pode entrar no nome, porque dali ele
//      vai pra cozinha e pro motor de preco.
//
// Roda com: node testes/o-segundo-sabor-do-bolo-e-do-cardapio.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-segundo-sabor.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { produtosDaCasa } from '../lib/ia/dados/produtos.ts';",
    "import { motorPadrao } from '../lib/ia/orcamento.ts';",
    "import { nomeComOsDoisSabores } from '../lib/banco/montagem.ts';",
    "",
    "const bolos = produtosDaCasa().filter((p) => p.categoria === 'bolo_festa' || p.categoria === 'bolo_caseiro');",
    "const semAc = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();",
    "",
    "// A funcao DE VERDADE, importada. Nada de reconstruir o corpo dela aqui.",
    "const chamar = (produto, obs) =>",
    "  nomeComOsDoisSabores({ produto, categoria: 'bolo_festa', qtd: 1, unidade: 'kg', obs }).produto;",
    "",
    "// 1. todo sabor da casa entra como segundo sabor",
    "const naoEntraram = [];",
    "const base = 'bolo brigadeiro';",
    "for (const b of bolos) {",
    "  const sabor = semAc(b.nomeCurto);",
    "  if (sabor === 'brigadeiro' || base.includes(sabor)) continue;",
    "  const saiu = chamar(base, 'brigadeiro com ' + sabor);",
    "  if (saiu === base) naoEntraram.push(sabor);",
    "}",
    "",
    "// 2. o que nao e sabor do cardapio nao entra",
    "const FORA = ['tema frozen', 'papel de arroz', 'sem lactose', 'massa branca',",
    "  'pao de lo', 'ganache', 'nome alice', 'prato aberto'];",
    "const entraramAtoa = FORA.filter((x) => chamar(base, 'brigadeiro com ' + x) !== base);",
    "",
    "// 3. o nome resultante continua sendo cotado como BOLO pelo motor",
    "const perderamOPreco = [];",
    "for (const b of bolos.slice(0, 8)) {",
    "  const sabor = semAc(b.nomeCurto);",
    "  if (sabor === 'brigadeiro' || base.includes(sabor)) continue;",
    "  const nome = chamar(base, 'brigadeiro com ' + sabor);",
    "  const l = motorPadrao.cotarPorItens([{ item: nome, qtd: 2 }]).linhas[0];",
    "  if (!l || !/^bolo/.test(String(l.categoria))) perderamOPreco.push(nome + ' -> ' + (l ? l.item : 'nao cotou'));",
    "}",
    "",
    "console.log(JSON.stringify({ bolos: bolos.length, naoEntraram, entraramAtoa, perderamOPreco }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-segundo-sabor.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Sabores de bolo da casa: " + r.bolos);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista.slice(0, 20)) console.log("        " + l);
  console.log("");
};

cobra("sabor da casa que nao entra como segundo sabor do bolo misto", r.naoEntraram);
cobra("entrou no NOME DO PRODUTO o que nao e sabor do cardapio", r.entraramAtoa);
cobra("o bolo misto deixou de ser cotado como bolo", r.perderamOPreco);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    so sabor do cardapio entra no nome, e todos entram");
console.log("");
console.log("PASSOU");
