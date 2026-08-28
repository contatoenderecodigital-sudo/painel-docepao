// TODO PRODUTO DA CASA CHEGA NA COZINHA, E COM A UNIDADE CERTA.
//
// POR QUE ISTO EXISTE
//
// O papel do mural e o fim da linha: se o item nao sai la, ninguem produz. E o
// caminho ate ele passa por tres decisoes independentes, cada uma num arquivo:
//
//     categoriaDoPedido   produtos.ts     que categoria o pedido usa
//     deptoDe             departamentos.ts  em que comanda ela cai
//     deptosDoPedido      departamentos.ts  quais comandas o pedido tem
//
// `montarCupons` agrupa por `deptoDe` e IMPRIME por `deptosDoPedido`. As duas
// tem que concordar: comanda que uma cria e a outra nao lista simplesmente nao
// sai do papel, e o item so aparece no cupom do caixa. Ninguem descobre olhando
// codigo, porque nao ha erro nenhum -- o papel sai, so que sem aquele item.
//
// E A UNIDADE E A OUTRA METADE.
//
// "3 kg de bolo" impresso como "3 un" e a cozinha assando tres bolos. Sao tres
// camadas decidindo a unidade tambem (o catalogo, o que ficou gravado no
// pedido, e o fallback do cupom), e o que este teste cobra e o resultado no
// papel, que e a unica coisa que a producao le.
//
// O QUE ELE COBRA
//
// Os 86 produtos da casa, um por um:
//
//   1. cada um gera pelo menos UMA comanda de cozinha alem do caixa
//   2. o produto aparece escrito no papel
//   3. produto vendido por quilo sai em kg no papel, e por unidade sai em un
//
// Produto novo que a dona cadastrar passa a ser cobrado aqui sozinho.
//
// Roda com: node testes/todo-produto-chega-na-cozinha.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-cozinha.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { produtosDaCasa, categoriaDoPedido, unidadeDoPedido } from '../lib/ia/dados/produtos.ts';",
    "import { montarCupons } from '../lib/cupom-escpos.ts';",
    "",
    "// O PAPEL DO JEITO QUE A PESSOA LE.",
    "//",
    "// Cada comando ESC/POS e o byte de controle mais uma ou duas letras. Tirar",
    "// so o byte deixa a letra grudada na linha ('E200 un coxinha'), e tirar so",
    "// os pares conhecidos deixa o byte. Aqui saem os dois: o comando inteiro e,",
    "// depois, qualquer byte de controle que tenha sobrado.",
    "const legivel = (t) => String(t)",
    "  .replace(/\\x1B[Ea]./g, '').replace(/\\x1B@/g, '').replace(/\\x1DV../g, '')",
    "  .split('').filter((ch) => ch === '\\n' || ch.charCodeAt(0) > 31).join('');",
    "const semAc = (t) => String(t || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();",
    "",
    "const semComanda = [], naoAparecem = [], unidadeErrada = [];",
    "",
    "for (const p of produtosDaCasa()) {",
    "  const unidade = unidadeDoPedido(p.nome);",
    "  const qtd = unidade === 'kg' ? 2 : 50;",
    "  const item = {",
    "    produto: p.nome, categoria: categoriaDoPedido(p.nome), qtd, obs: null, unidade,",
    "    unitCentavos: Math.round(p.preco * 100), subtotalCentavos: Math.round(p.preco * 100 * qtd),",
    "  };",
    "  const pedido = {",
    "    id: 'abc12345', clienteNome: 'Ana', clienteTelefone: '', retiradaData: '2026-09-02',",
    "    retiradaHora: '15:00', pessoas: null, totalCentavos: item.subtotalCentavos,",
    "    formaPagamento: 'pix', observacoes: null, itens: [item],",
    "  };",
    "  const cupons = montarCupons(pedido);",
    "",
    "  // O ultimo cupom e sempre o do caixa. Tem que existir comanda antes dele.",
    "  if (cupons.length < 2) { semComanda.push(p.nome + ' [' + item.categoria + ']'); continue; }",
    "",
    "  const daCozinha = legivel(cupons[0]);",
    "  if (!semAc(daCozinha).includes(semAc(p.nome))) {",
    "    naoAparecem.push(p.nome + ' [' + item.categoria + ']');",
    "  }",
    "  // A linha do item no papel: a quantidade e depois o nome.",
    "  // A LINHA DO ITEM, e nao a do titulo da comanda.",
    "  //",
    "  // A primeira versao deste teste pegava a primeira linha que continha o",
    "  // nome, e essa e o cabecalho ('== TORTA FRIA =='). Sete produtos",
    "  // reprovaram por isso, e o defeito era do teste, nao do papel. A linha do",
    "  // item comeca pela quantidade.",
    "  const linha = daCozinha.split('\\n')",
    "    .filter((l) => /^[0-9]/.test(l.trim()))",
    "    .find((l) => semAc(l).includes(semAc(p.nome))) ?? '';",
    "  const esperado = unidade === 'kg' ? ' kg' : ' un';",
    "  if (!linha.includes(esperado)) {",
    "    unidadeErrada.push(p.nome + ': esperava \"' + esperado.trim() + '\" e saiu ' + JSON.stringify(linha.trim().slice(0, 40)));",
    "  }",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  produtos: produtosDaCasa().length, semComanda, naoAparecem, unidadeErrada,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-cozinha.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Produtos da casa medidos: " + r.produtos);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista.slice(0, 20)) console.log("        " + l);
  if (lista.length > 20) console.log("        ... e mais " + (lista.length - 20));
  console.log("");
};

cobra("produto que nao gera comanda de cozinha (so sai no cupom do caixa)", r.semComanda);
cobra("produto que nao aparece escrito no papel da cozinha", r.naoAparecem);
cobra("unidade errada no papel (3 kg de bolo virando 3 bolos)", r.unidadeErrada);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    os 86 produtos chegam na cozinha, escritos e com a unidade certa");
console.log("");
console.log("PASSOU");
