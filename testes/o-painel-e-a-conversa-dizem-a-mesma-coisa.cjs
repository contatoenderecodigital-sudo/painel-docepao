// O PAINEL E A CONVERSA DIZEM A MESMA COISA SOBRE O MESMO ITEM.
//
// POR QUE ISTO EXISTE
//
// A auditoria dos arquivos de 02/09/2026 achou o painel decidindo por conta
// propria se um produto pede sabor, com a regra ANTIGA (`sabores.length > 0`).
// Resultado, em oito produtos do cardapio:
//
//   coxinha        cardapio: recheio FIXO de frango
//   a conversa     nunca pergunta o sabor, certo
//   o painel       marcava "Sabor *" e avisava em amarelo
//                  "sem o sabor a cozinha nao sabe o que fazer"
//
// A equipe via alarme num item que nao tem escolha nenhuma, e os dois lados do
// sistema diziam coisas opostas sobre a mesma linha. Foi assim tambem com a
// unidade, ha uma semana, em seis arquivos.
//
// A CAUSA ERA A LISTA QUE VAI PRO PAINEL: ela copiava os `sabores` e jogava fora
// o `saborFixo`, entao o painel nao TINHA como perguntar pra fonte unica, e
// inventou a propria conta. Agora a resposta vai pronta, no campo `pedeSabor`.
//
// A ISCA: tirando o `pedeSabor` de `lib/cardapio-opcoes.ts`, ou voltando a
// conta pra `> 0`, os oito de recheio fixo ficam vermelhos.
//
// Roda com: node testes/o-painel-e-a-conversa-dizem-a-mesma-coisa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-painel.mts");
fs.writeFileSync(
  sonda,
  [
    'import { produtosDaCasa, pedeEscolhaDeSabor, unidadeDoPedido } from "../lib/ia/dados/produtos.ts";',
    'import { OPCOES } from "../lib/cardapio-opcoes.ts";',
    "",
    "const discordamNoSabor = [], faltamNaLista = [], discordamNaUnidade = [];",
    "",
    "for (const p of produtosDaCasa()) {",
    "  const noPainel = OPCOES.find((o) => o.nome === p.nome);",
    "  if (!noPainel) {",
    "    faltamNaLista.push(p.nome);",
    "    continue;",
    "  }",
    "  // 1. PEDE SABOR: a mesma resposta dos dois lados.",
    "  const naConversa = pedeEscolhaDeSabor(p);",
    "  if (Boolean(noPainel.pedeSabor) !== naConversa) {",
    "    discordamNoSabor.push(",
    "      p.nome + ' -> conversa: ' + (naConversa ? 'pergunta' : 'nao pergunta') +",
    "      ' | painel: ' + (noPainel.pedeSabor ? 'pergunta' : 'nao pergunta') +",
    "      ' (' + p.sabores.length + ' sabores, fixo=' + p.saborFixo + ')',",
    "    );",
    "  }",
    "  // 2. UNIDADE: kg ou un, tambem a mesma nos dois.",
    "  if (noPainel.unidade !== unidadeDoPedido(p.nome, p.categoria)) {",
    "    discordamNaUnidade.push(",
    "      p.nome + ' -> conversa: ' + unidadeDoPedido(p.nome, p.categoria) + ' | painel: ' + noPainel.unidade,",
    "    );",
    "  }",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  total: produtosDaCasa().length, noPainel: OPCOES.length,",
    "  discordamNoSabor, faltamNaLista, discordamNaUnidade,",
    "}));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-painel.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
console.log("== o painel e a conversa dizem a mesma coisa ==");
console.log("Produtos no cardapio: " + r.total + "  |  na lista do painel: " + r.noPainel);
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
  "produto que o painel nem oferece",
  r.faltamNaLista,
  "a equipe digita o nome na mao, erra, e o nome errado nao casa com a tabela de preco",
);
cobra(
  "produto em que painel e conversa discordam sobre pedir sabor",
  r.discordamNoSabor,
  "alarme vermelho num item sem escolha, ou item sem sabor passando batido no painel",
);
cobra(
  "produto em que painel e conversa discordam sobre a unidade",
  r.discordamNaUnidade,
  "a equipe ve o campo em peca e a conversa cobra em quilo, no mesmo item",
);

console.log(falhas.length ? "REPROVOU EM: " + falhas.join(", ") : "PASSOU: os dois lados concordam nos " + r.total + " produtos");
process.exit(falhas.length ? 1 : 0);
