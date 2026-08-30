// "TIRA A DE CALABRESA" TEM QUE TIRAR A DE CALABRESA. E SO ELA.
//
// Medido em producao em 30/08/2026, container f8df73f, conversa inteira contra
// o banco:
//
//   cliente >> queria 2 pizzas inteiras, uma de calabresa e uma de frango
//   cliente >> na verdade tira a de calabresa, quero so a de frango
//   padaria >> Fechando: 1 pizza (calabresa) + 1 pizza (frango)  Total R$ 240,00
//
// Ele tirou uma e pagou pelas duas.
//
// O RASTRO DIZ DE QUEM E A CULPA, E NAO E DA IA:
//
//   etapa: abertura / modelo leu: 1x pizza [calabresa] ;; 1x pizza [frango]
//   etapa: dados    / modelo leu: 1x pizza inteira [frango com catupiry]
//
// Na mensagem do cancelamento o modelo devolveu O QUE SOBRA, que era a unica
// coisa que ele conseguia dizer: nao existia campo pra remocao. O fluxo tratou
// isso como atualizacao da linha do frango, e a calabresa ficou intacta.
//
// E O FLUXO ESTAVA CERTO EM FAZER ISSO. Item que some da leitura NAO pode virar
// remocao: e a regra "nada some do pedido", e ela existe porque o modelo omite
// item o tempo todo. O que faltava era o caminho EXPLICITO.
//
// A DIVISAO DE TRABALHO, que e a regra da casa: o modelo devolve a INTENCAO (o
// que o cliente pediu pra tirar, nas palavras dele) e o CODIGO decide qual
// linha sai, casando contra o pedido de verdade. Decisao que custa dinheiro nao
// mora no prompt.
//
// E QUANDO NAO DA PRA TER CERTEZA, NAO SAI NADA. Tirar a linha errada custa o
// mesmo que nao tirar nenhuma, e ainda quebra "nada some do pedido". Duas
// linhas casando com a mesma frase e ambiguidade, nao permissao pra escolher.
//
// Roda com: node testes/tirar-item-tira-a-linha-certa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-tirar-item.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[],",
    "};",
    "const pensar = (leitura) => (async () => leitura);",
    "const linhas = (e) => (e.itens || []).map((i) => i.produto + (i.obs ? ' [' + i.obs + ']' : ''));",
    "",
    "// O pedido de partida, montado pela leitura da primeira mensagem: duas",
    "// pizzas, uma de cada sabor. E a forma exata que o rastro de producao",
    "// mostrou, com o produto vindo como nome de familia e o sabor separado.",
    "const duasPizzas = await responder(VAZIO as never,",
    "  { texto: 'queria 2 pizzas inteiras, uma de calabresa e uma de frango com catupiry' },",
    "  pensar({ itens:[",
    "    {produto:'pizza inteira',qtd:1,sabor:'calabresa'},",
    "    {produto:'pizza inteira',qtd:1,sabor:'frango com catupiry'},",
    "  ] }) as never);",
    "",
    "const umBolo = await responder(VAZIO as never,",
    "  { texto: 'quero um bolo de chocolate de 2 kg' },",
    "  pensar({ itens:[{produto:'bolo caseiro chocolate',qtd:2}] }) as never);",
    "",
    "const saida: Record<string, string[]> = {};",
    "saida.partida = linhas(duasPizzas.estado);",
    "",
    "// 1. o caso do dinheiro: a frase casa com UMA linha so",
    "const r1 = await responder(duasPizzas.estado as never,",
    "  { texto: 'na verdade tira a de calabresa, quero so a de frango com catupiry' },",
    "  pensar({ tirar:['a de calabresa'], itens:[",
    "    {produto:'pizza inteira',qtd:1,sabor:'frango com catupiry'},",
    "  ] }) as never);",
    "saida.tiraCalabresa = linhas(r1.estado);",
    "",
    "// 2. ambiguo: 'a pizza' casa com as DUAS, entao nao sai nenhuma",
    "const r2 = await responder(duasPizzas.estado as never,",
    "  { texto: 'tira a pizza' },",
    "  pensar({ tirar:['a pizza'] }) as never);",
    "saida.ambiguo = linhas(r2.estado);",
    "",
    "// 3. nao casa com nada: o pedido fica como estava",
    "const r3 = await responder(duasPizzas.estado as never,",
    "  { texto: 'tira a cuca' },",
    "  pensar({ tirar:['a cuca'] }) as never);",
    "saida.semCasar = linhas(r3.estado);",
    "",
    "// 4. uma linha so do produto: sai pelo nome, sem precisar de sabor",
    "const r4 = await responder(umBolo.estado as never,",
    "  { texto: 'pode tirar o bolo' },",
    "  pensar({ tirar:['o bolo'] }) as never);",
    "saida.tiraOBolo = linhas(r4.estado);",
    "",
    "// 5. tirar um e acrescentar outro na MESMA frase",
    "const r5 = await responder(duasPizzas.estado as never,",
    "  { texto: 'tira a de calabresa e poe 100 coxinhas' },",
    "  pensar({ tirar:['a de calabresa'], itens:[{produto:'coxinha',qtd:100}] }) as never);",
    "saida.tiraEPoe = linhas(r5.estado);",
    "",
    "console.log(JSON.stringify(saida));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-tirar-item.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
function conferir(oque, achado, esperado, dano) {
  const ok = JSON.stringify(achado) === JSON.stringify(esperado);
  console.log(
    (ok ? "ok    " : "ERRO  ") + oque +
    (ok ? "" : "  ->  ficou " + JSON.stringify(achado) + ", esperado " + JSON.stringify(esperado) + "; " + dano),
  );
  if (!ok) erros++;
}

console.log("== o pedido de partida ==");
conferir(
  "duas pizzas, uma de cada sabor",
  saiu.partida,
  ["pizza inteira [calabresa]", "pizza inteira [frango com catupiry]"],
  "sem isto os outros casos nao medem nada",
);

console.log("== tirar ==");
conferir(
  "tira a de calabresa e so ela",
  saiu.tiraCalabresa,
  ["pizza inteira [frango com catupiry]"],
  "o cliente tirou uma e paga pelas duas, R$ 240,00 no lugar de R$ 120,00",
);
conferir(
  "frase ambigua nao tira nada",
  saiu.ambiguo,
  ["pizza inteira [calabresa]", "pizza inteira [frango com catupiry]"],
  "tirar a linha errada custa o mesmo que nao tirar, e ainda some do pedido",
);
conferir(
  "frase que nao casa com nada nao tira nada",
  saiu.semCasar,
  ["pizza inteira [calabresa]", "pizza inteira [frango com catupiry]"],
  "some do pedido o que ninguem mandou tirar",
);
conferir(
  "com uma linha so do produto, o nome basta",
  saiu.tiraOBolo,
  [],
  "o cliente desiste do bolo e leva o bolo",
);
conferir(
  "tirar um e acrescentar outro na mesma frase",
  saiu.tiraEPoe,
  ["pizza inteira [frango com catupiry]", "coxinha"],
  "a frase faz as duas coisas, e o pedido tem que refletir as duas",
);

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
