// ============================================================================
//  MEDE A CEGUEIRA: a conversa no prompt faz o modelo ler "10" como pessoas?
//
//  E a medicao da secao 3 do TIRAR-AS-GUARDAS.md, a que decide se o plano de
//  tirar as guardas vale. Ela manda ao modelo DE VERDADE, com o codigo desta
//  maquina, a mesma cena de 03/09/2026:
//
//    padaria >> Quantas pessoas vao na festa?
//    cliente >> 10
//
//  e le o que volta. Sao quatro variantes, cada uma repetida N vezes:
//
//    A  cego     + instrucao das PESSOAS   o codigo novo escolhendo a etapa
//                                          certa, mas sem a conversa
//    B  conversa + instrucao das PESSOAS   o codigo novo completo (secao 3)
//    C  cego     + instrucao do BOLO       o caminho do defeito de 03/09, que
//                                          estava no ar: 10 kg de bolo
//    D  conversa + instrucao do BOLO       so a conversa, com a etapa ERRADA:
//                                          decide se o esparadrapo B-1 e as
//                                          guardas que leem ultimaFala podem
//                                          morrer, porque o modelo se vira
//                                          sozinho mesmo com o codigo errando
//
//  O que se espera, se a cegueira era a causa: B devolve pessoas: 10 em todas;
//  C devolve 10x bolo (ou lixo) na maioria; D e a pergunta em aberto.
//
//  Se B nao devolver pessoas: 10, o buraco e outro. Pare e investigue antes de
//  apagar guarda nenhuma.
//
//  Uso:
//    OPENAI_API_KEY=... node testes/mede-a-cegueira.cjs          (5 vezes cada)
//    OPENAI_API_KEY=... node testes/mede-a-cegueira.cjs 10       (10 vezes cada)
//
//  O provedor e o modelo saem do mesmo lugar que a producao usa
//  (lib/ia/cliente-do-cerebro.ts): OPENAI_MODEL_FLUXO troca o modelo, e
//  IA_BASE_URL com a chave do provedor troca o provedor.
//
//  FICA FORA DO PORTAO: gasta token e depende de rede. Nao grava nada.
// ============================================================================

const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const temChave =
  process.env.OPENAI_API_KEY || process.env.CLAUDE_API_KEY || process.env.IA_API_KEY || process.env.GEMINI_API_KEY;
if (!temChave) {
  console.error("falta a chave do provedor no ambiente (OPENAI_API_KEY, ou IA_BASE_URL com a chave dele)");
  process.exit(2);
}
const VEZES = Math.max(1, Number(process.argv[2]) || 5);

const sonda = path.join(__dirname, "_sonda-mede-a-cegueira.mts");
fs.writeFileSync(
  sonda,
  [
    'import { pensarComOpenAI } from "../lib/ia/fluxo/pensar-openai.ts";',
    'import { instrucaoDaEtapa } from "../lib/ia/fluxo/leitura.ts";',
    'import { falaDaEtapa } from "../lib/ia/fluxo/pergunta.ts";',
    'import { ETAPAS_DA_FESTA } from "../lib/ia/fluxo/etapas.ts";',
    'import { clienteDoCerebro, modeloDoCerebro } from "../lib/ia/cliente-do-cerebro.ts";',
    "",
    "const VEZES = " + VEZES + ";",
    "",
    "// A cena de 03/09/2026: tres familias em aberto e a festa ligada.",
    "const ESTADO = {",
    "  ehFesta: true, pessoas: null, base: null, baseAceita: false,",
    "  itens: [",
    "    { produto: 'salgado', categoria: 'salgado_frito', qtd: 0, obs: null },",
    "    { produto: 'docinho', categoria: 'docinho', qtd: 0, obs: null },",
    "    { produto: 'bolo', categoria: 'bolo_festa', qtd: 0, obs: null },",
    "  ],",
    "  naoQuer: [], dados: { nome: null, data: null, hora: null, pagamento: null },",
    "  pecas: null, topoNome: null, topoIdade: null, tema: null, escrito: null,",
    "  forminha: null, prato: null, ofereceu: false,",
    "  ultimaFala: null, insistiu: 0, retomarEm: null, assunto: null, etapasJaPerguntadas: ['quantas_pessoas'],",
    "};",
    "",
    "// A pergunta sai do mesmo lugar que a padaria usa, e nao digitada aqui.",
    "const etapaPessoas = ETAPAS_DA_FESTA.find((e) => e.id === 'quantas_pessoas')!;",
    "const PERGUNTA = falaDaEtapa(etapaPessoas, ESTADO as never).texto;",
    "const MENSAGEM = '10';",
    "",
    "const pensar = pensarComOpenAI(clienteDoCerebro());",
    "console.log('modelo: ' + modeloDoCerebro() + '   pergunta: ' + JSON.stringify(PERGUNTA) + '   cliente: ' + JSON.stringify(MENSAGEM));",
    "console.log('');",
    "",
    "type Variante = { rotulo: string; etapa: 'quantas_pessoas' | 'bolo'; comConversa: boolean };",
    "const VARIANTES: Variante[] = [",
    "  { rotulo: 'A  cego     + instrucao das pessoas', etapa: 'quantas_pessoas', comConversa: false },",
    "  { rotulo: 'B  conversa + instrucao das pessoas', etapa: 'quantas_pessoas', comConversa: true },",
    "  { rotulo: 'C  cego     + instrucao do bolo    ', etapa: 'bolo', comConversa: false },",
    "  { rotulo: 'D  conversa + instrucao do bolo    ', etapa: 'bolo', comConversa: true },",
    "];",
    "",
    "const classificar = (l: Record<string, unknown>): string => {",
    "  const itens = Array.isArray(l.itens) ? (l.itens as { produto: string; qtd: number }[]) : [];",
    "  const boloDez = itens.some((i) => /bolo/i.test(String(i.produto)) && Number(i.qtd) === 10);",
    "  if (l.pessoas === 10 && !boloDez) return 'pessoas: 10';",
    "  if (boloDez) return '10x bolo';",
    "  if (l.falouDeOutraEtapa) return 'falouDeOutraEtapa: ' + l.falouDeOutraEtapa;",
    "  if (!Object.keys(l).length) return '{} (nao leu nada)';",
    "  return 'outro: ' + JSON.stringify(l);",
    "};",
    "",
    "const resumo: string[] = [];",
    "for (const v of VARIANTES) {",
    "  const instrucao = instrucaoDaEtapa(v.etapa, ESTADO as never);",
    "  const contagem = new Map<string, number>();",
    "  for (let n = 0; n < VEZES; n++) {",
    "    let veredito: string;",
    "    try {",
    "      const l = await pensar({ instrucao, mensagem: MENSAGEM, perguntaDaPadaria: v.comConversa ? PERGUNTA : null });",
    "      veredito = classificar(l as Record<string, unknown>);",
    "    } catch (e) {",
    "      veredito = 'ERRO: ' + String((e as Error)?.message ?? e).slice(0, 80);",
    "    }",
    "    contagem.set(veredito, (contagem.get(veredito) ?? 0) + 1);",
    "    console.log('  ' + v.rotulo + '   ' + (n + 1) + '/' + VEZES + '   ' + veredito);",
    "  }",
    "  const linha = [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => c + 'x ' + k).join('   ');",
    "  resumo.push(v.rotulo + '   ' + linha);",
    "  console.log('');",
    "}",
    "",
    "console.log('=== RESUMO (' + VEZES + ' vezes cada) ===');",
    "for (const r of resumo) console.log(r);",
    "console.log('');",
    "console.log('Le assim: B com pessoas: 10 em todas = a cegueira era a causa, e as guardas B podem cair.');",
    "console.log('          B sem pessoas: 10 = o buraco e outro; pare e investigue antes de apagar nada.');",
    "console.log('          D e o que decide se o esparadrapo B-1 e as regex de ultimaFala podem morrer.');",
  ].join("\n"),
  "utf8",
);

try {
  console.log(
    execFileSync("npx", ["tsx", "_sonda-mede-a-cegueira.mts"], {
      cwd: __dirname,
      encoding: "utf8",
      timeout: 600000,
      shell: process.platform === "win32",
      env: process.env,
    }),
  );
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
