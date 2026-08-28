// O QUE A EQUIPE DIGITA NA TELA E CONFERIDO ANTES DE VIRAR LINHA NO BANCO.
//
// POR QUE ISTO EXISTE
//
// A tela do pedido em montagem grava no MESMO jsonb que a IA le na proxima
// mensagem do cliente. Entao o que a equipe digita ali nao fica na tela: ele
// volta pra conversa, pro fechamento e pra comanda da cozinha.
//
// A rota gravava o corpo do request direto:
//
//     itens: (corpo.itens ?? []) as never
//
// Um `as never` calando o compilador, e nada conferindo o conteudo. Uma `qtd`
// que nao e numero vira preco errado no fechamento; um `produto` vazio vira
// linha muda na comanda.
//
// E O CONTRASTE ESTAVA NO MESMO ARQUIVO
//
// O caminho que edita o pedido JA FECHADO faz tudo certo: cota pelo motor e
// recusa item que o cardapio nao reconhece, devolvendo o nome do item pra tela
// mostrar. So o caminho da montagem entrava cru.
//
// E a nona pergunta da lista outra vez, agora dentro de um arquivo so: eu
// consertei um lado dessa regra em outro lugar?
//
// A REGRA: RECUSA A GRAVACAO INTEIRA, NAO DESCARTA A LINHA RUIM
//
// Descartar calado e o defeito do "nada some do pedido": a equipe salva, a tela
// diz que salvou, e o item que ela digitou nao esta la. Melhor a tela dizer qual
// linha esta errada e por que.
//
// O QUE ELE COBRA
//
//   1. o que esta certo passa, e passa inteiro
//   2. quantidade que nao e numero, ou zero, ou negativa, e recusada COM O NOME
//      do produto na mensagem
//   3. produto vazio e recusado com o NUMERO da linha
//   4. a unidade sai do `unidadeDoItem` (o lixo do banco vira "un")
//   5. a categoria que falta sai do `categoriaDoPedido`, que e a fonte unica
//   6. a rota chama a conferencia e devolve 400 com o motivo
//
// Roda com: node testes/o-que-a-equipe-digita-e-conferido.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-equipe-digita.mjs");

const SONDA = [
  "import { itensDaEquipe } from '../lib/banco/montagem.ts';",
  "",
  "const erros = [];",
  "const recusa = (rotulo, brutos, pedaco) => {",
  "  const r = itensDaEquipe(brutos);",
  "  if (r.ok) { erros.push(rotulo + ': PASSOU e devia ser recusado'); return; }",
  "  if (pedaco && !r.erro.includes(pedaco)) {",
  "    erros.push(rotulo + ': recusou, mas a mensagem nao diz ' + JSON.stringify(pedaco) + ': ' + JSON.stringify(r.erro));",
  "  }",
  "};",
  "const passa = (rotulo, brutos) => {",
  "  const r = itensDaEquipe(brutos);",
  "  if (!r.ok) erros.push(rotulo + ': foi recusado e devia passar: ' + r.erro);",
  "  return r.ok ? r.itens : [];",
  "};",
  "",
  "// 1. o que esta certo passa, e passa inteiro",
  "const bons = passa('linha certa', [",
  "  { produto: 'brigadeiro', categoria: 'docinho', qtd: 100, unidade: 'un', obs: 'forminha azul' },",
  "]);",
  "if (bons.length !== 1) erros.push('a linha certa sumiu');",
  "else {",
  "  const i = bons[0];",
  "  if (i.produto !== 'brigadeiro') erros.push('o produto mudou: ' + i.produto);",
  "  if (i.qtd !== 100) erros.push('a quantidade mudou: ' + i.qtd);",
  "  if (i.obs !== 'forminha azul') erros.push('a observacao sumiu: ' + JSON.stringify(i.obs));",
  "}",
  "",
  "// 2. quantidade que nao e numero, com o NOME do produto na mensagem",
  "recusa('qtd texto',     [{ produto: 'coxinha', qtd: 'muitas' }], 'coxinha');",
  "recusa('qtd zero',      [{ produto: 'coxinha', qtd: 0 }], 'coxinha');",
  "recusa('qtd negativa',  [{ produto: 'coxinha', qtd: -5 }], 'coxinha');",
  "recusa('qtd ausente',   [{ produto: 'coxinha' }], 'coxinha');",
  "recusa('qtd infinita',  [{ produto: 'coxinha', qtd: Infinity }], 'coxinha');",
  "",
  "// 3. produto vazio, com o NUMERO da linha (nao ha nome pra citar)",
  "recusa('produto vazio', [{ produto: '', qtd: 10 }], 'linha 1');",
  "recusa('produto ausente', [{ qtd: 10 }], 'linha 1');",
  "recusa('produto so espaco', [{ produto: '   ', qtd: 10 }], 'linha 1');",
  "// e a linha certa: a mensagem aponta a SEGUNDA quando o erro e na segunda",
  "recusa('erro na segunda linha', [{ produto: 'coxinha', qtd: 10 }, { produto: '', qtd: 5 }], 'linha 2');",
  "",
  "// 4. a unidade sai da funcao unica",
  "const un = passa('unidade suja', [{ produto: 'bolo', qtd: 2, unidade: 'KG' }]);",
  "if (un[0] && un[0].unidade !== 'kg') erros.push('a unidade nao passou pelo unidadeDoItem: ' + un[0].unidade);",
  "const un2 = passa('unidade vazia', [{ produto: 'bolo', qtd: 2, unidade: '' }]);",
  "if (un2[0] && un2[0].unidade !== 'un') erros.push('unidade vazia devia virar un: ' + un2[0].unidade);",
  "",
  "// 5. a categoria que falta sai do cardapio, e nao de um chute",
  "const semCat = passa('sem categoria', [{ produto: 'coxinha', qtd: 10 }]);",
  "if (semCat[0] && !semCat[0].categoria) erros.push('a categoria ficou vazia em vez de sair do cardapio');",
  "",
  "// e lista vazia e valida: a equipe pode zerar a montagem",
  "passa('lista vazia', []);",
  "",
  "console.log(JSON.stringify({ erros, exemplo: semCat[0] ? semCat[0].categoria : null }));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-equipe-digita.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

// -----------------------------------------------------------------------------
// 6. A ROTA usa a conferencia, e devolve o motivo.
//
// Ter a funcao e nao chamar ela seria o pior dos dois mundos: parece conferido
// e nao e.
// -----------------------------------------------------------------------------
// COMENTARIO NAO E CODIGO, E ESSA JA ME PEGOU TRES VEZES NESTE DIA.
//
// A primeira versao desta parte procurava o cast no arquivo inteiro, e acusou a
// MENCAO dele dentro do comentario que explica que ele foi removido. E o mesmo
// buraco que ja apareceu no detector de codigo fantasma e no detector da barra
// comida: o comentario que narra a morte de uma coisa a mantem viva aos olhos de
// quem procura por texto.
//
// O `\r` sai antes do corte porque sem a flag `m` o `$` quer dizer fim da
// STRING, e a linha termina em `\r\n`: o corte nao tiraria nada. Foi o defeito
// que desligou cinco detectores neste repositorio.
const rota = fs
  .readFileSync(path.join(raiz, "app", "api", "montagem", "route.ts"), "utf8")
  .split(/\r?\n/)
  .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
  .join("\n");
const naRota = [];
if (/as never/.test(rota)) {
  naRota.push("o `as never` voltou pra rota: o corpo do request grava sem conferencia");
}
if (!/itensDaEquipe\(/.test(rota)) {
  naRota.push("a rota parou de chamar `itensDaEquipe`: a conferencia existe e ninguem usa");
}
if (!/if \(!conferidos\.ok\) return Response\.json\(\{ erro: conferidos\.erro \}/.test(rota)) {
  naRota.push("a rota nao devolve mais o motivo da recusa, e a tela fica sem o que mostrar");
}

console.log("Categoria derivada do cardapio no exemplo: " + JSON.stringify(r.exemplo));
console.log("");

const falhas = [...r.erros, ...naRota];
if (falhas.length) {
  console.log("ERRO  o que a equipe digita entra sem conferencia (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    linha errada e recusada com o motivo, e a linha certa passa inteira");
console.log("");
console.log("PASSOU");
