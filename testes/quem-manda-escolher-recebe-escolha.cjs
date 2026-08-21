// TODA GUARDA QUE RECUSA POR "O CLIENTE NAO FALOU" TEM QUE ACEITAR A DELEGACAO.
//
// O cliente que escreve "escolhe voce, confio" esta pedindo ajuda. Se a Dora
// escolhe e a guarda recusa, ela apanha por ter obedecido e o pedido fica
// vazio, com ela perguntando "qual o recheio de cada um?" sem ter item nenhum
// anotado. O cliente nao faz ideia de que "cada um" e esse.
//
// Isso apareceu QUATRO vezes em conversa, sempre numa guarda irma que eu nao
// tinha procurado:
//   - produto fantasma (eram tres guardas diferentes)
//   - quantidade sugerida pelo proprio codigo
//   - recheio de salgado
//   - sabor do bolo e pao de lo
//
// Este teste conta as guardas do tipo e cobra que TODAS reconhecam a delegacao.
// Guarda nova do mesmo tipo quebra aqui antes de chegar no cliente.
//
// Roda com: node testes/quem-manda-escolher-recebe-escolha.cjs
const fs = require("node:fs");
const { pediuQueVoceEscolha } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

const fonte = fs.readFileSync("lib/ia/cerebro.ts", "utf8");
const linhas = fonte.split("\n");

// As recusas do tipo "o cliente nao falou".
const RECUSA = /(nunca falou|nunca escreveu|ninguem falou|nao falou)/i;
const alvos = [];
linhas.forEach((l, i) => {
  if (/NAO anotei|Nao anotei/.test(l) && RECUSA.test(l)) alvos.push(i + 1);
});

console.log("Guardas que recusam por 'o cliente nao falou': " + alvos.length);
console.log("");

// Cada uma tem que reconhecer a delegacao em algum lugar das 30 linhas acima.
const RECONHECE = /pediuQueVoceEscolha|mandouEscolher|delegou|euMesmoSugeri|sugeridos|eleMandouEscolher/;
const sem = [];
for (const n of alvos) {
  const trecho = linhas.slice(Math.max(0, n - 31), n).join("\n");
  if (!RECONHECE.test(trecho)) sem.push(n);
}
conferir(
  sem.length === 0,
  "todas as " + alvos.length + " reconhecem quando o cliente manda escolher",
  "sem delegacao nas linhas: " + sem.join(", "),
);

console.log("");
console.log("== e os jeitos de delegar sao reconhecidos ==");
for (const f of [
  "escolhe voce os tipos, to sem tempo",
  "pode escolher voce",
  "confio em voce",
  "sugere ai pra mim",
  "o que voce indicar ta bom",
  "voce que sabe",
  "manda o que for melhor",
  "tanto faz, o que voce achar melhor",
]) {
  conferir(pediuQueVoceEscolha(f), '"' + f.slice(0, 42) + '"', "nao reconheceu a delegacao");
}

console.log("");
console.log("== e quem NAO delegou continua protegido ==");
// O outro lado importa igual: sem isto ela volta a escolher sabor por conta
// propria e a cozinha produz o que ninguem pediu.
for (const f of [
  "quero 100 coxinhas",
  "quanto custa o cento?",
  "bom dia",
  "quero um bolo de 2 kg de brigadeiro",
  "pra quarta as 9h",
]) {
  conferir(!pediuQueVoceEscolha(f), '"' + f.slice(0, 42) + '" nao e delegacao', "abriria a porta sem ele pedir");
}

console.log("");
console.log(erros === 0 ? "QUEM MANDA ESCOLHER RECEBE ESCOLHA" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
