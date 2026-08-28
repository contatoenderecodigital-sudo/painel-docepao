// O SIM E O NAO DO CLIENTE, LIDOS SEM MODELO.
//
// POR QUE ISTO EXISTE
//
// Tres decisoes deste sistema nao passam pelo modelo, e cada uma tem o motivo
// escrito no proprio arquivo:
//
//     mandouRecomecar    apagar o pedido de alguem nao e decisao de redacao
//     respostaAoValor    resposta de dinheiro, com duas saidas e preco alto
//     comCumprimento     a saudacao sai do relogio, nao da palavra do cliente
//
// Justamente por serem regra e nao interpretacao, elas erravam calado. Tres
// defeitos medidos em 28/08/2026:
//
// 1. "nao, nao apaga tudo"  ->  APAGAVA O PEDIDO
//
//    A negacao era uma regra propria, e exigia a forma exata "(nao|sem)
//    (quero|precisa|vamos)? (reiniciar|recomecar|zerar|apagar)". O cliente
//    escreveu "apaga" e a lista tinha "apagar". Apagar o pedido de quem pediu
//    pra NAO apagar e o pior que essa funcao pode fazer, e ela diz isso no
//    proprio comentario.
//
// 2. "sim, mas nao esquece do topo"  ->  RECUSOU
//
//    O comentario dizia "quem diz nao PRIMEIRO esta recusando" e o codigo fazia
//    outra coisa: testava a recusa inteira antes, entao "nao" em qualquer lugar
//    ganhava. O cliente aceitou o valor e o pedido ficava no limbo.
//
// 3. "incerto ainda"  ->  ACEITOU
//
//    Sem fronteira de palavra, "certo" casava dentro de "incerto". Alguem em
//    duvida aprovando um valor.
//
// E UM QUARTO, DE DUAS LISTAS PRA MESMA COISA
//
//    "como vai" era cumprimento pra quem TIRA e nao era pra quem POE:
//
//      cliente >> Como vai, quero coxinha
//      padaria >> Boa tarde, tudo bem? Como vai, quero coxinha
//
// O QUE ELE COBRA
//
// As frases que gente escreve de verdade, nos dois sentidos: o que tem que
// valer e o que nao pode valer. E a simetria entre por e tirar cumprimento,
// que e o que impede as duas listas de divergirem de novo.
//
// Roda com: node testes/o-sim-e-o-nao-do-cliente.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-falas.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { mandouRecomecar, respostaAoValor, comCumprimento, tirarCumprimento }",
    "  from '../lib/ia/fluxo/falas-do-cliente.ts';",
    "",
    "const erros = [];",
    "const cobra = (rotulo, deu, esperado, frase) => {",
    "  if (deu !== esperado) erros.push(rotulo + ': ' + JSON.stringify(frase) + ' deu ' + JSON.stringify(deu) + ', esperado ' + JSON.stringify(esperado));",
    "};",
    "",
    "// 1. recomecar: so apaga quem mandou apagar",
    "const APAGA = ['vamos reiniciar', 'apaga tudo', 'pode zerar', 'quero recomecar do zero',",
    "  'apagar tudo e comecar de novo', 'cancelar tudo'];",
    "const NAO_APAGA = ['nao quero recomecar', 'nao, nao apaga tudo', 'sem apagar tudo',",
    "  'nao apaga tudo nao', 'nao precisa zerar', 'quero coxinha'];",
    "for (const f of APAGA) cobra('recomecar', mandouRecomecar(f), true, f);",
    "for (const f of NAO_APAGA) cobra('recomecar', mandouRecomecar(f), false, f);",
    "",
    "// 2 e 3. a resposta ao valor",
    "const ACEITOU = ['sim', 'pode ser', 'beleza, pode fechar', 'ok', 'perfeito', 'ta certo',",
    "  'sim, mas nao esquece do topo', 'fechou', 'combinado'];",
    "const RECUSOU = ['nao', 'ta caro demais', 'nao vai dar pra mim', 'nao, pode ser mais barato?',",
    "  'muito caro', 'desisti'];",
    "const NEM_UM_NEM_OUTRO = ['quanto ficou?', 'incerto ainda', 'e o bolo?', ''];",
    "for (const f of ACEITOU) cobra('valor', respostaAoValor(f), 'aceitou', f);",
    "for (const f of RECUSOU) cobra('valor', respostaAoValor(f), 'recusou', f);",
    "for (const f of NEM_UM_NEM_OUTRO) cobra('valor', respostaAoValor(f), null, f);",
    "",
    "// 4. por e tirar cumprimento tem que conhecer a MESMA lista",
    "const AGORA = new Date('2026-08-28T15:00:00-03:00');",
    "const SAUDACOES = ['Bom dia', 'Boa tarde', 'Boa noite', 'Ola', 'Oi', 'Opa',",
    "  'Tudo bem', 'Tudo bom', 'Como vai'];",
    "const discordam = [];",
    "for (const s of SAUDACOES) {",
    "  const frase = s + ', quero coxinha';",
    "  // quem POE nao pode acrescentar outro por cima",
    "  const naoAcrescentou = comCumprimento(frase, AGORA) === frase;",
    "  // quem TIRA tem que reconhecer e tirar",
    "  const tirou = !tirarCumprimento(frase).toLowerCase().startsWith(s.toLowerCase());",
    "  if (!naoAcrescentou || !tirou) {",
    "    discordam.push(s + ': poe respeita=' + naoAcrescentou + ', tira reconhece=' + tirou);",
    "  }",
    "}",
    "",
    "// 5. quem nao cumprimentou recebe cumprimento, inclusive falando de horario",
    "const SEM_SAUDACAO = ['quero coxinha', 'retirar boa tarde nao, as 14h', 'pode ser dia 2 de tarde'];",
    "const semCumprimento = SEM_SAUDACAO.filter((f) => comCumprimento(f, AGORA) === f);",
    "",
    "console.log(JSON.stringify({",
    "  medidas: APAGA.length + NAO_APAGA.length + ACEITOU.length + RECUSOU.length +",
    "    NEM_UM_NEM_OUTRO.length + SAUDACOES.length + SEM_SAUDACAO.length,",
    "  erros, discordam, semCumprimento,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-falas.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Frases medidas: " + r.medidas);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("o codigo leu o sim e o nao do cliente errado", r.erros);
cobra("por e tirar cumprimento discordam sobre o que e cumprimento", r.discordam);
cobra("quem nao cumprimentou ficou sem o bom dia da casa", r.semCumprimento);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o sim e o sim, o nao e o nao, e ninguem apaga pedido por engano");
console.log("");
console.log("PASSOU");
