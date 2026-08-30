// O SABOR QUE JA TEM DONO NA FRASE NAO GRUDA NO OUTRO ITEM.
//
// Medido em 30/08/2026, e nao e defeito de pizza: e de qualquer produto que
// divida uma palavra de sabor com outro.
//
//   cliente >> uma pizza inteira de calabresa e uma pizza redonda de 1 kg
//   modelo  >> 1x pizza inteira [calabresa] ;; 1x pizza redonda    <- leu CERTO
//   pedido  >> pizza inteira [calabresa] ;; pizza redonda [CALABRESA]
//
// A redonda foi pedida SEM sabor. Quem carimbou foi o codigo.
//
// A regra que faz isso existe por um motivo bom e nao pode sair: "de calabresa"
// sozinho nao nomeia produto nenhum, e sem ela a resposta a uma pergunta de
// sabor caia no vazio. Medido em 26/08, numa pizza que precisou de SEIS voltas
// pra fechar. As guardas dela tambem estao certas: so gruda se o sabor for
// daquele produto, e so se o item ainda nao tem sabor.
//
// O QUE FALTAVA E A MESMA DISTINCAO QUE CONSERTOU A PIZZA: a palavra nao estava
// solta, ela ja tinha dono NA PROPRIA FRASE. Sobra de palavra de um item nao e
// sabor do outro. Foi a terceira vez no mesmo dia que o defeito era "nao separar
// o que ja estava do que foi dito agora".
//
// POR QUE ESTE TESTE NAO E DE PIZZA: o dono foi explicito, "tem q usar nisso
// pra tudo ne, nao so pra pizzas, todos produtos da loja categorias etc".
// Entao os casos abaixo usam familias diferentes, e o mais duro deles nem tem
// pizza: `torta fria` e `empadao` compartilham o sabor "frango" no catalogo, e
// e exatamente ali que o carimbo erra sem ninguem perceber, porque os dois sao
// salgados vendidos por quilo.
//
// Roda com: node testes/sabor-de-um-item-nao-gruda-no-outro.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-sabor-nao-gruda.mts");
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
    "const pensar = (leitura) => (async () => leitura);",
    "const linhas = (e) => (e.itens || []).map((i) => i.produto + (i.obs ? ' [' + i.obs + ']' : ''));",
    "",
    "const saida: Record<string, string[]> = {};",
    "",
    "// 1. PIZZA: o caso medido em producao",
    "const a = await responder(VAZIO as never,",
    "  { texto: 'quero uma pizza inteira de calabresa e uma pizza redonda de 1 kg' },",
    "  pensar({ itens:[",
    "    {produto:'pizza inteira',qtd:1,sabor:'calabresa'},",
    "    {produto:'pizza redonda',qtd:1},",
    "  ] }) as never);",
    "saida.pizza = linhas(a.estado);",
    "",
    "// 2. SEM PIZZA NENHUMA: torta fria e empadao dividem o sabor 'frango'",
    "const b = await responder(VAZIO as never,",
    "  { texto: 'quero 2 kg de torta fria de frango e 1 kg de empadao' },",
    "  pensar({ itens:[",
    "    {produto:'torta fria',qtd:2,sabor:'frango'},",
    "    {produto:'empadao',qtd:1},",
    "  ] }) as never);",
    "saida.salgadoPorQuilo = linhas(b.estado);",
    "",
    "// 3. A ORDEM NAO PODE IMPORTAR: o que espera vem PRIMEIRO na frase",
    "const c = await responder(VAZIO as never,",
    "  { texto: 'quero 1 kg de empadao e 2 kg de torta fria de frango' },",
    "  pensar({ itens:[",
    "    {produto:'empadao',qtd:1},",
    "    {produto:'torta fria',qtd:2,sabor:'frango'},",
    "  ] }) as never);",
    "saida.ordemTrocada = linhas(c.estado);",
    "",
    "// 4. O QUE NAO PODE QUEBRAR: a resposta a uma pergunta de sabor GRUDA.",
    "//    Aqui a palavra esta solta de verdade, porque o modelo nao deu dono a",
    "//    ela. Sem isto a padaria pergunta o sabor pra sempre, que e o defeito",
    "//    de 26/08 e custou seis voltas numa conversa so.",
    "const semSabor = await responder(VAZIO as never,",
    "  { texto: 'quero 1 kg de empadao' },",
    "  pensar({ itens:[{produto:'empadao',qtd:1}] }) as never);",
    "saida.antesDaResposta = linhas(semSabor.estado);",
    "const d = await responder(semSabor.estado as never,",
    "  { texto: 'de frango' },",
    "  pensar({}) as never);",
    "saida.respostaGruda = linhas(d.estado);",
    "",
    "// 5. E QUANDO ELE PEDE OS DOIS DO MESMO SABOR, os dois ficam com ele.",
    "//    O modelo diz isso dando o sabor aos DOIS, e nada aqui atrapalha.",
    "const f = await responder(VAZIO as never,",
    "  { texto: 'quero torta fria de frango e empadao de frango' },",
    "  pensar({ itens:[",
    "    {produto:'torta fria',qtd:1,sabor:'frango'},",
    "    {produto:'empadao',qtd:1,sabor:'frango'},",
    "  ] }) as never);",
    "saida.osDoisDoMesmo = linhas(f.estado);",
    "",
    "// 6. A DATA NAO E SABOR. Medido em producao no mesmo dia, e o pedido",
    "//    fechou com `empadao (pra retirar amanha as 18h | Eliezer)`.",
    "const g = await responder(semSabor.estado as never,",
    "  { texto: 'pra retirar amanha as 18h' },",
    "  pensar({ dados:{ data:'31/08/2026', hora:'18:00' } }) as never);",
    "saida.dataNaoESabor = linhas(g.estado);",
    "",
    "// 7. E O NOME TAMBEM NAO.",
    "const h = await responder(g.estado as never,",
    "  { texto: 'Eliezer' },",
    "  pensar({ dados:{ nome:'Eliezer' } }) as never);",
    "saida.nomeNaoESabor = linhas(h.estado);",
    "",
    "// 8. O QUE NAO PODE QUEBRAR: sabor fora da lista continua chegando.",
    "//    'pistache' nao esta nas opcoes do empadao e o modelo nao devolve dado",
    "//    nenhum: a frase esta SOBRANDO de verdade, e ela vira o recado que a",
    "//    equipe confere. Licao de 26/08, quando o sabor pedido nunca chegava",
    "//    na comanda.",
    "const j = await responder(semSabor.estado as never,",
    "  { texto: 'pistache' },",
    "  pensar({}) as never);",
    "saida.saborForaDaLista = linhas(j.estado);",
    "",
    "console.log(JSON.stringify(saida));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-sabor-nao-gruda.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const saiu = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
function conferir(oque, achado, esperado, dano) {
  const ok = JSON.stringify(achado) === JSON.stringify(esperado);
  console.log(
    (ok ? "ok    " : "ERRO  ") + oque +
    (ok ? "" : "  ->  ficou " + JSON.stringify(achado) + ", esperado " + JSON.stringify(esperado) + "; " + dano),
  );
  if (!ok) erros++;
}

console.log("== o sabor com dono nao vaza pro vizinho ==");
conferir(
  "pizza: a redonda pedida sem sabor fica sem sabor",
  saiu.pizza,
  ["pizza inteira [calabresa]", "pizza redonda"],
  "a cozinha monta uma redonda de calabresa que ninguem pediu, e a padaria deixa de PERGUNTAR",
);
conferir(
  "sem pizza nenhuma: o empadao nao herda o frango da torta",
  saiu.salgadoPorQuilo,
  ["torta fria [frango]", "empadao"],
  "os dois dividem o sabor frango no catalogo, e este e o caso que passa despercebido",
);
conferir(
  "e a ordem na frase nao muda nada",
  saiu.ordemTrocada,
  ["empadao", "torta fria [frango]"],
  "regra que depende da ordem da frase quebra na primeira conversa de verdade",
);

console.log("== e o que nao pode quebrar ==");
conferir(
  "o empadao sozinho nasce esperando sabor",
  saiu.antesDaResposta,
  ["empadao"],
  "sem isto o caso de baixo nao mede nada",
);
conferir(
  "a resposta a pergunta de sabor continua grudando",
  saiu.respostaGruda,
  ["empadao [frango]"],
  "a licao de 26/08: sem isto a padaria pergunta o sabor pra sempre, seis voltas numa conversa",
);
conferir(
  "quem pede os dois do mesmo sabor leva os dois",
  saiu.osDoisDoMesmo,
  ["torta fria [frango]", "empadao [frango]"],
  "o modelo deu dono aos dois, e tirar de um seria inventar no sentido contrario",
);

console.log("== e frase que a leitura entendeu como outra coisa nao e sabor ==");
conferir(
  "a data nao vira o sabor do empadao",
  saiu.dataNaoESabor,
  ["empadao"],
  "medido em producao: o pedido fechou com empadao (pra retirar amanha as 18h) e isso foi pro cupom da cozinha",
);
conferir(
  "e o nome do cliente tambem nao",
  saiu.nomeNaoESabor,
  ["empadao"],
  "o cupom saiu com o nome dele escrito no lugar do recheio",
);
conferir(
  "mas o sabor fora da lista continua chegando",
  saiu.saborForaDaLista,
  ["empadao [pistache]"],
  "licao de 26/08: sem isto o sabor pedido nunca chegava na comanda e a equipe nao tinha o que conferir",
);

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
