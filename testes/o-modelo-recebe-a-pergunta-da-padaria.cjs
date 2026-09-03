// O MODELO RECEBE A PERGUNTA QUE A PADARIA ACABOU DE FAZER.
//
// POR QUE ISTO EXISTE
//
// Ate 03/09/2026 o modelo recebia so a frase do cliente, sem a pergunta que a
// padaria tinha acabado de fazer. Medido na conversa dele daquele dia:
//
//   padaria >> Quantas pessoas vao na festa?     (o modelo nunca viu isto)
//   cliente >> 10
//   modelo  >> 10x bolo
//   pedido  >> 10 kg de bolo 4 leites, R$ 469,00
//
// O conserto e uma linha em dois arquivos: o fluxo passa `estado.ultimaFala`
// pro `pensar`, e o `pensar-openai` poe essa fala como turno `assistant` antes
// da mensagem do cliente. Os 165 testes do portao passaram verdes com e sem o
// conserto, porque todos falsificam o `pensar` com `async () => leitura` e
// nenhum olha o que chega nele. Portao que nao ve o conserto nao protege o
// conserto: este arquivo e a isca.
//
// O QUE ELE MEDE E O QUE ELE NAO MEDE
//
//   MEDE   a fiacao: a pergunta sai do estado, atravessa o fluxo, atravessa a
//          reserva e chega na chamada do provedor como turno de conversa.
//   NAO MEDE  o que o modelo faz com ela. Isso so se mede com a chave, e o
//          `testes/mede-a-cegueira.cjs` existe pra isso.
//
// Roda com: node testes/o-modelo-recebe-a-pergunta-da-padaria.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-pergunta-da-padaria.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { pensarComOpenAI } from "../lib/ia/fluxo/pensar-openai.ts";',
    'import { pensarComReserva } from "../lib/ia/fluxo/pensar-com-reserva.ts";',
    "",
    "const PERGUNTA = 'Quantas pessoas vão na festa?';",
    "",
    "// O estado da conversa dele de 03/09/2026, no turno em que ele respondeu 10:",
    "// tres familias em aberto, festa ligada, e a pergunta das pessoas recem-feita.",
    "const DEPOIS_DA_PERGUNTA = {",
    "  ehFesta: true, pessoas: null, base: null, baseAceita: false,",
    "  itens: [",
    "    { produto: 'salgado', categoria: 'salgado_frito', qtd: 0, obs: null },",
    "    { produto: 'docinho', categoria: 'docinho', qtd: 0, obs: null },",
    "    { produto: 'bolo', categoria: 'bolo_festa', qtd: 0, obs: null },",
    "  ],",
    "  naoQuer: [], dados: { nome: null, data: null, hora: null, pagamento: null },",
    "  pecas: null, topoNome: null, topoIdade: null, tema: null, escrito: null,",
    "  forminha: null, prato: null, ofereceu: false,",
    "  ultimaFala: PERGUNTA, insistiu: 0, retomarEm: null, assunto: null,",
    "  etapasJaPerguntadas: ['quantas_pessoas'],",
    "};",
    "const PRIMEIRA_MENSAGEM = { ...DEPOIS_DA_PERGUNTA, ehFesta: false, itens: [], ultimaFala: null, etapasJaPerguntadas: [] };",
    "",
    "const saiu: Record<string, unknown> = {};",
    "",
    "// 1. O FLUXO PASSA A ULTIMA FALA PRO PENSAR.",
    "let recebido: Record<string, unknown> | null = null;",
    "const pensarQueAnota = async (args: Record<string, unknown>) => {",
    "  recebido = args;",
    "  return { pessoas: 10 };",
    "};",
    "const r1 = await responder(DEPOIS_DA_PERGUNTA as never, { texto: '10' }, pensarQueAnota as never);",
    "saiu.fluxo = {",
    "  perguntaDaPadaria: recebido ? (recebido as Record<string, unknown>).perguntaDaPadaria ?? null : 'NAO CHAMOU',",
    "  instrucaoFalaDePessoas: /QUANTAS PESSOAS/i.test(String((recebido as Record<string, unknown> | null)?.instrucao ?? '')),",
    "  pessoasNoEstado: r1.estado.pessoas,",
    "  bolosAcimaDeSeis: r1.estado.itens.filter((i: { produto: string; qtd: number }) => /bolo/i.test(i.produto) && Number(i.qtd) > 6).map((i: { produto: string; qtd: number }) => i.qtd + ' ' + i.produto),",
    "};",
    "",
    "// 1b. NA PRIMEIRA MENSAGEM NAO HA PERGUNTA, E NAO SE INVENTA UMA.",
    "recebido = null;",
    "await responder(PRIMEIRA_MENSAGEM as never, { texto: 'oi, queria um orcamento' }, pensarQueAnota as never);",
    "saiu.primeira = { perguntaDaPadaria: recebido ? (recebido as Record<string, unknown>).perguntaDaPadaria ?? null : 'NAO CHAMOU' };",
    "",
    "// 2. O PENSAR-OPENAI POE A PERGUNTA COMO TURNO DA CONVERSA, ANTES DA FRASE.",
    "let mandado: { messages?: { role: string; content: string }[] } | null = null;",
    "const clienteFalso = {",
    "  chat: { completions: { create: async (params: { messages?: { role: string; content: string }[] }) => {",
    "    mandado = params;",
    "    return {",
    "      choices: [{ message: { content: JSON.stringify({ pessoas: 10 }) } }],",
    "      usage: { prompt_tokens: 10, completion_tokens: 5 },",
    "    };",
    "  } } },",
    "};",
    "const pensar = pensarComOpenAI(clienteFalso as never, undefined, 'gpt-4.1-mini');",
    "const lido = await pensar({ instrucao: 'A etapa é QUANTAS PESSOAS.', mensagem: '10', perguntaDaPadaria: PERGUNTA });",
    "const papeis = (mandado?.messages ?? []).map((m) => m.role);",
    "const assistant = (mandado?.messages ?? []).find((m) => m.role === 'assistant');",
    "saiu.openai = { papeis, assistant: assistant?.content ?? null, lido };",
    "",
    "// 2b. SEM PERGUNTA, SEM TURNO VAZIO: a abertura continua com duas linhas.",
    "mandado = null;",
    "await pensar({ instrucao: 'A conversa está começando.', mensagem: 'oi' });",
    "saiu.openaiSemPergunta = { papeis: (mandado?.messages ?? []).map((m) => m.role) };",
    "",
    "// 3. A RESERVA PASSA A ENTRADA INTEIRA, E NAO SO A FRASE.",
    "mandado = null;",
    "const comReserva = pensarComReserva(clienteFalso as never, undefined, 'gpt-4.1-mini', { modelo: 'reserva-de-teste', url: 'https://api.anthropic.com/v1/' });",
    "await comReserva({ instrucao: 'A etapa é QUANTAS PESSOAS.', mensagem: '10', perguntaDaPadaria: PERGUNTA });",
    "saiu.reserva = { assistant: (mandado?.messages ?? []).find((m) => m.role === 'assistant')?.content ?? null };",
    "",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pergunta-da-padaria.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, ok, detalhe) => {
  if (ok) {
    console.log("ok    " + rotulo);
    return;
  }
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo);
  if (detalhe) console.log("        " + detalhe);
};

console.log("== o modelo recebe a pergunta da padaria ==");

const PERGUNTA = "Quantas pessoas vão na festa?";

cobra(
  "o fluxo passa a ultima fala da padaria pro pensar",
  r.fluxo.perguntaDaPadaria === PERGUNTA,
  "chegou: " + JSON.stringify(r.fluxo.perguntaDaPadaria),
);
cobra(
  "depois de perguntar as pessoas, a instrucao que vai e a das pessoas, nao a do bolo",
  r.fluxo.instrucaoFalaDePessoas === true,
  "a etapa recem-perguntada foi pulada; o 10 seria lido com a instrucao de outra etapa",
);
cobra(
  "o 10 lido como pessoas entra como pessoas, e nenhum bolo passa de 6 kg",
  r.fluxo.pessoasNoEstado === 10 && r.fluxo.bolosAcimaDeSeis.length === 0,
  "pessoas=" + JSON.stringify(r.fluxo.pessoasNoEstado) + " bolos=" + JSON.stringify(r.fluxo.bolosAcimaDeSeis),
);
cobra(
  "na primeira mensagem nao ha pergunta, e nenhuma e inventada",
  r.primeira.perguntaDaPadaria === null || r.primeira.perguntaDaPadaria === undefined,
  "chegou: " + JSON.stringify(r.primeira.perguntaDaPadaria),
);
cobra(
  "o pensar-openai manda system, assistant e user, nesta ordem",
  JSON.stringify(r.openai.papeis) === JSON.stringify(["system", "assistant", "user"]),
  "papeis: " + JSON.stringify(r.openai.papeis),
);
cobra(
  "o turno assistant e a pergunta da padaria, palavra por palavra",
  r.openai.assistant === PERGUNTA,
  "assistant: " + JSON.stringify(r.openai.assistant),
);
cobra(
  "a resposta do modelo continua sendo lida (pessoas: 10)",
  r.openai.lido && r.openai.lido.pessoas === 10,
  JSON.stringify(r.openai.lido),
);
cobra(
  "sem pergunta, vao so system e user: nao entra turno vazio",
  JSON.stringify(r.openaiSemPergunta.papeis) === JSON.stringify(["system", "user"]),
  "papeis: " + JSON.stringify(r.openaiSemPergunta.papeis),
);
cobra(
  "a reserva repassa a pergunta inteira pro provedor",
  r.reserva.assistant === PERGUNTA,
  "assistant: " + JSON.stringify(r.reserva.assistant),
);

console.log("");
if (falhas.length) {
  console.log("REPROVOU EM " + falhas.length);
  process.exit(1);
}
console.log("PASSOU");
