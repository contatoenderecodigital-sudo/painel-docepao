// O RESUMO DO PEDIDO CHEGA INTEIRO NO CLIENTE
//
// Caso real de 21/08/2026, festa de 5 anos de R$ 543,00. O cliente recebeu:
//
//   *Pedido recebido*
//   *Nome:* Amanda
//   ...
//   Seu pedido
//   .......................................................
//   *Total: R$ 543,00*
//
// Os dois pontilhados colados e nenhuma linha entre eles: um total de R$ 543,00
// num pedido de onze itens, sem dizer de que. A cadeia foi esta:
//
//   1. o codigo refez o resumo certo (11 linhas, total 543)
//   2. linha de item nao termina em ponto ("R$ 50,00" acaba em virgula), entao
//      as onze viraram UMA frase pra guarda que troca lista por cardapio
//   3. cinco nomes de salgado na mesma frase = "lista de cardapio" pra ela
//   4. nenhuma peca ia ser enviada, entao a frase "te mandei o cardapio" foi
//      removida por outra guarda
//
// Quatro guardas minhas, todas certas sozinhas, e o cliente sem o pedido.
//
// Este teste passa o resumo por TODAS as guardas de texto e cobra que nenhuma
// linha de dinheiro se perca. Guarda nova que mexer no resumo cai aqui.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..");

const nl = String.fromCharCode(10);
const RESUMO = [
  "*Pedido recebido*",
  "*Nome:* Amanda",
  "*Forma de pagamento:* pix",
  "*Retirada:* 30/08/2026 às 15:00",
  "*Obs:* bolo tema homem aranha, nome Theo, 5 anos",
  "A equipe vai te informar o valor do topo.",
  "Já passei pra nossa equipe. Assim que confirmarem, eu te aviso por aqui.",
  "Seu pedido",
  "............................",
  "50x coxinha: R$ 50,00",
  "50x mini bolha (carne): R$ 50,00",
  "50x risólis (carne): R$ 50,00",
  "50x bolinha de queijo: R$ 50,00",
  "50x croquete: R$ 50,00",
  "32x brigadeiro (forminha azul): R$ 40,00",
  "31x beijinho (forminha azul): R$ 38,75",
  "2,5 kg bolo bombom (tema homem aranha): R$ 124,75",
  "1x papel de arroz: R$ 12,00",
  "............................",
  "*Total: R$ 543,00*",
].join(nl);

const sonda = path.join(__dirname, "_sonda-resumo.mts");
fs.writeFileSync(
  sonda,
  [
    'import * as g from "../lib/ia/guardas.ts";',
    "const RESUMO = " + JSON.stringify(RESUMO) + ";",
    'const dela = ["Ficou assim: 50 coxinha, 50 mini bolha de carne. Qual a cor da forminha?"];',
    "const passos: [string, string][] = [",
    '  ["pergunta de hora", g.textoSemPerguntaDeHora(RESUMO)],',
    '  ["pergunta de nome", g.textoSemPerguntaDeNome(RESUMO)],',
    '  ["dados de fechamento", g.textoSemPedirDadosDeFechamento(RESUMO)],',
    '  ["pergunta repetida", g.textoSemPerguntaJaFeita(RESUMO, dela)],',
    '  ["valor do topo", g.textoSemValorDoTopo(RESUMO)],',
    "];",
    "console.log(JSON.stringify(passos));",
  ].join(nl),
  "utf8",
);

let saida;
try {
  saida = execFileSync("npx", ["tsx", "_sonda-resumo.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const passos = JSON.parse(saida.trim().split(nl).pop());
const linhasDeDinheiro = RESUMO.split(nl).filter((l) => /R\$\s?[0-9]/.test(l));
const falhas = [];

for (const [nome, texto] of passos) {
  const perdidas = linhasDeDinheiro.filter((l) => !texto.includes(l));
  if (perdidas.length) {
    falhas.push("a guarda de " + nome + " comeu " + perdidas.length + " linha(s): " + perdidas[0]);
  }
  if (texto !== RESUMO) falhas.push("a guarda de " + nome + " mexeu no resumo");
}

// A guarda que troca lista por cardapio mora no cerebro e nao e exportada:
// aqui se cobra que ela tenha a protecao escrita.
const cerebro = fs.readFileSync(path.join(raiz, "lib/ia/cerebro.ts"), "utf8");
const dentro = cerebro.slice(cerebro.indexOf("function listaViraCardapio"), cerebro.indexOf("function honrarCardapioPrometido"));
if (!/Pedido recebido/.test(dentro)) {
  falhas.push("listaViraCardapio voltou a poder trocar as linhas do resumo por 'te mandei o cardapio'");
}
if (!/o resumo refeito saiu sem item/.test(cerebro)) {
  falhas.push("o resumo refeito voltou a poder sair sem nenhuma linha de item");
}

console.log("Linhas de dinheiro no resumo: " + linhasDeDinheiro.length);
console.log("Guardas de texto testadas: " + passos.length);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: o resumo chega inteiro, com todas as linhas e o total.");
