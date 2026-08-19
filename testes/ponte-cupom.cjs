// TESTA O CUPOM DA PONTE SEM GASTAR PAPEL.
//
// Monta os cupons de um pedido de mentira que passa por todas as armadilhas que
// ja custaram papel errado na padaria, e confere o resultado linha por linha:
//
//  - salgado, docinho e bolo no MESMO pedido tem que sair em tres vias
//  - bolo salgado e torta fria sao SALGADO, mesmo com "bolo" e "torta" no nome
//  - 3 kg de bolo e UM bolo de tres quilos, nao tres bolos
//  - a observacao (sabor, recheio, forminha) tem que estar no papel
//  - o caixa mostra a forma de pagamento
//  - pedido sem data grita SEM DATA em vez de sair em branco
//
// Roda com: node testes/ponte-cupom.cjs
const { execFileSync } = require("node:child_process");
const { writeFileSync, unlinkSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

// A ponte e um modulo ESM com efeito colateral (entra em laco ao carregar),
// entao o teste extrai as funcoes puras dela em vez de importar o arquivo.
const fonte = require("node:fs").readFileSync("ponte/ponte.mjs", "utf8");
const ini = fonte.indexOf("function semAcento(");
const fim = fonte.indexOf("// ---------------------------------------------------------------------------\n// IMPRIMIR");
if (ini < 0 || fim < 0) throw new Error("nao achei o trecho puro da ponte");

const arquivo = join(tmpdir(), "ponte-puro-" + Date.now() + ".cjs");
writeFileSync(
  arquivo,
  fonte.slice(ini, fim) +
    "\nmodule.exports = { cuponsDoPedido, estacaoDe, unidadeDe, quantidade, dinheiro };\n",
  "utf8",
);
const ponte = require(arquivo);

const pedido = {
  filaId: "teste",
  pedidoId: "abcd1234-0000-0000-0000-000000000000",
  clienteNome: "Dona Ivone",
  clienteTelefone: "5511970000006",
  retiradaData: "2026-09-12",
  retiradaHora: "16:00",
  pessoas: 25,
  totalCentavos: 52350,
  formaPagamento: "pix",
  observacoes: "buzinar na frente",
  itens: [
    { produto: "coxinha", categoria: "salgado_frito", qtd: 100, obs: null, unidade: "un", unit_centavos: 100, subtotal_centavos: 10000 },
    { produto: "esfirra", categoria: "salgado_assado", qtd: 50, obs: "calabresa", unidade: "un", unit_centavos: 125, subtotal_centavos: 6250 },
    { produto: "torta fria", categoria: "torta_fria", qtd: 2, obs: "frango com palmito", unidade: "kg", unit_centavos: 6990, subtotal_centavos: 13980 },
    { produto: "brigadeiro", categoria: "docinho", qtd: 60, obs: "forminha dourada", unidade: "un", unit_centavos: 125, subtotal_centavos: 7500 },
    { produto: "bolo laka", categoria: "bolo_festa", qtd: 3, obs: "pao de lo branco, topo tema futebol", unidade: null, unit_centavos: 4890, subtotal_centavos: 14670 },
  ],
};

const cupons = ponte.cuponsDoPedido(pedido);
const limpo = (t) => t.replace(/\x1B.|\x1D.|[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

let erros = 0;
function conferir(condicao, oque) {
  if (condicao) {
    console.log("ok    " + oque);
  } else {
    console.log("ERRO  " + oque);
    erros++;
  }
}

console.log("Cupons gerados: " + cupons.length + "\n");
conferir(cupons.length === 4, "sai uma via por estacao com item, mais o caixa (4)");

const salgados = limpo(cupons.find((c) => limpo(c).includes("SALGADOS")) || "");
const docinhos = limpo(cupons.find((c) => limpo(c).includes("DOCINHOS")) || "");
const bolos = limpo(cupons.find((c) => limpo(c).includes("BOLO FESTA")) || "");
const caixa = limpo(cupons.find((c) => limpo(c).includes("CAIXA")) || "");

conferir(salgados.includes("COXINHA"), "coxinha vai pros salgados");
conferir(salgados.includes("TORTA FRIA"), "torta fria de palmito e SALGADO, apesar do nome");
conferir(!docinhos.includes("TORTA FRIA"), "torta fria nao aparece na bancada dos docinhos");
conferir(salgados.includes("calabresa"), "o recheio da esfirra esta no papel da cozinha");
conferir(docinhos.includes("BRIGADEIRO"), "brigadeiro vai pros docinhos");
conferir(docinhos.includes("forminha dourada"), "a cor da forminha esta no papel");
conferir(bolos.includes("BOLO LAKA"), "o bolo vai pra bancada de bolo de festa");
conferir(bolos.includes("3 kg"), "3 kg de bolo sai como PESO, nao como tres bolos");
conferir(!bolos.includes("3 un"), "e nunca como 3 unidades");
conferir(bolos.includes("topo tema futebol"), "o tema do topo esta no papel do bolo");
conferir(!salgados.includes("R$"), "o papel da cozinha nao leva preco");
conferir(caixa.includes("TOTAL: R$ 523,50"), "o caixa mostra o total certo");
conferir(caixa.includes("Pagamento: PIX"), "o caixa mostra a forma de pagamento");
conferir(caixa.includes("12/09/2026"), "a data sai em dd/mm/aaaa");
conferir(salgados.includes("RETIRADA: 12/09/2026 16:00"), "a cozinha ve dia e hora da retirada");
conferir(caixa.includes("buzinar na frente"), "a observacao do cliente chega no caixa");
conferir(!limpo(cupons.join("")).includes("EXTRAS"), "nada cai na comanda generica EXTRAS");

// Pedido sem data: a cozinha nao pode receber um espaco em branco.
const semData = ponte.cuponsDoPedido({ ...pedido, retiradaData: null, retiradaHora: null });
conferir(limpo(semData[0]).includes("SEM DATA"), "pedido sem data grita SEM DATA no papel");

// So docinho: nao pode sair via de salgado nem de bolo em branco.
const soDoce = ponte.cuponsDoPedido({ ...pedido, itens: [pedido.itens[3]] });
conferir(soDoce.length === 2, "pedido so de docinho sai com 2 vias (docinhos + caixa)");

try { unlinkSync(arquivo); } catch {}

console.log("");
console.log(erros === 0 ? "TODOS OS CASOS PASSARAM" : erros + " CASO(S) FALHARAM");
process.exit(erros === 0 ? 0 : 1);
