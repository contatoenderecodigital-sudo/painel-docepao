// MUDAR DE IDEIA TEM QUE SER POSSIVEL.
//
// `nao_quer` bloqueia tres coisas ao mesmo tempo: a oferta, o cardapio e a
// cobranca da etapa. E, ate 22/08/2026, ele SO ACUMULAVA -- nao existia em
// lugar nenhum do codigo um caminho que tirasse uma familia de la.
//
// Duas consequencias:
//
//   1. o cliente que dizia "agora nao quero bolo nao" e tres mensagens depois
//      "pensando bem quero um bolo de 3 kg" nunca mais recebia o cardapio de
//      bolos, e a etapa parava de cobrar o bolo. O item mais caro da festa
//      sumia da conversa.
//
//   2. pior: o proprio SISTEMA gravava a recusa. A regra "ofereci duas vezes e
//      ele nao respondeu" escreve `nao_quer` sozinha -- e o cliente podia estar
//      respondendo outra coisa nas duas vezes. Uma decisao que ele nunca tomou,
//      permanente.
//
// E a regra de "ele dispensou essa familia?" morava em CINCO lugares com
// quatro vocabularios. Rodado lado a lado antes do conserto:
//
//   "dispensa salgado"        peca=nao  cardapio=nao  grava=SIM  corta=SIM
//   "deixa pra la o salgado"  peca=nao  cardapio=nao  grava=nao  corta=SIM
//   "esquece o salgado"       peca=nao  cardapio=nao  grava=nao  corta=nao
//
// Com "deixa pra la o docinho": a copia que grava nao pegava (a etapa
// continuava cobrando docinho) e a que corta o texto pegava (a frase "anotei
// que voce nao quer docinho" ficava na mensagem). Ela dizia que anotou a
// recusa e continuava oferecendo, na mesma conversa.
//
// Roda com: node testes/mudar-de-ideia-e-permitido.cjs
const g = require("./_guardas.cjs")();
const fs = require("fs");
const path = require("path");
const cerebro = fs.readFileSync(path.join(__dirname, "..", "lib", "ia", "cerebro.ts"), "utf8");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== dispensar tem UM vocabulario, nao quatro ==");
for (const [fala, fam] of [
  ["nao quero salgado", "salgado"],
  ["não quero salgado", "salgado"],
  ["sem salgado", "salgado"],
  ["nem salgado", "salgado"],
  ["dispensa salgado", "salgado"],
  ["deixa pra la o salgado", "salgado"],
  ["esquece o salgado", "salgado"],
  ["nada de docinho", "docinho"],
  ["nao quero doce nenhum", "docinho"],
  ["deixa pra la o bolo", "bolo"],
  ["nao vou querer bolo", "bolo"],
]) {
  const deu = g.familiasQueEleDispensou(fala);
  conferir(deu.includes(fam), "dispensou " + fam + ": " + JSON.stringify(fala), "deu " + JSON.stringify(deu));
}
for (const fala of ["quero 100 salgados", "vou querer bolo sim", "pode por docinho"]) {
  const deu = g.familiasQueEleDispensou(fala);
  conferir(deu.length === 0, "pedir nao e dispensar: " + JSON.stringify(fala), "deu " + JSON.stringify(deu));
}

console.log("");
console.log("== as cinco copias sumiram: uma funcao so ==");
for (const [trecho, oque] of [
  ["familiasQueEleDispensou(dispensou)", "o filtro do enviar_cardapio"],
  ["familiasQueEleDispensou(falaRecusa)", "o bloco que grava nao_quer"],
  ["familiasQueEleDispensou(falaDele).length > 0", "o corte da frase de recusa"],
]) {
  conferir(cerebro.includes(trecho), oque + " usa a funcao", "uma copia voltou a nascer");
}
conferir(
  !/const RECUSOU: \[string, RegExp\]\[\]/.test(cerebro) && !/const RECUSA: \[string, RegExp\]\[\]/.test(cerebro),
  "as tabelas de regex copiadas foram apagadas",
  "ainda ha lista escrita a mao pra manter em par",
);

console.log("");
console.log("== pedir de volta desfaz a recusa ==");
for (const [conversa, fam, volta, oque] of [
  ["nao quero bolo  pensando bem quero um bolo de 3 kg", "bolo", true, "o caso medido"],
  ["sem docinho  ah, me ve 50 brigadeiro entao", "docinho", true, "pediu pelo nome do produto"],
  ["nao quero salgado  pode por 100 coxinha", "salgado", true, "pediu com quantidade"],
  // Os negativos: citar nao e pedir de volta.
  ["nao quero bolo", "bolo", false, "so a recusa"],
  ["nao quero bolo  entao nao quero bolo mesmo", "bolo", false, "repetir a recusa"],
  ["nao quero bolo  quanto custa o bolo?", "bolo", false, "perguntar o preco depois de recusar"],
  ["nao quero docinho  quero 100 coxinha", "docinho", false, "pedir OUTRA familia"],
]) {
  const deu = g.pediuDeVoltaAFamilia(conversa, fam);
  conferir(deu === volta, oque + ": " + JSON.stringify(conversa), "deu " + deu);
}
conferir(
  cerebro.includes("const voltouAQuerer = jaDispensado"),
  "o cerebro desfaz o nao_quer quando ele pede de volta",
  "nao_quer volta a ser decisao permanente",
);

console.log("");
console.log("== o papel de arroz tem preco; o topo nao ==");
conferir(
  g.chutouValorDoTopo("O papel de arroz sai R$ 12,00 cada.").length === 0,
  "o preco de tabela do papel de arroz nao e apagado",
  "o codigo responde certo e a guarda seguinte troca por informacao falsa",
);
conferir(
  g.chutouValorDoTopo("O topo de bolo fica uns R$ 80,00.").length > 0,
  "o valor chutado do topo continua sendo barrado",
  "ela volta a inventar o preco do topo",
);

console.log("");
console.log(
  erros === 0
    ? "MUDAR DE IDEIA E PERMITIDO"
    : erros + " FALHA(S): o cliente ficou preso numa decisao que talvez nem tenha tomado",
);
process.exit(erros === 0 ? 0 : 1);
