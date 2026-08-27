// O RECHEIO QUE O PRODUTO NAO TEM NAO VAI PRA COZINHA.
//
// POR QUE ISTO EXISTE
//
// Sete produtos da casa tem recheio FIXO: a coxinha e de frango, a bolinha e de
// queijo, o croquete e de carne com catupiry. Neles o catalogo manda a IA NAO
// perguntar recheio, e por isso ninguem conferia o que o cliente escrevia junto:
//
//   cliente >> 100 coxinha de camarao
//   comanda >> 100 coxinha ~ camarao
//
// Medido em 27/08/2026. O produto estava certo, o preco estava certo, e a
// COMANDA PROMETIA o que a cozinha nao faz. Quem tem LISTA de sabor (esfirra,
// quiche, empadao) ja estava protegido: o sabor de fora nao casa com a lista e a
// padaria pergunta. So os de recheio fixo passavam calado.
//
// E o mesmo desenho da restricao de dieta: tira da observacao e DIZ. Tirar
// calado seria melhor que prometer e pior que avisar, e quem pede coxinha de
// camarao merece ouvir antes de retirar.
//
// OS TRES LADOS
//
//   1. o recheio que nao existe SAI da observacao;
//   2. a padaria DIZ qual e o recheio da casa, e nao recusa o pedido: o item
//      continua la, com a coxinha de frango;
//   3. o recheio que EXISTE nao pode ser tocado. Guarda larga demais aqui
//      apagaria "coxinha de frango" e "esfirra de carne", que sao o pedido
//      certo da maioria das pessoas.
//
// Roda com: node testes/o-recheio-fixo-nao-se-inventa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-recheio-fixo.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { produtosDaCasa } from "../lib/ia/dados/produtos.ts";',
    'import { recheioQueNaoExiste } from "../lib/ia/fluxo/sabor.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[],",
    "};",
    "",
    "const fixos = produtosDaCasa().filter((p) => p.saborFixo && p.sabores.length);",
    "",
    "// A CLASSE INTEIRA, e nao so a coxinha: pra cada produto de recheio fixo, um",
    "// recheio inventado e o recheio de verdade.",
    "const inventado = [];",
    "const oDaCasa = [];",
    "for (const p of fixos) {",
    "  // 'camarao' nao e recheio de nada na Doce Pao.",
    "  //",
    "  // O SABOR VAI NA OBSERVACAO, QUE E A PORTA QUE A IA USA DE VERDADE.",
    "  //",
    "  // A primeira versao deste teste mandava pelo NOME ('coxinha de camarao'),",
    "  // e passava sem o conserto: o modelo nao devolve assim. Medido contra ele:",
    "  //",
    "  //   {\"produto\":\"coxinha\",\"qtd\":100,\"obs\":\"camarão\"}",
    "  //",
    "  // Teste que entra por uma porta que ninguem usa nao protege porta nenhuma.",
    "  const errado = await responder(VAZIO as never,",
    "    { texto: '50 ' + p.nome + ' de camarao' } as never,",
    "    (async () => ({ itens: [{ produto: p.nome, qtd: 50, sabor: 'camarao', obs: '' }] })) as never);",
    "  inventado.push({",
    "    nome: p.nome, daCasa: p.sabores.join(' e '),",
    "    itens: errado.estado.itens.map((i) => ({ produto: i.produto, obs: i.obs })),",
    "    fala: String(errado.fala.texto),",
    "  });",
    "",
    "  // E o recheio de verdade, escrito do jeito do cardapio.",
    "  const certo = await responder(VAZIO as never,",
    "    { texto: '50 ' + p.nome + ' de ' + p.sabores[0] } as never,",
    "    (async () => ({ itens: [{ produto: p.nome, qtd: 50, sabor: p.sabores[0], obs: '' }] })) as never);",
    "  oDaCasa.push({",
    "    nome: p.nome, recheio: p.sabores[0],",
    "    itens: certo.estado.itens.map((i) => ({ produto: i.produto, obs: i.obs })),",
    "  });",
    "}",
    "",
    "// A guarda nao pode tocar em quem tem LISTA de sabor: la quem resolve e a",
    "// pergunta, e apagar aqui deixaria o item sem sabor e sem ninguem perguntando.",
    "const comLista = produtosDaCasa().filter((p) => !p.saborFixo && p.sabores.length)",
    "  .map((p) => ({ nome: p.nome, mexeu: recheioQueNaoExiste(p.nome, 'camarao') }))",
    "  .filter((x) => x.mexeu);",
    "",
    "",
    "// PEDIDO LEGITIMO NAO E RECHEIO INVENTADO.",
    "//",
    "// A observacao carrega coisa que a cozinha PRECISA ler, e apagar isso seria",
    "// pior que o defeito que a guarda conserta.",
    "//",
    "// QUEM SEPARA RECADO DE SABOR E A IA, e nao uma lista de palavras minha.",
    "// Ela devolve os dois em campos diferentes, e e assim que estes casos",
    "// chegam aqui: sabor vazio, recado na observacao. Medido contra ela.",
    "const legitimos = [];",
    "for (const obs of ['sem cebola', 'bem passado', 'pouco sal', 'sem sal', 'capricha no recheio']) {",
    "  const r = await responder(VAZIO as never, { texto: '50 coxinha ' + obs } as never,",
    "    (async () => ({ itens: [{ produto: 'coxinha', qtd: 50, sabor: '', obs }] })) as never);",
    "  legitimos.push({ obs, comanda: r.estado.itens.map((i) => i.obs) });",
    "}",
    "",
    "console.log(JSON.stringify({ fixos: fixos.length, inventado, oDaCasa, comLista, legitimos }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-recheio-fixo.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

console.log("Produtos de recheio fixo: " + r.fixos);
console.log("");

if (!r.fixos) {
  console.log("ERRO  nenhum produto de recheio fixo: o catalogo mudou ou a leitura quebrou");
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

// 1 e 2: o inventado sai, e a padaria diz o da casa.
const naObs = [];
const semAviso = [];
const sumiu = [];
for (const c of r.inventado) {
  if (!c.itens.length) { sumiu.push(c.nome); continue; }
  if (c.itens.some((i) => /camar/i.test(String(i.obs ?? "")))) naObs.push(c.nome + " -> obs: " + c.itens[0].obs);
  // A fala tem que citar o recheio de verdade, senao o cliente nao sabe o que
  // vai receber. E nao pode recusar: o item continua no pedido.
  if (!new RegExp(c.daCasa.split(" e ")[0], "i").test(c.fala)) semAviso.push(c.nome + " -> " + c.fala.split("\n")[0]);
}

const cobra = (rotulo, lista) => {
  if (lista.length) {
    falhas.push(rotulo);
    console.log("ERRO  " + rotulo + " (" + lista.length + ")");
    for (const x of lista) console.log("        " + x);
  } else {
    console.log("ok    " + rotulo);
  }
};

cobra("o recheio inventado foi pra comanda", naObs);
cobra("a padaria nao disse qual e o recheio da casa", semAviso);
cobra("o item SUMIU do pedido em vez de so perder o recheio", sumiu);

// 3: o recheio de verdade continua intocado.
//
// FORA UM CASO, E ELE NAO E DEFEITO: quando o recheio JA ESTA NO NOME do
// produto. "salsicha frita de salsicha" perde o "salsicha" da observacao, e nao
// perde informacao nenhuma: a cozinha le "salsicha frita" e sabe o que e. Cobrar
// a repeticao seria cobrar ruido.
const perdeuOCerto = r.oDaCasa.filter((c) => {
  const primeira = c.recheio.split(" ")[0];
  if (new RegExp(primeira, "i").test(c.nome)) return false;
  return !c.itens.length || !new RegExp(primeira, "i").test(String(c.itens[0].obs ?? ""));
}).map((c) => c.nome + " de " + c.recheio + " -> obs: " + JSON.stringify(c.itens[0] && c.itens[0].obs));
cobra("o recheio DA CASA foi apagado junto", perdeuOCerto);

// Pedido legitimo tem que sobreviver inteiro.
cobra(
  "a guarda comeu pedido legitimo da observacao",
  r.legitimos.filter((l) => !l.comanda.some((o) => String(o ?? "").includes(l.obs)))
    .map((l) => "'" + l.obs + "' -> comanda: " + JSON.stringify(l.comanda)),
);

// E quem tem lista de sabor nao pode ser tocado por esta guarda.
cobra("a guarda mexeu em produto que tem LISTA de sabor",
  r.comLista.map((x) => x.nome + " -> " + x.mexeu));

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
