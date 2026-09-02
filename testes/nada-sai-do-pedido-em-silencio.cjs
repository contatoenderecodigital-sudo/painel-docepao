// NADA SAI DO PEDIDO EM SILENCIO.
//
// Regra do dono, desde o primeiro dia: NADA SOME DO PEDIDO. O que falta vira
// pergunta ou aviso, nunca um sumico calado.
//
// POR QUE ISTO EXISTE
//
// A auditoria dos arquivos de 02/09/2026 achou o painel jogando fora, ao
// salvar, toda linha com quantidade zero, sem dizer nada:
//
//   .filter((x) => x.produto.trim() !== "" && x.qtd > 0)
//
// A equipe via o item na tela, clicava Salvar, a tela dizia "Salvo", e o item
// nao tinha ido. Duas linhas ABAIXO desse filtro ha um comentario contando que
// o mesmo descarte silencioso, no papel de arroz, custava R$ 12,00 em todo
// pedido com bolo ate ser consertado em 31/08/2026. A familia sobreviveu logo
// acima do proprio relato.
//
// OS TRES CASOS SAO DIFERENTES, e essa e a parte que importa:
//
//   linha vazia               sai calada, e esta certo: e a linha que nasce
//                             quando alguem clica "Acrescentar item" e nao
//                             preenche, e nao carrega informacao nenhuma
//   com nome, sem quantidade  sai, MAS a tela diz o nome dela
//   com nome e quantidade     vai pro banco
//
// Nao bloqueia o salvamento inteiro por causa de uma linha: a equipe salva no
// meio do caminho o tempo todo, e travar o botao faria ela perder correcao
// pronta.
//
// A ISCA: fazendo `semQuantidade` devolver sempre lista vazia, o caso do aviso
// fica vermelho.
//
// Roda com: node testes/nada-sai-do-pedido-em-silencio.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "item completo vai pro banco",
    linhas: [{ produto: "coxinha", qtd: 100 }],
    salva: ["coxinha"],
    avisa: [],
    dano: "a equipe corrige o pedido e a correcao nao grava",
  },
  {
    nome: "linha vazia sai calada, e esta certo",
    linhas: [{ produto: "coxinha", qtd: 100 }, { produto: "", qtd: 1 }],
    salva: ["coxinha"],
    avisa: [],
    dano: "travar o salvamento por causa de uma linha em branco faz a equipe perder o resto",
  },
  {
    nome: "item com nome e sem quantidade e AVISADO pelo nome",
    linhas: [{ produto: "coxinha", qtd: 100 }, { produto: "brigadeiro", qtd: 0 }],
    salva: ["coxinha"],
    avisa: ["brigadeiro"],
    dano: "a tela diz Salvo e a equipe vai embora achando que gravou os dois",
  },
  {
    nome: "e o resto salva do mesmo jeito",
    linhas: [{ produto: "brigadeiro", qtd: 0 }, { produto: "coxinha", qtd: 100 }, { produto: "risólis", qtd: 50 }],
    salva: ["coxinha", "risólis"],
    avisa: ["brigadeiro"],
    dano: "bloquear tudo por causa de uma linha faz a equipe perder correcao pronta",
  },
  {
    nome: "quantidade quebrada de produto por quilo passa",
    linhas: [{ produto: "bolo brigadeiro", qtd: 2.5 }],
    salva: ["bolo brigadeiro"],
    avisa: [],
    dano: "2,5 kg de bolo e pedido normal, nao pode ser tratado como erro",
  },
  {
    nome: "quantidade negativa nao passa, e e avisada",
    linhas: [{ produto: "coxinha", qtd: -5 }],
    salva: [],
    avisa: ["coxinha"],
    dano: "quantidade negativa vira subtotal negativo e o total do pedido desce",
  },
];

const sonda = path.join(__dirname, "_sonda-silencio.mts");
fs.writeFileSync(
  sonda,
  [
    'import { oQueSalvaEOQueFicaDeFora } from "../components/PedidoMontado.tsx";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = CASOS.map((c) => {",
    "  const r = oQueSalvaEOQueFicaDeFora(c.linhas as never);",
    "  return { salva: r.salva.map((x) => x.produto), avisa: r.semQuantidade.map((x) => x.produto) };",
    "});",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-silencio.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== nada sai do pedido em silencio ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  const igual = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (!igual(r.salva, c.salva)) {
    problemas.push("salvou " + JSON.stringify(r.salva) + ", esperado " + JSON.stringify(c.salva));
  }
  if (!igual(r.avisa, c.avisa)) {
    problemas.push("avisou sobre " + JSON.stringify(r.avisa) + ", esperado " + JSON.stringify(c.avisa));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
