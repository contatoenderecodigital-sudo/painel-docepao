// O CATALOGO BATE COM OS CINCO PDFS OFICIAIS DA DONA.
//
// Os PDFs (Desktop/docepao/MazyOS-main/dados/tabelas de produtos) sao o cardapio
// impresso dela, de julho de 2026. Cada linha aqui foi lida da imagem do PDF e
// digitada uma vez, pra virar conferencia automatica.
//
// A regra e COPIAR o cardapio, nao editar. Ja tirei "bacon com brocolis" por
// achar que era redundante com "bacon" e "brocolis", que sao outros dois
// sabores: sabor a menos e venda que a Dora recusa dizendo que nao existe.
//
// O catalogo pode ter MAIS coisa que os PDFs, e tem: cuca, pao doce, torta,
// empadao, calzone, cupcake, franciscano, cachorro-quente, pao de X e pizza
// redonda vieram por audio, depois de julho. O que nao pode e ter MENOS.
//
// Roda com: node testes/bate-com-os-pdfs.cjs
const catalogo = require("../lib/ia/dados/catalogo.json");

const norm = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

let erros = 0;
function conferir(faltando, oque) {
  const ok = faltando.length === 0;
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : " -> falta: " + faltando.join(", ")));
  if (!ok) erros++;
}

// ---------------------------------------------------------------------------
// PDF "Salgados-1"
// ---------------------------------------------------------------------------
console.log("== PDF de salgados ==");
const fritosPdf = ["almofadinha", "bolinha de queijo", "coxinha", "chodó", "croquete", "mini pão de queijo", "mini bolha", "risólis", "salsicha frita"];
const assadosPdf = ["pastel assado", "esfirra", "empadinha", "quiche", "mini sanduíche de patê de frango", "mini x", "enroladinho de salsicha assado", "croissant", "mini pizza", "pão de batata"];
const fritos = catalogo.salgados.frito.itens.map((i) => norm(i.nome));
const assados = catalogo.salgados.assado.itens.map((i) => norm(i.nome));
conferir(fritosPdf.filter((n) => !fritos.includes(norm(n))), "os 9 fritos do PDF (R$ 1,00)");
conferir(assadosPdf.filter((n) => !assados.includes(norm(n))), "os 10 assados do PDF (R$ 1,25)");
conferir(catalogo.salgados.frito.preco === 1 ? [] : ["frito custa " + catalogo.salgados.frito.preco], "frito a R$ 1,00");
conferir(catalogo.salgados.assado.preco === 1.25 ? [] : ["assado custa " + catalogo.salgados.assado.preco], "assado a R$ 1,25");

// Os recheios impressos no PDF, item por item.
const recheiosPdf = {
  "pastel assado": ["carne", "frango", "calabresa", "bacon", "brócolis"],
  esfirra: ["carne", "frango", "calabresa", "brócolis", "bacon"],
  empadinha: ["palmito", "frango", "carne", "brócolis"],
  quiche: ["calabresa", "bacon", "frango", "brócolis"],
  croissant: ["carne", "frango", "calabresa", "bacon", "brócolis"],
  "mini pizza": ["calabresa", "filé", "bacon", "milho"],
};
const semRecheio = [];
for (const [nome, esperados] of Object.entries(recheiosPdf)) {
  const item = catalogo.salgados.assado.itens.find((i) => norm(i.nome) === norm(nome));
  const tem = (item?.recheios ?? []).map(norm);
  for (const r of esperados) if (!tem.includes(norm(r))) semRecheio.push(nome + ": " + r);
}
conferir(semRecheio, "os recheios de cada assado, como estão no PDF");

// ---------------------------------------------------------------------------
// PDF "Doces-2"
// ---------------------------------------------------------------------------
console.log("");
console.log("== PDF de doces ==");
const docesPdf = {
  brigadeiro: 1.25, beijinho: 1.25, cajuzinho: 1.25, "café": 1.25, "leite ninho": 1.25,
  "bicho de pé": 1.75, "camafeu de nozes": 1.75, "docinho de churros": 1.75,
  "leite ninho com avelã": 1.75, "olho de sogra": 1.75, "ouriço": 1.75,
};
const trufasPdf = ["morango", "uva", "cereja", "café", "nozes", "limão", "amendoim", "maracujá", "brigadeiro"];
const doces = new Map(catalogo.doces.itens.map((i) => [norm(i.nome), i.preco]));
const docesRuins = [];
for (const [nome, preco] of Object.entries(docesPdf)) {
  const p = doces.get(norm(nome));
  if (p === undefined) docesRuins.push(nome + " (não existe)");
  else if (Math.abs(p - preco) > 0.001) docesRuins.push(`${nome} R$ ${p} no sistema e R$ ${preco} no PDF`);
}
conferir(docesRuins, "os 11 docinhos do PDF, com o preço de cada");
const trufa = catalogo.doces.itens.find((i) => norm(i.nome) === "trufa");
conferir(trufa && Math.abs(trufa.preco - 2.25) < 0.001 ? [] : ["trufa não está a R$ 2,25"], "trufa a R$ 2,25");
conferir(trufasPdf.filter((s) => !(trufa?.sabores ?? []).map(norm).includes(norm(s))), "os 9 sabores de trufa");

// ---------------------------------------------------------------------------
// PDF "Bolos Recheados-1-13"
// ---------------------------------------------------------------------------
console.log("");
console.log("== PDF de bolos recheados ==");
const faixasPdf = {
  46.9: ["4 leites", "brigadeiro", "dois amores", "frutas (pêssego e abacaxi)", "laka", "mineira", "prestígio", "porto alegre", "brigadeiro com maracujá"],
  49.9: ["bombom", "biz", "morango", "marta rocha"],
  55.9: ["0% lactose", "strogonoff de nozes"],
};
const faltaBolo = [];
for (const [preco, sabores] of Object.entries(faixasPdf)) {
  const faixa = catalogo.bolos_recheados.faixas.find((f) => Math.abs(f.preco - Number(preco)) < 0.001);
  if (!faixa) {
    faltaBolo.push("faixa de R$ " + preco);
    continue;
  }
  const tem = faixa.sabores.map(norm);
  for (const s of sabores) if (!tem.includes(norm(s))) faltaBolo.push(`R$ ${preco}: ${s}`);
}
conferir(faltaBolo, "as 3 faixas de preço e os 15 sabores do PDF");

// ---------------------------------------------------------------------------
// PDF "Bolos caseiros-1"
// ---------------------------------------------------------------------------
console.log("");
console.log("== PDF de bolos caseiros ==");
const caseirosPdf = {
  aipim: 30.9, "banana caramelizada": 30.9, "café": 35.9, cenoura: 34.9,
  "chocolate preto com leite ninho": 30.9, churros: 34.9, "fubá com goiabada": 30.9,
  "floresta negra": 30.9, formigueiro: 30.9, "inglês": 33.9, "laranja caramelizada": 34.9,
  "limão": 35.9, "nega maluca": 33.9, "prestígio com ganache": 33.9, "red velvet": 33.9,
};
const caseiros = new Map(catalogo.bolos_caseiros.itens.map((i) => [norm(i.nome), i.preco]));
const caseirosRuins = [];
for (const [nome, preco] of Object.entries(caseirosPdf)) {
  const p = caseiros.get(norm(nome));
  if (p === undefined) caseirosRuins.push(nome + " (não existe)");
  else if (Math.abs(p - preco) > 0.001) caseirosRuins.push(`${nome} R$ ${p} no sistema e R$ ${preco} no PDF`);
}
conferir(caseirosRuins, "os 15 bolos caseiros do PDF, com o preço de cada");

// ---------------------------------------------------------------------------
// PDF "Pizza-3"
// ---------------------------------------------------------------------------
console.log("");
console.log("== PDF de pizza ==");
const salgadasPdf = ["bacon", "bacon com milho", "bacon com brócolis", "4 queijos", "filé ao molho madeira com fritas", "filé acebolado", "frango com catupiry", "alho e óleo", "hot dog", "moda da casa", "lombinho", "lombinho com abacaxi", "brócolis", "milho", "bolonhesa", "vegetariana", "strogonoff de frango", "strogonoff de gado", "calabresa", "calabresa acebolada", "portuguesa"];
const docesPizzaPdf = ["abacaxi com coco", "brigadeiro", "prestígio", "crocante", "califórnia", "banana", "chocolate preto com morango", "chocolate branco com morango", "chocolate com confete", "banana com suspiro"];
const sal = catalogo.pizza.sabores_salgados.map(norm);
const doc = catalogo.pizza.sabores_doces.map(norm);
conferir(salgadasPdf.filter((s) => !sal.includes(norm(s))), "os 21 sabores salgados do PDF");
conferir(docesPizzaPdf.filter((s) => !doc.includes(norm(s))), "os 10 sabores doces do PDF");
conferir(catalogo.pizza.inteira.preco === 120 ? [] : ["inteira custa " + catalogo.pizza.inteira.preco], "inteira a R$ 120,00");
conferir(catalogo.pizza.meia.preco === 60 ? [] : ["meia custa " + catalogo.pizza.meia.preco], "meia a R$ 60,00");
conferir(catalogo.pizza.inteira.sabores_ate === 4 ? [] : ["inteira aceita " + catalogo.pizza.inteira.sabores_ate], "inteira com até 4 sabores");
conferir(catalogo.pizza.meia.sabores_ate === 2 ? [] : ["meia aceita " + catalogo.pizza.meia.sabores_ate], "meia com até 2 sabores");
conferir(String(catalogo.pizza.inteira.serve) === "6,8" ? [] : ["serve " + catalogo.pizza.inteira.serve], "inteira serve 6 a 8 pessoas");

console.log("");
console.log(erros === 0 ? "O CATALOGO BATE COM OS CINCO PDFS OFICIAIS" : erros + " DIVERGENCIA(S) COM OS PDFS");
process.exit(erros === 0 ? 0 : 1);
