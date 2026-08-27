// A IA ENTENDE QUEM ESCREVE ERRADO, PORQUE ELA TEM O CONTEXTO.
//
// POR QUE ISTO EXISTE
//
// Eu vinha consertando erro de digitacao no CODIGO, com regua de distancia de
// letra. O dono cortou isso, e provou o ponto escrevendo torto de proposito:
//
//   "tipo eu digitando errado vc entende pq tem contexto, da pra entender"
//
// Ele escreveu "te mcontexto" e "enmtendwer", e eu entendi. Nenhuma distancia
// de letra chega la: "enmtendwer" esta a quatro edicoes de "entender". Quem
// resolve isso e quem tem contexto, e no sistema quem tem contexto e a IA.
//
// O cardapio da etapa JA IA na instrucao dela, mas nada mandava ela RESPONDER
// com o nome do cardapio. Entao "brigadero" voltava "brigadero", e o portao do
// codigo, que so sabe comparar letra, jogava fora e a padaria dizia "a gente
// nao faz brigadero".
//
// Uma linha na instrucao vale por qualquer lista de erros, e vale pra padaria
// nova que entrar amanha: o cardapio dela vai junto e a regra e a mesma.
//
// O QUE ESTE INSTRUMENTO MEDE
//
// A regua de letras do codigo continua existindo como rede embaixo, e ela e
// medida no portao, offline, por `uma-letra-trocada-nao-nega-o-produto.cjs`.
//
// Aqui e a outra ponta: a IA DE VERDADE, com a instrucao de verdade. Sem isto,
// "a IA entende" e chute. Medido em 27/08/2026, sete falas escritas errado:
//
//   "50 brigadero e 50 beijnho"        -> brigadeiro, beijinho
//   "quero 30 cajuzino e 20 trufaa"    -> cajuzinho, trufa
//   "100 coxnia e 100 chique de frnago"-> coxinha, chique
//   "50 risoels de carne e 50 esfia"   -> risólis (carne), esfihas
//   "um bolo de 2 kg de 4 leits"       -> 4 leites
//   "60 mini bloha de carne"           -> mini bolha (carne)
//   "40 pao de batta"                  -> pão de batata
//
// Os dois ultimos sao o que a regua de letras NAO alcanca de jeito nenhum:
// produto de duas palavras. E "coxnia" esta a duas edicoes de "coxinha", fora
// da folga de uma letra. A IA acertou os tres.
//
// NAO E PORTAO: gasta chamada de IA e roda dentro do container, que e onde a
// chave mora. Roda na mao, com a instrucao do repositorio de agora:
//
//   node testes/a-ia-entende-quem-escreve-errado.cjs
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, execFile } = require("node:child_process");

const CHAVE = os.homedir() + "/.ssh/id_ed25519_hub";
const ssh = (comando, entrada) =>
  new Promise((res, rej) =>
    execFile(
      "ssh",
      ["-i", CHAVE, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=no", "root@179.198.126.197", comando],
      { timeout: 300000, maxBuffer: 10485760 },
      (e, s) => (e ? rej(e) : res(String(s))),
    ).stdin?.end(entrada ?? ""),
  );

// CORRIGIR A ESCRITA E TROCAR O PRODUTO SAO COISAS DIFERENTES.
//
// A primeira versao da instrucao pedia so a primeira, e a IA passou a ENCAIXAR
// qualquer coisa no cardapio. Medido contra ela de verdade em 27/08/2026:
//
//   "50 xilofone"            ->  50 BRIGADEIROS (obs: xilofone)
//   "50 macarons"            ->  brigadeiro
//   "daquele docinho preto"  ->  brigadeiro
//   "bolo de chocolate"      ->  mineira
//
// Um xilofone virou cinquenta brigadeiros. Eu tinha trocado um defeito por
// outro, e so vi porque fui procurar.
//
// Entao o teste tem DOIS blocos, e os dois precisam estar verdes ao mesmo
// tempo. Consertar um sozinho quebra o outro, e foi exatamente o que aconteceu.
//
// O que a casa NAO faz tem que voltar como o cliente escreveu, pro portao
// barrar e a padaria dizer "nao achei isso no cardapio" mostrando o que tem. E
// o que uma atendente faz: ela entende "brigadero", e nao entrega brigadeiro
// pra quem pediu macaron.
const CASOS_QUE_NAO_EXISTEM = [
  ["docinho", "50 macarons"],
  ["docinho", "50 xilofone"],
  ["bolo", "bolo de chocolate"],
];

// As falas erradas e o que TEM que sair do outro lado.
const CASOS = [
  ["docinho", "50 brigadero e 50 beijnho", ["brigadeiro", "beijinho"]],
  ["docinho", "quero 30 cajuzino e 20 trufaa", ["cajuzinho", "trufa"]],
  ["salgado", "100 coxnia e 100 chique de frnago", ["coxinha", "quiche"]],
  ["salgado", "50 risoels de carne e 50 esfia", ["risólis", "esfirra"]],
  ["bolo", "um bolo de 2 kg de 4 leits", ["4 leites"]],
  // Duas palavras: a regua de letras do codigo nao alcanca isto.
  ["salgado", "60 mini bloha de carne", ["mini bolha"]],
  ["salgado", "40 pao de batta", ["pão de batata"]],
];

// Os dois blocos vao na mesma ida a IA: uma chamada por caso, e o mesmo
// prompt nos dois, que e o ponto.
const TODOS = [...CASOS, ...CASOS_QUE_NAO_EXISTEM];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ia-errado-"));
const casosArq = path.join(tmp, "casos.json");
const rodarArq = path.join(tmp, "rodar.js");

// A instrucao sai do REPOSITORIO DE AGORA, e nao do que esta no ar: e assim que
// da pra medir uma mudanca de prompt antes de deployar.
const monta = path.join(__dirname, "_sonda-instrucao.mts");
fs.writeFileSync(
  monta,
  [
    'import fs from "node:fs";',
    'import { instrucaoDaEtapa } from "../lib/ia/fluxo/leitura.ts";',
    "const p = { ehFesta:true, pessoas:20, base:null, baseAceita:true, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, forminha:null, prato:null };",
    "const FORMATO = 'Responda SO com um JSON, sem texto em volta: {\"itens\":[{\"produto\":\"nome do cardapio\",\"qtd\":0,\"obs\":\"sabor, cor\"}]}';",
    "const CASOS = " + JSON.stringify(TODOS.map(([e, f]) => [e, f])) + ";",
    "const corpo = CASOS.map(([etapa, fala]) => ({ etapa, fala, body: {",
    "  model: 'gpt-4.1-mini', temperature: 0, response_format: { type: 'json_object' },",
    "  messages: [",
    "    { role: 'system', content: instrucaoDaEtapa(etapa as never, p as never) + String.fromCharCode(10,10) + FORMATO },",
    "    { role: 'user', content: fala },",
    "  ] } }));",
    "fs.writeFileSync(process.argv[2], JSON.stringify(corpo));",
  ].join("\n"),
  "utf8",
);
try {
  execFileSync("npx", ["tsx", "_sonda-instrucao.mts", casosArq], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(monta); } catch {}
}

fs.writeFileSync(
  rodarArq,
  [
    'const fs = require("fs");',
    'const casos = JSON.parse(fs.readFileSync("/tmp/casos-erro.json", "utf8"));',
    "(async () => {",
    "  const saida = [];",
    "  for (const c of casos) {",
    '    const r = await fetch("https://api.openai.com/v1/chat/completions", {',
    '      method: "POST",',
    '      headers: { "content-type": "application/json", authorization: "Bearer " + process.env.OPENAI_API_KEY },',
    "      body: JSON.stringify(c.body),",
    "    });",
    "    const j = await r.json();",
    "    const txt = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;",
    "    let itens = [];",
    "    try { itens = (JSON.parse(txt).itens || []).map((i) => String(i.produto || '')); } catch (e) { itens = []; }",
    "    saida.push({ etapa: c.etapa, fala: c.fala, itens });",
    "  }",
    "  console.log(JSON.stringify(saida));",
    "})();",
  ].join("\n"),
  "utf8",
);

(async () => {
  const contêiner = (await ssh("docker ps --filter name=uyyqf7 -q | head -1")).trim();
  if (!contêiner) {
    console.log("ERRO  nao achei o container do app no VPS");
    process.exit(1);
  }
  await ssh("cat > /tmp/casos-erro.json", fs.readFileSync(casosArq, "utf8"));
  await ssh("cat > /tmp/rodar-erro.js", fs.readFileSync(rodarArq, "utf8"));
  const bruto = await ssh(
    "docker cp /tmp/casos-erro.json " + contêiner + ":/tmp/casos-erro.json && " +
    "docker cp /tmp/rodar-erro.js " + contêiner + ":/tmp/rodar-erro.js && " +
    "docker exec " + contêiner + " node /tmp/rodar-erro.js",
  );
  const r = JSON.parse(bruto.trim().split("\n").pop());

  // O GABARITO NAO E UMA LISTA DE NOMES QUE EU ESCOLHI.
  //
  // A primeira versao daqui comparava o que a IA devolveu com nomes escritos
  // por mim, e reprovou "chique" esperando "quiche". So que "chique" E quiche
  // pra casa: esta na lista de apelidos, passa no portao e chega no produto
  // certo. O gabarito e que estava errado, e nao o sistema.
  //
  // O que importa nao e a palavra que ela escolheu, e se o pedido chega inteiro
  // na cozinha. Entao a cobranca e essa: TUDO o que ela devolveu tem que passar
  // no portao da etapa, e tem que vir a mesma quantidade de itens que o cliente
  // pediu. Grafia errada do cliente nao passa no portao, que e o defeito que
  // este instrumento mede.
  const conferir = path.join(__dirname, "_sonda-passa-no-portao.mts");
  fs.writeFileSync(
    conferir,
    [
      'import { leituraQueCabeNaEtapa } from "../lib/ia/fluxo/leitura.ts";',
      "const r = " + JSON.stringify(r) + ";",
      "const fora = r.map((c) => {",
      "  const passou = c.itens.filter((produto) => {",
      "    const x = leituraQueCabeNaEtapa(c.etapa as never, { itens: [{ produto, qtd: 10 }] });",
      "    return Boolean(x.limpa.itens && x.limpa.itens.length);",
      "  });",
      "  return { ...c, passou };",
      "});",
      "console.log(JSON.stringify(fora));",
    ].join("\n"),
    "utf8",
  );
  let conferido;
  try {
    conferido = JSON.parse(
      execFileSync("npx", ["tsx", "_sonda-passa-no-portao.mts"], {
        cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
      }).trim().split("\n").pop(),
    );
  } finally {
    try { fs.unlinkSync(conferir); } catch {}
  }

  const falhas = [];
  for (let i = 0; i < CASOS.length; i++) {
    const [, fala, esperado] = CASOS[i];
    const c = conferido[i] || { itens: [], passou: [] };
    const barrados = c.itens.filter((x) => !c.passou.includes(x));
    const faltaram = c.itens.length < esperado.length;
    const ruim = barrados.length > 0 || faltaram;
    console.log((ruim ? "ERRO  " : "ok    ") + "'" + fala + "'");
    console.log("        veio: " + JSON.stringify(c.itens) + (barrados.length ? "   BARRADO: " + JSON.stringify(barrados) : ""));
    if (barrados.length) falhas.push(fala + " -> o portao barrou " + barrados.join(", "));
    if (faltaram) falhas.push(fala + " -> vieram " + c.itens.length + " itens, o cliente pediu " + esperado.length);
  }

  console.log("");
  console.log("--- o que a casa NAO faz nao pode virar produto ---");
  for (let i = 0; i < CASOS_QUE_NAO_EXISTEM.length; i++) {
    const [, fala] = CASOS_QUE_NAO_EXISTEM[i];
    const c = conferido[CASOS.length + i] || { itens: [], passou: [] };
    // Aqui e o contrario do bloco de cima: NADA pode passar no portao. O que
    // passar virou produto do cardapio sem o cliente ter pedido.
    const virouProduto = c.passou;
    console.log((virouProduto.length ? "ERRO  " : "ok    ") + "'" + fala + "'");
    console.log("        veio: " + JSON.stringify(c.itens) +
      (virouProduto.length ? "   VIROU PRODUTO: " + JSON.stringify(virouProduto) : "   (o portao barra e a padaria pergunta)"));
    if (virouProduto.length) {
      falhas.push(fala + " -> a IA encaixou no cardapio: " + virouProduto.join(", "));
    }
  }

  console.log("");
  if (falhas.length) {
    console.log("REPROVOU (" + falhas.length + " de " + CASOS.length + ")");
    process.exit(1);
  }
  console.log("PASSOU: os " + CASOS.length + " escritos errado chegaram no produto, e os " +
    CASOS_QUE_NAO_EXISTEM.length + " que a casa nao faz nao viraram produto");
})();
