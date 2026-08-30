// MINI PIZZA E SALGADO. PIZZA NAO E. TRUFA PEDE SABOR.
//
// POR QUE ISTO EXISTE
//
// 1. Produto com lista de sabor no catalogo nao fecha sem escolher. Trufa tem
//    nove sabores no cardapio; coxinha tem recheio fixo e nao pergunta.
//
// 2. Conversao ao vivo: "quero pizza e salgado" na etapa do salgado carimbava
//    pizza como salgado_frito. Mini pizza (salgado assado no catalogo) pode
//    ficar na etapa do salgado. Pizza, pizza redonda, pizza inteira, pizza meia
//    e calzone nao sao essa etapa, e nao viram a pizza de forma a R$ 120.
//
// OS DOIS LADOS
//
//   trufa sem sabor: pergunta, nao fecha. coxinha: nao pergunta.
//   mini pizza: etapa salgado, categoria salgado_assado.
//   pizza redonda na etapa do salgado: categoria pizza, nao salgado_frito.
//
// Roda com: node testes/opcao-e-mini-pizza.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-opcao-mini-pizza.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { produtosDaCasa, pedeEscolhaDeSabor, categoriaDoPedido } from '../lib/ia/dados/produtos.ts';",
    "import { identificarProduto } from '../lib/ia/fluxo/produto.ts';",
    "import { nomeDaFamilia, ehNomeDeFamilia, ehPizzaQueNaoESalgado } from '../lib/ia/fluxo/generico.ts';",
    "import { categoriaDaEtapa } from '../lib/ia/fluxo/fluxo.ts';",
    "import { etapaDaVez, roteiroDoPedido } from '../lib/ia/fluxo/etapas.ts';",
    "import { falaDaEtapa } from '../lib/ia/fluxo/pergunta.ts';",
    "import { oQueFaltaPraFechar } from '../lib/ia/fluxo/fechar.ts';",
    "import { leituraQueCabeNaEtapa } from '../lib/ia/fluxo/leitura.ts';",
    "import { responder } from '../lib/ia/fluxo/fluxo.ts';",
    "",
    "const ident = (t, cat) => identificarProduto(t, cat);",
    "const casa = produtosDaCasa();",
    "const trufa = casa.find((p) => p.nome === 'trufa');",
    "const mini = casa.find((p) => p.nome === 'mini pizza');",
    "const coxinha = casa.find((p) => p.nome === 'coxinha');",
    "const comSabor = casa.filter((p) => pedeEscolhaDeSabor(p)).map((p) => p.nome);",
    "",
    "const base = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[],",
    "  dados:{nome:'M', data:'28/08/2026', hora:'19:00', pagamento:'pix'},",
    "  pecas:null, topoNome:null, topoIdade:null, tema:null, escrito:null,",
    "  forminha:'rosa', prato:'aberto', ofereceu:true, ultimaFala:null,",
    "  insistiu:0, etapasJaPerguntadas:[], retomarEm:null, assunto:null,",
    "};",
    "const pedidoCom = (nome, cat, obs) => ({ ...base,",
    "  itens: [{ produto: nome, categoria: cat, qtd: 2, obs: obs ?? null }] });",
    "",
    "const pTrufa = pedidoCom('trufa', categoriaDoPedido('trufa'), null);",
    "const pCoxinha = pedidoCom('coxinha', categoriaDoPedido('coxinha'), null);",
    "const pMini = pedidoCom('mini pizza', categoriaDoPedido('mini pizza'), null);",
    "const pRedondaNaSalgado = pedidoCom('pizza redonda', categoriaDaEtapa('salgado', 'pizza redonda'), null);",
    "const pPizzaNaFesta = {",
    "  ...base, ehFesta:true, pessoas:20, baseAceita:true,",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "  itens:[{ produto:'pizza redonda', categoria: categoriaDaEtapa('salgado','pizza redonda'), qtd:1, obs:null }],",
    "  etapasJaPerguntadas:['quantas_pessoas','base_da_festa'],",
    "};",
    "",
    "const portaSalgado = leituraQueCabeNaEtapa('salgado', {",
    "  itens: [",
    "    { produto: 'pizza', qtd: 1 },",
    "    { produto: 'pizza redonda', qtd: 1 },",
    "    { produto: 'mini pizza', qtd: 20 },",
    "    { produto: 'calzone', qtd: 1 },",
    "  ],",
    "});",
    "",
    "const pensarPizza = async () => ({ itens: [{ produto: 'pizza redonda', qtd: 1 }] });",
    "const naSalgado = {",
    "  ...base, ehFesta:true, pessoas:20, baseAceita:true,",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "  itens:[], etapasJaPerguntadas:['quantas_pessoas','base_da_festa'],",
    "};",
    "const rPizzaNaSalgado = await responder(naSalgado, { texto: 'quero pizza redonda' }, pensarPizza);",
    "",
    "console.log(JSON.stringify({",
    "  trufa: trufa && { pede: pedeEscolhaDeSabor(trufa), n: trufa.sabores.length, fixo: trufa.saborFixo },",
    "  mini: mini && { pede: pedeEscolhaDeSabor(mini), cat: mini.categoria, n: mini.sabores.length },",
    "  coxinha: coxinha && { pede: pedeEscolhaDeSabor(coxinha), fixo: coxinha.saborFixo },",
    "  comSabor,",
    "  ident: {",
    "    pizza: ident('pizza').produto,",
    "    pizzaNaSalgado: ident('pizza', 'salgado_frito').produto,",
    "    redonda: ident('pizza redonda', 'salgado_frito').produto,",
    "    mini: ident('mini pizza', 'pizza').produto,",
    "    umaMini: ident('uma mini pizza', 'salgado_frito').produto,",
    "    pizzaDe: ident('pizza de calabresa', 'salgado_frito'),",
    "  },",
    "  fam: {",
    "    pizza: nomeDaFamilia('pizza'),",
    "    mini: nomeDaFamilia('mini pizza'),",
    "    ehMini: ehNomeDeFamilia('mini pizza'),",
    "    ehPizza: ehNomeDeFamilia('pizza'),",
    "    pizzaNaoSalgado: ehPizzaQueNaoESalgado('pizza redonda'),",
    "    miniNaoSalgado: ehPizzaQueNaoESalgado('mini pizza'),",
    "  },",
    "  cats: {",
    "    pizzaNaSalgado: categoriaDaEtapa('salgado', 'pizza'),",
    "    redondaNaSalgado: categoriaDaEtapa('salgado', 'pizza redonda'),",
    "    pizzaDeNaSalgado: categoriaDaEtapa('salgado', 'pizza de calabresa'),",
    "    inteiraNaSalgado: categoriaDaEtapa('salgado', 'pizza inteira'),",
    "    meiaNaSalgado: categoriaDaEtapa('salgado', 'pizza meia'),",
    "    calzoneNaSalgado: categoriaDaEtapa('salgado', 'calzone'),",
    "    miniNaSalgado: categoriaDaEtapa('salgado', 'mini pizza'),",
    "    umaMiniNaSalgado: categoriaDaEtapa('salgado', 'uma mini pizza'),",
    "    coxinhaNaSalgado: categoriaDaEtapa('salgado', 'coxinha'),",
    "  },",
    "  etapaMini: etapaDaVez(pMini, roteiroDoPedido(pMini)).id,",
    "  etapaRedonda: etapaDaVez(pRedondaNaSalgado, roteiroDoPedido(pRedondaNaSalgado)).id,",
    "  falaTrufa: falaDaEtapa(etapaDaVez(pTrufa, roteiroDoPedido(pTrufa)), pTrufa, 1000),",
    "  falaCoxinha: falaDaEtapa(etapaDaVez(pCoxinha, roteiroDoPedido(pCoxinha)), pCoxinha, 1000),",
    "  falaMini: falaDaEtapa(etapaDaVez(pMini, roteiroDoPedido(pMini)), pMini, 1000),",
    "  faltaTrufa: oQueFaltaPraFechar(pTrufa),",
    "  faltaCoxinha: oQueFaltaPraFechar(pCoxinha),",
    "  faltaMini: oQueFaltaPraFechar(pMini),",
    "  porta: {",
    "    produtos: (portaSalgado.limpa.itens || []).map((i) => i.produto),",
    "    naoExistem: portaSalgado.naoExistem,",
    "  },",
    "  depoisDaFala: rPizzaNaSalgado.estado.itens.map((i) => ({ produto: i.produto, categoria: i.categoria, qtd: i.qtd })),",
    "  etapaFestaPizza: etapaDaVez(pPizzaNaFesta, roteiroDoPedido(pPizzaNaFesta)).id,",
    "  falaFestaPizza: falaDaEtapa(etapaDaVez(pPizzaNaFesta, roteiroDoPedido(pPizzaNaFesta)), pPizzaNaFesta, 1000),",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-opcao-mini-pizza.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, ok, detalhe) => {
  if (ok) console.log("ok    " + rotulo);
  else {
    falhas.push(rotulo);
    console.log("ERRO  " + rotulo);
    if (detalhe) console.log("        " + detalhe);
  }
};

cobra("trufa existe no catalogo e pede escolha", Boolean(r.trufa) && r.trufa.pede && r.trufa.n === 9 && r.trufa.fixo === false, JSON.stringify(r.trufa));
cobra("coxinha nao pede sabor", Boolean(r.coxinha) && r.coxinha.pede === false, JSON.stringify(r.coxinha));
cobra("mini pizza pede sabor e e salgado assado", Boolean(r.mini) && r.mini.pede && r.mini.cat === "salgado_assado", JSON.stringify(r.mini));
cobra("trufa esta na varredura de quem tem sabor", (r.comSabor || []).includes("trufa"), JSON.stringify(r.comSabor));
cobra("mini pizza esta na varredura de quem tem sabor", (r.comSabor || []).includes("mini pizza"));

cobra('"pizza" continua familia, mesmo na dica de salgado', r.ident.pizza === "pizza" && r.ident.pizzaNaSalgado === "pizza", JSON.stringify(r.ident));
cobra("pizza redonda na dica de salgado continua redonda", r.ident.redonda === "pizza redonda", JSON.stringify(r.ident.redonda));
cobra("mini pizza nao vira pizza inteira", r.ident.mini === "mini pizza", JSON.stringify(r.ident.mini));
cobra('"uma mini pizza" e o salgado, nao a familia pizza', r.ident.umaMini === "mini pizza", JSON.stringify(r.ident.umaMini));
cobra('"pizza de calabresa" e familia pizza, nao mini pizza', r.ident.pizzaDe && r.ident.pizzaDe.produto === "pizza" && r.ident.pizzaDe.recheio === "calabresa", JSON.stringify(r.ident.pizzaDe));

cobra("nomeDaFamilia(pizza) e pizza", r.fam.pizza === "pizza");
cobra("nomeDaFamilia(mini pizza) nao e pizza", r.fam.mini !== "pizza" && r.fam.ehMini === false, JSON.stringify(r.fam));
cobra("pizza redonda e pizza que nao e salgado", r.fam.pizzaNaoSalgado === true);
cobra("mini pizza nao conta como pizza de verdade", r.fam.miniNaoSalgado === false);

cobra("pizza na etapa do salgado e categoria pizza", r.cats.pizzaNaSalgado === "pizza", JSON.stringify(r.cats.pizzaNaSalgado));
cobra("pizza redonda na etapa do salgado e pizza, nao salgado_frito", r.cats.redondaNaSalgado === "pizza", JSON.stringify(r.cats.redondaNaSalgado));
cobra("pizza de calabresa na etapa do salgado e pizza, nao salgado_frito", r.cats.pizzaDeNaSalgado === "pizza", JSON.stringify(r.cats.pizzaDeNaSalgado));
cobra("pizza inteira na etapa do salgado e pizza", r.cats.inteiraNaSalgado === "pizza");
cobra("pizza meia na etapa do salgado e pizza", r.cats.meiaNaSalgado === "pizza");
cobra("calzone na etapa do salgado nao e salgado_frito", r.cats.calzoneNaSalgado === "calzone", JSON.stringify(r.cats.calzoneNaSalgado));
cobra("mini pizza na etapa do salgado e salgado_assado", r.cats.miniNaSalgado === "salgado_assado", JSON.stringify(r.cats.miniNaSalgado));
cobra("uma mini pizza na etapa do salgado e salgado_assado", r.cats.umaMiniNaSalgado === "salgado_assado", JSON.stringify(r.cats.umaMiniNaSalgado));
cobra("coxinha na etapa do salgado continua frito", r.cats.coxinhaNaSalgado === "salgado_frito");

cobra("mini pizza sozinha cai na etapa do salgado", r.etapaMini === "salgado", JSON.stringify(r.etapaMini));
cobra("pizza redonda sozinha nao fica presa na etapa do salgado", r.etapaRedonda !== "salgado", JSON.stringify(r.etapaRedonda));

const perguntaSabor = (t) => /vai de qu|card[aá]pio pra escolher/i.test(String(t));
cobra("trufa sem sabor pergunta e nao fecha", perguntaSabor(r.falaTrufa && r.falaTrufa.texto) && (r.faltaTrufa || []).some((x) => /sabor/.test(x)), JSON.stringify({ fala: r.falaTrufa, falta: r.faltaTrufa }));
cobra("coxinha nao pergunta sabor e pode fechar o sabor", !perguntaSabor(r.falaCoxinha && r.falaCoxinha.texto) && !(r.faltaCoxinha || []).some((x) => /sabor/.test(x)), JSON.stringify({ fala: r.falaCoxinha, falta: r.faltaCoxinha }));
cobra("mini pizza pergunta sabor do salgado, nao cota R$ 120", perguntaSabor(r.falaMini && r.falaMini.texto) && r.falaMini.cardapio === "salgados" && !/120/.test(String(r.falaMini.texto || "")), JSON.stringify(r.falaMini));
cobra("mini pizza sem sabor nao fecha", (r.faltaMini || []).some((x) => /sabor/.test(x)), JSON.stringify(r.faltaMini));

const porta = r.porta || {};
cobra("na etapa do salgado, pizza familia nao some", (porta.produtos || []).includes("pizza"), JSON.stringify(porta));
cobra("na etapa do salgado, pizza redonda nao some", (porta.produtos || []).includes("pizza redonda"), JSON.stringify(porta));
cobra("na etapa do salgado, mini pizza entra", (porta.produtos || []).includes("mini pizza"), JSON.stringify(porta));
cobra("na etapa do salgado, calzone nao some", (porta.produtos || []).includes("calzone"), JSON.stringify(porta));
cobra("pizza nao e 'nao achei no cardapio' na etapa do salgado", !(porta.naoExistem || []).includes("pizza"), JSON.stringify(porta.naoExistem));

const depois = r.depoisDaFala || [];
const redonda = depois.find((i) => i.produto === "pizza redonda");
cobra("anotar pizza redonda na etapa do salgado grava categoria pizza", Boolean(redonda) && redonda.categoria === "pizza", JSON.stringify(depois));
cobra("pizza redonda anotada na festa nao leva os 200 da base", Boolean(redonda) && Number(redonda.qtd) !== 200 && Number(redonda.qtd) <= 2, JSON.stringify(redonda));

cobra("festa so com pizza redonda nao fica so na etapa do salgado se falta sabor de pizza", r.etapaFestaPizza !== "salgado" || perguntaSabor(r.falaFestaPizza && r.falaFestaPizza.texto), JSON.stringify({ etapa: r.etapaFestaPizza, fala: r.falaFestaPizza }));
cobra("festa com pizza redonda pergunta sabor de pizza, nao so salgado", perguntaSabor(r.falaFestaPizza && r.falaFestaPizza.texto) && r.falaFestaPizza.cardapio === "pizza", JSON.stringify(r.falaFestaPizza));

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
