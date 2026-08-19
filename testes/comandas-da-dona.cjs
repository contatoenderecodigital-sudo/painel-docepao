// AS COMANDAS, DO JEITO QUE A DONA DITOU NOS AUDIOS.
//
// Cada conferencia aqui e uma frase dela. O papel que sai da impressora e a
// unica coisa que a cozinha le, e errar ali nao aparece em tela nenhuma: sai
// direto na bancada errada.
//
// Roda com: node testes/comandas-da-dona.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

// Compila os arquivos DE VERDADE. Testar uma copia digitada aqui esconderia
// justamente a divergencia que este teste existe pra pegar.
const pasta = mkdtempSync(join(tmpdir(), "comandas-"));
execFileSync(
  "npx",
  ["tsc", "lib/cupom-escpos.ts", "lib/departamentos.ts", "lib/tipos.ts",
   "--outDir", pasta, "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop"],
  { stdio: "pipe", shell: true },
);
const { montarCupons } = require(join(pasta, "cupom-escpos.js"));
const { deptoDe } = require(join(pasta, "departamentos.js"));

const limpo = (t) => String(t).replace(/\x1B.|\x1D.|[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
// O papel escreve o produto como esta no pedido, sem caixa alta: e o layout
// que ja funcionava. A conferencia compara sem diferenciar.
const tem = (texto, oque) => String(texto).toLowerCase().includes(String(oque).toLowerCase());

let erros = 0;
function conferir(ok, oque) {
  console.log((ok ? "ok    " : "ERRO  ") + oque);
  if (!ok) erros++;
}

// ---------------------------------------------------------------------------
// "Tudo vai ficar separado por segmentos. Empadao e uma coisa, torta doce e
//  outra coisa, torta recheada e outra coisa."
// ---------------------------------------------------------------------------
console.log("== cada tipo na sua comanda ==");
const separados = [
  ["coxinha", "salgado_frito", "salgados"],
  ["esfirra", "salgado_assado", "salgados"],
  ["brigadeiro", "docinho", "docinhos"],
  ["bolo laka", "bolo_festa", "bolo_festa"],
  ["bolo de cenoura", "bolo_caseiro", "bolo_caseiro"],
  ["bolo salgado", "bolo_salgado", "bolo_salgado"],
  ["torta fria", "torta_fria", "torta_fria"],
  ["torta especial", "torta_recheada", "torta_doce"],
  ["empadao", "empadao", "empadao"],
  ["pizza inteira", "pizza", "pizza"],
  ["calzone", "calzone", "calzone"],
  ["cupcake", "cupcake", "cupcake"],
  ["franciscano", "franciscano", "franciscano"],
  ["cuca recheada", "padaria", "padaria"],
];
for (const [produto, categoria, esperado] of separados) {
  const deu = deptoDe({ produto, categoria });
  conferir(deu === esperado, `${produto} vai pra comanda ${esperado}` + (deu === esperado ? "" : ` (deu ${deu})`));
}

// "Salgados, nao precisa estar separado, no caso, assados e fritos, e tudo junto."
conferir(
  deptoDe({ produto: "coxinha", categoria: "salgado_frito" }) ===
    deptoDe({ produto: "esfirra", categoria: "salgado_assado" }),
  "frito e assado ficam na MESMA comanda de salgados",
);

// Categoria generica: quem decide e o nome. "Torta fria e empadao sao produzidos
// em mesas diferentes, mesmo os dois sendo vendidos por quilo."
console.log("");
console.log("== quando a categoria nao diz o produto, o nome decide ==");
conferir(deptoDe({ produto: "torta fria de frango", categoria: "por_quilo" }) === "torta_fria", "torta fria por quilo vai pra torta fria");
conferir(deptoDe({ produto: "empadao de palmito", categoria: "por_quilo" }) === "empadao", "empadao por quilo vai pro empadao");
conferir(deptoDe({ produto: "bolo salgado", categoria: "por_quilo" }) === "bolo_salgado", "bolo salgado nao vira bolo de festa");
conferir(deptoDe({ produto: "pao frances", categoria: "por_quilo" }) === "padaria", "pao frances vai pra padaria");

// "O que acompanha o bolo sai na comanda do bolo."
conferir(deptoDe({ produto: "topo de bolo", categoria: "adicional_bolo" }) === "bolo_festa", "topo de bolo sai na comanda do bolo");
conferir(deptoDe({ produto: "papel de arroz", categoria: "papel_de_arroz" }) === "bolo_festa", "papel de arroz sai na comanda do bolo");

// ---------------------------------------------------------------------------
// O pedido que ela deu de exemplo no audio:
// "eu quero um bolo de cenoura que de 30 pedacos, e mais 25 brigadeiros e 25
//  beijinhos. Os 25 brigadeiros e 25 beijinhos vao ficar na mesma comanda. O
//  bolo de cenoura vai pra outra comandinha. Mas a gente vai escrever la nos
//  docinhos que tem um bolo de cenoura."
// ---------------------------------------------------------------------------
console.log("");
console.log("== o exemplo que ela deu no audio ==");
const pedidoDela = {
  id: "abcd1234-0000-0000-0000-000000000000",
  clienteNome: "Dona Ivone",
  clienteTelefone: "5511970000006",
  retiradaData: "2026-09-12",
  retiradaHora: "16:00",
  pessoas: null,
  totalCentavos: 11250,
  formaPagamento: "pix",
  observacoes: null,
  itens: [
    { produto: "bolo de cenoura", categoria: "bolo_caseiro", qtd: 3, obs: "30 pedacos", unidade: "kg", unitCentavos: 2500, subtotalCentavos: 7500 },
    { produto: "brigadeiro", categoria: "docinho", qtd: 25, obs: "forminha rosa", unidade: "un", unitCentavos: 125, subtotalCentavos: 3125 },
    { produto: "beijinho", categoria: "docinho", qtd: 25, obs: "forminha rosa", unidade: "un", unitCentavos: 125, subtotalCentavos: 3125 },
  ],
};
const dela = montarCupons(pedidoDela);
const comandaDoce = limpo(dela.find((c) => limpo(c).includes("== DOCINHOS ==")) || "");
const comandaBolo = limpo(dela.find((c) => limpo(c).includes("== BOLO CASEIRO ==")) || "");
const comandaCaixa = limpo(dela.find((c) => limpo(c).includes("== CAIXA ==")) || "");

conferir(dela.length === 3, "sai uma comanda de docinhos, uma de bolo caseiro e o caixa");
conferir(tem(comandaDoce, "brigadeiro") && tem(comandaDoce, "beijinho"), "brigadeiro e beijinho na MESMA comanda");
conferir(!comandaDoce.includes("BOLO DE CENOURA"), "o bolo NAO entra na comanda dos docinhos");
conferir(comandaDoce.includes("CLIENTE TAMBEM PEDIU") && comandaDoce.includes("BOLO CASEIRO"), "nos docinhos esta escrito que tem bolo caseiro");
conferir(comandaBolo.includes("CLIENTE TAMBEM PEDIU") && comandaBolo.includes("DOCINHOS"), "na comanda do bolo esta escrito que tem docinhos");
conferir(comandaDoce.includes("forminha rosa"), "a cor da forminha esta no papel");

// ---------------------------------------------------------------------------
// "Eu quero um pao de torta fria junto com 150 salgados. Os 150 salgados vao
//  ficar todos numa comanda, so que a torta fria vai ficar em outra."
// ---------------------------------------------------------------------------
console.log("");
console.log("== o outro exemplo dela ==");
const festa = {
  ...pedidoDela,
  totalCentavos: 52350,
  pessoas: 25,
  observacoes: "buzinar na frente",
  itens: [
    { produto: "coxinha", categoria: "salgado_frito", qtd: 75, obs: null, unidade: "un", unitCentavos: 100, subtotalCentavos: 7500 },
    { produto: "esfirra", categoria: "salgado_assado", qtd: 75, obs: "calabresa", unidade: "un", unitCentavos: 125, subtotalCentavos: 9375 },
    { produto: "torta fria", categoria: "torta_fria", qtd: 2, obs: "frango com palmito", unidade: "kg", unitCentavos: 3990, subtotalCentavos: 7980 },
    { produto: "bolo laka", categoria: "bolo_festa", qtd: 3, obs: "pao de lo branco, topo tema futebol", unidade: null, unitCentavos: 4890, subtotalCentavos: 14670 },
  ],
};
const cf = montarCupons(festa);
const salg = limpo(cf.find((c) => limpo(c).includes("== SALGADOS ==")) || "");
const tf = limpo(cf.find((c) => limpo(c).includes("== TORTA FRIA ==")) || "");
const bf = limpo(cf.find((c) => limpo(c).includes("== BOLO FESTA ==")) || "");

conferir(cf.length === 4, "salgados, torta fria, bolo festa e caixa: quatro papeis");
conferir(tem(salg, "coxinha") && tem(salg, "esfirra"), "os 150 salgados numa comanda so");
// Cuidado: "TORTA FRIA" aparece SIM na comanda dos salgados, mas na
// referencia cruzada, que e o certo. O que nao pode e ela estar na LISTA DE
// ITENS. Por isso a conferencia olha so o trecho antes do aviso.
const itensDoSalgado = salg.split("CLIENTE TAMBEM PEDIU")[0];
conferir(!itensDoSalgado.includes("TORTA FRIA"), "a torta fria NAO entra na lista de itens dos salgados");
conferir(salg.includes("CLIENTE TAMBEM PEDIU") && salg.includes("TORTA FRIA"), "mas os salgados avisam que tem torta fria");
conferir(tf.includes("TORTA FRIA") && tf.includes("frango com palmito"), "a torta fria tem comanda propria, com o recheio");
conferir(bf.includes("3 kg"), "3 kg de bolo sai como PESO, nao como tres bolos");
conferir(!bf.includes("3 un"), "e nunca como tres unidades");
conferir(bf.includes("topo tema futebol"), "o tema do topo esta na comanda do bolo");
conferir(salg.includes("buzinar na frente"), "a observacao do pedido aparece na comanda");

// "Nao precisa colocar salgadeiro, padeiro, confeiteiro."
const tudo = limpo(cf.join(""));
conferir(!/SALGADEIRO|PADEIRO|CONFEITEIR/i.test(tudo), "o papel nao escreve nome de setor");
conferir(!tudo.includes("EXTRAS"), "nada cai numa comanda generica");

// A comanda da cozinha nao leva preco unitario, so o subtotal pra conferencia.
// A lista de itens vai do cabecalho ate o primeiro tracejado; do tracejado
// pra baixo e o resumo, que PODE ter preco.
const listaDoSalgado = salg.split("-".repeat(48))[0];
conferir(!listaDoSalgado.includes("R$"), "os itens da comanda saem sem preco colado neles");
// "Queria que estivesse especificado a quantidade total de R$ 1,00, de R$ 1,25
//  tambem, pra ficar mais facil a gente somar dai com a caixa."
conferir(/un x R\$/.test(salg), "a comanda traz o resumo por faixa de preco, como ela pediu");
conferir(salg.includes("Subtotal"), "e o subtotal da comanda, pra somar com o caixa");

// ---------------------------------------------------------------------------
// O caixa: tudo junto, com valores e a forma de pagamento.
// ---------------------------------------------------------------------------
console.log("");
console.log("== o papel do caixa ==");
const cx = limpo(cf.find((c) => limpo(c).includes("== CAIXA ==")) || "");
conferir(tem(cx, "coxinha") && tem(cx, "torta fria") && tem(cx, "bolo laka"), "o caixa tem TODOS os itens");
conferir(!salg.includes("TOTAL:") && cx.includes("TOTAL:"), "o TOTAL do pedido sai so no caixa, nao nas comandas");
conferir(cx.includes("TOTAL: R$ 523,50"), "o caixa mostra o total certo");
conferir(cx.includes("Pagamento: PIX"), "o caixa mostra a forma de pagamento");
conferir(cx.includes(" x R$"), "o caixa mostra o valor de cada item");
conferir(comandaCaixa.includes("Fone:"), "o caixa tem o telefone pra ligar pro cliente");

const semForma = montarCupons({ ...festa, formaPagamento: null });
conferir(limpo(semForma[semForma.length - 1]).includes("Pagamento na RETIRADA"), "sem forma combinada, vale o padrao da casa");

// ---------------------------------------------------------------------------
// Pedido sem data: a cozinha nao pode receber um espaco em branco.
// ---------------------------------------------------------------------------
console.log("");
console.log("== o que nao pode passar em branco ==");
const semData = montarCupons({ ...festa, retiradaData: null, retiradaHora: null });
conferir(limpo(semData[0]).includes("SEM DATA"), "pedido sem data grita SEM DATA no papel");
conferir(limpo(semData[0]).includes("RETIRADA:"), "e a linha de retirada continua la");

// Pedido de um segmento so nao ganha referencia cruzada inventada.
const soDoce = montarCupons({ ...festa, itens: [pedidoDela.itens[1]] });
conferir(soDoce.length === 2, "pedido de um segmento so sai com a comanda dele e o caixa");
conferir(!limpo(soDoce[0]).includes("CLIENTE TAMBEM PEDIU"), "e sem referencia cruzada inventada");

// ---------------------------------------------------------------------------
// A OBSERVACAO NAO PODE MUDAR DE SENTIDO NA QUEBRA DE LINHA.
//
// Saiu impresso num bolo de verdade:
//   > com morango, pao de lo de chocolate, sem
//   > topo e sem papel de arroz
// O "sem" terminou a linha e "topo" comecou a outra, as duas com ">". Batendo
// o olho, le-se "topo": o contrario do combinado.
// ---------------------------------------------------------------------------
console.log("");
console.log("== a observacao do papel ==");
const bolo = montarCupons({
  ...pedidoDela,
  itens: [{ produto: "bolo brigadeiro com morango", categoria: "bolo_festa", qtd: 2.5,
    obs: "com morango, pao de lo de chocolate, sem topo e sem papel de arroz",
    unidade: "kg", unitCentavos: 4990, subtotalCentavos: 12475 }],
});
const papelDoBolo = limpo(bolo[0]);
const linhasObs = papelDoBolo.split("\n").filter((l) => l.trim().startsWith(">"));
conferir(linhasObs.some((l) => l.includes("sem topo e sem papel de arroz")), "a negacao fica inteira numa linha so");
conferir(!linhasObs.some((l) => l.trim() === "> topo e sem papel de arroz"), "nenhuma linha comeca com topo, que inverteria o sentido");
conferir(!papelDoBolo.includes("> com morango"), "a observacao nao repete o que ja esta no nome do item");
conferir(papelDoBolo.includes("bolo brigadeiro com morango"), "e o nome do item continua completo");

console.log("");
console.log(erros === 0 ? "TODOS OS CASOS PASSARAM" : erros + " CASO(S) FALHARAM");
process.exit(erros === 0 ? 0 : 1);
