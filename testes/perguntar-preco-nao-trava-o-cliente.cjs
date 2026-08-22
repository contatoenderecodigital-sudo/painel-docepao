// PERGUNTAR O PRECO DE UM BOLO NAO PODE TRAVAR O CLIENTE PRA SEMPRE.
//
// Teste ao vivo de 22/08/2026. Cliente 4, o que nunca conseguiu comprar:
//
//   cliente: oi. quanto ta o cento de coxinha?
//   Dora:    O cento de coxinha sai R$ 100,00. Quantos voce quer?
//   cliente: calma ai. e o bolo de cenoura, quanto?          <- so PERGUNTOU
//   cliente: nao quero comprar ainda, so quero saber o preco
//   cliente: deixa pra la. entao me ve 50 coxinha pra domingo
//   cliente: pensando bem tira a coxinha, poe 50 bolinha de queijo
//   cliente: ah nao, muda de novo. deixa 30 bolinha e 20 croquete
//   cliente: so isso mesmo. quanto da? nome carla, dinheiro, 11h
//   Dora:    Deixa eu chamar alguem da equipe pra te ajudar com isso.
//   cliente: como assim? so quero saber o total dos salgados
//   Dora:    Deixa eu chamar alguem da equipe pra te ajudar com isso.
//   cliente: pode fechar entao. 30 bolinha, 20 croquete, domingo 11h, carla
//   Dora:    Deixa eu chamar alguem da equipe pra te ajudar com isso.
//
// A CAUSA (cerebro.ts:3064): a guarda "bolo que sumiu" testa /bolo/ contra
// `falaDoCliente`, que e a conversa INTEIRA colada (cerebro.ts:7131). A palavra
// "bolo" da pergunta do turno 2 fica no historico pra sempre; o carrinho nao
// tem bolo; entao registrar_pedido e recusado em TODAS as voltas do laco, em
// TODOS os turnos seguintes. Armadilha permanente.
//
// A valvula de escape existia mas nao era alcancavel com portugues de WhatsApp:
// exigia /(nao quero|sem|nem)[^.]{0,24}bolo/, e o cliente disse "deixa pra la"
// e "nao quero comprar ainda, so quero saber o preco".
//
// A guarda continua NECESSARIA: ela nasceu porque o bolo virava
// "brigadeiro: 1 un x R$ 1,25" (o sabor no lugar do nome do item), tres vezes.
// Entao este teste cobra as duas metades: quem PEDE bolo continua barrado,
// quem so PERGUNTA passa.
//
// Roda com: node testes/perguntar-preco-nao-trava-o-cliente.cjs
const fs = require("fs");
const caminho = require("path").join(__dirname, "..", "lib", "ia", "cerebro.ts");
const fonte = fs.readFileSync(caminho, "utf8");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

// As mesmas regras do cerebro, extraidas da fonte pra nao divergirem em silencio.
function extrair(nome, re) {
  const m = fonte.match(re);
  if (!m) {
    console.log("ERRO  nao achei " + nome + " no cerebro.ts (a guarda foi renomeada ou removida)");
    erros++;
    return null;
  }
  return m[1];
}

const fonteBolo = extrair("falaDeBolo", /const falaDeBolo = \/([^/]+)\/i;/);
const fonteDispensa = extrair("dispensouBolo", /const dispensouBolo = \/([\s\S]*?)\/i\.test\(falaDoCliente\)/);
const fonteSoPerguntou = extrair("SO_PERGUNTOU_DO_BOLO", /const SO_PERGUNTOU_DO_BOLO = \/([\s\S]*?)\/i;/);

if (erros > 0) {
  console.log("");
  console.log("O TESTE NAO CONSEGUE LER AS GUARDAS: conserte os nomes antes.");
  process.exit(1);
}

const falaDeBolo = new RegExp(fonteBolo, "i");
const dispensa = new RegExp(fonteDispensa, "i");
const soPerguntou = new RegExp(fonteSoPerguntou, "i");

// A decisao, exatamente como o cerebro faz.
function guardaBarra(conversaDoCliente, temLinhaDeBolo, obsDosItens) {
  const fala = conversaDoCliente.join("\n");
  const dispensouBolo = dispensa.test(fala);
  const frasesComBolo = fala.split(/[.!?\n]+/).filter((fr) => falaDeBolo.test(fr));
  const pediuBoloDeVerdade =
    !dispensouBolo &&
    (frasesComBolo.some((fr) => !soPerguntou.test(fr)) ||
      (obsDosItens || []).some((o) => falaDeBolo.test(String(o))));
  return !temLinhaDeBolo && pediuBoloDeVerdade;
}

console.log("== quem so PERGUNTOU o preco de bolo consegue comprar salgado ==");

const A_CONVERSA_QUE_TRAVOU = [
  "oi. quanto ta o cento de coxinha?",
  "calma ai. e o bolo de cenoura, quanto?",
  "nao quero comprar ainda, so quero saber o preco. e da torta fria tbm",
  "deixa pra la. voces fazem sushi pra festa?",
  "entao me ve 50 coxinha pra domingo",
  "pensando bem tira a coxinha, po e bolinha de queijo 50",
  "ah nao, muda de novo. deixa 30 bolinha de queijo e 20 croquete",
  "so isso mesmo. quanto da? nome carla, dinheiro, 11h",
];
conferir(
  !guardaBarra(A_CONVERSA_QUE_TRAVOU, false, []),
  "o caso medido: pergunta o preco do bolo, compra so salgado",
  "a carla continua sem conseguir fechar pedido nenhum",
);

for (const [conversa, oque] of [
  [["quanto custa o bolo de cenoura?", "quero 50 coxinha"], "quanto custa o bolo"],
  [["qual o preco do bolo de chocolate?", "me ve 100 esfirra"], "qual o preco do bolo"],
  [["voces fazem bolo de casamento?", "quero 30 brigadeiro"], "voces fazem bolo"],
  [["tem bolo de pote?", "so 20 coxinha mesmo"], "tem bolo de pote"],
  [["e o valor do bolo?", "deixa so os salgados"], "e o valor do bolo"],
]) {
  conferir(!guardaBarra(conversa, false, []), "pergunta de preco nao trava: " + JSON.stringify(conversa[0]), "travou");
}

console.log("");
console.log("== quem DISPENSOU o bolo com portugues de WhatsApp consegue fechar ==");
for (const f of [
  "nao quero bolo",
  "sem bolo",
  "nem bolo",
  "deixa pra la o bolo",
  "esquece o bolo",
  "nao quero comprar ainda, so quero saber o preco",
  "so quero saber o preco do bolo",
]) {
  conferir(
    !guardaBarra([f, "quero 50 coxinha"], false, []),
    "dispensa reconhecida: " + JSON.stringify(f),
    "a valvula de escape nao alcanca portugues normal",
  );
}

console.log("");
console.log("== quem PEDE bolo continua barrado: o defeito original nao volta ==");
for (const [conversa, obs, oque] of [
  [["quero um bolo de brigadeiro de 2,5 kg"], [], "pedido direto de bolo"],
  [["vou fazer festa, quero bolo tambem"], [], "bolo dentro da festa"],
  [["quero bolo de morango com topo do homem aranha"], [], "bolo com topo"],
  [["quero 100 coxinha"], ["pao de lo branco, tema unicornio"], "o bolo aparece so na observacao"],
  [["me ve um bolo de 3kg pra sabado"], [], "bolo por quilo"],
]) {
  conferir(
    guardaBarra(conversa, false, obs),
    "quem pede bolo e nao tem linha de bolo continua barrado: " + oque,
    "o bolo pode virar 'brigadeiro: 1 un x R$ 1,25' de novo",
  );
}

console.log("");
console.log("== com a linha de bolo no pedido, nunca barra ==");
for (const conversa of [
  ["quero um bolo de brigadeiro de 2,5 kg"],
  ["quanto custa o bolo?", "entao quero um de 2 kg"],
]) {
  conferir(!guardaBarra(conversa, true, []), "pedido COM bolo passa: " + JSON.stringify(conversa[0]), "barrou pedido correto");
}

console.log("");
console.log("== o escape de emergencia nao repete a mesma frase ==");
const TROCA = /jaAvisouDaEquipe\s*\n?\s*\?\s*"A equipe já foi avisada/;
conferir(
  TROCA.test(fonte),
  "a segunda vez que a equipe e chamada diz outra coisa",
  "o cliente pode receber a mesma frase tres vezes seguidas de novo",
);
conferir(
  /const jaAvisouDaEquipe = \/chamar algu/.test(fonte),
  "a deteccao le a ultima fala DELA",
  "sem deteccao, a troca nunca acontece",
);

console.log("");
console.log(
  erros === 0
    ? "PERGUNTAR O PRECO NAO TRAVA O CLIENTE"
    : erros + " FALHA(S): tem cliente que nao consegue comprar",
);
process.exit(erros === 0 ? 0 : 1);
