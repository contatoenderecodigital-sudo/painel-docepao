// "TIRA A DE CALABRESA" TEM QUE TIRAR A DE CALABRESA. E SO ELA.
//
// Medido em producao em 30/08/2026, container f8df73f, conversa inteira contra
// o banco:
//
//   cliente >> queria 2 pizzas inteiras, uma de calabresa e uma de frango
//   cliente >> na verdade tira a de calabresa, quero so a de frango
//   padaria >> Fechando: 1 pizza (calabresa) + 1 pizza (frango)  Total R$ 240,00
//
// Ele tirou uma e pagou pelas duas.
//
// O RASTRO DIZ DE QUEM E A CULPA, E NAO E DA IA:
//
//   etapa: abertura / modelo leu: 1x pizza [calabresa] ;; 1x pizza [frango]
//   etapa: dados    / modelo leu: 1x pizza inteira [frango com catupiry]
//
// Na mensagem do cancelamento o modelo devolveu O QUE SOBRA, que era a unica
// coisa que ele conseguia dizer: nao existia campo pra remocao. O fluxo tratou
// isso como atualizacao da linha do frango, e a calabresa ficou intacta.
//
// E O FLUXO ESTAVA CERTO EM FAZER ISSO. Item que some da leitura NAO pode virar
// remocao: e a regra "nada some do pedido", e ela existe porque o modelo omite
// item o tempo todo. O que faltava era o caminho EXPLICITO.
//
// A DIVISAO DE TRABALHO, que e a regra da casa: o modelo devolve a INTENCAO (o
// que o cliente pediu pra tirar, nas palavras dele) e o CODIGO decide qual
// linha sai, casando contra o pedido de verdade. Decisao que custa dinheiro nao
// mora no prompt.
//
// E QUANDO NAO DA PRA TER CERTEZA, NAO SAI NADA. Tirar a linha errada custa o
// mesmo que nao tirar nenhuma, e ainda quebra "nada some do pedido". Duas
// linhas casando com a mesma frase e ambiguidade, nao permissao pra escolher.
//
// Roda com: node testes/tirar-item-tira-a-linha-certa.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-tirar-item.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[],",
    "};",
    "const pensar = (leitura) => (async () => leitura);",
    "const linhas = (e) => (e.itens || []).map((i) => i.produto + (i.obs ? ' [' + i.obs + ']' : ''));",
    "",
    "// O pedido de partida, montado pela leitura da primeira mensagem: duas",
    "// pizzas, uma de cada sabor. E a forma exata que o rastro de producao",
    "// mostrou, com o produto vindo como nome de familia e o sabor separado.",
    "const duasPizzas = await responder(VAZIO as never,",
    "  { texto: 'queria 2 pizzas inteiras, uma de calabresa e uma de frango com catupiry' },",
    "  pensar({ itens:[",
    "    {produto:'pizza inteira',qtd:1,sabor:'calabresa'},",
    "    {produto:'pizza inteira',qtd:1,sabor:'frango com catupiry'},",
    "  ] }) as never);",
    "",
    "const umBolo = await responder(VAZIO as never,",
    "  { texto: 'quero um bolo de chocolate de 2 kg' },",
    "  pensar({ itens:[{produto:'bolo caseiro chocolate',qtd:2}] }) as never);",
    "",
    "const saida: Record<string, string[]> = {};",
    "saida.partida = linhas(duasPizzas.estado);",
    "",
    "// 1. o caso do dinheiro: a frase casa com UMA linha so",
    "const r1 = await responder(duasPizzas.estado as never,",
    "  { texto: 'na verdade tira a de calabresa, quero so a de frango com catupiry' },",
    "  pensar({ tirar:['a de calabresa'], itens:[",
    "    {produto:'pizza inteira',qtd:1,sabor:'frango com catupiry'},",
    "  ] }) as never);",
    "saida.tiraCalabresa = linhas(r1.estado);",
    "",
    "// 2. ambiguo: 'a pizza' casa com as DUAS, entao nao sai nenhuma",
    "const r2 = await responder(duasPizzas.estado as never,",
    "  { texto: 'tira a pizza' },",
    "  pensar({ tirar:['a pizza'] }) as never);",
    "saida.ambiguo = linhas(r2.estado);",
    "",
    "// 3. nao casa com nada: o pedido fica como estava",
    "const r3 = await responder(duasPizzas.estado as never,",
    "  { texto: 'tira a cuca' },",
    "  pensar({ tirar:['a cuca'] }) as never);",
    "saida.semCasar = linhas(r3.estado);",
    "",
    "// 4. uma linha so do produto: sai pelo nome, sem precisar de sabor",
    "const r4 = await responder(umBolo.estado as never,",
    "  { texto: 'pode tirar o bolo' },",
    "  pensar({ tirar:['o bolo'] }) as never);",
    "saida.tiraOBolo = linhas(r4.estado);",
    "",
    "// 5. tirar um e acrescentar outro na MESMA frase",
    "const r5 = await responder(duasPizzas.estado as never,",
    "  { texto: 'tira a de calabresa e poe 100 coxinhas' },",
    "  pensar({ tirar:['a de calabresa'], itens:[{produto:'coxinha',qtd:100}] }) as never);",
    "saida.tiraEPoe = linhas(r5.estado);",
    "",
    "// 6. AMBIGUO VIRA PERGUNTA, e a pergunta cita os dois pra ele escolher.",
    "//    A fala do codigo, sem passar pela reescrita: o teste olha o texto",
    "//    que o motor produziu, que e o unico que da pra prender.",
    "saida.perguntaDoAmbiguo = [r2.fala.texto];",
    "",
    "// 7. a resposta dele na mensagem SEGUINTE tira a certa",
    "const r7 = await responder(r2.estado as never,",
    "  { texto: 'a de calabresa' },",
    "  pensar({ tirar:['a de calabresa'] }) as never);",
    "saida.respondeuQual = linhas(r7.estado);",
    "",
    "// 8. a mesma coisa quando o modelo NAO devolve tirar na resposta: quem",
    "//    resolve e a frase crua dele, porque responder 'a de calabresa' nao",
    "//    parece pedido de remocao pro modelo, parece so uma escolha.",
    "const r8 = await responder(r2.estado as never,",
    "  { texto: 'a de calabresa' },",
    "  pensar({}) as never);",
    "saida.respondeuQualSemCampo = linhas(r8.estado);",
    "",
    "// 9. NAO PODE VIRAR LACO. Se a resposta nao resolve, pergunta UMA vez e",
    "//    segue: a Dora ja prendeu cliente em laco perguntando o sabor pra",
    "//    sempre, e conversa que nao anda perde pedido igual conversa errada.",
    "const r9 = await responder(r2.estado as never,",
    "  { texto: 'sei la, tanto faz' },",
    "  pensar({}) as never);",
    "saida.naoResolveuNaoRepete = [String(!!r9.estado.tirandoQual)];",
    "",
    "// 10. e vale pra QUALQUER produto, nao so pizza: duas trufas de sabores",
    "//     diferentes tem o mesmo problema e a mesma pergunta.",
    "//",
    "//     A primeira versao deste caso usava COXINHA, e estava errada: a",
    "//     coxinha nao tem lista de sabor no catalogo, entao o teste cobrava",
    "//     uma venda que a padaria nao faz. E a mesma armadilha do qa-",
    "//     concorrencia com cuca de banana. A trufa tem morango, uva, cereja e",
    "//     cafe, e ainda por cima e o produto da licao de 19/08, quando quatro",
    "//     linhas dela fecharam cem docinhos onde a cliente pediu vinte e cinco.",
    "const duasTrufas = await responder(VAZIO as never,",
    "  { texto: 'quero 25 trufa de morango e 25 de uva' },",
    "  pensar({ itens:[",
    "    {produto:'trufa',qtd:25,sabor:'morango'},",
    "    {produto:'trufa',qtd:25,sabor:'uva'},",
    "  ] }) as never);",
    "saida.partidaTrufa = linhas(duasTrufas.estado);",
    "const r10 = await responder(duasTrufas.estado as never,",
    "  { texto: 'tira a trufa' },",
    "  pensar({ tirar:['a trufa'] }) as never);",
    "saida.trufaAmbigua = linhas(r10.estado);",
    "saida.perguntaDaTrufa = [r10.fala.texto];",
    "",
    "console.log(JSON.stringify(saida));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-tirar-item.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
function conferir(oque, achado, esperado, dano) {
  const ok = JSON.stringify(achado) === JSON.stringify(esperado);
  console.log(
    (ok ? "ok    " : "ERRO  ") + oque +
    (ok ? "" : "  ->  ficou " + JSON.stringify(achado) + ", esperado " + JSON.stringify(esperado) + "; " + dano),
  );
  if (!ok) erros++;
}

console.log("== o pedido de partida ==");
conferir(
  "duas pizzas, uma de cada sabor",
  saiu.partida,
  ["pizza inteira [calabresa]", "pizza inteira [frango com catupiry]"],
  "sem isto os outros casos nao medem nada",
);

console.log("== tirar ==");
conferir(
  "tira a de calabresa e so ela",
  saiu.tiraCalabresa,
  ["pizza inteira [frango com catupiry]"],
  "o cliente tirou uma e paga pelas duas, R$ 240,00 no lugar de R$ 120,00",
);
conferir(
  "frase ambigua nao tira nada",
  saiu.ambiguo,
  ["pizza inteira [calabresa]", "pizza inteira [frango com catupiry]"],
  "tirar a linha errada custa o mesmo que nao tirar, e ainda some do pedido",
);
conferir(
  "frase que nao casa com nada nao tira nada",
  saiu.semCasar,
  ["pizza inteira [calabresa]", "pizza inteira [frango com catupiry]"],
  "some do pedido o que ninguem mandou tirar",
);
conferir(
  "com uma linha so do produto, o nome basta",
  saiu.tiraOBolo,
  [],
  "o cliente desiste do bolo e leva o bolo",
);
conferir(
  "tirar um e acrescentar outro na mesma frase",
  saiu.tiraEPoe,
  // A COXINHA CHEGA COM O RECHEIO DELA, e isso mudou em 31/08/2026.
  //
  // Antes esperava "coxinha" pelado, e passava por sorte: o recheio so aparecia
  // quando o modelo lembrava de mandar. Agora ele sai do cardapio, onde a
  // coxinha e `saborFixo: frango`. Regra do dono: "a coxinha so tem um sabor,
  // por isso que nao vai ter outro; ta no cardapio".
  //
  // O que este caso mede continua igual: a frase que tira UM e poe OUTRO tem
  // que fazer as duas coisas.
  ["pizza inteira [frango com catupiry]", "coxinha [frango]"],
  "a frase faz as duas coisas, e o pedido tem que refletir as duas",
);

console.log("== o ambiguo vira pergunta, e nao silencio ==");
// Nao prendo o texto inteiro: prender frase palavra por palavra faz o teste
// reprovar quando alguem melhora a escrita, e ai o teste vira estorvo. O que
// PRECISA estar la e o que o cliente usa pra responder: os dois sabores, e uma
// pergunta.
const pergunta = String(saiu.perguntaDoAmbiguo[0] || "");
conferir(
  "a pergunta cita a calabresa",
  [/calabresa/i.test(pergunta)],
  [true],
  "ele nao tem como escolher o que a padaria nao mostrou: " + JSON.stringify(pergunta),
);
conferir(
  "a pergunta cita o frango com catupiry",
  [/frango com catupiry/i.test(pergunta)],
  [true],
  "so um dos dois citados faz ele achar que o outro nem esta no pedido",
);
conferir(
  "e e uma pergunta de verdade",
  [/\?/.test(pergunta)],
  [true],
  "aviso sem pergunta faz o cliente esperar a padaria agir sozinha",
);
conferir(
  "e enquanto pergunta nao tira nada",
  saiu.ambiguo,
  ["pizza inteira [calabresa]", "pizza inteira [frango com catupiry]"],
  "tirar a errada custa o mesmo que nao tirar nenhuma",
);

console.log("== e a resposta dele resolve ==");
conferir(
  "respondendo qual, sai a certa",
  saiu.respondeuQual,
  ["pizza inteira [frango com catupiry]"],
  "perguntar e nao usar a resposta e pior que nao ter perguntado",
);
conferir(
  "resolve mesmo quando o modelo nao devolve tirar",
  saiu.respondeuQualSemCampo,
  ["pizza inteira [frango com catupiry]"],
  "responder 'a de calabresa' parece escolha, nao pedido de remocao: quem tem que resolver e a frase crua",
);
conferir(
  "resposta que nao resolve nao vira laco",
  saiu.naoResolveuNaoRepete,
  ["false"],
  "a Dora ja prendeu cliente perguntando o sabor pra sempre; conversa que nao anda perde pedido",
);

console.log("== e vale pra qualquer produto, nao so pizza ==");
conferir(
  "duas trufas de sabores diferentes sao duas linhas",
  saiu.partidaTrufa,
  ["trufa [morango]", "trufa [uva]"],
  "sem isto o caso abaixo nao mede nada",
);
conferir(
  "e o ambiguo nelas tambem nao tira nada",
  saiu.trufaAmbigua,
  ["trufa [morango]", "trufa [uva]"],
  "a regra e de duas linhas do mesmo nome, nao da pizza",
);
const perguntaTrufa = String(saiu.perguntaDaTrufa[0] || "");
conferir(
  "e a pergunta da trufa cita os dois sabores",
  [/morango/i.test(perguntaTrufa) && /uva/i.test(perguntaTrufa)],
  [true],
  "a pergunta saiu generica demais pra ele conseguir responder: " + JSON.stringify(perguntaTrufa),
);

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
