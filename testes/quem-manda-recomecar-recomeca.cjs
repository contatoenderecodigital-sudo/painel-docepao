// QUEM MANDA RECOMECAR, RECOMECA
//
// Teste do dono no celular dele, 23/08/2026:
//
//   cliente: vamos reiniciar nossa conversa. ok?
//   Dora:    Fechou, Suelen, ja anotei seu nome, data, hora e que vai pagar no
//            pix. Prefere fritos, assados ou um sortido?
//
// Ela disse "fechou" e nao reiniciou nada, porque nao havia o que reiniciar: o
// pedido em montagem guarda nome, data, hora e pagamento de proposito, pra
// pessoa nao repetir os dados a cada mensagem, e nao existia porta de saida.
// Quem desistiu do pedido e quis comecar outro ficava preso ao anterior, e a
// unica saida era alguem mexer no banco.
//
// Duas coisas que este teste protege, alem do reconhecimento da frase:
//
// 1. A saida NAO passa pelo modelo. Apagar o pedido de alguem nao e decisao de
//    redacao, e a volta pelo modelo so acrescentaria a chance de ele responder
//    "fechou" sem apagar nada, que foi exatamente o que aconteceu. De quebra,
//    recomecar deixa de custar dinheiro.
//
// 2. Os TRES lugares que aplicam mudanca de montagem tratam o zerar. Ja
//    aconteceu de um caminho ser corrigido e o irmao ficar para tras neste
//    projeto, mais de uma vez.
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..");
const { mandouRecomecar } = require("./_guardas.cjs")();

const falhas = [];

// ------------------------------------------------ a frase e reconhecida
const recomeca = [
  "vamos reiniciar nossa conversa. ok?", // a frase real do dono
  "quero recomecar",
  "apaga tudo e comeca de novo",
  "cancelar tudo",
  "zerar o pedido",
  "esquece tudo",
];
for (const f of recomeca) {
  if (!mandouRecomecar(f)) falhas.push("nao entendeu que era pra recomecar: " + f);
}

// -------------------------------------- e o que NAO e recomecar nao apaga
// Apagar pedido por engano e pior que nao apagar: o cliente perde o que ja
// tinha combinado e a padaria perde a venda.
const naoRecomeca = [
  "nao quero reiniciar",
  "quero mudar o bolo",
  "troca a coxinha por risoles",
  "quero mais 50 brigadeiros",
  "pode ser assim",
];
for (const f of naoRecomeca) {
  if (mandouRecomecar(f)) falhas.push("ia apagar o pedido sem o cliente ter pedido: " + f);
}

// ------------------------------------------ a saida nao passa pelo modelo
const cerebro = fs.readFileSync(path.join(raiz, "lib/ia/cerebro.ts"), "utf8");
const i = cerebro.indexOf("if (mandouRecomecar(");
if (i < 0) {
  falhas.push("o atalho de recomecar sumiu do cerebro");
} else {
  const bloco = cerebro.slice(i, i + 1200);
  if (!/montagem: \[\{ tipo: "zerar" \}\]/.test(bloco)) {
    falhas.push("recomecar parou de mandar zerar a montagem");
  }
  if (/gravarUso\(\)/.test(bloco)) {
    falhas.push("recomecar voltou a registrar uso de IA numa saida que nao chama modelo");
  }
}

// ------------------------------- os tres caminhos aplicam o zerar
const caminhos = [
  ["app/api/whatsapp/route.ts", "o WhatsApp de verdade"],
  ["app/api/testar-ia/route.ts", "a tela de teste do painel"],
  ["lib/ia/cerebro.ts", "a montagem em memoria do turno"],
];
for (const [arquivo, nome] of caminhos) {
  const src = fs.readFileSync(path.join(raiz, arquivo), "utf8");
  if (!/tipo === "zerar"/.test(src)) {
    falhas.push(nome + " (" + arquivo + ") nao trata o zerar: recomecar nao funciona por ali");
  }
}

console.log("Frases que recomecam: " + recomeca.length);
console.log("Frases que NAO podem apagar: " + naoRecomeca.length);
console.log("Caminhos que aplicam o zerar: " + caminhos.length);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: quem manda recomecar recomeca, e quem nao mandou nao perde o pedido.");
