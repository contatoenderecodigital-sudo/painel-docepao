// A COR DA FORMINHA VEM DEPOIS DE SABER QUAL DOCINHO.
//
// Achado por ele na conversa de 02/09/2026, e foi a PRIMEIRA coisa que a padaria
// disse depois de ele pedir quatro grupos:
//
//   16:12  cliente >> quero bolo, salgados, docinhos e cupcakes
//   16:12  padaria >> De que cor voce quer a forminha dos docinhos?
//   16:12  cliente >> lilas
//   16:12  padaria >> Agora os docinhos: quais voce quer?
//
// Palavra dele: *"pediu a forminha antes da pessoa falar os docinhos que
// queria"*. A cor saiu antes da escolha, e a pergunta da escolha veio depois.
//
// A COR CONTINUA SENDO COBRADA, e isso e regra da dona: ela monta a forminha
// antes de rechear, entao a cor precisa estar na comanda. O que muda e a ORDEM:
// a cor e detalhe DE UM DOCINHO, e perguntar a cor de um docinho que ninguem
// escolheu e perguntar o enfeite antes da comida.
//
// O SINAL E O LUGAR VAZIO DA FAMILIA. Um item "docinho" sem sabor quer dizer
// "ele pediu docinho e ainda nao disse quais". Enquanto ele estiver ali, a
// pergunta e "quais voce quer?".
//
// A ISCA: tirando o bloco `aindaGenerico` de `pergunta.ts`, o primeiro caso
// volta a perguntar a cor antes.
//
// Roda com: node testes/a-cor-vem-depois-de-saber-qual-docinho.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "so o lugar vazio do docinho: pergunta QUAIS, e nao a cor",
    itens: [{ produto: "docinho", categoria: "docinho", qtd: 0, obs: null }],
    forminha: null,
    tem: ["quais"],
    naoTem: ["cor", "forminha"],
    dano: "a padaria pede a cor de um docinho que ninguem escolheu, e depois pergunta qual",
  },
  {
    nome: "os quatro grupos da conversa dele: mesma coisa",
    itens: [
      { produto: "bolo", categoria: "bolo_festa", qtd: 0, obs: null },
      { produto: "salgado", categoria: "outro", qtd: 0, obs: null },
      { produto: "docinho", categoria: "docinho", qtd: 0, obs: null },
      { produto: "cupcake", categoria: "cupcake", qtd: 0, obs: null },
    ],
    forminha: null,
    naoTem: ["cor da forminha"],
    dano: "foi exatamente o que aconteceu no teste dele de 02/09/2026",
  },
  {
    // A COR CONTINUA SENDO COBRADA. Com o docinho escolhido e a quantidade
    // dita, nao ha mais o que perguntar antes dela.
    nome: "com o docinho escolhido, a cor e perguntada",
    itens: [{ produto: "brigadeiro", categoria: "docinho", qtd: 50, obs: null }],
    forminha: null,
    tem: ["cor"],
    dano: "a dona monta a forminha antes de rechear: sem a cor a producao para",
  },
  {
    nome: "com a cor ja dita, ninguem pergunta de novo",
    itens: [{ produto: "brigadeiro", categoria: "docinho", qtd: 50, obs: null }],
    forminha: "rosa",
    naoTem: ["cor da forminha"],
    dano: "perguntar duas vezes a mesma coisa faz o cliente achar que ela nao anotou",
  },
];

const sonda = path.join(__dirname, "_sonda-ordem-cor.mts");
fs.writeFileSync(
  sonda,
  [
    'import { roteiroDoPedido, etapaDaVez } from "../lib/ia/fluxo/etapas.ts";',
    'import { falaDaEtapa } from "../lib/ia/fluxo/pergunta.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const p = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:c.itens,",
    "    dados:{nome:'Ana',data:'10/09/2026',hora:'18:30',pagamento:'pix'},",
    "    pecas:null, topoNome:null, topoIdade:null, tema:null,",
    "    forminha:c.forminha, prato:'aberto',",
    "    // A abertura e a pergunta da festa ja saíram: aqui o que se mede e a",
    "    // ordem DENTRO do docinho, e nao o comeco da conversa.",
    "    etapasJaPerguntadas:['abertura','quantas_pessoas'], etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const vez = etapaDaVez(p as never, roteiroDoPedido(p as never));",
    "  saiu.push({ etapa: vez.id, texto: String(falaDaEtapa(vez as never, p as never, 0, []).texto || '') });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-ordem-cor.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a cor vem depois de saber qual docinho ==");
CASOS.forEach((c, n) => {
  const texto = String(saiu[n].texto || "").toLowerCase();
  const problemas = [];
  for (const parte of c.tem ?? []) {
    if (!texto.includes(parte.toLowerCase())) {
      problemas.push('nao diz "' + parte + '": ' + JSON.stringify(saiu[n].texto.slice(0, 70)));
    }
  }
  for (const parte of c.naoTem ?? []) {
    if (texto.includes(parte.toLowerCase())) {
      problemas.push('diz "' + parte + '": ' + JSON.stringify(saiu[n].texto.slice(0, 70)));
    }
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
