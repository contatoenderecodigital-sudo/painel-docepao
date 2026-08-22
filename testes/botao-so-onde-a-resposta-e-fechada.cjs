// BOTAO SO ONDE A RESPOSTA E FECHADA
//
// O WhatsApp aceita ate tres botoes de resposta, 20 caracteres cada (limite da
// Meta, conferido na documentacao em 23/08/2026). Quando a resposta so pode ser
// uma de tres, o cliente toca e chega um ID no sistema em vez de uma frase pra
// adivinhar.
//
// Os casos que custaram dinheiro e que o botao resolve por construcao:
//
//   "Pode ser, vou querer bolo tambem dai"  -> base de R$ 418,80 que nao virou
//                                              pedido nenhum (Sandro, 22/08)
//   "papel de arroz e topo sim"             -> o topo sumia do pedido
//
// REGRA DE OURO, e e ela que este teste protege: o botao NAO cria pergunta
// nova. Ele so da atalho pra pergunta que ela ja ia fazer. Botao em toda
// mensagem vira formulario, e formulario e o oposto do que essa IA existe pra
// ser. Por isso a lista e fechada, e por isso pergunta ABERTA ("qual sabor?",
// "que horas?") nao pode ganhar botao: ali o cliente precisa do teclado.
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..");
const { botoesDaPergunta } = require("./_guardas.cjs")();

const falhas = [];

// -------------------------------------------------- onde DEVE ter botao
const comBotao = [
  ["Pra 20 pessoas, uma base boa é 200 salgados, 100 docinhos e 2 kg de bolo. Dá R$ 418,80 no total. Pode ser assim?", "Pode ser"],
  ["O bolo vai com topo e papel de arroz?", "Os dois"],
  ["Falta só como você prefere pagar?", "Pix"],
  ["Você vai querer salgado também pra essa festa?", "Quero salgado"],
  ["Quer mais alguma coisa?", "So isso"],
];
for (const [texto, esperado] of comBotao) {
  const b = botoesDaPergunta(texto);
  if (!b.length) {
    falhas.push("pergunta fechada ficou sem botao: " + texto.slice(0, 60));
    continue;
  }
  if (!b.some((x) => x.titulo === esperado)) {
    falhas.push("botao errado em: " + texto.slice(0, 50) + " -> " + b.map((x) => x.titulo).join(", "));
  }
}

// -------------------------------------------- onde NAO pode ter botao
// Pergunta aberta: o cliente precisa escrever. E mensagem de pedido fechado:
// ali ele nao decide nada.
const semBotao = [
  "Qual o sabor do bolo?",
  "Me diz o nome de quem vai retirar e que horas?",
  "Quantos quilos de bolo você quer?",
  "*Pedido recebido*\nTotal: R$ 543,00\nJá passei pra nossa equipe.",
];
for (const texto of semBotao) {
  const b = botoesDaPergunta(texto);
  if (b.length) {
    falhas.push("botao onde a resposta e aberta: " + texto.slice(0, 45) + " -> " + b.map((x) => x.titulo).join(", "));
  }
}

// ------------------------------------------------- os limites da Meta
// Titulo maior que 20 caracteres faz a mensagem INTEIRA falhar com 400, e o
// cliente fica sem resposta nenhuma. Mais de tres botoes idem.
for (const [texto] of comBotao) {
  const b = botoesDaPergunta(texto);
  if (b.length > 3) falhas.push("mais de tres botoes em: " + texto.slice(0, 40));
  for (const x of b) {
    if (x.titulo.length > 20) falhas.push("titulo com " + x.titulo.length + " caracteres (limite 20): " + x.titulo);
    if (!x.id || !/^[a-z0-9_]+$/.test(x.id)) falhas.push("id de botao invalido: " + JSON.stringify(x.id));
  }
  const ids = b.map((x) => x.id);
  if (new Set(ids).size !== ids.length) falhas.push("dois botoes com o mesmo id em: " + texto.slice(0, 40));
}

// ------------------------------- o cliente nunca fica sem resposta
// Botao e conforto; a resposta e o pedido. Se a Meta recusar, o texto tem que
// ir puro.
const api = fs.readFileSync(path.join(raiz, "lib/whatsapp/api.ts"), "utf8");
if (!/botao recusado pela Meta, mandando texto puro/.test(api)) {
  falhas.push("o envio de botao parou de cair pra texto puro quando a Meta recusa");
}
// E a resposta do toque precisa continuar sendo entendida na volta.
const webhook = fs.readFileSync(path.join(raiz, "app/api/whatsapp/route.ts"), "utf8");
if (!/button_reply/.test(webhook)) {
  falhas.push("o webhook parou de ler a resposta do botao");
}
if (!/botoesDaPergunta/.test(webhook)) {
  falhas.push("o webhook parou de mandar botao");
}

console.log("Perguntas fechadas com botao: " + comBotao.length);
console.log("Perguntas abertas protegidas: " + semBotao.length);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: botao so onde a resposta e fechada, e o texto vai puro se a Meta recusar.");
