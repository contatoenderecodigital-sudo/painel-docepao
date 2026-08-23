// NADA DE CODIGO FANTASMA
//
// Reclamacao do dono em 23/08/2026, e ela e justa: "pq vc ta construindo coisa
// fantasma cara, pedi pra gente fazer do 0".
//
// O fluxo novo foi escrito do zero, e mesmo assim ja tinha resto de andaime
// dentro. Nao veio do sistema antigo: veio de eu desenhar uma coisa, construir
// de outro jeito e nao voltar pra apagar o desenho.
//
// O QUE A VARREDURA ACHOU
//
// 1. Quatro botoes (salgado_sim, salgado_nao, mais_sim, mais_nao) tratados no
//    codigo e oferecidos por etapa nenhuma. Eu tinha planejado uma etapa "quer
//    salgado? sim/nao" e outra "mais alguma coisa?", e construi as familias com
//    lista de cardapio.
//
// 2. Um tipo EtapaSimplesId, desenho de um caminho curto separado pra pedido
//    simples. O caminho curto saiu melhor com etapa pulavel, e o tipo ficou.
//
// 3. familias.ts, 235 linhas descrevendo as dez familias da padaria, das quais
//    o sistema lia dez: duas listas de nomes pra dividir a base da festa. Nao
//    era dado errado (a tabela ja lia o cardapio), era estrutura pra um futuro
//    que ainda nao existe.
//
// POR QUE ISSO IMPORTA MAIS DO QUE PARECE
//
// Codigo que nao roda nao da erro, entao ninguem descobre que ele esta errado.
// Quem le acredita que existe. Foi exatamente o caso do botao de recusa do
// salgado: eu olhava a lista, via que "nao quero salgado" estava resolvido, e
// nao estava. O beco continuou aberto nas tres familias por dias.
//
// A REGRA
//
// Coisa exportada no fluxo tem que ser usada por alguem. Enquanto a familia da
// pizza nao for construida, a tabela da pizza nao existe.
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..");

const pasta = path.join(raiz, "lib/ia/fluxo");
const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith(".ts"));

// Onde vale procurar por uso: o proprio fluxo, quem chama ele, e os testes.
const ondeProcurar = [
  ...arquivos.map((f) => path.join(pasta, f)),
  path.join(raiz, "app/api/whatsapp/route.ts"),
  ...fs.readdirSync(__dirname).filter((f) => f.endsWith(".cjs")).map((f) => path.join(__dirname, f)),
];
const tudo = ondeProcurar.map((f) => {
  try { return fs.readFileSync(f, "utf8"); } catch { return ""; }
}).join(String.fromCharCode(10));

const falhas = [];
const conferidos = [];

for (const arquivo of arquivos) {
  const fonte = fs.readFileSync(path.join(pasta, arquivo), "utf8");
  const simbolos = [
    ...fonte.matchAll(/export (?:async )?function (\w+)/g),
    ...fonte.matchAll(/export const (\w+)/g),
    ...fonte.matchAll(/export type (\w+)/g),
  ].map((m) => m[1]);

  for (const nome of simbolos) {
    conferidos.push(nome);
    // Uma aparicao e a propria declaracao. Duas ou mais quer dizer que alguem
    // usa: outro arquivo, um teste, ou o proprio arquivo mais adiante.
    const vezes = (tudo.match(new RegExp("\\b" + nome + "\\b", "g")) ?? []).length;
    if (vezes <= 1) {
      falhas.push(
        "'" + nome + "' (" + arquivo + ") e exportado e ninguem usa: ou liga no " +
          "fluxo, ou apaga. Codigo que nao roda nao da erro, e por isso ninguem " +
          "descobre que ele esta errado.",
      );
    }
  }
}

// E o andaime que ja foi cortado nao volta pela porta dos fundos.
//
// Aqui a busca e no CODIGO VIVO: sem comentario (que e onde eu conto a historia
// do que foi cortado) e sem este arquivo, que precisa escrever os nomes pra
// poder procurar por eles.
const codigoVivo = ondeProcurar
  .filter((f) => !f.endsWith("nada-de-codigo-fantasma.cjs"))
  .map((f) => {
    try { return fs.readFileSync(f, "utf8"); } catch { return ""; }
  })
  .join(String.fromCharCode(10))
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

const jaCortados = ["EtapaSimplesId", "salgado_sim", "salgado_nao", "mais_sim", "mais_nao"];
for (const morto of jaCortados) {
  if (new RegExp("\\b" + morto + "\\b").test(codigoVivo)) {
    falhas.push("'" + morto + "' voltou ao codigo: era andaime, foi cortado em 23/08/2026");
  }
}

console.log("Simbolos exportados no fluxo: " + conferidos.length);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: tudo o que esta escrito no fluxo roda.");
