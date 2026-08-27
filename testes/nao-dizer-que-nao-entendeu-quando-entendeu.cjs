// A PADARIA NAO DIZ QUE NAO ENTENDEU ENQUANTO ESTA ANOTANDO.
//
// POR QUE ISTO EXISTE
//
// A desistencia ("vou chamar uma pessoa da equipe") era decidida por um sinal
// so: a pergunta que esta saindo e igual a anterior. O comentario no codigo
// dizia "a resposta do cliente nao virou dado", mas isso era suposicao, e ela e
// falsa toda vez que o cliente responde OUTRA coisa que a padaria entendeu bem.
//
// Medido em 27/08/2026, numa festa de aniversario com topo:
//
//   padaria >> A que horas voce vai passar para buscar?
//   cliente >> quero topo sim
//   padaria >> A que horas voce vai passar para buscar?
//   cliente >> tema jardim encantado, nome Alice, 5 anos
//   padaria >> Acho que nao estou conseguindo entender direito por aqui.
//
// A padaria entendeu tudo. O topo entrou, e o tema, o nome e a idade foram
// parar na comanda como "Topo: tema jardim encantado, Alice, 5 anos". Ela dizia
// que nao entendia ENQUANTO ANOTAVA. Do lado do cliente isso e pior que
// silencio: ele acabou de ser atendido e ouviu que ninguem entendeu.
//
// A hora continuava faltando, e por isso a pergunta volta. Voltar esta certo.
// Desistir e que nao.
//
// A ISCA DESTE TESTE JA FALHOU UMA VEZ
//
// A primeira versao usava as falas literais da conversa medida, e passava COM E
// SEM o conserto: o topo abre a pergunta do tema, entao a pergunta MUDAVA e a
// contagem de insistencia nunca chegava a dois. Teste que passa dos dois lados
// nao protege nada.
//
// Por isso o cenario aqui e outro: o cliente troca a cor da forminha tres
// vezes. Cada troca e entendida e anotada, e nenhuma delas abre pergunta nova,
// entao a pergunta que falta (a hora) repete de verdade e a contagem sobe.
//
// OS DOIS LADOS, PORQUE A DESISTENCIA TEM RAZAO DE EXISTIR
//
//   1. entendeu o cliente -> repete a pergunta que falta, e NAO desiste;
//   2. nao entendeu nada  -> desiste como sempre desistiu;
//   3. entendeu sempre mas a conversa travou -> o teto de seguranca desiste.
//
// Roda com: node testes/nao-dizer-que-nao-entendeu-quando-entendeu.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-entendeu.mts");
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
    "// Uma festa a que so falta a HORA. Tudo o mais respondido, pra que a",
    "// pergunta que sai seja sempre a mesma.",
    "const inicial = () => com({ ehFesta:true, pessoas:20, baseAceita:true,",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "  itens:[{produto:'coxinha',categoria:'salgado_frito',qtd:200,obs:null},",
    "         {produto:'brigadeiro',categoria:'docinho',qtd:100,obs:'forminha dourada'},",
    "         {produto:'bolo 4 leites',categoria:'bolo_festa',qtd:2,obs:null}],",
    "  forminha:'dourada', prato:'aberto', ofereceu:true, pecas:{topo:false,papelDeArroz:false},",
    "  dados:{nome:'Marcia',data:'10/09/2026',hora:null,pagamento:'cartao'},",
    "  etapasJaPerguntadas:['base_da_festa','salgado','docinho','forminha','bolo','pecas','dados'] });",
    "",
    "const rodar = async (falas) => {",
    "  let e = inicial();",
    "  const passos = [];",
    "  for (const [texto, leitura] of falas) {",
    "    const r = await responder(e as never, { texto } as never, (async () => leitura) as never);",
    "    e = r.estado as never;",
    "    passos.push({ texto, precisaHumano: r.precisaHumano === true, insistiu: e.insistiu });",
    "  }",
    "  return { passos, forminha: e.forminha };",
    "};",
    "",
    "// 1. tres respostas entendidas: a cor muda toda vez, e a hora continua faltando",
    "const entendido = await rodar([",
    "  ['forminha vermelha', { forminha: 'vermelha' }],",
    "  ['na verdade azul', { forminha: 'azul' }],",
    "  ['melhor rosa', { forminha: 'rosa' }],",
    "]);",
    "",
    "// 2. tres respostas que nao viram dado nenhum",
    "const teimoso = await rodar([['sei la', {}], ['hmm', {}], ['ah sei nao', {}]]);",
    "",
    "// 3. entendido pra sempre nao pode virar conversa presa",
    "const semFim = await rodar([",
    "  ['vermelha', { forminha: 'vermelha' }],",
    "  ['azul', { forminha: 'azul' }],",
    "  ['rosa', { forminha: 'rosa' }],",
    "  ['dourada', { forminha: 'dourada' }],",
    "  ['prata', { forminha: 'prata' }],",
    "  ['preta', { forminha: 'preta' }],",
    "]);",
    "",
    "console.log(JSON.stringify({ entendido, teimoso, semFim: semFim.passos }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-entendeu.mts"], {
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

// A isca so vale se a pergunta REPETIU. Sem chegar a dois, o teste passaria dos
// dois lados e nao protegeria nada, que foi o defeito da primeira versao dele.
cobra(
  "o cenario chega a insistir duas vezes (senao a isca nao vale)",
  r.entendido.passos.some((p) => Number(p.insistiu) >= 2),
  JSON.stringify(r.entendido.passos),
);
cobra(
  "nao chama a equipe enquanto entende o cliente",
  r.entendido.passos.every((p) => !p.precisaHumano),
  JSON.stringify(r.entendido.passos),
);
cobra("a ultima resposta entendida foi anotada", r.entendido.forminha === "rosa",
  "forminha = " + JSON.stringify(r.entendido.forminha));

cobra(
  "quem nao responde nada continua caindo pra equipe",
  r.teimoso.passos.some((p) => p.precisaHumano),
  JSON.stringify(r.teimoso.passos),
);

cobra(
  "a mesma pergunta nao sai pra sempre, mesmo entendendo",
  r.semFim.some((p) => p.precisaHumano),
  JSON.stringify(r.semFim),
);

console.log("");
if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}
console.log("PASSOU");
