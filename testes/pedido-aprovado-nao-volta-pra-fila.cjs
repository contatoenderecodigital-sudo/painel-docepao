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
    "    ultimaFala:'A nossa equipe confirmou o seu pedido.', insistiu:0, retomarEm:null,",
    "    assunto:null, etapasJaPerguntadas:['abertura','dados','confirmacao'],",
    "    etapasAdiadas:[], pecasMandadas:[], pedidoAprovado: c.aprovado,",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, (async () => ({ itens: [] })) as never);",
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
