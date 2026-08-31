// "DIA 12" E UMA DATA, E A PERGUNTA DE DADO SAI COMO O CODIGO ESCREVEU.
//
// Dois defeitos do pedido de festa de 30/08/2026, e os dois na etapa dos dados.
//
// 1. A DATA QUE ELA NAO ENTENDEU
//
//      padaria >> Para que dia você quer buscar?
//      cliente >> dia 12
//      padaria >> Para que dia você quer buscar?     (a MESMA frase, de novo)
//      cliente >> 12 do mes que vem
//
//    O leitor exigia dia E mes ("12/09") ou nome de dia da semana. "dia 12"
//    caia fora dos dois, virava null, e a padaria repetiu a pergunta palavra
//    por palavra sem dizer o que faltava. Palavra do dono: "n entendi pq ela
//    pediu a data 2 vzs seguida".
//
// 2. A PERGUNTA QUE O MODELO PIOROU
//
//      codigo  >> O pedido fica no nome de quem?
//      chegou  >> Qual nome está no pedido?
//
//    A frase certa ja estava escrita em `pergunta.ts`. Quem trocou foi a camada
//    de reescrita, que passa o texto pelo modelo pra soar mais humano. Palavra
//    do dono: "horrivel essa pergunta (...) parece q eh um pedido pronto ja o
//    jeito q ela falou". Nas quatro perguntas de dado a reescrita nao tem o que
//    melhorar, e ja custou caro uma vez: foi ela que trocou o assunto da
//    pergunta no teste da Kemilly e gravou TOPO = SIM.
//
// A ISCA: voltando `podeReescrever: true` no caso "dados" de `pergunta.ts`, o
// ultimo caso fica vermelho. Tirando `soODiaViraData`, os primeiros ficam.
//
// Roda com: node testes/a-padaria-entende-dia-12.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// Medido com 31/08/2026 como hoje, que e o dia seguinte ao pedido que quebrou.
const DATAS = [
  { fala: "dia 12", espera: "12/09/2026", dano: "a padaria repetiu a pergunta e o cliente teve que reescrever" },
  { fala: "12", espera: "12/09/2026", dano: "quem responde so o numero respondeu a pergunta" },
  { fala: "no dia 12", espera: "12/09/2026", dano: "o mesmo dia, com a preposicao que gente usa" },
  { fala: "dia 30", espera: "30/09/2026", dano: "dia que ja passou neste mes e o do mes que vem" },
  { fala: "12/09", espera: "12/09/2026", dano: "o formato com barra nao pode ter quebrado" },
  { fala: "sexta", espera: "04/09/2026", dano: "dia da semana continua valendo" },
  // HORA NAO E DATA. O campo errado ja custou pedido neste projeto, e um
  // numero de dois digitos e exatamente o formato de uma hora.
  { fala: "as 18", espera: null, dano: "18h viraria dia 18 e o pedido sairia com a data errada" },
  { fala: "18h", espera: null, dano: "o mesmo, escrito do outro jeito" },
  { fala: "12:30", espera: null, dano: "hora com dois pontos nao pode virar dia 12" },
  { fala: "dia 40", espera: null, dano: "dia que nao existe: melhor perguntar de novo do que anotar" },
];

const sonda = path.join(__dirname, "_sonda-dia-12.mts");
fs.writeFileSync(
  sonda,
  [
    'import { dataDeRetirada } from "../lib/ia/fluxo/falas-do-cliente.ts";',
    'import { falaDaEtapa } from "../lib/ia/fluxo/pergunta.ts";',
    'import { etapaDaVez, roteiroDoPedido } from "../lib/ia/fluxo/etapas.ts";',
    "const DATAS = " + JSON.stringify(DATAS) + ";",
    "const agora = new Date(2026, 7, 31, 10, 0);",
    "const datas = DATAS.map((d) => dataDeRetirada(d.fala, agora));",
    "",
    "// A pergunta do nome, com dia e hora ja respondidos.",
    "const pedido = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[],",
    "  itens:[{ produto:'coxinha', categoria:'salgado_frito', qtd:50, unidade:'un', obs:'frango' }],",
    "  dados:{nome:null,data:'12/09/2026',hora:'18:00',pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[],",
    "};",
    "// A etapa dos DADOS, e nao a etapa da vez: o que se mede aqui e a frase",
    "// dessa pergunta, sem depender de onde a conversa esta.",
    "const etapa = roteiroDoPedido(pedido as never).find((e) => e.id === 'dados');",
    "void etapaDaVez;",
    "const fala = falaDaEtapa(etapa as never, pedido as never, 0, []);",
    "console.log(JSON.stringify({ datas, nome: { texto: fala.texto, podeReescrever: fala.podeReescrever } }));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-dia-12.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a padaria entende \"dia 12\" ==");
DATAS.forEach((d, n) => {
  const ok = saiu.datas[n] === d.espera;
  console.log(
    (ok ? "ok    " : "ERRO  ") + JSON.stringify(d.fala) +
    (ok ? "" : "  ->  leu " + JSON.stringify(saiu.datas[n]) + ", esperado " + JSON.stringify(d.espera) + "; " + d.dano),
  );
  if (!ok) erros++;
});

const nome = saiu.nome ?? {};
if (nome.texto !== "O pedido fica no nome de quem?") {
  console.log("ERRO  a pergunta do nome  ->  ficou " + JSON.stringify(nome.texto) +
    "; ela e de quem esta anotando agora, nao de quem confere um cadastro pronto");
  erros++;
} else {
  console.log("ok    a pergunta do nome esta na voz certa");
}
if (nome.podeReescrever !== false) {
  console.log("ERRO  a pergunta de dado esta liberada pra reescrita  ->  foi assim que \"O pedido fica no nome de quem?\" virou \"Qual nome está no pedido?\"");
  erros++;
} else {
  console.log("ok    a pergunta de dado nao passa pela reescrita");
}

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
