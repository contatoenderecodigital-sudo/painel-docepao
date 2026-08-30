// DUAS COISAS DITAS NA MESMA FRASE NAO VIRAM UMA.
//
// O DEFEITO, MEDIDO AO VIVO EM 30/08/2026
//
//   cliente >> boa tarde, voces fazem pizza de forma?
//   padaria >> Sim. Pizza inteira R$ 120,00, meia R$ 60,00.  [cardapio]
//   cliente >> quero 2 inteiras, uma de calabresa e uma de frango com catupiry
//   ...
//   no banco >> 1 ~ pizza inteira ~ calabresa | frango com catupiry ~ R$ 120,00
//
// Ele pediu DUAS e a padaria cobrou UMA: R$ 120,00 no lugar de R$ 240,00. E a
// cozinha recebia uma pizza so com dois sabores no recado, sem saber o que
// montar.
//
// A CAUSA NAO ERA A QUE ESTAVA ESCRITA
//
// O `HANDOFF-PRO-CLAUDE.md` dizia que o codigo gravava certo e que quem errava
// era so o modelo. Medi antes de escrever em cima disso, e nao era:
//
//   modelo devolve qtd 2         ->  2 ~ pizza inteira ~ frango  (perdeu a calabresa)
//   modelo devolve DUAS linhas   ->  1 ~ pizza inteira ~ calabresa | frango
//
// NENHUMA forma de resposta do modelo conseguia produzir duas pizzas. A juncao
// de itens casa pelo NOME do produto, e o laco acumula no mesmo array, entao
// dois itens ditos na mesma respiracao caiam um em cima do outro. Por isso
// mexer so na instrucao nunca movia o dinheiro.
//
// POR QUE A MARCA E O TEMPO, E NAO O SABOR
//
// Separar por sabor parece obvio e cobraria DOBRADO de quem pede uma pizza de
// dois sabores: a inteira aceita ate quatro. "uma de calabresa e uma de frango"
// tambem pode ser UMA pizza. Quem desempata e o modelo: dois itens sao dois.
//
// E A PRIMEIRA VERSAO DO CONSERTO QUEBROU A FESTA
//
// Nao juntar NADA dentro do turno reprovou quatro testes de uma vez: quando a
// base da festa e repartida, o mesmo produto volta duas vezes na mesma leitura,
// e o risolis virou duas linhas de 66. Duplicata de verdade tem que juntar.
//
// A regra final: no mesmo turno, junta so quando o SABOR tambem e o mesmo.
//
// O QUE ELE COBRA
//
//   1. duas linhas do mesmo produto com sabores diferentes ficam DUAS
//   2. duplicata de verdade (mesmo produto, sem sabor) continua juntando
//   3. correcao entre mensagens continua corrigindo, e nao vira linha nova
//   4. familias diferentes continuam separadas
//
// A 2 e a 3 sao as que impedem o conserto de virar defeito pior.
//
// Roda com: node testes/duas-pizzas-nao-viram-uma.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-duas-pizzas.mjs");

const SONDA = [
  "import { responder } from '../lib/ia/fluxo/fluxo.ts';",
  "",
  "const VAZIO = {",
  "  ehFesta: false, pessoas: null, base: null, baseAceita: false, naoQuer: [],",
  "  forminha: null, dados: {}, pecas: null, topoNome: null, topoIdade: null,",
  "  escrito: null, tema: null, prato: null, ofereceu: false,",
  "  etapasJaPerguntadas: [], itens: [],",
  "};",
  "",
  "const pensarQueDevolve = (leitura) => async () => leitura;",
  "const rodar = async (estado, texto, leitura) => {",
  "  const r = await responder(estado, { texto, botaoId: null }, pensarQueDevolve(leitura));",
  "  return r.estado;",
  "};",
  "const mostra = (e) => e.itens.map((i) => i.qtd + '~' + i.produto + '~' + (i.obs ?? ''));",
  "",
  "// 1. duas pizzas, um sabor cada",
  "const duasPizzas = await rodar(VAZIO, 'quero 2 inteiras, uma de calabresa e uma de frango com catupiry', {",
  "  itens: [",
  "    { produto: 'pizza inteira', qtd: 1, sabor: 'calabresa' },",
  "    { produto: 'pizza inteira', qtd: 1, sabor: 'frango com catupiry' },",
  "  ],",
  "});",
  "",
  "// 2. duplicata de verdade: o mesmo produto SEM sabor, duas vezes. E o que a",
  "// festa faz quando reparte a base entre os salgados escolhidos.",
  // O TEXTO NAO PODE CITAR OUTRO PRODUTO. A primeira versao dizia "coxinha e
  // risoles" e o codigo leu o risoles DA FRASE, corretamente, acrescentando uma
  // linha que eu nao tinha posto na leitura. O teste media o meu proprio texto.
  "const duplicata = await rodar(VAZIO, 'quero coxinha', {",
  "  itens: [{ produto: 'coxinha', qtd: 68 }, { produto: 'coxinha', qtd: 66 }],",
  "});",
  "",
  "// 5. O MODELO DEVOLVE OS DOIS SABORES NUMA STRING SO, que e o que ele faz",
  "// de verdade depois que a instrucao da quantidade entrou. Tem que abrir em",
  "// duas linhas, uma de cada.",
  "const juntos = await rodar(VAZIO, 'quero 2 inteiras, uma de calabresa e uma de frango com catupiry', {",
  "  itens: [{ produto: 'pizza inteira', qtd: 2, sabor: 'calabresa | frango com catupiry' }],",
  "});",
  "",
  "// 6. UMA pizza de dois sabores continua UMA: a inteira aceita ate quatro.",
  "const umaComDois = await rodar(VAZIO, 'quero uma inteira meio calabresa meio frango com catupiry', {",
  "  itens: [{ produto: 'pizza inteira', qtd: 1, sabor: 'calabresa | frango com catupiry' }],",
  "});",
  "",
  "// 7. Quantidade que NAO bate com o numero de sabores: nao adivinha.",
  "const naoBate = await rodar(VAZIO, 'quero 5 inteiras de calabresa e frango com catupiry', {",
  "  itens: [{ produto: 'pizza inteira', qtd: 5, sabor: 'calabresa | frango com catupiry' }],",
  "});",
  "",
  "// 8. Recado NAO e sabor: 'sem cebola' nao pode virar linha.",
  "const comRecado = await rodar(VAZIO, 'quero 2 inteiras de calabresa, sem cebola', {",
  "  itens: [{ produto: 'pizza inteira', qtd: 2, sabor: 'calabresa | sem cebola' }],",
  "});",
  "",
  "// 3. correcao ENTRE mensagens",
  "const corrigiu = await rodar(",
  "  { ...VAZIO, itens: [{ produto: 'brigadeiro', categoria: 'docinho', qtd: 50, obs: 'forminha rosa' }] },",
  "  'muda pra 100 brigadeiro',",
  "  { itens: [{ produto: 'brigadeiro', qtd: 100 }] },",
  ");",
  "",
  "// 4. familias diferentes",
  "const duasFamilias = await rodar(VAZIO, '100 coxinha e 50 brigadeiro', {",
  "  itens: [{ produto: 'coxinha', qtd: 100 }, { produto: 'brigadeiro', qtd: 50 }],",
  "});",
  "",
  "console.log(JSON.stringify({",
  "  duasPizzas: mostra(duasPizzas),",
  "  duplicata: mostra(duplicata),",
  "  corrigiu: mostra(corrigiu),",
  "  duasFamilias: mostra(duasFamilias),",
  "  juntos: mostra(juntos),",
  "  umaComDois: mostra(umaComDois),",
  "  naoBate: mostra(naoBate),",
  "  comRecado: mostra(comRecado),",
  "}));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");
let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-duas-pizzas.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("O que ficou no pedido:");
for (const [caso, linhas] of Object.entries(r)) {
  console.log("  " + caso + ":");
  for (const l of linhas) console.log("      " + l);
}

const falhas = [];

// 1. DUAS pizzas, e cada uma com o SEU sabor.
if (r.duasPizzas.length !== 2) {
  falhas.push(
    "duas pizzas viraram " + r.duasPizzas.length + " linha(s): o cliente pediu duas " +
      "e a padaria cobra uma. R$ 120,00 no lugar de R$ 240,00",
  );
}
const juntos = r.duasPizzas.join(" ;; ");
if (!/calabresa/.test(juntos) || !/frango com catupiry/.test(juntos)) {
  falhas.push("um dos sabores sumiu: " + JSON.stringify(r.duasPizzas));
}
if (r.duasPizzas.some((l) => /calabresa/.test(l) && /frango/.test(l))) {
  falhas.push(
    "os dois sabores ficaram na MESMA linha: a cozinha recebe uma pizza so e " +
      "nao sabe o que montar. " + JSON.stringify(r.duasPizzas),
  );
}

// 2. duplicata de verdade continua juntando (a festa depende disto)
if (r.duplicata.length !== 1) {
  falhas.push(
    "o mesmo produto sem sabor virou " + r.duplicata.length + " linhas: quando a " +
      "festa reparte a base, o produto volta duas vezes na mesma leitura e isso " +
      "e duplicata, nao pedido novo. " + JSON.stringify(r.duplicata),
  );
}

// 3. correcao entre mensagens
if (r.corrigiu.length !== 1 || !/^100~/.test(r.corrigiu[0] ?? "")) {
  falhas.push(
    "corrigir a quantidade parou de corrigir: " + JSON.stringify(r.corrigiu) +
      ". Somar ja dobrou pedido de festa uma vez",
  );
}
if (!/forminha rosa/.test(r.corrigiu.join(" "))) {
  falhas.push("a correcao apagou a observacao que ja estava: " + JSON.stringify(r.corrigiu));
}

// 5. O MODELO MANDA OS DOIS SABORES NUMA STRING SO, e isso abre em duas linhas.
//
// Medido ao vivo em 30/08/2026, depois de a instrucao da quantidade entrar: o
// dinheiro ficou certo (R$ 240,00) e a COZINHA nao. O banco tinha
// `2 ~ pizza inteira ~ frango com catupiry`: a calabresa sumiu e sairiam duas
// pizzas iguais. O codigo tratava "calabresa | frango com catupiry" como UM
// sabor, e como essa string nao aparece literal na fala, era descartada.
if (r.juntos.length !== 2) {
  falhas.push(
    "os dois sabores numa string so viraram " + r.juntos.length + " linha(s): a " +
      "cozinha nao sabe o que montar. " + JSON.stringify(r.juntos),
  );
}
if (!/calabresa/.test(r.juntos.join(" ")) || !/frango com catupiry/.test(r.juntos.join(" "))) {
  falhas.push("um dos sabores sumiu ao abrir: " + JSON.stringify(r.juntos));
}

// 6, 7 e 8. O QUE NAO PODE MUDAR AO ABRIR.
if (r.umaComDois.length !== 1) {
  falhas.push(
    "UMA pizza de dois sabores virou " + r.umaComDois.length + " linhas: a inteira " +
      "aceita ate quatro sabores, entao isso cobra DOBRADO de quem pediu uma. " +
      JSON.stringify(r.umaComDois),
  );
}
if (r.naoBate.length !== 1) {
  falhas.push(
    "quantidade que nao bate com o numero de sabores foi adivinhada: " +
      JSON.stringify(r.naoBate) + ". Com 5 pizzas e 2 sabores nao da pra saber " +
      "quantas de cada",
  );
}
if (r.comRecado.length !== 1) {
  falhas.push(
    "um recado virou linha: \"sem cebola\" nao e sabor, e quem diz o que e sabor " +
      "e o catalogo. " + JSON.stringify(r.comRecado),
  );
}

// 4. familias diferentes
if (r.duasFamilias.length !== 2) {
  falhas.push("coxinha e brigadeiro deixaram de ser duas linhas: " + JSON.stringify(r.duasFamilias));
}

console.log("");
if (falhas.length) {
  console.log("ERRO  item dito na mesma frase caindo em cima do outro (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    duas coisas ditas juntas continuam duas, e duplicata continua uma");
console.log("");
console.log("PASSOU");
