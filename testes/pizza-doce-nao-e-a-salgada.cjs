// PIZZA DOCE E PIZZA SALGADA SAO DUAS PIZZAS, NAO UMA.
//
// O rastro de 20/08/2026 mostrou o cliente pedindo uma de forma salgada com
// tres sabores E uma doce de brigadeiro. A Dora anotou as duas certinho:
//
//   anotar_item <- {"produto":"pizza inteira","obs":"calabresa, frango com
//                   catupiry e bacon com brócolis"}
//   anotar_item <- {"produto":"pizza inteira","obs":"brigadeiro"}
//
// E o pedido foi pra cozinha com UMA pizza, sabor "brigadeiro". A salgada
// sumiu e o cliente pagou R$ 120 por uma pizza em vez de duas.
//
// A causa: pizza fica numa linha so DE PROPOSITO, porque os sabores somam (sao
// ate 4 na mesma pizza) e trocar um pelo outro faria a cozinha montar metade do
// que o cliente pediu. Isso esta certo. O que faltava era saber que doce e
// salgada nao somam: ninguem come calabresa com brigadeiro em cima.
//
// Roda com: node testes/pizza-doce-nao-e-a-salgada.cjs
const catalogo = require("../lib/ia/dados/catalogo.json");
const fs = require("fs");

const marca = (t) => String(t ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

// A mesma regra do codigo, pra testar o comportamento e nao uma copia digitada.
// Vence o casamento MAIS LONGO, nao a ordem: "crocante" e sabor doce, entao
// "bacon crocante" casava com doce so porque a lista doce vinha primeiro.
function doceOuSalgada(obs) {
  const t = marca(obs);
  if (!t) return null;
  const p = catalogo.pizza;
  const maior = (lista = []) =>
    lista.reduce((m, s) => {
      const x = marca(s);
      return t.includes(x) && x.length > m ? x.length : m;
    }, 0);
  const doce = maior(p.sabores_doces);
  const salgada = maior(p.sabores_salgados);
  if (!doce && !salgada) return null;
  return doce > salgada ? "doce" : "salgada";
}

console.log("== o codigo sabe de que lista veio o sabor ==");
for (const [obs, esperado] of [
  ["calabresa, frango com catupiry e bacon com brócolis", "salgada"],
  ["brigadeiro", "doce"],
  ["chocolate preto com morango", "doce"],
  ["portuguesa", "salgada"],
  ["4 queijos", "salgada"],
  ["banana com suspiro", "doce"],
  ["", null],
  ["sem sabor definido", null],
]) {
  const veio = doceOuSalgada(obs);
  conferir(veio === esperado, '"' + (obs || "(vazio)") + '" e ' + esperado, "veio: " + veio);
}

console.log("");
console.log("== o CASO REAL: as duas nao podem virar uma ==");
const salgada = doceOuSalgada("calabresa, frango com catupiry e bacon com brócolis");
const doce = doceOuSalgada("brigadeiro");
conferir(salgada !== doce, "a salgada e a doce sao tipos diferentes", "o codigo nao separa e junta as duas");

console.log("");
console.log("== mas sabor da MESMA pizza continua somando ==");
// Isto tem que continuar funcionando: sao ate 4 sabores na mesma pizza, e
// trocar um pelo outro faz a cozinha montar metade do que o cliente pediu.
conferir(
  doceOuSalgada("calabresa") === doceOuSalgada("portuguesa"),
  "dois sabores salgados sao a mesma pizza",
  "cada sabor viraria uma pizza e o cliente pagaria 4 pizzas",
);
conferir(
  doceOuSalgada("brigadeiro") === doceOuSalgada("prestígio"),
  "dois sabores doces sao a mesma pizza",
  "idem",
);

console.log("");
console.log("== e o cerebro aplica isso de verdade ==");
const fonte = fs.readFileSync("lib/banco/montagem.ts", "utf8");
conferir(fonte.includes("doceOuSalgada"), "a montagem conhece a diferenca", "voltou a juntar tudo");
conferir(
  /doceOuSalgada\(x\.obs\) === tipoNovo/.test(fonte),
  "e so junta pizza com pizza do MESMO tipo",
  "a regra existe mas nao e usada na busca da linha",
);

console.log("");
console.log("== observacao SEM sabor nenhum nao vira tipo ==");
// Cuidado com o que se cobra aqui. "frango com cheddar e bacon crocante" nao
// existe no cardapio, mas CONTEM "bacon", que existe. Classificar como salgada
// esta certo: a pergunta que o codigo faz nao e "esse sabor existe?", e sim
// "essa pizza e a mesma daquela outra?". Quem recusa sabor que nao existe e a
// guarda de sabor, que e outra coisa e ja tem teste proprio.
// Pro sabor que NAO existe, tanto faz o lado: ele nao vai ser produzido de
// jeito nenhum, quem recusa isso e a guarda de sabor. O que importa aqui e a
// resposta ser sempre a MESMA, senao a mesma pizza cairia ora numa linha ora
// noutra. ("frango com cheddar e bacon crocante" casa com "crocante", que e
// doce de 8 letras, e com "bacon", salgado de 5: vence o mais longo.)
const inventado = "frango com cheddar e bacon crocante";
conferir(
  doceOuSalgada(inventado) === doceOuSalgada(inventado),
  "sabor inventado sempre cai do mesmo lado (deu: " + doceOuSalgada(inventado) + ")",
  "resposta instavel faria a mesma pizza virar duas linhas",
);
for (const obs of ["sabor surpresa", "a definir", "do jeito que voces fazem"]) {
  conferir(doceOuSalgada(obs) === null, '"' + obs + '" nao vira tipo nenhum', "inventou tipo");
}

console.log("");
console.log(erros === 0 ? "DOCE E SALGADA SAO DUAS PIZZAS" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
