// A IMAGEM QUE CHEGA TEM QUE TER O PRODUTO QUE ELE PERGUNTOU.
//
// Medicao de 21/08/2026, cinco conversas reais:
//
//   cliente: quais sabores de franciscano voces tem?   -> chegou SALGADOS
//   cliente: quais tipos de empadinha tem?             -> chegou TORTAS-EMPADAO
//   cliente: quero 2 kg de bolo salgado de frango      -> chegou SALGADOS,
//                                                          depois BOLOS-FESTA
//
// O franciscano e vendido na peca dos cupcakes. A empadinha e salgado assado. O
// bolo salgado sai por quilo, na peca das tortas. Nas tres o cliente ficou
// olhando pro WhatsApp com a imagem errada na mao.
//
// A causa: NAO EXISTIA MAPA PRODUTO->PECA. A escolha era do MODELO, pelo enum da
// ferramenta enviar_cardapio, e nenhuma linha conferia se aquela peca tem o
// produto perguntado. No lugar do mapa havia quatro tabelas de FAMILIA,
// divergentes entre si, e nenhuma sabia dos tres casos acima.
//
// Roda com: node testes/a-peca-tem-o-produto.cjs
const { pecaCoerenteComOProduto, pecasDoQueEleCitou } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== os cinco casos medidos: o modelo chuta, o portao conserta ==");
for (const [fala, chute, certo] of [
  ["quais sabores de franciscano voces tem?", "salgados", "cupcakes-franciscano"],
  ["quanto custa o franciscano?", "salgados", "cupcakes-franciscano"],
  ["quais tipos de empadinha tem?", "tortas-empadao", "salgados"],
  ["me manda o cardapio de empadinha", "tortas-empadao", "salgados"],
  ["quero 2 kg de bolo salgado de frango", "bolos-festa", "tortas-empadao"],
]) {
  const r = pecaCoerenteComOProduto([chute], fala);
  conferir(r[0] === certo, JSON.stringify(fala) + " -> " + certo, "veio " + JSON.stringify(r));
}

console.log("");
console.log("== cada familia da loja cai na peca certa ==");
for (const [fala, certo] of [
  ["quero 100 coxinhas", "salgados"],
  ["quero 50 esfirras de calabresa", "salgados"],
  ["quero 60 brigadeiros", "docinhos"],
  ["quero um bolo de brigadeiro de 3 kg", "bolos-festa"],
  ["quero um bolo de cenoura", "bolos-caseiros"],
  ["quero uma cuca recheada", "cucas-paes"],
  ["quanto custa o empadao?", "tortas-empadao"],
  ["quero uma torta fria", "tortas-empadao"],
  ["quero 30 cupcakes", "cupcakes-franciscano"],
  ["quero 10 franciscanos", "cupcakes-franciscano"],
  ["quero uma pizza inteira de calabresa", "pizza"],
  ["quero um calzone", "pizza"],
  ["quero 2 kg de bolo salgado", "tortas-empadao"],
]) {
  const r = pecasDoQueEleCitou(fala);
  conferir(r[0] === certo, JSON.stringify(fala) + " -> " + certo, "veio " + JSON.stringify(r));
}

console.log("");
console.log("== e nao mexe quando nao ha o que corrigir ==");
conferir(
  JSON.stringify(pecaCoerenteComOProduto(["docinhos"], "me manda o cardapio")) === '["docinhos"]',
  "sem produto nomeado, a escolha do modelo fica de pe",
  "mexeu",
);
conferir(pecasDoQueEleCitou("muda pra 150").length === 0, "'muda pra 150' nao nomeia produto nenhum", "achou algum");
conferir(pecasDoQueEleCitou("pode fechar").length === 0, "'pode fechar' nao nomeia produto nenhum", "achou algum");
// O nome mais especifico da frase manda: bolo de festa de brigadeiro e BOLO.
conferir(
  pecasDoQueEleCitou("quero um bolo de festa de brigadeiro")[0] === "bolos-festa",
  "'bolo de festa de brigadeiro' e bolo, nao docinho de brigadeiro",
  JSON.stringify(pecasDoQueEleCitou("quero um bolo de festa de brigadeiro")),
);

console.log("");
console.log(erros === 0 ? "A PECA TEM O PRODUTO QUE ELE PERGUNTOU" : erros + " FALHA(S): chega a imagem errada");
process.exit(erros === 0 ? 0 : 1);
