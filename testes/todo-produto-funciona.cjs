// TODO PRODUTO DO CATALOGO TEM QUE FUNCIONAR DE PONTA A PONTA.
//
// Ate agora cada defeito foi achado por acaso, um produto de cada vez: a cuca
// que era por unidade, a pizza redonda cobrada como de forma, o empadao de
// frango com palmito recusado, o bolo de 3 kg impresso como tres bolos, a torta
// fria indo pra bancada do acucar. Todos eram a mesma doenca em produtos
// diferentes, e a gente so descobria quando alguem tropecava.
//
// Este teste percorre o catalogo INTEIRO e cobra de cada produto as quatro
// coisas que precisam bater entre si:
//
//   1. O motor de preco acha ele e cobra mais que zero.
//   2. A unidade do orcamento e a mesma do catalogo (kg nao vira unidade).
//   3. Ele tem uma comanda de cozinha, e nao cai numa generica.
//   4. O papel imprime a quantidade na unidade certa.
//
// Produto novo no cardapio ja nasce coberto: se faltar qualquer uma das quatro,
// este teste quebra antes de chegar no cliente.
//
// Roda com: node testes/todo-produto-funciona.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const pasta = mkdtempSync(join(tmpdir(), "tudo-"));
execFileSync(
  "npx",
  ["tsc", "lib/ia/orcamento.ts", "lib/departamentos.ts", "lib/cupom-escpos.ts", "lib/tipos.ts",
   "--outDir", pasta, "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule"],
  { stdio: "pipe", shell: true },
);
const { cotarPorItens } = require(join(pasta, "ia", "orcamento.js"));
const { deptoDe, unidadeDoItem, DEPARTAMENTOS } = require(join(pasta, "departamentos.js"));
const { montarCupons } = require(join(pasta, "cupom-escpos.js"));
const catalogo = require("../lib/ia/dados/catalogo.json");

const limpo = (t) => String(t).replace(/\x1B.|\x1D.|[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
const semAcento = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

let erros = 0;
const falhas = [];
function conferir(ok, oque) {
  if (!ok) {
    erros++;
    falhas.push(oque);
  }
  return ok;
}

// ---------------------------------------------------------------------------
// A lista de TUDO que a padaria vende, do jeito que o cliente pediria.
// ---------------------------------------------------------------------------
const tudo = [];
for (const i of catalogo.salgados.frito.itens) tudo.push({ nome: i.nome, qtd: 50, unidade: "un" });
for (const i of catalogo.salgados.assado.itens) tudo.push({ nome: i.nome, qtd: 50, unidade: "un" });
for (const i of catalogo.doces.itens) tudo.push({ nome: i.nome, qtd: 30, unidade: "un" });
for (const f of catalogo.bolos_recheados.faixas)
  for (const s of f.sabores) tudo.push({ nome: "bolo " + s, qtd: 2, unidade: "kg" });
for (const i of catalogo.bolos_caseiros.itens) tudo.push({ nome: "bolo " + i.nome, qtd: 1, unidade: "un" });
for (const p of catalogo.outros_produtos)
  tudo.push({ nome: p.nome, qtd: p.unidade === "kg" ? 2 : 3, unidade: p.unidade ?? "un" });
tudo.push({ nome: "pizza inteira", qtd: 1, unidade: "un" });
tudo.push({ nome: "pizza meia", qtd: 1, unidade: "un" });

console.log("Produtos no catálogo: " + tudo.length);
console.log("");

// ---------------------------------------------------------------------------
// 1 e 2. O motor de preço acha e cobra certo
// ---------------------------------------------------------------------------
const semPreco = [];
const unidadeTrocada = [];
// PRECO MAIOR QUE ZERO NAO PROVA NADA.
//
// Era so isto que este teste conferia, e por isso ele passou por cima do
// defeito de 21/08/2026: a cliente pediu 30 "cupcake grande recheado" (R$ 7,00),
// o motor cotou "cupcake grande" (R$ 5,00), e R$ 5,00 e maior que zero. Saiu
// R$ 150,00 no lugar de R$ 210,00 e a cozinha recebeu ordem de fazer cupcake
// SEM recheio. O produto virou OUTRO produto e o portao aplaudiu.
//
// Agora se confere IDENTIDADE e PRECO. Isso cobre a classe inteira: qualquer
// par curto/longo do cardapio ("cupcake grande" / "cupcake grande recheado",
// "cuca" / "cuca recheada") nasce protegido, e produto novo tambem.
const trocado = [];
const semAc = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const precoDoCatalogo = (nome) => (catalogo.outros_produtos.find((x) => x.nome === nome) ?? {}).preco;
for (const p of tudo) {
  const c = cotarPorItens([{ item: p.nome, qtd: p.qtd }]);
  const linha = c.linhas[0];
  if (!linha || !linha.subtotal || linha.subtotal <= 0) {
    semPreco.push(p.nome + (c.avisos?.length ? " (" + c.avisos[0].slice(0, 50) + ")" : ""));
    continue;
  }
  const u = linha.unidade ?? "un";
  if (u !== p.unidade) unidadeTrocada.push(`${p.nome}: catálogo diz ${p.unidade}, orçamento diz ${u}`);
  // O motor pode devolver um nome MAIS COMPLETO que o pedido — "bolo cenoura"
  // resolve pra "bolo caseiro cenoura", e isso e certo: o catalogo guarda com o
  // prefixo da familia. O que nao pode e o SABOR mudar. Por isso a conferencia
  // e por palavra: toda palavra do que foi pedido tem que estar no que foi
  // cotado. Foi assim que apareceu "bolo banana caramelizada" sendo cotado como
  // "bolo caseiro LARANJA caramelizada" — o cliente pede banana e a cozinha
  // recebe laranja.
  const VAZIAS = new Set(["bolo", "de", "do", "da", "com", "e", "caseiro"]);
  const pedidas = semAc(p.nome).split(/\s+/).filter((w) => w.length > 2 && !VAZIAS.has(w));
  const cotadas = semAc(linha.item);
  const faltando = pedidas.filter((w) => !cotadas.includes(w));
  if (faltando.length) {
    trocado.push(`${p.nome} -> o motor cotou "${linha.item}" (R$ ${linha.unit}), perdeu: ${faltando.join(", ")}`);
  } else if (semAc(linha.item) === semAc(p.nome)) {
    const esperado = precoDoCatalogo(p.nome);
    if (esperado != null && Math.abs(Number(linha.unit) - Number(esperado)) > 0.001) {
      trocado.push(`${p.nome}: catálogo R$ ${esperado}, motor R$ ${linha.unit}`);
    }
  }
}
conferir(semPreco.length === 0, "produto sem preço no motor: " + semPreco.join(" | "));
conferir(unidadeTrocada.length === 0, "unidade divergente: " + unidadeTrocada.join(" | "));
conferir(trocado.length === 0, "o produto virou OUTRO produto no motor: " + trocado.join(" | "));
console.log((trocado.length ? "ERRO  " : "ok    ") + "nenhum produto vira outro produto no motor de preço");
console.log((semPreco.length ? "ERRO  " : "ok    ") + "todo produto tem preço no motor de orçamento");
console.log((unidadeTrocada.length ? "ERRO  " : "ok    ") + "a unidade do orçamento bate com a do catálogo");

// ---------------------------------------------------------------------------
// 3. Toda comanda existe e é a certa
// ---------------------------------------------------------------------------
const semComanda = [];
for (const p of tudo) {
  const cat =
    catalogo.outros_produtos.find((x) => x.nome === p.nome)?.categoria ??
    (p.unidade === "kg" ? "por_quilo" : "por_unidade");
  const d = deptoDe({ produto: p.nome, categoria: cat });
  if (!DEPARTAMENTOS.some((x) => x.id === d)) semComanda.push(p.nome);
}
conferir(semComanda.length === 0, "produto sem comanda: " + semComanda.join(" | "));
console.log((semComanda.length ? "ERRO  " : "ok    ") + "todo produto cai numa comanda de verdade");

// ---------------------------------------------------------------------------
// 4. O papel imprime na unidade certa
// ---------------------------------------------------------------------------
const papelErrado = [];
for (const p of tudo) {
  const cat =
    catalogo.outros_produtos.find((x) => x.nome === p.nome)?.categoria ??
    (p.unidade === "kg" ? "por_quilo" : "por_unidade");
  // Unidade vazia de proposito: e o caso do pedido corrigido na mao, que ja
  // fez 3 kg de bolo virarem tres bolos na bancada.
  const u = unidadeDoItem({ produto: p.nome, categoria: cat, qtd: p.qtd, unidade: null });
  if (u !== p.unidade) papelErrado.push(`${p.nome}: deveria sair em ${p.unidade} e sai em ${u}`);
}
conferir(papelErrado.length === 0, "unidade errada no papel: " + papelErrado.join(" | "));
console.log((papelErrado.length ? "ERRO  " : "ok    ") + "o papel imprime peso como peso e peça como peça");

// ---------------------------------------------------------------------------
// 5. O PEDIDO QUE PEDE DE TUDO.
//
// Um cliente pedindo uma coisa de cada familia: e o teste de que as comandas
// nao se atropelam quando o pedido e grande de verdade.
// ---------------------------------------------------------------------------
console.log("");
console.log("== o cliente que pede de tudo ==");
const deTudo = [
  { produto: "coxinha", categoria: "salgado_frito", qtd: 100, obs: null, unidade: "un", unitCentavos: 100, subtotalCentavos: 10000 },
  { produto: "esfirra", categoria: "salgado_assado", qtd: 50, obs: "calabresa", unidade: "un", unitCentavos: 125, subtotalCentavos: 6250 },
  { produto: "brigadeiro", categoria: "docinho", qtd: 50, obs: "forminha dourada", unidade: "un", unitCentavos: 125, subtotalCentavos: 6250 },
  { produto: "bolo laka", categoria: "bolo_festa", qtd: 3, obs: "pao de lo branco, topo tema princesa", unidade: "kg", unitCentavos: 4890, subtotalCentavos: 14670 },
  { produto: "bolo cenoura", categoria: "bolo_caseiro", qtd: 1, obs: null, unidade: "un", unitCentavos: 3090, subtotalCentavos: 3090 },
  { produto: "bolo salgado", categoria: "bolo_salgado", qtd: 2, obs: "frango", unidade: "kg", unitCentavos: 2990, subtotalCentavos: 5980 },
  { produto: "torta fria", categoria: "torta_fria", qtd: 2, obs: "frango", unidade: "kg", unitCentavos: 3690, subtotalCentavos: 7380 },
  { produto: "torta doce", categoria: "torta_recheada", qtd: 1, obs: "limao", unidade: "kg", unitCentavos: 3390, subtotalCentavos: 3390 },
  { produto: "empadao", categoria: "empadao", qtd: 2, obs: "frango com legumes", unidade: "kg", unitCentavos: 3490, subtotalCentavos: 6980 },
  { produto: "pizza inteira", categoria: "pizza", qtd: 1, obs: "calabresa", unidade: "un", unitCentavos: 12000, subtotalCentavos: 12000 },
  { produto: "calzone", categoria: "calzone", qtd: 1, obs: "bacon", unidade: "kg", unitCentavos: 4190, subtotalCentavos: 4190 },
  { produto: "cupcake pequeno", categoria: "cupcake", qtd: 20, obs: "brigadeiro", unidade: "un", unitCentavos: 200, subtotalCentavos: 4000 },
  { produto: "franciscano", categoria: "franciscano", qtd: 5, obs: "calabresa", unidade: "un", unitCentavos: 1200, subtotalCentavos: 6000 },
  { produto: "cuca recheada", categoria: "padaria", qtd: 2, obs: "chocolate", unidade: "kg", unitCentavos: 2690, subtotalCentavos: 5380 },
];
const pedido = {
  id: "aaaabbbb-0000-0000-0000-000000000000",
  clienteNome: "Fernanda Klein",
  clienteTelefone: "5549999887766",
  retiradaData: "2026-12-12",
  retiradaHora: "15:00",
  pessoas: 30,
  totalCentavos: deTudo.reduce((s, i) => s + i.subtotalCentavos, 0),
  formaPagamento: "cartao",
  observacoes: null,
  itens: deTudo,
};

const cupons = montarCupons(pedido);
const comandas = cupons.map((c) => limpo(c).split("\n")[0].trim()).filter(Boolean);
console.log("Papéis gerados: " + cupons.length);
for (const c of comandas) console.log("   " + c);

// Toda familia pedida tem que ter virado comanda, e o caixa fecha a conta.
const esperadas = ["SALGADOS", "DOCINHOS", "BOLO FESTA", "BOLO CASEIRO", "BOLO SALGADO", "TORTA FRIA", "TORTA DOCE", "EMPADAO", "PIZZA", "CALZONE", "CUPCAKE", "FRANCISCANO", "PAES E CUCAS", "CAIXA"];
const juntas = semAcento(comandas.join(" | "));
const faltando = esperadas.filter((e) => !juntas.includes(semAcento(e)));
conferir(faltando.length === 0, "comanda que não saiu: " + faltando.join(", "));
console.log("");
console.log((faltando.length ? "ERRO  " : "ok    ") + "cada família virou a sua comanda");

// Nenhum item pode ficar de fora do caixa: e o papel que fecha o valor.
const caixa = limpo(cupons[cupons.length - 1]);
const forasDoCaixa = deTudo.filter((i) => !semAcento(caixa).includes(semAcento(i.produto)));
conferir(forasDoCaixa.length === 0, "item fora do caixa: " + forasDoCaixa.map((i) => i.produto).join(", "));
console.log((forasDoCaixa.length ? "ERRO  " : "ok    ") + "todos os " + deTudo.length + " itens aparecem no caixa");

// Cada item so pode aparecer na comanda DELE (fora a via do caixa).
const vazando = [];
for (const i of deTudo) {
  const dele = deptoDe(i);
  for (let n = 0; n < cupons.length - 1; n++) {
    const texto = limpo(cupons[n]);
    const lista = texto.split("-".repeat(48))[0];
    const titulo = texto.split("\n")[0];
    const ehDele = semAcento(titulo).includes(semAcento(DEPARTAMENTOS.find((d) => d.id === dele).nome));
    // Olha so as LINHAS DE ITEM (as que comecam com a quantidade), nunca a
    // observacao: "brigadeiro" aparece na comanda do cupcake porque e o SABOR
    // do cupcake, e isso esta certo. Procurar a palavra solta acusava vazamento
    // onde nao tinha.
    const linhasDeItem = lista.split(String.fromCharCode(10)).filter((l) => !l.trim().startsWith(">"));
    const ehItemDaqui = linhasDeItem.some((l) => semAcento(l).includes(semAcento(i.produto)));
    if (!ehDele && ehItemDaqui) {
      vazando.push(`${i.produto} apareceu em ${titulo.trim()}`);
    }
  }
}
conferir(vazando.length === 0, "item vazou pra comanda errada: " + vazando.join(" | "));
console.log((vazando.length ? "ERRO  " : "ok    ") + "nenhum item vaza pra comanda de outra bancada");

// O total do caixa tem que bater com a soma dos itens.
const soma = deTudo.reduce((s, i) => s + i.subtotalCentavos, 0);
const esperado = "TOTAL: R$ " + (soma / 100).toFixed(2).replace(".", ",");
conferir(caixa.includes(esperado), "total do caixa deveria ser " + esperado);
console.log((caixa.includes(esperado) ? "ok    " : "ERRO  ") + "o total do caixa bate com a soma dos itens (" + esperado + ")");

console.log("");
if (erros) {
  console.log(erros + " FALHA(S):");
  for (const f of falhas) console.log("  - " + f);
} else {
  console.log("TODOS OS PRODUTOS DO CATALOGO FUNCIONAM DE PONTA A PONTA");
}
process.exit(erros === 0 ? 0 : 1);
