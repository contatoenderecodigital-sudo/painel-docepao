// TEMA DO TOPO NAO E SABOR, MAS A PALAVRA "BOLO" NAO E TEMA.
//
// Teste ao vivo de 20/08/2026, com o dono olhando a tela de atendimento:
//
//   cliente: de bombom, 3 kg. e queria um topo de bolo tema homem aranha
//   Dora:    anotar_item("bolo bombom", 3 kg)   -> RECUSADO pela guarda
//   Dora:    anotar_item("topo de bolo", tema)  -> RECUSADO pela mesma guarda
//   Dora ao cliente: "Anotei o bolo de bombom com 3 kg e o topo"
//
// Pedido VAZIO no banco com o cliente ouvindo "anotei". E o pior defeito que
// existe aqui: ninguem percebe ate a hora da retirada.
//
// A guarda existe por um motivo bom: quem pede topo de unicornio nao pediu
// bolo de unicornio, e responder "a gente nao faz bolo de unicornio" derruba a
// venda por engano. So que ela capturava "bolo tema homem aranha" e comparava a
// PRIMEIRA PALAVRA ("bolo") com o nome do produto. Como todo bolo do cardapio
// comeca com "bolo", ela recusava qualquer bolo de qualquer cliente que
// dissesse "topo de bolo", e recusava o proprio topo junto.
//
// Roda com: node testes/tema-do-topo-nao-trava-o-bolo.cjs
const { temaDoTopoNaFala, temaViroouSabor } = require("./_guardas.cjs")();
const catalogo = require("../lib/ia/dados/catalogo.json");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

const FALA_REAL = "de bombom, 3 kg. e queria um topo de bolo tema homem aranha";

console.log("== o caso real ==");
conferir(
  temaDoTopoNaFala(FALA_REAL) === "homem aranha",
  'o tema e "homem aranha", nao "bolo tema homem aranha"',
  JSON.stringify(temaDoTopoNaFala(FALA_REAL)),
);
conferir(!temaViroouSabor("bolo bombom", FALA_REAL, null), "o bolo de bombom E anotado", "recusado de novo");
conferir(!temaViroouSabor("topo de bolo", FALA_REAL, "tema homem aranha"), "o topo E anotado", "recusado de novo");

console.log("");
console.log("== NENHUM bolo do cardapio pode ser travado por causa do topo ==");
// A varredura que faltava: quem diz "topo de bolo" nao pode perder o bolo.
const bolos = [];
for (const f of catalogo.bolos_recheados?.faixas ?? []) for (const s of f.sabores ?? []) bolos.push("bolo " + s);
for (const i of catalogo.bolos_caseiros?.itens ?? []) bolos.push("bolo " + i.nome);
const travados = [];
for (const fala of [
  "quero um topo de bolo tema homem aranha",
  "queria um topo de bolo",
  "com topo de bolo tema princesa",
  "topo de bolo e papel de arroz, tema Toy Story",
  "tema frozen no topo",
]) {
  for (const b of bolos) if (temaViroouSabor(b, fala, null)) travados.push(b + "  <-  " + fala);
}
conferir(
  travados.length === 0,
  "os " + bolos.length + " bolos do cardapio passam com o cliente falando de topo",
  travados.slice(0, 4).join(" | "),
);

console.log("");
console.log("== e o acessorio nunca e recusado ==");
for (const fala of ["topo de bolo tema homem aranha", "quero papel de arroz do homem aranha", "topo tema princesa"]) {
  for (const acessorio of ["topo de bolo", "papel de arroz"]) {
    conferir(
      !temaViroouSabor(acessorio, fala, null),
      '"' + acessorio + '" passa com "' + fala.slice(0, 34) + '"',
      "o proprio item do tema foi recusado",
    );
  }
}

console.log("");
console.log("== mas o tema virando SABOR continua sendo pego ==");
// O motivo de a guarda existir. Sem isto, ela responde "a gente nao faz bolo de
// unicornio" e o cliente vai embora achando que a padaria nao serve pra festa.
for (const [produto, fala] of [
  ["bolo unicornio", "quero um topo de unicornio"],
  ["bolo homem aranha", "queria um topo tema homem aranha"],
  ["bolo frozen", "topo de frozen por favor"],
]) {
  conferir(temaViroouSabor(produto, fala, null), '"' + produto + '" e barrado', "o tema virou sabor sem ninguem ver");
}

console.log("");
console.log("== fala sem tema nenhum nao inventa tema ==");
for (const fala of ["quero um bolo de bombom de 3 kg", "boa tarde", "quanto custa o quilo do bolo?"]) {
  conferir(temaDoTopoNaFala(fala) === null, '"' + fala.slice(0, 34) + '" nao tem tema', JSON.stringify(temaDoTopoNaFala(fala)));
}

console.log("");
console.log(erros === 0 ? "O TOPO NAO TRAVA MAIS O BOLO" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
