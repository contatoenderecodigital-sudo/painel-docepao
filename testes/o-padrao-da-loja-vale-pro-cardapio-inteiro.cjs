// O PADRAO DA LOJA VALE PRO CARDAPIO INTEIRO, PRODUTO POR PRODUTO.
//
// Ele escreveu o padrao com todas as letras em 02/09/2026, depois de a producao
// fechar um pedido com um de cada e sem peso de bolo:
//
//   "quando nao tem o sabor nao precisa pedir. Quando tem mais de um sabor e
//    OBRIGATORIO pedir pro cliente qual sabor ele quer. E quando tem unidade,
//    quilo, grama, precisa pedir pro cliente quanto que ele quer: nao pode
//    passar por quantidade ficticia ou uma ou errada, e isto tambem tem que ser
//    padrao da LOJA INTEIRA. Primeiro o sabor, se for necessario, depois quantos
//    quilos ou quantas unidades. A quantidade e obrigatoria; o sabor so quando
//    aquele produto tem mais de um.
//    Isso e o que influencia no dinheiro e no valor dos produtos."
//
// E ele pediu a prova: "eu preciso que esteja no codigo inteiro em todos os
// arquivos certinho para nao ter bug, porque isso e regra basica".
//
// POR ISSO ESTE TESTE VARRE OS 86 PRODUTOS, e nao seis exemplos. Regra que vale
// "em quase todos" e a que produz o pedido errado justo no produto que ninguem
// lembrou de testar, e foi assim que o cupcake e a mini bolha doce passaram.
//
// O QUE ELE COBRA, em cada produto do cardapio:
//
//   1. com mais de um sabor e nenhum escolhido -> a conversa PARA e pergunta
//   2. com um sabor so (ou nenhum)             -> nao pergunta sabor nenhum
//   3. com o sabor resolvido e a quantidade em zero -> a conversa PARA
//   4. com sabor e quantidade -> a conversa SEGUE (senao a regra vira trava)
//   5. bolo de festa passa por topo e papel de arroz; bolo caseiro NAO
//
// Roda com: node testes/o-padrao-da-loja-vale-pro-cardapio-inteiro.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-padrao.mts");
fs.writeFileSync(
  sonda,
  [
    'import { produtosDaCasa, pedeEscolhaDeSabor } from "../lib/ia/dados/produtos.ts";',
    'import { roteiroDoPedido, etapaDaVez } from "../lib/ia/fluxo/etapas.ts";',
    'import { oQueFaltaPraFechar } from "../lib/ia/fluxo/fechar.ts";',
    "",
    "// As etapas que ainda estao falando DO PRODUTO. Parar numa delas quer dizer",
    "// que a padaria ainda tem o que perguntar sobre o que ele pediu.",
    'const DE_PRODUTO = ["salgado", "docinho", "bolo", "resto_do_cardapio"];',
    "",
    "const pedido = (produto, categoria, qtd, obs) => ({",
    "  ehFesta: false, pessoas: null, base: null, baseAceita: false, naoQuer: [],",
    "  itens: [{ produto, categoria, qtd, obs }],",
    "  dados: { nome: 'Ana', data: '10/09/2026', hora: '18:30', pagamento: 'pix' },",
    "  pecas: null, topoNome: null, topoIdade: null, tema: null, forminha: 'rosa', prato: 'aberto',",
    "  etapasJaPerguntadas: [], etapasAdiadas: [], pecasMandadas: [],",
    "});",
    "const ondePara = (p) => etapaDaVez(p as never, roteiroDoPedido(p as never)).id;",
    "const oQueFalta = (p) => oQueFaltaPraFechar(p as never);",
    "",
    "const semSabor = [], perguntamATooa = [], semQuantidade = [], travados = [];",
    "const fechamSemQtd = [], fechamSemSabor = [], naoFecham = [];",
    "const pecasNoCaseiro = [], semPecasNaFesta = [];",
    "",
    "for (const p of produtosDaCasa()) {",
    "  // O papel de arroz nao e pedido: e peca do bolo, e tem etapa propria.",
    "  if (p.categoria === 'adicional_bolo') continue;",
    "  const escolhe = pedeEscolhaDeSabor(p);",
    "  const oSabor = p.sabores.length ? p.sabores[0] : null;",
    "",
    "  // 1 e 2. O SABOR, com a quantidade JA dita, pra medir so o sabor.",
    "  const soSabor = ondePara(pedido(p.nome, p.categoria, 2, null));",
    "  if (escolhe && !DE_PRODUTO.includes(soSabor)) {",
    "    semSabor.push(p.nome + ' (' + p.sabores.length + ' sabores) -> foi parar em ' + soSabor);",
    "  }",
    "  if (!escolhe && DE_PRODUTO.includes(soSabor)) {",
    "    perguntamATooa.push(p.nome + ' (sabor fixo) -> parou em ' + soSabor);",
    "  }",
    "",
    "  // 3. A QUANTIDADE, com o sabor JA resolvido, pra medir so a quantidade.",
    "  const soQtd = ondePara(pedido(p.nome, p.categoria, 0, oSabor));",
    "  if (!DE_PRODUTO.includes(soQtd)) {",
    "    semQuantidade.push(p.nome + ' (por ' + p.unidade + ') -> foi parar em ' + soQtd);",
    "  }",
    "",
    "  // 3b. O FECHAMENTO TAMBEM COBRA. Etapa e fechamento sao dois guardas do",
    "  // mesmo dinheiro: um diz o que PERGUNTAR, o outro o que pode ser REGISTRADO.",
    "  const faltaComZero = oQueFalta(pedido(p.nome, p.categoria, 0, oSabor));",
    "  if (!faltaComZero.some((x) => /quant|quilo|kg/i.test(x))) {",
    "    fechamSemQtd.push(p.nome + ' -> o fechamento nao cobra a quantidade: ' + (faltaComZero.join('; ') || '(nada)'));",
    "  }",
    "  if (escolhe) {",
    "    const faltaSemSabor = oQueFalta(pedido(p.nome, p.categoria, 2, null));",
    "    if (!faltaSemSabor.some((x) => /sabor|qual/i.test(x))) {",
    "      fechamSemSabor.push(p.nome + ' -> o fechamento nao cobra o sabor: ' + (faltaSemSabor.join('; ') || '(nada)'));",
    "    }",
    "  }",
    "  const faltaCompleto = oQueFalta(pedido(p.nome, p.categoria, 2, oSabor));",
    "  if (faltaCompleto.length) {",
    "    naoFecham.push(p.nome + ' -> com sabor e quantidade ainda falta: ' + faltaCompleto.join('; '));",
    "  }",
    "",
    "  // 4. E COM OS DOIS, A CONVERSA SEGUE.",
    "  const completo = ondePara(pedido(p.nome, p.categoria, 2, oSabor));",
    "  if (DE_PRODUTO.includes(completo)) {",
    "    travados.push(p.nome + ' -> preso em ' + completo + ' com sabor e quantidade');",
    "  }",
    "",
    "  // 5. TOPO E PAPEL DE ARROZ SO NO BOLO DE FESTA.",
    "  if (p.categoria === 'bolo_caseiro' && completo === 'pecas_do_bolo') {",
    "    pecasNoCaseiro.push(p.nome);",
    "  }",
    "  if (p.categoria === 'bolo_festa' && completo !== 'pecas_do_bolo') {",
    "    semPecasNaFesta.push(p.nome + ' -> ' + completo);",
    "  }",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  total: produtosDaCasa().length,",
    "  semSabor, perguntamATooa, semQuantidade, travados, pecasNoCaseiro, semPecasNaFesta,",
    "  fechamSemQtd, fechamSemSabor, naoFecham,",
    "}));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-padrao.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 300000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
console.log("== o padrao da loja vale pro cardapio inteiro ==");
console.log("Produtos varridos: " + r.total);
console.log("");

const cobra = (rotulo, lista, dano) => {
  if (!lista.length) {
    console.log("ok    " + rotulo + ": nenhum");
    return;
  }
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista.slice(0, 12)) console.log("        " + l);
  if (lista.length > 12) console.log("        ... e mais " + (lista.length - 12));
  console.log("        DANO: " + dano);
  console.log("");
};

cobra(
  "produto com mais de um sabor que a padaria NAO pergunta",
  r.semSabor,
  "a comanda sai sem recheio e a cozinha nao sabe o que produzir",
);
cobra(
  "produto de sabor fixo sendo perguntado a toa",
  r.perguntamATooa,
  "fazer o cliente escolher o que nao tem escolha",
);
cobra(
  "produto que fecha sem a quantidade dita",
  r.semQuantidade,
  "quantidade ficticia vira dinheiro errado na comanda e no caixa",
);
cobra(
  "produto que trava mesmo com sabor e quantidade",
  r.travados,
  "regra que nunca solta e pior que regra que falta: o pedido nao fecha nunca",
);
cobra(
  "bolo CASEIRO sendo perguntado de topo e papel de arroz",
  r.pecasNoCaseiro,
  "oferecer peca de R$ 12 e de R$ 30 em cima de um bolo caseiro de R$ 30",
);
cobra(
  "bolo de FESTA que pula topo e papel de arroz",
  r.semPecasNaFesta,
  "o bolo decorado sai sem as pecas, e elas sao metade do ticket",
);

// O FECHAMENTO E O SEGUNDO GUARDA DO MESMO DINHEIRO.
//
// A etapa decide o que PERGUNTAR; o `oQueFaltaPraFechar` decide o que pode ser
// REGISTRADO. Ja aconteceu de um saber e o outro nao: a cor da forminha era
// cobrada pela etapa e nao pelo fechamento, e quem chegava na confirmacao por
// outro caminho (pedido simples, dados na primeira mensagem) fechava sem cor.
cobra(
  "produto que o FECHAMENTO deixa registrar sem quantidade",
  r.fechamSemQtd,
  "o pedido vira comanda com quantidade que ninguem disse",
);
cobra(
  "produto que o FECHAMENTO deixa registrar sem sabor",
  r.fechamSemSabor,
  "a cozinha recebe a linha sem recheio e alguem liga pro cliente",
);
cobra(
  "produto que o FECHAMENTO trava mesmo completo",
  r.naoFecham,
  "trava que nunca solta e pior que trava que falta: o pedido nao fecha nunca",
);

console.log(falhas.length ? "REPROVOU EM: " + falhas.join(", ") : "PASSOU: o padrao vale nos " + r.total + " produtos");
process.exit(falhas.length ? 1 : 0);
