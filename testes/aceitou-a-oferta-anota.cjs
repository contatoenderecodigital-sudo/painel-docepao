// ACEITAR A SUGESTAO E A HORA MAIS BARATA DE FECHAR UM PEDIDO.
//
// Conversa real de 20/08/2026, lida no banco:
//
//   Dora: 100 coxinha, 100 mini bolha de carne e 100 esfirra de calabresa
//         75 brigadeiro e 75 beijinho. Pode ser assim?
//   ela:  pode ser assim. queria tambem um bolo de bombom de 2kg
//   Dora: Te mandei o cardapio de salgados aqui. Quais salgados voce quer e
//         quantos de cada?
//
// Ela aceitou a lista DELE e ele pediu a lista de volta. Nas duas mensagens
// seguintes a cliente teve que repetir item por item, e escreveu "ja falei 1
// vez", "ja falei 1 vez tambem", "ja falei 2 vezes". O bolo pedido na mesma
// frase tambem ficou pra tras.
//
// Agora quem anota nessa hora e o codigo. Este teste cobra os dois lados:
// aceite anota, e o que NAO e aceite continua sendo decisao dela.
//
// Roda com: node testes/aceitou-a-oferta-anota.cjs
const {
  aceitouAOferta,
  itensQueElaOfereceu,
  pediuVerOPedido,
  totalQueElePediu,
  familiaQueElePediu,
  sugestaoDeSortido,
} = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== o cliente aceitou ==");
for (const fala of [
  "pode ser assim. queria tambem um bolo de bombom de 2kg",
  "pode ser",
  "pode ser assim sim",
  "isso mesmo",
  "fechado",
  "perfeito",
  "beleza, pode anotar",
  "ta bom pra mim",
  "ok",
  "combinado",
  "concordo, pode fazer assim",
]) {
  conferir(aceitouAOferta(fala), '"' + fala.slice(0, 40) + '" e aceite', "nao reconheceu");
}

console.log("");
console.log("== NAO e aceite limpo, quem resolve e ela ==");
for (const fala of [
  "pode ser mas tira a coxinha",
  "pode ser, so que sem docinho",
  "nao pode ser assim nao",
  "quase, troca a esfirra por empadinha",
  "pode ser menos coxinha",
  "e quanto fica?",
  "deixa eu pensar",
]) {
  conferir(!aceitouAOferta(fala), '"' + fala.slice(0, 40) + '" nao anota sozinho', "anotou sem poder");
}

console.log("");
console.log("== a oferta e lida da mensagem dela ==");
const oferta = itensQueElaOfereceu(
  "Entao deixa eu te indicar o que a gente mais faz em festa de crianca: " +
    "- 100 coxinha, 100 mini bolha de carne e 100 esfirra de calabresa " +
    "- 75 brigadeiro e 75 beijinho. Pode ser assim, ou voce quer trocar alguma coisa?",
);
conferir(oferta.length === 5, "achou os cinco itens ofertados", JSON.stringify(oferta));
const acha = (p) => oferta.find((o) => o.produto === p);
conferir(acha("coxinha") && acha("coxinha").qtd === 100, "100 coxinha", JSON.stringify(oferta));
conferir(acha("esfirra") && acha("esfirra").qtd === 100, "100 esfirra", JSON.stringify(oferta));
conferir(acha("brigadeiro") && acha("brigadeiro").qtd === 75, "75 brigadeiro", JSON.stringify(oferta));
conferir(acha("beijinho") && acha("beijinho").qtd === 75, "75 beijinho", JSON.stringify(oferta));

console.log("");
console.log("== o recheio da oferta nao se perde ==");
conferir(
  acha("mini bolha") && acha("mini bolha").obs === "carne",
  'mini bolha vai com o recheio "carne", nao com "carne e"',
  JSON.stringify(acha("mini bolha")),
);
conferir(
  acha("esfirra") && acha("esfirra").obs === "calabresa",
  "esfirra vai com calabresa",
  JSON.stringify(acha("esfirra")),
);

console.log("");
console.log("== tabela de preco NAO e oferta ==");
// O cardapio que ela manda tem o nome ANTES do numero, e e longo. Se um dia
// virar oferta, o cliente que responder "ok" leva o cardapio inteiro no pedido.
const cardapio = itensQueElaOfereceu(
  "Salgados fritos: coxinha R$ 1,00, risoles R$ 1,00, bolinha de queijo R$ 1,00, " +
    "croquete R$ 1,00, mini bolha R$ 1,00. Assados: esfirra R$ 1,25, empadinha R$ 1,25, " +
    "quiche R$ 1,25, croissant R$ 1,25, pastel assado R$ 1,25.",
);
conferir(cardapio.length === 0, "cardapio com preco nao vira pedido", JSON.stringify(cardapio));

console.log("");
console.log("== conversa sem numero nao inventa item ==");
for (const texto of [
  "Oi, tudo bem? O que voce precisa ai?",
  "E qual a data da retirada do pedido?",
  "Anotei certinho. Quer mais alguma coisa?",
]) {
  conferir(itensQueElaOfereceu(texto).length === 0, '"' + texto.slice(0, 34) + '" nao gera item', "gerou");
}

console.log("");
console.log("== ele pediu pra conferir o pedido ==");
// "Calma, me manda o pedido final pra eu conferir antes. Quero ver item por
// item com as quantidades". A Dora respondeu com outra pergunta de confirmacao
// e depois mandou o cardapio. A cliente pediu duas vezes e nunca viu o pedido.
for (const fala of [
  "Calma, me manda o pedido final pra eu conferir antes. Quero ver item por item com as quantidades",
  "me manda o resumo",
  "como ficou o pedido?",
  "quero ver a lista",
  "deixa eu ver os itens",
  "me passa o pedido pra conferir",
  "manda o pedido final",
]) {
  conferir(pediuVerOPedido(fala), '"' + fala.slice(0, 40) + '" pede a lista', "nao reconheceu");
}

console.log("");
console.log("== e o que NAO e pedido de conferencia ==");
for (const fala of [
  "quanto ficou?",
  "pode fechar",
  "me manda o cardapio de salgados",
  "bom dia",
  "quero 100 coxinhas",
]) {
  conferir(!pediuVerOPedido(fala), '"' + fala.slice(0, 40) + '" nao dispara a lista', "disparou sem motivo");
}

console.log("");
console.log("== se a conta DELA nao fecha, vale a do codigo ==");
//
// Caso real: a cliente pediu 200 salgados assados e 100 docinhos. A Dora
// ofereceu "20 coxinha, 20 mini bolha, 20 risolis de carne, 20 bolinha de
// queijo e 20 croquete" (100, e tudo FRITO), e nos docinhos escreveu "25
// brigadeiro, 25 beijinho, 25 cajuzinho e 25 com forminha branca", comendo o
// nome do quarto sabor.
//
// Enquanto quem anotava era ela, isso custava mensagem e a cliente corrigia
// (corrigiu tres vezes). Agora o codigo anota o que ele aceitou, entao copiar a
// conta errada dela gravaria o erro no pedido.
const falasDela =
  "Olha, minha sugestao e 20 coxinha, 20 mini bolha, 20 risolis de carne, 20 bolinha de queijo e " +
  "20 croquete nos salgados. Nos docinhos, 25 brigadeiro, 25 beijinho, 25 cajuzinho e 25 com forminha branca. Pode ser assim?";
const falasDele = [
  "Oi, bom dia! Preciso de salgados e docinhos pra um coffee break aqui na empresa",
  "Isso mesmo, 200 salgados assados e 100 docinhos. Quarta-feira as 9h. Nao tenho tempo de escolher um a um, pode montar o sortido pra mim?",
  "Forminha branca ta otimo. Escolhe voce os salgados e os docinhos e me diz o que ficou",
];

const oferecidos = itensQueElaOfereceu(falasDela);
conferir(
  oferecidos.filter((o) => ["coxinha", "mini bolha", "risolis", "risólis", "bolinha de queijo", "croquete"].includes(o.produto))
    .reduce((s, o) => s + o.qtd, 0) === 100,
  "a oferta dela realmente somava 100 salgados, metade do pedido",
  JSON.stringify(oferecidos),
);
conferir(totalQueElePediu(falasDele, "salgado") === 200, "o codigo sabe que ele quer 200", "");
conferir(familiaQueElePediu(falasDele) === "assado", "e sabe que ele quer ASSADO", "");

// O que o cerebro faz quando a soma nao bate: refaz pelo sortido do codigo.
const refeito = sugestaoDeSortido("salgado_assado", totalQueElePediu(falasDele, "salgado"));
conferir(refeito.reduce((s, i) => s + i.qtd, 0) === 200, "o sortido refeito soma 200 exatos", JSON.stringify(refeito));
const FRITOS = ["coxinha", "mini bolha", "risólis", "bolinha de queijo", "croquete"];
conferir(
  !refeito.some((i) => FRITOS.includes(i.produto)),
  "e nenhum frito entra no lugar de assado",
  JSON.stringify(refeito),
);
const doceRefeito = sugestaoDeSortido("docinho", totalQueElePediu(falasDele, "docinho"));
conferir(
  doceRefeito.reduce((s, i) => s + i.qtd, 0) === 100 && doceRefeito.every((i) => i.produto && i.qtd > 0),
  "os docinhos somam 100 e nenhum nome se perde",
  JSON.stringify(doceRefeito),
);

console.log("");
console.log(erros === 0 ? "ACEITE VIRA PEDIDO, E SO O ACEITE" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
