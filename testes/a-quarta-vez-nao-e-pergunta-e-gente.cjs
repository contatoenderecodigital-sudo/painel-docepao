// A QUARTA VEZ NAO E PERGUNTA, E GENTE.
//
// Medido conversando com a producao em 31/08/2026:
//
//   padaria >> Qual cor você quer para a forminha dos docinhos?
//   cliente >> 2 kg        padaria >> (a mesma pergunta)
//   cliente >> sim         padaria >> (a mesma pergunta)
//   cliente >> sim         padaria >> (a mesma pergunta)
//
// A pergunta so saia da frente quando o cliente MUDAVA alguma coisa no pedido.
// Quem responde coisa que ela nao entende ficava preso ali pra sempre, e e disso
// que o dono reclamou olhando o teste da Kemilly: "ela pediu a data 2 vzs
// seguida", "pede o nome 3 vezes".
//
// A regra da casa continua: gente e ultimo recurso. So que quatro vezes a MESMA
// pergunta, sem entender nada do que a pessoa respondeu, E o ultimo recurso.
//
// AS DUAS BORDAS QUE NAO PODEM MUDAR:
//
//   - com DUAS insistencias ela ainda pergunta sozinha, sem chamar ninguem;
//   - quando ela ENTENDEU alguma coisa do que ele disse, nao chama: ai ele esta
//     conversando, so nao sobre aquilo, e quem resolve e o adiamento da etapa.
//
// A ISCA: trocando `insistiu >= 3` por `insistiu >= 99` em `fluxo.ts`, a padaria
// volta a repetir a pergunta pra sempre.
//
// Roda com: node testes/a-quarta-vez-nao-e-pergunta-e-gente.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// A CONVERSA INTEIRA, E NAO UM TURNO FABRICADO.
//
// A primeira versao deste teste montava a `ultimaFala` a mao e o contador de
// insistencia zerava, porque a pergunta de verdade sai com a lista de cores
// colada nela. Testar o turno isolado testava a minha sonda.
//
// Aqui a conversa e encadeada: cada turno come o estado que o anterior devolveu,
// que e o que a producao faz.
const CASOS = [
  {
    nome: "quatro vezes a mesma pergunta sem entender: chama a equipe",
    falas: ["sim", "sim", "sim", "sim"],
    equipeNoFim: true,
    naoRepeteNoFim: true,
    motivoTem: "quatro vezes",
    dano: "a conversa ficava presa pra sempre e o cliente ia embora",
  },
  {
    nome: "ate a terceira ela pergunta sozinha, sem chamar ninguem",
    falas: ["sim", "sim", "sim"],
    equipeNoFim: false,
    dano: "chamar gente cedo demais entope o painel da dona",
  },
  {
    nome: "duas so, muito menos",
    falas: ["sim", "sim"],
    equipeNoFim: false,
    dano: "o caso normal de quem so demorou pra entender a pergunta",
  },
  {
    nome: "se ela ENTENDEU algo no meio, nao chama ninguem",
    falas: ["sim", "sim", "sim", "quero 100 beijinho"],
    leituraFinal: { itens: [{ produto: "beijinho", qtd: 100 }] },
    equipeNoFim: false,
    dano: "quem esta conversando, so nao sobre aquilo, nao precisa de gente",
  },
];

const sonda = path.join(__dirname, "_sonda-quarta-vez.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  let estado = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[],",
    "    itens:[{ produto:'brigadeiro', categoria:'docinho', qtd:100, unidade:'un', obs:null }],",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null,",
    "    insistiu:0, retomarEm:null, assunto:null,",
    "    etapasJaPerguntadas:['docinho'], etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  let r;",
    "  for (let n = 0; n < c.falas.length; n++) {",
    "    const ultima = n === c.falas.length - 1;",
    "    const pensar = async () => (ultima && c.leituraFinal ? c.leituraFinal : { itens: [] });",
    "    r = await responder(estado as never, { texto: c.falas[n] }, pensar as never);",
    "    estado = r.estado as never;",
    "  }",
    "  saiu.push({ equipe: !!r.precisaHumano, motivo: String(r.motivoHumano ?? ''), texto: String(r.fala.texto || '') });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-quarta-vez.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a quarta vez nao e pergunta, e gente ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  if (r.equipe !== c.equipeNoFim) {
    problemas.push(c.equipeNoFim ? "nao chamou a equipe" : "chamou a equipe sem precisar");
  }
  if (c.motivoTem && !r.motivo.toLowerCase().includes(c.motivoTem)) {
    problemas.push("o painel recebeu o motivo " + JSON.stringify(r.motivo.slice(0, 60)));
  }
  if (c.naoRepeteNoFim && r.texto.includes("forminha")) {
    problemas.push("repetiu a pergunta pela quarta vez: " + JSON.stringify(r.texto.slice(0, 60)));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
