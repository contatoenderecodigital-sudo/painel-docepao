// AS REGRAS DA CASA, COBRADAS NO FLUXO VIVO.
//
// POR QUE ISTO EXISTE
//
// Em 26/08/2026 o cerebro antigo foi apagado: 9.428 linhas entre `cerebro.ts`,
// `guardas.ts` e o enum que so ele usava. Com ele foram 32 testes, e cada um
// desses testes protegia uma regra que veio de defeito real, com cliente na
// linha.
//
// O levantamento de TODAS elas, com o veredito de cada uma, esta em
// `O-QUE-O-VELHO-PROTEGIA.md`. A maioria virou impossivel por construcao: o
// fluxo decide a etapa e a IA le dentro dela, entao nao ha o que guardar.
//
// SOBRARAM ESTAS, que sao deterministicas e continuam valendo. Elas nao sao
// guarda: sao o comportamento do proprio fluxo, cobrado onde ele mora agora.
//
// Roda com: node testes/as-regras-da-casa-no-fluxo.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-regras.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { ETAPAS_DA_FESTA } from "../lib/ia/fluxo/etapas.ts";',
    'import { respostaDaSituacao } from "../lib/ia/fluxo/situacao.ts";',
    'import { respostaDeInformacao } from "../lib/ia/fluxo/informacao.ts";',
    'import { mandouRecomecar } from "../lib/ia/fluxo/falas-do-cliente.ts";',
    "",
    "const acha = (id) => ETAPAS_DA_FESTA.find((x) => x.id === id);",
    "const base = {",
    "  ehFesta:true, pessoas:20, base:null, baseAceita:true, naoQuer:[], itens:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null},",
    "  pecas:null, topoNome:null, topoIdade:null, tema:null, escrito:null,",
    "  forminha:'rosa', prato:null, ofereceu:false, ultimaFala:null, insistiu:0,",
    "};",
    "const cumpre = (id, itens) => acha(id).cumprida({ ...base, itens });",
    "",
    "console.log(JSON.stringify({",
    "  generico: {",
    "    salgadoCru:   cumpre('salgado', [{produto:'salgado',categoria:'salgado_frito',qtd:200,obs:null}]),",
    "    docinhoCru:   cumpre('docinho', [{produto:'docinho',categoria:'docinho',qtd:100,obs:null}]),",
    "    boloCru:      cumpre('bolo',    [{produto:'bolo',categoria:'bolo_festa',qtd:2,obs:null}]),",
    "    salgadoDeVerdade: cumpre('salgado', [{produto:'coxinha',categoria:'salgado_frito',qtd:200,obs:null}]),",
    "    docinhoDeVerdade: cumpre('docinho', [{produto:'brigadeiro',categoria:'docinho',qtd:100,obs:null}]),",
    "    umDeVerdadeEUmCru: cumpre('salgado', [",
    "      {produto:'coxinha',categoria:'salgado_frito',qtd:100,obs:null},",
    "      {produto:'salgado',categoria:'salgado_assado',qtd:100,obs:null}]),",
    "  },",
    "  situacao: {",
    "    reclamacao: respostaDaSituacao('reclamacao', false),",
    "    cancelar:   respostaDaSituacao('cancelar', true),",
    "    statusComPedido: respostaDaSituacao('status', true),",
    "    statusSemPedido: respostaDaSituacao('status', false),",
    "  },",
    "  informacao: {",
    "    entrega:  respostaDeInformacao({ sobre:'entrega' }),",
    "    horario:  respostaDeInformacao({ sobre:'horario' }),",
    "    precoSalgado: respostaDeInformacao({ sobre:'preco', familia:'salgado' }),",
    "  },",
    "  recomecar: {",
    "    reiniciar:   mandouRecomecar('vamos reiniciar nossa conversa'),",
    "    apagaTudo:   mandouRecomecar('apaga tudo'),",
    "    doZero:      mandouRecomecar('quero comecar do zero'),",
    "    negado:      mandouRecomecar('nao quero recomecar nao'),",
    "    pedidoNormal:mandouRecomecar('quero 100 coxinhas'),",
    "  },",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-regras.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const cobra = (rotulo, foi, esperado) => {
  if (foi !== esperado) falhas.push(rotulo + ": veio " + JSON.stringify(foi) + ", esperado " + JSON.stringify(esperado));
  console.log((foi === esperado ? "ok    " : "ERRO  ") + rotulo);
};

// ---------------------------------------------------------------------------
// 1. GENERICO NAO E PRODUTO: E UMA ESCOLHA QUE AINDA FALTA.
//
// "salgado", "docinho" e "bolo" e o que a proposta anota quando o cliente
// aceitou a base mas ainda nao disse QUAL.
//
// A protecao contra isso morava no cerebro antigo, e o caminho vivo nunca
// teve: `paraOMotor` em `fluxo/cotar.ts` passa o nome direto pro motor. Medido
// em 26/08/2026, com a etapa fechando e o motor escolhendo sozinho:
//
//   "docinho"  100 un  ->  cotado como DOCINHO DE CHURROS, R$ 1,75
//                          (o brigadeiro, que e o comum, custa R$ 1,25)
//   "salgado"  200 un  ->  cotado como SALGADO ASSADO, R$ 1,25
//                          (o frito custa R$ 1,00)
//
// Nao era nem o mais caro nem o mais pedido: era o que o casamento por pedaco
// alcancava primeiro. O cliente recebia preco fechado de uma coisa que nunca
// escolheu, e a cozinha recebia churros.
// ---------------------------------------------------------------------------
console.log("== o generico nao fecha a etapa ==");
cobra("'salgado' cru mantem a etapa aberta", r.generico.salgadoCru, false);
cobra("'docinho' cru mantem a etapa aberta", r.generico.docinhoCru, false);
cobra("'bolo' cru mantem a etapa aberta", r.generico.boloCru, false);
cobra("um generico no meio de itens de verdade tambem segura", r.generico.umDeVerdadeEUmCru, false);
console.log("");
console.log("== e produto de verdade fecha, como sempre ==");
cobra("coxinha fecha a etapa do salgado", r.generico.salgadoDeVerdade, true);
cobra("brigadeiro fecha a etapa do docinho", r.generico.docinhoDeVerdade, true);

// ---------------------------------------------------------------------------
// 2. QUANDO A CONVERSA NAO E UM PEDIDO.
//
// "Meu pao veio queimado" caia no fluxo de pedido e a Dora tentava montar uma
// encomenda. Isso e ruim de um jeito diferente de todos os outros defeitos: e o
// momento em que o cliente esta bravo e a IA esta oferecendo docinho.
//
// Reclamacao e cancelamento sao SEMPRE da equipe. A primeira mexe com dinheiro
// e com a cara da padaria no bairro; a segunda mexe com producao que talvez ja
// tenha comecado.
// ---------------------------------------------------------------------------
console.log("");
console.log("== reclamacao e cancelamento sao sempre da equipe ==");
cobra("reclamacao chama gente", r.situacao.reclamacao?.precisaHumano, true);
cobra("cancelamento chama gente", r.situacao.cancelar?.precisaHumano, true);
cobra("status com pedido ela responde sozinha", r.situacao.statusComPedido?.precisaHumano, false);
cobra("status SEM pedido ela chama gente em vez de inventar", r.situacao.statusSemPedido?.precisaHumano, true);

// ---------------------------------------------------------------------------
// 3. PERGUNTAR NAO E PEDIR, E ENTREGA E DA EQUIPE.
//
// A cliente perguntou "0% lactose nao e sem acucar ne?" e ganhou um bolo 0%
// lactose no pedido. Ela nao pediu bolo nenhum, fez uma pergunta.
//
// E a entrega, palavra da dona: "sempre pedir ajuda pro humano quando e
// entrega". Depende do entregador e do dia, e prometer entrega que nao acontece
// e pior que nao ter entrega.
// ---------------------------------------------------------------------------
console.log("");
console.log("== perguntar nao e pedir ==");
cobra("entrega chama gente", r.informacao.entrega?.precisaHumano, true);
cobra("horario ela responde sozinha", r.informacao.horario?.precisaHumano, false);
cobra("o preco do salgado sai do motor e tem numero", /\d/.test(String(r.informacao.precoSalgado?.texto ?? "")), true);

// ---------------------------------------------------------------------------
// 4. QUEM MANDA RECOMECAR, RECOMECA.
//
// Teste do dono no celular dele, 23/08/2026: ele escreveu "vamos reiniciar
// nossa conversa. ok?" e a padaria respondeu "Fechou, Suelen, ja anotei seu
// nome, data, hora e que vai pagar no...". Ela seguiu com o pedido de antes.
//
// E a negacao conta: "nao quero recomecar" e o contrario, e apagar o pedido de
// alguem por engano nao tem desfazer.
// ---------------------------------------------------------------------------
console.log("");
console.log("== quem manda recomecar, recomeca ==");
cobra("'vamos reiniciar' recomeca", r.recomecar.reiniciar, true);
cobra("'apaga tudo' recomeca", r.recomecar.apagaTudo, true);
cobra("'do zero' recomeca", r.recomecar.doZero, true);
cobra("'NAO quero recomecar' NAO recomeca", r.recomecar.negado, false);
cobra("um pedido normal nao recomeca nada", r.recomecar.pedidoNormal, false);

console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: as regras da casa valem no fluxo, que e quem atende.");
