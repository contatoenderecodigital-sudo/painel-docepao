// A MENSAGEM CHEGA DE PE NO CLIENTE.
//
// Chegou num cliente de verdade em 21/08/2026, mensagem inteira:
//
//   "Se sim, qual sabor: carne, queijo, presunto ou frango?"
//
// A IA tinha escrito certo. TRES guardas minhas, cada uma certa sozinha,
// amputaram a primeira metade:
//
//   1. umaPerguntaSo        guardou so o ULTIMO bloco com "?"
//   2. perguntaQueVale      reabilitou a pendurada quando todas eram penduradas
//   3. textoSemPerguntaJaFeita  apagou a pergunta-mae por ja ter sido feita
//
// Consertar so uma delas nao resolvia: o defeito continuava saindo pelas outras
// duas. Por isso este teste passa o texto pelas TRES e cobra o resultado.
//
// Na mesma medicao, ONZE das quarenta conversas morreram assim: o cliente deu
// item, data, hora, nome e pagamento e recebeu de volta so
// "E pro bolo, quer topo de bolo e papel de arroz?" — o bloco do "Anotei" tinha
// sido deletado junto. Por isso a segunda regra aqui: "Anotei" e "R$" nunca
// somem no corte.
//
// POR QUE ESTE TESTE PRECISOU EXISTIR: as funcoes de tesoura moravam no
// cerebro.ts sem export, e o teste que deveria cobri-las
// (o-resumo-chega-inteiro.cjs) lia o ARQUIVO como string conferindo se um
// comentario ainda estava la. Isso nao testa o que a funcao faz, e foi por isso
// que a mensagem orfa passou pelos 43 testes.
//
// Roda com: node testes/a-mensagem-chega-inteira.cjs
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const nl = String.fromCharCode(10);

// As falas sao reais: saidas do print do cliente e das 40 conversas da medicao.
const CASOS = [
  {
    nome: "o caso do cliente de 21/08: pergunta-mae e pergunta-filha",
    texto: "E o pastel bolha, vai querer?" + nl + nl + "Se sim, qual sabor: carne, queijo, presunto ou frango?",
    falasDela: [],
  },
  {
    nome: "a mesma coisa, com a mae ja perguntada antes",
    texto: "Vai querer esfirra? Se sim, qual sabor: carne, queijo, presunto ou frango?",
    falasDela: ["Vai querer esfirra tambem pra festa?"],
  },
  {
    nome: "o Anotei nao pode sumir junto com o bloco",
    texto: "Anotei o nome Patricia Bonfanti, retirada as 16h, pagamento pix. Confere?" + nl + nl + "E pro bolo, quer topo de bolo e papel de arroz?",
    falasDela: [],
  },
  {
    nome: "o Anotei com dinheiro dentro",
    texto: "Anotei 30 brigadeiros com forminha rosa, R$ 37,50. Ficou certo?" + nl + nl + "Agora, quer que eu veja o bolo tambem?",
    falasDela: [],
  },
  {
    nome: "duas perguntas soltas: aqui o corte E seguro e pode acontecer",
    texto: "Vamos comecar pelos salgados?" + nl + nl + "Prefere fritos ou assados?",
    falasDela: [],
  },
  {
    nome: "uma pergunta so nao se mexe",
    texto: "Ficou assim: 50 coxinha, 50 mini bolha de carne. Qual a cor da forminha?",
    falasDela: [],
  },
  {
    nome: "pedir dado de fechamento nao pode deixar toco",
    texto: "Anotei 50 coxinhas. E o pedido fica no nome de quem? Pode ser assim?",
    falasDela: [],
  },
];

const sonda = path.join(__dirname, "_sonda-inteira.mts");
fs.writeFileSync(
  sonda,
  [
    'import { umaPerguntaSo } from "../lib/ia/cerebro.ts";',
    'import { textoSemPerguntaJaFeita, textoSemPedirDadosDeFechamento, ficouOrfa } from "../lib/ia/guardas.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saida = CASOS.map((c) => {",
    // A CADEIA DE VERDADE, na ordem em que o cerebro roda: umaPerguntaSo
    // primeiro, as guardas de sentenca no fim.
    "  let t = umaPerguntaSo(c.texto);",
    "  t = textoSemPedirDadosDeFechamento(t);",
    "  t = textoSemPerguntaJaFeita(t, c.falasDela);",
    "  return { nome: c.nome, antes: c.texto, depois: t, orfa: ficouOrfa(t) };",
    "});",
    "console.log(JSON.stringify(saida));",
  ].join(nl),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-inteira.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const resultados = JSON.parse(bruto.trim().split(nl).pop());
for (const r of resultados) console.log("   [" + r.nome + "]" + nl + "   -> " + JSON.stringify(r.depois));
console.log("");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

// O que o cliente PRECISA ler: a confirmacao de que o pedido existe e quanto custa.
const naoPodeSumir = (t) =>
  (String(t).match(/[^.!?\n]*(?:anotei|R\$\s?[0-9])[^.!?\n]*/gi) || []).map((f) => f.trim()).filter(Boolean);

console.log("== nenhuma mensagem sai pendurada ==");
for (const r of resultados) {
  conferir(!r.orfa, r.nome, "saiu: " + JSON.stringify(r.depois));
}

console.log("");
console.log("== o que o cliente precisa ler nunca some no corte ==");
for (const r of resultados) {
  const perdidos = naoPodeSumir(r.antes).filter((p) => !r.depois.includes(p));
  conferir(!perdidos.length, r.nome, "sumiu do texto: " + JSON.stringify(perdidos[0] || ""));
}

console.log("");
console.log("== o corte seguro continua acontecendo ==");
const duasSoltas = resultados.find((r) => r.nome.includes("aqui o corte E seguro"));
conferir(
  duasSoltas && (duasSoltas.depois.match(/\?/g) || []).length === 1,
  "duas perguntas soltas viram uma so",
  "saiu: " + JSON.stringify(duasSoltas && duasSoltas.depois),
);
const umaSo = resultados.find((r) => r.nome.includes("uma pergunta so"));
conferir(
  umaSo && umaSo.depois.trim() === umaSo.antes.trim(),
  "texto com uma pergunta so passa intacto",
  "mexeram nele: " + JSON.stringify(umaSo && umaSo.depois),
);

console.log("");
console.log(erros === 0 ? "A MENSAGEM CHEGA INTEIRA" : erros + " FALHA(S): mensagem quebrada chegaria no cliente");
process.exit(erros === 0 ? 0 : 1);
