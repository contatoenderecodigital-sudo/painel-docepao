// O NOME QUE O FLUXO ESCREVE TEM QUE SER O NOME QUE O MOTOR ENTENDE.
//
// POR QUE ISTO EXISTE
//
// O sistema decide o nome de um produto em dois lugares, e os dois precisam
// chegar na MESMA palavra:
//
//   - `lib/ia/fluxo/produto.ts` (`identificarProduto`) decide como o item vai
//     ser escrito no pedido. E o caminho VIVO: `ehDoFluxoNovo` so devolve false
//     com valor explicito em FLUXO_NOVO_PARA, entao o fluxo E o sistema.
//   - `lib/ia/orcamento.ts` decide o preco daquele nome.
//
// Quando os dois discordam, o defeito e mudo: o pedido fica bonito na tela e o
// preco e de outro produto. Ja aconteceu com "brigadeiro" (docinho de R$ 1,25
// cotado no lugar do bolo de R$ 46,90/kg) e com o quiche cotado como pizza.
//
// ESTE TESTE COBRA UMA COISA SO: pra todo produto da casa, o nome que o fluxo
// escreve o motor cota como ELE MESMO, no preco e na unidade do catalogo. Nao
// como o vizinho parecido.
//
// CUIDADO AO LER UMA FALHA AQUI: o vizinho parecido quase sempre TEM preco,
// entao o defeito nunca aparece como "produto sem preco". Aparece como um
// pedido que fecha, com o numero errado.
//
// Roda com: node testes/a-ia-e-o-motor-falam-a-mesma-lingua.cjs
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// O fluxo importa por "@/lib/...", e o atalho so existe no tsconfig. Por isso a
// sonda roda com tsx, do jeito que os outros testes do fluxo ja fazem, em vez
// de compilar os arquivos soltos.
const sonda = path.join(__dirname, "_sonda-lingua.mts");
fs.writeFileSync(
  sonda,
  [
    'import { identificarProduto } from "../lib/ia/fluxo/produto.ts";',
    'import { produtosDaCasa } from "../lib/ia/dados/produtos.ts";',
    'import { cotarPorItens } from "../lib/ia/orcamento.ts";',
    "",
    "// COMO O CLIENTE ESCREVERIA CADA PRODUTO.",
    "//",
    "// O bolo de festa vem do cardapio SEM o prefixo (\"4 leites\"), e e assim",
    "// que o cliente fala: o prefixo e o sistema que poe. O bolo caseiro tem o",
    "// \"caseiro\" so no nome interno. Por isso a sonda entrega o nome cru, do",
    "// jeito que chegaria na conversa, e cobra o canonico certo de volta.",
    "const casos: { digitado: string; etapa?: string; esperado: ReturnType<typeof produtosDaCasa>[number] }[] = [];",
    "for (const p of produtosDaCasa()) {",
    '  const festa = p.categoria === "bolo_festa";',
    '  const caseiro = p.categoria === "bolo_caseiro";',
    '  const cru = festa ? p.nome.replace(/^bolo /, "") : caseiro ? p.nome.replace(/^bolo caseiro /, "") : p.nome;',
    '  casos.push({ digitado: cru, etapa: festa || caseiro ? "bolo" : undefined, esperado: p });',
    "  // O bolo de festa tambem chega com o prefixo, quando o cliente ja diz",
    '  // "bolo de X". Os dois jeitos tem que dar no mesmo nome.',
    '  if (festa) casos.push({ digitado: p.nome, etapa: "bolo", esperado: p });',
    "}",
    "",
    "const saida = casos.map((c) => {",
    "  const id = identificarProduto(c.digitado, c.etapa);",
    "  const canonico = id?.produto ?? null;",
    "  const l = canonico ? cotarPorItens([{ item: canonico, qtd: 1 }]).linhas[0] : null;",
    "  return {",
    "    digitado: c.digitado,",
    "    etapa: c.etapa ?? null,",
    "    canonico,",
    "    nomeDoCatalogo: c.esperado.nome,",
    "    precoDoCatalogo: c.esperado.preco,",
    "    unidadeDoCatalogo: c.esperado.unidade,",
    "    cotouComo: l?.item ?? null,",
    "    cotouPor: l?.unit ?? null,",
    "    cotouEm: l?.unidade ?? null,",
    "  };",
    "});",
    "console.log(JSON.stringify({ saida, total: produtosDaCasa().length }));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-lingua.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const { saida, total } = JSON.parse(bruto.trim().split("\n").pop());

const semAcento = (t) =>
  String(t ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const nomeTrocado = [];
const precoTrocado = [];
const unidadeTrocada = [];

for (const r of saida) {
  const comoPediu = '  "' + r.digitado + '"' + (r.etapa ? " (na etapa do " + r.etapa + ")" : "");

  if (semAcento(r.canonico) !== semAcento(r.nomeDoCatalogo)) {
    nomeTrocado.push(
      comoPediu +
      '\n      o fluxo escreve: "' + r.canonico + '"' +
      '\n      o catalogo tem:  "' + r.nomeDoCatalogo + '"',
    );
    continue;
  }
  if (r.cotouPor === null) {
    precoTrocado.push('  "' + r.canonico + '"  =>  o motor nao cota nada');
    continue;
  }
  if (Math.abs(Number(r.cotouPor) - Number(r.precoDoCatalogo)) > 0.001) {
    precoTrocado.push(
      '  "' + r.canonico + '"  =>  o motor cobra R$ ' + r.cotouPor +
      ' (como "' + r.cotouComo + '"), o catalogo diz R$ ' + r.precoDoCatalogo,
    );
    continue;
  }
  if ((r.cotouEm || "un") !== r.unidadeDoCatalogo) {
    unidadeTrocada.push(
      '  "' + r.canonico + '"  =>  o motor diz ' + (r.cotouEm || "un") +
      ", o catalogo diz " + r.unidadeDoCatalogo,
    );
  }
}

console.log("Produtos da casa: " + total + " | jeitos de pedir testados: " + saida.length);
console.log("");

let erros = 0;
const bloco = (lista, tituloRuim, tituloBom) => {
  if (lista.length) {
    erros++;
    console.log("ERRO  " + lista.length + " " + tituloRuim);
    console.log(lista.join("\n"));
    console.log("");
  } else {
    console.log("ok    " + tituloBom);
  }
};

bloco(nomeTrocado, "jeito(s) de pedir que o fluxo escreve com outro nome:",
  "o fluxo escreve todo produto com o nome do catalogo");
bloco(precoTrocado, "nome(s) que o motor cota pelo preco errado:",
  "o motor cobra, por cada nome, o preco do catalogo");
bloco(unidadeTrocada, "produto(s) com a unidade trocada entre fluxo e motor:",
  "peso continua peso e peca continua peca, do fluxo ate o preco");

process.exit(erros ? 1 : 0);
