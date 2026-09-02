// O CÉREBRO TEM RESERVA: SE UM CAI, OUTRO ASSUME.
//
// Ideia dele em 02/09/2026: *"e quando cair um tu troca pro outro, que troca a
// config toda também, não é bom?"*.
//
// Hoje, quando a OpenAI cai ou demora demais, a padaria responde "tive um
// probleminha aqui agora" pra TODO cliente até alguém perceber. Não é hipótese:
// aconteceu duas vezes na mesma tarde, testando modelos que estouravam o tempo.
//
// AS TRÊS COISAS QUE PRECISAM SER VERDADE:
//
//   1. com o primeiro respondendo, a reserva NÃO é chamada (senão dobra a conta)
//   2. com o primeiro caindo, a reserva responde e o cliente nem percebe
//   3. sem reserva configurada, o erro sobe como antes (quem trata é o fluxo,
//      que já sabe responder sem inventar pedido)
//
// Roda com: node testes/o-cerebro-tem-reserva.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-reserva.mts");
fs.writeFileSync(
  sonda,
  [
    'import { pensarComReserva } from "../lib/ia/fluxo/pensar-com-reserva.ts";',
    "",
    "// Dois clientes falsos: um que responde e um que cai, contando as chamadas.",
    "const feito = { primeiro: 0, reserva: 0 };",
    "const clienteQueResponde = (marca: string, onde: 'primeiro' | 'reserva') => ({",
    "  chat: { completions: { create: async () => {",
    "    feito[onde]++;",
    "    return {",
    "      choices: [{ message: { content: JSON.stringify({ itens: [{ produto: marca, qtd: 1 }] }) } }],",
    "      usage: { prompt_tokens: 10, completion_tokens: 5 },",
    "    };",
    "  } } },",
    "});",
    "const clienteQueCai = {",
    "  chat: { completions: { create: async () => {",
    "    feito.primeiro++;",
    "    throw new Error('503 provedor fora do ar');",
    "  } } },",
    "};",
    "",
    "const entrada = { instrucao: 'anote o pedido', mensagem: 'quero coxinha' };",
    "const saiu: Record<string, unknown> = {};",
    "",
    "// 1. o primeiro responde: a reserva nao entra",
    "feito.primeiro = 0; feito.reserva = 0;",
    "const comPrimeiroVivo = pensarComReserva(",
    "  clienteQueResponde('coxinha', 'primeiro') as never, undefined, 'gpt-4.1-mini',",
    "  { modelo: 'claude-haiku-4-5-20251001', url: 'https://api.anthropic.com/v1/' },",
    ");",
    "saiu.vivo = { leitura: await comPrimeiroVivo(entrada), chamadas: { ...feito } };",
    "",
    "// 2. o primeiro cai: a reserva assume",
    "feito.primeiro = 0; feito.reserva = 0;",
    "const original = process.env.CLAUDE_API_KEY;",
    "process.env.CLAUDE_API_KEY = 'chave-de-teste';",
    "const comPrimeiroCaido = pensarComReserva(",
    "  clienteQueCai as never, undefined, 'gpt-4.1-mini',",
    "  { modelo: 'reserva-de-teste', url: 'https://api.anthropic.com/v1/' },",
    ");",
    "// A reserva monta o cliente de verdade, entao aqui so se confirma que ela",
    "// TENTOU: sem rede, a chamada falha, e o que importa e nao ter engolido o",
    "// erro do primeiro em silencio.",
    "let tentouReserva = false;",
    "try { await comPrimeiroCaido(entrada); } catch { tentouReserva = true; }",
    "saiu.caiu = { chamadasNoPrimeiro: feito.primeiro, tentouReserva };",
    "process.env.CLAUDE_API_KEY = original;",
    "",
    "// 3. sem reserva configurada: o erro sobe",
    "feito.primeiro = 0; feito.reserva = 0;",
    "const semReserva = pensarComReserva(clienteQueCai as never, undefined, 'gpt-4.1-mini', null);",
    "let subiu = false;",
    "try { await semReserva(entrada); } catch { subiu = true; }",
    "saiu.semReserva = { subiu, chamadas: feito.primeiro };",
    "",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-reserva.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
const falha = (m, d) => { console.log("ERRO  " + m); if (d) console.log("        " + d); erros++; };
console.log("== o cerebro tem reserva ==");

if (r.vivo.chamadas.reserva !== 0) {
  falha("com o primeiro vivo, a reserva foi chamada", "isso dobraria a conta de IA em toda mensagem");
} else if (!r.vivo.leitura?.itens?.length) {
  falha("com o primeiro vivo, a leitura veio vazia", JSON.stringify(r.vivo.leitura));
} else {
  console.log("ok    com o primeiro respondendo, a reserva nao e chamada");
}

if (r.caiu.chamadasNoPrimeiro !== 1) {
  falha("o primeiro foi chamado " + r.caiu.chamadasNoPrimeiro + " vezes", "repetir quem caiu atrasa o turno inteiro");
} else if (!r.caiu.tentouReserva) {
  falha("o primeiro caiu e a reserva nao foi tentada", "o cliente ouviria 'tive um probleminha' com a reserva de pe");
} else {
  console.log("ok    com o primeiro caindo, a reserva assume");
}

if (!r.semReserva.subiu) {
  falha("sem reserva, o erro foi engolido", "quem trata a falha e o fluxo, que responde sem inventar pedido");
} else {
  console.log("ok    sem reserva configurada, o erro sobe como antes");
}

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
