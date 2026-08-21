// UMA PALAVRA DITA SOBRE UM ITEM NAO PODE VIRAR O RECHEIO DE TODOS.
//
// Teste ao vivo de 21/08/2026, secretaria com pressa:
//
//   Dora:    Qual o sabor da esfirra: carne, frango, calabresa, brocolis ou bacon?
//   cliente: carne mesmo. e os outros voce escolhe tambem, confio
//
// O pedido foi pro banco assim:
//
//   40 esfirra (carne) | 40 empadinha (carne) | 40 pastel assado (carne)
//   40 quiche (vazio)  | 40 croissant (carne)
//
// A cliente falou de UM item. A cozinha faria a bandeja inteira de carne. O
// quiche escapou por acidente: carne nao e opcao dele.
//
// A causa: quando um item esta sem sabor, o codigo procura na fala do cliente
// um sabor valido pra aquele produto e preenche. Como o cardapio compartilha
// recheio entre produtos, uma palavra servia pra varios ao mesmo tempo.
//
// Esta varredura e o que eu tinha prometido e nao tinha feito: em vez de
// consertar a esfirra, cobrar de TODOS os produtos com sabor do cardapio.
// Produto novo com recheio ja nasce coberto.
//
// Roda com: node testes/sabor-nao-vaza-entre-itens.cjs
const { elaPerguntouDesteItem } = require("./_guardas.cjs")();
const catalogo = require("../lib/ia/dados/catalogo.json");

let erros = 0;
const falhas = [];
function conferir(ok, oque) {
  if (!ok) { erros++; falhas.push(oque); }
}

// Todo produto do cardapio que tem sabor ou recheio.
const comSabor = [];
for (const i of catalogo.salgados?.assado?.itens ?? []) if (i.recheios) comSabor.push({ nome: i.nome, ops: i.recheios });
for (const i of catalogo.salgados?.frito?.itens ?? []) if (i.recheios) comSabor.push({ nome: i.nome, ops: i.recheios });
for (const i of catalogo.doces?.itens ?? []) if (i.sabores) comSabor.push({ nome: i.nome, ops: i.sabores });
for (const p of catalogo.outros_produtos ?? []) if (p.sabores) comSabor.push({ nome: p.nome, ops: p.sabores });

console.log("Varrendo " + comSabor.length + " produtos com sabor no cardapio.");

// Quantos produtos dividem cada sabor: e o tamanho do estrago quando vaza.
const donos = {};
for (const p of comSabor) for (const o of p.ops) (donos[o] ??= []).push(p.nome);
const divididos = Object.entries(donos).filter(([, ps]) => ps.length > 1);
console.log(divididos.length + " sabores aparecem em mais de um produto. Ex: " +
  divididos.slice(0, 3).map(([s, ps]) => s + " em " + ps.length).join(", "));
console.log("");

console.log("== a resposta pertence a pergunta que foi feita ==");
for (const [sabor, produtos] of divididos) {
  const alvo = produtos[0];
  const pergunta = "Qual o sabor da " + alvo + ": " + (donos[sabor] ? sabor : "") + "?";
  conferir(elaPerguntouDesteItem(alvo, pergunta), `"${alvo}" nao se reconheceu na propria pergunta`);
  for (const outro of produtos.slice(1)) {
    conferir(
      !elaPerguntouDesteItem(outro, pergunta),
      `o sabor "${sabor}" perguntado pra "${alvo}" vazaria pra "${outro}"`,
    );
  }
}
console.log((erros ? "ERRO  " : "ok    ") + "nenhum sabor vaza entre os " + comSabor.length + " produtos");

console.log("");
console.log("== o caso real, item por item ==");
const antes = falhas.length;
const perguntaReal = "Qual o sabor da esfirra: carne, frango, calabresa, brócolis ou bacon?";
conferir(elaPerguntouDesteItem("esfirra", perguntaReal), "a esfirra devia receber o carne");
for (const outro of ["empadinha", "pastel assado", "croissant", "mini bolha", "risólis"]) {
  conferir(!elaPerguntouDesteItem(outro, perguntaReal), `"${outro}" recebeu carne sem ninguem ter pedido`);
}
console.log((falhas.length > antes ? "ERRO  " : "ok    ") + "so a esfirra recebe a resposta da pergunta da esfirra");

console.log("");
console.log("== o plural da pergunta continua valendo ==");
const antesP = falhas.length;
conferir(elaPerguntouDesteItem("esfirra", "Qual o sabor das esfirras?"), "plural nao casou");
conferir(elaPerguntouDesteItem("coxinha", "e as coxinhas, de que sabor?"), "plural nao casou");
console.log((falhas.length > antesP ? "ERRO  " : "ok    ") + "singular e plural sao o mesmo item");

console.log("");
console.log("== sem pergunta dela, palavra solta nao vale pra ninguem ==");
const antesS = falhas.length;
for (const p of comSabor.slice(0, 8)) {
  conferir(!elaPerguntouDesteItem(p.nome, ""), `"${p.nome}" aceitou sabor sem ela ter perguntado`);
  conferir(!elaPerguntouDesteItem(p.nome, "Anotei tudo certinho, mais alguma coisa?"), `"${p.nome}" aceitou de uma frase que nao cita ele`);
}
console.log((falhas.length > antesS ? "ERRO  " : "ok    ") + "sem pergunta, sem preenchimento");

console.log("");
if (erros) {
  console.log(erros + " FALHA(S):");
  for (const f of falhas.slice(0, 15)) console.log("  - " + f);
} else {
  console.log("SABOR NAO VAZA ENTRE ITENS");
}
process.exit(erros === 0 ? 0 : 1);
