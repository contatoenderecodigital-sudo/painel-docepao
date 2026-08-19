// O RESUMO QUE ELA FALA TEM QUE SER O PEDIDO QUE ESTA GRAVADO.
//
// Teste com clientes ao vivo, 19/08/2026. Ela recitou "1 quilo de torta doce de
// morango" com total de R$ 131,40 enquanto o registro tinha SO coxinha e
// brigadeiro. Antes disso tinha dito "esta certo, so tem uma torta doce de
// morango no pedido agora" num momento em que nao havia torta nenhuma.
//
// Cliente que confia no resumo fecha um pedido que nao existe, e a comanda sai
// diferente do que ele leu no celular.
//
// O risco do conserto e o oposto: sair refazendo resumo toda vez que aparecer
// um "R$" na conversa. Responder "a torta doce sai R$ 33,90 o quilo" pra quem
// perguntou preco NAO e resumo e nao pode ser mexido. Por isso o gatilho e a
// linha de TOTAL, e o teste cobra os dois lados.
//
// Roda com: node testes/resumo-bate-com-o-pedido.cjs
const fs = require("fs");
const fonte = fs.readFileSync("lib/ia/cerebro.ts", "utf8");

function extrair(assinatura, ate) {
  const ini = fonte.indexOf(assinatura);
  const fim = fonte.indexOf(ate, ini);
  if (ini < 0 || fim < 0) throw new Error("nao achei no arquivo: " + assinatura);
  return fonte.slice(ini, fim);
}

const semTipos = (t) =>
  t
    .replace(/export function /g, "function ")
    .replace(/export const /g, "const ")
    .replace(/\(texto: string, itens: \{ produto\?: string \}\[\]\)/g, "(texto, itens)")
    .replace(/\(([a-zA-Z]+): [A-Za-z<>[\]| ]+\)/g, "($1)")
    .replace(/(const [a-zA-Z]+): [A-Za-z<>[\]| ]+ =/g, "$1 =")
    .replace(/\): [A-Za-z<>[\]| ]+ =>/g, ") =>")
    .replace(/\): [A-Za-z<>[\]| ]+ \{/g, ") {");

const corpo =
  semTipos(extrair("const semAcMin =", "// O cliente disse explicitamente")) +
  semTipos(extrair("export function ehResumoDePedido(", "// ENDERECO DITO QUE NAO E O DA PADARIA"));

const criar = new Function(
  corpo + "\nreturn { ehResumoDePedido, citadosForaDoPedido, faltandoNoResumo };",
);
const { ehResumoDePedido, citadosForaDoPedido, faltandoNoResumo } = criar();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

// O pedido que a Rodrigo tinha DE VERDADE no banco naquele momento.
const PEDIDO_REAL = [
  { produto: "coxinha", qtd: 45 },
  { produto: "brigadeiro", qtd: 30 },
];

console.log("== o caso real que motivou a guarda ==");
const RESUMO_FALSO = [
  "Seu pedido ficou assim:",
  "45x coxinha: R$ 45,00",
  "30x brigadeiro: R$ 37,50",
  "1 kg torta doce (morango): R$ 33,90",
  "*Total: R$ 131,40*",
].join("\n");

conferir(ehResumoDePedido(RESUMO_FALSO), "reconhece que aquilo era um resumo", "nao viu a linha de total");
const sobrando = citadosForaDoPedido(RESUMO_FALSO, PEDIDO_REAL);
conferir(
  sobrando.some((l) => /torta doce/i.test(l)),
  "pega a torta doce que ela citou e nao estava no pedido",
  "passou batido: " + JSON.stringify(sobrando),
);

console.log("");
console.log("== item gravado que ela ESQUECEU de falar ==");
const RESUMO_INCOMPLETO = ["45x coxinha: R$ 45,00", "*Total: R$ 45,00*"].join("\n");
const faltando = faltandoNoResumo(RESUMO_INCOMPLETO, PEDIDO_REAL);
conferir(
  faltando.some((p) => /brigadeiro/i.test(p)),
  "pega o brigadeiro que estava gravado e sumiu do resumo",
  "passou batido: " + JSON.stringify(faltando),
);

console.log("");
console.log("== resumo CERTO nao pode ser mexido ==");
const RESUMO_CERTO = [
  "Seu pedido ficou assim:",
  "45x coxinha: R$ 45,00",
  "30x brigadeiro: R$ 37,50",
  "*Total: R$ 82,50*",
].join("\n");
conferir(citadosForaDoPedido(RESUMO_CERTO, PEDIDO_REAL).length === 0, "nao acusa item sobrando", "acusou errado");
conferir(faltandoNoResumo(RESUMO_CERTO, PEDIDO_REAL).length === 0, "nao acusa item faltando", "acusou errado");

console.log("");
console.log("== resposta de PRECO nao e resumo e nao pode ser mexida ==");
// Este e o lado que quebra o atendimento se eu errar.
for (const frase of [
  "A torta doce sai R$ 33,90 o quilo",
  "Salgado frito sai R$ 1,00 cada, o assado R$ 1,25",
  "O bolo de festa vai de R$ 46,90 a R$ 55,90 o quilo, dependendo do sabor",
  "A pizza inteira custa R$ 120,00 e a meia R$ 60,00",
]) {
  conferir(!ehResumoDePedido(frase), 'nao trata como resumo: "' + frase.slice(0, 45) + '"', "ia refazer sem precisar");
  conferir(citadosForaDoPedido(frase, PEDIDO_REAL).length === 0, "  e nao acusa nada nela", "acusou");
}

console.log("");
console.log("== pedido vazio nao gera acusacao ==");
conferir(citadosForaDoPedido(RESUMO_FALSO, []).length >= 0, "nao quebra com pedido vazio", "estourou");
conferir(faltandoNoResumo(RESUMO_CERTO, []).length === 0, "sem itens gravados, nada falta", "acusou do nada");

console.log("");
console.log(erros === 0 ? "O RESUMO BATE COM O PEDIDO" : erros + " FALHA(S) NO RESUMO");
process.exit(erros === 0 ? 0 : 1);
