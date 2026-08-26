// O CATALOGO PODE SER REESCRITO, MAS O PRECO NAO PODE MUDAR.
//
// POR QUE ISTO EXISTE
//
// Ate 26/08/2026 havia dezessete arquivos importando `catalogo.json` direto, e
// cada um remontava a estrutura irregular do seu jeito. A padronizacao troca
// esses leitores por uma lista unica (`lib/ia/dados/produtos.ts`).
//
// Trocar leitor de catalogo mexe em cotacao. E cotacao e o dinheiro do cliente:
// ja aconteceu de um quiche de R$ 1,25 sair cotado a R$ 120,00 e de uma mini
// bolha de carne sair vinte vezes mais cara. Esses dois defeitos passaram no
// build, passaram no deploy, e so apareceram quando alguem mediu uma conversa.
//
// Entao antes de encostar em qualquer leitor eu tirei uma FOTO: a cotacao de
// todos os produtos, um por um, do jeito que estavam. Este teste compara o
// motor de hoje contra aquela foto.
//
// A REGRA E SIMPLES: nenhum preco, nenhuma unidade e nenhum casamento de nome
// pode mudar por causa da padronizacao. Se mudar, a padronizacao esta errada,
// nao a foto.
//
// UM DEFEITO JA CONGELADO NA FOTO: `cafe` nao tem cotacao nenhuma (`null`).
// Existe como docinho de R$ 1,25 e como bolo caseiro de R$ 35,90, e o motor nao
// escolhe nenhum dos dois. Isso e um bug de verdade, anotado no O-QUE-FALTA.
// Ele esta na foto de proposito: consertar isso e uma decisao separada, feita
// de olho aberto, e nao um efeito colateral silencioso de mexer no catalogo.
//
// Roda com: node testes/o-catalogo-nao-mudou-preco.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const pasta = mkdtempSync(join(tmpdir(), "preco-"));
execFileSync(
  "npx",
  ["tsc", "lib/ia/orcamento.ts",
   "--outDir", pasta, "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule"],
  { stdio: "pipe", shell: true },
);
const { cotarPorItens } = require(join(pasta, "orcamento.js"));
const catalogo = require("../lib/ia/dados/catalogo.json");
const foto = require("./fotos/precos-antes-da-padronizacao.json");

// ---------------------------------------------------------------------------
// A MESMA LISTA QUE GEROU A FOTO.
//
// Todo produto pelo nome que o cliente escreveria. O bolo de festa leva o
// prefixo porque e ele que separa o bolo do docinho de mesmo nome: sem o
// prefixo, "brigadeiro" e o docinho de R$ 1,25 e um bolo de 2 kg sai por
// R$ 2,50.
// ---------------------------------------------------------------------------
function todosOsNomes() {
  const n = [];
  for (const i of catalogo.salgados.frito.itens) n.push(i.nome);
  for (const i of catalogo.salgados.assado.itens) n.push(i.nome);
  for (const d of catalogo.doces.itens) n.push(d.nome);
  for (const f of catalogo.bolos_recheados.faixas) for (const s of f.sabores) n.push("bolo " + s);
  for (const b of catalogo.bolos_caseiros.itens) n.push(b.nome);
  for (const o of catalogo.outros_produtos) n.push(o.nome);
  // "cafe" aparece duas vezes no catalogo (docinho e bolo caseiro). A foto e um
  // objeto, entao o nome repetido virou uma chave so. Aqui e igual.
  return [...new Set(n)];
}

/** A cotacao de uma unidade, no formato exato da foto. */
function cotarUm(nome) {
  const c = cotarPorItens([{ item: nome, qtd: 1 }]);
  const l = c.linhas && c.linhas[0];
  if (!l) return null;
  // A categoria entra na foto porque e ela que decide a comanda de cozinha.
  // Um produto que muda de categoria muda de bancada, e isso e tao grave
  // quanto mudar de preco: e o pedido que some do mural da pessoa certa.
  return { item: l.item, categoria: l.categoria, unit: l.unit, unidade: l.unidade ?? "un" };
}

const nomes = todosOsNomes();
console.log("Produtos na foto: " + Object.keys(foto).length);
console.log("Produtos no catalogo de hoje: " + nomes.length);
console.log("");

const mudaram = [];
const sumiram = [];
const nasceram = [];

for (const nome of nomes) {
  if (!(nome in foto)) {
    // Produto novo no catalogo nao e erro, mas precisa ser dito em voz alta:
    // ele entra sem rede, porque nao existe foto dele.
    nasceram.push(nome + " => " + JSON.stringify(cotarUm(nome)));
    continue;
  }
  const antes = foto[nome];
  const agora = cotarUm(nome);
  if (JSON.stringify(antes) !== JSON.stringify(agora)) {
    mudaram.push("  " + nome + "\n      antes: " + JSON.stringify(antes) + "\n      agora: " + JSON.stringify(agora));
  }
}

for (const nome of Object.keys(foto)) {
  if (!nomes.includes(nome)) sumiram.push(nome);
}

let erros = 0;

if (mudaram.length) {
  erros++;
  console.log("ERRO  " + mudaram.length + " produto(s) mudaram de cotacao:");
  console.log(mudaram.join("\n"));
  console.log("");
} else {
  console.log("ok    nenhum produto mudou de preco, unidade ou casamento de nome");
}

if (sumiram.length) {
  erros++;
  console.log("ERRO  " + sumiram.length + " produto(s) sumiram do catalogo: " + sumiram.join(" | "));
} else {
  console.log("ok    nenhum produto sumiu do catalogo");
}

if (nasceram.length) {
  // Aviso, nao erro: acrescentar produto e trabalho legitimo. O que nao pode e
  // acontecer sem ninguem ver.
  console.log("");
  console.log("aviso " + nasceram.length + " produto(s) novos, sem foto anterior:");
  for (const x of nasceram) console.log("        " + x);
  console.log("        Se forem esperados, tire a foto de novo com:");
  console.log("        node testes/o-catalogo-nao-mudou-preco.cjs --tirar-foto");
}

// ---------------------------------------------------------------------------
// TIRAR A FOTO DE NOVO.
//
// So com a flag, e so depois de olhar o que mudou. Rodar isto por reflexo,
// para "consertar" o teste vermelho, e apagar a unica prova de que o preco
// estava certo antes.
// ---------------------------------------------------------------------------
if (process.argv.includes("--tirar-foto")) {
  const nova = {};
  for (const nome of nomes) nova[nome] = cotarUm(nome);
  require("node:fs").writeFileSync(
    join(__dirname, "fotos", "precos-antes-da-padronizacao.json"),
    JSON.stringify(nova, null, 1) + "\n",
  );
  console.log("");
  console.log("foto refeita com " + Object.keys(nova).length + " produtos.");
  process.exit(0);
}

console.log("");
process.exit(erros ? 1 : 0);
