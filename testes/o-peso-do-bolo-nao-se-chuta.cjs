// O PESO DO BOLO NAO SE CHUTA. A PADARIA PERGUNTA.
//
// Cliente real em 31/08/2026, e ele teve que corrigir a padaria:
//
//   cliente >> gostaria de encomendar um bolo, quanto ficaria?
//   padaria >> E o bolo, qual sabor?
//   cliente >> Laka e biz
//   padaria >> (nunca perguntou o peso)
//   resumo  >> 1 kg de bolo biz   R$ 49,90
//   cliente >> o bolo é 2kg, não 1kg
//
// Bolo de festa e vendido POR QUILO, e a quantidade da linha E o peso. Sem
// ninguem falar de peso, o modelo devolve qtd 1 (porque "um bolo" e um bolo) e
// isso virava PRECO: metade do dinheiro, em todo pedido em que o cliente nao
// pensa em dizer os quilos, que e a maioria. Ninguem diz "quero 2 kg de bolo",
// diz "quero um bolo".
//
// Este cliente percebeu no resumo. Quem nao perceber leva metade do bolo.
//
// AS BORDAS, e todas custam dinheiro:
//
//   - na FESTA nao se pergunta: o peso saiu da proposta que ele aceitou
//   - "2 quilos e meio" sao 2,5 e nao 2      (R$ 24,95 de diferenca)
//   - "500g" e "700 gramas" sao peso        (metade dos tamanhos da dona nao e
//     quilo inteiro: 300 g, 500, 700, 1 kg, 1,5, 1,7, 2, 2,5)
//   - enquanto o bolo e so a FAMILIA, o numero que ele falou continua sendo dele
//     ("quero 50 de morango" guarda o 50 pra padaria perguntar qual bolo)
//
// A ISCA: tirando o bloco que zera a qtd em `fluxo.ts`, o primeiro caso volta a
// fechar com 1 kg calado.
//
// Roda com: node testes/o-peso-do-bolo-nao-se-chuta.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const FESTA = { ehFesta: true, pessoas: 20, base: { salgados: 200, docinhos: 100, boloKg: 2, totalCentavos: 41880 }, baseAceita: true };

const CASOS = [
  {
    nome: "sem peso dito, a padaria pergunta em vez de chutar 1 kg",
    fala: "Laka e biz",
    leitura: { itens: [{ produto: "bolo laka", qtd: 1, sabor: "laka e biz" }] },
    peso: 0,
    perguntaTem: "quilos",
    dano: "1 kg calado, e o cliente so descobre no resumo; metade do dinheiro do bolo",
  },
  {
    nome: "com o peso dito, segue pras pecas",
    fala: "2 kg de laka e biz",
    leitura: { itens: [{ produto: "bolo laka", qtd: 2, sabor: "laka e biz" }] },
    peso: 2,
    perguntaNaoTem: "quilos",
    dano: "perguntar o que ele acabou de dizer",
  },
  {
    nome: "dois quilos e meio sao 2,5",
    fala: "quero de 2 quilos e meio",
    leitura: { itens: [{ produto: "bolo laka", qtd: 2.5 }] },
    itens: [{ produto: "bolo laka", categoria: "bolo_festa", qtd: 0, unidade: "kg", obs: null }],
    peso: 2.5,
    dano: "R$ 24,95 a menos, e um bolo menor do que a festa dele precisa",
  },
  {
    nome: "500g e peso",
    fala: "pode ser 500g",
    leitura: { itens: [{ produto: "bolo laka", qtd: 0.5 }] },
    itens: [{ produto: "bolo laka", categoria: "bolo_festa", qtd: 0, unidade: "kg", obs: null }],
    peso: 0.5,
    dano: "o menor redondo da casa e 300 g; sem gramas, metade dos tamanhos nao entra",
  },
  {
    nome: "700 gramas tambem",
    fala: "700 gramas",
    leitura: { itens: [{ produto: "bolo laka", qtd: 0.7 }] },
    itens: [{ produto: "bolo laka", categoria: "bolo_festa", qtd: 0, unidade: "kg", obs: null }],
    peso: 0.7,
    dano: "700 g e um dos degraus que a dona citou no audio",
  },
  {
    // O BECO QUE A PERGUNTA ABRIU, e ele era pior que o defeito original.
    //
    //   padaria >> O pao frances é vendido por quilo. Quantos quilos você quer?
    //   cliente >> 2
    //   padaria >> O pao frances é vendido por quilo. Quantos quilos você quer?
    //
    // Ninguem repete a unidade na resposta: a padaria pergunta em quilo e a
    // pessoa responde "2". Sem ler isso como peso, a conversa nunca saia do
    // lugar. Quem da sentido a resposta e a pergunta que acabou de sair, e nao
    // a forma da frase, que e a mesma regra do "Sim" digitado.
    nome: "depois da pergunta do peso, numero solto e peso",
    itens: [{ produto: "pao frances", categoria: "padaria", qtd: 0, unidade: "kg", obs: null }],
    ultimaPergunta: "O pao frances é vendido por quilo, R$ 11,99 o quilo. Quantos quilos você quer?",
    fala: "2",
    leitura: { itens: [{ produto: "pao frances", qtd: 2 }] },
    peso: 2,
    dano: "a conversa entrava num beco e o cliente ia embora",
  },
  {
    nome: "\"um e meio\" e um e meio, e nao meio",
    itens: [{ produto: "pao frances", categoria: "padaria", qtd: 0, unidade: "kg", obs: null }],
    ultimaPergunta: "O pao frances é vendido por quilo, R$ 11,99 o quilo. Quantos quilos você quer?",
    fala: "um e meio",
    leitura: { itens: [{ produto: "pao frances", qtd: 1.5 }] },
    peso: 1.5,
    dano: "um terco do que a pessoa pediu, e ela so descobre na balanca",
  },
  {
    // O BECO CONTINUAVA ABERTO QUANDO O MODELO NAO DEVOLVIA ITEM.
    //
    // Conversando com a producao em 31/08/2026, com o pao dele:
    //
    //   cliente >> bom dia, quero 50 pao frances pra amanha
    //   padaria >> O pao frances é vendido por quilo, R$ 11,99 o quilo.
    //              Quantos quilos você quer?
    //   cliente >> 2 kg
    //   padaria >> O pao frances é vendido por quilo... (a MESMA pergunta)
    //
    // O peso so era lido dentro do laco dos itens do modelo. Quem responde so o
    // peso nao cita produto nenhum, entao o modelo devolve lista VAZIA, o laco
    // nao roda e a resposta se perde. Os dois casos de cima passavam verdes
    // porque a sonda mandava o item na leitura: aqui a leitura vem vazia, que e
    // o que a producao faz.
    nome: "com o modelo devolvendo NADA, o peso dito ainda vale",
    itens: [{ produto: "pao frances", categoria: "padaria", qtd: 0, unidade: "kg", obs: null }],
    ultimaPergunta: "O pao frances é vendido por quilo, R$ 11,99 o quilo. Quantos quilos você quer?",
    fala: "2 kg",
    leitura: { itens: [] },
    peso: 2,
    perguntaNaoTem: "quantos quilos",
    dano: "a conversa nunca saia do lugar e o cliente ia embora",
  },
  {
    nome: "e com o modelo devolvendo NADA, o numero solto tambem",
    itens: [{ produto: "pao frances", categoria: "padaria", qtd: 0, unidade: "kg", obs: null }],
    ultimaPergunta: "O pao frances é vendido por quilo, R$ 11,99 o quilo. Quantos quilos você quer?",
    fala: "2",
    leitura: { itens: [] },
    peso: 2,
    perguntaNaoTem: "quantos quilos",
    dano: "o mesmo beco, na resposta mais curta que existe",
  },
  {
    // O ESTRAGO QUE A PERGUNTA DO PESO FEZ SOZINHA, medido em 01/09/2026:
    //
    //   padaria >> Quantos quilos voce quer?
    //   cliente >> nao quero topo nem papel de arroz nem prato
    //   padaria >> (a mesma pergunta)
    //   cliente >> dia 12 as 15h
    //   pedido  >> 12 kg de bolo biz     R$ 598,80 no lugar de R$ 99,80
    //
    // Foi defeito meu, do dia anterior: ensinei a ler numero solto como peso e
    // nao disse o que e "solto". Enquanto a pergunta ficasse de pe, qualquer
    // numero de qualquer frase virava quilo.
    nome: "\"dia 12 as 15h\" NAO e doze quilos",
    itens: [{ produto: "bolo biz", categoria: "bolo_festa", qtd: 0, unidade: "kg", obs: null }],
    ultimaPergunta: "O bolo é vendido por quilo. Quantos quilos você quer? A gente faz de 300 g até 6 kg.",
    fala: "dia 12 as 15h",
    leitura: { itens: [], dados: { data: "12/09/2026", hora: "15:00" } },
    peso: 0,
    dano: "R$ 499,00 a mais num bolo so, e o cliente so descobre no resumo",
  },
  {
    nome: "e a data sem hora tambem nao",
    itens: [{ produto: "bolo biz", categoria: "bolo_festa", qtd: 0, unidade: "kg", obs: null }],
    ultimaPergunta: "O bolo é vendido por quilo. Quantos quilos você quer? A gente faz de 300 g até 6 kg.",
    fala: "pode ser dia 20",
    leitura: { itens: [], dados: { data: "20/09/2026" } },
    peso: 0,
    dano: "vinte quilos de bolo, R$ 998,00",
  },
  {
    nome: "numero solto FORA da pergunta do peso nao vira peso",
    itens: [{ produto: "pao frances", categoria: "padaria", qtd: 0, unidade: "kg", obs: null }],
    ultimaPergunta: "Quer levar docinho junto?",
    fala: "2",
    leitura: { itens: [{ produto: "pao frances", qtd: 2 }] },
    peso: 0,
    dano: "qualquer numero da conversa viraria peso do que estivesse em aberto",
  },
  {
    nome: "na festa o peso vem da proposta, e nao se pergunta",
    extra: FESTA,
    fala: "de laka e biz",
    leitura: { itens: [{ produto: "bolo laka", qtd: 2, sabor: "laka e biz" }] },
    peso: 2,
    perguntaNaoTem: "quilos",
    dano: "perguntar de novo o que foi combinado duas mensagens atras",
  },
];

const sonda = path.join(__dirname, "_sonda-peso-do-bolo.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const pensar = (l) => (async () => l);",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:c.itens ?? [],",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null,",
    "    ultimaFala: c.ultimaPergunta ?? 'E o bolo, qual sabor?', insistiu:0, retomarEm:null, assunto:null,",
    "    etapasJaPerguntadas:['bolo','resto_do_cardapio'], etapasAdiadas:[], pecasMandadas:['bolos-festa'],",
    "    ...(c.extra ?? {}),",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, pensar(c.leitura) as never);",
    "  const bolo = r.estado.itens.find((i) => String(i.categoria || '').startsWith('bolo') || String(i.categoria || '') === 'padaria');",
    "  saiu.push({ peso: bolo ? Number(bolo.qtd) : null, pergunta: String(r.fala.texto || '') });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-peso-do-bolo.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== o peso do bolo nao se chuta ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  if (Math.abs(Number(r.peso) - c.peso) > 0.001) {
    problemas.push("o peso ficou " + r.peso + ", esperado " + c.peso);
  }
  if (c.perguntaTem && !new RegExp(c.perguntaTem, "i").test(r.pergunta)) {
    problemas.push("a padaria nao perguntou o peso: " + JSON.stringify(r.pergunta.slice(0, 60)));
  }
  if (c.perguntaNaoTem && new RegExp(c.perguntaNaoTem, "i").test(r.pergunta)) {
    problemas.push("perguntou o peso sem precisar: " + JSON.stringify(r.pergunta.slice(0, 60)));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
