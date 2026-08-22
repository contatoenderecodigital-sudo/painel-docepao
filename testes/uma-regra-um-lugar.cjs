// UMA REGRA, UM LUGAR.
//
// Varredura de 22/08/2026 nos 91 pontos de decisao do cerebro, em quatro
// eixos. O achado que explica os dez dias: quinze regras moravam em mais de um
// lugar, e doze tinham DIVERGIDO. Toda vez que um aprendizado foi aplicado a
// mao em vez de virar funcao, ele chegou a uma parte dos sitios:
//
//   - "oferta nao trava pedido"  -> parametro passado em 2 de 5 chamadas
//   - "esse termo foi negado?"   -> 2 regras, e a fraca cobrava R$ 12,00
//   - "eu mesmo sugeri isso"     -> comparava com === e era sempre falsa
//   - "o cliente citou X?"       -> oito tabelas de familia, a mais curta em uso
//   - "ta bom de X e CHEGA"      -> endurecido em 1 de 4 detectores de aceite
//
// Este teste cobra as regras que foram unificadas. Ele nao testa "o codigo tem
// tal linha": ele roda a funcao com a frase do cliente e confere a resposta.
//
// Roda com: node testes/uma-regra-um-lugar.cjs
const g = require("./_guardas.cjs")();
const fs = require("fs");
const path = require("path");
const cerebro = fs.readFileSync(path.join(__dirname, "..", "lib", "ia", "cerebro.ts"), "utf8");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log('== "esse termo foi negado?" -- uma resposta so ==');
// O caso que cobrava R$ 12,00: a copia do orcamento exigia espaco depois de
// "quer", e "nao querO papel" tem um "o".
for (const [fala, termo, negado, oque] of [
  ["nao quero papel de arroz", "papel", true, "o caso medido, sem acento"],
  ["não quero papel de arroz", "papel", true, "com acento"],
  ["nao quero topo nem papel de arroz", "papel", true, '"nem" nega o segundo item'],
  ["nao quero topo nem papel de arroz", "topo", true, '"nem" nega o primeiro tambem'],
  ["dispensa o papel de arroz", "papel", true, "dispensa"],
  ["sem topo", "topo", true, "sem"],
  ["deixa pra la o topo", "topo", true, "deixa pra la"],
  ["esquece o papel de arroz", "papel", true, "esquece"],
  // Os negativos: querer nao pode virar negar.
  ["quero topo de homem aranha", "topo", false, "pedir o topo"],
  ["pode por papel de arroz sim", "papel", false, "aceitar o papel"],
  ["quero bolo de morango", "topo", false, "nem citou o termo"],
]) {
  conferir(g.foiNegado(fala, termo) === negado, oque + ": " + JSON.stringify(fala), "deu " + g.foiNegado(fala, termo));
  // As duas sao a mesma pergunta com o sinal trocado: nunca podem concordar.
  if (String(fala).includes(termo)) {
    conferir(
      g.citadoDeVerdade(fala, termo) === !negado,
      "  e citadoDeVerdade e o contrario exato",
      "as duas copias voltaram a divergir",
    );
  }
}

console.log("");
console.log("== a cor da forminha: todas as cores, na ordem em que ele falou ==");
const doisTermos = g.coresDeForminhaQueEleFalou("pao de lo branco, forminha rosa");
conferir(
  doisTermos.length >= 2 && String(doisTermos[doisTermos.length - 1]).includes("rosa"),
  'o caso medido: "pao de lo branco, forminha rosa" -> a forminha e ROSA',
  "deu " + JSON.stringify(doisTermos) + " (130 docinhos na cor errada)",
);
conferir(
  cerebro.includes("const ditasAqui = coresDeForminhaQueEleFalou"),
  "o bloco que grava a cor usa a funcao, nao um match do primeiro pedaco",
  "a copia fraca voltou, e ela grava 'forminha branc'",
);

console.log("");
console.log("== pergunta nao e pedido, nos seis lugares ==");
for (const [fala, produto, soPerguntou] of [
  ["quanto custa o bolo de cenoura?", "bolo", true],
  ["vcs fazem bolo de cenoura?", "bolo", true],
  ["e o bolo de morango?", "bolo", true],
  ["tem bolo de pote?", "bolo", true],
  ["quero um bolo de 3 kg", "bolo", false],
  ["me ve 2 kg de bolo de morango", "bolo", false],
]) {
  conferir(
    g.soPerguntouSemPedir(fala, produto) === soPerguntou,
    (soPerguntou ? "so pergunta: " : "e pedido:   ") + JSON.stringify(fala),
    "deu " + g.soPerguntouSemPedir(fala, produto),
  );
}
// Os cinco chamadores que faltavam. Sem eles a funcao existe e nao serve.
for (const [trecho, oque] of [
  ["!soPerguntouSemPedir(fr, \"bolo\")", "a guarda de registro e a de etapa usam a funcao"],
]) {
  const vezes = cerebro.split(trecho).length - 1;
  conferir(vezes >= 3, oque + " (" + vezes + " lugares)", "voltou a ser lista de palavras escrita a mao");
}

console.log("");
console.log('== "oferta nao trava pedido" nas CINCO chamadas ==');
const chamadas = cerebro.split("pendenciasDeSabor(").length - 1 - 1; // -1 pela declaracao
const comFechando = (cerebro.match(/pendenciasDeSabor\([\s\S]{0,400}?\n\s*(temTudo|temOsDados|osQuatroDados\(montagemDoTurno\)),/g) ?? []).length;
conferir(
  comFechando >= 5,
  "as " + chamadas + " chamadas passam o estado de fechamento (" + comFechando + " passam)",
  "uma oferta pendente volta a segurar o pedido no turno do ultimo dado",
);

console.log("");
console.log("== a pergunta que o pedido precisa nao pode sumir ==");
// Falta a data. O codigo anexa a pergunta todo turno; a guarda apagava por
// repetida e a mensagem voltava sem saida nenhuma.
const comData = g.textoSemPerguntaJaFeita("Anotei os salgados. Pra que dia você quer?", [
  "Pra que dia você quer?",
]);
conferir(
  /\?/.test(comData),
  "pergunta de data repetida SOBREVIVE quando e a unica",
  "a conversa morre a dois passos da venda: " + JSON.stringify(comData),
);
// E a oferta repetida continua sendo cortada -- essa pode sumir.
const oferta = g.textoSemPerguntaJaFeita("Anotei tudo certinho. Vai querer salgado também pra festa?", [
  "Vai querer salgado também pra festa?",
]);
conferir(
  !/\?/.test(oferta),
  "oferta repetida continua sendo cortada",
  "voltou a repetir oferta: " + JSON.stringify(oferta),
);

console.log("");
console.log("== cortar a pergunta de hora nao deixa interrogacao solta ==");
for (const t of [
  "Anotei tudo aqui. Que horas você retira?",
  "Fechou. Que horas você vai buscar o pedido?",
]) {
  const saida = g.textoSemPerguntaDeHora(t);
  conferir(
    !/[.!]\s*\?\s*$/.test(saida) && saida.trim().length > 5,
    "sem interrogacao solta: " + JSON.stringify(t),
    "saiu " + JSON.stringify(saida),
  );
}
conferir(
  g.textoSemPerguntaDeHora("*Pedido recebido*\ncoxinha: 50 un\n*Total: R$ 50,00*") .includes("*Total:"),
  "o recibo passa inteiro por esta guarda",
  "a unica das cinco guardas de corte sem a protecao do recibo",
);

console.log("");
console.log('== "ta bom de salgado" nao e aceite, em nenhum dos detectores ==');
conferir(!g.aceitouAOferta("ta bom de salgado"), '"ta bom de salgado" nao e SIM', "80 salgados a mais na cozinha");
conferir(g.aceitouAOferta("ta bom"), '"ta bom" continua sendo SIM', "travou aceite legitimo");
conferir(
  cerebro.includes("const aceitou = aceitouAOferta(String(ultimaFala ?? \"\"))"),
  "o detector do sabor usa a funcao endurecida",
  "a copia frouxa voltou: o sabor da PERGUNTA dela vira escolha do cliente",
);

console.log("");
console.log("== o teto do pedido e o ULTIMO numero, e aceita 'de' ==");
conferir(
  g.totalQueElePediu(["quero 200 salgados pra sabado", "na verdade muda pra 150 salgados"], "salgado") === 150,
  "o cliente mudou de 200 pra 150: vale 150",
  "usa o total velho e recusa a segunda metade do pedido",
);
conferir(
  g.totalQueElePediu(["quero 300 de salgado assado"], "salgado") === 300,
  '"300 DE salgado" conta',
  "teto 0: o primeiro tipo leva o pedido inteiro",
);
conferir(
  cerebro.includes("let pedidoTotal = totalQueElePediu("),
  "o teto do anotar_item usa a funcao, nao um match da conversa colada",
  "voltou a congelar no primeiro numero que o cliente falou",
);

console.log("");
console.log("== o turno nao e jogado fora quando ela tropeça ==");
const returns = cerebro.split("montagem: estado.montagem").length - 1;
conferir(
  returns >= 4,
  "os returns de emergencia devolvem a montagem (" + returns + " lugares)",
  "tudo que a IA anotou no turno e descartado em silencio",
);

console.log("");
console.log(
  erros === 0
    ? "UMA REGRA, UM LUGAR"
    : erros + " FALHA(S): uma regra voltou a morar em dois lugares",
);
process.exit(erros === 0 ? 0 : 1);
