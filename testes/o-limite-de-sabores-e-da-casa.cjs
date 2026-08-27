// SABOR A MAIS NAO FECHA, E A PADARIA DIZ QUAIS CABEM.
//
// POR QUE ISTO EXISTE
//
// A pizza de forma aceita 4 sabores, a meia 2, a redonda 2. Audio da dona,
// 19/08/2026: "so dois sabores por pizza redonda". Isso esta no catalogo em
// `sabores_ate` desde sempre e NENHUMA LINHA DE CODIGO LIA.
//
// O dono perguntou em 26/08/2026: "da pra colocar mais sabores na pizza ne,
// testou e configurou isso?". A resposta honesta era nao. Medido no mesmo dia:
// uma redonda de 30 cm fechava com CINCO sabores e a de forma com SEIS. A
// cozinha recebia um pedido que ela nao consegue produzir, e alguem teria que
// ligar pro cliente pra desfazer o que a conversa prometeu.
//
// OS DOIS LADOS, PORQUE OS DOIS JA QUEBRARAM AQUI
//
// Guarda que bloqueia sem perguntar e pior que o defeito: a padaria recusa
// fechar, nao diz o que falta, e o cliente fica olhando o mesmo resumo ate a
// conversa morrer. Eu fiz isso TRES VEZES em 26/08/2026.
//
// Entao este teste cobra os TRES:
//
//   1. passou do limite NAO FECHA;
//   2. passou do limite E PERGUNTADO, com os sabores que ele mesmo falou na
//      mao, e nao um "escolhe menos" que obriga o cliente a rolar a conversa;
//   3. DENTRO do limite fecha. Trava que nunca solta e venda perdida.
//
// E vale pra CLASSE: todo produto com `sabores_ate` no catalogo, e nao so a
// pizza. Quem cadastrar um limite novo amanha ja nasce coberto.
//
// Roda com: node testes/o-limite-de-sabores-e-da-casa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-limite-sabor.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { produtosDaCasa, categoriaDoPedido } from "../lib/ia/dados/produtos.ts";',
    'import { oQueFaltaPraFechar } from "../lib/ia/fluxo/fechar.ts";',
    'import { ETAPAS_DA_FESTA } from "../lib/ia/fluxo/etapas.ts";',
    'import { falaDaEtapa } from "../lib/ia/fluxo/pergunta.ts";',
    "",
    "const conf = ETAPAS_DA_FESTA.find((x) => x.id === 'confirmacao');",
    "// Tudo respondido menos o sabor, pra medir o limite sozinho.",
    "const base = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:true, naoQuer:[],",
    "  dados:{nome:'M', data:'28/08/2026', hora:'19:00', pagamento:'pix'},",
    "  pecas:null, topoNome:null, topoIdade:null, tema:null, escrito:null,",
    "  forminha:'rosa', prato:'aberto', ofereceu:true, ultimaFala:null,",
    "  insistiu:0, etapasJaPerguntadas:[],",
    "};",
    "const pedidoCom = (nome, obs) => ({ ...base,",
    "  itens: [{ produto: nome, categoria: categoriaDoPedido(nome), qtd: 2, obs: obs ?? null }] });",
    "",
    "const comLimite = produtosDaCasa().filter((p) => Number(p.saboresAte) > 0);",
    "",
    "const fechamComSaborDemais = [];",
    "const naoPerguntam = [];",
    "const perguntaSemAsOpcoes = [];",
    "const naoFechamNoLimite = [];",
    "for (const p of comLimite) {",
    "  const cabe = p.sabores.slice(0, p.saboresAte);",
    "  const demais = p.sabores.slice(0, p.saboresAte + 1);",
    "  if (demais.length <= p.saboresAte) continue;   // tem menos sabor que o limite",
    "",
    "  // 1. passou do limite nao fecha",
    "  const cheio = pedidoCom(p.nome, demais.join(', '));",
    "  if (!oQueFaltaPraFechar(cheio).length) fechamComSaborDemais.push(p.nome + ' (' + demais.length + ' sabores, limite ' + p.saboresAte + ')');",
    "",
    "  // 2. passou do limite e perguntado, com as opcoes na mao",
    "  const f = falaDaEtapa(conf, cheio, 1000);",
    "  const txt = String(f.texto || '');",
    "  if (/Fechando o pedido/.test(txt)) naoPerguntam.push(p.nome);",
    "  else if (!(f.opcoes || []).length) perguntaSemAsOpcoes.push(p.nome + ' -> ' + txt.slice(0, 60));",
    "",
    "  // 3. dentro do limite fecha",
    "  const ok = pedidoCom(p.nome, cabe.join(', '));",
    "  const falta = oQueFaltaPraFechar(ok);",
    "  if (falta.length) naoFechamNoLimite.push(p.nome + ' (' + cabe.length + '/' + p.saboresAte + ') -> ' + falta.join('; '));",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  comLimite: comLimite.map((p) => p.nome + ' ate ' + p.saboresAte),",
    "  fechamComSaborDemais, naoPerguntam, perguntaSemAsOpcoes, naoFechamNoLimite,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-limite-sabor.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

console.log("Produtos com limite de sabor no catalogo: " + r.comLimite.length);
for (const x of r.comLimite) console.log("    " + x);
console.log("");

if (!r.comLimite.length) {
  // Detector que nao detecta nada e o pior resultado possivel: passa verde e
  // esconde que a leitura do catalogo quebrou.
  console.log("ERRO  nenhum produto com limite: o catalogo mudou ou a leitura quebrou");
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

const cobra = (rotulo, lista) => {
  if (lista.length) {
    falhas.push(rotulo);
    console.log("ERRO  " + rotulo + " (" + lista.length + ")");
    for (const x of lista) console.log("        " + x);
  } else {
    console.log("ok    " + rotulo);
  }
};

cobra("fecha com sabor alem do limite", r.fechamComSaborDemais);
cobra("passou do limite e ninguem pergunta", r.naoPerguntam);
cobra("pergunta sem devolver os sabores que ele falou", r.perguntaSemAsOpcoes);
cobra("nao fecha estando DENTRO do limite", r.naoFechamNoLimite);

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
