// O LEMBRETE SAI UMA VEZ, E NA HORA CERTA.
//
// Pedido dele em 02/09/2026: *"colocar um tempo ali de avisar 10 horas antes do
// horário que eles agendaram para buscar o produto deles"*.
//
// MENSAGEM PRO CLIENTE NAO E ERRO DE PRECO. Errar aqui e a padaria escrevendo
// as tres da manha, ou escrevendo duas vezes, ou "lembrando" alguem do pedido
// que ele acabou de combinar. Nao da pra medir isso em producao sem incomodar
// gente de verdade, e por isso a decisao mora numa funcao pura: aqui ela roda
// mil vezes de graca, com o relogio na mao.
//
// A ISCA: trocando o `HORAS_ANTES` de 10 pra 0 em `lib/ia/lembrete.ts`, os casos
// de hora ficam vermelhos; apagando a guarda do `aprovadoEm`, o caso do pedido
// recem-aprovado fica.
//
// Roda com: node testes/o-lembrete-sai-uma-vez-e-na-hora-certa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// A retirada de todos os casos, salvo quando o caso diz outra: 10/09 as 18:30.
// Dez horas antes disso e 08:30 do mesmo dia, que esta fora da madrugada.
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
    nome: "as 08:30 do dia, dez horas antes, o aviso sai",
    pedido: PEDIDO,
    agora: "2026-09-10 08:30",
    avisar: true,
    dano: "o cliente nao e lembrado, que e o pedido dele inteiro",
  },
  {
    nome: "um minuto antes das dez horas, ainda nao",
    pedido: PEDIDO,
    agora: "2026-09-10 08:29",
    avisar: false,
    porque: "ainda nao e hora",
    dano: "avisar cedo demais e a padaria escrevendo sem motivo",
  },
  {
    nome: "avisado uma vez, nao avisa de novo",
    pedido: { ...PEDIDO, lembreteEm: "2026-09-10T08:30" },
    agora: "2026-09-10 12:00",
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
  {
    // A MADRUGADA. Retirada as 13:00 daria aviso as 03:00.
    nome: "retirada as 13:00 avisa as 21:00 da vespera, e nao as 03:00",
    pedido: { ...PEDIDO, retiradaHora: "13:00" },
    agora: "2026-09-09 21:00",
    avisar: true,
    dano: "a padaria escrevendo as tres da manha e acordando o cliente",
  },
  {
    nome: "e as 03:00 dessa mesma retirada nao sai nada de novo",
    pedido: { ...PEDIDO, retiradaHora: "13:00", lembreteEm: "2026-09-09T21:00" },
    agora: "2026-09-10 03:00",
    avisar: false,
    porque: "ja avisado",
    dano: "o aviso antecipado nao pode virar dois avisos",
  },
  {
    // QUEM ACABOU DE COMBINAR NAO PRECISA SER LEMBRADO.
    nome: "pedido aprovado depois da hora do aviso nao gera lembrete",
    pedido: { ...PEDIDO, retiradaData: "2026-09-10", retiradaHora: "12:00", aprovadoEm: "2026-09-10T09:00" },
    agora: "2026-09-10 09:01",
    avisar: false,
    porque: "aprovado depois da hora do aviso",
    dano: "lembrar o cliente de um pedido que ele combinou um minuto atras",
  },
  {
    nome: "sem data de retirada nao da pra avisar",
    pedido: { ...PEDIDO, retiradaData: null },
    agora: "2026-09-10 08:30",
    avisar: false,
    porque: "sem data",
    dano: "mandar 'fica pronto' sem saber quando",
  },
  {
    nome: "sem telefone nao da pra avisar",
    pedido: { ...PEDIDO, telefone: null },
    agora: "2026-09-10 08:30",
    avisar: false,
    porque: "sem telefone",
    dano: "quebrar a rodada inteira por causa de um cadastro sem numero",
  },
];

// O TEXTO tambem e medido: e o que o cliente le.
const TEXTOS = [
  {
    nome: "no dia, ele le 'hoje'",
    pedido: PEDIDO,
    agora: "2026-09-10 08:30",
    tem: ["Renata", "hoje", "18:30"],
    naoTem: ["Souza", "10/09"],
    dano: "'dia 10/09' faz quem le abrir o calendario; e o sobrenome nao e como gente escreve",
  },
  {
    nome: "na vespera, ele le 'amanha'",
    pedido: { ...PEDIDO, retiradaHora: "13:00" },
    agora: "2026-09-09 21:00",
    tem: ["amanhã", "13:00"],
    dano: "o cliente entender que e hoje e ir na padaria no dia errado",
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
