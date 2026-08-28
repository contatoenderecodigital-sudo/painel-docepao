// NENHUMA ETAPA PRENDE A CONVERSA PARA SEMPRE.
//
// O DEFEITO, MEDIDO CONTRA A PRODUCAO EM 28/08/2026
//
//   cliente >> quero fazer uma festa dia 06/09, 100 coxinhas e 50 esfirras
//   padaria >> Quantas pessoas vao na festa?
//   cliente >> e 60 brigadeiros, forminha dourada
//   padaria >> Quantas pessoas vao na festa?
//   cliente >> um bolo de 3 kg de laka, pao de lo branco
//   padaria >> Quantas pessoas vao SER na festa?
//   cliente >> sem topo e sem papel de arroz
//   padaria >> Quantas pessoas vao PARTICIPAR da festa?
//   (o pedido NUNCA foi registrado)
//
// A IA reescrevia a frase a cada vez, entao no log nem parecia repeticao. O que
// denunciou foi o PEDIDO FALTANDO NO BANCO.
//
// A etapa `quantas_pessoas` fechava so com numero de pessoas, e so era pulavel
// fora da festa. Quem abria com "quero fazer uma festa" e seguia ditando item
// ficava presa entre as duas condicoes, para sempre.
//
// E CONSERTAR SO ELA EMPURRAVA O TRAVAMENTO PRA PROXIMA
//
// Sem numero de pessoas, `calcularBase` devolve null. A etapa `base_da_festa`
// fecha com `baseAceita` e era pulavel so fora da festa: a conversa passaria da
// primeira e pararia na segunda, esperando o cliente aceitar uma proposta que
// nunca foi feita. Fechar uma porta muda o que acontece do outro lado dela.
//
// O QUE ELE COBRA, E POR QUE ELE VARRE
//
// Ele NAO testa as duas etapas consertadas: ele varre o roteiro INTEIRO. Uma
// etapa que nao fecha e uma conversa que nao vira pedido, e a familia deste
// defeito ja apareceu tres vezes em etapas diferentes. Cobrar so as duas
// conhecidas era escrever o teste do defeito de ontem.
//
//   1. o cliente que IGNORA toda pergunta chega ao fim do roteiro
//   2. nenhuma etapa sai duas vezes seguidas sem a conversa andar
//   3. o cliente que RESPONDE tambem chega, e mais rapido
//
// Roda com: node testes/nenhuma-etapa-prende-a-conversa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-etapa-presa.mjs");

const SONDA = [
  "import { ROTEIRO_DA_FESTA, etapaDaVez } from '../lib/ia/fluxo/etapas.ts';",
  "",
  "// A MARCA SAI DO FLUXO, NAO DA MINHA MAO. Mesma conta do `fluxo.ts`: marca a",
  "// etapa da vez a cada volta. Escrever marca a mao ja me custou dois defeitos.",
  "const marcar = (id, marcas) => (marcas.includes(id) ? marcas : [...marcas, id]);",
  "",
  "const BASE = {",
  "  ehFesta: true, pessoas: null, base: null, baseAceita: false, naoQuer: [],",
  "  forminha: 'dourada', dados: {}, pecas: { topo: false, papelDeArroz: false },",
  "  topoNome: null, topoIdade: null, escrito: null, tema: null, prato: null,",
  "  ofereceu: false, etapasJaPerguntadas: [],",
  "  itens: [",
  "    { produto: 'coxinha', categoria: 'salgado', qtd: 100, obs: null },",
  "    // `docinho` e a categoria da MONTAGEM. O banco guarda `doce`: quem traduz",
  "    // e o `categoriaDoPedido`. Escrever `doce` aqui fazia a sonda medir a minha",
  "    // reconstrucao em vez do fluxo, e acusar um defeito que nao existia.",
  "    { produto: 'brigadeiro', categoria: 'docinho', qtd: 60, obs: 'forminha dourada' },",
  "    { produto: 'bolo laka', categoria: 'bolo_festa', qtd: 3, obs: null },",
  "  ],",
  "};",
  "",
  "// O cliente que ignora TUDO: so o tempo passa, o estado nao muda.",
  "// Se alguma etapa nunca virar pulavel nem cumprida, o loop nao sai dela.",
  "const andar = (estadoInicial) => {",
  "  let p = { ...estadoInicial };",
  "  const visitadas = [];",
  "  for (let volta = 0; volta < 40; volta++) {",
  "    const e = etapaDaVez(p, ROTEIRO_DA_FESTA);",
  "    visitadas.push(e.id);",
  "    // `dados` E UMA PARADA LEGITIMA, E A UNICA.",
  "    //",
  "    // Sem nome, dia, hora e pagamento a padaria nao TEM como registrar pedido:",
  "    // insistir ali e o certo. A saida dela nao e pular, e o repasse pra equipe,",
  "    // que mora fora do roteiro. Toda outra etapa que prende e defeito.",
  "    if (e.id === 'registrado' || e.id === 'confirmacao' || e.id === 'dados') {",
  "      return { chegou: e.id, voltas: volta, visitadas };",
  "    }",
  "    const antes = JSON.stringify(p.etapasJaPerguntadas);",
  "    p = { ...p, etapasJaPerguntadas: marcar(e.id, p.etapasJaPerguntadas) };",
  "    // Se a marca nao mudou E a etapa e a mesma, a conversa esta presa.",
  "    if (antes === JSON.stringify(p.etapasJaPerguntadas) && visitadas.at(-2) === e.id) {",
  "      return { chegou: null, presaEm: e.id, voltas: volta, visitadas };",
  "    }",
  "  }",
  "  return { chegou: null, presaEm: visitadas.at(-1), voltas: 40, visitadas };",
  "};",
  "",
  "// Com os dados preenchidos, pra chegar ate a confirmacao.",
  "const comDados = {",
  "  ...BASE,",
  "  dados: { nome: 'Fernanda Klein', data: '06/09/2026', hora: '15:00', pagamento: 'cartao' },",
  "};",
  "// E o que RESPONDE o numero de pessoas, pra provar que o caminho normal vive.",
  "const respondeu = { ...comDados, pessoas: 30, base: null, baseAceita: true };",
  "",
  "console.log(JSON.stringify({",
  "  ignorandoTudo:   andar(BASE),",
  "  comOsDados:      andar(comDados),",
  "  respondendo:     andar(respondeu),",
  "}));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");
let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-etapa-presa.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

const falhas = [];

for (const [nome, caso] of Object.entries(r)) {
  console.log(nome + ": " + (caso.chegou ? "chegou em " + caso.chegou : "PRESA EM " + caso.presaEm) +
    " (" + caso.voltas + " voltas)");
  console.log("    " + caso.visitadas.join(" > "));

  if (!caso.chegou) {
    falhas.push(
      nome + ": a conversa fica presa na etapa `" + caso.presaEm + "`. A padaria repete a " +
        "mesma pergunta pra sempre e O PEDIDO NUNCA E REGISTRADO",
    );
  }
  // Etapa que aparece duas vezes seguidas e a assinatura do defeito.
  const repetiuSeguido = caso.visitadas.find((id, i) => i > 0 && caso.visitadas[i - 1] === id);
  if (repetiuSeguido) {
    falhas.push(nome + ": a etapa `" + repetiuSeguido + "` saiu duas vezes seguidas sem a conversa andar");
  }
}

console.log("");
if (falhas.length) {
  console.log("ERRO  etapa prendendo a conversa (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    ignorando ou respondendo, a conversa sempre chega ao fim");
console.log("");
console.log("PASSOU");
