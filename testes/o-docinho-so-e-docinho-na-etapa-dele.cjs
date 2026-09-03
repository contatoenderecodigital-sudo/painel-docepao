// O DOCINHO SO E DOCINHO NA ETAPA DELE
//
// Terceira peca do fluxo novo: a IA le a frase SABENDO em que etapa esta.
//
// O CASO QUE MOTIVOU O PROJETO INTEIRO
//
// Conversa real da kemilly, 22/08/2026, festa do filho Arthur:
//
//   cliente: 4 leites 1kg e 100 brigadeiros e 100 beijinhos
//   Dora:    Anotei o bolo 4 leites COM BRIGADEIRO, 1 kg
//
// Brigadeiro e sabor de bolo E nome de docinho. Sem etapa, a mesma palavra tem
// dois significados e nada sabe desempatar: nasceram tres guardas so pra isso,
// o bolo foi recusado duas vezes, e a cliente teve que cobrar "ta e os doces q
// eu pedi?".
//
// DUAS TRAVAS, E A SEGUNDA E A QUE IMPORTA
//
// 1. VOCABULARIO: na etapa do salgado so entra salgado. Resolve o caso facil.
//
// 2. QUANTIDADE: o vocabulario sozinho NAO resolve o caso da kemilly, porque
//    bolo de brigadeiro existe de verdade e passa no vocabulario do bolo. O que
//    separa e a unidade: bolo se vende por quilo (1, 2, 3) e docinho por
//    unidade (25, 50, 100). Ninguem encomenda um bolo de 100 quilos.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-leitura.mts");
fs.writeFileSync(
  sonda,
  [
    'import { leituraQueCabeNaEtapa, vocabularioDaEtapa, instrucaoDaEtapa } from "../lib/ia/fluxo/leitura.ts";',
    'import { ETAPAS_DA_FESTA } from "../lib/ia/fluxo/etapas.ts";',
    "const vazio = { ehFesta:true, pessoas:20, base:null, baseAceita:true, itens:[], naoQuer:[], dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null };",
    "const r = {",
    // o caso da kemilly, na etapa do bolo
    "  kemilly: leituraQueCabeNaEtapa('bolo', { itens:[{produto:'4 leites',qtd:1},{produto:'brigadeiro',qtd:100},{produto:'beijinho',qtd:100}] }),",
    // bolo de brigadeiro de verdade
    "  boloDeBrigadeiro: leituraQueCabeNaEtapa('bolo', { itens:[{produto:'brigadeiro',qtd:2}] }),",
    // docinho na etapa certa
    "  docinhoNaEtapa: leituraQueCabeNaEtapa('docinho', { itens:[{produto:'brigadeiro',qtd:100},{produto:'beijinho',qtd:100}] }),",
    // salgado com sabor colado no nome
    "  saborColado: leituraQueCabeNaEtapa('salgado', { itens:[{produto:'esfirra de carne',qtd:40},{produto:'brigadeiro',qtd:20}] }),",
    "  vocab: { salgado: vocabularioDaEtapa('salgado').length, docinho: vocabularioDaEtapa('docinho').length, bolo: vocabularioDaEtapa('bolo').length },",
    "  // A instrucao tem DUAS partes, e so uma delas e minha:",
    "  //",
    "  //   REGRA     o que a IA tem que obedecer. Escrita por mim, e e ela que",
    "  //             faz o modelo se perder quando cresce.",
    "  //   CARDAPIO  a lista de produtos da etapa. Cresce quando a DONA cadastra",
    "  //             coisa nova na tela, e nao quando eu escrevo mais regra.",
    "  //",
    "  // O limite tem que ser da regra. Medindo o total, o teste reprovava por",
    "  // motivo que nao e defeito: em 27/08/2026 o vocabulario do bolo passou a",
    "  // incluir os quinze bolos CASEIROS, que estavam barrados por engano, e o",
    "  // teste ficou vermelho por causa de um conserto.",
    "  // TODAS as etapas, tiradas de `etapas.ts`. Aqui havia uma lista de cinco",
    "  // escrita a mao, e ela deixou passar o defeito que ela existe pra pegar:",
    "  // em 28/08/2026 a instrucao da OFERTA nasceu com 1788 caracteres, a maior",
    "  // do sistema, e o teste ficou verde porque a oferta nao estava na lista.",
    "  //",
    "  // Etapa nova em `etapas.ts` passa a ser medida sozinha, sem ninguem",
    "  // lembrar de vir aqui acrescentar.",
    "  instrucoes: ETAPAS_DA_FESTA.map((x) => x.id).map((e) => {",
    "    const inteira = instrucaoDaEtapa(e as never, vazio as never);",
    "    const soRegra = inteira.split('Cardápio da casa')[0];",
    "    return { e, n: inteira.length, regra: soRegra.length };",
    "  }),",
    "};",
    "console.log(JSON.stringify(r));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-leitura.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const nomes = (x) => (x.limpa.itens ?? []).map((i) => i.produto);

// ------------------------------------------------------ o caso da kemilly
//
// DESDE 03/09/2026 O PORTAO NAO E MAIS POR ETAPA: o modelo ve a conversa e o
// cardapio inteiro, e anota tudo. O que este caso cobra agora e que os 100
// brigadeiros e os 100 beijinhos ENTRAM (nada some) e entram como DOCINHO, sem
// o prefixo de bolo; e que o bolo de 4 leites, em quilos, entra como bolo.
{
  const dentro = nomes(r.kemilly);
  if (!dentro.some((n) => /4 leites/.test(n))) falhas.push("o bolo de 4 leites nao entrou: " + dentro.join(", "));
  if (!dentro.some((n) => /4 leites/.test(n) && /^bolo/.test(n))) {
    falhas.push("o 4 leites de 1 kg, respondendo a pergunta do bolo, nao ganhou o prefixo de bolo: " + dentro.join(", "));
  }
  if (!dentro.includes("brigadeiro")) falhas.push("os 100 brigadeiros nao entraram como docinho: " + dentro.join(", "));
  if (dentro.some((n) => /^bolo.*brigadeiro/.test(n))) {
    falhas.push("os 100 brigadeiros entraram como BOLO de novo (o defeito da kemilly voltou)");
  }
  if (!dentro.includes("beijinho")) falhas.push("os 100 beijinhos sumiram: " + dentro.join(", "));
  if (dentro.length !== 3) falhas.push("entraram " + dentro.length + " itens em vez de 3: " + dentro.join(", "));
}

// -------------------------------------- bolo de brigadeiro DE VERDADE passa
if (!nomes(r.boloDeBrigadeiro).some((n) => /brigadeiro/.test(n) && /^bolo/.test(n))) {
  falhas.push("bolo de brigadeiro de 2 kg, respondendo a pergunta do bolo, nao entrou como bolo: " + nomes(r.boloDeBrigadeiro).join(", "));
}

// --------------------------------------------- docinho na etapa do docinho
{
  const d = nomes(r.docinhoNaEtapa);
  if (d.length !== 2) falhas.push("na etapa do docinho os docinhos foram barrados: " + d.join(", "));
}

// -------------------------------------------- nome com sabor colado passa
{
  const s = nomes(r.saborColado);
  if (!s.includes("esfirra de carne")) falhas.push("'esfirra de carne' foi barrado na etapa do salgado");
  if (!s.includes("brigadeiro")) falhas.push("brigadeiro citado na etapa do salgado sumiu (nada some)");
}

// ------------------------------------------- o vocabulario existe mesmo
if (r.vocab.salgado < 10) falhas.push("o vocabulario do salgado esta pequeno demais: " + r.vocab.salgado);
if (r.vocab.docinho < 5) falhas.push("o vocabulario do docinho sumiu: " + r.vocab.docinho);
if (r.vocab.bolo < 5) falhas.push("o vocabulario do bolo sumiu: " + r.vocab.bolo);

// ---------------------------------- a instrucao e curta, e tem que continuar
// A carta de trinta paginas da versao antiga ia em TODA mensagem e era parte do
// problema: a IA precisava saber tudo porque decidia tudo. Aqui ela decide uma
// coisa so, entao a instrucao cabe em um paragrafo.
for (const { e, n, regra } of r.instrucoes) {
  // A REGRA e o que nao pode inchar: e ela que faz o modelo se perder.
  //
  // O TETO E 1400 PORQUE E O QUE O LIMITE ANTIGO JA PERMITIA, e nao um numero
  // escolhido pra caber o que eu acabei de escrever. O limite era 1500 sobre o
  // TOTAL; a etapa `pecas_do_bolo` nao tem cardapio, entao seu total sempre foi
  // regra pura, e ela passava com 1371. Baixar pra 1200 seria reprovar uma
  // instrucao que nunca foi problema.
  //
  // Ela e a maior porque decide QUATRO coisas: topo, papel de arroz, tema, e o
  // nome com a idade do aniversariante. Cada linha ali nasceu de defeito real,
  // e a mais cara delas veio do teste da Kemilly, que disse "nao quero topo"
  // tres vezes e continuou sendo perguntada. Cortar ali e reintroduzir defeito
  // conhecido pra ganhar caractere.
  // O TETO SUBIU EM 03/09/2026, E O MOTIVO ESTA MEDIDO. O 1400 nasceu quando a
  // instrucao era so a da etapa e o modelo era cego: a regra tinha que ser
  // curta porque era a unica coisa que ele via. Agora as regras de catalogo que
  // estavam repartidas por etapa (prefixo do bolo, peso em quilos, mini pizza,
  // uma linha por sabor, qtd 0) vao num bloco so, em toda mensagem, e a conversa
  // vai junto. O que faz o modelo se perder e regra que se contradiz, nao regra
  // que cabe em 2.500 caracteres.
  if (regra > 3000) {
    falhas.push("a REGRA da etapa " + e + " ja tem " + regra + " caracteres; esta virando carta");
  }
  // O CARDAPIO INTEIRO VAI EM TODA ETAPA (86 produtos, com apelidos). O teto do
  // total existe so pra pegar crescimento desgovernado, e nao pra impedir a dona
  // de cadastrar produto.
  if (n > 7000) {
    falhas.push("a instrucao da etapa " + e + " passou de 7000 com o cardapio junto: " + n);
  }
}

console.log("Vocabulario: salgado " + r.vocab.salgado + ", docinho " + r.vocab.docinho + ", bolo " + r.vocab.bolo);
console.log("Instrucoes (regra + cardapio): " + r.instrucoes.map((x) => x.e + " " + x.regra + "+" + (x.n - x.regra)).join(", "));
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: o docinho so e docinho na etapa dele, e o bolo de brigadeiro continua existindo.");
