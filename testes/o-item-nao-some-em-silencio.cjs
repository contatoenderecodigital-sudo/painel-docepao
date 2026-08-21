// O ITEM NAO SOME EM SILENCIO.
//
// Conversa real de 21/08/2026, cliente de verdade:
//
//   Dora:    "Te mandei o cardapio de salgados aqui. Quais e quantos voce quer
//             de coxinha, empadinha e mini bolha (pastel bolha)?"
//   cliente: "50 de cada"                                    -> 150 salgados
//   Dora:    "Anotei 50 empadinhas de frango e 50 mini bolhas de carne."
//                                                            -> 100 salgados
//
// A COXINHA SUMIU. Sao 50 salgados que a padaria nao fatura e uma festa de 15
// pessoas com comida faltando, descoberto no dia da retirada.
//
// Nenhuma das 30 guardas de recusa a barrou: o modelo chamou anotar_item uma
// vez em vez de tres. O que faltava nao era mais uma guarda de recusa — era
// alguem CONFERINDO. As tres conferencias que existiam comparavam
// resumo<->pedido e montagem<->pedido: artefato interno contra artefato
// interno. Ninguem olhava o cliente.
//
// Roda com: node testes/o-item-nao-some-em-silencio.cjs
const guardas = require("./_guardas.cjs")();
const { itensQueSumiram, produtosQueElaListou, quantidadeParaCadaUm } = guardas;

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

const PERGUNTA_DELA =
  "Te mandei o cardapio de salgados aqui. Quais e quantos voce quer de coxinha, empadinha e mini bolha (pastel bolha)?";

console.log("== ela listou tres produtos, mesmo sem numero nenhum ==");
const listados = produtosQueElaListou(PERGUNTA_DELA);
conferir(listados.length === 3, "achou os tres produtos da pergunta", "achou " + JSON.stringify(listados));
for (const n of ["coxinha", "empadinha", "mini bolha"]) {
  conferir(listados.includes(n), "achou " + n, "faltou; veio " + JSON.stringify(listados));
}
// "mini bolha" nao pode virar "bolha" tambem: a mesma peca contada duas vezes
// faz a conferencia cobrar um item que nao existe.
conferir(!listados.includes("bolha"), "nao conta 'mini bolha' duas vezes", JSON.stringify(listados));

console.log("");
console.log("== 'de cada' quer dizer para cada um ==");
for (const [fala, esperado] of [
  ["50 de cada", 50],
  ["manda 100 de cada um", 100],
  ["pode ser 30 de cada", 30],
  ["quero 50 coxinhas", null],
  ["so a empadinha mesmo", null],
]) {
  const deu = quantidadeParaCadaUm(fala);
  conferir(deu === esperado, JSON.stringify(fala) + " -> " + esperado, "deu " + deu);
}

console.log("");
console.log("== O CASO REAL: a coxinha nao pode passar batida ==");
const sumiu = itensQueSumiram(PERGUNTA_DELA, "50 de cada", ["empadinha", "mini bolha"]);
conferir(sumiu.includes("coxinha"), "a coxinha e cobrada como faltando", "devolveu " + JSON.stringify(sumiu));
conferir(sumiu.length === 1, "e so ela", "devolveu " + JSON.stringify(sumiu));

console.log("");
console.log("== e nao reclama quando esta tudo certo ==");
conferir(
  itensQueSumiram(PERGUNTA_DELA, "50 de cada", ["coxinha", "empadinha", "mini bolha"]).length === 0,
  "os tres anotados: nao reclama",
  "reclamou a toa",
);
// O nome no pedido vem mais completo do que na pergunta ("mini bolha de carne").
conferir(
  itensQueSumiram(PERGUNTA_DELA, "50 de cada", ["coxinha", "empadinha de frango", "mini bolha de carne"]).length === 0,
  "nome com recheio junto continua batendo",
  "achou que faltava",
);
// Sem "de cada" nao ha o que conferir: ele pode ter pedido so um mesmo.
conferir(
  itensQueSumiram(PERGUNTA_DELA, "quero 50 coxinhas", ["coxinha"]).length === 0,
  "sem 'de cada', nao inventa cobranca",
  "reclamou sem motivo",
);
// Ela ofereceu um produto so: "de cada" nao quer dizer nada ali.
conferir(
  itensQueSumiram("Quantas coxinhas voce quer?", "50 de cada", []).length === 0,
  "um produto so na oferta: nao cobra nada",
  "reclamou com um produto so",
);

console.log("");
console.log(erros === 0 ? "NENHUM ITEM SOME EM SILENCIO" : erros + " FALHA(S): item sumiria sem ninguem ver");
process.exit(erros === 0 ? 0 : 1);
