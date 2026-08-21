// A DATA TEM QUE CAIR NO DIA DA SEMANA QUE O CLIENTE FALOU.
//
// Caso real do teste de aceitacao de 20/08/2026. A secretaria pediu o coffee
// break pra QUARTA-FEIRA. A Dora escreveu "A retirada e quarta-feira, dia
// 27/08, as 9h" e mandou pro pedido da equipe.
//
// Em 20/08/2026, que e uma quinta, a proxima quarta e 26/08. O dia 27/08 e
// quinta. O cliente ia buscar num dia e a padaria produzir noutro, e ninguem
// perceberia ate o balcao: nem ela, que confia na Dora, nem a equipe, que le a
// comanda com a data que veio.
//
// O codigo sabe converter dia da semana em data desde sempre, mas so era
// chamado quando a Dora mandava o dia PURO ("quarta"). Mandando a data ja
// calculada, ele aceitava sem conferir. A conta dela nunca era verificada.
//
// Agora a PALAVRA DO CLIENTE vence a aritmetica dela.
//
// Roda com: node testes/data-bate-com-o-dia.cjs
const { dataBrigaComODiaDaSemana, dataQueEleEscreveu } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

// Quinta, 20 de agosto de 2026: o dia exato em que o defeito aconteceu.
const QUINTA_20 = new Date(2026, 7, 20);
console.log("hoje no teste: 20/08/2026 (quinta)");
console.log("");

console.log("== o caso real ==");
conferir(
  dataBrigaComODiaDaSemana("27/08", "preciso pra quarta-feira as 9h", QUINTA_20) === "26/08/2026",
  "quarta com data 27/08 vira 26/08",
  "veio: " + dataBrigaComODiaDaSemana("27/08", "preciso pra quarta-feira as 9h", QUINTA_20),
);

console.log("");
console.log("== data CERTA nao pode ser mexida ==");
for (const [data, fala] of [
  ["26/08", "preciso pra quarta-feira"],
  ["21/08", "quero pra sexta"],
  ["22/08", "sabado esta bom"],
  ["23/08/2026", "domingo de manha"],
  ["26/08/2026", "na quarta, as 9h"],
]) {
  const r = dataBrigaComODiaDaSemana(data, fala, QUINTA_20);
  conferir(r === null, 'nao mexe em "' + data + '" com "' + fala + '"', "mudou pra " + r);
}

console.log("");
console.log("== sem dia da semana na fala, nao ha o que conferir ==");
for (const [data, fala] of [
  ["06/09", "a festa e dia 06/09"],
  ["12/09/2026", "quero pro dia 12"],
  ["30/08", "pode ser dia 30"],
]) {
  conferir(dataBrigaComODiaDaSemana(data, fala, QUINTA_20) === null, 'nao mexe em "' + data + '"', "mexeu sem motivo");
}

console.log("");
console.log("== o cliente mudou de ideia: vale o ULTIMO dia que ele falou ==");
conferir(
  dataBrigaComODiaDaSemana("21/08", "queria sexta... pensando bem pode ser na segunda", QUINTA_20) === "24/08/2026",
  "sexta virou segunda, e a data acompanha",
  "veio: " + dataBrigaComODiaDaSemana("21/08", "queria sexta... pensando bem pode ser na segunda", QUINTA_20),
);

console.log("");
console.log("== o dia de HOJE vai pra semana que vem ==");
// Encomenda pro mesmo dia e caso de falar com a equipe, nao de anotar.
conferir(
  dataBrigaComODiaDaSemana("20/08", "pode ser na quinta mesmo", QUINTA_20) === null,
  "quinta com data de hoje (quinta) nao e conflito",
  "corrigiu uma data que ja batia",
);
conferir(
  dataBrigaComODiaDaSemana("21/08", "pode ser na quinta", QUINTA_20) === "27/08/2026",
  "quinta com data errada vai pra proxima quinta, 27/08",
  "veio: " + dataBrigaComODiaDaSemana("21/08", "pode ser na quinta", QUINTA_20),
);

console.log("");
console.log("== lixo na entrada nao quebra nada ==");
for (const [data, fala] of [
  ["", "quarta-feira"],
  ["amanha", "quarta-feira"],
  ["99/99", "quarta-feira"],
  ["27/08", ""],
]) {
  let quebrou = false;
  try {
    dataBrigaComODiaDaSemana(data, fala, QUINTA_20);
  } catch {
    quebrou = true;
  }
  conferir(!quebrou, 'aguenta "' + (data || "(vazio)") + '" com "' + (fala || "(vazio)") + '"', "estourou");
}

console.log("");
console.log("== o dia da semana vale da CONVERSA, nao da ultima frase ==");
//
// Caso real de 20/08/2026: a cliente escreveu "quero 60 brigadeiros pra sabado
// as 10h" na PRIMEIRA mensagem e o pedido foi registrado na terceira, quando
// ela so mandou nome e pagamento. Lendo so a fala do momento nao havia dia da
// semana pra conferir, e o pedido saiu com 20/08/2026, uma quinta. Ela ia
// buscar no sabado e a padaria produzir na quinta.
const conversaInteira = [
  "quero 60 brigadeiros pra sabado as 10h",
  "forminha rosa",
  "nome Terezinha Bosco, dinheiro",
].join(" | ");
conferir(
  dataBrigaComODiaDaSemana("20/08", conversaInteira, QUINTA_20) === "22/08/2026",
  "sabado dito na primeira mensagem corrige a data no fechamento",
  "veio: " + dataBrigaComODiaDaSemana("20/08", conversaInteira, QUINTA_20),
);
conferir(
  dataBrigaComODiaDaSemana("22/08", conversaInteira, QUINTA_20) === null,
  "e a data certa continua intocada",
  "mexeu numa data que ja batia",
);
const mudouNoMeio = ["quero pra sexta", "pensando bem pode ser no sabado", "nome Ana, pix"].join(" | ");
conferir(
  dataBrigaComODiaDaSemana("21/08", mudouNoMeio, QUINTA_20) === "22/08/2026",
  "mudou de ideia no meio da conversa: vale o ultimo dia",
  "veio: " + dataBrigaComODiaDaSemana("21/08", mudouNoMeio, QUINTA_20),
);

// ---------------------------------------------------------------------------
// E A DATA ESCRITA EM NUMERO TAMBEM TEM QUE CONFERIR.
//
// Medicao de 21/08/2026, conversa real:
//
//   cliente: e pro dia 06/09, retiro de manha umas 10h
//   Dora:    Anotei ... para retirar dia 06/09 as 10h.     (o texto certo)
//   banco:   retirada_data = 2026-08-22                     (a data de HOJE)
//
// Ela confirmou 06/09 na conversa e gravou 22/08. O cliente aparece quinze dias
// antes e nao existe pedido nenhum. A guarda de cima so cobria DIA DA SEMANA;
// data em numero, que e como quase todo mundo escreve, nao tinha conferencia.
// ---------------------------------------------------------------------------
console.log("");
console.log("== a data que o cliente ESCREVEU e a que vale ==");

const VINTE_E_DOIS_AGO = new Date(2026, 7, 22);
for (const [fala, esperado, oque] of [
  ["e pro dia 06/09, retiro de manha umas 10h", "2026-09-06", "o caso medido"],
  ["quero pra 12/09/2026", "2026-09-12", "com o ano escrito"],
  ["pode ser dia 5/1", "2027-01-05", "data que ja passou este ano vira ano que vem"],
  ["dia 06/09 | na verdade muda pra 13/09", "2026-09-13", "quem muda de ideia escreve de novo"],
  ["quero 100 salgados pra sexta as 10h", null, "dia da semana e da outra guarda"],
  ["retiro as 10h30", null, "hora nao e data"],
  ["quero 200 salgados", null, "quantidade nao e data"],
]) {
  const deu = dataQueEleEscreveu(fala, VINTE_E_DOIS_AGO);
  conferir(deu === esperado, oque + ": " + JSON.stringify(fala), "veio " + JSON.stringify(deu) + ", esperado " + JSON.stringify(esperado));
}

console.log("");
console.log(erros === 0 ? "A DATA BATE COM O DIA DA SEMANA" : erros + " FALHA(S) NA DATA");
process.exit(erros === 0 ? 0 : 1);
