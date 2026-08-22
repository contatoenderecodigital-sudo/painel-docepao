// O BASICO QUE NINGUEM TESTA.
//
// 22/08/2026, 07:56. O dono foi testar na mao, no WhatsApp de verdade, e
// mandou a mensagem mais simples que existe:
//
//   (ontem 14:35) Dora: Anotei 50 empadinhas de frango e 50 mini bolhas de
//                       carne. Vai querer docinho tambem, ou prefere so
//                       salgados, bolo, pizza, torta ou empadao?
//   (hoje 07:56)  ele:  Bom dia
//   (hoje 07:56)  Dora: Vai querer docinho tambem, ou so salgados, bolo,
//                       pizza, torta e empadao na festa?
//
// Ela nao deu bom dia. E emendou a pergunta de dezessete horas antes, palavra
// por palavra, como se a conversa nao tivesse parado.
//
// POR QUE NENHUM TESTE PEGOU: todos os 57 testes nasceram de um defeito que ja
// tinha acontecido. Festa de 25 pessoas com quatro familias, troca de bolo no
// meio do pedido, esfirra virando pizza de R$ 12.000, os 84 produtos do
// cardapio -- tudo isso tem rede. "Bom dia" nao tinha, porque ninguem escreve
// teste pra dar bom dia.
//
// O complexo estava coberto. O obvio nao. Este arquivo cobre o obvio.
//
// Roda com: node testes/o-basico-que-ninguem-testa.cjs
const fs = require("fs");
const path = require("path");
const cerebro = fs.readFileSync(path.join(__dirname, "..", "lib", "ia", "cerebro.ts"), "utf8");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

// A mesma regra do cerebro, extraida da fonte pra nao divergir em silencio.
const acha = cerebro.match(
  /const soCumprimentou =\s*\n\s*\/\^([\s\S]*?)\/i\.test\(/,
);
if (!acha) {
  console.log("ERRO  nao achei `soCumprimentou` no cerebro.ts (foi renomeado ou removido)");
  process.exit(1);
}
const SO_CUMPRIMENTOU = new RegExp("^" + acha[1], "i");

console.log("== o cliente so cumprimentou ==");
for (const [fala, ehSaudacao] of [
  ["Bom dia", true],
  ["bom dia", true],
  ["Boa tarde", true],
  ["boa noite!", true],
  ["oi", true],
  ["oii", true],
  ["Olá", true],
  ["ola", true],
  ["opa", true],
  ["e ai", true],
  ["e aí!", true],
  ["salve", true],
  ["Bom dia.", true],
  ["oi?", true],
  // Cumprimento COM pedido junto nao e so cumprimento: tem assunto pra tratar.
  ["bom dia, quero 100 salgados", false],
  ["oi, quanto custa o cento?", false],
  ["boa tarde tudo bem? preciso de um bolo", false],
  ["oi, tem pastel?", false],
  // E o que nao e cumprimento nenhum.
  ["quero 50 coxinha", false],
  ["pode fechar", false],
  ["obrigado", false],
]) {
  const deu = SO_CUMPRIMENTOU.test(fala);
  conferir(
    deu === ehSaudacao,
    (ehSaudacao ? "so cumprimento: " : "tem assunto:    ") + JSON.stringify(fala),
    "deu " + deu,
  );
}

console.log("");
console.log("== quem da bom dia recebe bom dia, na hora certa ==");
// A mesma conta do cerebro: ate 11h59 bom dia, 12h-17h59 boa tarde, resto boa noite.
const cumprimentoDaHora = (h) => (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
for (const [h, esperado] of [
  [0, "Bom dia"], [7, "Bom dia"], [11, "Bom dia"],
  [12, "Boa tarde"], [15, "Boa tarde"], [17, "Boa tarde"],
  [18, "Boa noite"], [22, "Boa noite"], [23, "Boa noite"],
]) {
  conferir(cumprimentoDaHora(h) === esperado, h + "h -> " + esperado, "deu " + cumprimentoDaHora(h));
}
conferir(
  cerebro.includes('const cumprimento = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";'),
  "o cerebro escolhe o cumprimento pela hora de Brasilia",
  "ela volta a dar boa tarde as 9 da manha, ou a nao cumprimentar",
);
conferir(
  cerebro.includes('timeZone: "America/Sao_Paulo"') && cerebro.includes("ele so cumprimentou; a resposta comeca cumprimentando de volta"),
  "  e deixa rastro quando corrige",
  "sem rastro nao da pra saber se entrou",
);

console.log("");
console.log("== e retoma DIZENDO de que assunto esta falando ==");
// Foi isto que faltou no caso real: a pergunta de ontem chegou solta hoje.
conferir(
  cerebro.includes('"! Você tinha deixado anotado "') && cerebro.includes('". Quer seguir com esse pedido?"'),
  "com pedido pendente, ela relembra o que estava anotado",
  "a pergunta de ontem volta a chegar solta no dia seguinte",
);
conferir(
  cerebro.includes('cumprimento + "! Como posso te ajudar?"'),
  "sem pedido pendente, cumprimenta e pergunta o que ele precisa",
  "cumprimento sozinho, sem abrir a conversa",
);

console.log("");
console.log(
  erros === 0
    ? "O BASICO ESTA COBERTO"
    : erros + " FALHA(S): a mensagem mais simples do WhatsApp quebrou de novo",
);
process.exit(erros === 0 ? 0 : 1);
