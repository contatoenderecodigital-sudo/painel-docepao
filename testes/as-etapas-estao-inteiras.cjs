// AS ETAPAS ESTAO INTEIRAS, E A RECUSA DO CLIENTE VALE.
//
// POR QUE ISTO EXISTE
//
// `etapas.ts` e a peca central do fluxo e e so DADOS: a lista das etapas, o que
// cada uma pergunta, e quando ela esta cumprida. Justamente por ser dado, tres
// coisas erradas ali passam caladas por qualquer compilador.
//
// 1. O ROTEIRO PODE PERDER UMA ETAPA EM SILENCIO
//
//    `SO()` monta cada roteiro procurando a etapa pelo id, com um `!` que mente
//    pro compilador e um `.filter(Boolean)` logo atras. Id que nao existe some
//    da lista sem erro nenhum, e o cliente simplesmente nunca e perguntado
//    daquilo.
//
// 2. O BOTAO PODE PASSAR DO LIMITE DA META
//
//    Titulo de botao tem 20 caracteres. Passou, a Meta RECUSA A MENSAGEM
//    INTEIRA: nao e o botao que fica feio, e o cliente que nao recebe nada.
//    Nada no codigo conferia isso.
//
// 3. A RECUSA DO CLIENTE PODE NAO SER LIDA
//
//    Medido em 28/08/2026, com um salgado ja no pedido:
//
//        naoQuer ["salgado"]      ->  a etapa do salgado e pulada
//        naoQuer ["salgadinho"]   ->  NAO e pulada
//
//    Ele dizia que nao queria e a padaria continuava perguntando quais
//    salgados ele queria.
//
// Roda com: node testes/as-etapas-estao-inteiras.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// O tipo EtapaId sai da FONTE, que e onde etapa se cadastra.
const fonte = fs.readFileSync(
  path.join(__dirname, "..", "lib", "ia", "fluxo", "etapas.ts"), "utf8");
const bloco = fonte.match(/export type EtapaId =([\s\S]*?);/);
const idsDoTipo = bloco ? [...bloco[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]) : [];

const sonda = path.join(__dirname, "_sonda-etapas.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { ETAPAS_DA_FESTA, ROTEIRO_DA_FESTA, ROTEIRO_COMUM } from '../lib/ia/fluxo/etapas.ts';",
    "",
    "const VAZIO = {",
    "  ehFesta: false, pessoas: null, base: null, baseAceita: false, itens: [], naoQuer: [],",
    "  dados: { nome: null, data: null, hora: null, pagamento: null }, pecas: null,",
    "  topoNome: null, topoIdade: null, escrito: null, tema: null, forminha: null,",
    "  prato: null, ofereceu: false,",
    "};",
    "",
    "// Os botoes que a padaria manda, com o tamanho de cada titulo.",
    "const botoes = [];",
    "for (const e of ETAPAS_DA_FESTA) {",
    "  if (e.espera?.tipo !== 'botao') continue;",
    "  for (const o of e.espera.opcoes) botoes.push({ etapa: e.id, id: o.id, titulo: o.titulo });",
    "}",
    "",
    "// A recusa, medida na familia que TEM item no pedido (senao a etapa e",
    "// pulada por falta de item e o teste mediria outra coisa).",
    "const FAMILIAS = [",
    "  ['salgado', 'salgado_frito', 'coxinha', ['salgado','salgados','salgadinho','salgadinhos']],",
    "  ['docinho', 'docinho', 'brigadeiro', ['docinho','docinhos','doce','doces']],",
    "  ['bolo', 'bolo_festa', 'bolo 4 leites', ['bolo','bolos']],",
    "];",
    "const recusaIgnorada = [];",
    "for (const [etapaId, categoria, produto, palavras] of FAMILIAS) {",
    "  const etapa = ETAPAS_DA_FESTA.find((e) => e.id === etapaId);",
    "  for (const w of palavras) {",
    "    const p = { ...VAZIO, ehFesta: true, naoQuer: [w],",
    "      itens: [{ produto, categoria, qtd: 10, obs: null }] };",
    "    if (!etapa.pulavel?.(p)) recusaIgnorada.push(etapaId + ' + \"' + w + '\"');",
    "  }",
    "}",
    "",
    "// O generico nao pode cumprir a etapa: 'bolos' no lugar do sabor faria a",
    "// festa fechar e a cozinha ficar sem saber o que assar.",
    "const genericoFechou = [];",
    "for (const [etapaId, categoria, , ] of FAMILIAS) {",
    "  const etapa = ETAPAS_DA_FESTA.find((e) => e.id === etapaId);",
    "  for (const generico of [etapaId, etapaId + 's']) {",
    "    const p = { ...VAZIO, ehFesta: true, prato: 'aberto', forminha: 'rosa',",
    "      itens: [{ produto: generico, categoria, qtd: 10, obs: null }] };",
    "    if (etapa.cumprida(p)) genericoFechou.push(etapaId + ' fechou com \"' + generico + '\"');",
    "  }",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  ids: ETAPAS_DA_FESTA.map((e) => e.id),",
    "  roteiros: {",
    "    festa: ROTEIRO_DA_FESTA.map((e) => e.id),",
    "    comum: ROTEIRO_COMUM.map((e) => e.id),",
    "  },",
    "  botoes, recusaIgnorada, genericoFechou,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-etapas.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Etapas no tipo: " + idsDoTipo.length + " | na lista: " + r.ids.length);
console.log("Roteiros: festa " + r.roteiros.festa.length + ", comum " + r.roteiros.comum.length);
console.log("Botoes conferidos: " + r.botoes.length);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("etapa declarada no tipo e que nao existe na lista",
  idsDoTipo.filter((id) => !r.ids.includes(id)));
cobra("etapa na lista que nao existe no tipo",
  r.ids.filter((id) => !idsDoTipo.includes(id)));
// SO() engole em silencio: id que nao resolve some do roteiro.
for (const [nome, lista] of Object.entries(r.roteiros)) {
  cobra("o roteiro " + nome + " tem buraco (SO() engoliu um id)",
    lista.filter((x) => !x));
}
cobra("titulo de botao passou de 20 caracteres (a Meta recusa a mensagem inteira)",
  r.botoes.filter((b) => b.titulo.length > 20).map((b) => b.etapa + " / " + b.titulo + " (" + b.titulo.length + ")"));
cobra("botao sem id ou sem titulo",
  r.botoes.filter((b) => !b.id || !b.titulo).map((b) => JSON.stringify(b)));
cobra("o cliente recusou a familia e a padaria continua perguntando", r.recusaIgnorada);
cobra("a etapa se deu por cumprida com o nome da familia no lugar do produto", r.genericoFechou);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    roteiros inteiros, botoes dentro do limite, recusa e generico lidos");
console.log("");
console.log("PASSOU");
