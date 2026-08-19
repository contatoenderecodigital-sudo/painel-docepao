// POLITICA DA CASA NAO SE INVENTA.
//
// Teste com clientes ao vivo, 19/08/2026. Sem ninguem ter falado nada disso:
//
//   "Fazemos docinho sem lactose, sim. E vendido por unidade, com minimo de
//    20 de cada sabor."
//   "Cada quilo serve cerca de 10 pessoas, entao 2 kg serve umas 20 pessoas"
//   "Um quilo de cuca serve umas 8 a 10 pessoas"
//
// Nao e chatice, e exposicao da dona. Em Moffatt contra Air Canada o tribunal
// obrigou a empresa a HONRAR a politica que o proprio chatbot inventou, e
// rejeitou a defesa de que o bot seria entidade separada. Minimo de pedido
// inventado no WhatsApp e minimo que o cliente pode cobrar.
//
// O risco do conserto e cortar resposta legitima. Passar pra equipe, dizer que
// NAO tem entrega, e citar o rendimento da pizza (que esta no cardapio) tem que
// continuar saindo. O teste cobra os dois lados.
//
// Roda com: node testes/politica-nao-se-inventa.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const pasta = mkdtempSync(join(tmpdir(), "fatos-"));
// Dois arquivos de proposito: com UM so, o tsc infere a raiz como lib/ia e a
// pasta some da saida. Com dois, a raiz vira lib/ e o caminho fica previsivel.
execFileSync(
  "npx",
  ["tsc", "lib/ia/fatos.ts", "lib/tipos.ts", "--outDir", pasta, "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule"],
  { stdio: "pipe", shell: true },
);
const { fatosDaCasa, afirmacoesNaoAutorizadas } = require(join(pasta, "ia", "fatos.js"));

// A padaria de verdade: prazo de 2 dias vem da config, o resto nao existe.
const FATOS = fatosDaCasa({ prazoMinimoDias: 2 });

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== as frases REAIS que ela inventou ==");
for (const frase of [
  "E vendido por unidade, com minimo de 20 de cada sabor.",
  "Cada quilo serve cerca de 10 pessoas, entao 2 kg serve umas 20 pessoas.",
  "Um quilo de cuca serve umas 8 a 10 pessoas.",
]) {
  const pegou = afirmacoesNaoAutorizadas(frase, FATOS);
  conferir(pegou.length > 0, 'corta "' + frase.slice(0, 48) + '"', "passou batido");
}

console.log("");
console.log("== outras invencoes do mesmo tipo ==");
for (const frase of [
  "O pedido minimo e de 50 salgados.",
  "A gente entrega no centro, a taxa e R$ 10,00.",
  "Fazemos delivery pra toda a cidade.",
  "O bolo serve 25 pessoas tranquilo.",
]) {
  const pegou = afirmacoesNaoAutorizadas(frase, FATOS);
  conferir(pegou.length > 0, 'corta "' + frase.slice(0, 48) + '"', "passou batido");
}

console.log("");
console.log("== resposta LEGITIMA nao pode ser cortada ==");
// Este e o lado que quebra o atendimento se eu errar.
for (const frase of [
  "Tem entrega pro centro, mas a taxa varia e a equipe confirma isso com voce.",
  "A gente nao faz entrega, e so retirada na loja mesmo.",
  "A pizza de forma serve de 6 a 8 pessoas.",
  "A pizza meia serve 3 a 4 pessoas.",
  // Respostas da dona no audio de 19/08/2026, que TEM que sair.
  "A pizza redonda nao tem peso minimo, e montada e pesada na hora.",
  "A gente entrega em alguns casos, ja vou confirmar com a equipe se da pro seu dia.",
  "Sugiro uns 20 de cada sabor, mas se voce quiser 15 tambem da.",
  "O bolo decorado precisa de 2 dias de antecedencia.",
  "Salgado frito sai R$ 1,00 cada e o assado R$ 1,25.",
  "Quantos docinhos voce vai querer?",
  "Anotei 100 coxinhas e 50 esfirras de calabresa pro dia 06/09.",
  "A cuca a gente vende por quilo, nao por unidade.",
  "Vou confirmar com a equipe e ja te falo.",
]) {
  const pegou = afirmacoesNaoAutorizadas(frase, FATOS);
  conferir(pegou.length === 0, 'deixa passar "' + frase.slice(0, 48) + '"', "cortou: " + pegou.join(" | "));
}

console.log("");
console.log("== sem prazo na config, ela nao pode cravar prazo ==");
const SEM_PRAZO = fatosDaCasa({});
conferir(
  afirmacoesNaoAutorizadas("O bolo precisa de 2 dias de antecedencia.", SEM_PRAZO).length > 0,
  "sem prazo configurado, corta a afirmacao de prazo",
  "deixou passar prazo que a casa nao definiu",
);

console.log("");
console.log("== so corta a frase errada, o resto da mensagem sobrevive ==");
const MISTO =
  "Anotei 60 brigadeiros pro dia 12/09. E vendido com minimo de 20 de cada sabor. Qual a cor da forminha?";
const pegouMisto = afirmacoesNaoAutorizadas(MISTO, FATOS);
conferir(pegouMisto.length === 1, "acusa uma frase so na mensagem", "acusou " + pegouMisto.length);
conferir(
  pegouMisto.length === 1 && /minimo/i.test(pegouMisto[0]) && !/Anotei/i.test(pegouMisto[0]),
  "e acusa a frase CERTA, nao a anotacao",
  "acusou: " + pegouMisto.join(" | "),
);

console.log("");
console.log(erros === 0 ? "POLITICA NAO SE INVENTA" : erros + " FALHA(S) NA GUARDA DE POLITICA");
process.exit(erros === 0 ? 0 : 1);
