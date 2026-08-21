// PERGUNTA DE PRECO SEM O NOME DO PRODUTO AINDA E PERGUNTA DE PRECO.
//
// Medicao de 21/08/2026, duas conversas reais, os dois clientes desistiram:
//
//   cliente: (falando da cuca recheada de goiaba) quanto custa o quilo?
//   Dora:    A cuca recheada de goiaba e vendida por quilo. Quantos quilos voce quer?
//
//   cliente: (falando do franciscano) quanto custa?
//   Dora:    Te mandei o cardapio de salgados com os precos.
//
// Ela SABIA o preco nas duas: usou o valor certo no fechamento. A guarda que
// injeta o numero filtrava o catalogo por "o nome do produto aparece NESTA
// fala", e ninguem repete o nome do que acabou de dizer. Essa e a forma MAIS
// COMUM da pergunta de preco, e era justamente a que ficava sem resposta.
//
// A trava do outro lado importa igual: chutar preco e pior que ficar calado.
// Por isso topo de bolo, entrega e taxa continuam fora, e familia continua com
// a guarda dela.
//
// Roda com: node testes/preco-eliptico-tem-numero.cjs
const { precoQueEleQuer, perguntouOPreco } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== os dois casos reais que perderam a venda ==");
const daCuca = precoQueEleQuer("quanto custa o quilo?", "quero uma cuca recheada de goiaba");
conferir(daCuca && /cuca/.test(daCuca.nome), "cuca: 'quanto custa o quilo?' acha o preco", JSON.stringify(daCuca));
conferir(daCuca && daCuca.preco > 0, "e o preco vem com numero", JSON.stringify(daCuca));

const doFran = precoQueEleQuer("quanto custa?", "voces tem franciscano?");
conferir(doFran && /franciscano/.test(doFran.nome), "franciscano: 'quanto custa?' acha o preco", JSON.stringify(doFran));

console.log("");
console.log("== o nome escrito na fala continua ganhando ==");
const direto = precoQueEleQuer("quanto custa o empadao?", "");
conferir(direto && /empad/.test(direto.nome), "pergunta direta acha o produto", JSON.stringify(direto));
// "quanto custa a cuca?" com a variante no assunto: a variante manda.
const variante = precoQueEleQuer("quanto custa a cuca?", "queria uma cuca recheada de goiaba");
conferir(variante && /recheada/.test(variante.nome), "a variante do assunto ganha do generico", JSON.stringify(variante));

console.log("");
console.log("== e NAO chuta quando nao da pra saber ==");
for (const [fala, recente, porque] of [
  ["quanto custa o topo de bolo?", "quero um bolo", "topo e valor que so a equipe lanca"],
  ["quanto custa a entrega?", "quero uma cuca", "entrega nao esta na tabela"],
  ["quanto custa o cento de salgado?", "quero uma cuca", "familia tem guarda propria"],
  ["quero 2 quilos", "quero uma cuca recheada", "isso nem e pergunta de preco"],
  ["quanto custa?", "", "sem assunto nenhum nao da pra saber"],
]) {
  const d = precoQueEleQuer(fala, recente);
  conferir(d === null, JSON.stringify(fala) + " -> nao injeta (" + porque + ")", JSON.stringify(d));
}

console.log("");
console.log("== o gatilho reconhece as formas que o cliente usa ==");
for (const f of ["quanto custa", "quanto fica", "quanto sai", "qual o preco", "qual o valor", "quanto e"]) {
  conferir(perguntouOPreco(f + " isso?"), JSON.stringify(f), "nao reconheceu");
}
conferir(!perguntouOPreco("quero 100 salgados"), "pedido nao e pergunta de preco", "achou que era");

console.log("");
console.log(erros === 0 ? "PERGUNTA DE PRECO SAI COM NUMERO" : erros + " FALHA(S): cliente pergunta preco e nao recebe numero");
process.exit(erros === 0 ? 0 : 1);
