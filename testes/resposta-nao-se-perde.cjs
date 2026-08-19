// RESPOSTA DADA NAO PODE SER PERGUNTADA DE NOVO.
//
// Teste com clientes ao vivo, 19/08/2026. A cliente respondeu "forminha rosa" e
// a pergunta voltou mais TRES vezes. Numa delas a Dora chegou a escrever:
//
//   "Agora so falta a cor da forminha dos docinhos brigadeiro e beijinho, que
//    voce ja falou que quer rosa. Qual cor prefere?"
//
// Ou seja: ela SABIA a resposta e perguntou assim mesmo, porque o lembrete
// mandava. O codigo ja detectava a cor dentro da observacao, mas quem tinha que
// ESCREVER a cor la era ela, e ela nao escrevia. Estado que depende da boa
// vontade do modelo nao e estado.
//
// Agora o codigo aproveita a resposta sozinho. O risco era o oposto: sair
// gravando cor toda vez que aparecesse uma palavra de cor na conversa, e
// "chocolate branco" virar forminha branca. Por isso so vale quando a pergunta
// ANTERIOR dela foi sobre forminha.
//
// Roda com: node testes/resposta-nao-se-perde.cjs
const fs = require("fs");
const fonte = fs.readFileSync("lib/ia/cerebro.ts", "utf8");

// A regra de cor e a MESMA do codigo, lida do arquivo: copia digitada aqui
// poderia divergir sem ninguem notar.
const linha = fonte.split("\n").find((l) => l.trim().startsWith("/amarel|azul"));
if (!linha) throw new Error("nao achei a regex de cores no cerebro.ts");
const CORES_FORMINHA = eval(linha.trim().replace(/;$/, ""));

// O mesmo gatilho do codigo: so aproveita se a pergunta anterior foi de forminha.
function aproveita(falaDela, falaDoCliente) {
  if (!/forminha/i.test(String(falaDela))) return null;
  const cor = String(falaDoCliente).match(CORES_FORMINHA)?.[0];
  if (!cor) return null;
  return String(falaDoCliente).match(new RegExp("[a-zà-ú]*" + cor + "[a-zà-ú]*", "i"))?.[0] ?? cor;
}

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== a cor respondida tem que ser aproveitada ==");
const PERGUNTA = "Agora so falta a cor da forminha dos docinhos. Qual cor prefere?";
for (const [resposta, esperado] of [
  ["rosa", "rosa"],
  ["forminha rosa", "rosa"],
  ["pode ser dourada", "dourada"],
  ["QUERO BRANCA", "BRANCA"],
  ["azul royal", "azul"],
  ["vermelho mesmo", "vermelho"],
]) {
  const cor = aproveita(PERGUNTA, resposta);
  conferir(
    cor && cor.toLowerCase() === esperado.toLowerCase(),
    'de "' + resposta + '" tira "' + esperado + '"',
    "tirou: " + cor,
  );
}

console.log("");
console.log("== palavra de cor FORA do contexto nao pode virar forminha ==");
// Este e o lado que quebra venda se eu errar: gravar cor que ninguem pediu.
for (const [falaDela, resposta] of [
  ["Qual sabor de bolo voce quer?", "chocolate branco com morango"],
  ["Quer topo de bolo?", "quero, tema princesa, com detalhe dourado"],
  ["Qual o sabor do pao de lo?", "pao de lo branco"],
  ["Quantos salgados?", "100, e o bolo pode ser de chocolate preto"],
  ["Confirma o pedido?", "isso, o vinho branco eu levo depois"],
]) {
  const cor = aproveita(falaDela, resposta);
  conferir(cor === null, 'nao grava cor em "' + resposta.slice(0, 40) + '"', "gravou: " + cor);
}

console.log("");
console.log("== sem cor nenhuma na resposta, nao inventa ==");
for (const resposta of ["tanto faz", "pode escolher voce", "nao sei ainda", "qualquer uma"]) {
  const cor = aproveita(PERGUNTA, resposta);
  conferir(cor === null, 'nao inventa cor em "' + resposta + '"', "inventou: " + cor);
}

console.log("");
console.log(erros === 0 ? "RESPOSTA DADA NAO SE PERDE" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
