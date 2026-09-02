// O LEMBRETE SAI UMA VEZ, E NA HORA CERTA.
//
// Pedido dele em 02/09/2026, e ele mudou de ideia no meio da tarde, pra melhor:
// primeiro foi *"avisar 10 horas antes"*, e logo depois *"não é melhor então 24
// horas antes? nos horários de funcionamento da padaria?"*.
//
// E melhor por duas razoes que o de dez nao tinha. Dez horas antes de uma
// retirada as 18:30 e as 08:30 DO MESMO DIA: quem quer mudar a hora descobre com
// o bolo ja na producao. E vinte e quatro horas caem na MESMA hora do dia, que e
// horario de padaria por construcao, enquanto o de dez caia na madrugada sozinho
// (retirada as 13:00 avisava as 03:00) e precisava de uma regra de silencio so
// pra consertar isso.
//
// MENSAGEM PRO CLIENTE NAO E ERRO DE PRECO. Errar aqui e a padaria escrevendo
// com a loja fechada, ou escrevendo duas vezes, ou "lembrando" alguem do pedido
// que ele acabou de combinar. Nao da pra medir isso em producao sem incomodar
// gente de verdade, e por isso a decisao mora numa funcao pura: aqui ela roda
// com o relogio na mao, inclusive num domingo as 14h.
//
// AS ISCAS:
//   - `HORAS_ANTES` de 24 pra 0 derruba os casos de hora;
//   - tirar o `abertaNoInstante` derruba os dois casos de padaria fechada;
//   - tirar a folga do `aprovadoEm` derruba o do pedido recem-combinado.
//
// Roda com: node testes/o-lembrete-sai-uma-vez-e-na-hora-certa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// A retirada de todos os casos, salvo quando o caso diz outra: QUINTA 10/09 as
// 18:30. Vinte e quatro horas antes disso e QUARTA 09/09 as 18:30, com a padaria
// aberta (segunda a sabado, 6h30 as 20h).
const PEDIDO = {
  id: "p1",
  telefone: "5549999990000",
  clienteNome: "Renata Souza",
  retiradaData: "2026-09-10",
  retiradaHora: "18:30",
  aprovadoEm: "2026-09-02T01:20",
  lembreteEm: null,
};

const CASOS = [
  {
    nome: "vinte e quatro horas antes, com a padaria aberta, o aviso sai",
    pedido: PEDIDO,
    agora: "2026-09-09 18:30",
    avisar: true,
    dano: "o cliente nao e lembrado, que e o pedido dele inteiro",
  },
  {
    nome: "um minuto antes das vinte e quatro horas, ainda nao",
    pedido: PEDIDO,
    agora: "2026-09-09 18:29",
    avisar: false,
    porque: "ainda nao e hora",
    dano: "avisar cedo demais e a padaria escrevendo sem motivo",
  },
  {
    nome: "avisado uma vez, nao avisa de novo",
    pedido: { ...PEDIDO, lembreteEm: "2026-09-09T18:30" },
    agora: "2026-09-10 09:00",
    avisar: false,
    porque: "ja avisado",
    dano: "a padaria mandando o mesmo lembrete a cada rodada do relogio, pra sempre",
  },
  {
    nome: "depois da hora da retirada nao se lembra mais",
    pedido: PEDIDO,
    agora: "2026-09-10 19:00",
    avisar: false,
    porque: "a retirada ja passou",
    dano: "'seu pedido fica pronto hoje as 18:30' chegando tres dias depois",
  },
  // ------------------------------------------------------------------ horario
  // "NOS HORARIOS DE FUNCIONAMENTO DA PADARIA", que foi a pergunta dele.
  //
  // O motivo nao e so nao acordar ninguem: o lembrete convida a responder ("da
  // pra buscar mais tarde?"), e responder pro vazio e pior que nao ter recebido.
  {
    // A HORA JA PASSOU E A PADARIA ESTA FECHADA.
    //
    // Acontece de verdade quando o relogio nao rodou na hora: container
    // reiniciando, deploy, ponte da impressora desligada a noite. A hora do
    // aviso (quarta 18:30) ficou pra tras, e as 21:00 a loja ja fechou.
    //
    // Sem esta guarda a primeira rodada da noite despejaria os lembretes
    // atrasados todos de uma vez, com a padaria de porta fechada.
    nome: "com a hora passada e a padaria fechada, o aviso espera",
    pedido: PEDIDO,
    agora: "2026-09-09 21:00",
    avisar: false,
    porque: "a padaria esta fechada agora",
    dano: "despejar lembrete as nove da noite, sem ninguem pra responder",
  },
  {
    nome: "e sai assim que ela abre no dia seguinte",
    pedido: PEDIDO,
    agora: "2026-09-10 06:30",
    avisar: true,
    dano: "o lembrete atrasado sumir de vez em vez de sair na abertura",
  },
  {
    // O INTERVALO DE DOMINGO, que e o unico buraco no meio do dia.
    // Retirada SEGUNDA 14/09 as 14:00 -> alvo DOMINGO 13/09 as 14:00, que cai
    // entre as 12h e as 16h, quando a padaria fecha pro almoco.
    nome: "o intervalo de domingo tambem segura o aviso",
    pedido: { ...PEDIDO, retiradaData: "2026-09-14", retiradaHora: "14:00" },
    agora: "2026-09-13 14:00",
    avisar: false,
    porque: "a padaria esta fechada agora",
    dano: "escrever no intervalo de domingo, com a loja de porta fechada",
  },
  {
    nome: "e sai as 16h, quando ela reabre",
    pedido: { ...PEDIDO, retiradaData: "2026-09-14", retiradaHora: "14:00" },
    agora: "2026-09-13 16:00",
    avisar: true,
    dano: "o domingo ficaria sem lembrete nenhum",
  },
  // ------------------------------------------------------- combinado ha pouco
  {
    nome: "quem acabou de combinar nao e lembrado no segundo seguinte",
    pedido: { ...PEDIDO, retiradaData: "2026-09-10", retiradaHora: "09:00", aprovadoEm: "2026-09-09T15:00" },
    agora: "2026-09-09 15:01",
    avisar: false,
    porque: "combinado agora ha pouco",
    dano: "lembrar o cliente de um pedido que ele combinou um minuto atras",
  },
  {
    // E A ENCOMENDA DA TARDE PRA MANHA SEGUINTE NAO FICA SEM AVISO.
    //
    // Esta e a que mais precisa dele, e com "aprovado depois da hora do aviso"
    // (a regra do desenho de 10 horas) ela ficava sem nenhum.
    nome: "mas ele recebe o aviso da noite, tres horas depois",
    pedido: { ...PEDIDO, retiradaData: "2026-09-10", retiradaHora: "09:00", aprovadoEm: "2026-09-09T15:00" },
    agora: "2026-09-09 18:00",
    avisar: true,
    dano: "quem encomenda pra amanha cedo nunca ser lembrado",
  },
  {
    nome: "sem data de retirada nao da pra avisar",
    pedido: { ...PEDIDO, retiradaData: null },
    agora: "2026-09-09 18:30",
    avisar: false,
    porque: "sem data",
    dano: "mandar 'fica pronto' sem saber quando",
  },
  {
    nome: "sem telefone nao da pra avisar",
    pedido: { ...PEDIDO, telefone: null },
    agora: "2026-09-09 18:30",
    avisar: false,
    porque: "sem telefone",
    dano: "quebrar a rodada inteira por causa de um cadastro sem numero",
  },
];

// O TEXTO tambem e medido: e o que o cliente le.
const TEXTOS = [
  {
    nome: "na vespera, ele le 'amanha'",
    pedido: PEDIDO,
    agora: "2026-09-09 18:30",
    tem: ["Renata", "amanhã", "18:30"],
    naoTem: ["Souza", "10/09"],
    dano: "'dia 10/09' faz quem le abrir o calendario; e o sobrenome nao e como gente escreve",
  },
  {
    nome: "no proprio dia, ele le 'hoje'",
    pedido: { ...PEDIDO, retiradaData: "2026-09-10", retiradaHora: "09:00", aprovadoEm: "2026-09-09T15:00" },
    agora: "2026-09-10 07:00",
    tem: ["hoje", "09:00"],
    naoTem: ["amanhã"],
    dano: "o cliente entender que e amanha e nao ir buscar hoje",
  },
];

const sonda = path.join(__dirname, "_sonda-lembrete.mts");
fs.writeFileSync(
  sonda,
  [
    'import { estaNaHora, textoDoLembrete, minutosDaParede } from "../lib/ia/lembrete.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const TEXTOS = " + JSON.stringify(TEXTOS) + ";",
    "const rel = (s) => minutosDaParede(s.slice(0, 10), s.slice(11));",
    "const decisoes = CASOS.map((c) => estaNaHora(c.pedido as never, rel(c.agora) as number));",
    "const textos = TEXTOS.map((c) => textoDoLembrete(c.pedido as never, rel(c.agora) as number, 'Doce Pão'));",
    "console.log(JSON.stringify({ decisoes, textos }));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-lembrete.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const { decisoes, textos } = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== o lembrete sai uma vez e na hora certa ==");

CASOS.forEach((c, n) => {
  const d = decisoes[n];
  const problemas = [];
  if (d.avisar !== c.avisar) {
    problemas.push(c.avisar ? "nao avisou (" + d.porque + ")" : "avisou, e nao devia");
  } else if (!c.avisar && c.porque && d.porque !== c.porque) {
    problemas.push('o motivo foi "' + d.porque + '", esperado "' + c.porque + '"');
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

TEXTOS.forEach((c, n) => {
  const t = String(textos[n] || "");
  const problemas = [];
  for (const parte of c.tem ?? []) if (!t.includes(parte)) problemas.push('nao diz "' + parte + '"');
  for (const parte of c.naoTem ?? []) if (t.includes(parte)) problemas.push('diz "' + parte + '", e nao devia');
  // Regra permanente da casa, e vale pra toda fala que sai daqui.
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t)) problemas.push("tem emoji");
  if (t.includes("—")) problemas.push("tem travessao");
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + ": " + JSON.stringify(t) + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
