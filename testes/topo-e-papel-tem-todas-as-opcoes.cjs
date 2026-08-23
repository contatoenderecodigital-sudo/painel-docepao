// TOPO E PAPEL DE ARROZ: AS QUATRO COMBINACOES, E O NOME DO ANIVERSARIANTE
//
// O WhatsApp so deixa mandar TRES botoes por mensagem (limite da Meta), e as
// opcoes de verdade sao quatro: os dois, so o topo, so o papel, nenhum. A versao
// anterior tinha "Os dois", "So o topo" e "Nenhum", e quem quisesse so o papel
// de arroz nao tinha onde tocar.
//
// O dono escolheu resolver com DUAS PERGUNTAS DE SIM E NAO em vez de uma lista
// de quatro linhas, porque a lista esconde as opcoes atras de um toque e ele
// conhece a clientela da padaria. Duas perguntas cobrem as quatro combinacoes e
// deixam tudo visivel na tela.
//
// AS REGRAS DE DINHEIRO QUE ESTE TESTE PROTEGE
//
// 1. PAPEL DE ARROZ TEM PRECO DE TABELA (R$ 12) e o motor cota. Dizer sim vira
//    item do pedido, entra na conta e sai na comanda.
//
// 2. TOPO NAO TEM PRECO NENHUM. Cada peca e fabricada com o tema, o nome e a
//    idade, e quem lanca o valor e a equipe, na tela. Ele NAO vira item: vira
//    observacao do bolo, e o pedido vai pra fila com o motivo na frente.
//
// 3. ELA NUNCA DIZ QUANTO CUSTA O TOPO. Nem "em torno de R$ 30", que foi o que
//    ela chutou no teste ao vivo de 20/08. Isso e ancora, nao estimativa: o
//    cliente le 30, a equipe lanca 45, e a diferenca vira briga no balcao. Uma
//    companhia aerea ja foi obrigada por tribunal a honrar o numero que o robo
//    dela inventou.
//
// 4. NOME E IDADE SAO OBRIGATORIOS QUANDO TEM TOPO. Pedido do dono, e ele esta
//    certo: sem os dois a cozinha nao tem o que escrever na peca.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-pecas.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { falaDaEtapa } from "../lib/ia/fluxo/pergunta.ts";',
    'import { ETAPAS_DA_FESTA } from "../lib/ia/fluxo/etapas.ts";',
    'import { oQueFaltaPraFechar } from "../lib/ia/fluxo/fechar.ts";',
    "",
    'const etapa = ETAPAS_DA_FESTA.find((e) => e.id === "pecas_do_bolo");',
    "const bolo = { produto: 'bolo morango', categoria: 'bolo_festa', qtd: 2, obs: null };",
    "const base = {",
    "  ehFesta:true, pessoas:20, base:null, baseAceita:true, naoQuer:[], itens:[bolo],",
    "  dados:{nome:'Sandro', data:'12/09/2026', hora:'11:30', pagamento:'pix'},",
    "  pecas:null, topoNome:null, topoIdade:null, tema:null, retomarEm:null, assunto:null,",
    "};",
    "const com = (p) => ({ ...base, ...p });",
    "const fala = (p) => falaDaEtapa(etapa, com(p));",
    "",
    "console.log(JSON.stringify({",
    "  // a primeira pergunta, sem nada respondido",
    "  primeira: fala({}),",
    "  // respondeu do topo: agora vem a do papel",
    "  depoisDoTopo: fala({ pecas: { topo: true, papelDeArroz: null } }),",
    "  depoisDoTopoNao: fala({ pecas: { topo: false, papelDeArroz: null } }),",
    "  // topo sim, papel respondido: falta nome e idade",
    "  tema: fala({ pecas: { topo: true, papelDeArroz: false } }),",
    "  temaDoPapel: fala({ pecas: { topo: false, papelDeArroz: true } }),",
    "  faltaTudo: fala({ pecas: { topo: true, papelDeArroz: false }, tema: 'Minnie' }),",
    "  faltaIdade: fala({ pecas: { topo: true, papelDeArroz: false }, tema: 'Minnie', topoNome: 'Arthur' }),",
    "  faltaNome: fala({ pecas: { topo: true, papelDeArroz: false }, tema: 'Minnie', topoIdade: '5 anos' }),",
    "  // as quatro combinacoes cumprem a etapa?",
    "  cumpre: {",
    "    osDois: etapa.cumprida(com({ pecas:{topo:true,papelDeArroz:true}, tema:'Minnie', topoNome:'Arthur', topoIdade:'5' })),",
    "    soTopo: etapa.cumprida(com({ pecas:{topo:true,papelDeArroz:false}, tema:'Minnie', topoNome:'Arthur', topoIdade:'5' })),",
    "    soPapel: etapa.cumprida(com({ pecas:{topo:false,papelDeArroz:true}, tema:'Minnie', topoNome:'Arthur', topoIdade:'5' })),",
    "    nenhum: etapa.cumprida(com({ pecas:{topo:false,papelDeArroz:false} })),",
    "    metade: etapa.cumprida(com({ pecas:{topo:true,papelDeArroz:null} })),",
    "    topoSemNome: etapa.cumprida(com({ pecas:{topo:true,papelDeArroz:true}, tema:'Minnie' })),",
    "    papelSemTema: etapa.cumprida(com({ pecas:{topo:false,papelDeArroz:true} })),",
    "  },",
    "  // o pedido fecha sem o nome do aniversariante?",
    "  fechaSemNome: oQueFaltaPraFechar(com({ pecas:{topo:true,papelDeArroz:true} })),",
    "  fechaComTudo: oQueFaltaPraFechar(com({ pecas:{topo:true,papelDeArroz:true}, tema:'Minnie', topoNome:'Arthur', topoIdade:'5 anos' })),",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pecas.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const ids = (f) => (f.botoes ?? []).map((b) => b.id).join(",");

// --------------------------------------------- uma pergunta de cada vez
if (!/topo/i.test(r.primeira.texto) || /papel/i.test(r.primeira.texto)) {
  falhas.push("a primeira pergunta nao e so do topo: " + r.primeira.texto);
}
if (ids(r.primeira) !== "topo_sim,topo_nao") {
  falhas.push("os botoes do topo estao errados: " + ids(r.primeira));
}
for (const [nome, f] of [["depoisDoTopo", r.depoisDoTopo], ["depoisDoTopoNao", r.depoisDoTopoNao]]) {
  if (!/papel/i.test(f.texto)) falhas.push(nome + ": depois do topo tinha que vir o papel de arroz, veio: " + f.texto);
  if (ids(f) !== "papel_sim,papel_nao") falhas.push(nome + ": botoes do papel errados: " + ids(f));
}

// Tres botoes e o limite da Meta. Dois cabem em qualquer aparelho.
for (const f of [r.primeira, r.depoisDoTopo, r.faltaTudo]) {
  if ((f.botoes ?? []).length > 3) falhas.push("mais de tres botoes numa mensagem: o WhatsApp recusa");
  for (const b of f.botoes ?? []) {
    if (b.titulo.length > 20) falhas.push("botao com mais de 20 caracteres: " + b.titulo);
  }
}

// ------------------------------------------------ o preco do papel sai do motor
if (!/12/.test(r.depoisDoTopo.texto)) {
  falhas.push("a pergunta do papel de arroz nao diz o valor que o motor cota: " + r.depoisDoTopo.texto);
}
if (r.depoisDoTopo.podeReescrever !== false) {
  falhas.push("a fala do papel de arroz tem valor e ainda assim pode ser reescrita pela IA");
}

// -------------------------------- o tema e a foto de referencia
for (const [nome, f] of [["topo", r.tema], ["papel de arroz", r.temaDoPapel]]) {
  if (!/tema/i.test(f.texto)) falhas.push("com " + nome + " ela nao pergunta o tema: " + f.texto);
  if (!/imagem|foto|refer/i.test(f.texto)) falhas.push("com " + nome + " ela nao pede imagem de referencia: " + f.texto);
}

// ----------------------------------------- o nome e a idade sao cobrados
if (!/nome/i.test(r.faltaTudo.texto) || !/idade/i.test(r.faltaTudo.texto)) {
  falhas.push("com topo, ela nao pergunta nome e idade numa frase so: " + r.faltaTudo.texto);
}
if (!/idade|anos/i.test(r.faltaIdade.texto) || /nome/i.test(r.faltaIdade.texto)) {
  falhas.push("faltando so a idade, ela devia perguntar so a idade: " + r.faltaIdade.texto);
}
if (!/nome/i.test(r.faltaNome.texto)) {
  falhas.push("faltando so o nome, ela devia perguntar so o nome: " + r.faltaNome.texto);
}

// ---------------------------------------- as quatro combinacoes existem
const esperado = { osDois: true, soTopo: true, soPapel: true, nenhum: true, metade: false,
  topoSemNome: false, papelSemTema: false };
for (const [caso, deve] of Object.entries(esperado)) {
  if (r.cumpre[caso] !== deve) {
    falhas.push("a etapa das pecas com '" + caso + "' devia " + (deve ? "" : "NAO ") + "estar cumprida");
  }
}

// -------------------------------------- pedido com topo nao fecha sem nome
if (!r.fechaSemNome.some((x) => /nome do aniversariante/i.test(x))) {
  falhas.push("pedido com topo fecharia sem o nome do aniversariante: a cozinha nao sabe o que escrever");
}
if (!r.fechaSemNome.some((x) => /idade/i.test(x))) {
  falhas.push("pedido com topo fecharia sem a idade do aniversariante");
}
if (r.fechaComTudo.length) {
  falhas.push("com nome e idade o pedido ainda nao fecha, falta: " + r.fechaComTudo.join(", "));
}

// ------------------------------ e ela NUNCA diz quanto custa o topo
const fonte = ["pergunta", "fluxo", "leitura", "fechar"]
  .map((f) => fs.readFileSync(path.join(__dirname, "..", "lib/ia/fluxo/" + f + ".ts"), "utf8"))
  .join(String.fromCharCode(10))
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
if (/topo[^"']{0,60}R\$/i.test(fonte) || /R\$[^"']{0,40}topo/i.test(fonte)) {
  falhas.push("apareceu valor junto da palavra topo no codigo: o topo nao tem preco de tabela");
}
// E o topo nao pode virar item do pedido: o motor nao cota, e a comanda
// imprimiria duas vezes a mesma coisa.
if (/produto: "topo/i.test(fonte)) {
  falhas.push("o topo virou item do pedido: ele nao esta no motor e o total sairia errado");
}

console.log("Primeira pergunta: " + r.primeira.texto + "   [" + ids(r.primeira) + "]");
console.log("Segunda pergunta:  " + r.depoisDoTopo.texto + "   [" + ids(r.depoisDoTopo) + "]");
console.log("Com topo:          " + r.faltaTudo.texto);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: as quatro combinacoes tem caminho, e o topo nunca ganha preco.");
