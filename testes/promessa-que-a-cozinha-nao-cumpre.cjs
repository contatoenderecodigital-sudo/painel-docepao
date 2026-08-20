// RESTRICAO QUE A CASA NAO FAZ NAO PODE ENTRAR NO PEDIDO.
//
// Medicao de 20/08/2026, cenario "produto que a padaria nao faz nao entra".
// O pedido fechou assim no banco:
//
//   30 brigadeiro (sem lactose, forminha rosa)
//
// A cliente tinha PERGUNTADO se tem docinho sem lactose. A Dora respondeu
// certo, que a padaria nao faz. E a restricao foi parar na observacao do item
// assim mesmo.
//
// A observacao vai pra comanda da cozinha e pro resumo que o cliente recebe.
// Ou seja: a padaria produz brigadeiro normal e entrega pra alguem que leu
// "sem lactose" na confirmacao do pedido. Se essa pessoa tem intolerancia de
// verdade, isso deixa de ser prejuizo e vira problema de saude.
//
// O arquivo de fatos ja impedia ela de AFIRMAR isso na conversa. Esta era a
// outra porta, e estava aberta: o campo de observacao.
//
// A guarda LIMPA, nao recusa. O brigadeiro e uma venda de verdade; sai so a
// promessa que a cozinha nao cumpre.
//
// Roda com: node testes/promessa-que-a-cozinha-nao-cumpre.cjs
const { restricoesQueACasaNaoFaz, obsSemRestricaoInventada } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== o caso real ==");
conferir(
  obsSemRestricaoInventada("sem lactose, forminha rosa") === "forminha rosa",
  "o brigadeiro fica, o sem lactose sai",
  obsSemRestricaoInventada("sem lactose, forminha rosa"),
);

console.log("");
console.log("== os jeitos de escrever a mesma promessa ==");
for (const obs of [
  "sem lactose",
  "0% lactose",
  "zero lactose",
  "lactose free",
  "deslactosado",
  "sem gluten",
  "gluten free",
  "vegano",
  "bolo vegana",
  "diet",
  "sem acucar",
  "zero acucar",
  "integral",
]) {
  conferir(restricoesQueACasaNaoFaz(obs).length > 0, '"' + obs + '" e pego', "passaria pro pedido");
}

console.log("");
console.log("== o que e pedido de verdade nao pode ser tocado ==");
for (const obs of [
  "forminha rosa",
  "recheio de carne",
  "tema princesa, nome Alice, 5 anos",
  "pao de lo branco",
  "calabresa",
  "topo de bolo tema dinossauro",
  "sem topo",
  "sem papel de arroz",
  "prato aberto",
  "caixa com tampa",
]) {
  conferir(
    restricoesQueACasaNaoFaz(obs).length === 0 && obsSemRestricaoInventada(obs) === obs,
    '"' + obs.slice(0, 40) + '" passa inteiro',
    JSON.stringify(obsSemRestricaoInventada(obs)),
  );
}

console.log("");
console.log("== limpa o pedaco, nao a ficha inteira ==");
// Recusar o item perderia a venda. Quem sai e so a promessa.
conferir(
  obsSemRestricaoInventada("tema princesa, sem lactose, forminha rosa") === "tema princesa, forminha rosa",
  "tira so o pedaco do meio e mantem os outros dois",
  obsSemRestricaoInventada("tema princesa, sem lactose, forminha rosa"),
);
conferir(obsSemRestricaoInventada("sem lactose") === "", "observacao que era so a promessa fica vazia", "sobrou coisa");
conferir(obsSemRestricaoInventada("") === "" && restricoesQueACasaNaoFaz(null).length === 0, "aguenta vazio e nulo", "estourou");

console.log("");
console.log(erros === 0 ? "A COZINHA SO RECEBE O QUE ELA CONSEGUE FAZER" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
