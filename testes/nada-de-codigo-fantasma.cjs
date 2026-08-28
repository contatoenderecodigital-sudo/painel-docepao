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

// O CEREBRO INTEIRO, E NAO UMA PASTA ESCRITA A MAO.
//
// Isto varria so `lib/ia/fluxo`, e por isso deixou passar 170 linhas de codigo
// morto em `lib/ia/persona.ts`: o system prompt do cerebro antigo, apagado em
// 26/08/2026, que ficou sem chamador nenhum e levou junto um arquivo inteiro
// (`catalogo-em-texto.ts`, 120 linhas) que so existia pra ele.
//
// Achado lendo a persona em 28/08/2026. Mais uma lista minha, e desta vez
// dentro de um teste: o detector de codigo fantasma tinha o seu proprio ponto
// cego escrito a mao.
const PASTAS = ["lib/ia/fluxo", "lib/ia", "lib/ia/dados", "lib/banco"];
const arquivos = PASTAS.flatMap((rel) => {
  const dir = path.join(raiz, rel);
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => path.join(rel, e.name));
});
const pasta = raiz;

// ONDE VALE PROCURAR POR USO: O REPOSITORIO INTEIRO.
//
// Isto era uma lista de tres lugares, e ao alargar a varredura de DECLARACAO eu
// esqueci de alargar a de USO. Na primeira execucao ele acusou doze funcoes de
// `lib/banco` como mortas, e elas sao usadas pelo PAINEL, em `components/`.
//
// Falso positivo em detector e pior que buraco: quem ve doze acusacoes erradas
// para de acreditar na decima terceira, que e verdadeira.
const varrer = (dir, saida = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (/^(node_modules|\.next|\.git|public)$/.test(e.name)) continue;
    const cheio = path.join(dir, e.name);
    if (e.isDirectory()) varrer(cheio, saida);
    else if (/\.(ts|tsx|cjs|mjs)$/.test(e.name)) saida.push(cheio);
  }
  return saida;
};
// ESTE ARQUIVO NAO CONTA COMO USO.
//
// A lista de pendentes logo abaixo escreve os nomes dos orfaos, e sem esta
// linha eles passariam a ter "duas aparicoes" e sairiam da conta: o detector
// cegava a si mesmo com a propria anotacao. Aconteceu na primeira tentativa.
const ondeProcurar = varrer(raiz).filter((f) => !f.endsWith("nada-de-codigo-fantasma.cjs"));
// LINHA DE IMPORT NAO E USO.
//
// Isto lia os arquivos inteiros, e uma importacao que ninguem chama contava como
// se alguem chamasse. Achado em 28/08/2026: `semArtigo` estava importada no
// `leitura.ts` e nao aparecia no corpo dele em lugar nenhum, e o detector dava
// ok. Junto dela passava `comoOCardapioEscreve`, exportada e sem chamador -- e
// ela e uma funcao que DESTROI palavra ("docinho" vira "doco"), do tipo que nao
// pode ficar de pe convidando alguem a usar.
//
// Fora as linhas de import, sobra o que de fato chama.
// E COMENTARIO TAMBEM NAO E USO.
//
// Quarto buraco deste mesmo detector, achado lendo o `conversas.ts` em
// 28/08/2026: `resumoPedidoFechado` estava exportada e sem chamador, e a unica
// "segunda aparicao" dela era uma MENCAO dentro de um comentario que eu proprio
// tinha escrito, explicando que a chamada dela tinha sido removida.
//
// O comentario que conta a morte de uma funcao a mantinha viva aos olhos do
// detector.
const semImports = (texto) =>
  texto
    .split(String.fromCharCode(10))
    .filter((l) => !/^\s*import\s/.test(l) && !/^\s*}\s*from\s+["']/.test(l))
    // Comentario de uma linha, e linha de bloco que comeca com * ou /*.
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join(String.fromCharCode(10));

const tudo = ondeProcurar.map((f) => {
  try { return semImports(fs.readFileSync(f, "utf8")); } catch { return ""; }
}).join(String.fromCharCode(10));

// O QUE JA ESTA ACHADO E AINDA NAO FOI DECIDIDO.
//
// Orfaos de verdade: conferidos um por um no repositorio inteiro, nenhum tem
// uma segunda aparicao. Ficam anotados aqui, onde nao somem de vista, com o
// motivo de ainda estarem de pe.
//
// ESTA LISTA SO PODE ENCOLHER. O teste reprova quando aparece orfao NOVO fora
// dela, e tambem quando um daqui deixa de ser orfao sem ser tirado da lista: nos
// dois casos alguem mexeu e a anotacao ficou pra tras.
//
// O `anexarFotoAoPedido` saiu daqui em 28/08/2026, apagado: era uma segunda
// porta pra mesma tabela, e quem faz o trabalho e o `salvarFotoPendente` mais o
// `grudarFotosNoPedido`.
const PENDENTES = [
  // lib/ia/fatos.ts. O arquivo ainda nao foi lido linha por linha; apagar
  // codigo de arquivo que eu nao li e o oposto do que esta leitura e.
  "RECADO_DA_EQUIPE",

  // lib/banco/parados.ts, os dois. NAO sao codigo morto por engano: sao a
  // metade escrita de uma funcionalidade que nao tem botao.
  //
  // O `carregarDispensados` roda em TODA carga da tela de Recuperar e filtra a
  // lista por uma relacao que nada no sistema consegue escrever: nao existe
  // nenhuma tela, rota ou acao que chame estas duas. A dona nao tem como
  // dispensar um orcamento.
  //
  // Apagar seria apagar codigo certo e deixar o `carregarDispensados` lendo
  // uma lista que nunca enche. A decisao e do dono: por o botao na tela de
  // Recuperar, ou tirar os tres juntos. Anotado no ONDE-PAREI.
  "dispensarOrcamento",
  "reativarOrcamento",
];
const orfaosAchados = [];

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
      orfaosAchados.push(nome);
      if (!PENDENTES.includes(nome)) {
        falhas.push(
          "'" + nome + "' (" + arquivo + ") e exportado e ninguem usa: ou liga no " +
            "fluxo, ou apaga. Codigo que nao roda nao da erro, e por isso ninguem " +
            "descobre que ele esta errado.",
        );
      }
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

// A lista de pendentes so encolhe: quem saiu de orfao tem que sair daqui junto.
for (const p of PENDENTES) {
  if (!orfaosAchados.includes(p)) {
    falhas.push(
      "'" + p + "' esta na lista de pendentes e nao e mais orfao: tire da lista, " +
        "senao o teste passa a proteger uma anotacao velha em vez do codigo.",
    );
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
