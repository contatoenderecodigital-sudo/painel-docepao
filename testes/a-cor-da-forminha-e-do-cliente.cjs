// A COR DA FORMINHA E DO CLIENTE, NUNCA DO MODELO.
//
// Do pedido de festa de 30/08/2026, medido no banco depois de impresso:
//
//   cliente  >> quero metade brigadeiro e metade beijinho
//   guardado >> fluxo_forminha = "rosa"
//   comanda  >> 50 un brigadeiro / > forminha rosa
//               50 un beijinho   / > forminha rosa
//
// O cliente NUNCA falou de cor. O modelo devolveu "rosa" sozinho, o codigo
// aceitou, e a etapa da cor se deu por cumprida: a padaria nunca perguntou e a
// producao ia montar 100 forminhas na cor errada.
//
// A dona, nos audios: "na hora que a pessoa escolher docinho, a gente SEMPRE
// pergunta a cor da forminha que ela quer". Quem escolhe e o cliente. Quando ele
// delega com todas as letras ("escolhe voce"), quem escolhe e a delegacao, que
// e outro caminho e tem outro teste.
//
// A ISCA: tirando o filtro `ditasDeVerdade` em `fluxo.ts`, o primeiro caso volta
// a gravar "rosa" e este teste fica vermelho.
//
// Roda com: node testes/a-cor-da-forminha-e-do-cliente.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "o modelo inventa a cor e o cliente nunca falou dela",
    fala: "quero metade brigadeiro e metade beijinho",
    leitura: { forminha: "rosa" },
    espera: null,
    dano: "100 forminhas montadas na cor errada, e a padaria nunca perguntou",
  },
  {
    nome: "o cliente disse a cor: entra",
    fala: "pode ser forminha rosa",
    leitura: { forminha: "rosa" },
    espera: "rosa",
    dano: "quem responde a pergunta da cor tem que ser ouvido",
  },
  {
    nome: "o cliente disse duas cores: entram as duas",
    fala: "quero azul e rosa nas forminhas",
    leitura: { forminha: "azul e rosa" },
    espera: "azul e rosa",
    dano: "regra do dono: uma ou mais cores, e vale pro pedido todo",
  },
  {
    nome: "cor com duas palavras dita inteira",
    fala: "quero azul bebê",
    leitura: { forminha: "azul bebê" },
    espera: "azul bebê",
    dano: "o cardapio tem azul, azul bebê e azul royal; a dita e a que vale",
  },
  {
    nome: "o modelo mistura uma dita com uma inventada",
    fala: "quero rosa",
    leitura: { forminha: "rosa e dourada" },
    espera: "rosa",
    dano: "meia invencao continua sendo invencao, e a dourada nao foi pedida",
  },
  {
    nome: "cor que ja estava no pedido nao se perde quando o modelo repete",
    antes: "rosa",
    fala: "e o bolo vai de brigadeiro",
    leitura: { forminha: "rosa" },
    espera: "rosa",
    dano: "lembrar do que ja foi dito nao pode ser tratado como invencao",
  },
];

const sonda = path.join(__dirname, "_sonda-cor-da-forminha.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:true, pessoas:20, base:null, baseAceita:true, naoQuer:[],",
    "  itens:[{ produto:'brigadeiro', categoria:'docinho', qtd:50, unidade:'un', obs:null }],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[],",
    "};",
    "const pensar = (l) => (async () => l);",
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const inicio = { ...VAZIO, forminha: c.antes ?? null };",
    "  const r = await responder(inicio as never, { texto: c.fala }, pensar(c.leitura) as never);",
    "  saiu.push(r.estado.forminha ?? null);",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-cor-da-forminha.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== a cor da forminha e do cliente ==");
CASOS.forEach((c, n) => {
  const ok = JSON.stringify(saiu[n]) === JSON.stringify(c.espera);
  console.log(
    (ok ? "ok    " : "ERRO  ") + c.nome +
    (ok ? "" : "  ->  ficou " + JSON.stringify(saiu[n]) + ", esperado " + JSON.stringify(c.espera) + "; " + c.dano),
  );
  if (!ok) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
