// O PEDIDO SEM DIA DE RETIRADA AVISA ANTES DE IR PRA COZINHA.
//
// POR QUE ISTO EXISTE
//
// A cozinha produz POR DIA. Um pedido com hora e sem data e um pedido que
// ninguem sabe pra quando fazer, e na comanda ele sai como um tracinho discreto
// do lado de uma hora que parece certa.
//
// O `registrarPedido` sabe disso e segura o pedido: sem data, ele nasce com
// `precisa_confirmacao` e o motivo escrito ("O cliente nao disse o dia da
// retirada"), e vai pra tela de pendencias em vez da fila de aprovacao.
//
// SO QUE A TELA DE PENDENCIAS TEM UM BOTAO QUE DESFAZ ISSO
//
// "Nao tem valor a cobrar, mandar direto pra aprovacao". Ele existe por um bom
// motivo (nem toda pendencia e de dinheiro), e ate pergunta antes. Mas o texto
// da pergunta falava SO DE VALOR:
//
//     "Mandar este pedido direto pra aprovacao, sem cobrar valor nenhum a mais?
//      O cliente nao vai receber pedido de confirmacao de valor."
//
// Entao a pendencia de DATA era resolvida por um aviso que nao fala de data. A
// equipe le, concorda, e o pedido vai pra cozinha sem dia.
//
// A tela ja sabia: o `retiradaData` e null e o motivo aparece na frente do card.
// So o aviso de confirmar nao dizia.
//
// O QUE ELE COBRA
//
//   1. o aviso muda quando falta a data, e fala da DATA
//   2. o aviso normal continua existindo pro caso de valor
//   3. quem decide e o `retiradaData`, e nao um texto adivinhado do motivo
//   4. o `registrarPedido` continua segurando o pedido sem data, que e a
//      primeira defesa (se ela cair, esta tela nem chega a ser usada)
//
// FICA ANOTADO: por um CAMPO de data nesta tela e decisao do dono, e esta no
// ONDE-PAREI. Dizer a verdade no aviso nao e decisao: e o minimo.
//
// Roda com: node testes/o-pedido-sem-dia-avisa-antes-de-ir.cjs
const path = require("node:path");
const fs = require("node:fs");

const raiz = path.join(__dirname, "..");

// Comentario nao conta como codigo. O `\r` sai antes do corte porque sem a flag
// `m` o `$` quer dizer fim da STRING, e a linha termina em `\r\n`.
const semComentario = (...p) =>
  fs
    .readFileSync(path.join(raiz, ...p), "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
    .join("\n");

const falhas = [];
const tela = semComentario("components", "AguardandoConfirmacao.tsx");

// 1. o aviso muda quando falta a data
if (!/const semDia = !pedido\.retiradaData/.test(tela)) {
  falhas.push(
    "a tela nao olha mais se falta a data: o botao de mandar direto volta a " +
      "avisar so sobre valor, e o pedido vai pra cozinha sem dia",
  );
}
if (!/SEM O DIA DA RETIRADA/.test(tela)) {
  falhas.push("o aviso parou de dizer que falta o dia da retirada");
}
// e o aviso tem que explicar a consequencia, nao so constatar
if (!/cozinha produz por dia/i.test(tela)) {
  falhas.push("o aviso diz que falta o dia mas nao diz por que isso importa");
}

// 2. o aviso de valor continua existindo
if (!/sem cobrar valor nenhum a mais/.test(tela)) {
  falhas.push("o aviso de valor sumiu: a pendencia de dinheiro ficou sem confirmacao");
}

// 3. quem decide e o campo, e nao o texto do motivo.
//
// Adivinhar pelo `motivoHumano` seria fragil: o texto do motivo e escrito pra
// pessoa ler, e muda. O campo nao.
const trecho = tela.slice(tela.indexOf("const semDia"), tela.indexOf("const semDia") + 400);
if (/motivoHumano/.test(trecho)) {
  falhas.push(
    "a decisao passou a olhar o TEXTO do motivo em vez do campo `retiradaData`: " +
      "o texto e escrito pra pessoa ler e muda, o campo nao",
  );
}

// 4. a primeira defesa continua de pe: o registrarPedido segura o pedido sem data
const conversas = semComentario("lib", "banco", "conversas.ts");
if (!/const semData = !pedido\.retiradaData/.test(conversas)) {
  falhas.push(
    "o `registrarPedido` parou de segurar o pedido sem data: essa e a PRIMEIRA " +
      "defesa, e sem ela o pedido nem passa por esta tela",
  );
}
if (!/O cliente não disse o dia da retirada/.test(conversas)) {
  falhas.push("o motivo escrito pra equipe sumiu do `registrarPedido`");
}

console.log("Conferidos: components/AguardandoConfirmacao.tsx e lib/banco/conversas.ts");
console.log("");

if (falhas.length) {
  console.log("ERRO  pedido sem dia pode ir pra cozinha sem ninguem avisar (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    sem o dia, a tela diz que falta o dia e por que isso importa");
console.log("");
console.log("PASSOU");
