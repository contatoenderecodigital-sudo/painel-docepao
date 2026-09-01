// A FOTO DEPOIS DO PIX E O COMPROVANTE, E NAO O TEMA DO BOLO.
//
// Buraco que eu abri em 01/09/2026, no mesmo dia em que a chave pix entrou: a
// padaria passou a dizer "me manda o comprovante aqui que eu anexo no pedido", e
// nao sabia receber.
//
//   padaria >> A chave pix e o CNPJ ... me manda o comprovante aqui
//   cliente >> (foto do comprovante)
//   pedido  >> tema: conforme a foto que ele mandou
//   padaria >> Quer levar docinho ou bolo junto?
//
// Quem acabou de pagar ouvia uma OFERTA, e o comprovante virava tema de bolo na
// comanda da cozinha. Nao e defeito do modelo: e a regra de que toda foto e
// referencia da peca, escrita antes de existir pagamento por aqui.
//
// Quem da sentido a foto e a frase que acabou de sair. Mesma regra do "Sim"
// digitado e da resposta do peso.
//
// A IA CONFIRMA A FOTO, E NAO O PAGAMENTO. Conferir se o valor caiu e coisa de
// gente, igual aprovar pedido: dizer "pagamento confirmado" sem ninguem ter
// olhado a conta e erro que nao tem desfazer.
//
// A ISCA: tirando o galho do comprovante em `fluxo.ts`, o primeiro caso volta a
// virar tema.
//
// Roda com: node testes/a-foto-depois-do-pix-e-comprovante.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const PEDIU_COMPROVANTE =
  "Claro. A chave pix é o CNPJ 04019779000148. Quando pagar, me manda o comprovante aqui que eu anexo no pedido.";

const CASOS = [
  {
    nome: "foto depois do pedido do comprovante: agradece e chama a equipe",
    ultima: PEDIU_COMPROVANTE,
    tema: null,
    temaEsperado: null,
    equipe: true,
    respostaTem: "comprovante",
    respostaNaoTem: "docinho",
    dano: "quem acabou de pagar ouvia uma oferta, e o comprovante virava tema na comanda",
  },
  {
    nome: "mas ela NAO diz que o pagamento entrou",
    ultima: PEDIU_COMPROVANTE,
    tema: null,
    temaEsperado: null,
    equipe: true,
    respostaNaoTem: "pagamento confirmado|recebemos o pagamento|pago",
    dano: "confirmar dinheiro sem ninguem olhar a conta nao tem desfazer",
  },
  {
    nome: "foto na pergunta do tema continua sendo o tema",
    ultima: "Qual vai ser o tema do topo?",
    tema: null,
    temaEsperado: "conforme a foto que ele mandou",
    equipe: false,
    dano: "a regra de 24/08 do dono: quem manda a foto ja disse o tema",
  },
  {
    nome: "e quem ja tem tema nao ganha outro",
    ultima: "Qual vai ser o tema do topo?",
    tema: "Homem Aranha",
    temaEsperado: "Homem Aranha",
    equipe: false,
    dano: "apagar o tema que ele escreveu",
  },
];

const sonda = path.join(__dirname, "_sonda-comprovante.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    'import { RECADO_DE_FOTO } from "../lib/ia/texto.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[],",
    "    itens:[{ produto:'bolo brigadeiro', categoria:'bolo_festa', qtd:2, unidade:'kg', obs:null }],",
    "    dados:{nome:'Eliezer',data:'05/09/2026',hora:'09:00',pagamento:'pix'},",
    "    pecas:{topo:true,papelDeArroz:false}, topoNome:null, topoIdade:null,",
    "    tema:c.tema, forminha:null, prato:null, ultimaFala:c.ultima, insistiu:0,",
    "    retomarEm:null, assunto:null, etapasJaPerguntadas:['abertura','bolo'],",
    "    etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: RECADO_DE_FOTO }, (async () => ({ itens: [] })) as never);",
    "  saiu.push({ tema: r.estado.tema ?? null, equipe: !!r.precisaHumano, texto: String(r.fala.texto || '') });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-comprovante.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a foto depois do pix e comprovante ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  if (r.tema !== c.temaEsperado) {
    problemas.push("o tema ficou " + JSON.stringify(r.tema) + ", esperado " + JSON.stringify(c.temaEsperado));
  }
  if (r.equipe !== c.equipe) {
    problemas.push(c.equipe ? "nao chamou a equipe pra conferir o valor" : "chamou a equipe sem precisar");
  }
  if (c.respostaTem && !new RegExp(c.respostaTem, "i").test(r.texto)) {
    problemas.push("a resposta nao fala de " + c.respostaTem + ": " + JSON.stringify(r.texto.slice(0, 60)));
  }
  if (c.respostaNaoTem && new RegExp(c.respostaNaoTem, "i").test(r.texto)) {
    problemas.push("a resposta diz o que nao devia: " + JSON.stringify(r.texto.slice(0, 60)));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
