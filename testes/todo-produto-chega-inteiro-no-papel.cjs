// TODO PRODUTO CHEGA INTEIRO NO PAPEL DA COZINHA.
//
// POR QUE ISTO EXISTE
//
// O cupom e o ULTIMO lugar do sistema, e era o unico que nenhuma varredura
// alcancava. Tudo que a conversa e o painel acertam morre ali se o papel sair
// errado: quem produz nao le o banco, le o papel.
//
// A auditoria dos arquivos, em 02/09/2026, foi ate a porta dele e parou. Este
// teste entra: pega os 86 produtos do cardapio, um por um, monta o cupom DE
// VERDADE (`montarCupons`) e confere o que saiu impresso.
//
// O QUE ELE COBRA, produto por produto:
//
//   1. o produto aparece em algum cupom (nada some no caminho)
//   2. a quantidade sai escrita, e com a unidade certa (kg ou un)
//   3. o sabor escolhido chega no papel (a cozinha nao adivinha recheio)
//   4. produto por quilo NUNCA sai como peca, e vice-versa
//
// O 4 e o que ja custou caro: 3 kg de bolo virando tres bolos na bancada, e um
// bolo de 2,5 kg cobrado por unidade.
//
// Roda com: node testes/todo-produto-chega-inteiro-no-papel.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-papel.mts");
fs.writeFileSync(
  sonda,
  [
    'import { produtosDaCasa, pedeEscolhaDeSabor, unidadeDoPedido } from "../lib/ia/dados/produtos.ts";',
    'import { montarCupons } from "../lib/cupom-escpos.ts";',
    "",
    "// Tira os codigos da impressora, pra sobrar o texto que sai no papel.",
    "const soOTexto = (s) => s.replace(/\\x1B[@a-zA-Z]?[\\x00-\\x03]?/g, ' ').replace(/\\x1D[a-zA-Z][\\x00-\\x03]?/g, ' ');",
    "",
    "const sumiram = [], semQtd = [], semSabor = [], unidadeErrada = [];",
    "",
    "for (const p of produtosDaCasa()) {",
    "  // O papel de arroz e peca do bolo e nao vai sozinho num pedido.",
    "  if (p.categoria === 'adicional_bolo') continue;",
    "  const emQuilo = unidadeDoPedido(p.nome, p.categoria) === 'kg';",
    "  const qtd = emQuilo ? 2 : 100;",
    "  const sabor = pedeEscolhaDeSabor(p) ? p.sabores[0] : null;",
    "  const pedido = {",
    "    id: 'teste', clienteNome: 'Ana', clienteTelefone: '5549999990000',",
    "    retiradaData: '2026-09-10', retiradaHora: '18:30', pessoas: null,",
    "    totalCentavos: Math.round(p.preco * qtd * 100), formaPagamento: 'pix', observacoes: null,",
    "    itens: [{",
    "      produto: p.nome, categoria: p.categoria, qtd, obs: sabor,",
    "      unidade: emQuilo ? 'kg' : 'un',",
    "      unitCentavos: Math.round(p.preco * 100),",
    "      subtotalCentavos: Math.round(p.preco * qtd * 100),",
    "    }],",
    "  };",
    "  const papel = soOTexto(montarCupons(pedido as never).join('\\n')).toLowerCase();",
    "  const semAc = (t) => String(t).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();",
    "  const noPapel = semAc(papel);",
    "",
    "  // 1. O PRODUTO APARECE.",
    "  if (!noPapel.includes(semAc(p.nome))) {",
    "    sumiram.push(p.nome);",
    "    continue;",
    "  }",
    "  // 2. A QUANTIDADE SAI ESCRITA.",
    "  if (!new RegExp('(^|[^0-9])' + qtd + '([^0-9]|$)').test(noPapel)) {",
    "    semQtd.push(p.nome + ' (esperava ver ' + qtd + ')');",
    "  }",
    "  // 3. O SABOR ESCOLHIDO CHEGA NO PAPEL.",
    "  if (sabor && !noPapel.includes(semAc(sabor))) {",
    "    semSabor.push(p.nome + ' -> o recheio \"' + sabor + '\" nao saiu impresso');",
    "  }",
    "  // 4. QUILO NAO VIRA PECA, E PECA NAO VIRA QUILO.",
    "  const escritoEmQuilo = new RegExp('(^|[^a-z])' + qtd + '\\\\s*kg').test(noPapel);",
    "  if (emQuilo !== escritoEmQuilo) {",
    "    unidadeErrada.push(",
    "      p.nome + ' -> o cardapio diz ' + (emQuilo ? 'kg' : 'un') + ' e o papel saiu ' + (escritoEmQuilo ? 'kg' : 'un'),",
    "    );",
    "  }",
    "}",
    "",
    "console.log(JSON.stringify({ total: produtosDaCasa().length, sumiram, semQtd, semSabor, unidadeErrada }));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-papel.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 300000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
console.log("== todo produto chega inteiro no papel da cozinha ==");
console.log("Produtos varridos: " + r.total);
console.log("");

const cobra = (rotulo, lista, dano) => {
  if (!lista.length) {
    console.log("ok    " + rotulo + ": nenhum");
    return;
  }
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista.slice(0, 12)) console.log("        " + l);
  if (lista.length > 12) console.log("        ... e mais " + (lista.length - 12));
  console.log("        DANO: " + dano);
  console.log("");
};

cobra(
  "produto que nao aparece no papel",
  r.sumiram,
  "a cozinha nunca fica sabendo que tem que produzir isso",
);
cobra(
  "produto sem a quantidade impressa",
  r.semQtd,
  "quem produz nao sabe quantos fazer, e liga pra dona no meio da manha",
);
cobra(
  "produto com o recheio escolhido faltando no papel",
  r.semSabor,
  "a cozinha faz o recheio padrao e o cliente descobre na festa",
);
cobra(
  "produto com a unidade trocada no papel",
  r.unidadeErrada,
  "3 kg de bolo viram tres bolos na bancada; ja aconteceu",
);

console.log(falhas.length ? "REPROVOU EM: " + falhas.join(", ") : "PASSOU: os " + r.total + " produtos chegam inteiros no papel");
process.exit(falhas.length ? 1 : 0);
