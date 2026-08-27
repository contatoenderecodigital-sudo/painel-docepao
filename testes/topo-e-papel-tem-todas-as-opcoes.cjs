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
    "  pecas:null, topoNome:null, topoIdade:null, tema:null, escrito:null, forminha:null,",
    "  prato:null, ofereceu:false, ultimaFala:null, insistiu:0, retomarEm:null, assunto:null,",
    "};",
    "const com = (p) => ({ ...base, ...p });",
    "// AS PERGUNTAS SEPARADAS SAO DA CONVERSA PICADA.",
    "//",
    "// Quem manda o pedido inteiro numa mensagem recebe os TRES detalhes do bolo",
    "// numa pergunta so (decisao do dono, 26/08/2026), sem botao. Quem responde",
    "// uma coisa por vez continua recebendo uma pergunta de cada vez, com botao,",
    "// que e o que a clientela da padaria enxerga melhor na tela.",
    "//",
    "// Entao aqui os dados de retirada ficam VAZIOS: e assim que a conversa esta",
    "// quando as pecas sao perguntadas uma a uma. Com a base cheia, este teste",
    "// passaria a medir a pergunta juntada sem querer.",
    "const semDados = { nome:null, data:null, hora:null, pagamento:null };",
    "const fala = (p) => falaDaEtapa(etapa, { ...com(p), dados: semDados });",
    "",
    "console.log(JSON.stringify({",
    "  // a primeira pergunta, sem nada respondido",
    "  primeira: fala({}),",
    "  // respondeu do papel: agora vem a do topo",
    "  depoisDoPapel: fala({ pecas: { topo: null, papelDeArroz: true } }),",
    "  depoisDoPapelNao: fala({ pecas: { topo: null, papelDeArroz: false } }),",
    "  // topo sim, papel respondido: falta nome e idade",
    "  tema: fala({ pecas: { topo: true, papelDeArroz: false } }),",
    "  temaDoPapel: fala({ pecas: { topo: false, papelDeArroz: true } }),",
    "  faltaTudo: fala({ pecas: { topo: true, papelDeArroz: false }, tema: 'Minnie' }),",
    "  escritoNada: fala({ pecas: { topo: true, papelDeArroz: false }, tema: 'Minnie', escrito: 'nada' }),",
    "  // as quatro combinacoes cumprem a etapa?",
    "  cumpre: {",
    "    osDois: etapa.cumprida(com({ pecas:{topo:true,papelDeArroz:true}, tema:'Minnie', escrito:'Arthur, 5 anos' })),",
    "    soTopo: etapa.cumprida(com({ pecas:{topo:true,papelDeArroz:false}, tema:'Minnie', escrito:'Arthur, 5 anos' })),",
    "    soPapel: etapa.cumprida(com({ pecas:{topo:false,papelDeArroz:true}, tema:'Minnie', escrito:'Arthur, 5 anos' })),",
    "    nenhum: etapa.cumprida(com({ pecas:{topo:false,papelDeArroz:false} })),",
    "    // METADE RESPONDIDA, NO MEIO DA CONVERSA.",
    "    //",
    "    // Aqui os dados de retirada ainda NAO foram dados, que e o estado real",
    "    // de quem esta respondendo as pecas: e nesse ponto que a etapa tem que",
    "    // segurar, senao a segunda pergunta nunca sai.",
    "    //",
    "    // Antes este caso usava a base inteira, com nome, data, hora e",
    "    // pagamento ja preenchidos, e ali vale a regra oposta (a de baixo).",
    "    metade: etapa.cumprida({ ...com({ pecas:{topo:null,papelDeArroz:true} }),",
    "      dados:{nome:null,data:null,hora:null,pagamento:null} }),",
    "    metadeOutroLado: etapa.cumprida({ ...com({ pecas:{topo:true,papelDeArroz:null} }),",
    "      dados:{nome:null,data:null,hora:null,pagamento:null} }),",
    "    // PERGUNTAR UMA VEZ, SIM. REPETIR, NUNCA.",
    "    //",
    "    // Regra do dono, 26/08/2026. Aqui a base ja tem nome, data, hora e",
    "    // pagamento: e o cliente que mandou TUDO numa mensagem so. Mesmo",
    "    // assim a etapa NAO pode se dar por cumprida, porque ele nunca foi",
    "    // perguntado do papel de arroz, que custa R$ 12 e a padaria vende.",
    "    //",
    "    // Existia um atalho aqui que dizia o contrario, e ele nasceu certo:",
    "    // era o conserto do pedido que nunca fechava. So que fazia demais, e",
    "    // a oferta deixava de acontecer.",
    "    completoSemAsPecas: etapa.cumprida(com({ pecas:null })),",
    "    // E o outro lado da mesma regra: quem JA respondeu nao ouve de novo.",
    "    completoComAsPecasRespondidas: etapa.cumprida(com({ pecas:{topo:false,papelDeArroz:false} })),",
    "    topoSemNome: etapa.cumprida(com({ pecas:{topo:true,papelDeArroz:true}, tema:'Minnie' })),",
    "    papelSemTema: etapa.cumprida(com({ pecas:{topo:false,papelDeArroz:true} })),",
    "  },",
    "  // A PERGUNTA JUNTADA, pra quem mandou o pedido inteiro numa mensagem.",
    "  // Aqui a base VALE, com nome, data, hora e pagamento preenchidos.",
    "  juntada: falaDaEtapa(etapa, com({})),",
    "  juntadaComPrato: falaDaEtapa(etapa, com({ prato:'aberto' })),",
    "  // Faltando UM so, a pergunta juntada nao vale a pena: volta a normal.",
    "  juntadaSoUm: falaDaEtapa(etapa, com({ prato:'aberto', pecas:{topo:null,papelDeArroz:true} })),",
    "  // o pedido fecha sem o nome do aniversariante?",
    "  fechaSemNome: oQueFaltaPraFechar(com({ pecas:{topo:true,papelDeArroz:true} })),",
    "  fechaComTudo: oQueFaltaPraFechar(com({ pecas:{topo:true,papelDeArroz:true}, tema:'Minnie', escrito:'Arthur, 5 anos' })),",
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
//
// O PAPEL DE ARROZ VEM PRIMEIRO. Decisao do dono em 26/08/2026, e ela tem
// motivo de dinheiro: o papel tem preco de tabela (R$ 12) e o motor cota na
// hora, enquanto o topo nao tem preco e depende da equipe lancar depois.
// Perguntar primeiro o que fecha sozinho e perguntar por ultimo o que precisa
// de gente.
//
// Este teste cobrava a ordem contraria, que era a de antes.
if (!/papel/i.test(r.primeira.texto) || /topo/i.test(r.primeira.texto)) {
  falhas.push("a primeira pergunta nao e so do papel de arroz: " + r.primeira.texto);
}
if (ids(r.primeira) !== "papel_sim,papel_nao") {
  falhas.push("os botoes do papel estao errados: " + ids(r.primeira));
}
for (const [nome, f] of [["depoisDoPapel", r.depoisDoPapel], ["depoisDoPapelNao", r.depoisDoPapelNao]]) {
  if (!/topo/i.test(f.texto)) falhas.push(nome + ": depois do papel tinha que vir o topo, veio: " + f.texto);
  if (ids(f) !== "topo_sim,topo_nao") falhas.push(nome + ": botoes do topo errados: " + ids(f));
}

// Tres botoes e o limite da Meta. Dois cabem em qualquer aparelho.
for (const f of [r.primeira, r.depoisDoPapel, r.faltaTudo]) {
  if ((f.botoes ?? []).length > 3) falhas.push("mais de tres botoes numa mensagem: o WhatsApp recusa");
  for (const b of f.botoes ?? []) {
    if (b.titulo.length > 20) falhas.push("botao com mais de 20 caracteres: " + b.titulo);
  }
}

// ------------------------------------------------ o preco do papel sai do motor
// A do papel agora e a PRIMEIRA pergunta, e e ela que carrega o valor.
if (!/12/.test(r.primeira.texto)) {
  falhas.push("a pergunta do papel de arroz nao diz o valor que o motor cota: " + r.primeira.texto);
}
if (r.primeira.podeReescrever !== false) {
  falhas.push("a fala do papel de arroz tem valor e ainda assim pode ser reescrita pela IA");
}

// ---------------------------------------------------------------------------
// QUEM MANDOU TUDO NUMA MENSAGEM SO OUVE UMA PERGUNTA SO.
//
// Decisao do dono, 26/08/2026: "somente nesse caso faz a opcao junta as tres
// numa pergunta so".
//
// O motivo e de conversa, e ele esta certo: quem escreve o pedido inteiro num
// bloco esta mostrando que nao quer pingue-pongue. Quem responde picado ja esta
// no ritmo de troca curta, onde o botao ajuda.
//
// Sem isto ele levava QUATRO mensagens pra fechar, respondendo prato, papel e
// topo um de cada vez, depois de ja ter mandado item, data, hora, nome e
// pagamento. Medido na bateria dos cinco jeitos.
// ---------------------------------------------------------------------------
console.log("");
console.log("Pergunta juntada:  " + (r.juntada.texto || "").slice(0, 96));
for (const parte of ["prato", "papel de arroz", "topo"]) {
  if (!new RegExp(parte, "i").test(String(r.juntada.texto ?? ""))) {
    falhas.push("a pergunta juntada nao fala de " + parte + ": " + r.juntada.texto);
  }
}
// O valor do papel sai do motor aqui tambem: e o mesmo numero do cardapio, e
// escrever "R$ 12" a mao seria mais um lugar pra divergir no dia em que mudar.
if (!/12/.test(String(r.juntada.texto ?? ""))) {
  falhas.push("a pergunta juntada nao diz o valor do papel de arroz: " + r.juntada.texto);
}
if (r.juntada.podeReescrever !== false) {
  falhas.push("a pergunta juntada tem valor e ainda assim pode ser reescrita pela IA");
}
// Com o prato ja respondido sobram DOIS, e dois ainda vale juntar.
if (!/papel de arroz/i.test(String(r.juntadaComPrato.texto ?? "")) || !/topo/i.test(String(r.juntadaComPrato.texto ?? ""))) {
  falhas.push("com o prato respondido, os outros dois deviam vir juntos: " + r.juntadaComPrato.texto);
}
if (/prato/i.test(String(r.juntadaComPrato.texto ?? ""))) {
  falhas.push("a juntada esta perguntando de novo o prato que ele ja respondeu");
}
// Faltando UM so, juntar nao ajuda: a pergunta normal, com botao, e melhor.
if (ids(r.juntadaSoUm) !== "topo_sim,topo_nao") {
  falhas.push("faltando so o topo, tinha que voltar a pergunta normal com botao: " + ids(r.juntadaSoUm));
}

// -------------------------------- o tema e a foto de referencia
for (const [nome, f] of [["topo", r.tema], ["papel de arroz", r.temaDoPapel]]) {
  if (!/tema/i.test(f.texto)) falhas.push("com " + nome + " ela nao pergunta o tema: " + f.texto);
  if (!/imagem|foto|refer/i.test(f.texto)) falhas.push("com " + nome + " ela nao pede imagem de referencia: " + f.texto);
}

// ------------------------- o que vai escrito na peca, e "nada" tambem vale
//
// Ate 23/08 a padaria exigia nome E idade, e cobrava um de cada vez. Em
// 24/08/2026 o dono cortou: "a informacao que voce precisa coletar e o tema e o
// que o cliente quer escrito no topo, ISSO SE ELE QUISER algo escrito".
//
// Tem topo que e so o desenho, e exigir nome e idade de quem nao quer nada
// escrito trava a conversa por uma regra que a padaria nao tem.
if (!/escrito/i.test(r.faltaTudo.texto)) {
  falhas.push("com topo, ela nao pergunta o que vai escrito na peca: " + r.faltaTudo.texto);
}
if (!/nada|desenho/i.test(r.faltaTudo.texto)) {
  falhas.push("a pergunta nao deixa claro que 'nada' e resposta: " + r.faltaTudo.texto);
}
// E ela fala da peca que ele pediu, nunca do topo pra quem recusou o topo.
if (/topo/i.test(r.temaDoPapel.texto)) {
  falhas.push("falou em topo pra quem so quer papel de arroz: " + r.temaDoPapel.texto);
}

// ---------------------------------------- as quatro combinacoes existem
const esperado = { osDois: true, soTopo: true, soPapel: true, nenhum: true,
  metade: false, metadeOutroLado: false,
  completoSemAsPecas: false, completoComAsPecasRespondidas: true,
  topoSemNome: false, papelSemTema: false };
for (const [caso, deve] of Object.entries(esperado)) {
  if (r.cumpre[caso] !== deve) {
    falhas.push("a etapa das pecas com '" + caso + "' devia " + (deve ? "" : "NAO ") + "estar cumprida");
  }
}

// -------------------------------------- pedido com topo nao fecha sem nome
// Sem NINGUEM ter perguntado o que vai escrito, o pedido nao fecha: a peca iria
// pra fabrica sem ninguem saber se leva nome, frase ou nada.
if (!r.fechaSemNome.some((x) => /escrito/i.test(x))) {
  falhas.push("pedido com topo fecharia sem ninguem perguntar o que vai escrito na peca");
}
if (!r.fechaSemNome.some((x) => /tema/i.test(x))) {
  falhas.push("pedido com topo fecharia sem o tema da peca");
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
console.log("Segunda pergunta:  " + r.depoisDoPapel.texto + "   [" + ids(r.depoisDoPapel) + "]");
console.log("Com topo:          " + r.faltaTudo.texto);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: as quatro combinacoes tem caminho, e o topo nunca ganha preco.");
