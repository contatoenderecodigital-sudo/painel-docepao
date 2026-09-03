// O VALOR DO TOPO E LIDO PELO MODELO, E NAO POR UMA LISTA DE PALAVRAS.
//
// POR QUE ISTO EXISTE
//
// Ate 03/09/2026 o "sim" ou "nao" ao valor final (o topo orcado pela equipe)
// era decidido ANTES do modelo por `respostaAoValor`, uma lista de aceites e
// recusas. "beleza, mas muda pra sexta" virava aceite e a mudanca se perdia;
// "quero mais 100 coxinha" repetia a pergunta com botao e as coxinhas sumiam.
// Era a ultima lista de intencao do sistema.
//
// Agora o botao continua decidindo (dinheiro), e o TEXTO vai pro modelo, que ve
// a conversa e um aviso de que o valor final foi mandado, e devolve
// `aceitouValor` (medido 3 de 3 em 03/09/2026: "Pode ser", "ta certo",
// "beleza" -> true; "nossa, muito caro", "nao, sem o topo" -> false; "beleza
// mas muda pra sexta" -> true + dados; "quero mais 100 coxinha" -> itens).
//
// O QUE ELE COBRA (a parte pura, sem banco)
//
//   1. com `aguardandoValor`, o lembrete que vai ao modelo avisa do valor final;
//   2. sem `aguardandoValor`, o lembrete nao fala de valor;
//   3. `aceitouValor: false` NAO e leitura vazia (o pedido na fila nao pode
//      responder "ja esta com a equipe" por cima de uma recusa).
//
// Roda com: node testes/o-valor-do-topo-e-lido-pelo-modelo.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-valor-do-topo.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const NA_FILA = {",
    "  ehFesta: false, pessoas: null, base: null, baseAceita: false, naoQuer: [],",
    "  itens: [{ produto: 'bolo brigadeiro', categoria: 'bolo_festa', qtd: 2, obs: 'topo de bolo' }],",
    "  dados: { nome: 'Renata', data: '10/09/2026', hora: '18:30', pagamento: 'pix' },",
    "  pecas: { topo: true, papelDeArroz: false }, topoNome: null, topoIdade: null, tema: 'Minnie', escrito: null,",
    "  forminha: null, prato: null, ofereceu: true,",
    "  ultimaFala: 'Oi Renata, consegui o valor aqui com a equipe. O topo ficou R$ 35,00. Com isso o pedido fica em R$ 128,80. Tá certo?',",
    "  insistiu: 0, retomarEm: null, assunto: null, etapasJaPerguntadas: ['bolo', 'pecas_do_bolo', 'dados', 'confirmacao'], etapasAdiadas: [],",
    "  pedidoNaFila: true,",
    "};",
    "let recebido: Record<string, unknown> | null = null;",
    "const captura = (leitura: unknown) => async (args: Record<string, unknown>) => { recebido = args; return leitura; };",
    "const com = await responder(NA_FILA as never, { texto: 'nossa, muito caro' }, captura({ aceitouValor: false }) as never, null, null, null, true);",
    "const anotadoCom = String((recebido as Record<string, unknown> | null)?.anotado ?? '');",
    "recebido = null;",
    "await responder(NA_FILA as never, { texto: 'obrigada' }, captura({}) as never, null, null, null, false);",
    "const anotadoSem = String((recebido as Record<string, unknown> | null)?.anotado ?? '');",
    "console.log(JSON.stringify({ anotadoCom, anotadoSem, textoRecusa: com.fala.texto.slice(0, 80) }));",
  ].join("\n"),
  "utf8",
);
let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-valor-do-topo.mts"], { cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32" });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, ok, detalhe) => { console.log((ok ? "ok    " : "ERRO  ") + rotulo); if (!ok) { falhas.push(rotulo); if (detalhe) console.log("        " + detalhe); } };
console.log("== o valor do topo e lido pelo modelo ==");
cobra("com o pedido aguardando o valor, o modelo e avisado do VALOR FINAL", /VALOR FINAL/.test(r.anotadoCom), r.anotadoCom.slice(0, 160));
cobra("sem isso, o lembrete nao fala de valor", !/VALOR FINAL/.test(r.anotadoSem), r.anotadoSem.slice(0, 160));
cobra("aceitouValor false nao e leitura vazia: a padaria nao responde 'ja esta com a equipe' por cima da recusa",
  !/já está com a equipe da padaria pra aprovação/i.test(r.textoRecusa), r.textoRecusa);
console.log("");
if (falhas.length) { console.log("REPROVOU EM " + falhas.length); process.exit(1); }
console.log("PASSOU");
