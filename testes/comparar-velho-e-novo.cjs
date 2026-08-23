// O VELHO E O NOVO, LADO A LADO
//
// Passa conversas REAIS pelo fluxo novo e mostra o que ele responderia, junto
// do que a Dora de hoje respondeu de verdade.
//
// NAO MANDA MENSAGEM PRA NINGUEM. Roda no terminal, contra a OpenAI, e nada
// sai pro WhatsApp.
//
// AS CONVERSAS SAO DO DONO, NAO INVENTADAS
//
// As duas que fizeram ele recuar da entrega em 22/08/2026:
//
//   kemilly: "4 leites 1kg e 100 brigadeiros e 100 beijinhos"
//            -> a Dora anotou "bolo 4 leites COM BRIGADEIRO" e perdeu os 200
//               docinhos. A cliente teve que cobrar: "ta e os doces q eu pedi?"
//
//   Sandro:  "Pode ser, vou querer bolo tambem dai" (depois de R$ 418,80)
//            -> nao virou pedido nenhum, e ela ainda perguntou se ele queria
//               os salgados que ja estavam na base aceita
//
// COMO LER O RESULTADO
//
// Compare o pedido que sobra no fim, nao a beleza do texto. O gabarito e o que
// a cliente pediu, e ele esta escrito em cada conversa aqui embaixo.
// A chave vem do ambiente. Ela nao mora neste repositorio: quem a tem e o
// container no servidor, e quem roda isto exporta antes de chamar. Assim ela
// nao encosta em arquivo nenhum aqui.
if (!process.env.OPENAI_API_KEY) {
  console.log("Falta a chave. Rode assim, pegando ela do proprio servidor:");
  console.log("");
  console.log("  export OPENAI_API_KEY=$(ssh -i ~/.ssh/id_ed25519_hub root@179.198.126.197 \\");
  console.log("    'docker inspect $(docker ps --filter name=uyyqf7kzymaxlyq9kl -q|head -1) \\");
  console.log("     --format \"{{range .Config.Env}}{{println .}}{{end}}\" | grep ^OPENAI_API_KEY= | cut -d= -f2-')");
  console.log("  node testes/comparar-velho-e-novo.cjs");
  process.exit(1);
}
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CONVERSAS = [
  {
    nome: "kemilly (festa do Arthur)",
    // o que ela escreveu, na ordem
    falas: [
      "bom dia",
      "quero um bolo e docinhos pra festa do meu filho arthur",
      "dia 02",
      "20 pessoas",
      "4 leites 1kg e 100 brigadeiros e 100 beijinhos",
    ],
    esperado: "bolo de 4 leites de 1 kg + 100 brigadeiros + 100 beijinhos",
    oQueAconteceu:
      'a Dora anotou "bolo 4 leites COM BRIGADEIRO" e os 200 docinhos sumiram; ' +
      'a cliente cobrou "ta e os doces q eu pedi?"',
  },
  {
    nome: "Sandro (festa de 20 pessoas)",
    falas: [
      "Bom dia, tudo bem?",
      "Tenho uma festa pra 20 pessoas",
      "12/09",
      "Pode ser, vou querer bolo tambem dai",
      "Sandro Zaparolli, 12/09 vou buscar as 11:30",
    ],
    esperado: "a base inteira anotada: 200 salgados, 100 docinhos e 2 kg de bolo",
    oQueAconteceu:
      "nada foi anotado depois do aceite de R$ 418,80, e ela ainda perguntou " +
      "se ele queria os salgados que ja estavam na base",
  },
];

const sonda = path.join(__dirname, "_sonda-comparar.mjs");
fs.writeFileSync(
  sonda,
  [
    'import OpenAI from "openai";',
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { pensarComOpenAI } from "../lib/ia/fluxo/pensar-openai.ts";',
    'import { dizerComJeito } from "../lib/ia/fluxo/dizer.ts";',
    'import { motorPadrao } from "../lib/ia/orcamento.ts";',
    "const CONVERSAS = " + JSON.stringify(CONVERSAS) + ";",
    "const cliente = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });",
    "let custoIn = 0, custoOut = 0, chamadas = 0;",
    "const pensar = pensarComOpenAI(cliente, (u) => { custoIn += u.tokensIn; custoOut += u.tokensOut; chamadas++; });",
    "const saida = [];",
    "for (const conversa of CONVERSAS) {",
    "  let e = { ehFesta:true, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[], dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, retomarEm:null };",
    "  const passos = [];",
    "  for (const fala of conversa.falas) {",
    "    const r = await responder(e, { texto: fala }, pensar);",
    "    e = r.estado;",
    "    const comJeito = await dizerComJeito(cliente, r.fala, fala, (u) => { custoIn += u.tokensIn; custoOut += u.tokensOut; chamadas++; });",
    "    passos.push({ fala, etapa: r.etapa, resposta: comJeito, cru: r.fala.texto, botoes: r.fala.botoes.map((b) => b.titulo), rastro: r.rastro });",
    "  }",
    "  saida.push({ nome: conversa.nome, esperado: conversa.esperado, oQueAconteceu: conversa.oQueAconteceu, passos, itens: e.itens, dados: e.dados });",
    "}",
    "console.log(JSON.stringify({ saida, chamadas, custoIn, custoOut }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-comparar.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 300000, shell: process.platform === "win32",
    env: { ...process.env },
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const { saida, chamadas, custoIn, custoOut } = JSON.parse(bruto.trim().split("\n").pop());

for (const c of saida) {
  console.log("");
  console.log("=".repeat(74));
  console.log(c.nome.toUpperCase());
  console.log("=".repeat(74));
  console.log("o que ela pediu:  " + c.esperado);
  console.log("o que aconteceu:  " + c.oQueAconteceu);
  console.log("");
  console.log("--- pelo fluxo NOVO ---");
  for (const p of c.passos) {
    console.log("");
    console.log("  cliente> " + p.fala);
    const bt = p.botoes.length ? "   [" + p.botoes.join("] [") + "]" : "";
    console.log("  padaria> " + String(p.resposta).split("\n").join(" | ") + bt);
    console.log("           (" + p.etapa + ")");
  }
  console.log("");
  console.log("  DADOS: " + JSON.stringify(c.dados));
  console.log("  PEDIDO NO FIM:");
  if (!c.itens.length) console.log("    (nada anotado)");
  for (const i of c.itens) {
    console.log("    " + i.qtd + " " + (i.categoria === "bolo_festa" ? "kg de " : "") + i.produto + (i.obs ? " (" + i.obs + ")" : ""));
  }
}

console.log("");
console.log("=".repeat(74));
console.log("chamadas de IA: " + chamadas + " | tokens: " + custoIn + " entrada, " + custoOut + " saida");
console.log("Compare o PEDIDO do fim com o que a cliente pediu. O texto pode ser melhorado depois;");
console.log("o pedido errado e o que custa dinheiro e cliente.");
