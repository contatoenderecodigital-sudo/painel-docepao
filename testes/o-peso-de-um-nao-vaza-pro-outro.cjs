// O PESO DE UM PRODUTO NAO VAZA PRO OUTRO.
//
// Medido conversando com a producao em 02/09/2026, na primeira conversa de
// cliente decidido:
//
//   cliente >> queria 3 cucas e 2 kg de pao frances pra amanha
//   modelo  >> 3x cuca ;; 2x pao frances          (leu certo)
//   resumo  >> 2 kg de cuca R$ 45,80 / 2 kg de pao frances R$ 23,98
//
// A cuca tambem e vendida por quilo, e o leitor de peso olhava a FRASE INTEIRA:
// achou o "2 kg" do pao e aplicou na cuca junto. As tres cucas viraram dois
// quilos, e o cliente so descobriria na retirada.
//
// Quem separa dois pedidos numa frase e a virgula e o "e", que e como a pessoa
// escreve. Cortar por janela de letras nao resolve: em "3 cucas e 2 kg de pao"
// o vizinho esta a nove letras, e qualquer janela util alcanca ele.
//
// O "3 cucas" fica em ZERO de proposito, e a padaria pergunta os quilos: e a
// regra que o dono deu em 31/08 ("se a categoria eh KG nao UNID tu fala pra ele,
// q eh em kg, ai tem escolher em kg nao em quantidade").
//
// A ISCA: voltando o leitor pra frase inteira, a cuca volta a virar 2 kg.
//
// Roda com: node testes/o-peso-de-um-nao-vaza-pro-outro.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "o peso do pao nao vira peso da cuca",
    fala: "queria 3 cucas e 2 kg de pao frances pra amanha",
    leitura: { itens: [{ produto: "cuca", qtd: 3 }, { produto: "pao frances", qtd: 2 }] },
    esperado: { cuca: 0, "pao frances": 2 },
    dano: "3 cucas viram 2 kg, R$ 45,80 cobrados por outra coisa",
  },
  {
    nome: "cada um com seu peso, cada um com o seu",
    fala: "1 kg de cuca e 3 kg de pao frances",
    leitura: { itens: [{ produto: "cuca", qtd: 1 }, { produto: "pao frances", qtd: 3 }] },
    esperado: { cuca: 1, "pao frances": 3 },
    dano: "trocar os pesos entre dois produtos da mesma conta",
  },
  {
    nome: "com um produto so, o peso pode estar em qualquer lugar da frase",
    fala: "quero 2 kg de pao frances",
    leitura: { itens: [{ produto: "pao frances", qtd: 2 }] },
    esperado: { "pao frances": 2 },
    dano: "o caso mais comum da padaria nao pode ficar mais chato",
  },
  {
    nome: "e o peso depois do nome tambem vale",
    fala: "uma cuca de 1 kg",
    leitura: { itens: [{ produto: "cuca", qtd: 1 }] },
    esperado: { cuca: 1 },
    dano: "perguntar o peso de quem acabou de dizer o peso",
  },
];

const sonda = path.join(__dirname, "_sonda-peso-vaza.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:false, pessoas:null, base:null, baseAceita:false, naoQuer:[], itens:[],",
    "    dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "    topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "    retomarEm:null, assunto:null, etapasJaPerguntadas:[], etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, (async () => c.leitura) as never);",
    "  saiu.push(r.estado.itens.map((i) => ({ p: i.produto, q: Number(i.qtd) })));",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-peso-vaza.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
const semAc = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let erros = 0;
console.log("== o peso de um nao vaza pro outro ==");
CASOS.forEach((c, n) => {
  const itens = saiu[n];
  const problemas = [];
  for (const [produto, qtd] of Object.entries(c.esperado)) {
    const achado = itens.find((i) => semAc(i.p) === semAc(produto));
    if (!achado) problemas.push(produto + " sumiu do pedido");
    else if (achado.q !== qtd) problemas.push(produto + " ficou " + achado.q + ", esperado " + qtd);
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
