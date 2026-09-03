// O SABOR DITO DENTRO DE UMA ETAPA E O SABOR DE UM PRODUTO DAQUELA ETAPA.
//
// Palavra dele, 02/09/2026: *"se ele tiver falando com o cara sobre tal produto
// e ele falar o sabor, e obvio o que e"*. E: *"faca isso em todos os produtos, e
// uma regra geral pra quando adicionar mais ja ter"*.
//
// O DEFEITO, medido:
//
//   padaria >> "Agora os docinhos: quais voce quer?"
//   cliente >> "morango"
//   padaria >> "O bolo morango e vendido por quilo, R$ 49,90 o quilo..."
//
// A conversa era sobre DOCINHO e ela foi pro BOLO. A busca so casava por NOME, e
// nenhum docinho se chama morango: morango e SABOR da trufa. O bolo morango era
// o unico candidato com esse nome, entao ganhava sem disputa, e uma trufa de
// R$ 2,25 virava um bolo de R$ 49,90 o quilo.
//
// POR QUE ESTE TESTE VARRE TUDO
//
// Ele nao mede tres exemplos: pega CADA familia do cardapio, CADA produto dela e
// CADA sabor desse produto, e cobra que dizer aquele sabor naquela etapa caia
// num produto DAQUELA familia. Sao centenas de combinacoes, e elas nascem do
// catalogo: o dia em que a dona cadastrar um sabor novo, ele entra na varredura
// sozinho, que e o que ele pediu.
//
// AS DUAS EXCECOES, e as duas sao decisao:
//
//   a palavra tambem e NOME de produto daquela familia. "brigadeiro" no docinho
//   e o brigadeiro, e nao "sabor de outra coisa". Nome ganha de sabor.
//
//   DOIS produtos da familia tem o mesmo sabor. Ai nao ha obviedade nenhuma, e
//   quem escolhe e a pergunta, nao este arquivo.
//
// A ISCA: tirando o bloco `daEtapa` de `produto.ts`, a varredura acende com
// dezenas de sabores caindo na familia errada.
//
// Roda com: node testes/o-sabor-dito-na-etapa-e-daquela-etapa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-sabor-etapa.mts");
fs.writeFileSync(
  sonda,
  [
    'import { produtosDaCasa } from "../lib/ia/dados/produtos.ts";',
    'import { identificarProduto } from "../lib/ia/fluxo/produto.ts";',
    'import { chavesDeFamilia, categoriasDaFamilia } from "../lib/ia/fluxo/generico.ts";',
    'import { semAcento } from "../lib/ia/texto.ts";',
    "",
    "const foraDaFamilia = [], naoAchou = [];",
    "let combinacoes = 0;",
    "",
    "for (const familia of chavesDeFamilia()) {",
    "  const cats = categoriasDaFamilia(familia);",
    "  if (!cats.length) continue;",
    "  const daFamilia = produtosDaCasa().filter((p) => cats.includes(String(p.categoria)));",
    "  // Os nomes desta familia: nome ganha de sabor, entao eles saem da conta.",
    "  const nomesDaFamilia = new Set();",
    "  for (const p of daFamilia) {",
    "    nomesDaFamilia.add(semAcento(p.nome));",
    "    if (p.nomeCurto) nomesDaFamilia.add(semAcento(p.nomeCurto));",
    "  }",
    "  // Quantos produtos da familia tem cada sabor: com dois ou mais, quem",
    "  // escolhe e a pergunta, e nao a etapa.",
    "  const quantosComOSabor = new Map();",
    "  for (const p of daFamilia) {",
    "    for (const s of p.sabores) {",
    "      const k = semAcento(s);",
    "      quantosComOSabor.set(k, (quantosComOSabor.get(k) ?? 0) + 1);",
    "    }",
    "  }",
    "  for (const p of daFamilia) {",
    "    for (const sabor of p.sabores) {",
    "      const k = semAcento(sabor);",
    "      if (nomesDaFamilia.has(k)) continue;",
    "      if ((quantosComOSabor.get(k) ?? 0) > 1) continue;",
    "      combinacoes++;",
    "      const achado = identificarProduto(sabor, familia, sabor);",
    "      const daCasa = produtosDaCasa().find((x) => semAcento(x.nome) === semAcento(achado.produto));",
    "      if (!daCasa) {",
    "        naoAchou.push(familia + ' + \"' + sabor + '\" -> ' + achado.produto);",
    "        continue;",
    "      }",
    "      if (!cats.includes(String(daCasa.categoria))) {",
    "        foraDaFamilia.push(",
    "          'etapa ' + familia + ' + \"' + sabor + '\" -> ' + daCasa.nome + ' (' + daCasa.categoria + ')',",
    "        );",
    "      }",
    "    }",
    "  }",
    "}",
    "",
    "console.log(JSON.stringify({ combinacoes, foraDaFamilia, naoAchou }));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-sabor-etapa.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 300000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== o sabor dito na etapa e daquela etapa ==");
console.log("Combinacoes de familia + sabor conferidas: " + r.combinacoes);
console.log("");

const cobra = (rotulo, lista, dano) => {
  if (!lista.length) {
    console.log("ok    " + rotulo + ": nenhum");
    return;
  }
  erros++;
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista.slice(0, 12)) console.log("        " + l);
  if (lista.length > 12) console.log("        ... e mais " + (lista.length - 12));
  console.log("        DANO: " + dano);
  console.log("");
};

cobra(
  "sabor dito na etapa que cai em produto de OUTRA familia",
  r.foraDaFamilia,
  "a trufa de R$ 2,25 vira bolo de R$ 49,90 o quilo, e a comanda sai pra outra bancada",
);
cobra(
  "sabor que nao acha produto nenhum do cardapio",
  r.naoAchou,
  "o item entra no pedido com um nome que a cozinha nao conhece",
);

if (r.combinacoes < 20) {
  console.log("ERRO  a varredura conferiu so " + r.combinacoes + " combinacoes; ela parou de medir");
  erros++;
} else {
  console.log("ok    a varredura sai do catalogo: sabor novo cadastrado entra sozinho");
}

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
