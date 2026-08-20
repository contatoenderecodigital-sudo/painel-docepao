// NENHUMA GUARDA PODE TRAVAR A VENDA DE NENHUM PRODUTO.
//
// Este teste existe porque eu passei o dia 19 e a madrugada do 20 consertando o
// CASO em vez da CLASSE. Consertei "cuca de goiaba" e nao generalizei pra
// "pizza de forma". Consertei "forminha rosa" e nao generalizei pra
// "aniversariante Alice". Cada conserto estava certo e era estreito, entao o
// mesmo defeito voltava com outra roupa, e o cliente pagava.
//
// O estrago medido, achado pelo rastro:
//   - TODA venda de pizza bloqueada: a Dora chamou anotar_item com o produto e
//     os sabores certos OITO vezes e a guarda recusou as oito, porque o cliente
//     escreve "de forma" e o catalogo diz "pizza inteira"
//   - "cuca de goiaba" recusada porque o catalogo chama "cuca recheada"
//   - "forminha rosa" recusada porque o cliente escreveu so "rosa"
//   - "aniversariante Alice 5 anos" recusada porque o codigo procurava a
//     palavra "nome"
//
// Agora e varredura: TODO produto do catalogo, com a frase do jeito que o
// cliente escreve, passando por TODAS as guardas de escrita. Produto novo no
// cardapio ja nasce coberto.
//
// Roda com: node testes/nenhuma-guarda-trava-venda.cjs
const {
  clienteProibiuAnotar,
  soPerguntouSemPedir,
  obsQueOClienteNaoDisse,
  produtoQueNinguemCitou,
  precosInventados,
} = require("./_guardas.cjs")();
const catalogo = require("../lib/ia/dados/catalogo.json");

let erros = 0;
const falhas = [];
function conferir(ok, oque) {
  if (!ok) {
    erros++;
    falhas.push(oque);
  }
}

// ---------------------------------------------------------------------------
// A lista de TUDO, com o nome do CATALOGO e o jeito que o CLIENTE escreve.
// ---------------------------------------------------------------------------
const APELIDOS = {
  "pizza inteira": ["pizza de forma", "pizza de metro", "pizza grande", "uma pizza"],
  "pizza meia": ["meia pizza"],
  "pizza redonda": ["pizza redonda"],
  "mini bolha": ["pastel frito"],
  "cuca recheada": ["cuca de goiaba", "cuca recheada"],
  "torta fria com palmito": ["torta fria de frango com palmito"],
  "empadao com palmito": ["empadao de palmito"],
};

const tudo = [];
for (const i of catalogo.salgados.frito.itens) tudo.push({ nome: i.nome, qtd: 50, un: "un" });
for (const i of catalogo.salgados.assado.itens) tudo.push({ nome: i.nome, qtd: 50, un: "un" });
for (const i of catalogo.doces.itens) tudo.push({ nome: i.nome, qtd: 30, un: "un" });
for (const f of catalogo.bolos_recheados.faixas)
  for (const s of f.sabores) tudo.push({ nome: "bolo " + s, qtd: 2, un: "kg" });
for (const i of catalogo.bolos_caseiros.itens) tudo.push({ nome: "bolo " + i.nome, qtd: 1, un: "un" });
for (const p of catalogo.outros_produtos)
  tudo.push({ nome: p.nome, qtd: p.unidade === "kg" ? 2 : 3, un: p.unidade ?? "un" });
tudo.push({ nome: "pizza inteira", qtd: 1, un: "un" });
tudo.push({ nome: "pizza meia", qtd: 1, un: "un" });

console.log("Varrendo " + tudo.length + " produtos contra todas as guardas de escrita.");
console.log("");

// ---------------------------------------------------------------------------
// 1. Pedido normal: nenhuma guarda pode recusar
// ---------------------------------------------------------------------------
console.log("== todo produto pode ser VENDIDO ==");
for (const p of tudo) {
  const comoOClienteFala = APELIDOS[p.nome] ?? [p.nome];
  for (const jeito of comoOClienteFala) {
    const fala = `quero ${p.qtd} ${p.un === "kg" ? "kg de " : ""}${jeito} pra sabado`;
    conferir(!clienteProibiuAnotar(fala), `"${fala}" travado por "nao anota nada"`);
    conferir(!soPerguntouSemPedir(fala, p.nome), `"${fala}" tratado como pergunta`);
    conferir(!produtoQueNinguemCitou(p.nome, [fala], ""), `"${jeito}" recusado como produto fantasma`);
  }
}
console.log((falhas.length ? "ERRO  " : "ok    ") + "os " + tudo.length + " produtos passam pelas tres guardas");

// ---------------------------------------------------------------------------
// 2. Todo SABOR do catalogo pode ser escolhido
// ---------------------------------------------------------------------------
console.log("");
console.log("== todo sabor pode ser ESCOLHIDO ==");
const antesSabor = falhas.length;
const comSabores = [];
for (const i of catalogo.salgados.assado.itens) if (i.recheios) comSabores.push({ nome: i.nome, ops: i.recheios });
for (const i of catalogo.doces.itens) if (i.sabores) comSabores.push({ nome: i.nome, ops: i.sabores });
for (const p of catalogo.outros_produtos) if (p.sabores) comSabores.push({ nome: p.nome, ops: p.sabores });
comSabores.push({ nome: "pizza inteira", ops: catalogo.pizza.sabores_salgados });
comSabores.push({ nome: "pizza inteira", ops: catalogo.pizza.sabores_doces });

for (const p of comSabores) {
  for (const sabor of p.ops) {
    const fala = `quero ${p.nome} de ${sabor}`;
    conferir(
      obsQueOClienteNaoDisse(sabor, [fala]).length === 0,
      `sabor "${sabor}" de ${p.nome} recusado mesmo o cliente tendo falado`,
    );
  }
}
console.log((falhas.length > antesSabor ? "ERRO  " : "ok    ") + "todo sabor dito pelo cliente e aceito");

// ---------------------------------------------------------------------------
// 2b. Dizer UM sabor nao pode produzir OUTRO
// ---------------------------------------------------------------------------
//
// O rastro pegou o cliente pedindo "bacon com brocolis" e o codigo escrevendo
// "bacon com milho" no pedido. A causa: o comparador recebia cada PALAVRA da
// fala e comparava com o nome INTEIRO do sabor, e "bacon com milho" contem
// "bacon". Uma palavra casava com qualquer sabor que a contivesse.
//
// Esta secao varre TODOS os sabores de TODOS os produtos e cobra o obvio:
// pedir um sabor nao pode trazer um vizinho junto.
console.log("");
console.log("== dizer UM sabor nao traz OUTRO junto ==");
const antesViz = falhas.length;
const semAc = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// A mesma regra do cerebro depois do conserto.
function saboresQueOCodigoAcha(fala, opcoes) {
  const falaLimpa = semAc(fala);
  const palavras = falaLimpa.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const parece = (a, b) => a.includes(b) || b.includes(a);
  return opcoes.filter((o) => {
    const s = semAc(o);
    const umaPalavra = !s.includes(" ");
    if (umaPalavra && palavras.some((w) => parece(w, s))) return true;
    if (!umaPalavra && falaLimpa.includes(s)) return true;
    return false;
  });
}

for (const p of comSabores) {
  for (const sabor of p.ops) {
    const fala = `quero ${p.nome} de ${sabor}`;
    const achados = saboresQueOCodigoAcha(fala, p.ops);
    // O sabor pedido tem que estar entre os achados.
    conferir(
      achados.some((a) => semAc(a) === semAc(sabor)),
      `pedi "${sabor}" de ${p.nome} e o codigo nao achou`,
    );
    // E nao pode trazer um VIZINHO que nao esta na fala.
    const intrusos = achados.filter((a) => !semAc(fala).includes(semAc(a)));
    conferir(
      intrusos.length === 0,
      `pedi "${sabor}" de ${p.nome} e o codigo trouxe junto: ${intrusos.join(", ")}`,
    );
  }
}
console.log((falhas.length > antesViz ? "ERRO  " : "ok    ") + "nenhum sabor arrasta um vizinho");

// ---------------------------------------------------------------------------
// 3. Os ROTULOS que ELA escreve nao podem recusar item
// ---------------------------------------------------------------------------
console.log("");
console.log("== os rotulos dela nao recusam item ==");
const antesRot = falhas.length;
const FALA = ["quero 60 brigadeiros, forminha rosa", "a Alice faz 5 anos, tema princesa", "esfirra de calabresa"];
for (const obs of [
  "forminha rosa",
  "cor rosa",
  "sabor calabresa",
  "recheio de calabresa",
  "tema princesa",
  "aniversariante Alice 5 anos",
  "nome Alice, idade 5 anos",
  "cor da forminha nao definida ainda",
  "sabor a definir",
  "sem foto",
  "prato aberto",
]) {
  conferir(obsQueOClienteNaoDisse(obs, FALA).length === 0, `rotulo "${obs}" recusou o item`);
}
console.log((falhas.length > antesRot ? "ERRO  " : "ok    ") + "rotulo e enchimento nao travam o pedido");

// ---------------------------------------------------------------------------
// 4. As guardas continuam GUARDANDO
// ---------------------------------------------------------------------------
console.log("");
console.log("== e as guardas continuam guardando ==");
const antesG = falhas.length;
conferir(clienteProibiuAnotar("por favor nao anota nada, so estou pesquisando"), "deixou de travar o 'nao anota nada'");
conferir(soPerguntouSemPedir("quanto custa a torta doce?", "torta doce"), "pergunta de preco virou pedido de novo");
conferir(produtoQueNinguemCitou("leite ninho", ["quero um bolo de 4 leites"], ""), "o fantasma leite ninho voltou");
conferir(obsQueOClienteNaoDisse("porto alegre", ["quanto custa a torta salgada?"]).length > 0, "sabor inventado voltou a passar");
conferir(precosInventados("Ela custa R$ 70 o quilo").length > 0, "preco inventado voltou a passar");
console.log((falhas.length > antesG ? "ERRO  " : "ok    ") + "as cinco guardas seguem pegando o que devem");

// ---------------------------------------------------------------------------
console.log("");
if (erros) {
  console.log(erros + " FALHA(S):");
  for (const f of falhas.slice(0, 25)) console.log("  - " + f);
  if (falhas.length > 25) console.log("  ... e mais " + (falhas.length - 25));
} else {
  console.log("NENHUMA GUARDA TRAVA VENDA DE NENHUM PRODUTO");
}
process.exit(erros === 0 ? 0 : 1);
