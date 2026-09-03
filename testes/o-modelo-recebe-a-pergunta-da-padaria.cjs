// O MODELO RECEBE A CONVERSA E O PEDIDO ANOTADO.
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
// Primeiro conserto: a ultima fala da padaria como turno `assistant` (medido
// 5 de 5 com `mede-a-cegueira.cjs`). Segundo, no mesmo dia: a conversa recente
// inteira, lida do banco (`ultimasMensagens`), mais o que ja esta anotado no
// pedido como lembrete depois dela. Os 165 testes do portao passaram verdes
// com e sem o conserto, porque todos falsificam o `pensar` com
// `async () => leitura` e nenhum olha o que chega nele. Portao que nao ve o
// conserto nao protege o conserto: este arquivo e a isca.
//
// O QUE ELE MEDE E O QUE ELE NAO MEDE
//
//   MEDE   a fiacao: o historico e o anotado saem do fluxo, atravessam a
//          reserva e chegam na chamada do provedor como turnos de conversa.
//   NAO MEDE  o que o modelo faz com isso. Isso so se mede com a chave, e o
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
    "const HISTORICO = [",
    "  { papel: 'user', conteudo: 'gostaria de fazer pedido de docinhos salgados e bolo' },",
    "  { papel: 'assistant', conteudo: PERGUNTA },",
    "];",
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
    "// 1. O FLUXO PASSA O HISTORICO E O ANOTADO PRO PENSAR.",
    "let recebido: Record<string, unknown> | null = null;",
    "const pensarQueAnota = async (args: Record<string, unknown>) => {",
    "  recebido = args;",
    "  return { pessoas: 10 };",
    "};",
    "const r1 = await responder(DEPOIS_DA_PERGUNTA as never, { texto: '10' }, pensarQueAnota as never, null, HISTORICO as never);",
    "saiu.fluxo = {",
    "  historico: recebido ? (recebido as Record<string, unknown>).historico ?? null : 'NAO CHAMOU',",
    "  anotado: recebido ? (recebido as Record<string, unknown>).anotado ?? null : 'NAO CHAMOU',",
    "  instrucaoFalaDePessoas: /QUANTAS PESSOAS/i.test(String((recebido as Record<string, unknown> | null)?.instrucao ?? '')),",
    "  instrucaoTemCardapioInteiro: /docinho/i.test(String((recebido as Record<string, unknown> | null)?.instrucao ?? '')) && /pizza/i.test(String((recebido as Record<string, unknown> | null)?.instrucao ?? '')),",
    "  instrucaoMandaCalar: /em vez de anotar/i.test(String((recebido as Record<string, unknown> | null)?.instrucao ?? '')),",
    "  pessoasNoEstado: r1.estado.pessoas,",
    "  bolosAcimaDeSeis: r1.estado.itens.filter((i: { produto: string; qtd: number }) => /bolo/i.test(i.produto) && Number(i.qtd) > 6).map((i: { produto: string; qtd: number }) => i.qtd + ' ' + i.produto),",
    "};",
    "",
    "// 1b. SEM HISTORICO (os testes), A ULTIMA FALA DA PADARIA FAZ AS VEZES DELE.",
    "recebido = null;",
    "await responder(DEPOIS_DA_PERGUNTA as never, { texto: '10' }, pensarQueAnota as never);",
    "saiu.semHistorico = { historico: recebido ? (recebido as Record<string, unknown>).historico ?? null : 'NAO CHAMOU' };",
    "",
    "// 1c. NA PRIMEIRA MENSAGEM NAO HA CONVERSA NEM PEDIDO, E NAO SE INVENTA.",
    "recebido = null;",
    "await responder(PRIMEIRA_MENSAGEM as never, { texto: 'oi, queria um orcamento' }, pensarQueAnota as never);",
    "saiu.primeira = {",
    "  historico: recebido ? (recebido as Record<string, unknown>).historico ?? null : 'NAO CHAMOU',",
    "  anotado: recebido ? (recebido as Record<string, unknown>).anotado ?? null : 'NAO CHAMOU',",
    "};",
    "",
    "// 2. O PENSAR-OPENAI POE A CONVERSA COMO TURNOS, E O ANOTADO DEPOIS DELA.",
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
    "const lido = await pensar({ instrucao: 'A etapa é QUANTAS PESSOAS.', mensagem: '10', historico: HISTORICO as never, anotado: 'Já está anotado no pedido. é festa.' });",
    "const msgs = mandado?.messages ?? [];",
    "saiu.openai = {",
    "  papeis: msgs.map((m) => m.role),",
    "  assistant: msgs.find((m) => m.role === 'assistant')?.content ?? null,",
    "  anotadoDepoisDoHistorico: msgs.length >= 2 && msgs[msgs.length - 2].role === 'system' && /anotado/i.test(msgs[msgs.length - 2].content),",
    "  ultimaEhOCliente: msgs[msgs.length - 1]?.role === 'user' && msgs[msgs.length - 1]?.content === '10',",
    "  lido,",
    "};",
    "",
    "// 2b. SEM CONVERSA E SEM ANOTADO, VAO SO SYSTEM E USER: nada de turno vazio.",
    "mandado = null;",
    "await pensar({ instrucao: 'A conversa está começando.', mensagem: 'oi', historico: [], anotado: null });",
    "saiu.openaiSemConversa = { papeis: (mandado?.messages ?? []).map((m) => m.role) };",
    "",
    "// 3. A RESERVA PASSA A ENTRADA INTEIRA, E NAO SO A FRASE.",
    "mandado = null;",
    "const comReserva = pensarComReserva(clienteFalso as never, undefined, 'gpt-4.1-mini', { modelo: 'reserva-de-teste', url: 'https://api.anthropic.com/v1/' });",
    "await comReserva({ instrucao: 'A etapa é QUANTAS PESSOAS.', mensagem: '10', historico: HISTORICO as never });",
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

console.log("== o modelo recebe a conversa e o pedido anotado ==");

const PERGUNTA = "Quantas pessoas vão na festa?";

cobra(
  "o fluxo passa o historico que recebeu pro pensar, inteiro",
  Array.isArray(r.fluxo.historico) && r.fluxo.historico.length === 2 && r.fluxo.historico[1].conteudo === PERGUNTA,
  "chegou: " + JSON.stringify(r.fluxo.historico),
);
cobra(
  "o fluxo passa o que ja esta anotado (as tres familias em aberto e a festa)",
  typeof r.fluxo.anotado === "string" && /salgado/.test(r.fluxo.anotado) && /bolo/.test(r.fluxo.anotado) && /festa/.test(r.fluxo.anotado),
  "chegou: " + JSON.stringify(r.fluxo.anotado),
);
cobra(
  "depois de perguntar as pessoas, a instrucao que vai e a das pessoas, nao a do bolo",
  r.fluxo.instrucaoFalaDePessoas === true,
  "a etapa recem-perguntada foi pulada; o 10 seria lido com a instrucao de outra etapa",
);
cobra(
  "a instrucao leva o cardapio inteiro (docinho E pizza numa etapa que nao e de nenhum dos dois)",
  r.fluxo.instrucaoTemCardapioInteiro === true,
  "o vocabulario continua filtrado por etapa",
);
cobra(
  "a instrucao nao manda mais o modelo calar sobre outra familia",
  r.fluxo.instrucaoMandaCalar === false,
  "ainda existe 'em vez de anotar' na instrucao",
);
cobra(
  "o 10 lido como pessoas entra como pessoas, e nenhum bolo passa de 6 kg",
  r.fluxo.pessoasNoEstado === 10 && r.fluxo.bolosAcimaDeSeis.length === 0,
  "pessoas=" + JSON.stringify(r.fluxo.pessoasNoEstado) + " bolos=" + JSON.stringify(r.fluxo.bolosAcimaDeSeis),
);
cobra(
  "sem historico, a ultima fala da padaria vira o unico turno assistant",
  Array.isArray(r.semHistorico.historico) && r.semHistorico.historico.length === 1 && r.semHistorico.historico[0].conteudo === PERGUNTA,
  "chegou: " + JSON.stringify(r.semHistorico.historico),
);
cobra(
  "na primeira mensagem nao ha conversa nem anotado, e nada e inventado",
  Array.isArray(r.primeira.historico) && r.primeira.historico.length === 0 && (r.primeira.anotado === null || r.primeira.anotado === undefined),
  "chegou: " + JSON.stringify(r.primeira),
);
cobra(
  "o pensar-openai manda system, user, assistant, system (anotado) e user, nesta ordem",
  JSON.stringify(r.openai.papeis) === JSON.stringify(["system", "user", "assistant", "system", "user"]),
  "papeis: " + JSON.stringify(r.openai.papeis),
);
cobra(
  "o turno assistant e a pergunta da padaria, palavra por palavra",
  r.openai.assistant === PERGUNTA,
  "assistant: " + JSON.stringify(r.openai.assistant),
);
cobra(
  "o anotado vai DEPOIS do historico e ANTES da frase do cliente",
  r.openai.anotadoDepoisDoHistorico === true && r.openai.ultimaEhOCliente === true,
  JSON.stringify(r.openai.papeis),
);
cobra(
  "a resposta do modelo continua sendo lida (pessoas: 10)",
  r.openai.lido && r.openai.lido.pessoas === 10,
  JSON.stringify(r.openai.lido),
);
cobra(
  "sem conversa e sem anotado, vao so system e user: nao entra turno vazio",
  JSON.stringify(r.openaiSemConversa.papeis) === JSON.stringify(["system", "user"]),
  "papeis: " + JSON.stringify(r.openaiSemConversa.papeis),
);
cobra(
  "a reserva repassa a conversa inteira pro provedor",
  r.reserva.assistant === PERGUNTA,
  "assistant: " + JSON.stringify(r.reserva.assistant),
);

console.log("");
if (falhas.length) {
  console.log("REPROVOU EM " + falhas.length);
  process.exit(1);
}
console.log("PASSOU");
