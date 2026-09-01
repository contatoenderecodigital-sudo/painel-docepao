// QUEM AJUSTA A BASE RESPONDEU A BASE, E A CONTA MUDA JUNTO.
//
// Conversa dele, 02/09/2026, e travou o pedido inteiro:
//
//   padaria >> Pra 20 pessoas, uma base boa é 200 salgados, 100 docinhos e
//              2 kg de bolo. Dá R$ 418,80, e dá pra ajustar o que você quiser.
//   cliente >> (botão) Quero ajustar
//   padaria >> Claro, é só dizer o que muda.
//   cliente >> quero 50 salgados a mais e 50 docinhos a mais
//   padaria >> Pra 20 pessoas, uma base boa é 200 salgados... (A MESMA)
//   cliente >> Quero mudar pra 50 salgados a mais e 50 docinhos a mais q isso
//   padaria >> Qual cor você quer para a forminha dos docinhos?
//
// A padaria OFERECE o ajuste, ele ajusta duas vezes, e a proposta sai igual.
// Depois disso a conversa nunca mais andou: os docinhos que ele escolheu, os
// salgados, tudo foi descartado, e vinte minutos depois ela propos a MESMA base
// do comeco. Ele tinha razao em desistir.
//
// TRES BURACOS NA MESMA FUNCAO, e o modelo nao tem culpa de nenhum: no rastro
// ele leu certo em todas as mensagens.
//
//   1. O numero vinha do MODELO, e ele nao acerta "a mais": devolveu 100 numa
//      mensagem e 150 na outra, quando o certo era 250. A conta agora sai da
//      FRASE, que e onde o "50" e o "a mais" estao escritos.
//   2. O TOTAL nao era refeito: a base dizia 100 salgados e seguia cobrando os
//      R$ 418,80 de 200. O cliente le um numero e paga outro.
//   3. AJUSTAR nao contava como RESPONDER, e a etapa da base so se cumpre com
//      `baseAceita`. A conversa ficava presa ali pra sempre.
//
// A ISCA: tirando o `respondeuAProposta` de `fluxo.ts`, o primeiro caso volta a
// ficar preso na proposta.
//
// Roda com: node testes/ajustar-a-base-e-responder-a-base.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const CASOS = [
  {
    nome: "\"50 a mais\" soma em cima do que foi proposto, e a conta acompanha",
    fala: "quero 50 salgados a mais que isso e 50 docinhos também a mais",
    leitura: { itens: [{ produto: "salgado", qtd: 100 }, { produto: "docinho", qtd: 100 }] },
    base: { salgados: 250, docinhos: 150, boloKg: 2 },
    total: 53130,
    aceita: true,
    perguntaNaoTem: "uma base boa",
    dano: "a conversa ficou presa na proposta e o cliente desistiu do pedido",
  },
  {
    nome: "numero sem \"a mais\" e absoluto",
    fala: "quero 300 salgados",
    leitura: { itens: [{ produto: "salgado", qtd: 300 }] },
    base: { salgados: 300, docinhos: 100, boloKg: 2 },
    total: 51880,
    aceita: true,
    dano: "somar onde ele trocou dobra o pedido dele",
  },
  {
    nome: "\"a menos\" tira",
    fala: "50 salgados a menos",
    leitura: { itens: [{ produto: "salgado", qtd: 50 }] },
    base: { salgados: 150, docinhos: 100, boloKg: 2 },
    total: 36880,
    aceita: true,
    dano: "cobrar 50 salgados que ele mandou tirar",
  },
  {
    nome: "aceitar a proposta continua igual",
    fala: "pode ser assim mesmo",
    leitura: { aceitouBase: true },
    base: { salgados: 200, docinhos: 100, boloKg: 2 },
    total: 41880,
    aceita: true,
    dano: "o caminho mais comum da festa nao pode mudar",
  },
  {
    // TROCAR DE CEREBRO NAO PODE MUDAR QUANTO A PADARIA COBRA.
    //
    // Medido em 02/09/2026 trocando o modelo: pra esta frase o gpt-4.1-mini
    // devolvia "50x salgado ;; 50x docinho" e o deepseek-v4-flash nao devolvia
    // item nenhum. Com o segundo, o ajuste sumia de novo e a conversa voltava a
    // travar na proposta.
    //
    // O numero e o "a mais" estao ESCRITOS na frase, e a padaria acabou de
    // perguntar exatamente isso. Depender do modelo pra uma conta que o codigo
    // sabe fazer sozinho e fragilidade minha, nao defeito do modelo.
    nome: "o ajuste vale mesmo com o modelo devolvendo NADA",
    fala: "quero 50 salgados a mais e 50 docinhos a mais",
    leitura: { itens: [] },
    base: { salgados: 250, docinhos: 150, boloKg: 2 },
    total: 53130,
    aceita: true,
    dano: "cada troca de cerebro traria de volta o travamento da proposta",
  },
  {
    nome: "e frase sem quantidade nenhuma nao mexe na base",
    fala: "e ai, tudo bem?",
    leitura: { itens: [] },
    base: { salgados: 200, docinhos: 100, boloKg: 2 },
    total: 41880,
    aceita: false,
    dano: "conversa fiada fechando a proposta sem ele responder",
  },
  {
    nome: "produto nomeado NAO e base: 100 coxinha e item",
    fala: "quero 100 coxinha",
    leitura: { itens: [{ produto: "coxinha", qtd: 100 }] },
    base: { salgados: 200, docinhos: 100, boloKg: 2 },
    total: 41880,
    dano: "quem escolhe o tipo estaria mudando a conta da festa sem querer",
  },
];

const sonda = path.join(__dirname, "_sonda-ajuste-base.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const CASOS = " + JSON.stringify(CASOS) + ";",
    "const saiu = [];",
    "for (const c of CASOS) {",
    "  const base = {",
    "    ehFesta:true, pessoas:20,",
    "    base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880}, baseAceita:false,",
    "    naoQuer:[], itens:[], dados:{nome:null,data:null,hora:null,pagamento:null},",
    "    pecas:null, topoNome:null, topoIdade:null, tema:null, forminha:null, prato:null,",
    "    ultimaFala:'Claro, é só dizer o que muda.', insistiu:0, retomarEm:null, assunto:null,",
    "    etapasJaPerguntadas:['abertura','quantas_pessoas','base_da_festa'],",
    "    etapasAdiadas:[], pecasMandadas:[],",
    "  };",
    "  const r = await responder(base as never, { texto: c.fala }, (async () => c.leitura) as never);",
    "  saiu.push({ base: r.estado.base, aceita: !!r.estado.baseAceita, pergunta: String(r.fala.texto || '') });",
    "}",
    "console.log(JSON.stringify(saiu));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-ajuste-base.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
console.log("== ajustar a base e responder a base ==");
CASOS.forEach((c, n) => {
  const r = saiu[n];
  const problemas = [];
  for (const campo of ["salgados", "docinhos", "boloKg"]) {
    if (Number(r.base?.[campo]) !== Number(c.base[campo])) {
      problemas.push(campo + " ficou " + r.base?.[campo] + ", esperado " + c.base[campo]);
    }
  }
  if (c.total != null && Number(r.base?.totalCentavos) !== c.total) {
    problemas.push(
      "o total ficou R$ " + (Number(r.base?.totalCentavos) / 100).toFixed(2) +
      ", esperado R$ " + (c.total / 100).toFixed(2),
    );
  }
  if (c.aceita != null && r.aceita !== c.aceita) {
    problemas.push(c.aceita ? "a conversa continuou presa na proposta" : "fechou a proposta sem ele responder");
  }
  if (c.perguntaNaoTem && new RegExp(c.perguntaNaoTem, "i").test(r.pergunta)) {
    problemas.push("repetiu a proposta: " + JSON.stringify(r.pergunta.slice(0, 60)));
  }
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome + (problemas.length ? "  ->  " + problemas.join("; ") + "; " + c.dano : ""));
  if (problemas.length) erros++;
});

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
