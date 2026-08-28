// A PREVIA DA COBRANCA E EXATAMENTE O QUE O CLIENTE RECEBE.
//
// POR QUE ISTO EXISTE
//
// A tela de Recuperar mostra, antes de mandar, a mensagem que vai pro WhatsApp
// do cliente. E mensagem que sai EM NOME DA DONA, com valor, pra quem parou de
// responder. Ela olha, aprova, e manda.
//
// A previa era escrita a mao no JSX:
//
//     Oi {nome}! Seu orcamento da {padaria} pro dia {data} ainda esta de pe, no
//     valor de R$ 218,80. Quer confirmar? E so responder por aqui.
//
// E o servidor mandava o modelo padrao:
//
//     Oi {nome}! Seu orcamento ainda esta de pe. Quer confirmar? E so responder
//     por aqui.
//
// TRES DIFERENCAS, E A DO MEIO E A QUE DOI
//
//   1. a previa citava o NOME DA PADARIA; o modelo nao tem
//   2. a previa citava o DIA da retirada; o modelo nao tem
//   3. a previa mostrava o VALOR EM DESTAQUE; o modelo padrao nao tem `{total}`
//
// A dona aprovava uma mensagem com o valor e o cliente recebia uma sem valor
// nenhum. E se ela tivesse PERSONALIZADO o texto (a tela tem o editor, e o
// modelo chega ate ela como `msgCobranca`), a previa ignorava o que ela escreveu
// e mostrava o texto fixo do JSX.
//
// E O PADRAO ESTAVA ESCRITO EM TRES LUGARES
//
// No `cobranca.ts` (o que manda), no valor default da prop do componente, e na
// previa em JSX. Agora sai de `lib/cobranca-texto.ts`, que e puro de proposito:
// o `cobranca.ts` fala com o banco, e a tela importando dele arrastaria o driver
// do Postgres pro bundle do navegador.
//
// O QUE ELE COBRA
//
//   1. previa e envio usam a MESMA funcao
//   2. a funcao respeita o modelo que a dona salvou
//   3. o `{total}` so aparece quando o modelo pede
//   4. o primeiro nome, e nao o nome inteiro; e sem nome nao vira "Oi !"
//   5. a tela nao escreve a mensagem a mao de novo
//
// Roda com: node testes/a-previa-da-cobranca-e-o-que-o-cliente-recebe.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-previa-cobranca.mjs");

const SONDA = [
  "import { MSG_PADRAO, montarTextoDaCobranca } from '../lib/cobranca-texto.ts';",
  "",
  "const erros = [];",
  "const cobra = (rotulo, deu, esperado) => {",
  "  if (deu !== esperado) erros.push(rotulo + ': deu ' + JSON.stringify(deu) + ', esperado ' + JSON.stringify(esperado));",
  "};",
  "",
  "// 2 e 3. o modelo manda, e o {total} so entra quando ele pede",
  "const comTotal = 'Oi {nome}, seu orcamento de {total} esta de pe.';",
  "cobra('modelo com total', montarTextoDaCobranca(comTotal, 'Ana Paula', 21880), 'Oi Ana, seu orcamento de R$ 218,80 esta de pe.');",
  "",
  "const semTotal = 'Oi {nome}, passando pra lembrar do seu pedido.';",
  "const saiu = montarTextoDaCobranca(semTotal, 'Ana Paula', 21880);",
  "cobra('modelo sem total', saiu, 'Oi Ana, passando pra lembrar do seu pedido.');",
  "if (/R\\\\$/.test(saiu)) erros.push('o valor entrou num modelo que nao pediu valor');",
  "",
  "// 4. o primeiro nome, e o caso sem nome",
  "cobra('primeiro nome', montarTextoDaCobranca('Oi {nome}!', 'Maria Aparecida da Silva', 0), 'Oi Maria!');",
  "cobra('sem nome', montarTextoDaCobranca('Oi {nome}!', '', 0), 'Oi tudo bem!');",
  "cobra('nome so com espaco', montarTextoDaCobranca('Oi {nome}!', '   ', 0), 'Oi tudo bem!');",
  "",
  "// modelo vazio cai no padrao, e nao vira mensagem vazia",
  "const doVazio = montarTextoDaCobranca('', 'Ana', 21880);",
  "if (!doVazio.includes('Ana')) erros.push('modelo vazio nao caiu no padrao: ' + JSON.stringify(doVazio));",
  "if (!MSG_PADRAO.includes('{nome}')) erros.push('o modelo padrao perdeu o {nome}');",
  "",
  "// o mesmo texto duas vezes da o mesmo resultado (sem estado escondido)",
  "if (montarTextoDaCobranca(comTotal, 'Ana', 100) !== montarTextoDaCobranca(comTotal, 'Ana', 100)) {",
  "  erros.push('a montagem nao e estavel entre chamadas');",
  "}",
  "",
  "console.log(JSON.stringify({ erros, padrao: MSG_PADRAO }));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-previa-cobranca.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

// -----------------------------------------------------------------------------
// 1 e 5. Os dois lados usam a mesma funcao, e a tela nao escreve a mao.
// -----------------------------------------------------------------------------
const semComentario = (...p) =>
  fs
    .readFileSync(path.join(raiz, ...p), "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
    .join("\n");

const falhas = [];
const tela = semComentario("components", "Recuperar.tsx");
const servidor = semComentario("lib", "cobranca.ts");

if (!/montarTextoDaCobranca\(/.test(tela)) {
  falhas.push(
    "a tela de Recuperar parou de usar a funcao unica: a previa volta a mostrar " +
      "uma mensagem diferente da que o cliente recebe",
  );
}
if (!/montarTextoDaCobranca/.test(servidor)) {
  falhas.push("o `cobranca.ts` parou de usar a funcao unica pra montar o que envia");
}
// a forma exata do defeito: a mensagem escrita no JSX
if (/Seu orçamento da \{nomeNegocio/.test(tela) || /no valor de <b>/.test(tela)) {
  falhas.push("a mensagem voltou a ser escrita a mao no JSX da previa");
}
// e o padrao nao pode ser escrito a mao na prop
if (/msgCobranca = "Oi \{nome\}/.test(tela)) {
  falhas.push("o modelo padrao voltou a ser escrito a mao na prop do componente");
}

console.log("O modelo padrao: " + JSON.stringify(r.padrao));
console.log("");

const todas = [...r.erros, ...falhas];
if (todas.length) {
  console.log("ERRO  a previa mostra uma coisa e o cliente recebe outra (" + todas.length + ")");
  for (const f of todas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o que a dona aprova na tela e o que sai no WhatsApp");
console.log("");
console.log("PASSOU");
