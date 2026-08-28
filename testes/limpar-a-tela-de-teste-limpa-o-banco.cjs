// LIMPAR A TELA DE TESTE LIMPA O BANCO TAMBEM.
//
// POR QUE ISTO EXISTE
//
// O `/testar` nao guarda a conversa: o historico vive no navegador. Mas o PEDIDO
// EM MONTAGEM vive no banco, e o cerebro le do banco. Entao zerar so a tela
// deixa o pedido da conversa anterior de pe.
//
// O botao "limpar" fazia exatamente isso: `setMensagens([])` e mais tres
// `setState`. O dono via a tela vazia e a IA continuava com o pedido velho
// montado, respondendo em cima dele.
//
// A ROTA JA SABIA LIMPAR, E NINGUEM PEDIA
//
// O `app/api/testar-ia/route.ts` tem o trecho que apaga a montagem e o pedido da
// rodada anterior, com o motivo escrito:
//
//     "Cada cenario do teste comeca do zero: sem isso o pedido de um vaza no
//      outro e o resultado nao quer dizer nada."
//
// Ele so roda com `reiniciar: true` no corpo. Medido em 28/08/2026: quem mandava
// esse sinal eram APENAS as baterias automatizadas (`qa-painel.cjs` e
// `qa-conversa.cjs`). A tela nunca mandou.
//
// E a pergunta "alguem LE este campo?" ao contrario: alguem ESCREVE este campo?
//
// A ORDEM IMPORTA, E POR ISSO O SINAL VIAJA COM A PROXIMA MENSAGEM
//
// A rota recusa corpo sem mensagem ANTES de chegar no trecho que limpa. Entao
// mandar so `{ reiniciar: true }` devolveria erro e nao limparia nada. O botao
// marca, e a proxima mensagem leva o sinal, que e como as baterias ja fazem.
//
// O QUE ELE COBRA
//
//   1. o botao limpar marca que precisa reiniciar
//   2. a tela manda esse sinal no corpo do pedido pra rota
//   3. o sinal vale por UMA mensagem: a segunda nao reinicia de novo
//   4. a rota continua tendo o trecho que limpa, e continua exigindo o sinal
//
// Roda com: node testes/limpar-a-tela-de-teste-limpa-o-banco.cjs
const path = require("node:path");
const fs = require("node:fs");

const raiz = path.join(__dirname, "..");

// Comentario nao conta como codigo: ele e cortado antes. O `\r` sai primeiro
// porque sem a flag `m` o `$` quer dizer fim da STRING, e a linha termina em
// `\r\n` (foi o defeito que desligou cinco detectores deste repositorio).
const semComentario = (...p) =>
  fs
    .readFileSync(path.join(raiz, ...p), "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
    .join("\n");

const tela = semComentario("app", "(painel)", "testar", "page.tsx");
const rota = semComentario("app", "api", "testar-ia", "route.ts");

const falhas = [];

// 1. o botao marca
const limpar = tela.slice(tela.indexOf("function limpar()"), tela.indexOf("function limpar()") + 400);
if (!/setPrecisaReiniciar\(true\)/.test(limpar)) {
  falhas.push(
    "o botao limpar nao marca mais o reinicio: a tela zera e o pedido da " +
      "conversa anterior continua no banco, e a IA responde em cima dele",
  );
}

// 2. a tela manda o sinal
if (!/reiniciar: reiniciarAgora/.test(tela)) {
  falhas.push("a tela parou de mandar o sinal `reiniciar` pra rota");
}

// 3. o sinal vale por UMA mensagem
if (!/setPrecisaReiniciar\(false\)/.test(tela)) {
  falhas.push(
    "a tela nao desmarca o reinicio depois de usar: toda mensagem passaria a " +
      "apagar o pedido, e a conversa nunca avancaria",
  );
}
const marcaAntes = tela.indexOf("const reiniciarAgora = precisaReiniciar");
const desmarca = tela.indexOf("setPrecisaReiniciar(false)");
if (marcaAntes >= 0 && desmarca >= 0 && desmarca < marcaAntes) {
  falhas.push("a tela desmarca o reinicio ANTES de guardar o valor: o sinal se perde");
}

// 4. a rota continua sabendo limpar, e continua exigindo o sinal
if (!/corpo\?\.reiniciar/.test(rota)) {
  falhas.push("a rota parou de olhar o sinal `reiniciar`");
}
if (!/limparMontagem\(/.test(rota)) {
  falhas.push("a rota parou de limpar a montagem no reinicio");
}
if (!/delete from pedidos/i.test(rota)) {
  falhas.push("a rota parou de apagar o pedido da rodada anterior no reinicio");
}

console.log("Conferidos: app/(painel)/testar/page.tsx e app/api/testar-ia/route.ts");
console.log("");

if (falhas.length) {
  console.log("ERRO  limpar a tela de teste deixa o pedido velho no banco (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o botao limpar zera a tela E o pedido, e so na primeira mensagem");
console.log("");
console.log("PASSOU");
