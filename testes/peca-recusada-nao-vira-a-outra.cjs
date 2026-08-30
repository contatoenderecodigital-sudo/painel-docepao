// RECUSAR UMA PECA DO BOLO NAO PODE ACEITAR A OUTRA.
//
// Medido conversando em 30/08/2026, com o rastro do lado, duas vezes na MESMA
// conversa. O modelo TROCA as duas pecas:
//
//   cliente >> nao quero papel de arroz nao
//   modelo  >> pecas={"topo":TRUE,"papelDeArroz":false}
//
//   cliente >> nao, sem topo
//   modelo  >> pecas={"topo":false,"papelDeArroz":TRUE}
//
// Recusa uma e ele marca a OUTRA como aceita. Na producao isso pos um papel de
// arroz de R$ 12,00 num pedido que o cliente tinha recusado, e o topo, que a
// equipe orca a parte, num bolo que ia sem.
//
// A REGRA NAO DECIDE NADA PELO CLIENTE. Ela so recusa o que ele NAO falou: se a
// frase nomeia uma peca, a outra fica como estava. Se nao nomeia nenhuma ("pode
// ser", "quero sim"), as duas valem, porque ai ele esta respondendo a pergunta
// que a padaria fez e o modelo e quem sabe qual era.
//
// Este teste injeta a leitura de proposito: ele mede o que o CODIGO faz com uma
// resposta trocada, que e a parte que da pra prender. Se a IA vai trocar ou nao
// numa conversa nova, so a conversa diz.
//
// Roda com: node testes/peca-recusada-nao-vira-a-outra.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    oque: "recusar o papel nao acende o topo",
    fala: "nao quero papel de arroz nao",
    leitura: { pecas: { topo: true, papelDeArroz: false } },
    espera: { topo: null, papelDeArroz: false },
    dano: "o topo vai pro bolo e a equipe orca uma peca que ninguem pediu",
  },
  {
    oque: "recusar o topo nao acende o papel",
    fala: "nao, sem topo",
    leitura: { pecas: { topo: false, papelDeArroz: true } },
    espera: { topo: false, papelDeArroz: null },
    dano: "entra R$ 12,00 de papel de arroz num pedido que recusou",
  },
  {
    oque: "querer o topo nao acende o papel junto",
    fala: "quero o topo sim",
    leitura: { pecas: { topo: true, papelDeArroz: true } },
    espera: { topo: true, papelDeArroz: null },
    dano: "cobra o papel de quem so pediu o topo",
  },
  {
    oque: "sem nomear peca nenhuma, o que o modelo disse vale",
    fala: "pode ser",
    leitura: { pecas: { topo: true, papelDeArroz: true } },
    espera: { topo: true, papelDeArroz: true },
    dano: "quem responde 'pode ser' a pergunta da padaria fica sem resposta nenhuma",
  },
  {
    oque: "nomeando as duas, as duas valem",
    fala: "quero topo e papel de arroz",
    leitura: { pecas: { topo: true, papelDeArroz: true } },
    espera: { topo: true, papelDeArroz: true },
    dano: "quem pede as duas leva so uma",
  },
];

const sonda = path.join(__dirname, "_sonda-pecas.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:true, pessoas:20, base:null, baseAceita:true, itens:[],",
    "  naoQuer:[], dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null,",
    "  topoNome:null, topoIdade:null, tema:null, forminha:null, prato:null,",
    "  ultimaFala:null, insistiu:0, retomarEm:null, assunto:null,",
    "  etapasJaPerguntadas:[], etapasAdiadas:[],",
    "};",
    "const pensar = (l) => (async () => l);",
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const r = await responder(VAZIO as never, { texto: c.fala }, pensar(c.leitura) as never);",
    "  saiu.push({ topo: r.estado.pecas?.topo ?? null, papelDeArroz: r.estado.pecas?.papelDeArroz ?? null });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pecas.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== peca recusada nao acende a outra ==");
CASOS.forEach((c, n) => {
  const ok = JSON.stringify(saiu[n]) === JSON.stringify(c.espera);
  console.log(
    (ok ? "ok    " : "ERRO  ") + c.oque +
    (ok ? "" : "  ->  ficou " + JSON.stringify(saiu[n]) + ", esperado " + JSON.stringify(c.espera) + "; " + c.dano),
  );
  if (!ok) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
