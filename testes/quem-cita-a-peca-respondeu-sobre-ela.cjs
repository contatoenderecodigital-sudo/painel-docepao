// QUEM CITA A PECA RESPONDEU SOBRE ELA.
//
// Medido conversando com a producao em 31/08/2026, e o pedido fechou do avesso:
//
//   padaria >> E papel de arroz, com a foto impressa no bolo? Fica R$ 12,00.
//   cliente >> nao quero topo nem papel de arroz
//   padaria >> O bolo vai com topo?
//   comanda >> 3 kg de bolo laka (topo de bolo)
//
// O atalho do botao digitado pegava so a peca PERGUNTADA, aplicava o "nao" nela
// e nao chamava a IA. O "topo", escrito na mesma frase, ia pro lixo: a padaria
// perguntava de novo e o pedido fechou com a peca que ele recusou por escrito.
//
// Isso e "nada some do pedido" ao contrario: nao sumiu, ENTROU o oposto.
//
// A regra: a resposta vale pra cada peca NOMEADA na frase, e a peca perguntada
// continua valendo quando ele responde seco ("Sim", "nao").
//
// A BORDA QUE FICA DE FORA: frase com contraste ("quero topo mas nao papel de
// arroz") tem duas respostas diferentes numa frase so, e o leitor de sim e nao
// devolve uma. Ai e caso de modelo, e nao de atalho.
//
// A ISCA: voltando o atalho pra so a peca perguntada, o primeiro caso fecha com
// topo de novo.
//
// Roda com: node testes/quem-cita-a-peca-respondeu-sobre-ela.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const PERGUNTA_DO_PAPEL = "E papel de arroz, com a foto impressa no bolo? Fica R$ 12,00.";
const PERGUNTA_DO_TOPO = "O bolo vai com topo?";

const CASOS = [
  {
    nome: "\"nao quero topo nem papel de arroz\" responde as DUAS",
    ultima: PERGUNTA_DO_PAPEL,
    // O MODELO LE ISTO (medido 3 de 3 em 03/09/2026, com a pergunta na
    // conversa). O atalho que aplicava o botao sem chamar o modelo saiu:
    // engolia o tema e o escrito ditos na mesma frase.
    fala: "nao quero topo nem papel de arroz",
    leitura: { pecas: { topo: false, papelDeArroz: false } },
    papel: false,
    topo: false,
    dano: "o pedido fechou com o topo que ele recusou por escrito",
  },
  {
    nome: "\"nao quero papel de arroz\" nao mexe no topo",
    ultima: PERGUNTA_DO_PAPEL,
    fala: "nao quero papel de arroz",
    leitura: { pecas: { papelDeArroz: false } },
    papel: false,
    topo: null,
    dano: "responder por ele uma peca que ele nem citou",
  },
  {
    nome: "\"Sim\" seco no papel continua sendo o papel",
    ultima: PERGUNTA_DO_PAPEL,
    fala: "Sim",
    leitura: { pecas: { papelDeArroz: true } },
    papel: true,
    topo: null,
    dano: "o caso mais comum, e ele custava R$ 12,00 quando quebrava",
  },
  {
    nome: "\"nao\" seco no topo continua sendo o topo",
    ultima: PERGUNTA_DO_TOPO,
    fala: "nao",
    leitura: { pecas: { topo: false } },
    pecas: { papelDeArroz: false, topo: null },
    papel: false,
    topo: false,
    dano: "a outra metade do mesmo atalho",
  },
  {
    nome: "\"quero os dois\" com as duas citadas liga as duas",
    ultima: PERGUNTA_DO_PAPEL,
    fala: "sim, quero topo e papel de arroz",
    leitura: { pecas: { topo: true, papelDeArroz: true } },
    papel: true,
    topo: true,
    dano: "ele pediu as duas e a padaria ia perguntar a segunda de novo",
  },
  {
    nome: "frase com contraste NAO vira atalho, vai pro modelo",
    ultima: PERGUNTA_DO_PAPEL,
    fala: "quero topo mas nao quero papel de arroz",
    leitura: { pecas: { topo: true, papelDeArroz: false } },
    naoDecideSozinho: true,
    dano: "uma resposta so aplicada em duas perguntas diferentes",
  },
  {
    nome: "\"sim\" solto sem peca esperando nao liga peca nenhuma",
    ultima: "Qual sabor do bolo?",
    fala: "sim",
    pecas: { papelDeArroz: false, topo: false },
    papel: false,
    topo: false,
    dano: "um sim no meio da conversa ligando peca que custa dinheiro",
  },
];

const sonda = path.join(__dirname, "_sonda-cita-a-peca.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  let chamou = false;",
    "  const pensar = async () => { chamou = true; return c.leitura ?? { itens: [] }; };",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[],",
    "    itens:[{ produto:'bolo laka', categoria:'bolo_festa', qtd:2, unidade:'kg', obs:null }],",
    "    dados:{nome:null,data:null,hora:null,pagamento:null},",
    "    pecas: c.pecas ?? { papelDeArroz: null, topo: null },",
    "    topoNome:null, topoIdade:null, tema:null, forminha:null, prato:null,",
    "    ultimaFala:c.ultima, insistiu:0, retomarEm:null, assunto:null,",
    "    etapasJaPerguntadas:['bolo','pecas_do_bolo'], etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, pensar as never);",
    "  saiu.push({",
    "    papel: r.estado.pecas?.papelDeArroz ?? null,",
    "    topo: r.estado.pecas?.topo ?? null,",
    "    chamouModelo: chamou,",
    "    obs: r.estado.itens.map((i) => String(i.obs ?? '')).join(' | '),",
    "  });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-cita-a-peca.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== quem cita a peca respondeu sobre ela ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  if (c.naoDecideSozinho) {
    if (!r.chamouModelo) problemas.push("decidiu sozinho uma frase com contraste");
  } else {
    if (r.papel !== c.papel) problemas.push("papel de arroz ficou " + JSON.stringify(r.papel) + ", esperado " + JSON.stringify(c.papel));
    if (r.topo !== c.topo) problemas.push("topo ficou " + JSON.stringify(r.topo) + ", esperado " + JSON.stringify(c.topo));
    if (c.topo === false && /topo/i.test(r.obs)) problemas.push("a comanda diz topo: " + JSON.stringify(r.obs));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
