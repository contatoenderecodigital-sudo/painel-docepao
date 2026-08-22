// O DOCINHO PEDIDO A PARTE NAO VIRA RECHEIO DO BOLO
// E RETIRADA NAO ACONTECE NO PASSADO
//
// Dois defeitos de duas conversas REAIS de 22/08/2026, as que fizeram o dono
// recuar da entrega.
//
// 1) kemilly, festa do filho Arthur:
//
//      cliente: 4 leites 1kg e 100 brigadeiros e 100 beijinhos
//      Dora:    Anotei o bolo 4 leites COM BRIGADEIRO, 1 kg
//
//    Os 100 brigadeiros eram os DOCINHOS dela. Brigadeiro e beijinho sao sabor
//    de bolo E nome de docinho, entao a guarda de bolo misto leu os dois na
//    mesma frase e recusou o bolo duas vezes. O bolo nunca entrou no pedido e a
//    cliente teve que cobrar: "ta e os doces q eu pedi?".
//
//    Quem pede recheio nao diz quantidade ("bolo de brigadeiro com morango").
//    Quem pede docinho diz "100 brigadeiros". O numero na frente separa os dois.
//
// 2) A mesma cliente escreveu "dia 02" e o pedido foi anotado pra 02/08/2026,
//    tres semanas ANTES da conversa. Pedido com data no passado nao entra na
//    producao de ninguem: a cozinha nao ve, e o cliente aparece no balcao e
//    nao tem nada.
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..");
const { dataDeRetiradaNoPassado } = require("./_guardas.cjs")();

const falhas = [];

// ---------------------------------------------------------------- data passada
const hoje = new Date(2026, 7, 23); // 23/08/2026, o dia da conversa real
const casos = [
  // data, esperado ("" = nao mexe)
  ["02/08/2026", "02/09/2026"], // o caso real: dia 02 caiu no mes que passou
  ["30/07/2026", "30/08/2026"],
  ["02/09/2026", ""],           // futuro: nao se mexe
  ["23/08/2026", ""],           // hoje NAO e passado: encomenda pra hoje existe
  ["15/12/2026", ""],
];
for (const [entrada, esperado] of casos) {
  const saiu = dataDeRetiradaNoPassado(entrada, hoje);
  if (saiu !== esperado) {
    falhas.push("data " + entrada + " virou " + JSON.stringify(saiu) + ", esperava " + JSON.stringify(esperado));
  }
}
// A data corrigida nunca pode continuar no passado.
for (const [entrada] of casos) {
  const saiu = dataDeRetiradaNoPassado(entrada, hoje);
  if (!saiu) continue;
  const [d, m, a] = saiu.split("/").map(Number);
  if (new Date(a, m - 1, d) < hoje) falhas.push("a correcao devolveu outra data no passado: " + saiu);
}

// ------------------------------------------------- docinho nao e recheio
// A guarda mora no cerebro e nao e exportada: aqui se cobra que a regra do
// numero na frente continue escrita, e que ela nao volte a ler a fala inteira
// sem olhar a quantidade.
const cerebro = fs.readFileSync(path.join(raiz, "lib/ia/cerebro.ts"), "utf8");
if (!/UM SABOR COM QUANTIDADE PROPRIA E OUTRO ITEM/.test(cerebro)) {
  falhas.push("a regra do docinho com quantidade sumiu do cerebro; o bolo volta a ser recusado");
}
if (/const ditos = SABORES_DE_BOLO\.filter\(\(sab\) => new RegExp\(sab, "i"\)\.test\(ultimaFala\)\);/.test(cerebro)) {
  falhas.push("a guarda de bolo misto voltou a ler todo sabor da frase sem olhar a quantidade");
}
if (!/temQuantidadePropria/.test(cerebro)) {
  falhas.push("o teste da quantidade propria sumiu");
}

console.log("Datas conferidas: " + casos.length);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: docinho pedido a parte nao vira recheio, e retirada nao cai no passado.");
