// QUEM DIGITA "SIM" RESPONDEU IGUAL A QUEM TOCOU NO BOTAO.
//
// Medido conversando com o servidor em 31/08/2026:
//
//   padaria >> E papel de arroz, com a foto impressa no bolo? Fica R$ 12,00.
//   cliente >> Sim
//   padaria >> O bolo vai com topo?
//   cliente >> Sim
//   banco   >> fluxo_topo = (vazio)   fluxo_papel = (vazio)
//
// As duas respostas se perderam. Texto livre vai pro modelo, e pra "Sim" seco
// ele devolveu leitura VAZIA: nenhuma peca anotada, o papel de arroz nao virou
// linha (R$ 12,00 fora do pedido), e as perguntas do tema e do que vai escrito
// foram puladas, porque elas so existem quando ha peca. O bolo ia pra cozinha
// sem tema e sem nome do aniversariante.
//
// No teste do dono, na vespera, isso nao apareceu porque ele TOCOU nos botoes.
// Muita gente digita, e a padaria nao pode depender do modelo pra entender um
// "sim". O leitor de sim e nao ja existia neste repositorio
// (`respostaAoValor`), so nao era chamado nessas perguntas.
//
// A ISCA: tirando o galho `botaoDigitado` de `fluxo.ts`, os tres primeiros
// casos voltam a perder a resposta.
//
// Roda com: node testes/quem-digita-sim-respondeu.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "\"Sim\" no papel de arroz anota a peca E cria a linha de R$ 12,00",
    pecas: null,
    ultima: "E papel de arroz, com a foto impressa no bolo? Fica R$ 12,00.",
    // O MODELO LE ISTO (medido 3 de 3 em 03/09/2026, com a pergunta na
    // conversa). O atalho que aplicava o botao sem chamar o modelo saiu:
    // engolia o tema e o escrito ditos na mesma frase.
    fala: "Sim",
    leitura: { pecas: { papelDeArroz: true } },
    esperaPecas: { papelDeArroz: true },
    temProduto: "papel de arroz",
    dano: "R$ 12,00 fora do pedido e a peca nao produzida",
  },
  {
    nome: "\"Sim\" no topo anota o topo",
    pecas: { topo: null, papelDeArroz: true },
    ultima: "O bolo vai com topo?",
    fala: "Sim",
    leitura: { pecas: { topo: true } },
    esperaPecas: { topo: true },
    dano: "o topo e encomendado fora com dois dias de antecedencia; perder isso a cozinha descobre no dia",
  },
  {
    nome: "\"nao quero\" no topo anota a recusa, e nao o silencio",
    pecas: { topo: null, papelDeArroz: true },
    ultima: "O bolo vai com topo?",
    fala: "não quero",
    leitura: { pecas: { topo: false } },
    esperaPecas: { topo: false },
    dano: "a padaria repetiria a pergunta de quem ja respondeu",
  },
  {
    nome: "depois do topo, a padaria pergunta o tema da peca",
    pecas: { topo: null, papelDeArroz: true },
    ultima: "O bolo vai com topo?",
    fala: "Sim",
    leitura: { pecas: { topo: true } },
    perguntaTem: "tema",
    dano: "o bolo ia pra confeitaria sem tema e sem nome do aniversariante",
  },
  {
    nome: "\"sim\" solto fora da pergunta de peca nao liga peca nenhuma",
    pecas: null,
    ultima: "Quais salgados você vai querer?",
    fala: "sim",
    esperaPecas: { papelDeArroz: null },
    dano: "cobrar R$ 12,00 de quem so concordou com outra coisa",
  },
];

const sonda = path.join(__dirname, "_sonda-digita-sim.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const ITENS = [",
    "  { produto:'coxinha', categoria:'salgado_frito', qtd:200, unidade:'un', obs:'frango' },",
    "  { produto:'brigadeiro', categoria:'docinho', qtd:100, unidade:'un', obs:'forminha rosa' },",
    "  { produto:'bolo brigadeiro', categoria:'bolo_festa', qtd:2, unidade:'kg', obs:null },",
    "];",
    "const pensar = (c) => (async () => c.leitura ?? { itens: [] });",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:true, pessoas:20, base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880},",
    "    baseAceita:true, naoQuer:[], itens:ITENS,",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:c.pecas, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:'rosa', prato:null, ultimaFala:c.ultima, insistiu:0,",
    "    retomarEm:null, assunto:null,",
    "    etapasJaPerguntadas:['abertura','base_da_festa','salgado','salgado:sabor','docinho','bolo','bolo:sabor','pecas_do_bolo','pecas_do_bolo:papel'],",
    "    etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, pensar(c) as never);",
    "  saiu.push({",
    "    pecas: r.estado.pecas ?? null,",
    "    produtos: r.estado.itens.map((i) => i.produto),",
    "    pergunta: String(r.fala.texto || ''),",
    "  });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-digita-sim.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let erros = 0;
console.log("== quem digita \"sim\" respondeu ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  for (const [campo, valor] of Object.entries(c.esperaPecas ?? {})) {
    const veio = r.pecas ? (r.pecas[campo] ?? null) : null;
    if (veio !== valor) problemas.push(campo + " ficou " + JSON.stringify(veio) + ", esperado " + JSON.stringify(valor));
  }
  if (c.temProduto && !r.produtos.some((p) => semAc(p) === semAc(c.temProduto))) {
    problemas.push("faltou a linha \"" + c.temProduto + "\" no pedido");
  }
  if (c.perguntaTem && !semAc(r.pergunta).includes(semAc(c.perguntaTem))) {
    problemas.push("a proxima pergunta nao fala de \"" + c.perguntaTem + "\": " + JSON.stringify(r.pergunta.slice(0, 70)));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
