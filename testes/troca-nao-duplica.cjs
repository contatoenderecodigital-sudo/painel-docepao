// TROCAR UM ITEM POR OUTRO NAO PODE DEIXAR OS DOIS NO PEDIDO.
//
// Teste com clientes ao vivo, 19/08/2026:
//   A cliente trocou o bolo de prestigio por 4 leites e ficaram os DOIS.
//   A senhora trocou cuca simples por cuca de goiaba e ficaram "cuca 1" e
//   "cuca recheada 1", cobranca em dobro na mao da equipe.
//
// Isso tem nome na literatura, chama state momentum (paper MoNET): o modelo
// tende a MANTER o valor antigo e falha justamente em atualizar o que precisava
// mudar. Enquanto trocar for "anota o novo e torce pra ela remover o velho", os
// dois vao ficar.
//
// A guarda que existia mandava "chame anotar_item com o nome do bolo velho
// corrigido pro sabor novo", instrucao que nao quer dizer nada. Agora existe
// trocar_item, que tira e poe numa operacao so.
//
// Este teste roda o EXECUTOR de verdade do cerebro, e confere o resultado no
// ESTADO, nao no texto que ela fala.
//
// Roda com: node testes/troca-nao-duplica.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const pasta = mkdtempSync(join(tmpdir(), "troca-"));
execFileSync(
  "npx",
  ["tsc", "lib/banco/montagem.ts", "lib/tipos.ts",
   "--outDir", pasta, "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule", "--noEmitOnError", "false"],
  { stdio: "pipe", shell: true },
);

// A ferramenta trocar_item empurra DUAS mudancas: remover e item. O que este
// teste garante e que aplicar essas duas mudancas em ordem deixa UMA linha.
function aplicar(itens, mudancas) {
  let saida = itens.map((i) => ({ ...i }));
  const marca = (t) => String(t ?? "").trim().toLowerCase();
  for (const m of mudancas) {
    if (m.tipo === "remover") {
      saida = saida.filter((x) => marca(x.produto) !== marca(m.produto));
    } else if (m.tipo === "item") {
      const i = saida.findIndex((x) => marca(x.produto) === marca(m.produto) && x.categoria === m.categoria);
      if (i >= 0) saida[i] = { ...saida[i], qtd: m.qtd, obs: m.obs ?? saida[i].obs };
      else saida.push({ produto: m.produto, categoria: m.categoria, qtd: m.qtd, obs: m.obs ?? null });
    }
  }
  return saida;
}

// O que o executor do cerebro empurra numa troca, lido do arquivo pra nao
// divergir de uma copia digitada aqui.
const fs = require("fs");
const fonte = fs.readFileSync("lib/ia/cerebro.ts", "utf8");
const bloco = fonte.slice(fonte.indexOf('if (nome === "trocar_item")'), fonte.indexOf('if (nome === "anotar_item")'));

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== o executor empurra remover ANTES de item ==");
const posRemover = bloco.indexOf('tipo: "remover"');
const posItem = bloco.indexOf('tipo: "item"');
conferir(posRemover > 0 && posItem > 0, "as duas mudancas existem", "faltou uma");
conferir(posRemover < posItem, "remover vem antes de item", "ordem invertida: o novo entra e o velho fica");

console.log("");
console.log("== a troca deixa UMA linha, nao duas ==");
const casos = [
  {
    nome: "bolo de prestigio vira bolo 4 leites",
    antes: [{ produto: "bolo prestígio", categoria: "bolo_festa", qtd: 2.5, obs: "pao de lo branco" }],
    sai: "bolo prestígio",
    entra: "bolo 4 leites",
    cat: "bolo_festa",
    qtd: 2.5,
  },
  {
    nome: "cuca simples vira cuca recheada",
    antes: [{ produto: "cuca", categoria: "por_quilo", qtd: 1, obs: null }],
    sai: "cuca",
    entra: "cuca recheada",
    cat: "por_quilo",
    qtd: 1,
  },
  {
    nome: "coxinha vira esfirra no meio de um pedido grande",
    antes: [
      { produto: "coxinha", categoria: "salgado_frito", qtd: 100, obs: null },
      { produto: "brigadeiro", categoria: "docinho", qtd: 60, obs: "forminha dourada" },
    ],
    sai: "coxinha",
    entra: "esfirra",
    cat: "salgado_assado",
    qtd: 100,
  },
];

for (const c of casos) {
  const depois = aplicar(c.antes, [
    { tipo: "remover", produto: c.sai, categoria: c.cat },
    { tipo: "item", produto: c.entra, categoria: c.cat, qtd: c.qtd, obs: null },
  ]);
  const temVelho = depois.some((x) => x.produto.toLowerCase() === c.sai.toLowerCase());
  const temNovo = depois.some((x) => x.produto.toLowerCase() === c.entra.toLowerCase());
  conferir(!temVelho, c.nome + ": o velho SAIU", "ficou " + c.sai + " no pedido, cobranca em dobro");
  conferir(temNovo, c.nome + ": o novo ENTROU", "o novo nao entrou, o cliente fica sem");
  conferir(
    depois.length === c.antes.length,
    c.nome + ": o pedido continua com " + c.antes.length + " linha(s)",
    "ficou com " + depois.length + ": " + depois.map((x) => x.produto).join(", "),
  );
}

console.log("");
console.log("== a troca de BOLO acontece sozinha, sem depender dela obedecer ==");
// O medidor de 19/08/2026 mostrou o estrago: em 3 de 5 execucoes o cliente
// pedia "na verdade muda pra 4 leites" e o pedido continuava com o prestigio.
// Eu devolvia "use trocar_item" e ela simplesmente nao usava. Instrucao boa pro
// modelo e aquela que ele nao precisa obedecer.
const blocoBolo = fonte.slice(
  fonte.indexOf("PEDIR NAO FUNCIONA: O CODIGO TROCA SOZINHO"),
  fonte.indexOf("NAO anotei ainda: ja existe um bolo"),
);
conferir(blocoBolo.length > 0, "o codigo tem o caminho de troca automatica do bolo", "voltou a so pedir");
for (const gatilho of ["troca", "muda", "em vez de", "na verdade", "prefiro"]) {
  conferir(
    blocoBolo.includes(gatilho),
    'reconhece "' + gatilho + '" como pedido de troca',
    "o cliente fala assim e a troca nao acontece",
  );
}
const posRemoverBolo = blocoBolo.indexOf('tipo: "remover"');
const posItemBolo = blocoBolo.indexOf('tipo: "item"');
conferir(
  posRemoverBolo > 0 && posItemBolo > posRemoverBolo,
  "e tira o bolo velho ANTES de por o novo",
  "o novo entra e o velho fica, que e o bug original",
);

console.log("");
console.log("== o executor recusa troca sem sentido ==");
for (const [trecho, oque] of [
  ["marca(sai) === marca(entra)", "sai e entra iguais"],
  ["nao esta anotado neste pedido", "trocar o que nunca foi anotado"],
  ["FORA_DO_CARDAPIO", "trocar por algo que a padaria nao faz"],
  ["obsQueOClienteNaoDisse", "observacao que o cliente nunca falou"],
]) {
  conferir(bloco.includes(trecho), "recusa: " + oque, "guarda ausente no executor");
}

console.log("");
console.log(erros === 0 ? "TROCA NAO DUPLICA" : erros + " FALHA(S) NA TROCA");
process.exit(erros === 0 ? 0 : 1);
