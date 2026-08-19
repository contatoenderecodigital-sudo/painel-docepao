// O PAPEL QUE A COZINHA RECEBE, CONFERIDO SEM GASTAR FOLHA.
//
// O cupom passou a ser montado no servidor (lib/cupom-escpos.ts) porque, quando
// era montado na ponte, mudar o layout exigia trocar o arquivo na maquina da
// padaria E reiniciar o programa. Isso falhou do jeito previsivel: o arquivo foi
// corrigido as 02:17 e o processo rodava desde as 14:26 do dia anterior, entao
// continuou imprimindo o layout velho da memoria.
//
// Cada conferencia aqui e um erro que ja custou papel errado ou bancada errada.
// Roda com: node testes/cupom-do-servidor.cjs
const { execFileSync } = require("node:child_process");
const { writeFileSync, unlinkSync, mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

// Compila os dois arquivos de verdade (o do cupom e o das bancadas) e usa o
// resultado. Testar uma copia digitada aqui esconderia justamente a divergencia
// que este teste existe pra pegar.
const pasta = mkdtempSync(join(tmpdir(), "cupom-"));
execFileSync(
  "npx",
  ["tsc", "lib/cupom-escpos.ts", "lib/departamentos.ts", "lib/tipos.ts",
   "--outDir", pasta, "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop"],
  { stdio: "pipe", shell: true },
);
const { montarCupons } = require(join(pasta, "cupom-escpos.js"));

const pedido = {
  id: "abcd1234-0000-0000-0000-000000000000",
  clienteNome: "Dona Ivone",
  clienteTelefone: "5511970000006",
  retiradaData: "2026-09-12",
  retiradaHora: "16:00",
  pessoas: 25,
  totalCentavos: 52350,
  formaPagamento: "pix",
  observacoes: "buzinar na frente",
  itens: [
    { produto: "coxinha", categoria: "salgado_frito", qtd: 100, obs: null, unidade: "un", unitCentavos: 100, subtotalCentavos: 10000 },
    { produto: "esfirra", categoria: "salgado_assado", qtd: 50, obs: "calabresa", unidade: "un", unitCentavos: 125, subtotalCentavos: 6250 },
    { produto: "torta fria", categoria: "torta_fria", qtd: 2, obs: "frango com palmito", unidade: "kg", unitCentavos: 6990, subtotalCentavos: 13980 },
    { produto: "brigadeiro", categoria: "docinho", qtd: 60, obs: "forminha dourada", unidade: "un", unitCentavos: 125, subtotalCentavos: 7500 },
    { produto: "bolo laka", categoria: "bolo_festa", qtd: 3, obs: "pao de lo branco, topo tema futebol", unidade: null, unitCentavos: 4890, subtotalCentavos: 14670 },
  ],
};

const limpo = (t) => String(t).replace(/\x1B.|\x1D.|[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
const cupons = montarCupons(pedido);
const achar = (nome) => limpo(cupons.find((c) => limpo(c).includes(nome)) || "");

let erros = 0;
function conferir(ok, oque) {
  console.log((ok ? "ok    " : "ERRO  ") + oque);
  if (!ok) erros++;
}

const salgados = achar("SALGADOS");
const docinhos = achar("DOCINHOS");
const bolos = achar("BOLO FESTA");
const caixa = achar("CAIXA");

console.log("Cupons gerados: " + cupons.length + "\n");
conferir(cupons.length === 4, "uma via por bancada com item, mais o caixa");
conferir(salgados.includes("COXINHA"), "coxinha vai pros salgados");
conferir(salgados.includes("TORTA FRIA"), "torta fria de palmito e SALGADO, apesar do nome");
conferir(!docinhos.includes("TORTA FRIA"), "e nao aparece na bancada do acucar");
conferir(salgados.includes("calabresa"), "o recheio da esfirra esta no papel");
conferir(docinhos.includes("BRIGADEIRO"), "brigadeiro vai pros docinhos");
conferir(docinhos.includes("forminha dourada"), "a cor da forminha esta no papel");
conferir(bolos.includes("BOLO LAKA"), "o bolo vai pra bancada de bolo de festa");
conferir(bolos.includes("3 kg"), "3 kg de bolo sai como PESO");
conferir(!bolos.includes("3 un"), "e nunca como tres unidades");
conferir(bolos.includes("topo tema futebol"), "o tema do topo esta no papel do bolo");
conferir(!salgados.includes("R$"), "o papel da cozinha nao leva preco");
conferir(caixa.includes("TOTAL: R$ 523,50"), "o caixa mostra o total certo");
conferir(caixa.includes("Pagamento: PIX"), "o caixa mostra a forma de pagamento");
conferir(caixa.includes("12/09/2026"), "data em dd/mm/aaaa");
conferir(salgados.includes("RETIRADA: 12/09/2026 16:00"), "a cozinha ve dia e hora");
conferir(caixa.includes("buzinar na frente"), "a observacao do cliente chega no caixa");
conferir(!limpo(cupons.join("")).includes("EXTRAS"), "nada cai na comanda generica EXTRAS");

const semData = montarCupons({ ...pedido, retiradaData: null, retiradaHora: null });
conferir(limpo(semData[0]).includes("SEM DATA"), "pedido sem data grita SEM DATA no papel");

const soDoce = montarCupons({ ...pedido, itens: [pedido.itens[3]] });
conferir(soDoce.length === 2, "pedido so de docinho sai com duas vias");

console.log("");
console.log(erros === 0 ? "TODOS OS CASOS PASSARAM" : erros + " CASO(S) FALHARAM");
process.exit(erros === 0 ? 0 : 1);
