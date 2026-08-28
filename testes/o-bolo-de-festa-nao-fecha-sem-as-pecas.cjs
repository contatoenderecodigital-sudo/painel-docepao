// O BOLO DE FESTA NAO FECHA SEM PERGUNTAR O PRATO, O TOPO E O PAPEL DE ARROZ.
//
// POR QUE ISTO EXISTE
//
// Medido em 28/08/2026, numa conversa de verdade contra a producao, sem eu
// falar dessas tres coisas em nenhum momento:
//
//     cliente >> boa noite, quero encomendar pra uma festa de 20 pessoas
//     cliente >> nao quero salgadinho, so docinho e bolo
//     cliente >> pode ser assim
//     cliente >> 100 brigadeiro, forminha azul
//     cliente >> o bolo e de brigadeiro, 2 kg
//     padaria >> Para qual dia voce quer buscar?          <-- pulou tudo
//     cliente >> dia 12/09 as 10h, nome Ana Paula, pix
//     padaria >> Fechando o pedido: ...
//
// O pedido foi pra fila com um bolo de festa de 2 kg e a cozinha sem saber se
// leva topo, se leva papel de arroz, e em que prato vai.
//
// O topo e o item que a EQUIPE precisa orcar (o valor muda com o tema) e que
// tem prazo de dois dias com a fornecedora. O papel de arroz custa R$ 12,00 e a
// padaria vende. E ela chegava a AVISAR que existe, no cardapio de bolos, e
// nunca perguntava se ele queria.
//
// A CAUSA: UMA ETAPA COM DUAS PERGUNTAS SE AUTO-CUMPRIA
//
// A conversa marca "ja perguntei" por ETAPA. A etapa do bolo faz DUAS
// perguntas -- o sabor, e depois o prato -- entao a marca deixada pela pergunta
// do SABOR fazia a etapa se dar por cumprida antes de o prato sair.
//
// E a etapa das pecas confiava na mesma marca (`jaPerguntou(p, "bolo")`), entao
// morria junto: num pedido com bolo, a etapa do bolo SEMPRE e perguntada, logo
// as pecas nasciam cumpridas.
//
// Medido com a regra de ontem, direto na funcao:
//
//     em aberto  <- ninguem perguntou nada ainda
//     CUMPRIDA   <- a padaria perguntou SO o sabor do bolo
//
// O conserto: a marca passa a guardar a PERGUNTA junto com a etapa ("bolo" e
// "bolo:prato"), e cada etapa olha a marca que prova a SUA pergunta.
//
// O QUE ELE COBRA
//
//   1. so o sabor perguntado -> as duas etapas continuam abertas
//   2. o prato perguntado -> a do bolo fecha, a das pecas continua aberta
//   3. a pergunta JUNTADA (pra quem manda tudo de uma vez) cobre as tres
//   4. cada pergunta do bolo tem a sua chave, senao a marca volta a ser so da
//      etapa e o defeito volta calado
//
// Roda com: node testes/o-bolo-de-festa-nao-fecha-sem-as-pecas.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-pecas-do-bolo.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { ROTEIRO_DA_FESTA } from '../lib/ia/fluxo/etapas.ts';",
    "import { falaDaEtapa } from '../lib/ia/fluxo/pergunta.ts';",
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
    "// 1. so o sabor: as duas continuam abertas",
    "let p = com({}, ['bolo', 'bolo:sabor']);",
    "cobra('so o sabor perguntado, a etapa do bolo', bolo.cumprida(p), false);",
    "cobra('so o sabor perguntado, a etapa das pecas', pecas.cumprida(p), false);",
    "",
    "// 2. o prato perguntado: a do bolo fecha, a das pecas nao",
    "p = com({}, ['bolo', 'bolo:sabor', 'bolo:prato']);",
    "cobra('prato perguntado, a etapa do bolo', bolo.cumprida(p), true);",
    "cobra('prato perguntado, a etapa das pecas', pecas.cumprida(p), false);",
    "",
    "// 3. a pergunta juntada cobre as tres",
    "p = com({}, ['bolo', 'bolo:tres']);",
    "cobra('pergunta juntada, a etapa do bolo', bolo.cumprida(p), true);",
    "cobra('pergunta juntada, a etapa das pecas', pecas.cumprida(p), true);",
    "",
    "// 4. quem RESPONDEU nao e perguntado de novo",
    "p = com({ prato: 'aberto', pecas: { topo: false, papelDeArroz: false } }, []);",
    "cobra('ele ja respondeu tudo, a etapa do bolo', bolo.cumprida(p), true);",
    "cobra('ele ja respondeu tudo, a etapa das pecas', pecas.cumprida(p), true);",
    "",
    "// 5. CADA PERGUNTA DO BOLO TEM A SUA CHAVE.",
    "//",
    "// Sem chave a marca volta a ser so da etapa, e o defeito volta calado.",
    "const semChave = [];",
    "// SEM SABOR o item e o generico 'bolo'; COM sabor ele ja tem nome proprio.",
    "// E o nome do item que diz se o sabor foi escolhido, nao a marca da",
    "// pergunta: a primeira versao deste teste usou 'bolo brigadeiro' pros dois",
    "// e a fala ja veio a do prato, porque o sabor ja estava resolvido.",
    "const semSabor = { ...BASE, itens: [{ produto: 'bolo', categoria: 'bolo_festa', qtd: 2, obs: null }], etapasJaPerguntadas: [] };",
    "const falaSabor = falaDaEtapa(bolo, semSabor, 21880);",
    "if (!/qual sabor/i.test(falaSabor.texto)) semChave.push('a primeira fala do bolo nao e a do sabor: ' + JSON.stringify(falaSabor.texto.slice(0, 60)));",
    "else if (falaSabor.chave !== 'sabor') semChave.push('a pergunta do sabor: ' + JSON.stringify(falaSabor.chave));",
    "",
    "// com o sabor ja escolhido, a proxima fala da MESMA etapa e a do prato",
    "const comSabor = { ...BASE, etapasJaPerguntadas: ['bolo', 'bolo:sabor'] };",
    "const falaPrato = falaDaEtapa(bolo, comSabor, 21880);",
    "if (!/prato/i.test(falaPrato.texto)) semChave.push('a segunda fala do bolo nao e a do prato: ' + JSON.stringify(falaPrato.texto.slice(0, 60)));",
    "else if (falaPrato.chave !== 'prato') semChave.push('a pergunta do prato: ' + JSON.stringify(falaPrato.chave));",
    "",
    "const falaPecas = falaDaEtapa(pecas, BASE, 21880);",
    "if (!/papel de arroz|topo/i.test(falaPecas.texto)) semChave.push('a fala das pecas nao fala de papel nem de topo: ' + JSON.stringify(falaPecas.texto.slice(0, 60)));",
    "",
    "console.log(JSON.stringify({ erros, semChave, falaPecas: falaPecas.texto.slice(0, 80) }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pecas-do-bolo.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("A fala das pecas: " + JSON.stringify(r.falaPecas));
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
cobra("a pergunta perdeu a chave que a identifica", r.semChave);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o prato, o topo e o papel de arroz sao perguntados antes de fechar");
console.log("");
console.log("PASSOU");
