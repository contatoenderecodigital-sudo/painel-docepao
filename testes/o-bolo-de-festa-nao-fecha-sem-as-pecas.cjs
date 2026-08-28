// O BOLO DE FESTA NAO FECHA SEM PERGUNTAR O TOPO E O PAPEL DE ARROZ.
//
// POR QUE ISTO EXISTE
//
// Medido em 28/08/2026, numa conversa de verdade contra a producao, sem eu
// falar dessas coisas em nenhum momento:
//
//     cliente >> quero encomendar pra uma festa de 20 pessoas
//     cliente >> nao quero salgadinho, so docinho e bolo
//     cliente >> pode ser assim
//     cliente >> 100 brigadeiro, forminha azul
//     cliente >> o bolo e de brigadeiro, 2 kg
//     padaria >> Para qual dia voce quer buscar?          <-- pulou tudo
//     cliente >> dia 12/09 as 10h, nome Ana Paula, pix
//     padaria >> Fechando o pedido: ...
//
// O pedido foi pra fila com um bolo de festa de 2 kg e a cozinha sem saber se
// leva topo e se leva papel de arroz.
//
// O topo e o item que a EQUIPE precisa orcar (o valor muda com o tema) e que
// tem prazo de dois dias com a fornecedora. O papel custa R$ 12,00 e a padaria
// vende. E ela chegava a AVISAR que existe, no cardapio de bolos, e nunca
// perguntava se ele queria.
//
// A CAUSA: UMA ETAPA COM DUAS PERGUNTAS SE AUTO-CUMPRIA
//
// A conversa marca "ja perguntei" por ETAPA. A etapa do bolo fazia DUAS
// perguntas, o sabor e depois o prato, entao a marca deixada pela pergunta do
// SABOR fazia a etapa se dar por cumprida antes de a segunda sair. E a etapa
// das pecas confiava na mesma marca, entao morria junto: num pedido com bolo a
// etapa do bolo SEMPRE e perguntada, logo as pecas nasciam cumpridas.
//
// Medido com a regra de ontem, direto na funcao:
//
//     em aberto  <- ninguem perguntou nada ainda
//     CUMPRIDA   <- a padaria perguntou SO o sabor do bolo
//
// O conserto: a marca guarda a PERGUNTA junto com a etapa ("bolo" e
// "bolo:tres"), e cada etapa olha a marca que prova a SUA pergunta.
//
// E DEPOIS A PERGUNTA DO PRATO SAIU, POR DECISAO DO DONO
//
// No mesmo dia, com a medicao na mao: o cliente ignorou as tres perguntas e
// mandou "pode confirmar", e o pedido fechou com o prato em branco e sem aviso
// nenhum pra equipe. A pergunta do prato nao existe no fluxograma da Kemilly e
// ja estava anotada como decisao em aberto no ARQUITETURA.md. Entre perguntar e
// aceitar ficar sem resposta, ou nao perguntar, ele escolheu nao perguntar: a
// equipe decide o prato na producao, como sempre fez.
//
// A LEITURA DO PRATO FICOU. Quem falar "prato aberto" por conta continua sendo
// entendido, gravado, e o prato continua saindo na comanda. Tirar a pergunta
// nao e jogar fora o que o cliente disser.
//
// O QUE ELE COBRA
//
//   1. ninguem perguntou, a etapa das pecas continua aberta
//   2. so o sabor perguntado, a do bolo fecha e a das PECAS continua aberta
//   3. a pergunta juntada (pra quem manda tudo de uma vez) cobre as pecas
//   4. quem ja respondeu nao e perguntado de novo
//   5. a padaria NAO pergunta mais o prato, e AINDA le o prato que ele falar
//
// Roda com: node testes/o-bolo-de-festa-nao-fecha-sem-as-pecas.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-pecas-do-bolo.mjs");

const SONDA = [
  "import { ROTEIRO_DA_FESTA } from '../lib/ia/fluxo/etapas.ts';",
  "import { falaDaEtapa } from '../lib/ia/fluxo/pergunta.ts';",
  "import { lerAFrase } from '../lib/ia/fluxo/leitor-da-frase.ts';",
  "",
  "const bolo = ROTEIRO_DA_FESTA.find((e) => e.id === 'bolo');",
  "const pecas = ROTEIRO_DA_FESTA.find((e) => e.id === 'pecas_do_bolo');",
  "",
  "const BASE = {",
  "  ehFesta: true, pessoas: 20, base: null, baseAceita: true, naoQuer: [], forminha: 'azul',",
  "  dados: {}, pecas: { topo: null, papelDeArroz: null }, topoNome: null, topoIdade: null,",
  "  escrito: null, tema: null, prato: null, ofereceu: false,",
  "  itens: [{ produto: 'bolo brigadeiro', categoria: 'bolo_festa', qtd: 2, obs: null }],",
  "};",
  "",
  "const erros = [];",
  "const cobra = (rotulo, deu, esperado) => {",
  "  if (deu !== esperado) erros.push(rotulo + ': deu ' + (deu ? 'CUMPRIDA' : 'em aberto') + ', esperado ' + (esperado ? 'CUMPRIDA' : 'em aberto'));",
  "};",
  "const com = (extra, marcas) => ({ ...BASE, ...extra, etapasJaPerguntadas: marcas });",
  "",
  "// 1. ninguem perguntou nada: as pecas ficam em aberto",
  "cobra('ninguem perguntou, a etapa das pecas', pecas.cumprida(com({}, [])), false);",
  "",
  "// 2. O CORACAO DO CONSERTO: perguntar o sabor nao responde pelas pecas.",
  "let p = com({}, ['bolo', 'bolo:sabor']);",
  "cobra('so o sabor perguntado, a etapa do bolo', bolo.cumprida(p), true);",
  "cobra('so o sabor perguntado, a etapa das pecas', pecas.cumprida(p), false);",
  "",
  "// 3. a pergunta juntada cobre as pecas",
  "//",
  "// A MARCA E `pecas_do_bolo:tres`, E ESTA LINHA JA FOI `bolo:tres`.",
  "//",
  "// A juntada sai POR ESTA ETAPA (o falaDasPecas chama ela na primeira linha),",
  "// entao o fluxo marca com o id dela. `bolo:tres` era a etapa de onde a",
  "// juntada saia ANTES de a pergunta do prato ser removida, e virou uma marca",
  "// que ninguem escreve. Este teste passou contra ela, verde, enquanto a",
  "// padaria repetia a mesma pergunta pra sempre em producao e o pedido deixava",
  "// de ser registrado.",
  "//",
  "// Foi a SEGUNDA vez no mesmo dia que eu escrevi a marca a mao no teste e",
  "// errei. Quem cobra isso sem depender da minha mao e o",
  "// `a-conversa-das-pecas-sempre-termina`, que le a chave da fala que saiu e",
  "// monta a marca do mesmo jeito que o fluxo monta.",
  "p = com({}, ['pecas_do_bolo', 'pecas_do_bolo:tres']);",
  "cobra('pergunta juntada, a etapa das pecas', pecas.cumprida(p), true);",
  "",
  "// 4. quem RESPONDEU nao e perguntado de novo",
  "p = com({ pecas: { topo: false, papelDeArroz: false } }, []);",
  "cobra('ele ja respondeu os dois, a etapa das pecas', pecas.cumprida(p), true);",
  "",
  "// 5. A PERGUNTA DO PRATO SAIU, MAS A LEITURA DELE FICOU.",
  "const problemas = [];",
  "const PERGUNTA_O_PRATO = /prato de MDF|com tampa/i;",
  "",
  "for (const par of [['bolo', bolo], ['pecas_do_bolo', pecas]]) {",
  "  for (const estado of [BASE, { ...BASE, pecas: { topo: null, papelDeArroz: false } }]) {",
  "    const t = String(falaDaEtapa(par[1], estado, 21880).texto ?? '');",
  "    if (PERGUNTA_O_PRATO.test(t)) problemas.push('a etapa ' + par[0] + ' ainda pergunta o prato: ' + JSON.stringify(t.slice(0, 70)));",
  "  }",
  "}",
  "",
  "// e a pergunta JUNTADA (pra quem mandou tudo de uma vez) tambem nao",
  "const tudoDeUmaVez = { ...BASE, dados: { nome: 'Ana', data: '12/09/2026', hora: '10:00', pagamento: 'pix' } };",
  "const juntada = String(falaDaEtapa(pecas, tudoDeUmaVez, 21880).texto ?? '');",
  "if (PERGUNTA_O_PRATO.test(juntada)) problemas.push('a pergunta juntada ainda pede o prato: ' + JSON.stringify(juntada.slice(0, 90)));",
  "if (!/papel de arroz/i.test(juntada) || !/topo/i.test(juntada)) problemas.push('a pergunta juntada perdeu o papel ou o topo: ' + JSON.stringify(juntada.slice(0, 90)));",
  "",
  "// A LEITURA continua: quem falar o prato tem o prato anotado.",
  "for (const caso of [['pode ser no prato aberto', 'aberto'], ['manda com tampa', 'tampa']]) {",
  "  const lido = lerAFrase(caso[0])?.prato ?? null;",
  "  if (lido !== caso[1]) problemas.push('a leitura do prato se perdeu em ' + JSON.stringify(caso[0]) + ': ' + JSON.stringify(lido));",
  "}",
  "",
  "console.log(JSON.stringify({ erros, problemas, juntada: juntada.slice(0, 110) }));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pecas-do-bolo.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("A pergunta juntada: " + JSON.stringify(r.juntada));
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("a etapa se deu por cumprida na hora errada", r.erros);
cobra("a pergunta do prato voltou, ou a leitura dele se perdeu", r.problemas);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o topo e o papel sao perguntados, o prato nao, e o prato dito e lido");
console.log("");
console.log("PASSOU");
