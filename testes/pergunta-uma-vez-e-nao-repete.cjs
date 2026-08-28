// PERGUNTAR UMA VEZ, SIM. REPETIR, NUNCA. E NAO PRENDER O PEDIDO.
//
// POR QUE ISTO EXISTE
//
// O mesmo defeito apareceu duas vezes neste projeto, em lugares diferentes, e
// nas duas o pedido fechava bonito. A regra inteira, com o historico, esta em
// PERGUNTA-E-BOTAO.md, na raiz.
//
// CARA 1, a pergunta que se repete. Bateria dos cinco jeitos, 25/08/2026: o
// cliente mandou o pedido inteiro numa mensagem e ouviu "o bolo vai no prato de
// MDF aberto ou na embalagem com tampa?". Respondeu "isso mesmo, pode
// confirmar" e ouviu A MESMA PERGUNTA. O pedido nunca fechou, nos cinco jeitos.
//
// CARA 2, a pergunta que nunca acontece. O conserto da cara 1 foi deixar passar
// quem ja informou tudo, e com isso quem mandava tudo de uma vez NUNCA era
// perguntado: o papel de arroz, que custa R$ 12 e a padaria vende, deixava de
// ser oferecido. Achado pelo dono em 26/08/2026.
//
// As duas sao a mesma doenca: confundir "o dado que falta" com "a pergunta que
// nao foi feita". O que segura a etapa e a pergunta nao feita.
//
// ESTE TESTE COBRA AS TRES PARTES, nos dois lugares onde o defeito ja morou, e
// cobra tambem o contrario: o que e OBRIGATORIO nao segue nunca, por mais que o
// cliente ignore.
//
// Roda com: node testes/pergunta-uma-vez-e-nao-repete.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-pergunta.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { ETAPAS_DA_FESTA } from "../lib/ia/fluxo/etapas.ts";',
    'import { lerAFrase } from "../lib/ia/fluxo/leitor-da-frase.ts";',
    "",
    "const acha = (id) => ETAPAS_DA_FESTA.find((x) => x.id === id);",
    "const bolo = { produto: 'bolo morango', categoria: 'bolo_festa', qtd: 2, obs: null };",
    "// A base tem TUDO informado de proposito: e o cliente que manda o pedido",
    "// inteiro numa mensagem so, que e onde a cara 2 se esconde.",
    "const base = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:true, naoQuer:[], itens:[bolo],",
    "  dados:{nome:'Ana', data:'12/09/2026', hora:'11:30', pagamento:'pix'},",
    "  pecas:null, topoNome:null, topoIdade:null, tema:null, escrito:null, forminha:null,",
    "  prato:null, ofereceu:false, ultimaFala:null, insistiu:0, retomarEm:null, assunto:null,",
    "};",
    "const com = (p) => ({ ...base, ...p });",
    "const cumpre = (id, p) => acha(id).cumprida(com(p));",
    "",
    "console.log(JSON.stringify({",
    "  pecas: {",
    "    naoFalou:        cumpre('pecas_do_bolo', {}),",
    "    respondeuOsDois: cumpre('pecas_do_bolo', { pecas:{topo:false,papelDeArroz:false} }),",
    "    respondeuSoPapel:cumpre('pecas_do_bolo', { pecas:{topo:null,papelDeArroz:true} }),",
    "    respondeuSoTopo: cumpre('pecas_do_bolo', { pecas:{topo:true,papelDeArroz:null} }),",
    "    // A ETAPA DAS PECAS TEM DUAS PERGUNTAS: o papel e o topo. Ela so segue",
    "    // depois de as DUAS terem saido, e a marca de cada uma prova a sua.",
    "    //",
    "    // Aqui estava so ['pecas_do_bolo'], que era como o fluxo marcava antes",
    "    // de a marca virar por pergunta. Com ela, a marca deixada pelo PAPEL",
    "    // fechava a etapa e o topo nunca era perguntado: medido em 28/08/2026,",
    "    // na terceira conversa do mesmo cenario.",
    "    ignorouDuasVezes:cumpre('pecas_do_bolo', { etapasJaPerguntadas:['pecas_do_bolo','pecas_do_bolo:papel','pecas_do_bolo:topo'] }),",
    "    // E o caso que ela deixava passar: so o papel perguntado, o topo ainda",
    "    // nao. A etapa continua aberta.",
    "    soOPapel:        cumpre('pecas_do_bolo', { etapasJaPerguntadas:['pecas_do_bolo','pecas_do_bolo:papel'] }),",
    "  },",
    "  // A PERGUNTA DO PRATO SAIU EM 28/08/2026, POR DECISAO DO DONO.",
    "  //",
    "  // Ela nao existe no fluxograma da Kemilly e ja estava anotada como decisao",
    "  // em aberto no ARQUITETURA.md. O que decidiu foi uma conversa medida: o",
    "  // cliente ignorou as tres perguntas do bolo e mandou 'pode confirmar', e o",
    "  // pedido fechou com o prato em branco e sem aviso pra equipe.",
    "  //",
    "  // Entao a etapa do bolo termina no SABOR, e o que sobrou aqui e provar",
    "  // isso: ela nao fica presa esperando um prato que ninguem mais pergunta.",
    "  // Quem cobra que a pergunta nao voltou e o",
    "  // `o-bolo-de-festa-nao-fecha-sem-as-pecas`.",
    "  prato: {",
    "    naoFalou:        cumpre('bolo', {}),",
    "    respondeu:       cumpre('bolo', { prato:'aberto' }),",
    "    // A MARCA QUE PROVA A PERGUNTA DO PRATO E 'bolo:prato'.",
    "    //",
    "    // Aqui estava so ['bolo'], e essa marca e ambigua: a etapa do bolo faz",
    "    // DUAS perguntas, o sabor e depois o prato. O teste passava com a marca",
    "    // do sabor, entao ele cobria a MARCA e nao o comportamento -- e o",
    "    // defeito medido em 28/08/2026 (bolo de festa fechando sem prato, sem",
    "    // topo e sem papel de arroz) passava por baixo dele, verde.",
    "    //",
    "    // O fluxo grava as duas quando a pergunta do prato sai.",
    "    ignorouDuasVezes:cumpre('bolo', { etapasJaPerguntadas:['bolo','bolo:prato'] }),",
    "    // E o caso que ele deixava passar: perguntado SO o sabor, a etapa",
    "    // continua aberta, porque o prato ainda nao foi perguntado.",
    "    soOSabor:        cumpre('bolo', { etapasJaPerguntadas:['bolo','bolo:sabor'] }),",
    "  },",
    "  // O obrigatorio nao segue por cansaco: sem pagamento o pedido nao fecha,",
    "  // e e certo que nao feche.",
    "  obrigatorio: {",
    "    semPagamentoIgnorando: cumpre('dados', { dados:{nome:'Ana',data:'12/09/2026',hora:'11:30',pagamento:null}, insistiu:5 }),",
    "    confirmacaoIgnorando:  cumpre('confirmacao', { insistiu:9 }),",
    "  },",
    "  // A resposta ESCRITA vale igual ao botao. Se so o botao responder, a",
    "  // pergunta se repete ate a conversa morrer: foi assim que a cara 1 nasceu.",
    "  escrito: {",
    "    semOsDois:   lerAFrase('quero um bolo de 2 kg de 4 leites, sem topo e sem papel de arroz')?.pecas ?? null,",
    "    comOsDois:   lerAFrase('com papel de arroz e com topo')?.pecas ?? null,",
    "    soOPapelNao: lerAFrase('sem papel de arroz')?.pecas ?? null,",
    "    soOTopoSim:  lerAFrase('quero o topo sim')?.pecas ?? null,",
    "    nadaDisso:   lerAFrase('um bolo de 2 kg de brigadeiro pra sabado as 15h')?.pecas ?? null,",
    "  },",
    "  // A RESPOSTA DA PERGUNTA JUNTADA.",
    "  //",
    "  // Quem manda o pedido inteiro numa mensagem recebe os tres detalhes do",
    "  // bolo numa pergunta so (decisao do dono, 26/08/2026), e responde do jeito",
    "  // que gente responde pergunta juntada. Sem ler isso, a pergunta juntada",
    "  // nao adiantaria: sairia de uma vez e a resposta cairia no vazio.",
    "  juntas: {",
    "    tresDeUmaVez: lerAFrase('prato aberto, sem papel de arroz e sem topo'),",
    "    osDois:       lerAFrase('aberto mesmo, quero os dois'),",
    "    nenhumDosDois:lerAFrase('com tampa, sem nada disso'),",
    "    semPapelCurto:lerAFrase('sem topo e sem papel, prato aberto'),",
    "    // AS ARMADILHAS. \"nenhum dos dois\" contem a palavra dois, e",
    "    // \"quero dois bolos\" e resposta de QUANTIDADE: nenhuma das duas pode",
    "    // virar topo e papel de arroz, e a segunda acrescentaria dois adicionais",
    "    // que ninguem pediu, um deles com preco de tabela.",
    "    nenhumSozinho:lerAFrase('nenhum dos dois')?.pecas ?? null,",
    "    doisBolos:    lerAFrase('quero dois bolos')?.pecas ?? null,",
    "    doisQuilos:   lerAFrase('dois quilos')?.pecas ?? null,",
    "    // O SIM E O NAO VEM DEPOIS DA PALAVRA TAMBEM.",
    "    //",
    "    // \"papel nao\" e como gente responde pergunta juntada, e o leitor olhava",
    "    // so o que vinha ANTES. O 'quero' de trinta caracteres atras valia pro",
    "    // papel e o 'nao' colado nele era ignorado: R$ 12 cobrados de quem",
    "    // recusou com todas as letras.",
    "    naoDepois:    lerAFrase('quero topo sim, papel nao, prato aberto')?.pecas ?? null,",
    "    simDepois:    lerAFrase('topo nao, papel sim, aberto')?.pecas ?? null,",
    "    // \"SO O X\" RESPONDE OS DOIS: sim pra um, NAO pro outro.",
    "    soOPapel:     lerAFrase('aberto, so o papel de arroz')?.pecas ?? null,",
    "    soOTopo:      lerAFrase('com tampa, so o topo')?.pecas ?? null,",
    "  },",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-pergunta.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

const cobra = (rotulo, foi, esperado) => {
  if (foi !== esperado) falhas.push(rotulo + ": cumprida=" + foi + ", esperado " + esperado);
  console.log((foi === esperado ? "ok    " : "ERRO  ") + rotulo);
};

// --------------------------------------------------------------- 1. PERGUNTA
console.log("== 1. se ele nao falou, PERGUNTA (mesmo com o resto todo pronto) ==");
cobra("papel de arroz e topo sao perguntados", r.pecas.naoFalou, false);
// A etapa do bolo NAO fica mais presa pelo prato: ela termina no sabor, e o
// sabor ja esta escolhido no estado deste teste.
cobra("a etapa do bolo nao fica presa esperando o prato", r.prato.naoFalou, true);

// ------------------------------------------------------------ 2. NAO REPETE
console.log("");
console.log("== 2. se ele ja respondeu, NAO PERGUNTA DE NOVO ==");
cobra("respondeu os dois: a etapa fecha", r.pecas.respondeuOsDois, true);
cobra("respondeu so o papel: continua no topo", r.pecas.respondeuSoPapel, false);
cobra("respondeu so o topo: continua no papel", r.pecas.respondeuSoTopo, false);
cobra("respondeu o prato: a etapa fecha", r.prato.respondeu, true);

// ------------------------------------------------------------------ 3. SEGUE
console.log("");
console.log("== 3. ja perguntou e ele falou outra coisa: SEGUE, sem insistir ==");
cobra("as pecas seguem depois das DUAS perguntas ignoradas", r.pecas.ignorouDuasVezes, true);
// E o defeito de 28/08/2026: perguntar o PAPEL nao pode valer como perguntar o
// topo. Sao duas perguntas da mesma etapa, e o topo a equipe precisa orcar.
cobra("perguntar so o papel NAO fecha a etapa das pecas", r.pecas.soOPapel, false);
cobra("a etapa do bolo segue depois de uma pergunta ignorada", r.prato.ignorouDuasVezes, true);
// O caso do "so o sabor" saiu junto com a pergunta do prato: hoje a etapa do
// bolo TEM so a pergunta do sabor, entao responder o sabor fecha ela mesmo.
// Quem cobra que as PECAS continuam abertas nesse ponto (que e o defeito de
// 28/08/2026) e o `o-bolo-de-festa-nao-fecha-sem-as-pecas`.
cobra("perguntado o sabor, a etapa do bolo fecha", r.prato.soOSabor, true);

// -------------------------------------------- o obrigatorio nao segue nunca
console.log("");
console.log("== e o OBRIGATORIO nao segue por cansaco ==");
cobra("sem pagamento o pedido nao fecha, ignore quanto ignorar", r.obrigatorio.semPagamentoIgnorando, false);
cobra("a confirmacao so fecha no botao", r.obrigatorio.confirmacaoIgnorando, false);

// ------------------------------------- a resposta escrita vale igual ao botao
console.log("");
console.log("== a resposta ESCRITA vale igual a tocar no botao ==");
const eq = (rotulo, foi, esperado) => {
  const bate = JSON.stringify(foi) === JSON.stringify(esperado);
  if (!bate) falhas.push(rotulo + ": leu " + JSON.stringify(foi) + ", esperado " + JSON.stringify(esperado));
  console.log((bate ? "ok    " : "ERRO  ") + rotulo + "  ->  " + JSON.stringify(foi));
};
eq("'sem topo e sem papel de arroz' responde os dois", r.escrito.semOsDois, { topo: false, papelDeArroz: false });
eq("'com papel de arroz e com topo' responde os dois", r.escrito.comOsDois, { topo: true, papelDeArroz: true });
eq("'sem papel de arroz' responde SO o papel", r.escrito.soOPapelNao, { papelDeArroz: false });
eq("'quero o topo sim' responde SO o topo", r.escrito.soOTopoSim, { topo: true });
eq("frase que nao fala das pecas nao responde nada", r.escrito.nadaDisso, null);

// ---------------------------------------------------------------------------
// A RESPOSTA DA PERGUNTA JUNTADA.
//
// Quem manda o pedido inteiro numa mensagem recebe os tres detalhes do bolo
// numa pergunta so, em vez de tres perguntas com botao. Decisao do dono em
// 26/08/2026: "somente nesse caso faz a opcao junta as tres numa pergunta so".
//
// Isso so funciona se ela LER a resposta juntada. Sem isso a pergunta sairia de
// uma vez e a resposta cairia no vazio, e a padaria voltaria a perguntar uma
// por uma, que e o interrogatorio que a juntada existe pra evitar.
// ---------------------------------------------------------------------------
console.log("");
console.log("== a resposta da pergunta JUNTADA ==");
eq("'prato aberto, sem papel de arroz e sem topo'", r.juntas.tresDeUmaVez,
  { pecas: { topo: false, papelDeArroz: false }, prato: "aberto" });
eq("'aberto mesmo, quero os dois'", r.juntas.osDois,
  { pecas: { topo: true, papelDeArroz: true }, prato: "aberto" });
eq("'com tampa, sem nada disso'", r.juntas.nenhumDosDois,
  { pecas: { topo: false, papelDeArroz: false }, prato: "tampa" });
eq("'sem topo e sem papel' (papel sem o 'de arroz')", r.juntas.semPapelCurto,
  { pecas: { topo: false, papelDeArroz: false }, prato: "aberto" });

console.log("");
console.log("== e as armadilhas do 'dois' ==");
eq("'nenhum dos dois' e NAO pros dois", r.juntas.nenhumSozinho, { topo: false, papelDeArroz: false });
eq("'quero dois bolos' nao vira topo nem papel", r.juntas.doisBolos, null);
eq("'dois quilos' nao vira topo nem papel", r.juntas.doisQuilos, null);

console.log("");
console.log("== o sim e o nao vem DEPOIS da palavra tambem ==");
// "papel nao" e como gente responde pergunta juntada. O leitor olhava so o que
// vinha ANTES, entao o "quero" de trinta caracteres atras valia pro papel e o
// "nao" colado nele era ignorado: R$ 12 cobrados de quem recusou.
eq("'quero topo sim, papel nao' respeita o nao", r.juntas.naoDepois, { topo: true, papelDeArroz: false });
eq("'topo nao, papel sim' respeita os dois", r.juntas.simDepois, { topo: false, papelDeArroz: true });

console.log("");
console.log("== 'so o X' responde os dois: sim pra um, NAO pro outro ==");
eq("'so o papel de arroz' recusa o topo", r.juntas.soOPapel, { topo: false, papelDeArroz: true });
eq("'so o topo' recusa o papel", r.juntas.soOTopo, { topo: true, papelDeArroz: false });

console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: pergunta uma vez, nao repete o que ja foi dito, e nao prende o pedido.");
