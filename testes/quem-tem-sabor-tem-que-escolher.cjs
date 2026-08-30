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
// E DESDE 30/08/2026 ELE MEDE TAMBEM O JEITO QUE O CLIENTE ESCREVE.
//
// O teste percorria so os 86 nomes CANONICOS, e o cliente nao escreve o nome do
// cardapio: escreve "risoles" e nao "risólis", "esfiha" e nao "esfirra",
// "chique" e nao "quiche". O proprio `sabor.ts` conta que isso ja foi defeito
// vivo, medido em 28/08/2026:
//
//     saborQueFalta("risolis")  ->  pergunta o sabor
//     saborQueFalta("risoles")  ->  NAO PERGUNTA
//     saborQueFalta("esfiha")   ->  NAO PERGUNTA
//
// Um item entrando com essa grafia atravessava a trava do fechamento em
// silencio, e a comanda saia SEM RECHEIO. O conserto esta feito, e nenhum teste
// media a grafia: as 35 do `apelidos.ts` que apontam pra produto com sabor
// passam a ser cobradas dos dois lados.
//
// O SABOR COLADO NO NOME TAMBEM CONTA COMO ESCOLHIDO.
//
// O leitor da frase anota "esfirra de carne" num campo so, e ai o sabor nao esta
// na observacao. Se o fechamento nao aceitasse isso, a padaria pediria o recheio
// que o cliente acabou de dizer, o que e a trava-que-nao-solta pelo outro lado.
//
// Roda com: node testes/quem-tem-sabor-tem-que-escolher.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-sabor.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { produtosDaCasa, categoriaDoPedido, pedeEscolhaDeSabor } from "../lib/ia/dados/produtos.ts";',
    'import { APELIDOS } from "../lib/ia/dados/apelidos.ts";',
    'import { oQueFaltaPraFechar } from "../lib/ia/fluxo/fechar.ts";',
    'import { ETAPAS_DA_FESTA, etapaDaVez, roteiroDoPedido } from "../lib/ia/fluxo/etapas.ts";',
    'import { falaDaEtapa } from "../lib/ia/fluxo/pergunta.ts";',
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const PECAS = {",
    "  'salgado-festa': 'salgados', 'docinho-festa': 'docinhos',",
    "  'bolo-festa': 'bolos-festa', 'bolo-caseiro': 'bolos-caseiros',",
    "  pizza: 'pizza', calzone: 'pizza', 'torta-fria': 'tortas-empadao',",
    "  empadao: 'tortas-empadao', 'torta-doce': 'tortas-empadao',",
    "  cupcake: 'cupcakes-franciscano', franciscano: 'cupcakes-franciscano',",
    "  pao: 'cucas-paes', cuca: 'cucas-paes',",
    "};",
    "",
    "const conf = ETAPAS_DA_FESTA.find((x) => x.id === 'confirmacao');",
    "const dados = ETAPAS_DA_FESTA.find((x) => x.id === 'dados');",
    "const base = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:true, naoQuer:[],",
    "  dados:{nome:'M', data:'28/08/2026', hora:'19:00', pagamento:'pix'},",
    "  pecas:null, topoNome:null, topoIdade:null, tema:null, escrito:null,",
    "  forminha:'rosa', prato:'aberto', ofereceu:true, ultimaFala:null,",
    "  insistiu:0, etapasJaPerguntadas:[], retomarEm:null, assunto:null,",
    "};",
    "const pedidoCom = (nome, obs) => ({ ...base,",
    "  itens: [{ produto: nome, categoria: categoriaDoPedido(nome), qtd: 2, obs: obs ?? null }] });",
    "",
    "const comSabor = produtosDaCasa().filter((p) => pedeEscolhaDeSabor(p));",
    "const semSabor = produtosDaCasa().filter((p) => !pedeEscolhaDeSabor(p));",
    "const ehPerguntaDeSabor = (t) => /vai de qu|card[aá]pio pra escolher/i.test(String(t));",
    "",
    "const fechamSemEscolher = [];",
    "const naoPerguntam = [];",
    "const naoPerguntamNoMeio = [];",
    "const naoFechamComOSabor = [];",
    "const naoPerguntamNaConversa = [];",
    "const pecaErrada = [];",
    "const etapaViraSalgado = [];",
    "const jaPerguntouPulou = [];",
    "const fechouEscrevendo = [];",
    "for (const p of comSabor) {",
    "  const e = pedidoCom(p.nome, null);",
    "  if (!oQueFaltaPraFechar(e).length) fechamSemEscolher.push(p.nome);",
    "  const f = falaDaEtapa(conf, e, 1000);",
    "  if (/Fechando o pedido/.test(String(f.texto))) naoPerguntam.push(p.nome);",
    "  const noMeio = falaDaEtapa(dados, e, 1000);",
    "  if (!ehPerguntaDeSabor(noMeio.texto)) {",
    "    naoPerguntamNoMeio.push(p.nome + ' / ' + p.categoria + ' -> ' + String(noMeio.texto).slice(0, 70));",
    "  }",
    "  const escolhido = pedidoCom(p.nome, p.sabores[0]);",
    "  if (oQueFaltaPraFechar(escolhido).length) {",
    "    naoFechamComOSabor.push(p.nome + ' (' + p.sabores[0] + ') -> ' + oQueFaltaPraFechar(escolhido).join('; '));",
    "  }",
    "  const colado = pedidoCom(p.nome + ' de ' + p.sabores[0], null);",
    "  if (oQueFaltaPraFechar(colado).length) {",
    "    naoFechamComOSabor.push(p.nome + ' de ' + p.sabores[0] + ' (colado no nome) -> ' + oQueFaltaPraFechar(colado).join('; '));",
    "  }",
    "  const etapa = etapaDaVez(e, roteiroDoPedido(e));",
    "  const naVez = falaDaEtapa(etapa, e, 1000);",
    "  if (!ehPerguntaDeSabor(naVez.texto)) {",
    "    naoPerguntamNaConversa.push(p.nome + ' etapa ' + etapa.id + ' -> ' + String(naVez.texto).slice(0, 70));",
    "  }",
    "  const esperada = PECAS[p.grupo];",
    "  if (esperada && naVez.cardapio !== esperada) {",
    "    pecaErrada.push(p.nome + ' grupo ' + p.grupo + ' -> ' + String(naVez.cardapio) + ' (queria ' + esperada + ')');",
    "  }",
    "  if (etapa.id === 'salgado' && !String(p.categoria).startsWith('salgado')) {",
    "    etapaViraSalgado.push(p.nome + ' / ' + p.categoria);",
    "  }",
    "  const pulado = { ...e, etapasJaPerguntadas: ['abertura', 'salgado', 'docinho', 'bolo', 'oferta', 'dados'], ofereceu: true };",
    "  const etapaPulo = etapaDaVez(pulado, roteiroDoPedido(pulado));",
    "  const falaPulo = falaDaEtapa(etapaPulo, pulado, 1000);",
    "  if (!ehPerguntaDeSabor(falaPulo.texto)) {",
    "    jaPerguntouPulou.push(p.nome + ' etapa ' + etapaPulo.id + ' -> ' + String(falaPulo.texto).slice(0, 70));",
    "  }",
    "}",
    "",
    "const pensarFecha = async () => ({ confirmou: true });",
    "for (const p of comSabor) {",
    "  const r = await responder(pedidoCom(p.nome, null), { texto: 'pode confirmar' }, pensarFecha);",
    "  if (r.confirmouEscrevendo) fechouEscrevendo.push(p.nome);",
    "  if (!ehPerguntaDeSabor(r.fala.texto)) fechouEscrevendo.push(p.nome + ' (fala: ' + String(r.fala.texto).slice(0, 50) + ')');",
    "}",
    "",
    "const perguntamFixoNaConversa = [];",
    "for (const p of semSabor) {",
    "  const e = pedidoCom(p.nome, null);",
    "  const etapa = etapaDaVez(e, roteiroDoPedido(e));",
    "  const f = falaDaEtapa(etapa, e, 1000);",
    "  if (ehPerguntaDeSabor(f.texto)) {",
    "    perguntamFixoNaConversa.push(p.nome + ' etapa ' + etapa.id + ' -> ' + String(f.texto).slice(0, 70));",
    "  }",
    "}",
    "",
    "const comSaborPorNome = new Map(comSabor.map((p) => [p.nome.toLowerCase(), p]));",
    "let grafias = 0;",
    "const grafiaNaoPergunta = [];",
    "const grafiaNaoFecha = [];",
    "for (const [canonico, escritas] of Object.entries(APELIDOS)) {",
    "  const p = comSaborPorNome.get(String(canonico).toLowerCase());",
    "  if (!p) continue;",
    "  for (const g of escritas) {",
    "    grafias++;",
    "    const semNada = oQueFaltaPraFechar(pedidoCom(g, null));",
    "    if (!semNada.some((x) => /sabor/.test(x))) {",
    "      grafiaNaoPergunta.push(g + ' (e ' + p.nome + ') -> falta: ' + (semNada.join('; ') || 'nada'));",
    "    }",
    "    for (const jeito of [pedidoCom(g, p.sabores[0]), pedidoCom(g + ' de ' + p.sabores[0], null)]) {",
    "      const falta = oQueFaltaPraFechar(jeito);",
    "      if (falta.length) grafiaNaoFecha.push(jeito.itens[0].produto + ' / obs ' + JSON.stringify(jeito.itens[0].obs) + ' -> ' + falta.join('; '));",
    "    }",
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
    "  const e = pedidoCom(p.nome, pedeEscolhaDeSabor(p) ? p.sabores[0] : null);",
    "  const f = falaDaEtapa(conf, e, 1000);",
    "  if (/forminha/i.test(String(f.texto))) perguntamCorEmPao.push(p.nome);",
    "}",
    "",
    "const fotoDe = (nome) => {",
    "  const p = produtosDaCasa().find((x) => x.nome === nome);",
    "  const e = pedidoCom(nome, null);",
    "  const etapa = etapaDaVez(e, roteiroDoPedido(e));",
    "  const f = falaDaEtapa(etapa, e, 1000);",
    "  return {",
    "    existe: Boolean(p), pede: pedeEscolhaDeSabor(p), etapa: etapa.id,",
    "    texto: f.texto, cardapio: f.cardapio,",
    "    falta: oQueFaltaPraFechar(e),",
    "  };",
    "};",
    "",
    "console.log(JSON.stringify({",
    "  comSabor: comSabor.length, semSabor: semSabor.length,",
    "  fechamSemEscolher, naoPerguntam, naoPerguntamNoMeio, naoFechamComOSabor, incomodam,",
    "  naoPerguntamNaConversa, pecaErrada, etapaViraSalgado, jaPerguntouPulou,",
    "  fechouEscrevendo, perguntamFixoNaConversa,",
    "  docinhos: docinhos.length, fechamSemCor, naoPerguntamCor, perguntamCorEmPao,",
    "  grafias, grafiaNaoPergunta, grafiaNaoFecha,",
    "  especificos: {",
    "    pizzaRedonda: fotoDe('pizza redonda'),",
    "    empadao: fotoDe('empadao'),",
    "    empadaoPalmito: fotoDe('empadao com palmito'),",
    "    calzone: fotoDe(produtosDaCasa().find((x) => x.nome.startsWith('calzone'))?.nome ?? 'calzone'),",
    "    esfirra: fotoDe('esfirra'),",
    "    coxinha: fotoDe('coxinha'),",
    "    trufa: fotoDe('trufa'),",
    "    miniPizza: fotoDe('mini pizza'),",
    "  },",
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
console.log("Grafias do cliente medidas nos produtos com sabor: " + r.grafias);
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

// 5. E VALE PRO JEITO QUE O CLIENTE ESCREVE, nao so pro nome do cardapio.
cobra("grafia do cliente que FECHA sem perguntar o sabor", r.grafiaNaoPergunta);
cobra("grafia do cliente que nao fecha nem com o sabor escolhido", r.grafiaNaoFecha);
if (!r.grafias) {
  falhas.push("nenhuma grafia do cliente foi medida: a varredura do apelidos.ts quebrou");
  console.log("ERRO  nenhuma grafia do cliente foi medida");
}

cobra("produto com sabor que na conversa (so aquele item) nao pergunta", r.naoPerguntamNaConversa);
cobra("produto com sabor que manda a peca de cardapio errada", r.pecaErrada);
cobra("produto que nao e salgado e a etapa virou salgado", r.etapaViraSalgado);
cobra("jaPerguntou pulou a pergunta de sabor", r.jaPerguntouPulou);
cobra("escrever pode confirmar fecha sem sabor", r.fechouEscrevendo);
cobra("produto de sabor fixo perguntado na conversa", r.perguntamFixoNaConversa);

const spec = r.especificos || {};
const cobraSpec = (rotulo, ok) => {
  if (!ok) {
    falhas.push(rotulo);
    console.log("ERRO  " + rotulo);
  } else {
    console.log("ok    " + rotulo);
  }
};
const pergunta = (x) => /vai de qu|card[aá]pio pra escolher/i.test(String((x || {}).texto));
cobraSpec("pizza redonda pede sabor e manda a peca da pizza",
  spec.pizzaRedonda?.pede && pergunta(spec.pizzaRedonda) && spec.pizzaRedonda.cardapio === "pizza" && spec.pizzaRedonda.etapa !== "salgado");
cobraSpec("empadao pede sabor e manda tortas-empadao",
  spec.empadao?.pede && pergunta(spec.empadao) && spec.empadao.cardapio === "tortas-empadao" && spec.empadao.etapa !== "salgado");
cobraSpec("empadao com palmito ainda pergunta (palmito no nome nao escolhe)",
  spec.empadaoPalmito?.pede && pergunta(spec.empadaoPalmito) && spec.empadaoPalmito.cardapio === "tortas-empadao");
cobraSpec("calzone pede sabor e manda a peca da pizza",
  spec.calzone?.pede && pergunta(spec.calzone) && spec.calzone.cardapio === "pizza" && spec.calzone.etapa !== "salgado");
cobraSpec("esfirra pede sabor e manda salgados",
  spec.esfirra?.pede && pergunta(spec.esfirra) && spec.esfirra.cardapio === "salgados");
cobraSpec("coxinha nao pede sabor",
  spec.coxinha?.existe && spec.coxinha.pede === false && !pergunta(spec.coxinha));
cobraSpec("trufa pede sabor, nao fecha sem, manda docinhos, etapa nao e salgado",
  spec.trufa?.existe && spec.trufa.pede && pergunta(spec.trufa) && spec.trufa.cardapio === "docinhos" && spec.trufa.etapa !== "salgado" && (spec.trufa.falta || []).some((x) => /sabor/.test(x)));
cobraSpec("mini pizza pede sabor na etapa do salgado, nao e pizza inteira",
  spec.miniPizza?.existe && spec.miniPizza.pede && spec.miniPizza.etapa === "salgado" && pergunta(spec.miniPizza) && spec.miniPizza.cardapio === "salgados");

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
