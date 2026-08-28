// A TELA AVISA QUANDO PARA DE ATUALIZAR, EM VEZ DE CONGELAR BONITA.
//
// POR QUE ISTO EXISTE
//
// Seis telas do painel ficam perguntando ao servidor de tempos em tempos: a fila
// de aprovacao (5s), a producao do dia (8s), os atendimentos (6s), o sino, o
// status da impressora (20s) e a tela de aguardando.
//
// Todas faziam a mesma coisa com o erro:
//
//     const r = await fetch("/api/...");
//     if (!r.ok) return;          // e pronto
//
// Se a sessao expira, a resposta vira 401, o `return` engole, e a tela CONGELA
// mostrando os ultimos dados. Ela continua bonita, com o pedido de meia hora
// atras na frente da equipe, e ninguem descobre que parou.
//
// Numa fila de pedido isso e pior que um erro na cara: a dona confia no que esta
// vendo, e o que ela esta vendo nao existe mais.
//
// E ISSO FICOU MAIS PROVAVEL POR CAUSA DE UM CONSERTO MEU, NO MESMO DIA
//
// Ate 28/08/2026 as rotas do painel caiam no `NEGOCIO_PADRAO_ID` quando nao
// havia sessao, entao elas NUNCA respondiam 401: respondiam com os dados da
// padaria. Era o defeito das dezesseis rotas sem login.
//
// Consertando aquilo, o 401 passou a existir de verdade. A condicao pra este
// segundo defeito aparecer nasceu do conserto do primeiro.
//
// O QUE ELE COBRA
//
//   1. as telas que fazem polling nao engolem o 401 em silencio
//   2. quem trata usa a funcao unica (`buscarDoPainel`), e nao um `fetch` cru
//   3. o aviso que a pessoa le e o mesmo em todas as telas
//   4. a funcao unica separa sessao expirada de rede caida: aba que dorme ou
//      servidor reiniciando NAO pode mandar ninguem pro login
//
// Roda com: node testes/a-tela-avisa-quando-para-de-atualizar.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");

// Comentario nao conta como codigo. O `\r` sai antes do corte porque sem a flag
// `m` o `$` quer dizer fim da STRING, e a linha termina em `\r\n`.
const semComentario = (...p) =>
  fs
    .readFileSync(path.join(raiz, ...p), "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
    .join("\n");

const falhas = [];

// -----------------------------------------------------------------------------
// 1 e 2. As telas com polling que buscam do servidor.
//
// A tela de aguardando fica de fora de proposito: ela usa `router.refresh()`, e
// quem trata o caso dela e o redirect do layout do painel.
// -----------------------------------------------------------------------------
const COM_POLLING = [
  ["FilaAprovacao.tsx", "a fila de aprovacao"],
  ["PedidosDoDia.tsx", "a producao do dia"],
  ["SinoNotificacao.tsx", "o sino do cabecalho"],
  ["StatusImpressora.tsx", "o status da impressora"],
];

for (const [arquivo, oQueE] of COM_POLLING) {
  const fonte = semComentario("components", arquivo);
  if (!/setInterval/.test(fonte)) {
    falhas.push(arquivo + " parou de atualizar sozinha: confira se isso foi de proposito");
    continue;
  }
  if (!/buscarDoPainel[<(]/.test(fonte)) {
    falhas.push(
      oQueE + " (" + arquivo + ") voltou a buscar com `fetch` cru: sessao expirada " +
        "vira tela congelada, sem ninguem saber",
    );
  }
  // o `if (!r.ok) return` cru, dentro do polling, e a forma exata do defeito
  if (/if \(!r\.ok\) return;/.test(fonte)) {
    falhas.push(oQueE + " (" + arquivo + ") voltou a engolir o erro com `if (!r.ok) return`");
  }
}

// -----------------------------------------------------------------------------
// 3. O aviso e um so, e as telas que avisam usam ele.
// -----------------------------------------------------------------------------
for (const arquivo of ["FilaAprovacao.tsx", "PedidosDoDia.tsx"]) {
  const fonte = semComentario("components", arquivo);
  if (!/AVISO_SESSAO_EXPIRADA/.test(fonte)) {
    falhas.push(arquivo + ": deixou de mostrar o aviso de sessao expirada pra quem esta olhando");
  }
}

// -----------------------------------------------------------------------------
// 4. A funcao unica separa os tres casos. Medida rodando, nao lida.
// -----------------------------------------------------------------------------
const sonda = path.join(__dirname, "_sonda-buscar-painel.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { buscarDoPainel, AVISO_SESSAO_EXPIRADA } from '../lib/buscar-do-painel.ts';",
    "",
    "const erros = [];",
    "const original = globalThis.fetch;",
    "const comResposta = (r) => { globalThis.fetch = async () => r; };",
    "",
    "const resposta = (status, corpo) => ({",
    "  status, ok: status >= 200 && status < 300, json: async () => corpo,",
    "});",
    "",
    "comResposta(resposta(200, [{ id: 'x' }]));",
    "let r = await buscarDoPainel('/api/x');",
    "if (r.estado !== 'ok') erros.push('200 devia ser ok, deu ' + r.estado);",
    "else if (!Array.isArray(r.dados)) erros.push('200 nao devolveu os dados');",
    "",
    "for (const s of [401, 403]) {",
    "  comResposta(resposta(s, {}));",
    "  r = await buscarDoPainel('/api/x');",
    "  if (r.estado !== 'sessao_expirada') erros.push(s + ' devia ser sessao_expirada, deu ' + r.estado);",
    "}",
    "",
    "for (const s of [500, 502, 404]) {",
    "  comResposta(resposta(s, {}));",
    "  r = await buscarDoPainel('/api/x');",
    "  if (r.estado !== 'falhou') erros.push(s + ' devia ser falhou, deu ' + r.estado);",
    "}",
    "",
    "// REDE CAIDA NAO E SESSAO EXPIRADA: aba que dorme nao pode mandar ninguem",
    "// pro login.",
    "globalThis.fetch = async () => { throw new Error('rede caiu'); };",
    "r = await buscarDoPainel('/api/x');",
    "if (r.estado !== 'falhou') erros.push('rede caida devia ser falhou, deu ' + r.estado);",
    "",
    "globalThis.fetch = original;",
    "if (!AVISO_SESSAO_EXPIRADA || AVISO_SESSAO_EXPIRADA.length < 20) erros.push('o aviso sumiu');",
    "console.log(JSON.stringify({ erros, aviso: AVISO_SESSAO_EXPIRADA }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-buscar-painel.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Telas com polling conferidas: " + COM_POLLING.length);
console.log("O aviso: " + JSON.stringify(r.aviso.slice(0, 60)) + "...");
console.log("");

const todas = [...falhas, ...r.erros];
if (todas.length) {
  console.log("ERRO  tela que para de atualizar sem avisar (" + todas.length + ")");
  for (const f of todas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    sessao expirada avisa, rede caida so tenta de novo");
console.log("");
console.log("PASSOU");
