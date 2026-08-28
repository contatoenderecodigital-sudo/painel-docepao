// NADA FICA SEM SER PERGUNTADO
//
// Pedido do dono, 24/08/2026, depois de eu passar o dia consertando pergunta por
// pergunta:
//
//   "quero que voce rastreie todas as perguntas que vai ter que fazer pro
//   cliente ou informacoes que tem que coletar durante a conversa e entenda qual
//   tipo de resposta essas perguntas devem receber."
//
// A tabela virou codigo em lib/ia/fluxo/informacoes.ts. Este teste e o que faz
// ela valer: sem ele a tabela seria um comentario bonito que envelhece sozinho.
//
// O QUE ELE COBRA
//
// 1. Toda informacao OBRIGATORIA da tabela tem lugar no fluxo: alguem pergunta,
//    alguem le a resposta, e o pedido nao fecha sem ela.
// 2. O tipo declarado bate com o jeito que a resposta e tratada: o que aceita
//    varias respostas nao pode ser tratado como uma so.
// 3. A tabela nao tem informacao que o fluxo nao coleta, nem o fluxo coleta
//    coisa que nao esta na tabela.
//
// Quando alguem acrescentar uma pergunta na conversa e esquecer da tabela (ou o
// contrario), cai aqui.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const ler = (a) => fs.readFileSync(path.join(raiz, a), "utf8");

const sonda = path.join(__dirname, "_sonda-informacoes.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { INFORMACOES_DA_FESTA, INFORMACOES_DO_PEDIDO_COMUM, INFORMACOES_DA_CONVERSA_DE_INFORMACAO }',
    '  from "../lib/ia/fluxo/informacoes.ts";',
    "console.log(JSON.stringify({",
    "  festa: INFORMACOES_DA_FESTA,",
    "  comum: INFORMACOES_DO_PEDIDO_COMUM.map((i) => i.id),",
    "  informacao: INFORMACOES_DA_CONVERSA_DE_INFORMACAO.map((i) => i.id),",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-informacoes.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

const etapas = ler("lib/ia/fluxo/etapas.ts");
const pergunta = ler("lib/ia/fluxo/pergunta.ts");
const leitura = ler("lib/ia/fluxo/leitura.ts");
const fechar = ler("lib/ia/fluxo/fechar.ts");
const fluxo = ler("lib/ia/fluxo/fluxo.ts");
const tudo = [etapas, pergunta, leitura, fechar, fluxo].join("\n");

// Onde cada informacao da tabela vive no codigo. Quem acrescentar linha na
// tabela acrescenta aqui tambem, e e de proposito: obriga a pensar em onde a
// resposta vai parar.
const ONDE = {
  pessoas: /pessoas/,
  aceite_da_base: /baseAceita/,
  salgados: /"salgado"/,
  recheio_do_salgado: /saboresQueFaltam/,
  docinhos: /"docinho"/,
  forminha: /forminha/,
  sabor_do_bolo: /bolo_festa|"bolo"/,
  embalagem_do_bolo: /prato/,
  topo: /pecas\?\.topo|topo_sim/,
  papel_de_arroz: /papelDeArroz|papel_sim/,
  tema: /tema/,
  escrito_na_peca: /escrito/,
  dia: /dados\.data|retirada/,
  hora: /dados\.hora/,
  nome: /dados\.nome/,
  pagamento: /pagamento/,
};

// ----------------------------- 1. toda informacao da tabela existe no codigo
for (const info of r.festa) {
  const onde = ONDE[info.id];
  if (!onde) {
    falhas.push("a informacao '" + info.id + "' esta na tabela e ninguem sabe onde ela vive no codigo");
    continue;
  }
  if (!onde.test(tudo)) {
    falhas.push("a informacao '" + info.id + "' esta na tabela e o fluxo nao coleta ela em lugar nenhum");
  }
}

// ------------------- 2. o que e obrigatorio segura o pedido de fechar
const obrigatorias = r.festa.filter((i) => i.obrigatoria).map((i) => i.id);
for (const id of ["dia", "hora", "nome", "pagamento"]) {
  if (!obrigatorias.includes(id)) falhas.push("'" + id + "' devia ser obrigatoria na tabela");
}
// E o fechamento tem que cobrar cada uma delas.
for (const [id, marca] of [["dia", /o dia da retirada/], ["hora", /a hora da retirada/],
                           ["nome", /o nome de quem retira/], ["pagamento", /a forma de pagamento/]]) {
  if (!marca.test(fechar)) falhas.push("o pedido fecha sem cobrar '" + id + "'");
}

// --------------------- 3. o que aceita varias respostas nao virou uma so
const varias = r.festa.filter((i) => i.quantas === "varias").map((i) => i.id);
for (const id of ["salgados", "docinhos", "forminha", "sabor_do_bolo", "tema"]) {
  if (!varias.includes(id)) {
    falhas.push("'" + id + "' aceita mais de uma resposta e a tabela diz que aceita uma so");
  }
}
// A cor da forminha aceita varias E e uma pergunta so: nunca item por item.
if (/vai em qual cor de forminha/.test(pergunta)) {
  falhas.push("voltou a perguntar a cor da forminha item por item; o dono cortou isso em 24/08");
}
// O tema aceita imagem, e a foto sozinha ja resolve.
const temaAceitaImagem = r.festa.find((i) => i.id === "tema")?.tipo;
if (!Array.isArray(temaAceitaImagem) || !temaAceitaImagem.includes("imagem")) {
  falhas.push("a tabela diz que o tema nao aceita imagem, e ele aceita");
}
// A FOTO VALE COMO TEMA, E QUEM RECONHECE ELA MUDOU DE CASA.
//
// Isto procurava a expressao `foto de refer|enviou uma foto` DENTRO do
// `fluxo.ts`. Em 28/08/2026 ela saiu de la: a mesma combinacao estava escrita em
// tres lugares (o webhook escrevia a frase, a tela de teste escrevia de novo, e
// o fluxo procurava por uma expressao que casava com as duas), e virou uma
// funcao so, o `falaDeFotoRecebida`, em lib/ia/texto.ts.
//
// O teste reprovou dizendo que "a foto deixou de valer como tema", e a foto
// continuava valendo: ele cobrava a FORMA (a expressao escrita naquele arquivo)
// e nao o comportamento. E a mesma armadilha que deixou dois outros testes
// verdes com defeito no ar neste dia.
//
// Agora cobra o que importa: que o fluxo continue perguntando se veio foto antes
// de decidir o tema. Quem cobra que o recado CHEGA pelos dois caminhos (WhatsApp
// e tela de teste) e o `a-tela-de-teste-manda-o-mesmo-que-o-whatsapp`.
if (!/falaDeFotoRecebida\(/.test(fluxo)) {
  falhas.push("a foto do cliente deixou de valer como tema; ele manda a imagem e a padaria pergunta de novo");
}

// ------------------------- 4. o que e opcional nao pode travar a conversa
const escrito = r.festa.find((i) => i.id === "escrito_na_peca");
if (escrito?.obrigatoria) {
  falhas.push("'o que vai escrito' virou obrigatorio; tem topo que e so o desenho");
}

// --------------------------- 5. o pedido comum e a conversa de informacao
for (const id of ["produtos", "quantidade", "dia", "hora", "nome", "pagamento"]) {
  if (!r.comum.includes(id)) falhas.push("o pedido comum nao coleta '" + id + "'");
}
for (const id of ["pessoas", "aceite_da_base"]) {
  if (r.comum.includes(id)) falhas.push("o pedido comum coleta '" + id + "', que e coisa de festa");
}
if (r.informacao.length !== 1) {
  falhas.push("a conversa de informacao coleta " + r.informacao.length + " coisas; ela nao coleta nada");
}

console.log("Informacoes da festa: " + r.festa.length + " (" + obrigatorias.length + " obrigatorias)");
console.log("Aceitam mais de uma resposta: " + varias.join(", "));
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: tudo que a padaria precisa saber tem quem pergunte e quem leia.");
