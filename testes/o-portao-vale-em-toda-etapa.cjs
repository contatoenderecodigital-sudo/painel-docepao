// O PORTAO VALE EM TODA ETAPA, E NAO EM TRES DELAS.
//
// POR QUE ISTO EXISTE
//
// `leituraQueCabeNaEtapa` se descrevia como "a ultima trava antes de virar
// pedido". Era, em tres das onze etapas. Nas outras oito ela desistia na
// primeira linha, e qualquer coisa que o modelo devolvesse entrava no pedido
// sem ninguem conferir. Uma delas e a ABERTURA, onde a maioria dos pedidos
// nasce.
//
// Que o modelo inventa produto nao e hipotese. Medido contra ele de verdade em
// 27/08/2026:
//
//     "50 xilofone"            ->  50 BRIGADEIROS (obs: xilofone)
//     "50 macarons"            ->  brigadeiro
//     "daquele docinho preto"  ->  brigadeiro
//
// O QUE ELE COBRA, E POR QUE OS DOIS LADOS IMPORTAM
//
// Portao apertado demais e PIOR que portao nenhum: negar "quero um bolo" trava
// a conversa na primeira mensagem, e isso acontece todo dia. Entao o teste
// cobra as duas coisas ao mesmo tempo:
//
//   1. TUDO que a casa vende passa. Todo produto e toda familia do catalogo,
//      no singular e no plural, com artigo na frente. Se a dona cadastrar
//      familia nova amanha, este teste passa a cobrar por ela sozinho.
//   2. O que ela nao vende NAO passa.
//
// A lista de produtos sai do catalogo. A de fora e curta e explicita, porque
// nao existe catalogo do que nao existe.
//
// Roda com: node testes/o-portao-vale-em-toda-etapa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-portao.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { produtosDaCasa, gruposDaCasa } from '../lib/ia/dados/produtos.ts';",
    "import { leituraQueCabeNaEtapa } from '../lib/ia/fluxo/leitura.ts';",
    "",
    "// A etapa da abertura e a que nao tem cardapio proprio E recebe pedido.",
    "const entra = (nome) => {",
    "  const r = leituraQueCabeNaEtapa('abertura', { itens: [{ produto: nome, qtd: 10 }] });",
    "  return (r.limpa.itens ?? []).length === 1;",
    "};",
    "",
    "// Como o cliente escreve o que ele quer: cru, com artigo e no plural.",
    "//",
    "// O plural so entra em nome de UMA palavra terminada em vogal. Pendurar um",
    "// 's' em 'biz', 'bombom' ou 'frutas (pessego e abacaxi)' nao produz palavra",
    "// que gente escreve, e cobrar isso seria o teste inventando defeito.",
    "const soUmaPalavraEmVogal = (n) => !/[ (%]/.test(n) && /[aeiou]$/i.test(n);",
    "const JEITOS = [(n) => n, (n) => 'um ' + n, (n) => (soUmaPalavraEmVogal(n) ? n + 's' : n)];",
    "",
    "const negados = [];",
    "const alvos = new Set();",
    "for (const p of produtosDaCasa()) { alvos.add(p.nome); alvos.add(p.nomeCurto); }",
    "// As familias tambem: e assim que o cliente comeca a conversa.",
    "for (const g of gruposDaCasa()) for (const parte of g.split(/[-_]/)) if (parte.length >= 4) alvos.add(parte);",
    "for (const alvo of alvos) {",
    "  for (const jeito of JEITOS) {",
    "    const escrito = jeito(alvo);",
    "    if (!entra(escrito)) negados.push(escrito);",
    "  }",
    "}",
    "",
    "// O que a casa nao vende. Curto e explicito: nao ha catalogo do que nao existe.",
    "const DE_FORA = ['xilofone', 'macaron', 'sushi', 'churrasco', 'hamburguer', 'lasanha', 'feijoada'];",
    "const passaram = DE_FORA.filter(entra);",
    "",
    "console.log(JSON.stringify({ alvos: alvos.size, jeitos: JEITOS.length, negados, passaram, deFora: DE_FORA.length }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-portao.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Nomes e familias do catalogo: " + r.alvos + ", em " + r.jeitos + " jeitos de escrever = " +
  (r.alvos * r.jeitos) + " tentativas");
console.log("Produtos de fora testados: " + r.deFora);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista.slice(0, 25)) console.log("        " + l);
  if (lista.length > 25) console.log("        ... e mais " + (lista.length - 25));
  console.log("");
};

cobra("a padaria negou o que ela vende", r.negados);
cobra("entrou no pedido o que a casa nao faz", r.passaram);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o portao deixa passar tudo que a casa vende e barra o que ela nao faz");
console.log("");
console.log("PASSOU");
