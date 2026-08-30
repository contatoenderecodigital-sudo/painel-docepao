// NADA PODE DIVERGIR: CATALOGO, IA E COMANDA FALANDO A MESMA COISA.
//
// Todo erro caro deste projeto foi a mesma doenca: o mesmo fato escrito em dois
// lugares, e um deles ficando pra tras.
//
//   - o prompt dizia chodo "de calabresa"; o catalogo dizia presunto e queijo.
//     A IA oferecia e o proprio codigo recusava depois.
//   - o prompt oferecia bolo salgado de calabresa; a casa faz frango, presunto
//     ou legumes.
//   - a comanda da impressora tinha PIZZA separada; a tela juntava com salgados.
//   - o cupom vivia na maquina da padaria e ficou uma versao atras do painel.
//
// Nenhuma dessas aparecia em teste, porque ninguem testa texto. Este teste
// existe pra quebrar quando alguem escrever um sabor que a casa nao faz, ou
// esquecer um produto do lado de fora das comandas.
//
// Roda com: node testes/nada-pode-divergir.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const pasta = mkdtempSync(join(tmpdir(), "divergir-"));
execFileSync(
  "npx",
  ["tsc", "lib/ia/dados/produtos.ts", "lib/ia/fluxo/produto.ts", "lib/ia/fluxo/leitor-da-frase.ts",
   "lib/ia/fluxo/leitura.ts", "lib/ia/fluxo/sabor.ts", "lib/departamentos.ts", "lib/tipos.ts",
   "--outDir", pasta, "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule"],
  { stdio: "pipe", shell: true },
);
const { produtosDaCasa } = require(join(pasta, "ia", "dados", "produtos.js"));
const { identificarProduto } = require(join(pasta, "ia", "fluxo", "produto.js"));
const { produtosNaFrase } = require(join(pasta, "ia", "fluxo", "leitor-da-frase.js"));
const { vocabularioDaEtapa } = require(join(pasta, "ia", "fluxo", "leitura.js"));
const { coresDoCardapio } = require(join(pasta, "ia", "fluxo", "sabor.js"));
const { deptoDe, DEPARTAMENTOS, nomeNoTicket } = require(join(pasta, "departamentos.js"));
const catalogo = require("../lib/ia/dados/catalogo.json");

let erros = 0;
function conferir(ok, oque) {
  console.log((ok ? "ok    " : "ERRO  ") + oque);
  if (!ok) erros++;
}

const semAcento = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------------------------------------------------------------------------
// 1. A IA SO OFERECE O QUE EXISTE, E ENTENDE COMO A REGIAO FALA.
//
// ESTA SECAO MUDOU DE ALVO EM 28/08/2026, E O MOTIVO IMPORTA.
//
// Ela lia o TEXTO do system prompt em `persona.ts` e procurava frase proibida
// dentro dele ("chodó é o de calabresa"). Esse prompt era do cerebro antigo,
// apagado em 26/08/2026, e a funcao que o montava ficou 170 linhas sem chamador
// nenhum. O teste seguiu verde cobrando um texto que ninguem mais lia.
//
// Teste que cobra codigo morto e pior que teste nenhum: ele da a sensacao de
// que a regra esta protegida.
//
// As tres coisas que ele protegia continuam valendo, e agora sao cobradas de
// quem faz o trabalho hoje:
//
//   o sabor inventado   ->  o catalogo e a unica fonte de sabor, e quem le e
//                           `saborQueFalta`; o prompt da etapa mostra a lista
//                           que sai de `vocabularioDaEtapa`
//   "pizza de metro"    ->  `identificarProduto` e o leitor da frase, pela
//                           lista de apelidos da casa
//   as cores            ->  `coresDoCardapio`, que le o catalogo
console.log("== a IA so oferece o que existe ==");

// O apelido da regiao tem que chegar no produto certo: quem pede "duas pizzas
// de metro" esta pedindo a de forma, e sem isso a Dora trata como produto que
// nao existe.
conferir(
  identificarProduto("pizza de metro").produto === "pizza inteira",
  "a Dora entende 'pizza de metro', que e como a regiao chama a de forma",
);
conferir(
  produtosNaFrase("quero uma pizza de metro").includes("pizza inteira"),
  "e entende dentro de uma frase, nao so quando vem sozinho",
);

// O vocabulario que a IA recebe em cada etapa sai do catalogo, e nao de lista
// escrita a mao. Vazio aqui quer dizer que alguem cortou a ligacao.
for (const etapa of ["salgado", "docinho", "bolo"]) {
  conferir(
    vocabularioDaEtapa(etapa).length > 5,
    "o vocabulario da etapa do " + etapa + " vem do catalogo (" +
      vocabularioDaEtapa(etapa).length + " nomes)",
  );
}

// As cores da forminha saem do catalogo, todas.
conferir(
  coresDoCardapio().length === catalogo.forminhas_docinho.cores.length,
  "todas as " + catalogo.forminhas_docinho.cores.length + " cores de forminha chegam na IA",
);

// ---------------------------------------------------------------------------
// 2. TODO PRODUTO DO CATALOGO CHEGA NA LISTA UNICA.
//
// Produto que existe na tabela de preco e nao chega na lista e produto que a IA
// nunca vai oferecer: dinheiro parado. Antes esta secao conferia isso contra o
// TEXTO do prompt; hoje confere contra `produtosDaCasa()`, que e por onde todo
// o sistema pergunta.
//
// E esta e a guarda que teria pego o defeito da pizza: o `produto.ts` montava a
// lista dele com quatro baldes escritos a mao e a chave `pizza` ficou de fora
// por meses.
// ---------------------------------------------------------------------------
console.log("");
console.log("== todo produto do catalogo chega na lista unica ==");
const naLista = new Set(produtosDaCasa().map((p) => semAcento(p.nome)));
const naListaCurto = new Set(produtosDaCasa().map((p) => semAcento(p.nomeCurto)));
const todos = [
  ...catalogo.salgados.frito.itens.map((i) => i.nome),
  ...catalogo.salgados.assado.itens.map((i) => i.nome),
  ...catalogo.doces.itens.map((i) => i.nome),
  ...catalogo.bolos_caseiros.itens.map((i) => i.nome),
  ...catalogo.outros_produtos.map((i) => i.nome),
  ...catalogo.bolos_recheados.faixas.flatMap((f) => f.sabores),
  "pizza inteira",
  "pizza meia",
];
const faltando = todos.filter((n) => {
  const x = semAcento(n);
  return !naLista.has(x) && !naListaCurto.has(x);
});
conferir(faltando.length === 0, "nenhum produto do catalogo fica de fora da lista unica" + (faltando.length ? ": " + faltando.join(", ") : ""));

// E o contrario: a lista nao pode inventar produto que o catalogo nao tem.
const nomesDoCatalogo = new Set(todos.map(semAcento));
const inventados = produtosDaCasa()
  .map((p) => semAcento(p.nomeCurto))
  .filter((n) => !nomesDoCatalogo.has(n) && !semAcento("papel de arroz").includes(n));
conferir(inventados.length === 0, "a lista unica nao inventa produto" + (inventados.length ? ": " + inventados.join(", ") : ""));

// 3. TODO PRODUTO TEM UMA COMANDA, E E A CERTA.
//
// Produto sem comanda cai numa generica e a cozinha nao acha. Foi o que
// aconteceu com o "EXTRAS" impresso de verdade na padaria.
// ---------------------------------------------------------------------------
console.log("");
console.log("== todo produto tem a comanda dele ==");
const esperado = {
  torta_fria: "torta_fria",
  empadao: "empadao",
  torta_recheada: "torta_doce",
  bolo_salgado: "bolo_salgado",
  calzone: "calzone",
  pizza: "pizza",
  cupcake: "cupcake",
  franciscano: "franciscano",
  padaria: "padaria",
  por_unidade: null, // decidido pelo nome
  por_quilo: null,
};
let semComanda = [];
let comandaErrada = [];
for (const p of catalogo.outros_produtos) {
  const deu = deptoDe({ produto: p.nome, categoria: p.categoria });
  if (!DEPARTAMENTOS.some((d) => d.id === deu)) semComanda.push(p.nome);
  const alvo = esperado[p.categoria];
  if (alvo && deu !== alvo) comandaErrada.push(`${p.nome} (${p.categoria}) foi pra ${deu}, esperado ${alvo}`);
}
conferir(semComanda.length === 0, "nenhum produto fica sem comanda" + (semComanda.length ? ": " + semComanda.join(", ") : ""));
conferir(comandaErrada.length === 0, "nenhum produto vai pra comanda errada" + (comandaErrada.length ? ": " + comandaErrada.join("; ") : ""));

// Salgado e docinho, que sao o grosso do movimento.
for (const i of catalogo.salgados.frito.itens) {
  const deu = deptoDe({ produto: i.nome, categoria: "salgado_frito" });
  if (deu !== "salgados") comandaErrada.push(`${i.nome} foi pra ${deu}`);
}
for (const i of catalogo.salgados.assado.itens) {
  const deu = deptoDe({ produto: i.nome, categoria: "salgado_assado" });
  if (deu !== "salgados") comandaErrada.push(`${i.nome} foi pra ${deu}`);
}
conferir(comandaErrada.length === 0, "todo salgado vai pra comanda de salgados");

const marcaErrada = [];
for (const i of catalogo.salgados.frito.itens) {
  const linha = nomeNoTicket({ produto: i.nome, categoria: "salgado_frito" });
  const jaNoNome = /(^|[^a-z0-9])frito([^a-z0-9]|$)/i.test(i.nome);
  if (jaNoNome) {
    if (/\(frito\)/i.test(linha)) marcaErrada.push(i.nome + " repetiu frito");
  } else if (!/\(frito\)/i.test(linha)) {
    marcaErrada.push(i.nome + " saiu sem frito: " + linha);
  }
}
for (const i of catalogo.salgados.assado.itens) {
  const linha = nomeNoTicket({ produto: i.nome, categoria: "salgado_assado" });
  const jaNoNome = /(^|[^a-z0-9])assado([^a-z0-9]|$)/i.test(i.nome);
  if (jaNoNome) {
    if (/\(assado\)/i.test(linha)) marcaErrada.push(i.nome + " repetiu assado");
  } else if (!/\(assado\)/i.test(linha)) {
    marcaErrada.push(i.nome + " saiu sem assado: " + linha);
  }
}
conferir(marcaErrada.length === 0, "todo salgado diz frito ou assado na linha" + (marcaErrada.length ? ": " + marcaErrada.join("; ") : ""));
conferir(
  !/\(frito\)|\(assado\)/.test(nomeNoTicket({ produto: "brigadeiro", categoria: "docinho" })),
  "docinho nao ganha marca de frito nem assado",
);
conferir(
  !/\(frito\)|\(assado\)/.test(nomeNoTicket({ produto: "pizza inteira", categoria: "pizza" })),
  "pizza nao ganha marca de frito nem assado",
);

comandaErrada = [];
for (const i of catalogo.doces.itens) {
  const deu = deptoDe({ produto: i.nome, categoria: "docinho" });
  if (deu !== "docinhos") comandaErrada.push(`${i.nome} foi pra ${deu}`);
}
conferir(comandaErrada.length === 0, "todo docinho vai pra comanda de docinhos");

// ---------------------------------------------------------------------------
// 4. QUEM E POR QUILO NO CATALOGO E POR QUILO NO PAPEL.
//
// O bolo de 3 kg ja saiu como "3x BOLO" e a cozinha assou tres bolos.
// ---------------------------------------------------------------------------
console.log("");
console.log("== peso e peso nos dois lados ==");
const { unidadeDoTicket } = require(join(pasta, "departamentos.js"));
const unidadeErrada = [];
for (const p of catalogo.outros_produtos) {
  if (p.unidade !== "kg") continue;
  const deu = unidadeDoTicket({ produto: p.nome, categoria: p.categoria, qtd: 2, unidade: null });
  if (deu !== "kg") unidadeErrada.push(`${p.nome} (${p.categoria}) saiu como ${deu}`);
}
conferir(unidadeErrada.length === 0, "produto por quilo no catalogo sai como kg no papel" + (unidadeErrada.length ? ": " + unidadeErrada.join("; ") : ""));

console.log("");
console.log(erros === 0 ? "TODOS OS CASOS PASSARAM" : erros + " CASO(S) FALHARAM");
process.exit(erros === 0 ? 0 : 1);
