// PEDIDO APROVADO NAO VOLTA PRA FILA.
//
// Medido na conversa dele de 02/09/2026, e foi a unica coisa que ele apontou no
// teste que rodou bem:
//
//   01:20  equipe  >> A nossa equipe confirmou o seu pedido. Fica pra 10/09.
//   01:26  cliente >> Ok, obrigada!
//   01:26  padaria >> Pronto, seu pedido foi pra fila da equipe da padaria.
//                     Assim que eles confirmarem, eu te aviso por aqui.
//                     _O topo entra a parte..._
//
// Ela repetiu a fala de FECHAMENTO num pedido que ja estava confirmado e indo
// pra producao. Quem le entende que o pedido voltou pra fila, e liga na padaria
// pra perguntar o que aconteceu.
//
// A conversa nao sabia que o pedido tinha saido da fila: o pedido vive na tabela
// `pedidos` e quem o aprova e a equipe, no painel. Agora ele chega no fluxo a
// cada mensagem, junto do pedido em aberto.
//
// E QUEM QUER MUDAR VAI PRA EQUIPE, e nao pro rascunho: com o pedido aprovado a
// cozinha ja esta com aquilo na mao, e mexer sozinha seria a IA decidindo
// producao. Vale a mesma regra de sempre: a IA nunca confirma pedido.
//
// Roda com: node testes/pedido-aprovado-nao-volta-pra-fila.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const APROVADO = { data: "10/09/2026", hora: "18:30", totalCentavos: 51680 };

const CASOS = [
  {
    nome: "o obrigado depois do aprovado nao reabre o fechamento",
    aprovado: APROVADO,
    fala: "Ok, obrigada!",
    naoTem: ["fila da equipe", "topo entra à parte", "Fechando o pedido"],
    tem: ["confirmado"],
    equipe: false,
    dano: "o cliente le que o pedido voltou pra fila e liga na padaria",
  },
  {
    nome: "e ela lembra pra quando e",
    aprovado: APROVADO,
    fala: "valeu",
    tem: ["10/09/2026", "18:30"],
    equipe: false,
    dano: "confirmar sem dizer quando deixa o cliente sem a informacao que importa",
  },
  {
    nome: "quem quer mudar pedido aprovado vai pra equipe",
    aprovado: APROVADO,
    fala: "queria trocar o sabor do bolo",
    // O modelo, vendo a conversa, devolve o que ele quer mexer (medido 3 de 3
    // em 03/09/2026). As duas listas de palavras que decidiam isto antes do
    // modelo sairam.
    leitura: { itens: [{ produto: "bolo prestígio", qtd: 0 }] },
    tem: ["equipe"],
    equipe: true,
    dano: "a cozinha ja esta com o pedido; mexer sozinha e a IA decidindo producao",
  },
  {
    nome: "sem pedido aprovado, tudo segue como antes",
    aprovado: null,
    fala: "Ok, obrigada!",
    naoTem: ["confirmado pra 10/09"],
    equipe: false,
    dano: "a conversa normal nao pode mudar por causa desta regra",
  },
  // ------------------------------------------------------------------
  // O CLIENTE QUE VOLTA PERTO DA DATA.
  //
  // Segunda parte do pedido dele de 02/09/2026: *"ela vai ver que aquele
  // cliente ja fez algum pedido, ela olha a base dele e ve que ele tem aquele
  // pedido para tal dia, dai ela pergunta se e sobre o pedido ou se e outra
  // coisa"*.
  //
  // Quando o pedido e registrado o rascunho e limpo, entao a mensagem seguinte
  // dele chega com a conversa do zero e cai na ABERTURA. Medido: as quatro
  // falas abaixo caem todas ali, escreva ele o que escrever. Por isso a decisao
  // mora na abertura e nao numa lista de palavras: quem manda e o pedido que
  // existe no banco, e nao o jeito que ele falou.
  {
    nome: "quem volta com pedido confirmado ouve dele na abertura",
    aprovado: APROVADO,
    jaPerguntadas: [],
    ultima: null,
    fala: "oi",
    tem: ["10/09/2026", "18:30", "outra coisa"],
    naoTem: ["O que você precisa"],
    equipe: false,
    dano: "quem liga na vespera da festa ouve 'o que voce precisa?' e acha que ninguem anotou nada",
  },
  {
    nome: "e ele nao precisa citar o pedido pra ser entendido",
    aprovado: APROVADO,
    jaPerguntadas: [],
    ultima: null,
    fala: "que horas eu busco mesmo",
    tem: ["18:30"],
    equipe: false,
    dano: "obrigar o cliente a escrever a palavra certa pra ser atendido",
  },
  {
    nome: "sem pedido aprovado, a abertura continua a de sempre",
    aprovado: null,
    jaPerguntadas: [],
    ultima: null,
    fala: "oi",
    tem: ["O que você precisa"],
    naoTem: ["pedido confirmado"],
    equipe: false,
    dano: "falar de pedido pra quem nunca pediu nada",
  },
];

const sonda = path.join(__dirname, "_sonda-aprovado.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:[],",
    "    dados:{nome:'Renata',data:'10/09/2026',hora:'18:30',pagamento:'pix'},",
    "    pecas:null, topoNome:null, topoIdade:null, tema:null, forminha:null, prato:null,",
    "    ultimaFala: c.ultima === undefined ? 'A nossa equipe confirmou o seu pedido.' : c.ultima,",
    "    insistiu:0, retomarEm:null,",
    "    assunto:null, etapasJaPerguntadas: c.jaPerguntadas ?? ['abertura','dados','confirmacao'],",
    "    etapasAdiadas:[], pecasMandadas:[], pedidoAprovado: c.aprovado,",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, (async () => (c.leitura ?? { itens: [] })) as never);",
    "  saiu.push({ texto: String(r.fala.texto || ''), equipe: !!r.precisaHumano, motivo: String(r.motivoHumano ?? '') });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-aprovado.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== pedido aprovado nao volta pra fila ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const baixo = r.texto.toLowerCase();
  const problemas = [];
  for (const parte of c.tem ?? []) {
    if (!baixo.includes(parte.toLowerCase())) {
      problemas.push('nao diz "' + parte + '": ' + JSON.stringify(r.texto.slice(0, 70)));
    }
  }
  for (const parte of c.naoTem ?? []) {
    if (baixo.includes(parte.toLowerCase())) problemas.push('diz "' + parte + '", e nao devia');
  }
  if (r.equipe !== c.equipe) {
    problemas.push(c.equipe ? "nao chamou a equipe" : "chamou a equipe sem precisar");
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
