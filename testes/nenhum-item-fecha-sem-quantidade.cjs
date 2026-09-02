// NENHUM ITEM FECHA SEM A QUANTIDADE QUE O CLIENTE DISSE.
//
// Regra dele, em 02/09/2026, depois de testar a producao e ver o pedido dele
// fechar inteiro com um de cada:
//
//   "sempre que o cliente quiser bolo ele tem que pedir quantos kg, se ele ja
//    nao tiver dito ou concordado"
//   "sempre que o cliente pedir docinhos tem que pedir quantos ele vai querer
//    de cada, se ele ja nao tiver dito ou concordado"
//   "sempre que o cliente pedir salgados tem que pedir quantos ele vai querer
//    de cada, se ele ja nao tiver dito ou concordado"
//   "e sempre q pedir coisa de KG ou UNID de qualquer produto tem q pedir pra
//    pessoa qual a quantidade, se nao vai ficar bugando sem preco as coisas com
//    unidades erradas, PRA TODOS OS PRODUTOS"
//
// O QUE ACONTECEU DE VERDADE, medido contra a producao:
//
//   cliente >> quero bolo, salgados, docinhos e cupcakes
//   modelo  >> 1x bolo ;; 1x salgado ;; 1x docinho ;; 1x cupcake
//   padaria >> (nunca perguntou quantidade de nada, nem o peso do bolo)
//   pedido  >> R$ 77,65, um de cada
//
// Ele nao tinha dito quantidade de coisa nenhuma. O "1" era chute do modelo, e
// chute vira dinheiro errado na comanda e no caixa.
//
// AS DUAS METADES, e nenhuma serve sozinha:
//
//   1. o modelo devolve qtd 0 quando o cliente NAO disse (antes so na festa)
//   2. a etapa nao se da por cumprida com item em zero, em QUALQUER unidade
//      (antes so em quilo)
//
// O "OU CONCORDADO" DELE E A FESTA. Ali o total saiu da proposta que ele
// aceitou, e o codigo reparte. Perguntar de novo seria pedir duas vezes.
//
// A ISCA: voltando o `return true` de `faltaQuantidade` pra a conferencia
// antiga de quilo, os casos de unidade ficam vermelhos.
//
// Roda com: node testes/nenhum-item-fecha-sem-quantidade.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "salgado sem quantidade nao fecha a etapa",
    itens: [{ produto: "coxinha", categoria: "salgado_frito", qtd: 0, obs: "frango" }],
    cumprida: false,
    dano: "cem coxinhas viram uma, e a festa sai sem comida",
  },
  {
    nome: "docinho sem quantidade nao fecha a etapa",
    itens: [{ produto: "brigadeiro", categoria: "docinho", qtd: 0, obs: null }],
    forminha: "rosa",
    cumprida: false,
    dano: "o mesmo, no docinho",
  },
  {
    // O CUPCAKE GRANDE, E NAO O PEQUENO, DE PROPOSITO.
    //
    // O pequeno tem dois sabores, entao a etapa ja parava nele por FALTA DE
    // SABOR, e o caso ficava verde com a guarda de quantidade desligada: teste
    // que passa pelo motivo errado nao mede nada. O grande e por unidade e tem
    // sabor fixo, entao o unico motivo de parar aqui e a quantidade.
    nome: "cupcake sem quantidade nao fecha a etapa",
    itens: [{ produto: "cupcake grande", categoria: "cupcake", qtd: 0, obs: null }],
    cumprida: false,
    dano: "produto por UNIDADE passava batido: a guarda antiga so olhava quilo",
  },
  {
    nome: "bolo sem peso nao fecha a etapa",
    itens: [{ produto: "bolo brigadeiro", categoria: "bolo_festa", qtd: 0, obs: "brigadeiro" }],
    cumprida: false,
    dano: "o bolo de 2 kg cobrado como 1 kg, medido com cliente de verdade em 31/08",
  },
  {
    nome: "com a quantidade dita, a etapa fecha",
    itens: [{ produto: "coxinha", categoria: "salgado_frito", qtd: 100, obs: "frango" }],
    cumprida: true,
    dano: "cobrar de novo o que ele ja disse faz a padaria perguntar duas vezes",
  },
  {
    // O "OU CONCORDADO" DELE.
    //
    // AS TRES FAMILIAS PRECISAM ESTAR ESCOLHIDAS neste caso, e nao so o
    // salgado: numa festa com a proposta aceita a padaria pergunta os docinhos e
    // o bolo por iniciativa propria, porque a base tem os tres. Com so a
    // coxinha, o teste parava no docinho e media outra coisa (o comportamento
    // certo), em vez de medir a quantidade.
    nome: "na festa com a proposta aceita, ninguem pergunta quantidade de novo",
    itens: [
      { produto: "coxinha", categoria: "salgado_frito", qtd: 0, obs: "frango" },
      { produto: "brigadeiro", categoria: "docinho", qtd: 0, obs: null },
      { produto: "bolo brigadeiro", categoria: "bolo_festa", qtd: 0, obs: "brigadeiro" },
    ],
    forminha: "rosa",
    ehFesta: true,
    baseAceita: true,
    base: { salgados: 200, docinhos: 100, boloKg: 2, totalCentavos: 41880 },
    cumprida: true,
    dano: "perguntar de novo o total que ele acabou de aceitar na proposta",
  },
  {
    // NOME DE FAMILIA AINDA VAI VIRAR PRODUTO.
    nome: "lugar vazio de familia nao e cobrado por quantidade",
    itens: [{ produto: "salgado", categoria: "salgado_frito", qtd: 0, obs: null }],
    cumprida: false,
    porFaltarProduto: true,
    dano: "perguntar quantos SALGADOS antes de saber quais salgados",
  },
];

const sonda = path.join(__dirname, "_sonda-quantidade.mts");
fs.writeFileSync(
  sonda,
  [
    'import { roteiroDoPedido, etapaDaVez } from "../lib/ia/fluxo/etapas.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const p = {",
    "    ehFesta: !!c.ehFesta, pessoas: c.ehFesta ? 20 : null, base: c.base ?? null,",
    "    baseAceita: !!c.baseAceita, itens: c.itens, naoQuer: [],",
    "    dados: { nome: 'Ana', data: '10/09/2026', hora: '18:30', pagamento: 'pix' },",
    "    pecas: null, topoNome: null, topoIdade: null, tema: null,",
    "    forminha: c.forminha ?? null, prato: null,",
    "    etapasJaPerguntadas: [], etapasAdiadas: [], pecasMandadas: [],",
    "  };",
    "  const roteiro = roteiroDoPedido(p as never);",
    "  const vez = etapaDaVez(p as never, roteiro);",
    "  saiu.push({ etapa: vez.id, pergunta: String(vez.pergunta ?? '') });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-quantidade.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

// As etapas de produto. Parar numa delas quer dizer "ainda tenho o que perguntar
// sobre o que ele pediu"; sair delas quer dizer que a etapa se deu por cumprida.
const DE_PRODUTO = ["salgado", "docinho", "bolo", "resto_do_cardapio"];

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== nenhum item fecha sem quantidade ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const parouNoProduto = DE_PRODUTO.includes(r.etapa);
  // `cumprida: false` quer dizer que a conversa NAO pode ter passado adiante.
  const ok = c.cumprida ? !parouNoProduto : parouNoProduto;
  console.log(
    (ok ? "ok    " : "ERRO  ") + c.nome +
      (ok ? "" : "  ->  a conversa foi parar em \"" + r.etapa + "\"; " + c.dano),
  );
  if (!ok) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
