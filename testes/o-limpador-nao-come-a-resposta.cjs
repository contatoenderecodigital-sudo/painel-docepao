// O LIMPADOR NAO COME A RESPOSTA CERTA DO MODELO.
//
// POR QUE ISTO EXISTE
//
// Entre o modelo e o pedido existe uma peneira: uma lista fechada que copia
// campo por campo o que a IA devolveu. Campo que nao esta escrito nela e jogado
// fora, mesmo que a IA tenha acertado.
//
// O proprio arquivo diz, num comentario: "e o defeito que mais se repetiu neste
// projeto, sempre no mesmo formato: uma camada minha comendo a resposta certa
// da outra". Ja aconteceu com `ehFesta` ("vou fazer uma festa" morria ali) e com
// `confirmou` (o "pode fechar" dele morria ali).
//
// E aconteceu de novo, achado lendo o arquivo em 28/08/2026, num jeito que
// nenhum dos dois anteriores tinha:
//
//     {"produto":"coxinha"}      ->  o item sumia inteiro
//
// A conferida era `Number(i.qtd) >= 0`, e `Number(undefined)` e NaN, que nao e
// maior nem igual a nada. Item que o modelo devolvesse sem o campo `qtd` era
// descartado em silencio. Duas linhas abaixo `Number(i.qtd) || 0` ja sabia
// virar zero, e zero e resposta legitima: na festa o total foi combinado na
// proposta e o cliente so escolhe o sabor.
//
// O QUE ELE COBRA
//
// Uma resposta com TODOS os campos entra, e todos tem que sair do outro lado.
// Cobrar campo por campo e o unico jeito: a peneira e uma lista escrita a mao,
// e lista escrita a mao esquece.
//
// Roda com: node testes/o-limpador-nao-come-a-resposta.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-limpador.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { pensarComOpenAI } from '../lib/ia/fluxo/pensar-openai.ts';",
    "",
    "// Uma resposta com tudo que o modelo pode devolver de uma vez.",
    "const RESPOSTA = {",
    "  itens: [",
    "    { produto: 'coxinha', qtd: 100, sabor: 'frango', obs: 'sem cebola' },",
    "    { produto: 'quiche' },                    // sem qtd: e zero, nao e lixo",
    "    { produto: 'brigadeiro', qtd: 0 },        // zero de proposito, na festa",
    "  ],",
    "  pessoas: 30,",
    "  ehFesta: true,",
    "  aceitouBase: true,",
    "  naoQuer: ['bolo'],",
    "  confirmou: true,",
    "  pecas: { topo: true, papelDeArroz: false },",
    "  aniversariante: { nome: 'Arthur', idade: '5 anos' },",
    "  tema: 'Minnie',",
    "  escrito: 'Arthur, 5 anos',",
    "  perguntou: { sobre: 'preco', familia: 'salgado' },",
    "  situacao: 'reclamacao',",
    "  forminha: 'rosa',",
    "  prato: 'aberto',",
    "  dados: { nome: 'Marcos', data: '02/09/2026', hora: '15:00', pagamento: 'pix' },",
    "  falouDeOutraEtapa: 'bolo',",
    "  recomecar: true,",
    "};",
    "",
    "// Um cliente de mentira que devolve exatamente isso.",
    "const falso = { chat: { completions: { create: async () => ({",
    "  choices: [{ message: { content: JSON.stringify(RESPOSTA) } }],",
    "  usage: { prompt_tokens: 1, completion_tokens: 1 },",
    "}) } } };",
    "",
    "const pensar = pensarComOpenAI(falso);",
    "const saiu = await pensar({ instrucao: 'x', mensagem: 'y' });",
    "",
    "const comidos = [];",
    "for (const campo of Object.keys(RESPOSTA)) {",
    "  if (saiu[campo] === undefined) comidos.push(campo);",
    "}",
    "",
    "// E os itens, um por um: nenhum pode sumir, e a quantidade ausente vira 0.",
    "const itensSaida = saiu.itens ?? [];",
    "const itensComidos = RESPOSTA.itens",
    "  .filter((i) => !itensSaida.some((o) => o.produto === i.produto))",
    "  .map((i) => i.produto);",
    "const semQtd = itensSaida.find((i) => i.produto === 'quiche');",
    "const qtdErrada = semQtd && semQtd.qtd !== 0 ? String(semQtd.qtd) : null;",
    "",
    "// O sabor e a observacao seguem inteiros e separados um do outro.",
    "const coxinha = itensSaida.find((i) => i.produto === 'coxinha') ?? {};",
    "const misturou = coxinha.sabor !== 'frango' || coxinha.obs !== 'sem cebola'",
    "  ? JSON.stringify({ sabor: coxinha.sabor, obs: coxinha.obs }) : null;",
    "",
    "console.log(JSON.stringify({",
    "  campos: Object.keys(RESPOSTA).length, comidos, itensComidos, qtdErrada, misturou,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-limpador.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Campos mandados pelo modelo: " + r.campos);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista || !lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("campo que a IA acertou e o limpador comeu", r.comidos);
cobra("item que a IA leu e o limpador jogou fora", r.itensComidos);
if (r.qtdErrada) {
  falhas.push("qtd");
  console.log("ERRO  item sem quantidade nao virou zero: " + r.qtdErrada);
  console.log("");
}
if (r.misturou) {
  falhas.push("sabor");
  console.log("ERRO  o sabor e o recado pra cozinha nao sairam separados: " + r.misturou);
  console.log("");
}

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    tudo que a IA acertou chegou inteiro do outro lado");
console.log("");
console.log("PASSOU");
