// A PERGUNTA QUE SAI NAO PODE DISCORDAR DA ETAPA QUE ESTA ABERTA.
//
// POR QUE ISTO EXISTE
//
// Duas camadas decidem coisas diferentes sobre o mesmo pedido:
//
//     etapas.ts    esta etapa esta cumprida?
//     pergunta.ts  o que a padaria fala agora?
//
// Enquanto as duas concordam, a conversa anda. Quando discordam, ela TRAVA, e o
// jeito de travar e sempre o mesmo: a etapa espera uma coisa e a fala pede
// outra, o cliente responde a fala, a etapa continua aberta, e a mesma pergunta
// volta pra sempre.
//
// Achado em 28/08/2026, e o defeito tinha sido introduzido por mim uma hora
// antes: a etapa do bolo passou a usar ehNomeDeFamilia pra saber se o sabor foi
// escolhido, e a fala continuou com a comparacao a mao produto !== "bolo".
//
//     pedido com "bolos"
//     a etapa diz  >> ainda falta o sabor
//     a fala diz   >> "O bolo vai no prato de MDF aberto ou com tampa?"
//
// Consertar um lado so trocaria de defeito: antes das duas mudarem, "bolos"
// fechava a etapa e a cozinha recebia bolo sem sabor.
//
// O QUE ELE COBRA
//
// 1. ETAPA ABERTA TEM FALA. Nenhuma etapa da vez pode devolver texto vazio: o
//    switch tem um `default` que devolve fala em branco, entao etapa nova entra
//    muda e ninguem percebe.
//
// 2. A FALA DA ETAPA ABERTA TEM QUE FALAR DO QUE FALTA. Com o nome da familia
//    no lugar do produto, a pergunta tem que ser a do sabor.
//
// 3. BOTAO DENTRO DO LIMITE DA META. Ate tres por mensagem, 20 caracteres cada.
//    Passou, a Meta recusa a MENSAGEM INTEIRA e o cliente nao recebe nada. O
//    teste das etapas cobre os botoes fixos; estes aqui sao montados em tempo
//    de execucao e ninguem via.
//
// 4. TODA PECA DE CARDAPIO CITADA EXISTE EM DISCO. cardapio: "salgados" vira um
//    arquivo em public/cardapios. Nome errado = imagem quebrada na mao do
//    cliente, e nenhum compilador ve string.
//
// Roda com: node testes/a-pergunta-nao-discorda-da-etapa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CARDAPIOS = path.join(__dirname, "..", "public", "cardapios");
const arquivos = fs.readdirSync(CARDAPIOS).map((f) => f.replace(/\.[a-z]+$/, ""));

const sonda = path.join(__dirname, "_sonda-pergunta.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { ETAPAS_DA_FESTA, etapaDaVez, ROTEIRO_DA_FESTA, ROTEIRO_COMUM } from '../lib/ia/fluxo/etapas.ts';",
    "import { falaDaEtapa } from '../lib/ia/fluxo/pergunta.ts';",
    "import { produtosDaCasa } from '../lib/ia/dados/produtos.ts';",
    "",
    "const CHEIO = {",
    "  ehFesta: true, pessoas: 20, base: null, baseAceita: true, naoQuer: [], forminha: 'rosa',",
    "  dados: { nome: 'Ana', data: '02/09/2026', hora: '15:00', pagamento: 'pix' },",
    "  pecas: { topo: false, papelDeArroz: false }, topoNome: null, topoIdade: null,",
    "  escrito: null, tema: null, prato: 'aberto', ofereceu: false, itens: [],",
    "};",
    "",
    "// 1. cada etapa, com ela mesma sendo a da vez, tem que ter o que dizer.",
    "const mudas = [];",
    "for (const e of ETAPAS_DA_FESTA) {",
    "  const f = falaDaEtapa(e, { ...CHEIO, itens: [] }, 12345, []);",
    "  // A etapa das pecas devolve vazio de proposito quando ja esta tudo",
    "  // respondido: ali quem escolhe a proxima e a lista, nao a fala.",
    "  if (!String(f.texto || '').trim() && e.id !== 'pecas_do_bolo') mudas.push(e.id);",
    "}",
    "",
    "// 2. as duas camadas concordando sobre o generico.",
    "const discordam = [];",
    "const OUTROS = [",
    "  { produto: 'coxinha', categoria: 'salgado_frito', qtd: 100, obs: null },",
    "  { produto: 'brigadeiro', categoria: 'docinho', qtd: 50, obs: null },",
    "];",
    "for (const generico of ['bolo', 'bolos', 'Bolo ']) {",
    "  const p = { ...CHEIO, prato: null,",
    "    itens: [...OUTROS, { produto: generico, categoria: 'bolo_festa', qtd: 2, obs: null }] };",
    "  const etapa = etapaDaVez(p, ROTEIRO_DA_FESTA);",
    "  const texto = String(falaDaEtapa(etapa, p, 0, []).texto || '');",
    "  // A etapa do bolo esta aberta porque falta o SABOR. Entao a fala tem que",
    "  // perguntar o sabor, e nao o prato nem os detalhes.",
    "  if (etapa.id === 'bolo' && !/sabor/i.test(texto)) {",
    "    discordam.push(generico + ': etapa pede o sabor, fala diz ' + JSON.stringify(texto.slice(0, 48)));",
    "  }",
    "}",
    "",
    "// 3 e 4. todo botao e toda peca de cardapio que a padaria pode mandar.",
    "const botoes = [], pecas = [];",
    "const ESTADOS = [",
    "  { ...CHEIO, itens: [] },",
    "  { ...CHEIO, prato: null, itens: [{ produto: 'bolo 4 leites', categoria: 'bolo_festa', qtd: 2, obs: null }] },",
    "  { ...CHEIO, pecas: { topo: null, papelDeArroz: null }, prato: null,",
    "    dados: { nome: null, data: null, hora: null, pagamento: null },",
    "    itens: [{ produto: 'bolo 4 leites', categoria: 'bolo_festa', qtd: 2, obs: null }] },",
    "  { ...CHEIO, ehFesta: false, dados: { nome: null, data: null, hora: null, pagamento: null },",
    "    itens: [{ produto: 'coxinha', categoria: 'salgado_frito', qtd: 100, obs: null }] },",
    "  { ...CHEIO, itens: [{ produto: 'pizza redonda', categoria: 'pizza', qtd: 2, obs: null }] },",
    "  { ...CHEIO, itens: [{ produto: 'cuca', categoria: 'padaria', qtd: 1, obs: null }] },",
    "];",
    "for (const roteiro of [ROTEIRO_DA_FESTA, ROTEIRO_COMUM]) {",
    "  for (const p of ESTADOS) {",
    "    for (const e of roteiro) {",
    "      const f = falaDaEtapa(e, p, 12345, []);",
    "      botoes.push({ etapa: e.id, quantos: (f.botoes ?? []).length,",
    "        titulos: (f.botoes ?? []).map((b) => b.titulo) });",
    "      if (f.cardapio) pecas.push({ etapa: e.id, cardapio: f.cardapio });",
    "    }",
    "  }",
    "}",
    "",
    "// A fiacao grupo -> peca tem que cobrir todo grupo com lista longa de sabor.",
    "const gruposLongos = [...new Set(produtosDaCasa().filter((x) => x.sabores.length > 6).map((x) => x.grupo))];",
    "",
    "console.log(JSON.stringify({ mudas, discordam, botoes, pecas, gruposLongos }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pergunta.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

const pecasUsadas = [...new Set(r.pecas.map((x) => x.cardapio))];
console.log("Falas medidas: " + r.botoes.length);
console.log("Pecas de cardapio citadas: " + pecasUsadas.join(", "));
console.log("Grupos com lista longa de sabor: " + r.gruposLongos.join(", "));
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista.slice(0, 15)) console.log("        " + l);
  console.log("");
};

cobra("etapa da vez que nao tem o que dizer (o default do switch engoliu)", r.mudas);
cobra("a etapa e a fala discordam, e a conversa trava", r.discordam);
cobra(
  "mais de tres botoes numa mensagem (a Meta recusa)",
  r.botoes.filter((b) => b.quantos > 3).map((b) => b.etapa + ": " + b.quantos),
);
cobra(
  "titulo de botao acima de 20 caracteres (a Meta recusa a mensagem inteira)",
  r.botoes.flatMap((b) => b.titulos.filter((t) => t.length > 20).map((t) => b.etapa + ": " + t)),
);
cobra(
  "peca de cardapio citada que nao existe em public/cardapios",
  pecasUsadas.filter((c) => !arquivos.includes(c)),
);

// A fiacao grupo -> peca, lida na fonte: grupo com lista longa de sabor PRECISA
// de peca, senao a padaria despeja 31 sabores numa mensagem de WhatsApp e
// ninguem le. E toda peca citada la tem que existir em disco tambem.
const fontePergunta = fs.readFileSync(
  path.join(__dirname, "..", "lib", "ia", "fluxo", "pergunta.ts"), "utf8");
const mapa = fontePergunta.match(/const CARDAPIO_DO_GRUPO[^=]*= \{([\s\S]*?)\n\};/);
const dentro = mapa ? mapa[1] : "";
const chaves = [...dentro.matchAll(/^\s*"?([a-z_-]+)"?:/gm)].map((m) => m[1]);
const valores = [...new Set([...dentro.matchAll(/:\s*"([a-z-]+)"/g)].map((m) => m[1]))];

cobra(
  "grupo com lista longa de sabor e sem peca de cardapio (o cliente recebe uma parede de texto)",
  r.gruposLongos.filter((g) => !chaves.includes(g)),
);
cobra(
  "a fiacao grupo -> peca aponta pra arquivo que nao existe",
  valores.filter((v) => !arquivos.includes(v)),
);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    a fala acompanha a etapa, os botoes cabem e o cardapio existe");
console.log("");
console.log("PASSOU");
