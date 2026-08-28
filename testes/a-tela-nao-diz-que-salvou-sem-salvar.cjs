// A TELA NAO DIZ QUE SALVOU SEM TER SALVADO.
//
// POR QUE ISTO EXISTE, E O DETALHE TECNICO QUE ESCONDIA O DEFEITO
//
// `await fetch` SO LANCA EM ERRO DE REDE. Um 401 ou um 500 nao lancam nada:
// passam direto pelo `try` e caem na linha seguinte. Entao este padrao, que
// parece protegido, nao protege:
//
//     try {
//       await fetch("/api/...", { method: "POST", ... });
//       onToast("Nota salva.");            // <- roda tambem com 401 e com 500
//     } catch {
//       onToast("Nao consegui salvar.");   // <- so roda se a REDE cair
//     }
//
// QUATRO LUGARES ESTAVAM ASSIM, medidos em 28/08/2026:
//
//   Clientes.tsx        mostrava "Salvo" com o certinho verde
//   Atendimentos.tsx    dava o toast "Nota salva" (a MESMA nota, outra tela)
//   PainelConexao.tsx   mostrava o toggle com a Dora DESLIGADA
//   PainelConexao.tsx   mostrava a tela desconectando
//
// A nota do cliente e onde a equipe escreve o que precisa lembrar dele, e pode
// ser uma alergia. E o toggle da Dora decide se ela responde cliente sozinha: a
// dona desligava, via desligado, e a IA continuava atendendo.
//
// O QUE ELE COBRA
//
//   1. nenhuma acao de tela chama `await fetch` sem guardar o resultado
//   2. quem guarda, confere (`!r.ok`) antes de dizer que deu certo
//   3. a mensagem de falha diz o ESTADO REAL, e nao so "tente de novo": a Dora
//      continua atendendo, o numero continua conectado, o texto continua na tela
//
// A terceira e a que faz diferenca pra quem esta na padaria: saber que falhou
// nao basta, precisa saber o que ficou valendo.
//
// Roda com: node testes/a-tela-nao-diz-que-salvou-sem-salvar.cjs
const path = require("node:path");
const fs = require("node:fs");

const raiz = path.join(__dirname, "..");

// Comentario nao conta como codigo. O `\r` sai antes do corte porque sem a flag
// `m` o `$` quer dizer fim da STRING, e a linha termina em `\r\n`.
const semComentario = (rel) =>
  fs
    .readFileSync(path.join(raiz, rel), "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
    .join("\n");

const componentes = fs
  .readdirSync(path.join(raiz, "components"))
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => path.join("components", f));

const falhas = [];

// -----------------------------------------------------------------------------
// 1. Ninguem chama `await fetch` sem guardar o resultado.
//
// A marca do defeito e a linha COMECAR com `await fetch`: quando o retorno e
// guardado, ela comeca com `const r = await fetch`.
// -----------------------------------------------------------------------------
for (const rel of componentes) {
  const fonte = semComentario(rel);
  fonte.split("\n").forEach((linha, i) => {
    if (/^\s*await fetch\(/.test(linha)) {
      falhas.push(
        rel + ":" + (i + 1) + " chama a rota e nao guarda o resultado: a tela vai " +
          "dizer que deu certo mesmo com 401 ou 500, porque `await fetch` so lanca " +
          "em erro de rede",
      );
    }
  });
}

// -----------------------------------------------------------------------------
// 2 e 3. Os quatro lugares consertados continuam conferindo, e dizendo o
// estado real.
//
// Cada frase aqui foi escrita pensando em quem le na padaria. Se ela sumir, o
// aviso volta a ser "tente de novo", que nao diz o que ficou valendo.
// -----------------------------------------------------------------------------
const DIZERES = [
  ["components/PainelConexao.tsx", /CONTINUA ATENDENDO/, "que a Dora continua atendendo quando o desligar falha"],
  ["components/PainelConexao.tsx", /CONTINUA CONECTADO/, "que o numero continua conectado quando o desconectar falha"],
  ["components/Clientes.tsx", /continua aqui/, "que o texto da nota continua na tela quando o salvar falha"],
  ["components/Atendimentos.tsx", /continua aqui/, "que o texto da nota continua na tela quando o salvar falha"],
];
for (const [rel, marca, oQue] of DIZERES) {
  const fonte = semComentario(rel);
  if (!marca.test(fonte)) {
    falhas.push(rel + ": parou de dizer " + oQue);
  }
}

// e as quatro conferem o `!r.ok` de verdade
const CONFEREM = [
  "components/PainelConexao.tsx",
  "components/Clientes.tsx",
  "components/Atendimentos.tsx",
];
for (const rel of CONFEREM) {
  const fonte = semComentario(rel);
  if (!/if \(!r\.ok\)/.test(fonte)) {
    falhas.push(rel + ": nao confere mais o `!r.ok` antes de dizer que deu certo");
  }
}

console.log("Componentes varridos: " + componentes.length);
console.log("");

if (falhas.length) {
  console.log("ERRO  tela dizendo que salvou sem ter salvado (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o que a tela diz que aconteceu foi o que aconteceu");
console.log("");
console.log("PASSOU");
