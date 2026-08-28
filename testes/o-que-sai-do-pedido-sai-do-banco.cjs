// O QUE SAI DO PEDIDO SAI DO BANCO TAMBEM.
//
// POR QUE ISTO EXISTE
//
// `gravarEstado` so sabia ACRESCENTAR e CORRIGIR item. O que desaparecia do
// estado da conversa ficava gravado pra sempre na tela da dona.
//
// O fluxo tem TRES caminhos que tiram item, e eles estao no `fluxo.ts`:
//
//   1. recusar uma familia   apaga o que ja estava anotado dela
//   2. recusar o papel       tira a linha do papel de arroz
//   3. fundir dois bolos     dois viram UM bolo misto, e o outro some
//
// Nos dois primeiros a conversa se cura sozinha: a recusa fica gravada e o
// filtro roda de novo a cada mensagem. Na FUSAO DOS BOLOS nao ha flag nenhuma
// pra refazer, entao o bolo que sumiu do estado continuava na tela e a dona via
// DOIS bolos onde o cliente pediu um misto.
//
// E ha um quarto caso, que nao e caminho de codigo e sim consequencia: quando o
// nome vira canonico ("cenoura" -> "bolo caseiro cenoura"), antes ficavam as
// duas linhas no banco.
//
// O QUE ELE COBRA, E O QUE ELE NAO PROVA
//
// Cobra a decisao: dado o estado ANTES e o DEPOIS, quais itens tem que sair.
// `itensQueSairam` e pura e exportada pra isso, do mesmo jeito que o
// `estadoDosDados` ja era.
//
// NAO prova a gravacao em si, que precisa de banco. Os estados aqui foram
// escritos a partir da LEITURA dos tres caminhos no `fluxo.ts`, e nao de rodar
// o fluxo. Se algum daqueles caminhos mudar de forma, este teste continua verde
// e nao devia: quem cobre isso de verdade e medir uma conversa contra o banco.
//
// Roda com: node testes/o-que-sai-do-pedido-sai-do-banco.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-saiu.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { itensQueSairam } from '../lib/ia/fluxo/gravar.ts';",
    "",
    "const est = (itens) => ({ itens });",
    "const it = (produto, categoria, qtd = 1, obs = null) => ({ produto, categoria, qtd, obs });",
    "",
    "const CASOS = [",
    "  ['fusao de dois bolos num misto',",
    "    [it('bolo 4 leites', 'bolo_festa', 2), it('bolo laka', 'bolo_festa', 2), it('coxinha', 'salgado_frito', 100)],",
    "    [it('bolo laka', 'bolo_festa', 2, 'misto: bolo 4 leites e bolo laka'), it('coxinha', 'salgado_frito', 100)],",
    "    ['bolo 4 leites']],",
    "",
    "  ['recusou a familia do docinho depois de escolher dois',",
    "    [it('brigadeiro', 'docinho', 50), it('beijinho', 'docinho', 50), it('coxinha', 'salgado_frito', 100)],",
    "    [it('coxinha', 'salgado_frito', 100)],",
    "    ['brigadeiro', 'beijinho']],",
    "",
    "  ['recusou o papel de arroz',",
    "    [it('bolo 4 leites', 'bolo_festa', 2), it('papel de arroz', 'papel_de_arroz', 1)],",
    "    [it('bolo 4 leites', 'bolo_festa', 2)],",
    "    ['papel de arroz']],",
    "",
    "  ['o nome virou canonico',",
    "    [it('cenoura', 'bolo_caseiro', 1)],",
    "    [it('bolo caseiro cenoura', 'bolo_caseiro', 1)],",
    "    ['cenoura']],",
    "",
    "  ['nada mudou: nao pode sair nada',",
    "    [it('coxinha', 'salgado_frito', 100), it('brigadeiro', 'docinho', 50)],",
    "    [it('coxinha', 'salgado_frito', 100), it('brigadeiro', 'docinho', 50)],",
    "    []],",
    "",
    "  ['so mudou a quantidade: nao pode sair nada',",
    "    [it('coxinha', 'salgado_frito', 100)],",
    "    [it('coxinha', 'salgado_frito', 200)],",
    "    []],",
    "",
    "  ['so mudou a observacao: nao pode sair nada',",
    "    [it('esfirra', 'salgado_assado', 50)],",
    "    [it('esfirra', 'salgado_assado', 50, 'carne')],",
    "    []],",
    "",
    "  ['acrescentou item: nao pode sair nada',",
    "    [it('coxinha', 'salgado_frito', 100)],",
    "    [it('coxinha', 'salgado_frito', 100), it('brigadeiro', 'docinho', 50)],",
    "    []],",
    "",
    "  ['mesmo nome em familias diferentes nao se confundem',",
    "    [it('brigadeiro', 'docinho', 50), it('bolo brigadeiro', 'bolo_festa', 2)],",
    "    [it('bolo brigadeiro', 'bolo_festa', 2)],",
    "    ['brigadeiro']],",
    "];",
    "",
    "const erros = [];",
    "for (const [rotulo, antes, depois, esperado] of CASOS) {",
    "  const saiu = itensQueSairam(est(antes), est(depois)).map((x) => x.produto).sort();",
    "  const alvo = [...esperado].sort();",
    "  if (JSON.stringify(saiu) !== JSON.stringify(alvo)) {",
    "    erros.push(rotulo + ': saiu ' + JSON.stringify(saiu) + ', esperado ' + JSON.stringify(alvo));",
    "  }",
    "}",
    "",
    "console.log(JSON.stringify({ casos: CASOS.length, erros }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-saiu.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

// A remocao tem que acontecer ANTES da gravacao: `anotarItem` junta bolo com
// bolo pelo nome, entao gravar primeiro faria o item novo cair dentro da linha
// velha e a remocao depois levaria os dois.
const fonte = fs.readFileSync(
  path.join(__dirname, "..", "lib", "ia", "fluxo", "gravar.ts"), "utf8");
const posRemove = fonte.indexOf("itensQueSairam(antes, depois)");
const posGrava = fonte.indexOf("await anotarItem(");

console.log("Casos medidos: " + r.casos);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("a decisao de quem sai do pedido esta errada", r.erros);

if (posRemove < 0) {
  falhas.push("remocao");
  console.log("ERRO  `gravarEstado` nao remove mais o que saiu do pedido");
  console.log("");
} else if (posGrava >= 0 && posRemove > posGrava) {
  falhas.push("ordem");
  console.log("ERRO  a remocao ficou DEPOIS da gravacao; o item novo cai dentro da linha velha");
  console.log("");
}

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o que sai do pedido sai do banco, e o que fica nao e tocado");
console.log("");
console.log("PASSOU");
