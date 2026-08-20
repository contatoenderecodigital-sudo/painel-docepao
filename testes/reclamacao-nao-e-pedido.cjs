// RECLAMACAO NAO E PEDIDO. NUMERO NA FRASE NAO E QUANTIDADE.
//
// Caso real de 20/08/2026. O cliente, ja irritado, escreveu "ja te falei 3
// vezes". A Dora respondeu "A gente nao tem vez tambem" e, na seguinte,
// "Nao temos docinho vezes". Alem de burro, soou como deboche com quem ja
// estava reclamando. Foi um dos pontos em que o cliente desistiu.
//
// A causa: pedidosQueNaoExistem lia QUALQUER numero seguido de palavra como
// pedido, e a defesa era uma lista de palavras que nao sao comida (hora, dia,
// crianca...). Lista assim nao acaba: depois de "vezes" viria "tentativas",
// "minutos esperando", e cada uma custaria um cliente pra ser descoberta.
//
// A regra virou o contrario: so acusa se a frase for mesmo um PEDIDO, ou seja
// se tiver verbo de comprar ou uma palavra do cardapio junto do numero.
//
// Errar pra menos aqui e barato: quem impede produto inventado de entrar no
// pedido e o enum de anotar_item. Errar pra mais custa cliente, e custou.
//
// Roda com: node testes/reclamacao-nao-e-pedido.cjs
const { pedidosQueNaoExistem } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== conversa nao vira pedido ==");
for (const fala of [
  "ja te falei 3 vezes",
  "ja falei isso 2 vezes",
  "to esperando ha 20 minutos",
  "voce me perguntou isso 4 vezes",
  "sao 3 mensagens iguais",
  "fiz 2 tentativas de te explicar",
  "tem 15 minutos que eu mandei",
  "bom dia",
  "tudo bem?",
  "obrigado, 10 pra voce",
]) {
  const r = pedidosQueNaoExistem(fala);
  conferir(r.length === 0, '"' + fala + '" nao vira pedido', "acusou: " + r.join(", "));
}

console.log("");
console.log("== pedido de verdade continua sendo pego ==");
for (const [fala, esperado] of [
  ["quero 150 casadinho pra sabado", "casadinho"],
  ["queria 2 tortas de brigadeiro", null],
  ["me ve 50 empanada de camarao", "empanada"],
  ["preciso de 100 salgados e 30 caviar", "caviar"],
]) {
  const r = pedidosQueNaoExistem(fala);
  if (esperado === null) {
    conferir(true, '"' + fala + '" foi analisada sem quebrar', "");
  } else {
    conferir(
      r.some((x) => x.includes(esperado)),
      '"' + fala + '" acusa ' + esperado,
      "veio: [" + r.join(", ") + "]",
    );
  }
}

console.log("");
console.log("== o que a casa FAZ nunca pode ser acusado ==");
for (const fala of [
  "quero 200 coxinha pra sabado",
  "queria 100 brigadeiro e 100 beijinho",
  "preciso de 150 salgados assados",
  "me ve 2 kg de bolo de ninho com morango",
  "quero 3 cucas de goiaba",
  "vou querer 1 pizza de calabresa",
  "queria 50 esfirra de carne pras 16h do dia 30/08",
  "preciso de 100 docinhos, 50% brigadeiro",
]) {
  const r = pedidosQueNaoExistem(fala);
  conferir(r.length === 0, '"' + fala.slice(0, 42) + '" passa limpo', "acusou: " + r.join(", "));
}

console.log("");
console.log(erros === 0 ? "RECLAMACAO NAO VIRA PEDIDO" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
