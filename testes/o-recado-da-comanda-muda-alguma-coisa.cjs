// O RECADO DA COMANDA TEM QUE MUDAR ALGUMA COISA NA COZINHA.
//
// Achado por ele lendo a conversa de 02/09/2026: *"e tipo falou frito ali no
// pastel, mas bem pouquinha coisa"*. O cliente escreveu "pastel bolha frita", o
// modelo devolveu "frita" na observacao, e a comanda saiu assim:
//
//   50 un mini bolha
//   > frita
//
// A mini bolha SO existe frita. Ninguem na cozinha faz nada diferente por causa
// dessa palavra, e recado que nao muda producao e ruido: quem le a comanda para
// pra entender se aquilo quer dizer alguma coisa, e nao quer.
//
// QUEM DECIDE E O CATALOGO, E NAO UMA LISTA MINHA. A categoria do produto ja diz
// se ele e frito ou assado. Bate, sai. CONTRARIA ("mini bolha assada"), fica: ai
// e pedido de verdade, e quem responde e a cozinha, nao o codigo.
//
// A ISCA: apagando o `soRepeteOProduto` de `restricao.ts`, o primeiro caso volta
// a imprimir "frita" na comanda.
//
// Roda com: node testes/o-recado-da-comanda-muda-alguma-coisa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "frita na mini bolha, que so existe frita, sai da comanda",
    produto: "mini bolha",
    obs: "frita",
    esperado: null,
    dano: "recado que nao muda producao faz quem le a comanda parar pra entender nada",
  },
  {
    nome: "frito no risolis tambem sai",
    produto: "risólis",
    obs: "frito",
    esperado: null,
    dano: "o mesmo ruido em todo salgado frito da casa",
  },
  {
    nome: "assado no pastel assado sai igual",
    produto: "pastel assado",
    obs: "assado",
    esperado: null,
    dano: "a regra nao pode valer so pro frito, senao o assado vira excecao escondida",
  },
  {
    // O CONTRARIO NAO SAI. Aqui o cliente esta PEDINDO outra coisa.
    nome: "assada na mini bolha CONTRARIA o produto, e fica",
    produto: "mini bolha",
    obs: "assada",
    esperado: "assada",
    dano: "apagar um pedido de verdade e a cozinha nunca ficar sabendo",
  },
  {
    nome: "recado de verdade com a palavra dentro continua inteiro",
    produto: "mini bolha",
    obs: "frita bem sequinha",
    esperado: "frita bem sequinha",
    dano: "a dona perde o recado do cliente porque ele usou a palavra frita",
  },
  {
    nome: "o recheio nao e afetado",
    produto: "mini bolha",
    obs: "carne | frita",
    esperado: "carne",
    dano: "limpar demais tiraria o recheio junto, e a cozinha nao saberia o que rechear",
  },
  {
    // Produto que o catalogo nao conhece: nao da pra afirmar nada, entao passa.
    nome: "produto que a casa nao tem passa intocado",
    produto: "coisa que nao existe",
    obs: "frita",
    esperado: "frita",
    dano: "apagar recado de um produto que ninguem sabe o que e",
  },
];

const sonda = path.join(__dirname, "_sonda-recado.mts");
fs.writeFileSync(
  sonda,
  [
    'import { obsPraComanda } from "../lib/ia/fluxo/restricao.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = CASOS.map((c) => obsPraComanda(c.obs, c.produto));",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-recado.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== o recado da comanda muda alguma coisa ==");
CASOS.forEach((c, n) => {
  const deu = saiu[n];
  const ok = (deu ?? null) === (c.esperado ?? null);
  console.log(
    (ok ? "ok    " : "ERRO  ") + c.nome +
    (ok ? "" : "  ->  saiu " + JSON.stringify(deu) + ", esperado " + JSON.stringify(c.esperado) + "; " + c.dano),
  );
  if (!ok) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
