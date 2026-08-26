// O QUE O CEREBRO VELHO SABIA, O FLUXO TEM QUE SABER.
//
// POR QUE ISTO EXISTE
//
// Em 26/08/2026 o dono mandou apagar o cerebro antigo (`lib/ia/cerebro.ts`,
// 7.397 linhas) e as guardas dele (`lib/ia/guardas.ts`, 1.944 linhas), e pediu
// uma garantia junto: "sem esquecer de nada".
//
// O risco era concreto. Trinta e cinco testes olhavam SO o cerebro morto, e
// cada um deles protegia uma regra que veio de defeito real, com cliente na
// linha. Apagar sem conferir some com a regra e ninguem descobre ate acontecer
// de novo.
//
// O levantamento esta em `O-QUE-O-VELHO-PROTEGIA.md`, com o veredito de cada
// regra. Este teste guarda as que o fluxo NAO tinha e que foram trazidas.
//
// Roda com: node testes/o-que-o-velho-sabia-o-novo-sabe.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-velho.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { dataDeRetirada } from "../lib/ia/fluxo/falas-do-cliente.ts";',
    'import { lerAFrase } from "../lib/ia/fluxo/leitor-da-frase.ts";',
    "",
    "// Hoje fixo pra prova nao mudar de resultado amanha. 26/08/2026 e QUARTA.",
    "const hoje = new Date('2026-08-26T12:00:00-03:00');",
    "const pag = (f) => lerAFrase(f)?.dados?.pagamento ?? null;",
    "",
    "console.log(JSON.stringify({",
    "  dia: {",
    "    quartaNumaQuarta: dataDeRetirada('quero pra quarta-feira', hoje),",
    "    quinta:           dataDeRetirada('quinta', hoje),",
    "    sabado:           dataDeRetirada('pode ser sabado', hoje),",
    "    sextaDeManha:     dataDeRetirada('sexta de manha', hoje),",
    "    numeroContinua:   dataDeRetirada('dia 12/09', hoje),",
    "    // Os dois na mesma frase: o NUMERO ganha do nome, sempre.",
    "    nomeENumeroJuntos: dataDeRetirada('quarta-feira, dia 27/08', hoje),",
    "    nomeENumeroComAno: dataDeRetirada('sexta-feira dia 28/08/2026', hoje),",
    "    diaQueNaoExiste:  dataDeRetirada('31/02', hoje),",
    "    semData:          dataDeRetirada('pra amanha', hoje),",
    "  },",
    "  pagamento: {",
    "    corrigiuDepois:   pag('pago no pix, na verdade no cartao'),",
    "    negouOSegundo:    pag('no cartao mesmo, esquece o pix'),",
    "    negouOPrimeiro:   pag('nao e pix nao, e dinheiro'),",
    "    semOPrimeiro:     pag('sem pix, pode ser cartao'),",
    "    umSo:             pag('vou pagar no cartao'),",
    "    trocouDuasVezes:  pag('pago em dinheiro... nao, melhor pix'),",
    "    naoFalou:         pag('quero 100 coxinhas'),",
    "  },",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-velho.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, foi, esperado) => {
  if (foi !== esperado) falhas.push(rotulo + ": veio " + JSON.stringify(foi) + ", esperado " + JSON.stringify(esperado));
  console.log((foi === esperado ? "ok    " : "ERRO  ") + rotulo.padEnd(50) + JSON.stringify(foi));
};

// ---------------------------------------------------------------------------
// 1. O NOME DO DIA DA SEMANA VIRA DATA.
//
// "sexta" e "sabado que vem" e como se marca encomenda numa padaria. Exigir
// 12/09 de quem fala assim transforma a atendente em formulario.
//
// O cerebro velho convertia. O fluxo devolvia null, e a padaria perguntava a
// data de novo pra quem ja tinha respondido: e o mesmo defeito de "resposta
// dada nao pode ser perguntada de novo", com outra roupa.
//
// SEMPRE PRA FRENTE: quem diz quarta numa quarta quer a quarta que vem. Marcar
// pra hoje sem ele pedir e erro que a cozinha paga.
// ---------------------------------------------------------------------------
console.log("== o nome do dia da semana vira data (hoje: quarta, 26/08/2026) ==");
cobra("quarta dita numa quarta e a quarta QUE VEM", r.dia.quartaNumaQuarta, "02/09/2026");
cobra("quinta e amanha", r.dia.quinta, "27/08/2026");
cobra("sabado e depois de amanha e mais um", r.dia.sabado, "29/08/2026");
cobra("sexta de manha ainda e sexta", r.dia.sextaDeManha, "28/08/2026");
cobra("a data em numero continua funcionando", r.dia.numeroContinua, "12/09/2026");
// "quarta-feira, dia 27/08" e como gente escreve, com os dois na mesma frase.
// Eu pus o nome na frente do numero e o 27/08 passou a ser ignorado: a padaria
// anotava a proxima quarta em vez do dia que o cliente escreveu. Quebrou o
// qa-pedido-completo na hora, antes de chegar em qualquer cliente.
cobra("com nome E numero, ganha o NUMERO", r.dia.nomeENumeroJuntos, "27/08/2026");
cobra("com nome E numero com ano, ganha o NUMERO", r.dia.nomeENumeroComAno, "28/08/2026");
cobra("31 de fevereiro nao existe: null", r.dia.diaQueNaoExiste, null);
cobra("frase sem data nenhuma: null", r.dia.semData, null);

// ---------------------------------------------------------------------------
// 2. A FORMA DE PAGAMENTO E A ULTIMA QUE O CLIENTE FALOU.
//
// Foi pra producao em 19/08/2026: o cliente nunca falou pix, a padaria anotou
// pix, ele corrigiu pra cartao, ouviu "anotei que o pagamento sera no cartao" e
// o pedido fechou com PIX.
//
// A causa era um `break` no primeiro que casasse, e o primeiro da lista e o
// pix. O cerebro velho tinha guarda pra isso; o fluxo nao tinha.
//
// E FORMA NEGADA NAO CONTA: "no cartao mesmo, esquece o pix" termina em pix e
// mesmo assim o cliente quer cartao. Sem esta parte, o "ultimo ganha" acerta a
// correcao normal e erra a correcao por negacao, que e igual de comum.
// ---------------------------------------------------------------------------
console.log("");
console.log("== o pagamento e o ULTIMO que ele falou, e negado nao conta ==");
cobra("'no pix, na verdade no cartao' e cartao", r.pagamento.corrigiuDepois, "cartao");
cobra("'no cartao, esquece o pix' e cartao", r.pagamento.negouOSegundo, "cartao");
cobra("'nao e pix nao, e dinheiro' e dinheiro", r.pagamento.negouOPrimeiro, "dinheiro");
cobra("'sem pix, pode ser cartao' e cartao", r.pagamento.semOPrimeiro, "cartao");
cobra("uma forma so continua funcionando", r.pagamento.umSo, "cartao");
cobra("'dinheiro... nao, melhor pix' e pix", r.pagamento.trocouDuasVezes, "pix");
cobra("quem nao falou de pagamento fica null", r.pagamento.naoFalou, null);

console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: o que o velho sabia, o fluxo sabe.");
