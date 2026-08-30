// SALGADO COM LISTA DE RECHEIO NAO PASSA SEM ESCOLHER.
//
// Palavra do dono: nao tem como passar sem escolher o sabor do salgado.
// Esfirra, quiche, empadinha, risoles, mini bolha: o catalogo tem sabores[] e
// nao tem saborFixo. Coxinha tem saborFixo: perguntar o recheio dela e bug.
//
// OS DOIS LADOS
//
//   1. esfirra sem sabor: pergunta, manda o cardapio, nao fecha, nao sai da
//      etapa. Nem com jaPerguntou, nem pela oferta, nem pela confirmacao.
//   2. coxinha: nao pergunta, a etapa cumpre, o pedido pode seguir.
//   3. 50 coxinha + esfirra sem sabor: ainda pergunta a esfirra.
//
// Pizza nao e esta etapa. Empadao pede sabor pelo portao da casa inteira, e
// nao segura a etapa do salgado: a categoria dele no catalogo nao e salgado.
//
// Roda com: node testes/o-salgado-nao-passa-sem-sabor.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-salgado-sabor.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { produtosDaCasa, categoriaDoPedido } from '../lib/ia/dados/produtos.ts';",
    "import { etapaDaVez, roteiroDoPedido, ETAPAS_DA_FESTA } from '../lib/ia/fluxo/etapas.ts';",
    "import { falaDaEtapa } from '../lib/ia/fluxo/pergunta.ts';",
    "import { oQueFaltaPraFechar } from '../lib/ia/fluxo/fechar.ts';",
    "import { responder } from '../lib/ia/fluxo/fluxo.ts';",
    "import { ehSalgadoDoCardapio, saboresDeSalgadoQueFaltam } from '../lib/ia/fluxo/sabor.ts';",
    "",
    "const dados = { nome: 'Joao', data: '10/09/2026', hora: '16:00', pagamento: 'pix' };",
    "const base = {",
    "  ehFesta: false, pessoas: null, base: null, baseAceita: false, naoQuer: ['docinho', 'bolo'],",
    "  dados, pecas: null, topoNome: null, topoIdade: null, escrito: null, tema: null,",
    "  forminha: null, prato: null, ofereceu: true, ultimaFala: null, insistiu: 0,",
    "  retomarEm: null, assunto: null, etapasJaPerguntadas: [],",
    "};",
    "const pedido = (itens, extra = {}) => ({ ...base, itens, ...extra });",
    "const etapaDe = (p) => etapaDaVez(p, roteiroDoPedido(p));",
    "const falaDe = (p) => {",
    "  const e = etapaDe(p);",
    "  return { etapa: e.id, fala: falaDaEtapa(e, p, 1000) };",
    "};",
    "",
    "const esfirra = [{ produto: 'esfirra', categoria: categoriaDoPedido('esfirra'), qtd: 50, obs: null }];",
    "const coxinha = [{ produto: 'coxinha', categoria: categoriaDoPedido('coxinha'), qtd: 50, obs: null }];",
    "const mistos = [",
    "  { produto: 'coxinha', categoria: categoriaDoPedido('coxinha'), qtd: 50, obs: null },",
    "  { produto: 'esfirra', categoria: categoriaDoPedido('esfirra'), qtd: 50, obs: null },",
    "];",
    "const pizza = [{ produto: 'pizza redonda', categoria: 'pizza', qtd: 1, obs: null }];",
    "const esfirraCategoriaErrada = [{ produto: 'esfirra', categoria: 'outro', qtd: 50, obs: null }];",
    "",
    "const jaPerguntou = ['abertura', 'salgado', 'oferta', 'dados'];",
    "const pEsfirra = pedido(esfirra);",
    "const pCoxinha = pedido(coxinha);",
    "const pMisto = pedido(mistos);",
    "const pPulado = pedido(esfirra, { etapasJaPerguntadas: jaPerguntou, assunto: 'salgado', ofereceu: true });",
    "const pOferta = pedido(esfirra, { etapasJaPerguntadas: ['salgado', 'oferta'], ofereceu: false });",
    "const pConf = pedido(esfirra, { etapasJaPerguntadas: jaPerguntou, ofereceu: true });",
    "const pErrada = pedido(esfirraCategoriaErrada, { etapasJaPerguntadas: jaPerguntou });",
    "const pPizza = pedido(pizza);",
    "const pCoxinhaMaisPizza = pedido([...coxinha, ...pizza]);",
    "",
    "const conf = ETAPAS_DA_FESTA.find((x) => x.id === 'confirmacao');",
    "const salgado = ETAPAS_DA_FESTA.find((x) => x.id === 'salgado');",
    "",
    "const rEsfirra = falaDe(pEsfirra);",
    "const rCoxinha = falaDe(pCoxinha);",
    "const rMisto = falaDe(pMisto);",
    "const rPulado = falaDe(pPulado);",
    "const rOferta = falaDe(pOferta);",
    "const rConf = falaDe(pConf);",
    "const rErrada = falaDe(pErrada);",
    "const rPizza = falaDe(pPizza);",
    "const rCoxinhaMaisPizza = falaDe(pCoxinhaMaisPizza);",
    "",
    "const pensarFecha = async () => ({ confirmou: true, naoQuer: ['docinho', 'bolo'] });",
    "const fechouEsfirra = await responder(pEsfirra, { texto: 'pode confirmar' }, pensarFecha);",
    "const fechouCoxinha = await responder(pCoxinha, { texto: 'pode confirmar' }, pensarFecha);",
    "",
    "const pedemEscolha = produtosDaCasa().filter((p) =>",
    "  String(p.categoria).startsWith('salgado') && !p.saborFixo && p.sabores.length);",
    "const fixos = produtosDaCasa().filter((p) =>",
    "  String(p.categoria).startsWith('salgado') && p.saborFixo);",
    "",
    "const salgadoQueFechaSemSabor = [];",
    "const salgadoQueNaoPergunta = [];",
    "const salgadoQueNaoMandaCardapio = [];",
    "for (const p of pedemEscolha) {",
    "  const e = pedido([{ produto: p.nome, categoria: p.categoria, qtd: 20, obs: null }]);",
    "  if (!oQueFaltaPraFechar(e).some((x) => /sabor/.test(x))) salgadoQueFechaSemSabor.push(p.nome);",
    "  const f = falaDaEtapa(salgado, e, 1000);",
    "  if (!/vai de qu/i.test(String(f.texto))) salgadoQueNaoPergunta.push(p.nome + ' -> ' + String(f.texto).slice(0, 80));",
    "  if (f.cardapio !== 'salgados') salgadoQueNaoMandaCardapio.push(p.nome + ' -> ' + String(f.cardapio));",
    "}",
    "const fixoPerguntado = [];",
    "const fixoQueNaoCumpre = [];",
    "for (const p of fixos) {",
    "  const e = pedido([{ produto: p.nome, categoria: p.categoria, qtd: 20, obs: null }]);",
    "  const f = falaDaEtapa(salgado, e, 1000);",
    "  if (/vai de qu/i.test(String(f.texto))) fixoPerguntado.push(p.nome + ' -> ' + String(f.texto).slice(0, 80));",
    "  if (!salgado.cumprida(e)) fixoQueNaoCumpre.push(p.nome);",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  esfirra: {",
    "    etapa: rEsfirra.etapa,",
    "    texto: rEsfirra.fala.texto,",
    "    cardapio: rEsfirra.fala.cardapio,",
    "    falta: oQueFaltaPraFechar(pEsfirra),",
    "    cumprida: salgado.cumprida(pEsfirra),",
    "    fecha: fechouEsfirra.confirmouEscrevendo,",
    "    etapaDepois: fechouEsfirra.etapa,",
    "    falaDepois: fechouEsfirra.fala.texto,",
    "    cardapioDepois: fechouEsfirra.fala.cardapio,",
    "  },",
    "  coxinha: {",
    "    etapa: rCoxinha.etapa,",
    "    texto: rCoxinha.fala.texto,",
    "    cardapio: rCoxinha.fala.cardapio,",
    "    faltaSabor: oQueFaltaPraFechar(pCoxinha).filter((x) => /sabor/.test(x)),",
    "    cumprida: salgado.cumprida(pCoxinha),",
    "    etapaDepois: fechouCoxinha.etapa,",
    "    perguntaSabor: /vai de qu/i.test(String(rCoxinha.fala.texto)),",
    "  },",
    "  misto: {",
    "    etapa: rMisto.etapa,",
    "    texto: rMisto.fala.texto,",
    "    cardapio: rMisto.fala.cardapio,",
    "    falta: oQueFaltaPraFechar(pMisto),",
    "    cumprida: salgado.cumprida(pMisto),",
    "  },",
    "  pulos: {",
    "    jaPerguntou: rPulado.etapa,",
    "    oferta: rOferta.etapa,",
    "    confirmacao: rConf.etapa,",
    "    categoriaErrada: rErrada.etapa,",
    "    falaPulado: rPulado.fala.texto,",
    "    cardapioPulado: rPulado.fala.cardapio,",
    "    falaConf: falaDaEtapa(conf, pConf, 1000).texto,",
    "  },",
    "  pizza: {",
    "    etapa: rPizza.etapa,",
    "    ehSalgado: ehSalgadoDoCardapio('pizza redonda', 'salgado_frito'),",
    "    faltaSalgado: saboresDeSalgadoQueFaltam(pizza).length,",
    "    coxinhaMaisPizzaEtapa: rCoxinhaMaisPizza.etapa,",
    "    coxinhaMaisPizzaPerguntaSalgado: /esfirra|salgado vai de/i.test(String(rCoxinhaMaisPizza.fala.texto)),",
    "  },",
    "  catalogo: {",
    "    pedemEscolha: pedemEscolha.map((p) => p.nome),",
    "    salgadoQueFechaSemSabor, salgadoQueNaoPergunta, salgadoQueNaoMandaCardapio,",
    "    fixoPerguntado, fixoQueNaoCumpre,",
    "  },",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-salgado-sabor.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, ok) => {
  if (!ok) falhas.push(rotulo);
  console.log((ok ? "ok    " : "ERRO  ") + rotulo);
};

console.log("== esfirra sem sabor ==");
cobra("a etapa fica no salgado", r.esfirra.etapa === "salgado");
cobra("a etapa nao se da por cumprida", r.esfirra.cumprida === false);
cobra("pergunta o recheio", /vai de qu/i.test(String(r.esfirra.texto)));
cobra("manda o cardapio de salgados", r.esfirra.cardapio === "salgados");
cobra("o fechamento cobra o sabor", (r.esfirra.falta || []).some((x) => /sabor/.test(x)));
cobra("escrever pode confirmar nao fecha", r.esfirra.fecha !== true);
cobra("depois do pode confirmar continua no salgado", r.esfirra.etapaDepois === "salgado");
cobra("depois do pode confirmar ainda pergunta e manda o cardapio",
  /vai de qu/i.test(String(r.esfirra.falaDepois)) && r.esfirra.cardapioDepois === "salgados");

console.log("");
console.log("== coxinha, recheio fixo ==");
cobra("nao pergunta o recheio da coxinha", r.coxinha.perguntaSabor === false);
cobra("a etapa do salgado cumpre", r.coxinha.cumprida === true);
cobra("o fechamento nao cobra sabor da coxinha", !(r.coxinha.faltaSabor || []).length);
cobra("a conversa sai da etapa do salgado", r.coxinha.etapa !== "salgado");

console.log("");
console.log("== 50 coxinha + esfirra sem sabor ==");
cobra("a etapa volta pro salgado", r.misto.etapa === "salgado");
cobra("pergunta a esfirra", /esfirra/i.test(String(r.misto.texto)) && /vai de qu/i.test(String(r.misto.texto)));
cobra("manda o cardapio", r.misto.cardapio === "salgados");
cobra("o fechamento cobra o sabor da esfirra", (r.misto.falta || []).some((x) => /esfirra/i.test(x)));
cobra("a etapa nao cumpre", r.misto.cumprida === false);

console.log("");
console.log("== nao pula por jaPerguntou, oferta ou confirmacao ==");
cobra("ja perguntou o salgado e ainda fica", r.pulos.jaPerguntou === "salgado");
cobra("a oferta nao engole o recheio", r.pulos.oferta === "salgado");
cobra("a confirmacao nao engole o recheio", r.pulos.confirmacao === "salgado");
cobra("categoria errada no item ainda segura", r.pulos.categoriaErrada === "salgado");
cobra("a fala do pulo pergunta e manda o cardapio",
  /vai de qu/i.test(String(r.pulos.falaPulado)) && r.pulos.cardapioPulado === "salgados");
cobra("no resumo tambem pergunta, nao fecha calado", /vai de qu/i.test(String(r.pulos.falaConf)));

console.log("");
console.log("== pizza nao e esta etapa ==");
cobra("pizza redonda nao conta como salgado do catalogo", r.pizza.ehSalgado === false);
cobra("pizza sem sabor nao e falta de salgado", r.pizza.faltaSalgado === 0);
cobra("coxinha + pizza nao pergunta recheio de salgado", r.pizza.coxinhaMaisPizzaPerguntaSalgado === false);
cobra("coxinha + pizza sai da etapa do salgado", r.pizza.coxinhaMaisPizzaEtapa !== "salgado");

console.log("");
console.log("== o catalogo inteiro dos salgados ==");
console.log("pedem escolha: " + r.catalogo.pedemEscolha.join(", "));
cobra("nenhum salgado com lista fecha sem sabor", !r.catalogo.salgadoQueFechaSemSabor.length);
cobra("todo salgado com lista e perguntado", !r.catalogo.salgadoQueNaoPergunta.length);
cobra("todo salgado com lista manda o cardapio", !r.catalogo.salgadoQueNaoMandaCardapio.length);
cobra("nenhum salgado de recheio fixo e perguntado", !r.catalogo.fixoPerguntado.length);
cobra("todo salgado de recheio fixo cumpre a etapa", !r.catalogo.fixoQueNaoCumpre.length);
if (r.catalogo.salgadoQueFechaSemSabor.length) {
  console.log("        fecha sem sabor: " + r.catalogo.salgadoQueFechaSemSabor.join(" | "));
}
if (r.catalogo.salgadoQueNaoPergunta.length) {
  console.log("        nao pergunta: " + r.catalogo.salgadoQueNaoPergunta.join(" | "));
}
if (r.catalogo.fixoPerguntado.length) {
  console.log("        fixo perguntado: " + r.catalogo.fixoPerguntado.join(" | "));
}

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: esfirra sem sabor nao passa; coxinha nao e perguntada.");
