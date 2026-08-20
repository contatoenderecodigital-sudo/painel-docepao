// O QUE O CODIGO MANDA OFERECER, O CODIGO TEM QUE ACEITAR DE VOLTA.
//
// Esta e a historia de tres rodadas de medicao perdidas pelo mesmo defeito,
// em tres guardas diferentes.
//
// O sistema escreve, numa mensagem de sistema, "OFERECA EXATAMENTE ISTO:
// 40 esfirra, 40 empadinha, 40 pastel assado, 40 quiche, 40 croissant". A Dora
// obedece e chama anotar_item cinco vezes. E cinco vezes o codigo recusa:
//
//   1a guarda (produto fantasma):  "ninguem falou nesse produto nesta conversa,
//                                   nem o cliente nem voce"
//   2a guarda (produto fantasma 2): "ninguem falou em esfirra nesta conversa"
//   3a guarda (quantidade):         "o cliente nunca falou em 40 de esfirra"
//
// Cada uma dizia a verdade e cada uma era irrelevante: quem falou foi o
// SISTEMA, na mesma resposta. Ela ficava presa entre uma ordem e uma proibicao,
// as duas minhas, e o pedido terminava VAZIO no banco.
//
// Consertei a primeira e medi: 0/5 continuou 0/5. Consertei a segunda e medi:
// subiu pra 2/5. So na terceira rodada o rastro mostrou a de quantidade.
//
// A licao nao e "faltou atencao". E que existem varios caminhos pro mesmo
// lugar, e conserto pontual nao acha os outros. Por isso este teste cobra as
// TRES de uma vez, com a sugestao real que o codigo produz.
//
// Roda com: node testes/sugestao-do-codigo-nao-e-recusada.cjs
const { sugestaoDeSortido, produtoQueNinguemCitou, obsQueOClienteNaoDisse } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

// A conversa real do cenario que ficou reprovado tres rodadas seguidas.
const FALAS = [
  "bom dia, preciso de 200 salgados assados pra quarta as 9h",
  "pode escolher voce os tipos, confio",
];

// O que o codigo de fato sugere, e como ele registra isso em estado.sugeridos.
const SUGERIDO = sugestaoDeSortido("salgado_assado", 200);
const REGISTRADO = SUGERIDO.map((i) => i.qtd + " " + i.produto);

console.log("a sugestao do codigo: " + REGISTRADO.join(", "));
console.log("");

console.log("== a sugestao soma o que o cliente pediu ==");
conferir(
  SUGERIDO.reduce((s, i) => s + i.qtd, 0) === 200,
  "os itens somam 200 exatos",
  JSON.stringify(SUGERIDO),
);
conferir(SUGERIDO.length > 1, "e sao varios tipos, nao um so", JSON.stringify(SUGERIDO));

console.log("");
console.log("== 1a e 2a guarda: o produto sugerido nao e fantasma ==");
// As duas guardas de produto recebem estado.sugeridos junto da fala do cliente.
const proposta = REGISTRADO.join(" ");
for (const i of SUGERIDO) {
  conferir(
    !produtoQueNinguemCitou(i.produto, FALAS, proposta),
    '"' + i.produto + '" passa pela guarda de produto',
    "seria recusado como fantasma",
  );
}

console.log("");
console.log("== 3a guarda: a quantidade sugerida nao e inventada ==");
// A guarda de quantidade junta os numeros da fala do cliente, da ultima fala
// dela e agora tambem de estado.sugeridos. Aqui so o terceiro tem o 40.
const numerosDe = (t) => new Set((String(t).match(/[0-9]+(?:[.,][0-9]+)?/g) ?? []).map(Number));
const doCliente = numerosDe(FALAS.join(" "));
const doCodigo = numerosDe(proposta);
for (const i of SUGERIDO) {
  conferir(
    !doCliente.has(i.qtd) && doCodigo.has(i.qtd),
    "o " + i.qtd + " de " + i.produto + " vem do codigo, e o codigo o reconhece",
    "o cliente falou " + [...doCliente].join(",") + " e o codigo registrou " + [...doCodigo].join(","),
  );
  break;
}
conferir(
  SUGERIDO.every((i) => doCodigo.has(i.qtd)),
  "todas as quantidades sugeridas ficam registradas",
  JSON.stringify([...doCodigo]),
);

console.log("");
console.log("== a descricao que ELA escreve nao recusa o item ==");
// "salgado assado sortido, conforme cardapio" foi recusado 5 vezes por rodada.
for (const obs of [
  "salgado assado sortido, conforme cardápio",
  "sortido da casa",
  "misto, como voce indicou",
  "variado",
  "a combinar",
]) {
  conferir(
    obsQueOClienteNaoDisse(obs, FALAS).length === 0,
    '"' + obs.slice(0, 40) + '" nao recusa o item',
    JSON.stringify(obsQueOClienteNaoDisse(obs, FALAS)),
  );
}

console.log("");
console.log("== e o sabor inventado de verdade continua barrado ==");
for (const obs of ["recheio de camarao", "sabor tofu", "cobertura de nutella"]) {
  conferir(
    obsQueOClienteNaoDisse(obs, FALAS).length > 0,
    '"' + obs + '" continua sendo pego',
    "passou como se o cliente tivesse pedido",
  );
}

console.log("");
console.log(erros === 0 ? "A SUGESTAO DO CODIGO ATRAVESSA AS TRES GUARDAS" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
