// APROVAR E RECUSAR SO VALEM SOBRE PEDIDO QUE ESTA ESPERANDO A EQUIPE.
//
// POR QUE ISTO EXISTE
//
// O `mudarStatus` e o que MANDA O PEDIDO PRA COZINHA: pôr o status em
// 'aprovado' dispara o gatilho `on_pedido_aprovado`, que insere a comanda na
// fila de impressao e a ponte imprime.
//
// Ele nao tinha guarda de estado nenhuma: o update valia pra qualquer pedido do
// negocio, em qualquer status. Todos os vizinhos tem a guarda e dizem por que:
//
//     adicionarItem          "pedido ja aprovado: nao da pra mexer nos itens"
//     salvarItensDoPedido    "pedido ja aprovado: a cozinha recebeu"
//     reenfileirarImpressao  so age em status in ('aprovado','impresso')
//
// O que MANDA PRA COZINHA era o unico sem.
//
// O QUE ACONTECIA, E SAO DUAS COISAS CALADAS
//
// Aprovar um pedido JA IMPRESSO:
//
//   1. o gatilho testa `new.status = 'aprovado' and old.status is distinct from
//      'aprovado'`. E 'impresso' E distinto. Entao entra comanda nova na fila e
//      A COZINHA IMPRIME O MESMO PEDIDO OUTRA VEZ.
//   2. o gatilho faz `new.aprovado_em := now()`, e essa e a data que conta como
//      "quando vendeu" na tela de Resultados. Reaprovar um pedido do mes
//      passado MOVE ELE pro faturamento do mes atual.
//
// E recusar um pedido ja impresso avisa o cliente que "a equipe precisa acertar
// alguns detalhes" com o papel dele ja na bancada da cozinha.
//
// E as duas acoes devolviam `ok: true` sempre, entao a tela dizia "aprovado"
// mesmo quando nada tinha mudado.
//
// O QUE ELE COBRA
//
//   1. o `mudarStatus` so age sobre 'confirmado', e diz se pegou
//   2. as duas acoes so avisam o cliente quando a mudanca pegou
//   3. o gatilho continua sendo o que dispara a impressao, e ele dispara em
//      QUALQUER entrada em 'aprovado': por isso a guarda tem que estar no
//      codigo, nao no gatilho
//
// COMO ELE MEDE, SEM BANCO
//
// Le os ARQUIVOS. A query do `mudarStatus` precisa ter o `status = 'confirmado'`
// e o `returning`; as acoes precisam olhar o retorno antes de avisar o cliente;
// e o gatilho precisa continuar com o `is distinct from`, que e o motivo de tudo
// isso existir. Se qualquer um dos tres mudar de forma, ele reprova apontando.
//
// Roda com: node testes/aprovar-so-vale-uma-vez.cjs
const path = require("node:path");
const fs = require("node:fs");

const raiz = path.join(__dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8").replace(/\r/g, "");

const falhas = [];

// -----------------------------------------------------------------------------
// 1. O `mudarStatus` so age sobre 'confirmado', e devolve se pegou.
// -----------------------------------------------------------------------------
const pedidos = ler("lib", "banco", "pedidos.ts");
const corpo = pedidos.slice(pedidos.indexOf("export async function mudarStatus"));
const mudarStatus = corpo.slice(0, corpo.indexOf("\n}\n") + 2);

if (!/status = 'confirmado'/.test(mudarStatus)) {
  falhas.push(
    "o `mudarStatus` perdeu a guarda `status = 'confirmado'`: aprovar um pedido " +
      "ja impresso faz a cozinha imprimir de novo",
  );
}
if (!/returning/i.test(mudarStatus)) {
  falhas.push("o `mudarStatus` parou de devolver se pegou: a tela volta a dizer que aprovou sem ter aprovado");
}
if (!/Promise<boolean>/.test(mudarStatus)) {
  falhas.push("o `mudarStatus` voltou a nao devolver nada");
}

// -----------------------------------------------------------------------------
// 2. As acoes so avisam o cliente quando a mudanca pegou.
// -----------------------------------------------------------------------------
const acoes = ler("app", "(painel)", "acoes.ts");
for (const [nome, tipo] of [["aprovarPedido", "aprovado"], ["recusarPedido", "recusado"]]) {
  const i = acoes.indexOf("export async function " + nome);
  if (i < 0) {
    falhas.push("a acao " + nome + " sumiu do painel");
    continue;
  }
  const trecho = acoes.slice(i, acoes.indexOf("\n}", i));
  if (!/const pegou = await mudarStatus/.test(trecho)) {
    falhas.push(nome + ": nao olha mais se a mudanca pegou antes de seguir");
  }
  if (!/if \(!pegou\) return \{ ok: false \}/.test(trecho)) {
    falhas.push(nome + ": nao devolve mais o erro quando a mudanca nao pegou, e a tela mente");
  }
  const avisa = trecho.indexOf('avisarCliente');
  const confere = trecho.indexOf("if (!pegou)");
  if (avisa >= 0 && confere >= 0 && avisa < confere) {
    falhas.push(nome + ": avisa o cliente ANTES de conferir se a mudanca pegou");
  }
  if (!new RegExp('avisarCliente\\([^)]*"' + tipo + '"').test(trecho.replace(/\s+/g, " "))) {
    falhas.push(nome + ": nao avisa mais o cliente como '" + tipo + "'");
  }
}

// -----------------------------------------------------------------------------
// 3. O gatilho continua disparando em QUALQUER entrada em 'aprovado'.
//
// E o motivo de a guarda precisar estar no codigo. Se um dia o gatilho passar a
// so disparar vindo de 'confirmado', esta parte avisa que a guarda ficou
// redundante -- o que e bom saber, e nao um defeito.
// -----------------------------------------------------------------------------
const gatilho = ler("db", "2026-08-19_gatilho_com_schema.sql");
if (!/old\.status is distinct from 'aprovado'/.test(gatilho)) {
  falhas.push(
    "o gatilho mudou de forma: confira se ele ainda dispara ao reentrar em " +
      "'aprovado', porque a guarda do codigo foi escrita por causa disso",
  );
}
if (!/new\.aprovado_em := now\(\)/.test(gatilho)) {
  falhas.push("o gatilho parou de carimbar `aprovado_em`: a data da venda vem dai");
}

console.log("Arquivos conferidos: lib/banco/pedidos.ts, app/(painel)/acoes.ts, db/2026-08-19_gatilho_com_schema.sql");
console.log("");

if (falhas.length) {
  console.log("ERRO  aprovar ou recusar voltou a valer mais de uma vez (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    so pedido esperando a equipe e aprovado, e a tela so diz que aprovou se aprovou");
console.log("");
console.log("PASSOU");
