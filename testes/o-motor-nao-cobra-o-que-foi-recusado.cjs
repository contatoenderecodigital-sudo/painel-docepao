// O MOTOR NAO COBRA O QUE FOI RECUSADO, E O BOLO NAO VIRA DOCINHO.
//
// POR QUE ISTO EXISTE
//
// O motor de preco e a unica peca que escreve dinheiro. Ele tinha duas leituras
// proprias, escritas so pra ele, e as duas erravam pro lado que custa dinheiro.
//
// 1. UMA LEITURA DE NEGACAO SO DELE
//
//    Havia um `citadoDeVerdade` com a sua propria lista de palavras. Medido em
//    28/08/2026 contra o leitor da frase, em nove frases, quatro discordavam, e
//    tres cobravam R$ 12 de quem tinha recusado com todas as letras:
//
//        "nao quero papel de arroz"      o motor cobrava
//        "topo sim, papel de arroz nao"  o motor cobrava
//        "papel de arroz nao"            o motor cobrava
//
//    E uma ia pro outro lado: "tirar o papel de arroz" o motor entendia e o
//    leitor da frase nao. Cada lista sabia um pedaco do portugues que a outra
//    nao sabia. Agora e uma so.
//
// 2. UM GALHO QUE NUNCA DISPAROU
//
//    Quando a observacao tem marca de bolo (topo, prato aberto, papel de arroz,
//    aniversariante), o nome curto e um SABOR DE BOLO, e nao o docinho de mesmo
//    nome. O galho que fazia isso procurava a categoria "bolo", que nao existe
//    neste motor: as categorias sao bolo_recheado, bolo_caseiro e bolo_salgado.
//
//        "cafe" com topo de bolo  ->  cotava o DOCINHO, R$ 1,25
//        o certo                  ->  bolo caseiro cafe, R$ 35,90
//
//    Um bolo de 2 kg saindo por R$ 2,50.
//
// O QUE ELE COBRA
//
// A classe inteira, e nao os tres exemplos: TODO sabor de bolo da casa, pelo
// nome curto, com marca de bolo na observacao, tem que ser cotado como BOLO. E
// os mesmos nomes SEM a marca nao podem virar bolo, senao o docinho de R$ 1,25
// passaria a custar R$ 46,90.
//
// Roda com: node testes/o-motor-nao-cobra-o-que-foi-recusado.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-motor.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { motorPadrao, citadoDeVerdade } from '../lib/ia/orcamento.ts';",
    "import { produtosDaCasa } from '../lib/ia/dados/produtos.ts';",
    "",
    "// A observacao que diz 'isto e bolo de festa', com as marcas que o motor le.",
    "const MARCA = 'prato aberto, topo de bolo';",
    "",
    "const cotar = (item, obs) => {",
    "  const c = motorPadrao.cotarPorItens([{ item, qtd: 2, obs }]);",
    "  return c.linhas[0] ?? null;",
    "};",
    "",
    "// ---------------------------------------------------- o bolo nao vira docinho",
    "const viraramDocinho = [];",
    "const bolos = produtosDaCasa().filter((p) => p.categoria === 'bolo_festa' || p.categoria === 'bolo_caseiro');",
    "for (const b of bolos) {",
    "  const l = cotar(b.nomeCurto, MARCA);",
    "  // Cotado como bolo? A categoria do motor pro bolo comeca com 'bolo'.",
    "  if (!l || !/^bolo/.test(String(l.categoria))) {",
    "    viraramDocinho.push(b.nomeCurto + ' [' + b.categoria + '] -> ' + (l ? l.item + ' R$ ' + l.unit : 'nao cotou'));",
    "  }",
    "}",
    "",
    "// ------------------------------------------- e o docinho nao vira bolo sozinho",
    "const viraramBolo = [];",
    "const docinhos = produtosDaCasa().filter((p) => p.categoria === 'docinho');",
    "for (const d of docinhos) {",
    "  const l = cotar(d.nomeCurto, '');",
    "  if (!l || /^bolo/.test(String(l.categoria))) {",
    "    viraramBolo.push(d.nomeCurto + ' -> ' + (l ? l.item + ' R$ ' + l.unit : 'nao cotou'));",
    "  }",
    "}",
    "",
    "// ------------------------------------------------ a recusa nao pode ser cobrada",
    "// O papel de arroz e o unico adicional que o motor lanca sozinho quando a",
    "// observacao pede. Recusar tem que valer, escrito de qualquer jeito.",
    "const RECUSAS = ['sem papel de arroz', 'nao quero papel de arroz', 'papel de arroz nao',",
    "  'topo sim, papel de arroz nao', 'nem papel de arroz', 'tirar o papel de arroz',",
    "  'nada de papel de arroz', 'retira o papel de arroz'];",
    "const PEDIDOS = ['com papel de arroz', 'quero o papel de arroz', 'papel de arroz sim'];",
    "",
    "const temPapel = (obs) => {",
    "  const c = motorPadrao.cotarPorItens([{ item: 'bolo 4 leites', qtd: 2, obs }]);",
    "  return (c.linhas ?? []).some((l) => /papel de arroz/i.test(String(l.item)));",
    "};",
    "const cobrouRecusado = RECUSAS.filter(temPapel);",
    "const naoCobrouPedido = PEDIDOS.filter((o) => !temPapel(o));",
    "",
    "// E a funcao exportada tem que concordar com o que o motor faz.",
    "const discordaDaFuncao = [...RECUSAS, ...PEDIDOS].filter(",
    "  (o) => citadoDeVerdade(o, 'papel de arroz') !== temPapel(o),",
    ");",
    "",
    "console.log(JSON.stringify({",
    "  bolos: bolos.length, docinhos: docinhos.length,",
    "  viraramDocinho, viraramBolo, cobrouRecusado, naoCobrouPedido, discordaDaFuncao,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-motor.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Sabores de bolo medidos: " + r.bolos + " | docinhos: " + r.docinhos);
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

cobra("sabor de bolo com marca de bolo na observacao foi cotado como outra coisa", r.viraramDocinho);
cobra("docinho sem marca de bolo virou bolo (R$ 1,25 cobrado como R$ 46,90)", r.viraramBolo);
cobra("o cliente recusou o papel de arroz e o motor cobrou os R$ 12", r.cobrouRecusado);
cobra("o cliente pediu o papel de arroz e o motor nao cobrou", r.naoCobrouPedido);
cobra("citadoDeVerdade discorda do que o motor faz de verdade", r.discordaDaFuncao);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o bolo e cotado como bolo, o docinho como docinho, e a recusa vale");
console.log("");
console.log("PASSOU");
