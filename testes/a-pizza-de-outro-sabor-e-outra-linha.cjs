// DUAS PIZZAS DE SABORES DIFERENTES SAO DUAS PIZZAS.
//
// Medido na producao em 30/08/2026, e e defeito de dinheiro ao vivo. O cliente
// pediu "2 inteiras, uma de calabresa e uma de frango com catupiry" e o pedido
// fechou assim:
//
//   1 ~ pizza inteira ~ frango com catupiry | calabresa ~ R$ 120,00
//
// Uma pizza no lugar de duas. R$ 120,00 no lugar de R$ 240,00, e a cozinha
// montando metade do que o cliente espera receber.
//
// O defeito tem TRES camadas, e as duas primeiras ja estavam fechadas quando
// este teste nasceu: o modelo lia "2x pizza [calabresa e frango com catupiry]"
// (uma linha so) e o fluxo passou a reparti-la em duas quando o numero dito
// bate com o numero de sabores. Medido local, o fluxo entregava as duas linhas
// certas. Elas morriam DEPOIS, na gravacao.
//
// A terceira camada e esta: pizza esta em UMA_LINHA_SO, entao a montagem
// juntava de volta as duas linhas que o fluxo tinha acabado de separar. E
// juntava SOMANDO o sabor, que e o que produz aquele "frango | calabresa".
//
// A regra de somar sabor esta CERTA e nao pode sair: sao ate 4 sabores na
// mesma pizza, e o cliente que acrescenta um sabor na conversa seguinte tem
// que completar a linha, nao criar outra. O que faltava era distinguir SOMAR
// SABOR NA MESMA PIZZA de EMPILHAR DUAS PIZZAS DIFERENTES.
//
// Por que este teste chama funcao em vez de ler o arquivo: a decisao morava
// dentro do anotarItem, que so roda com banco, e por isso o
// linha-nao-multiplica.cjs confere a regra por GREP no texto. Grep passa verde
// com a regra escrita e quebrada. A decisao foi levantada pra linhaQueRecebe,
// que e pura, e aqui o pedido e montado de verdade.
//
// Roda com: node testes/a-pizza-de-outro-sabor-e-outra-linha.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    oque: "duas pizzas salgadas de sabores diferentes sao duas linhas",
    tinha: [{ produto: "pizza inteira", categoria: "pizza", qtd: 1, unidade: "un", obs: "calabresa" }],
    chega: { produto: "pizza inteira", categoria: "pizza", qtd: 1, unidade: "un", obs: "frango com catupiry" },
    espera: -1,
    dano: "o pedido fecha com UMA pizza, R$ 120,00 no lugar de R$ 240,00",
  },
  {
    oque: "o segundo sabor da MESMA pizza completa a linha",
    tinha: [{ produto: "pizza inteira", categoria: "pizza", qtd: 1, unidade: "un", obs: "calabresa" }],
    chega: { produto: "pizza inteira", categoria: "pizza", qtd: 1, unidade: "un", obs: "calabresa, frango com catupiry" },
    espera: 0,
    dano: "quem acrescenta sabor na conversa seguinte ganha uma pizza a mais",
  },
  {
    // A FORMA QUE O FLUXO PRODUZ DE VERDADE, e nao a que eu imaginei.
    //
    // O caso de cima usa virgula porque e assim que a observacao aparece no
    // banco. Mas quem chama o `anotarItem` e o `gravar.ts`, com o item que saiu
    // do fluxo, e la a juncao de observacao e feita com " | ", nao com virgula
    // (`obsPraComanda(semRepetir.join(" | "))`). Se a regra do sabor casasse
    // so por pedaco separado por virgula, ela leria "calabresa | frango" como
    // UM pedaco so, nao acharia o "calabresa" dentro, e o cliente que
    // acrescenta sabor na mensagem seguinte ganharia uma pizza a mais.
    //
    // Eu ja fiz deploy duas vezes em cima de uma suposicao sobre a forma da
    // resposta, e as duas estavam erradas. Esta linha e a forma medida.
    oque: "o sabor que chega junto com o antigo separado por barra completa a linha",
    tinha: [{ produto: "pizza inteira", categoria: "pizza", qtd: 1, unidade: "un", obs: "calabresa" }],
    chega: { produto: "pizza inteira", categoria: "pizza", qtd: 1, unidade: "un", obs: "calabresa | frango com catupiry" },
    espera: 0,
    dano: "o cliente que acrescenta sabor na mensagem seguinte ganha uma pizza a mais",
  },
  {
    oque: "pizza doce e pizza salgada continuam sendo duas",
    tinha: [{ produto: "pizza inteira", categoria: "pizza", qtd: 1, unidade: "un", obs: "calabresa" }],
    chega: { produto: "pizza inteira", categoria: "pizza", qtd: 1, unidade: "un", obs: "brigadeiro" },
    espera: -1,
    dano: "a licao de 20/08/2026: o pedido foi pra cozinha com UMA pizza de brigadeiro",
  },
  {
    oque: "corrigir a quantidade da pizza nao cria linha nova",
    tinha: [{ produto: "pizza inteira", categoria: "pizza", qtd: 1, unidade: "un", obs: "calabresa" }],
    chega: { produto: "pizza inteira", categoria: "pizza", qtd: 2, unidade: "un", obs: null },
    espera: 0,
    dano: "mudar a quantidade viraria uma pizza a mais em vez de corrigir a que existe",
  },
  {
    oque: "o nome do bolo que cresce continua sendo a mesma linha",
    tinha: [{ produto: "bolo bombom", categoria: "bolo_festa", qtd: 1, unidade: "kg", obs: null }],
    chega: { produto: "bolo bombom com morango", categoria: "bolo_festa", qtd: 1, unidade: "kg", obs: null },
    espera: 0,
    dano: "a festa fecharia com dois bolos e o dobro do preco",
  },
  {
    oque: "o sabor da trufa completa a linha que ja tinha a forminha",
    tinha: [{ produto: "trufa", categoria: "docinho", qtd: 25, unidade: "un", obs: "forminha branca" }],
    chega: { produto: "trufa", categoria: "docinho", qtd: 25, unidade: "un", obs: "morango, forminha branca" },
    espera: 0,
    dano: "a licao de 19/08/2026: cem trufas onde a cliente pediu vinte e cinco",
  },
  {
    oque: "salgado com recheios diferentes sao duas linhas",
    tinha: [{ produto: "coxinha", categoria: "salgado_frito", qtd: 100, unidade: "un", obs: "frango" }],
    chega: { produto: "coxinha", categoria: "salgado_frito", qtd: 50, unidade: "un", obs: "calabresa" },
    espera: -1,
    dano: "o calabresa entra por cima do frango e somem 100 salgados do pedido",
  },
];

const LINHAS = [
  "import { linhaQueRecebe } from '../lib/banco/montagem.ts';",
  "const casos = " + JSON.stringify(CASOS) + ";",
  "console.log(JSON.stringify(casos.map((c) => linhaQueRecebe(c.tinha, c.chega))));",
];

const sonda = path.join(__dirname, "_sonda-pizza-linha.mjs");
fs.writeFileSync(sonda, LINHAS.join("\n"));

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pizza-linha.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== qual linha do pedido recebe o item ==");
CASOS.forEach((c, n) => {
  const ok = saiu[n] === c.espera;
  const virou = saiu[n] < 0 ? "linha nova" : "junta na linha " + saiu[n];
  const queria = c.espera < 0 ? "linha nova" : "junta na linha " + c.espera;
  console.log(
    (ok ? "ok    " : "ERRO  ") + c.oque +
    (ok ? "" : "  ->  deu " + virou + ", tinha que dar " + queria + "; " + c.dano),
  );
  if (!ok) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
