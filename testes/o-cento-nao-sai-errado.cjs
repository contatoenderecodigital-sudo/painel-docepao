// O PRECO DO CENTO NAO SAI ERRADO.
//
// Teste ao vivo de 22/08/2026, primeira mensagem de uma cliente:
//
//   cliente: quanto ta o cento de coxinha?
//   Dora:    O cento de coxinha sai R$ 65,00.
//
// O cento de salgado frito e R$ 100,00. Ela cotou R$ 35,00 a menos. Na
// repeticao da mesma pergunta noutro numero ela acertou -- ou seja, e
// intermitente, e por isso nao aparece em toda medicao.
//
// DUAS TRAVAS DEVIAM TER PEGO, E AS DUAS FALHARAM PELO MESMO MOTIVO:
// ELAS COBRIAM O SILENCIO, NAO O ERRO.
//
//   1. cerebro.ts -- a trava que responde o cento pelo codigo so entrava
//      quando `!/R\$\s?[0-9]/.test(textoFinal)`, isto e, quando ela nao tinha
//      escrito preco NENHUM. Escrever um numero errado desligava a trava. O
//      caso caro era exatamente o que ela deixava passar.
//
//   2. guardas.ts -- `precosInventados` tem duas formas. A de valor primeiro
//      ("Sai R$ 65,00 o cento") pegava. A de unidade primeiro admitia UMA
//      palavra entre a unidade e o "R$" (custa|sai|fica|e|vale|de), e aqui ha
//      TRES ("de coxinha sai"). Escapou pelo vao.
//
// O custo: a cliente ouve R$ 65 o cento, pede o cento, e o cupom sai
// R$ 100,00. Isso e discussao no balcao, com a dona pagando o pato.
//
// Roda com: node testes/o-cento-nao-sai-errado.cjs
const g = require("./_guardas.cjs")();
const fs = require("fs");
const path = require("path");
const cerebro = fs.readFileSync(path.join(__dirname, "..", "lib", "ia", "cerebro.ts"), "utf8");
const catalogo = require("../lib/ia/dados/catalogo.json");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

const frito = Number(catalogo.salgados?.frito?.preco ?? 0);
const assado = Number(catalogo.salgados?.assado?.preco ?? 0);
console.log("A tabela da casa: frito " + frito + "/un (cento " + frito * 100 + "), assado " + assado + "/un (cento " + assado * 100 + ")");
conferir(frito * 100 === 100, "o cento de frito e R$ 100,00", "a tabela mudou: revisar este teste");

console.log("");
console.log("== a guarda pega o preco errado nas DUAS formas de escrever ==");
for (const [frase, pega, oque] of [
  ["O cento de coxinha sai R$ 65,00.", true, "o caso medido: unidade primeiro, tres palavras no meio"],
  ["Sai R$ 65,00 o cento.", true, "valor primeiro (esta ja pegava)"],
  ["O cento de esfirra fica R$ 80,00.", true, "outro produto, mesmo buraco"],
  ["Cada quilo do bolo custa R$ 70,00.", true, "quilo com nome de produto no meio"],
  ["O cento de coxinha sai R$ 100,00.", false, "o preco CERTO passa"],
  ["O quilo do bolo de morango sai R$ 49,90.", false, "preco de tabela passa"],
  ["Salgado frito sai R$ 1,00 a unidade (R$ 100,00 o cento).", false, "a frase que o proprio codigo escreve passa"],
  ["coxinha: 100 un x R$ 1,00 = R$ 100,00", false, "linha do recibo nao e cotacao"],
  ["2 kg de bolo laka R$ 99,80", false, "linha de orcamento nao e cotacao"],
]) {
  const deu = g.precosInventados(frase).length > 0;
  conferir(deu === pega, oque + ": " + JSON.stringify(frase), "deu " + JSON.stringify(g.precosInventados(frase)));
}

console.log("");
console.log("== o cerebro corrige o cento errado, nao so o silencio ==");
conferir(
  cerebro.includes("const mentiuNoCento = frasesDela.filter"),
  "existe o corte da afirmacao de cento com valor errado",
  "a trava voltou a cobrir so o silencio, e o numero errado passa",
);
conferir(
  !/if \(perguntouCento && !\/R\\\$\\s\?\[0-9\]\/\.test\(textoFinal\)\)/.test(cerebro),
  "a condicao antiga (so entra se nao houver preco) saiu",
  "o caso caro volta a passar",
);
conferir(
  cerebro.includes("const ehRecibo = /\\*Pedido recebido\\*|\\*Total:/i.test(textoFinal)"),
  "o recibo fica fora deste corte",
  "os R$ do recibo sao linha de conta e seriam lidos como cotacao errada",
);
conferir(
  cerebro.includes('if (linhas.length && !/R\\$\\s?[0-9]/.test(textoFinal))'),
  "o preco do codigo so entra quando ela ainda nao disse o certo",
  "o cliente le o mesmo numero duas vezes",
);

console.log("");
console.log(
  erros === 0
    ? "O CENTO NAO SAI ERRADO"
    : erros + " FALHA(S): o cliente pode ouvir um preco e receber outro no cupom",
);
process.exit(erros === 0 ? 0 : 1);
