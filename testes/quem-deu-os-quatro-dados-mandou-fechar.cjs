// QUEM DEU OS QUATRO DADOS MANDOU FECHAR.
//
// Medição de 22/08/2026. Três cenários, cinco execuções cada, TODAS falharam do
// mesmo jeito — e os itens estavam certos no banco nas quinze:
//
//   cliente: as 16h, nome Ana Beatriz Rocha, pix
//   Dora:    Anotei o nome Ana Beatriz Rocha, dia 10/10 às 16h, e pagamento no
//            pix. Quer bolo também?
//
//   banco:   50 coxinha | 50 empadinha (frango) | 50 mini bolha (carne)
//   pedido:  NENHUM
//
// O cliente entregou item, data, hora, nome e pagamento, e ela ofereceu bolo em
// vez de fechar. O cliente sai achando que encomendou e ninguém descobre até o
// dia da retirada — o pior defeito que existe aqui.
//
// A CAUSA NÃO ERA O UPSELL. O fechamento forçado (`obrigarFechamento`) já
// existe e é bem feito: quando o código confere item, sabor e os QUATRO dados,
// a API é obrigada a chamar registrar_pedido e a decisão sai das mãos dela.
//
// Só que ele nunca disparava, porque um dos quatro nunca ficava gravado. Hora
// tem extrator em código (`horaQueEleFalou`), pagamento tem
// (`pagamentoQueEleFalou`), data passou a ter (`dataQueEleEscreveu`) — NOME não
// tinha. Ela escrevia "Anotei o nome Ana Beatriz Rocha" no texto sem chamar a
// ferramenta, o dado não existia, os quatro nunca fechavam a conta, e o upsell
// ganhava por WO.
//
// A lição já estava no diário, no defeito 22 de 20/08: "Quem entrega os quatro
// dados mandou fechar sem dizer." Estava escrita e não era cobrada por teste.
//
// Roda com: node testes/quem-deu-os-quatro-dados-mandou-fechar.cjs
const { nomeQueEleFalou } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== o nome que o cliente deu, lido pelo código ==");
for (const [falas, esperado] of [
  // O caso da medição, nas três variações que apareceram.
  [["as 16h, nome Ana Beatriz Rocha, pix"], "Ana Beatriz Rocha"],
  [["isso mesmo, nome Juliana Reis, boleto faturado"], "Juliana Reis"],
  [["nome Marcia Fontana, pix"], "Marcia Fontana"],
  // As outras formas que aparecem em conversa de verdade.
  [["e no nome de Renata"], "Renata"],
  [["meu nome e Jorge"], "Jorge"],
  [["sou a Camila"], "Camila"],
  [["pode ser no nome de Patricia Bonfanti"], "Patricia Bonfanti"],
  // Quem corrige o nome escreve de novo: vale o último.
  [["nome Ana", "na verdade pode ser nome Beatriz"], "Beatriz"],
]) {
  const deu = nomeQueEleFalou(falas);
  conferir(deu === esperado, JSON.stringify(falas.join(" | ")), "veio " + JSON.stringify(deu) + ", esperado " + JSON.stringify(esperado));
}

console.log("");
console.log("== e NÃO inventa titular quando ninguém deu nome ==");
for (const [falas, porque] of [
  [["quero 100 salgados pra sabado"], "não tem nome nenhum"],
  [["o pedido fica no nome de quem?"], "é a PERGUNTA dela, não a resposta dele"],
  [["vou levar pra Ana"], "nome solto numa frase não é o titular"],
  [["quero um bolo pro aniversario da Alice"], "aniversariante não é quem retira"],
  [["nome de quem?"], "pergunta"],
]) {
  const deu = nomeQueEleFalou(falas);
  conferir(deu === null, JSON.stringify(falas.join(" | ")) + " (" + porque + ")", "inventou " + JSON.stringify(deu));
}

console.log("");
console.log(
  erros === 0
    ? "O NOME E LIDO, E OS QUATRO DADOS FECHAM A CONTA"
    : erros + " FALHA(S): o pedido não fecha sozinho e o cliente sai achando que encomendou",
);
process.exit(erros === 0 ? 0 : 1);
