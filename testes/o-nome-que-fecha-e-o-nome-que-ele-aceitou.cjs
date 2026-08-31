// O NOME QUE FECHA E O NOME QUE ELE ACEITOU.
//
// Medido em 31/08/2026, no pedido de festa que fechou pelo WhatsApp de ponta a
// ponta:
//
//   resumo que ele confirmou   2 kg de bolo brigadeiro com 0% lactose  R$ 111,80
//   gravado no pedido          bolo brigadeiro
//   preco gravado              R$ 55,90/kg   (certo)
//
// O DINHEIRO ESTAVA CERTO E A COMANDA ESTAVA ERRADA. A confeitaria receberia
// "bolo brigadeiro" e faria com lactose, pra um cliente que pediu sem. Isso
// deixa de ser prejuizo e vira problema de saude, que e a mesma razao pela qual
// a promessa de restricao nunca pode aparecer no pedido sem o produto atras.
//
// A CAUSA: o motor devolve o nome CANONICO da linha, e pro bolo misto isso e so
// a base. Ele faz certo, porque o trabalho dele e achar o preco. Quem fechava o
// pedido e que copiava o nome dele em vez do nome do item.
//
// Este e o defeito mais perigoso da noite justamente porque nada gritava: o
// total batia, o resumo batia, o cupom saia bonito, e so a cozinha veria.
//
// A ISCA: voltando `item: String(l.item)` em `fechar.ts`, o primeiro caso perde
// o "com 0% lactose" e este teste fica vermelho.
//
// Roda com: node testes/o-nome-que-fecha-e-o-nome-que-ele-aceitou.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "o bolo misto fecha com a mistura no nome, e com o preco do mais caro",
    itens: [{ produto: "bolo brigadeiro com 0% lactose", categoria: "bolo_festa", qtd: 2, obs: "tema futebol" }],
    temNome: "bolo brigadeiro com 0% lactose",
    unit: 55.9,
    dano: "a confeitaria faria o bolo COM lactose pra quem pediu sem",
  },
  {
    nome: "bolo misto comum tambem guarda os dois sabores",
    itens: [{ produto: "bolo brigadeiro com morango", categoria: "bolo_festa", qtd: 3, obs: null }],
    temNome: "bolo brigadeiro com morango",
    unit: 49.9,
    dano: "a cozinha faria so brigadeiro num bolo que o cliente pediu misto",
  },
  {
    nome: "produto simples continua fechando com o nome do cardapio",
    itens: [{ produto: "coxinha", categoria: "salgado_frito", qtd: 100, obs: "frango" }],
    temNome: "coxinha",
    unit: 1,
    dano: "a trava nao pode inventar nome onde nao ha mistura",
  },
];

const sonda = path.join(__dirname, "_sonda-nome-que-fecha.mts");
fs.writeFileSync(
  sonda,
  [
    'import { motorPadrao } from "../lib/ia/orcamento.ts";',
    'import { paraOMotor } from "../lib/ia/fluxo/cotar.ts";',
    'import { unidadeDoPedido } from "../lib/ia/dados/produtos.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const itens = c.itens.map((i) => ({ ...i, unidade: unidadeDoPedido(i.produto, i.categoria) }));",
    "  const cot = motorPadrao.cotarPorItens(paraOMotor(itens as never));",
    "  // A MESMA CONTA QUE `fecharPedido` faz pra montar a linha gravada.",
    "  const mesmaOrdem = (cot.linhas ?? []).length === itens.length;",
    "  saiu.push((cot.linhas ?? []).map((l, n) => ({",
    "    item: mesmaOrdem ? String(itens[n].produto || l.item) : String(l.item),",
    "    unit: Number(l.unit) || 0,",
    "  })));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-nome-que-fecha.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let erros = 0;
console.log("== o nome que fecha e o nome que ele aceitou ==");
CASOS.forEach((c, n) => {
  const linhas = saiu[n];
  const problemas = [];
  if (!linhas.some((l) => semAc(l.item) === semAc(c.temNome))) {
    problemas.push("gravou " + JSON.stringify(linhas.map((l) => l.item)) + ", esperado \"" + c.temNome + "\"");
  }
  if (c.unit != null && !linhas.some((l) => Math.abs(l.unit - c.unit) < 0.005)) {
    problemas.push("o preco ficou " + JSON.stringify(linhas.map((l) => l.unit)) + ", esperado " + c.unit);
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
