// PRODUTO COM SABOR NAO FECHA SEM SABOR ESCOLHIDO. OS 86.
//
// POR QUE ISTO EXISTE
//
// Regra do dono, 23/08/2026: "nunca pode produto com sabor ser fechado sem
// sabor escolhido, tanto trufa, docinho, cuca, tudo; isso e geral da padaria".
// E ele completou: "tem itens que ja tem sabor e nao precisa selecionar, so os
// que precisa selecionar tem a regra".
//
// E em 26/08/2026, quando eu disse que tinha consertado a pizza, ele voltou nela:
// "tem q ter a regra ne mano dos sabores, se o produto tem sabor tem q escolher
// ne". Ele estava certo em cobrar: eu tinha conferido nos produtos que TOQUEI, e
// a regra tem que valer pra classe.
//
// POR QUE ISSO E DE PRODUCAO, NAO DE CONVERSA
//
// Comanda com "2 kg de empadao" sem dizer se e de frango ou de palmito para a
// cozinha no meio da manha, e alguem tem que ligar pro cliente.
//
// ESTE TESTE PERCORRE O CATALOGO INTEIRO e cobra os TRES lados. Os tres, porque
// os tres ja quebraram neste projeto:
//
//   1. quem tem sabor NAO FECHA sem escolher;
//   2. quem tem sabor E PERGUNTADO. Bloquear sem perguntar e pior que o
//      defeito: a padaria recusa fechar, nao diz o que falta, e o cliente fica
//      olhando o mesmo resumo pra sempre. Eu fiz isso TRES VEZES em 26/08, e o
//      dono me parou na primeira;
//   3. quem NAO tem sabor nao e incomodado. Guarda que trava venda e pior que o
//      bug, e perguntar o recheio da coxinha, que e fixo, e fazer o cliente
//      escolher o que nao tem escolha.
//
// Produto novo no cardapio ja nasce coberto: se ele tiver sabor e ninguem
// perguntar, isto aqui quebra antes de chegar no cliente.
//
// Roda com: node testes/quem-tem-sabor-tem-que-escolher.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-sabor.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { produtosDaCasa, categoriaDoPedido } from "../lib/ia/dados/produtos.ts";',
    'import { oQueFaltaPraFechar } from "../lib/ia/fluxo/fechar.ts";',
    'import { ETAPAS_DA_FESTA } from "../lib/ia/fluxo/etapas.ts";',
    'import { falaDaEtapa } from "../lib/ia/fluxo/pergunta.ts";',
    "",
    "const conf = ETAPAS_DA_FESTA.find((x) => x.id === 'confirmacao');",
    "const dados = ETAPAS_DA_FESTA.find((x) => x.id === 'dados');",
    "// Um pedido com TUDO respondido menos o sabor: e assim que da pra medir o",
    "// sabor sozinho, sem a data ou o nome mascararem o resultado.",
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
    "const comSabor = produtosDaCasa().filter((p) => !p.saborFixo && p.sabores.length > 0);",
    "const semSabor = produtosDaCasa().filter((p) => p.saborFixo || !p.sabores.length);",
    "",
    "const fechamSemEscolher = [];",
    "const naoPerguntam = [];",
    "const naoPerguntamNoMeio = [];",
    "const naoFechamComOSabor = [];",
    "for (const p of comSabor) {",
    "  const e = pedidoCom(p.nome, null);",
    "  if (!oQueFaltaPraFechar(e).length) fechamSemEscolher.push(p.nome);",
    "  const f = falaDaEtapa(conf, e, 1000);",
    "  if (/Fechando o pedido/.test(String(f.texto))) naoPerguntam.push(p.nome);",
    "  const noMeio = falaDaEtapa(dados, e, 1000);",
    "  if (!/vai de qu|card[aá]pio pra escolher/i.test(String(noMeio.texto))) {",
    "    naoPerguntamNoMeio.push(p.nome + ' / ' + p.categoria + ' -> ' + String(noMeio.texto).slice(0, 70));",
    "  }",
    "  // E O CONTRARIO: com o sabor escolhido, tem que fechar. Sem isto a regra",
    "  // viraria uma trava que nunca solta.",
    "  const escolhido = pedidoCom(p.nome, p.sabores[0]);",
    "  if (oQueFaltaPraFechar(escolhido).length) {",
    "    naoFechamComOSabor.push(p.nome + ' (' + p.sabores[0] + ') -> ' + oQueFaltaPraFechar(escolhido).join('; '));",
    "  }",
    "}",
    "",
    "const incomodam = [];",
    "for (const p of semSabor) {",
    "  const falta = oQueFaltaPraFechar(pedidoCom(p.nome, null));",
    "  if (falta.some((x) => /sabor|qual/.test(x))) incomodam.push(p.nome + ' -> ' + falta.join('; '));",
    "}",
    "",
    "const docinhos = produtosDaCasa().filter((p) => String(p.categoria).startsWith('docinho'));",
    "const fechamSemCor = [];",
    "const naoPerguntamCor = [];",
    "const perguntamCorEmPao = [];",
    "for (const p of docinhos) {",
    "  const obs = (!p.saborFixo && p.sabores.length) ? p.sabores[0] : null;",
    "  const e = { ...pedidoCom(p.nome, obs), forminha: null };",
    "  e.itens = e.itens.map((i) => ({ ...i, obs }));",
    "  if (!oQueFaltaPraFechar(e).some((x) => /forminha/i.test(x))) fechamSemCor.push(p.nome);",
    "  const f = falaDaEtapa(conf, e, 1000);",
    "  if (!/forminha/i.test(String(f.texto))) naoPerguntamCor.push(p.nome + ' -> ' + String(f.texto).slice(0, 80));",
    "}",
    "for (const p of produtosDaCasa().filter((x) => x.categoria === 'padaria')) {",
    "  const e = pedidoCom(p.nome, (!p.saborFixo && p.sabores[0]) ? p.sabores[0] : null);",
    "  const f = falaDaEtapa(conf, e, 1000);",
    "  if (/forminha/i.test(String(f.texto))) perguntamCorEmPao.push(p.nome);",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  comSabor: comSabor.length, semSabor: semSabor.length,",
    "  fechamSemEscolher, naoPerguntam, naoPerguntamNoMeio, naoFechamComOSabor, incomodam,",
    "  docinhos: docinhos.length, fechamSemCor, naoPerguntamCor, perguntamCorEmPao,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-sabor.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

console.log("Produtos com sabor pra escolher: " + r.comSabor);
console.log("Produtos de sabor fixo ou sem sabor: " + r.semSabor);
console.log("");

const cobra = (rotulo, lista) => {
  if (lista.length) {
    falhas.push(rotulo + ": " + lista.join(" | "));
    console.log("ERRO  " + rotulo + " (" + lista.length + ")");
    for (const x of lista.slice(0, 10)) console.log("        " + x);
  } else {
    console.log("ok    " + rotulo + ": nenhum");
  }
};

// 1. QUEM TEM SABOR NAO FECHA SEM ESCOLHER.
cobra("produto com sabor que FECHA sem escolher", r.fechamSemEscolher);

// 2. E E PERGUNTADO. Bloquear sem perguntar e pior que o defeito: a padaria
// recusa fechar, nao diz o que falta, e o cliente fica olhando o mesmo resumo.
cobra("produto que bloqueia e NAO pergunta", r.naoPerguntam);
cobra("produto com sabor que na etapa dos DADOS nao pergunta o sabor", r.naoPerguntamNoMeio);

// 3. E COM O SABOR ESCOLHIDO, FECHA. Senao a regra vira trava que nunca solta.
cobra("produto que nao fecha nem com o sabor escolhido", r.naoFechamComOSabor);

// 4. E QUEM NAO TEM SABOR NAO E INCOMODADO. Perguntar o recheio da coxinha, que
// e fixo, e fazer o cliente escolher o que nao tem escolha.
cobra("produto de sabor fixo sendo perguntado a toa", r.incomodam);

cobra("docinho que FECHA sem cor de forminha", r.fechamSemCor);
cobra("docinho que bloqueia a cor e NAO pergunta", r.naoPerguntamCor);
cobra("pao ou cuca sendo perguntado a cor da forminha", r.perguntamCorEmPao);

console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: quem tem sabor escolhe e e perguntado; quem nao tem passa direto.");
