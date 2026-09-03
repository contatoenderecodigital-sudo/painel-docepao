// O SABOR QUE A CASA USA EM MAIS DE UM LUGAR VIRA PERGUNTA, E NAO CHUTE.
//
// POR QUE ISTO EXISTE, e custou R$ 2.345,00 numa frase de quatro palavras
//
// Medido conversando com a producao em 02/09/2026:
//
//   cliente >> quero 50 de morango
//   pedido  >> 50 x bolo, categoria de festa      (50 QUILOS, R$ 2.345,00)
//   padaria >> "E o bolo, qual sabor?"            (ele acabou de dizer)
//
// Ela decidiu DUAS coisas sozinha, que era bolo e que eram quilos, e perguntou
// a unica que ele ja tinha respondido. Morango na Doce Pao e bolo, torta doce E
// trufa; entre a trufa (R$ 2,25 a unidade) e o bolo (R$ 49,90 o quilo) a
// diferenca passa de vinte vezes.
//
// Palavra dele: *"nesse momento ela tinha que ter pedido: quer o que de
// morango? Cada caso e um caso, nao quero isso de regra toda vez que fala
// morango: e pra ela identificar isso sozinha pra qualquer caso de produtos com
// nomes e sabores similares"*.
//
// POR ISSO NAO HA PALAVRA NENHUMA ESCRITA NESTE TESTE COMO REGRA. Quem responde
// "onde este nome aparece?" e `gruposComEstaPalavra`, varrendo os nomes e os
// sabores dos 86 produtos. O dia em que a dona cadastrar maracuja no docinho e
// no bolo, a pergunta nasce sozinha, e a ultima conferencia daqui cobra isso.
//
// E SO QUANDO NAO HA CONTEXTO. Quem escreve "bolo de morango" ja disse o grupo,
// e quem esta na etapa do docinho tambem: o desempate acontece antes e o item
// nem chega como nome de familia. A pergunta e o ultimo recurso.
//
// A ISCA: tirando a chamada de `falaDoSaborDisputado` em `pergunta.ts`, os dois
// primeiros casos voltam a ouvir "E o bolo, qual sabor?".
//
// Roda com: node testes/o-sabor-que-a-casa-usa-em-dois-lugares-vira-pergunta.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "sabor de tres grupos sem contexto vira pergunta",
    fala: "quero 50 de morango",
    leitura: { itens: [{ produto: "morango", qtd: 50 }] },
    tem: ["morango", "bolo", "trufa"],
    naoTem: ["qual sabor"],
    dano: "50 QUILOS de bolo, R$ 2.345,00, e perguntando o sabor que ele acabou de dizer",
  },
  {
    nome: "e a pergunta lista o que a casa realmente tem",
    fala: "quero 50 de limao",
    leitura: { itens: [{ produto: "limão", qtd: 50 }] },
    tem: ["limão", "cuca recheada", "trufa"],
    naoTem: ["padaria"],
    dano: "\"voce quer padaria de limao?\" nao e portugues; ninguem pede padaria",
  },
  {
    // QUEM JA DISSE O GRUPO NAO E PERGUNTADO DE NOVO.
    nome: "com o grupo dito na frase, nao ha duvida",
    fala: "quero um bolo de morango",
    leitura: { itens: [{ produto: "bolo morango", qtd: 0 }] },
    naoTem: ["em mais de uma coisa"],
    dano: "perguntar de novo o que ele acabou de dizer faz a padaria parecer robo",
  },
  {
    nome: "produto que so existe num lugar passa direto",
    fala: "quero 50 coxinha",
    leitura: { itens: [{ produto: "coxinha", qtd: 50 }] },
    naoTem: ["em mais de uma coisa"],
    dano: "perguntar onde nao ha duvida e o jeito mais rapido de cansar o cliente",
  },
];

const sonda = path.join(__dirname, "_sonda-disputado.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { gruposComEstaPalavra } from "../lib/ia/dados/produtos.ts";',
    'import { produtosDaCasa } from "../lib/ia/dados/produtos.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:[],",
    "    dados:{nome:null,data:null,hora:null,pagamento:null},",
    "    pecas:null, topoNome:null, topoIdade:null, tema:null, forminha:null, prato:null,",
    "    ultimaFala:null, insistiu:0, retomarEm:null, assunto:null,",
    "    etapasJaPerguntadas:['abertura'], etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, (async () => c.leitura) as never);",
    "  saiu.push(String(r.fala.texto || ''));",
    "}",
    "// A LISTA SAI DO CARDAPIO: nenhuma palavra disputada pode ficar sem resposta.",
    "const semAc = (t) => String(t).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();",
    "const palavras = new Set();",
    "for (const p of produtosDaCasa()) {",
    "  if (p.nomeCurto) palavras.add(semAc(p.nomeCurto));",
    "  for (const s of p.sabores) palavras.add(semAc(s));",
    "}",
    "const disputadas = [...palavras].filter((w) => gruposComEstaPalavra(w).length > 1);",
    "const semOpcoes = disputadas.filter((w) => gruposComEstaPalavra(w).some((g) => !String(g).trim()));",
    "console.log(JSON.stringify({ saiu, quantasDisputadas: disputadas.length, semOpcoes }));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-disputado.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 300000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== o sabor usado em dois lugares vira pergunta ==");
CASOS.forEach((c, n) => {
  const texto = String(r.saiu[n] || "").toLowerCase();
  const problemas = [];
  for (const parte of c.tem ?? []) {
    if (!texto.includes(parte.toLowerCase())) {
      problemas.push('nao diz "' + parte + '": ' + JSON.stringify(r.saiu[n].slice(0, 80)));
    }
  }
  for (const parte of c.naoTem ?? []) {
    if (texto.includes(parte.toLowerCase())) problemas.push('diz "' + parte + '", e nao devia');
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

// A CONFERENCIA QUE NAO DEPENDE DE EXEMPLO: o cardapio inteiro.
console.log(
  (r.quantasDisputadas > 0 ? "ok    " : "ERRO  ") +
    "o cardapio tem " + r.quantasDisputadas + " palavras usadas em mais de um grupo" +
    (r.quantasDisputadas > 0 ? "" : "  ->  a varredura nao achou nenhuma; ela parou de medir"),
);
if (!r.quantasDisputadas) erros++;
console.log(
  (r.semOpcoes.length === 0 ? "ok    " : "ERRO  ") +
    "toda palavra disputada tem opcao com nome" +
    (r.semOpcoes.length ? "  ->  sem nome: " + r.semOpcoes.join(", ") + "; a pergunta sairia com um buraco" : ""),
);
if (r.semOpcoes.length) erros++;

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
