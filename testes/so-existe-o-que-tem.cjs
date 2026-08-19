// A LISTA DA IA E A LISTA DO MOTOR DE PRECO TEM QUE SER A MESMA.
//
// Na ferramenta anotar_item, `categoria` sempre foi enum e `produto` era texto
// livre. Foi por essa porta que ela anotou "docinho sem lactose", que a padaria
// nao faz, e o cliente saiu achando que ia receber. Existe precedente juridico
// pra isso: em Moffatt contra Air Canada o tribunal obrigou a empresa a honrar
// a politica que o chatbot inventou.
//
// Agora `produto` e enum. Com strict:true a API compila a lista numa gramatica
// e mascara token invalido, entao ela deixa de CONSEGUIR escrever produto
// inexistente. Isso so vale se a lista estiver CERTA: se faltar um nome, a
// decodificacao restrita obriga ela a escolher o vizinho mais parecido, calada,
// e a padaria perde a venda sem ninguem saber.
//
// Este teste cobra as duas direcoes:
//   1. Todo produto que o motor cota esta no enum (senao some venda)
//   2. Todo nome do enum e cotavel ou e generico conhecido (senao vira fantasma)
//
// Roda com: node testes/so-existe-o-que-tem.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const pasta = mkdtempSync(join(tmpdir(), "enum-"));
execFileSync(
  "npx",
  ["tsc", "lib/ia/orcamento.ts", "lib/ia/produtos.ts", "lib/tipos.ts",
   "--outDir", pasta, "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule"],
  { stdio: "pipe", shell: true },
);
const { cotarPorItens } = require(join(pasta, "ia", "orcamento.js"));
const { produtosDoCardapio, enumDeProdutos, FORA_DO_CARDAPIO } = require(join(pasta, "ia", "produtos.js"));
const catalogo = require("../lib/ia/dados/catalogo.json");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

const lista = enumDeProdutos();
console.log("Nomes no enum da IA: " + lista.length);
console.log("");

// ---------------------------------------------------------------------------
// 1. Nada que o motor cota pode faltar no enum
// ---------------------------------------------------------------------------
console.log("== todo produto do motor de preco esta no enum ==");
const doMotor = [];
for (const i of catalogo.salgados.frito.itens) doMotor.push(i.nome);
for (const i of catalogo.salgados.assado.itens) doMotor.push(i.nome);
for (const i of catalogo.doces.itens) doMotor.push(i.nome);
for (const f of catalogo.bolos_recheados.faixas) for (const s of f.sabores) doMotor.push("bolo " + s);
for (const i of catalogo.bolos_caseiros.itens) doMotor.push("bolo " + i.nome);
for (const p of catalogo.outros_produtos) doMotor.push(p.nome);
doMotor.push("pizza inteira", "pizza meia");

const faltando = doMotor.filter((n) => !lista.includes(n));
conferir(faltando.length === 0, "os " + doMotor.length + " produtos do motor estao no enum", "faltam: " + faltando.join(", "));

// ---------------------------------------------------------------------------
// 2. Nada no enum pode ser fantasma
// ---------------------------------------------------------------------------
console.log("");
console.log("== todo nome do enum vale alguma coisa ==");
// Genericos e o topo nao tem preco proprio de propriosito: o generico e aberto
// depois que o cliente escolhe o tipo, e o topo a equipe lanca na tela.
const SEM_PRECO_DE_PROPOSITO = [
  "salgado", "salgado frito", "salgado assado", "docinho", "bolo", "bolo recheado",
  "topo de bolo", FORA_DO_CARDAPIO,
];
const fantasmas = [];
for (const nome of produtosDoCardapio()) {
  if (SEM_PRECO_DE_PROPOSITO.includes(nome)) continue;
  const c = cotarPorItens([{ item: nome, qtd: 2 }]);
  const linha = c.linhas[0];
  if (!linha || !linha.subtotal || linha.subtotal <= 0) fantasmas.push(nome);
}
conferir(fantasmas.length === 0, "nenhum nome do enum e fantasma sem preco", "sem preco: " + fantasmas.join(", "));

// ---------------------------------------------------------------------------
// 3. A escapatoria tem que existir
// ---------------------------------------------------------------------------
console.log("");
console.log("== a saida honesta existe ==");
conferir(
  lista.includes(FORA_DO_CARDAPIO),
  'o enum tem a escapatoria "' + FORA_DO_CARDAPIO + '"',
  "sem ela a IA e obrigada a escolher o vizinho errado calada",
);
conferir(
  lista[lista.length - 1] === FORA_DO_CARDAPIO,
  "a escapatoria e o ultimo da lista",
  "posicao mudou, confira o gerador",
);

// ---------------------------------------------------------------------------
// 4. Limite da API: enum grande tem teto de tamanho
// ---------------------------------------------------------------------------
console.log("");
console.log("== cabe no limite da API ==");
const bytes = JSON.stringify(lista).length;
conferir(lista.length <= 500, "menos de 500 valores no enum (" + lista.length + ")", "estourou o teto da API");
conferir(bytes < 15000, "menos de 15.000 caracteres (" + bytes + ")", "estourou o teto da API");

// ---------------------------------------------------------------------------
// 5. Produto que a padaria NAO faz nao pode estar na lista
// ---------------------------------------------------------------------------
console.log("");
console.log("== o que ela inventou nao existe na lista ==");
for (const inventado of ["docinho sem lactose", "bolo vegano", "salgado sem gluten", "bolo de 3 andares"]) {
  conferir(!lista.includes(inventado), 'a lista NAO tem "' + inventado + '"', "entrou no cardapio sem a dona saber");
}

console.log("");
console.log(erros === 0 ? "A IA SO CONSEGUE PEDIR O QUE A PADARIA VENDE" : erros + " DIVERGENCIA(S)");
process.exit(erros === 0 ? 0 : 1);
