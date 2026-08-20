// CARDAPIO NAO VAI PRA QUEM JA ESCOLHEU, NEM PRA QUEM JA RECUSOU.
//
// Caso real de 20/08/2026. No meio de uma correcao de quantidade, com salgados
// e docinhos ja anotados, a Dora despejou as duas pecas de cardapio de uma vez:
//
//   ela:  Pode, mas nao apaga os docinhos hein
//   Dora: Te mandei o cardapio de salgados aqui, com tudo e os precos.
//         Te mandei o cardapio de docinhos aqui, com tudo e os precos.
//
// A cliente tinha acabado de escrever "nao apaga os docinhos" e recebeu de
// volta a tabela de precos dos docinhos. Mandar cardapio pra quem ja escolheu
// parece que a conversa recomecou do zero, que e exatamente o medo de quem esta
// falando com uma IA.
//
// A funcao morava dentro do cerebro e nao tinha teste nenhum. Passou pra
// guardas.ts pelo mesmo motivo das outras: teste que le codigo por comentario
// quebra sozinho e nao pega defeito.
//
// Roda com: node testes/cardapio-nao-recomeca-a-conversa.cjs
const { pecasPermitidas } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

const TODAS = ["salgados", "docinhos", "bolos-festa"];
const salgadoAnotado = [{ categoria: "salgado_frito" }];
const tudoAnotado = [{ categoria: "salgado_assado" }, { categoria: "docinho" }, { categoria: "bolo_festa" }];

console.log("== quem ja escolheu nao recebe cardapio ==");
conferir(
  !pecasPermitidas(TODAS, "pode, mas nao apaga os docinhos hein", "", tudoAnotado).length,
  "o caso real: nenhuma peca sai com o pedido montado",
  JSON.stringify(pecasPermitidas(TODAS, "pode, mas nao apaga os docinhos hein", "", tudoAnotado)),
);
const sobrou = pecasPermitidas(TODAS, "e agora?", "", salgadoAnotado);
conferir(
  !sobrou.includes("salgados") && sobrou.includes("docinhos"),
  "escolheu salgado: sai o de docinho, nao o de salgado",
  JSON.stringify(sobrou),
);

console.log("");
console.log("== quem recusou continua sem receber ==");
const semDoce = pecasPermitidas(TODAS, "nao quero docinho", "", []);
conferir(!semDoce.includes("docinhos"), "recusou docinho e nao recebe docinho", JSON.stringify(semDoce));
const semDoceAnotado = pecasPermitidas(TODAS, "e agora?", "docinho", []);
conferir(
  !semDoceAnotado.includes("docinhos"),
  "a recusa guardada no pedido tambem vale",
  JSON.stringify(semDoceAnotado),
);

console.log("");
console.log("== mas se ele PEDIR, vai ==");
// Sem isto a guarda vira o defeito: o cliente pede pra ver e nao recebe.
for (const fala of [
  "me manda o cardapio de docinhos",
  "quais sabores de docinho voces tem?",
  "que tipos de salgado tem?",
  "me manda as opcoes",
]) {
  const r = pecasPermitidas(TODAS, fala, "docinho", tudoAnotado);
  conferir(r.length === TODAS.length, '"' + fala.slice(0, 38) + '" recebe tudo que foi pedido', JSON.stringify(r));
}

console.log("");
console.log("== lixo na entrada nao quebra nada ==");
let quebrou = false;
try {
  pecasPermitidas([], "", "", []);
  pecasPermitidas(TODAS, "", "", [{ categoria: null }]);
  pecasPermitidas(TODAS, "oi", "", undefined);
} catch (e) {
  quebrou = true;
}
conferir(!quebrou, "aguenta lista vazia, categoria nula e argumento faltando", "estourou");

console.log("");
console.log(erros === 0 ? "CARDAPIO SO VAI PRA QUEM PRECISA" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
