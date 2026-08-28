// O LEITOR DA FRASE ACHA TUDO QUE A CASA VENDE, E NAO INVENTA O QUE ELA NAO
// VENDE.
//
// POR QUE ISTO EXISTE
//
// O leitor da frase e o codigo lendo a mensagem junto com o modelo. Ele existe
// pra segurar o que o modelo larga, e e ele quem responde duas perguntas que
// mudam o rumo da conversa:
//
//     produtosNaFrase           "ele nomeou um produto?"  -> muda de etapa
//     itensDeOutraEtapaNaFrase  "o que ele pediu fora da hora?" -> guarda o item
//
// QUATRO DEFEITOS MEDIDOS EM 28/08/2026
//
// 1. CATORZE PRODUTOS ERAM INVISIVEIS. A lista de nomes era uma leitura crua do
//    catalogo com QUATRO baldes escritos a mao, e ficavam de fora os bolos
//    caseiros e as pizzas. Quem escrevesse "na verdade quero um bolo de
//    cenoura" no meio do docinho nao nomeava produto nenhum, e a conversa nao
//    ia pro bolo.
//
// 2. QUEM ACHOU POR ERRO DE DIGITACAO ERA JOGADO FORA NA LINHA SEGUINTE:
//
//        "100 coxinia"     achava coxinha    ->  item: nenhum
//        "100 brigadero"   achava brigadeiro ->  item: nenhum
//
//    A tolerancia existia e era desfeita logo depois, porque o item era
//    reprocurado pelo nome CANONICO com um indexOf.
//
// 3. O SABOR DE UM VIRAVA PRODUTO DO OUTRO:
//
//        "50 trufa de morango"  ->  50 trufa E 50 "morango"
//
//    "morango" e sabor de bolo de festa, entao e produto quando dito sozinho.
//
// 4. UMA PIZZA VIRAVA DUAS LINHAS:
//
//        "quero uma pizza redonda"  ->  pizza inteira E pizza redonda
//
//    "uma pizza" e apelido da inteira, e os dois pedacos se sobrepoem.
//
// E DOIS QUE VIERAM DA LISTA DE APELIDOS
//
//    "de 30" perdia os digitos e virava "de ", que esta em quase toda frase: a
//    pizza redonda aparecia em pedido que nao falava de pizza.
//
//    "meia" e apelido da pizza meia E palavra da lingua: "meia duzia de
//    coxinha" virava 6 coxinha e 194 pizza meia.
//
// O QUE ELE COBRA
//
//   1. TODO produto da casa e achado na frase pelo nome curto
//   2. o que a casa NAO vende nao e achado
//   3. erro de digitacao chega ate o item, e nao so ate o nome
//   4. sabor colado no nome vira observacao, e nunca item proprio
//   5. nomes que se sobrepoem viram UM item, o mais especifico
//   6. nenhum apelido da casa e perdido pela regua de tamanho
//
// Roda com: node testes/o-leitor-da-frase-acha-e-nao-inventa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-leitor.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { produtosDaCasa } from '../lib/ia/dados/produtos.ts';",
    "import { APELIDOS } from '../lib/ia/dados/apelidos.ts';",
    "import { produtosNaFrase, itensDeOutraEtapaNaFrase } from '../lib/ia/fluxo/leitor-da-frase.ts';",
    "",
    "const nada = () => false;",
    "const itens = (f) => itensDeOutraEtapaNaFrase(f, nada);",
    "",
    "// 1. todo produto da casa aparece quando o cliente escreve o nome dele",
    "const invisiveis = produtosDaCasa()",
    "  .filter((p) => !produtosNaFrase('quero 2 ' + p.nomeCurto + ' pra sabado').length)",
    "  .map((p) => p.nomeCurto + ' [' + p.categoria + ']');",
    "",
    "// 2. o que a casa nao vende nao pode aparecer",
    "const FORA = ['xilofone', 'macaron', 'sushi', 'churrasco', 'lasanha', 'feijoada'];",
    "const inventados = FORA.filter((x) => produtosNaFrase('quero 2 ' + x + ' pra sabado').length);",
    "",
    "// 3. erro de digitacao chega ate o ITEM",
    "const ERRADOS = [['100 coxinia', 'coxinha'], ['100 brigadero', 'brigadeiro'],",
    "  ['50 beijino', 'beijinho'], ['100 chique de frango', 'quiche']];",
    "const perdidosNoErro = ERRADOS",
    "  .filter(([f, alvo]) => !itens(f).some((i) => i.produto === alvo))",
    "  .map(([f, alvo]) => f + ' deveria virar ' + alvo);",
    "",
    "// 4. sabor colado no nome e observacao, nunca item",
    "const SABOR = ['50 trufa de morango', '2 cuca de chocolate', '100 quiche de frango',",
    "  '1 pizza redonda de calabresa', '1 empadao de palmito'];",
    "const saborVirouItem = SABOR.filter((f) => itens(f).length !== 1)",
    "  .map((f) => f + ' -> ' + JSON.stringify(itens(f).map((i) => i.produto)));",
    "const semObs = SABOR.filter((f) => itens(f).length === 1 && !itens(f)[0].obs);",
    "",
    "// 5. nomes que se sobrepoem viram um item so",
    "const SOBREPOE = [['quero uma pizza redonda', 'pizza redonda'],",
    "  ['uma pizza meia de calabresa', 'pizza meia'], ['quero uma pizza', 'pizza inteira']];",
    "const duplicaram = SOBREPOE",
    "  .filter(([f, alvo]) => { const r = itens(f); return r.length !== 1 || r[0].produto !== alvo; })",
    "  .map(([f, alvo]) => f + ' -> ' + JSON.stringify(itens(f).map((i) => i.produto)) + ', esperado ' + alvo);",
    "",
    "// 6. o apelido curto que a regua descarta nao pode DEIXAR PRODUTO SEM PORTA",
    "//",
    "// A regua e: apelido de uma palavra precisa de cinco letras, senao ele acha",
    "// o que nao existe (\"meia duzia\" virava pizza meia). Perder um apelido so",
    "// e aceitavel enquanto o PRODUTO continuar alcancavel pelo nome dele.",
    "//",
    "// A primeira versao deste teste reprovava todo apelido curto, inclusive o",
    "// que eu tinha decidido descartar de proposito. Isso nao cobra nada: cobra",
    "// a minha decisao de volta pra mim. O que importa e o produto ter porta.",
    "const apelidosCurtos = [];",
    "for (const [canon, lista] of Object.entries(APELIDOS))",
    "  for (const a of lista)",
    "    if (!a.includes(' ') && a.length < 5 && !produtosNaFrase('quero 2 ' + canon).includes(canon))",
    "      apelidosCurtos.push(a + ' -> ' + canon + ' ficou sem porta nenhuma');",
    "",
    "// 7. a frase que nao fala de pizza nao pode trazer pizza",
    "const SEM_PIZZA = ['50 brigadeiro, forminha rosa, e um bolo de 2 kg de 4 leites',",
    "  'meia duzia de coxinha', '2 kg de bolo de 4 leites, retirada dia 2'];",
    "const pizzaFantasma = SEM_PIZZA",
    "  .filter((f) => produtosNaFrase(f).some((n) => /pizza/i.test(n)))",
    "  .map((f) => f + ' -> ' + JSON.stringify(produtosNaFrase(f)));",
    "",
    "console.log(JSON.stringify({",
    "  produtos: produtosDaCasa().length,",
    "  invisiveis, inventados, perdidosNoErro, saborVirouItem, semObs, duplicaram,",
    "  apelidosCurtos, pizzaFantasma,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-leitor.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Produtos da casa medidos: " + r.produtos);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista.slice(0, 20)) console.log("        " + l);
  if (lista.length > 20) console.log("        ... e mais " + (lista.length - 20));
  console.log("");
};

cobra("produto da casa que o leitor nao acha na frase", r.invisiveis);
cobra("o leitor achou o que a casa nao vende", r.inventados);
cobra("achou por erro de digitacao e perdeu na hora de virar item", r.perdidosNoErro);
cobra("o sabor de um produto virou item proprio", r.saborVirouItem);
cobra("o sabor colado no nome se perdeu", r.semObs);
cobra("um produto virou duas linhas por nomes que se sobrepoem", r.duplicaram);
cobra("apelido curto descartado deixou o produto sem nenhuma porta", r.apelidosCurtos);
cobra("frase sem pizza trazendo pizza", r.pizzaFantasma);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    acha os 86, nao inventa, e o sabor de um nao vira produto do outro");
console.log("");
console.log("PASSOU");
