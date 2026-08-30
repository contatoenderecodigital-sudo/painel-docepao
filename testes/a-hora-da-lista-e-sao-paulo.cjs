// A HORA DA LISTA DE CONVERSA E A HORA DE CHAPECO, RELÓGIO DE 24 HORAS.
//
// POR QUE ISTO EXISTE
//
// Na madrugada de 30/08/2026 a dona abriu o painel (~3h em America/Sao_Paulo)
// e a lista de atendimentos mostrava 15:34-15:47 em threads "QA Automatizado"
// com "Precisa de você". Duas coisas diferentes se misturam nesse numero:
//
//   1. o relógio da LISTA, que tem que ser o da padaria
//   2. de QUEM e aquela conversa
//
// O caminho da hora na lista (nao e o navegador):
//
//   GET /api/conversas
//     -> carregarConversas
//     -> listarConversas (lib/banco/atendimentos.ts)
//     -> to_char(criado_em at time zone America/Sao_Paulo, HH24:MI)
//     -> Conversa.ultimaHora
//     -> components/Atendimentos.tsx imprime o texto
//
// O Postgres ja convertia. O furo era o relógio LOCAL da tela (envio otimista
// e o selo Hoje/Ontem) usando getHours()/getFullYear() do processo, que no
// container e UTC. E um Intl sem hour12:false, que em en-US transforma 15:47
// em "03:47 PM" e, se alguém ficar só com o número, 3 da tarde vira 3 da manhã
// ou o contrário: 03:00 da madrugada vira 15:00.
//
// O NOME NA LISTA
//
// "QA Automatizado" NÃO sai do /api/testar-ia. A tela de teste grava o cliente
// como "Cliente de teste (painel)" e, de propósito, NÃO escreve a conversa na
// lista. O nome QA Automatizado e o profile do testes/webhook-simulado.cjs,
// que simula o webhook da Meta e GRAVA mensagem de verdade. 15:xx com o fuso
// certo e fim de tarde em Chapecó (18:xx UTC), QA de outro horário, não o
// teste das 4h-6h UTC (1h-3h em São Paulo).
//
// O QUE ELE COBRA
//
//   1. um instante UTC que é 03:00 em São Paulo NÃO pode renderizar 15:00
//   2. o mesmo instante à tarde (15:47 em São Paulo) continua 15:47, 24h
//   3. a lista, o aviso e o "hoje" da produção usam horaNaPadaria/dataNaPadaria
//   4. o SQL da lista ainda pede HH24 no fuso da padaria
//
// Roda com: node testes/a-hora-da-lista-e-sao-paulo.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-hora-padaria.mjs");

fs.writeFileSync(
  sonda,
  [
    "import { horaNaPadaria, dataNaPadaria, rotuloDiaNaPadaria, TZ_PADARIA } from '../lib/fuso-padaria.ts';",
    "import { horaBR } from '../lib/aviso.ts';",
    "",
    "const madrugada = new Date('2026-08-30T06:00:00.000Z');",
    "const tarde = new Date('2026-08-30T18:47:00.000Z');",
    "const virada = new Date('2026-08-31T02:30:00.000Z');",
    "",
    "console.log(JSON.stringify({",
    "  tz: TZ_PADARIA,",
    "  horaMadrugada: horaNaPadaria(madrugada),",
    "  dataMadrugada: dataNaPadaria(madrugada),",
    "  horaTarde: horaNaPadaria(tarde),",
    "  horaBRTarde: horaBR(tarde.toISOString()),",
    "  horaBRMadrugada: horaBR(madrugada.toISOString()),",
    "  rotuloHoje: rotuloDiaNaPadaria('2026-08-30', madrugada),",
    "  rotuloOntem: rotuloDiaNaPadaria('2026-08-29', madrugada),",
    "  rotuloOutro: rotuloDiaNaPadaria('2026-08-28', madrugada),",
    "  dataAntesDaViradaUtc: dataNaPadaria(virada),",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-hora-padaria.mjs"], {
    cwd: __dirname,
    encoding: "utf8",
    timeout: 180000,
    shell: process.platform === "win32",
    env: { ...process.env, TZ: "UTC" },
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
const erros = [];

if (r.tz !== "America/Sao_Paulo") erros.push("TZ_PADARIA saiu " + r.tz);
if (r.horaMadrugada !== "03:00") erros.push("03:00 em SP saiu " + r.horaMadrugada);
if (r.horaMadrugada === "15:00") erros.push("03:00 em SP virou 15:00 (relogio de 12h ou fuso errado)");
if (r.dataMadrugada !== "2026-08-30") erros.push("data da madrugada saiu " + r.dataMadrugada);
if (r.horaTarde !== "15:47") erros.push("15:47 em SP saiu " + r.horaTarde);
if (r.horaBRMadrugada !== "03:00") erros.push("horaBR da madrugada saiu " + r.horaBRMadrugada);
if (r.horaBRTarde !== "15:47") erros.push("horaBR da tarde saiu " + r.horaBRTarde);
if (r.rotuloHoje !== "Hoje") erros.push("rotulo hoje saiu " + r.rotuloHoje);
if (r.rotuloOntem !== "Ontem") erros.push("rotulo ontem saiu " + r.rotuloOntem);
if (r.rotuloOutro !== "28/08/2026") erros.push("rotulo outro dia saiu " + r.rotuloOutro);
if (r.dataAntesDaViradaUtc !== "2026-08-30") {
  erros.push("02:30 UTC ainda e 30/08 em SP, saiu " + r.dataAntesDaViradaUtc);
}

function fonte(rel) {
  return fs.readFileSync(path.join(raiz, ...rel.split("/")), "utf8");
}

const lista = fonte("components/Atendimentos.tsx");
if (!lista.includes("horaNaPadaria") || !lista.includes("dataNaPadaria") || !lista.includes("rotuloDiaNaPadaria")) {
  erros.push("Atendimentos.tsx deixou de usar o relogio da padaria");
}
if (/getHours\s*\(/.test(lista) || /getFullYear\s*\(/.test(lista)) {
  erros.push("Atendimentos.tsx voltou a ler a hora/data do processo, nao da padaria");
}
if (!lista.includes("ultimaHora")) {
  erros.push("a lista nao imprime ultimaHora");
}

const sql = fonte("lib/banco/atendimentos.ts");
if (!sql.includes("TZ_PADARIA")) erros.push("listarConversas nao usa TZ_PADARIA");
if (!sql.includes("HH24:MI")) erros.push("listarConversas nao formata HH24 (relogio 24h)");
if (!sql.includes("ultimaHora")) erros.push("listarConversas nao preenche ultimaHora");

const producao = fonte("components/PedidosDoDia.tsx");
if (!producao.includes("dataNaPadaria")) {
  erros.push("PedidosDoDia deixou o hoje da producao fora do relogio unico");
}

const webhook = fonte("testes/webhook-simulado.cjs");
if (!webhook.includes("QA Automatizado")) {
  erros.push("webhook-simulado deixou de nomear o contato QA Automatizado");
}
const testar = fonte("app/api/testar-ia/route.ts");
if (!testar.includes("Cliente de teste (painel)")) {
  erros.push("testar-ia deixou de nomear o cliente sintetico");
}
if (!/NÃO grava a conversa no banco/i.test(testar) && !/NAO grava a conversa no banco/i.test(testar)) {
  erros.push("testar-ia deixou de dizer que nao grava conversa na lista");
}

if (erros.length) {
  console.error("FALHOU: a hora da lista nao e a da padaria");
  for (const e of erros) console.error("  - " + e);
  process.exit(1);
}

console.log("ok: 03:00 em Sao Paulo nao vira 15:00; 15:47 UTC-3 continua 15:47");
console.log("ok: lista, aviso, producao e SQL usam o mesmo fuso");
console.log("ok: QA Automatizado e o webhook simulado, nao o /testar-ia");
