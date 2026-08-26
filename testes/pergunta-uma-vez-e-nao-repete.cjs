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
    "    ignorouDuasVezes:cumpre('pecas_do_bolo', { insistiu:1 }),",
    "  },",
    "  prato: {",
    "    naoFalou:        cumpre('bolo', {}),",
    "    respondeu:       cumpre('bolo', { prato:'aberto' }),",
    "    ignorouDuasVezes:cumpre('bolo', { insistiu:1 }),",
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
cobra("o prato do bolo e perguntado", r.prato.naoFalou, false);

// ------------------------------------------------------------ 2. NAO REPETE
console.log("");
console.log("== 2. se ele ja respondeu, NAO PERGUNTA DE NOVO ==");
cobra("respondeu os dois: a etapa fecha", r.pecas.respondeuOsDois, true);
cobra("respondeu so o papel: continua no topo", r.pecas.respondeuSoPapel, false);
cobra("respondeu so o topo: continua no papel", r.pecas.respondeuSoTopo, false);
cobra("respondeu o prato: a etapa fecha", r.prato.respondeu, true);

// ------------------------------------------------------------------ 3. SEGUE
console.log("");
console.log("== 3. se ele ignorou duas vezes, SEGUE ==");
cobra("as pecas seguem depois de duas tentativas", r.pecas.ignorouDuasVezes, true);
cobra("o prato segue depois de duas tentativas", r.prato.ignorouDuasVezes, true);

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

console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: pergunta uma vez, nao repete o que ja foi dito, e nao prende o pedido.");
