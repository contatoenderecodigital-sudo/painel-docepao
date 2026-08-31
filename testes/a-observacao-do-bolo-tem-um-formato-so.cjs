// A OBSERVACAO DO BOLO: IDA E VOLTA.
//
// Este teste existe por causa de um pedido real, o de 30/08/2026 as 23h. Uma
// festa de 20 pessoas, fechada e impressa, com tres estragos que vieram todos
// da mesma raiz: nao havia um formato de observacao, havia tres leituras.
//
//   guardado:   "Gabriel Lucas | 12 anos | Topo: tema foto de referencia,
//                Gabriel Lucas, 12 anos"
//
//   a cozinha:  imprimiu tres linhas, duas repetidas, porque o cupom corta na
//               virgula e o texto trazia o nome duas vezes
//   o painel:   "Nome do aniversariante" VAZIO, porque a tela procura "nome X"
//               e o fluxo escreveu o nome pelado
//   a equipe:   a caixa "papel de arroz" DESMARCADA, num pedido que tinha a
//               linha do papel cobrada em R$ 12,00
//
// O QUE ESTE TESTE MEDE, e o motivo de ser ida e volta: escrever e ler sao
// duas funcoes que precisam concordar. Testar so uma delas passa verde com o
// sistema quebrado, que foi exatamente o que aconteceu antes.
//
// Roda com: node testes/a-observacao-do-bolo-tem-um-formato-so.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// IDA E VOLTA: escrever e ler de volta tem que devolver os mesmos campos.
const VOLTAS = [
  {
    nome: "a festa do Gabriel, o pedido que quebrou",
    peca: { tema: "foto de referência", nome: "Gabriel Lucas", idade: "12", topo: true, papelDeArroz: false, embalagem: null },
  },
  { nome: "so o tema", peca: { tema: "homem aranha", topo: false, papelDeArroz: false, embalagem: null } },
  { nome: "topo e papel juntos", peca: { tema: "jardim", nome: "Alice", idade: "5", topo: true, papelDeArroz: true, embalagem: null } },
  { nome: "com embalagem", peca: { nome: "Theo", idade: "8", topo: false, papelDeArroz: false, embalagem: "caixa com tampa" } },
  { nome: "prato aberto", peca: { tema: "futebol", topo: true, papelDeArroz: false, embalagem: "prato aberto" } },
  { nome: "frase ditada pelo cliente", peca: { tema: "flores", escrito: "Parabéns vovó", topo: true, papelDeArroz: false, embalagem: null } },
  { nome: "nada preenchido", peca: { topo: false, papelDeArroz: false, embalagem: null } },
];

// O QUE A TELA E A COZINHA PRECISAM ENXERGAR no texto escrito.
const ESCRITAS = [
  {
    nome: "o nome sai com a palavra nome, senao o campo da equipe fica vazio",
    peca: { nome: "Gabriel Lucas", idade: "12" },
    tem: ["nome Gabriel Lucas", "12 anos"],
    naoTem: ["|"],
  },
  {
    nome: "o nome nao aparece duas vezes, que foi o que a cozinha imprimiu",
    peca: { tema: "foto de referência", nome: "Gabriel Lucas", idade: "12", topo: true },
    umaVezSo: "Gabriel Lucas",
  },
  {
    nome: "a frase ditada manda: nome e idade nao vao pra peca junto",
    peca: { escrito: "Parabéns vovó", nome: "Gabriel Lucas", idade: "12" },
    tem: ["escrito: Parabéns vovó"],
    naoTem: ["nome Gabriel Lucas", "12 anos"],
  },
  {
    nome: "topo e papel saem com o nome que a tela procura",
    peca: { topo: true, papelDeArroz: true },
    tem: ["topo de bolo", "papel de arroz"],
  },
];

// O QUE PRECISA SER LIDO DE TEXTO QUE JA ESTA GRAVADO NO BANCO.
const LEITURAS = [
  {
    nome: "o pedido de 30/08, do jeito que ficou guardado",
    texto: "Gabriel Lucas | 12 anos | Topo: tema foto de referência, Gabriel Lucas, 12 anos",
    espera: { idade: "12", topo: true, tema: "foto de referência" },
  },
  {
    // ESTE E O TEXTO QUE O BANCO GUARDA DE VERDADE, e nao um exemplo inventado.
    //
    // Copiado do pedido de festa fechado em 31/08/2026. O fluxo escreve com
    // virgula, e a gravacao rejunta os pedacos com " | ": quem le tem que
    // aguentar os dois, porque os dois existem gravados.
    //
    // O painel tinha expressoes proprias que cortavam so na virgula, e mostrava
    // o campo do aniversariante assim: "Gabriel Lucas | 12 anos | topo de bolo".
    nome: "o texto do jeito que o banco guarda, com barra",
    texto: "tema futebol | nome Gabriel Lucas | 12 anos | topo de bolo",
    espera: { tema: "futebol", nome: "Gabriel Lucas", idade: "12", topo: true },
  },
  {
    nome: "o formato antigo com barra continua sendo lido",
    texto: "tema jardim | nome Alice | 5 anos | papel de arroz",
    espera: { tema: "jardim", nome: "Alice", idade: "5", papelDeArroz: true },
  },
  {
    nome: "sem topo NAO marca o topo",
    texto: "tema flores, sem topo, papel de arroz",
    espera: { tema: "flores", topo: false, papelDeArroz: true },
  },
  {
    nome: "sem papel de arroz NAO marca o papel",
    texto: "tema flores, topo de bolo, sem papel de arroz",
    espera: { tema: "flores", topo: true, papelDeArroz: false },
  },
  {
    nome: "o que a IA escreveu e nao e campo nenhum nao se perde",
    texto: "tema unicórnio, massa branca, topo de bolo",
    esperaResto: ["massa branca"],
  },
];

const sonda = path.join(__dirname, "_sonda-obs-do-bolo.mts");
fs.writeFileSync(
  sonda,
  [
    'import { escreverObs, lerObs } from "../lib/banco/obs-do-bolo.ts";',
    "const VOLTAS = " + JSON.stringify(VOLTAS) + ";",
    "const ESCRITAS = " + JSON.stringify(ESCRITAS) + ";",
    "const LEITURAS = " + JSON.stringify(LEITURAS) + ";",
    "const saiu: unknown[] = [];",
    "for (const v of VOLTAS) {",
    "  const texto = escreverObs(v.peca as never);",
    "  saiu.push({ tipo: 'volta', texto, lido: lerObs(texto) });",
    "}",
    "for (const e of ESCRITAS) saiu.push({ tipo: 'escrita', texto: escreverObs(e.peca as never) });",
    "for (const l of LEITURAS) saiu.push({ tipo: 'leitura', lido: lerObs(l.texto) });",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-obs-do-bolo.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
const falha = (msg) => { console.log("ERRO  " + msg); erros++; };
console.log("== a observacao do bolo tem um formato so ==");

let n = 0;
for (const v of VOLTAS) {
  const r = saiu[n++];
  const campos = ["tema", "nome", "idade", "escrito", "topo", "papelDeArroz", "embalagem"];
  const perdeu = campos.filter((c) => {
    const antes = v.peca[c] ?? (c === "topo" || c === "papelDeArroz" ? false : null);
    const depois = r.lido[c] ?? (c === "topo" || c === "papelDeArroz" ? false : null);
    return JSON.stringify(antes) !== JSON.stringify(depois);
  });
  if (perdeu.length) {
    falha("ida e volta perdeu " + perdeu.join(", ") + " em '" + v.nome + "'  ->  escreveu \"" + r.texto + "\", leu " + JSON.stringify(r.lido));
  } else {
    console.log("ok    ida e volta: " + v.nome);
  }
}

for (const e of ESCRITAS) {
  const r = saiu[n++];
  const t = r.texto;
  let ok = true;
  for (const parte of e.tem ?? []) {
    if (!t.includes(parte)) { falha(e.nome + "  ->  faltou \"" + parte + "\" em \"" + t + "\""); ok = false; }
  }
  for (const parte of e.naoTem ?? []) {
    if (t.includes(parte)) { falha(e.nome + "  ->  nao podia ter \"" + parte + "\" em \"" + t + "\""); ok = false; }
  }
  if (e.umaVezSo) {
    const vezes = t.split(e.umaVezSo).length - 1;
    if (vezes !== 1) { falha(e.nome + "  ->  \"" + e.umaVezSo + "\" apareceu " + vezes + " vezes em \"" + t + "\""); ok = false; }
  }
  if (ok) console.log("ok    escrita: " + e.nome);
}

for (const l of LEITURAS) {
  const r = saiu[n++];
  let ok = true;
  for (const [campo, valor] of Object.entries(l.espera ?? {})) {
    const veio = r.lido[campo] ?? (typeof valor === "boolean" ? false : null);
    if (JSON.stringify(veio) !== JSON.stringify(valor)) {
      falha(l.nome + "  ->  " + campo + " veio " + JSON.stringify(veio) + ", esperado " + JSON.stringify(valor));
      ok = false;
    }
  }
  for (const parte of l.esperaResto ?? []) {
    if (!(r.lido.resto ?? []).includes(parte)) {
      falha(l.nome + "  ->  perdeu \"" + parte + "\"; o que a IA escreveu nao pode sumir");
      ok = false;
    }
  }
  if (ok) console.log("ok    leitura: " + l.nome);
}

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
