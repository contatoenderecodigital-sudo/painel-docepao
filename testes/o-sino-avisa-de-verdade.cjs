// O SINO AVISA DE VERDADE, E O NUMERO DA ABA DESCE.
//
// O DEFEITO, ACHADO LENDO LINHA A LINHA EM 28/08/2026
//
// O `SinoNotificacao` tinha isto escrito:
//
//     // Pede permissao pro navegador na hora que ela liga o som: e o mesmo
//     // gesto, e assim o aviso funciona com a aba minimizada, que e o caso
//     // real da padaria.
//     const avisarNoNavegador = useCallback((texto) => { ... }, [nome]);
//
// A funcao existia, pedia a permissao pra padaria junto com o som, aparecia na
// lista de dependencias do efeito, e NAO ERA CHAMADA EM LUGAR NENHUM. Nem uma
// notificacao saiu, nunca. A padaria autorizou pra nada, e o caso que o proprio
// comentario chamava de "o caso real da padaria" era o unico que nao existia.
//
// E O TITULO DA ABA SO SUBIA
//
// `document.title = "(3) Painel"` era escrito quando a fila CRESCIA, e nunca
// quando ela esvaziava. Depois que a equipe aprovava tudo, a aba continuava
// marcando tres pedidos pra sempre, e o numero deixava de querer dizer algo.
//
// O QUE ELE COBRA
//
//   1. o aviso do navegador e CHAMADO, e nao so escrito
//   2. o titulo da aba desce quando a fila esvazia
//   3. o texto do aviso diz quem esta esperando, e so o que o sino sabe
//
// A primeira e a que importa: definir a funcao nao avisa ninguem.
//
// Roda com: node testes/o-sino-avisa-de-verdade.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-sino.mjs");

const falhas = [];

// -----------------------------------------------------------------------------
// 1 e 2. O componente CHAMA o aviso, e mexe no titulo pros dois lados.
// -----------------------------------------------------------------------------
const fonte = fs
  .readFileSync(path.join(raiz, "components", "SinoNotificacao.tsx"), "utf8")
  .split(/\r?\n/)
  .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
  .join("\n");

// Definir e chamar sao coisas diferentes: a marca da CHAMADA e o parenteses com
// argumento, e nao o `const avisarNoNavegador =` da definicao.
if (!/avisarNoNavegador\(\s*recadoDoSino\(/.test(fonte)) {
  falhas.push(
    "SinoNotificacao.tsx nao chama mais o `avisarNoNavegador`: a padaria autoriza " +
      "a notificacao e nao recebe nenhuma, que foi o defeito de 28/08/2026",
  );
}
// O titulo tem que ter um caminho que VOLTA pro nome puro.
if (!/document\.title = total > 0/.test(fonte)) {
  falhas.push(
    "SinoNotificacao.tsx voltou a so aumentar o titulo da aba: depois de aprovar " +
      "tudo, a aba fica marcando pedido que nao existe mais",
  );
}

// -----------------------------------------------------------------------------
// 3. O texto do aviso.
// -----------------------------------------------------------------------------
const SONDA = [
  "import { recadoDoSino } from '../lib/recado-do-sino.ts';",
  "",
  "const item = (id, nome, total) => ({ id, nome, total, onde: 'fila', motivo: null });",
  "",
  "const zero = { fila: 0, aguardando: 0, ajuda: 0, itens: [] };",
  "const umItem = { fila: 1, aguardando: 0, ajuda: 0, itens: [item('p1', 'Ana Paula', 21880)] };",
  "const semValor = { fila: 1, aguardando: 0, ajuda: 0, itens: [item('p1', 'Ana Paula', 0)] };",
  "const semNome = { fila: 1, aguardando: 0, ajuda: 0, itens: [item('p1', 'Cliente', 9000)] };",
  "const tres = { fila: 3, aguardando: 0, ajuda: 0, itens: [item('p1','A',100), item('p2','B',200), item('p3','C',300)] };",
  "const semItens = { fila: 1, aguardando: 0, ajuda: 0 };",
  "const pediuAjuda = { fila: 0, aguardando: 0, ajuda: 1, itens: [] };",
  "const segundoDeDois = {",
  "  fila: 2, aguardando: 0, ajuda: 0,",
  "  itens: [item('p1','Ana Paula',21880), item('p2','Bruno',5000)],",
  "};",
  "",
  "console.log(JSON.stringify({",
  "  umPedido:        recadoDoSino(umItem, zero),",
  "  semValor:        recadoDoSino(semValor, zero),",
  "  semNome:         recadoDoSino(semNome, zero),",
  "  tresDeUmaVez:    recadoDoSino(tres, zero),",
  "  semSaberQual:    recadoDoSino(semItens, zero),",
  "  pedidoDeAjuda:   recadoDoSino(pediuAjuda, zero),",
  "  oSegundoPedido:  recadoDoSino(segundoDeDois, umItem),",
  "}));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");
let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-sino.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("O que o aviso escreve:");
for (const [caso, texto] of Object.entries(r)) console.log("  " + caso.padEnd(16) + " -> " + JSON.stringify(texto));

const confere = (caso, marca, oQue) => {
  if (!marca.test(String(r[caso] ?? ""))) {
    falhas.push(caso + ": o aviso devia dizer " + oQue + ", e disse " + JSON.stringify(r[caso]));
  }
};

// Nome e valor sao o que fazem alguem largar o forno e vir olhar.
confere("umPedido", /Ana Paula/, "o nome de quem pediu");
confere("umPedido", /218,80/, "o valor do pedido");
// Pedido sem valor fechado nao pode virar "R$ 0,00", que soa como pedido vazio.
confere("semValor", /Ana Paula/, "o nome mesmo sem valor");
if (/R\$\s*0,00/.test(String(r.semValor ?? ""))) {
  falhas.push("semValor: o aviso mostrou R$ 0,00, que soa como pedido vazio pra quem le");
}
confere("tresDeUmaVez", /3 pedidos/, "quantos entraram");
confere("semSaberQual", /[Pp]edido novo/, "que entrou pedido, sem inventar de quem");
confere("pedidoDeAjuda", /falar com a equipe/, "que tem cliente esperando gente");
// Chegando o segundo, o aviso e do SEGUNDO, e nao do que ja estava la.
confere("oSegundoPedido", /Bruno/, "o nome de quem acabou de chegar");
if (/Ana Paula/.test(String(r.oSegundoPedido ?? ""))) {
  falhas.push("oSegundoPedido: avisou de novo o pedido que ja estava na fila");
}

console.log("");
if (falhas.length) {
  console.log("ERRO  o sino nao avisa direito (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o sino avisa de verdade, e diz quem esta esperando");
console.log("");
console.log("PASSOU");
