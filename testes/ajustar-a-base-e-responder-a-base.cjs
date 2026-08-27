// QUEM AJUSTA A BASE DA FESTA RESPONDEU A BASE.
//
// POR QUE ISTO EXISTE
//
// A padaria oferece a base com estas palavras: "da R$ 628,20 no total, e da pra
// AJUSTAR o que voce quiser". Medido em 27/08/2026, numa festa de 30 pessoas, o
// que acontecia com quem aceitava o convite:
//
//   cliente >> oi, quero fazer uma festa pra 30 pessoas
//   padaria >> Pra 30 pessoas, 300 salgados, 150 docinhos e 3 kg de bolo...
//   cliente >> nao quero docinho, so salgado e bolo
//   padaria >> Pra 30 pessoas, 300 salgados, 0 docinhos e 3 kg de bolo...
//   cliente >> coxinha e risoles de carne, metade de cada
//   padaria >> Pra 30 pessoas, 300 salgados, 0 docinhos e 3 kg de bolo...
//   cliente >> bolo de ninho com nutella, 3 kg
//   padaria >> Acho que nao estou conseguindo entender direito por aqui.
//   cliente >> dia 12/09 as 16h, nome Rita Bender, pix
//   padaria >> Acho que nao estou conseguindo entender direito por aqui.
//   cliente >> pode confirmar
//   padaria >> Acho que nao estou conseguindo entender direito por aqui.
//
// A base foi recalculada CERTO (os docinhos zeraram na segunda fala), e mesmo
// assim a pergunta voltou, porque `baseAceita` so era ligado por duas coisas: o
// botao "Pode ser" e um `aceitouBase` do modelo. Ajustar nao era nenhuma das
// duas, entao a etapa da base nunca se cumpria.
//
// A festa inteira se perdeu: o cliente ainda mandou o bolo, a data, o nome e o
// pagamento, e ouviu a mesma frase quatro vezes.
//
// O QUE ESTE TESTE COBRA
//
//   1. ajustar a base MARCA a base como respondida;
//   2. a pergunta da base NAO volta depois do ajuste;
//   3. a conversa segue viva, sem cair no chamado pra equipe;
//   4. e o contrario: quem recusa uma familia ANTES de ver proposta nenhuma nao
//      respondeu pergunta alguma, e a base tem que ser oferecida do mesmo jeito,
//      ja sem o que ele dispensou. Sem isto o conserto viraria um pulo de etapa.
//
// Roda com: node testes/ajustar-a-base-e-responder-a-base.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-base-ajustada.mts");
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
    "const com = (p) => ({ ...VAZIO, ...p });",
    "",
    "// A festa de 30 pessoas com a base JA OFERECIDA, que e o estado exato em que",
    "// a conversa medida estava quando o cliente ajustou.",
    "const baseOferecida = com({",
    "  ehFesta:true, pessoas:30, baseAceita:false,",
    "  base:{salgados:300,docinhos:150,boloKg:3,totalCentavos:62820},",
    "  etapasJaPerguntadas:['base_da_festa'],",
    "});",
    "",
    "// 1, 2 e 3: ele ajusta.",
    "const ajustou = await responder(baseOferecida as never,",
    "  { texto: 'nao quero docinho, so salgado e bolo' } as never,",
    "  (async () => ({ naoQuer: ['docinho'] })) as never);",
    "",
    "// E na sequencia escolhe os sabores, que e onde a conversa medida ja tinha",
    "// desistido de andar.",
    "const escolheu = await responder(ajustou.estado as never,",
    "  { texto: 'coxinha e risoles de carne, metade de cada' } as never,",
    "  (async () => ({ itens:[{produto:'coxinha',qtd:0},{produto:'risoles de carne',qtd:0}] })) as never);",
    "",
    "// 4: recusa ANTES de qualquer proposta. Aqui a base tem que ser oferecida.",
    "const semProposta = com({ ehFesta:true, pessoas:30, baseAceita:false, base:null });",
    "const cedoDemais = await responder(semProposta as never,",
    "  { texto: 'nao quero docinho' } as never,",
    "  (async () => ({ naoQuer: ['docinho'] })) as never);",
    "",
    "console.log(JSON.stringify({",
    "  aceitouAoAjustar: ajustou.estado.baseAceita,",
    "  falaDepoisDoAjuste: ajustou.fala.texto,",
    "  chamouEquipeNoAjuste: ajustou.precisaHumano === true,",
    "  itensDepoisDeEscolher: escolheu.estado.itens,",
    "  falaDepoisDeEscolher: escolheu.fala.texto,",
    "  chamouEquipeNaEscolha: escolheu.precisaHumano === true,",
    "  aceitouCedoDemais: cedoDemais.estado.baseAceita,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-base-ajustada.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

const cobra = (rotulo, ok, detalhe) => {
  if (ok) {
    console.log("ok    " + rotulo);
  } else {
    falhas.push(rotulo);
    console.log("ERRO  " + rotulo);
    if (detalhe) console.log("        " + detalhe);
  }
};

const ehABase = (t) => /uma base boa|base boa é|Quantas pessoas/i.test(String(t || ""));

cobra("ajustar a base marca a base como respondida", r.aceitouAoAjustar === true,
  "baseAceita = " + JSON.stringify(r.aceitouAoAjustar));
cobra("a pergunta da base nao volta depois do ajuste", !ehABase(r.falaDepoisDoAjuste),
  String(r.falaDepoisDoAjuste || "").slice(0, 90));
cobra("o ajuste nao chama a equipe", r.chamouEquipeNoAjuste === false);

// A base de 300 salgados repartida entre as duas escolhas: 150 e 150. Sem o
// conserto os dois ficavam em zero, porque repartirABase so roda com a base
// aceita, e era exatamente isso que nao acontecia.
const qtds = (r.itensDepoisDeEscolher || []).map((i) => Number(i.qtd) || 0);
cobra("a base se reparte entre os sabores escolhidos", qtds.length === 2 && qtds.every((q) => q > 0),
  "quantidades: " + JSON.stringify(qtds));
cobra("escolher sabor nao chama a equipe", r.chamouEquipeNaEscolha === false);
cobra("a pergunta da base nao volta depois da escolha", !ehABase(r.falaDepoisDeEscolher),
  String(r.falaDepoisDeEscolher || "").slice(0, 90));

// O outro lado: sem proposta na mesa, recusar nao responde nada.
cobra("recusar antes da proposta NAO pula a base", r.aceitouCedoDemais !== true,
  "baseAceita = " + JSON.stringify(r.aceitouCedoDemais));

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
