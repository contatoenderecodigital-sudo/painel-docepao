// QUATRO FAMILIAS NUMA MENSAGEM SO.
//
// Conversa real de 21/08/2026. O cliente escreveu tudo de uma vez:
//
//   "quero 100 coxinhas, 50 brigadeiros, um bolo de brigadeiro de 3 kg
//    e uma pizza inteira de calabresa"
//
// O que ficou gravado:
//   coxinha 100                          certo
//   bolo brigadeiro 3 kg                 certo, mas com "papel de arroz" na obs
//   pizza inteira brigadeiro, qtd 50     ERRADO
//
// Os 50 brigadeiros (docinho, R$ 1,25 = R$ 62,50) viraram 50 PIZZAS INTEIRAS
// (R$ 120,00 cada = R$ 6.000,00), e a pizza de calabresa que ele pediu SUMIU.
//
// Tres causas, todas em quantidadePorSabor e pecasDoBoloQueEleAceitou:
//
//   1. "brigadeiro" e docinho, sabor de bolo E sabor de pizza doce. A lista de
//      sabores era consultada chapada, e bastava a palavra "pizza" aparecer UMA
//      vez em qualquer ponto da conversa.
//   2. a janela de tres palavras engolia "pizza inteira de" e nunca chegava em
//      "calabresa".
//   3. "nao quero topo NEM papel de arroz": o "nem" nao era negacao, e o
//      "quero" de "nao quero" contava como aceite. R$ 12,00 que ele recusou.
//
// Nenhum teste do projeto mandava mais de uma familia na mesma mensagem, e a
// palavra "nem" nunca tinha sido testada em lugar nenhum.
//
// Roda com: node testes/quatro-familias-numa-mensagem-so.cjs
const { quantidadePorSabor, pecasDoBoloQueEleAceitou } = require("./_guardas.cjs")();
const catalogo = require("../lib/ia/dados/catalogo.json");

const SABORES = [
  ...(catalogo.pizza?.sabores_salgados ?? []),
  ...(catalogo.pizza?.sabores_doces ?? []),
];

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== a mensagem que custou R$ 6.000 ==");
const A_MENSAGEM =
  "quero 100 coxinhas, 50 brigadeiros, um bolo de brigadeiro de 3 kg e uma pizza inteira de calabresa";
const r = quantidadePorSabor(A_MENSAGEM, SABORES);
conferir(
  r.some((x) => x.sabor === "calabresa" && x.qtd === 1),
  "a pizza de calabresa que ele pediu ENTRA",
  "saiu " + JSON.stringify(r),
);
conferir(
  !r.some((x) => x.sabor === "brigadeiro"),
  "os 50 brigadeiros NAO viram 50 pizzas de R$ 120,00",
  "saiu " + JSON.stringify(r),
);
conferir(
  !r.some((x) => x.existe === false),
  "e nao sobra sabor fantasma (o 'bolo' de 'um bolo de brigadeiro')",
  "saiu " + JSON.stringify(r),
);

console.log("");
console.log("== sabor que existe em duas familias segue a frase, nao a conversa ==");
for (const [fala, esperado] of [
  ["50 brigadeiros", 0],
  ["quero 30 prestigios", 0],
  ["quero 2 pizzas de brigadeiro", 1],
  ["uma pizza de prestigio", 1],
  ["2 calabresa e 1 de frango com catupiry", 2],
]) {
  const deu = quantidadePorSabor(fala, SABORES);
  conferir(deu.length === esperado, JSON.stringify(fala) + " -> " + esperado + " pizza(s)", JSON.stringify(deu));
}

console.log("");
console.log("== 'nem' e negacao, nos dois sentidos da frase ==");
for (const [fala, topo, papel] of [
  ["nao quero topo nem papel de arroz", false, false],
  ["nao quero papel de arroz nem topo", false, false],
  ["sem topo nem papel de arroz", false, false],
  ["sem topo e sem papel de arroz", false, false],
  ["papel de arroz e topo sim", true, true],
  ["quero os dois, topo de bolo e papel de arroz", true, true],
  ["so o papel de arroz, sem topo", false, true],
]) {
  const d = pecasDoBoloQueEleAceitou(fala);
  conferir(
    d.topo === topo && d.papel === papel,
    JSON.stringify(fala),
    "topo=" + d.topo + " papel=" + d.papel + " (esperado topo=" + topo + " papel=" + papel + ")",
  );
}

console.log("");
console.log(erros === 0 ? "AS QUATRO FAMILIAS CHEGAM INTEIRAS" : erros + " FALHA(S): item errado ou preco errado no pedido");
process.exit(erros === 0 ? 0 : 1);
