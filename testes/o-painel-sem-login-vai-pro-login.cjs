// O PAINEL SEM LOGIN VAI PRO LOGIN, E NAO MOSTRA DADOS DE EXEMPLO.
//
// POR QUE ISTO EXISTE
//
// Nenhuma pagina do painel redirecionava. Elas faziam:
//
//     const sessao = await lerSessao();
//     const fila = await carregarFilaAprovacao(sessao?.negocioId);
//
// Sem sessao, `sessao?.negocioId` e undefined, e o `lib/dados.ts` cai no MOCK
// quando nao recebe negocio. Entao quem abrisse o painel sem estar logado via a
// fila de aprovacao e a lista de clientes cheias de dados de exemplo, com a cara
// do painel de verdade.
//
// Nao vazava nada real: e mock, e as Server Actions conferem a sessao e devolvem
// erro. Mas ficava a mentira, e uma inconsistencia feia: no mesmo dia em que as
// ROTAS de API passaram a responder 401, as TELAS continuavam mostrando teatro.
//
// O MOCK CONTINUA VALENDO SEM BANCO
//
// E pra isso que ele existe ("sem banco configurado, o painel cai no mock, bom
// pra demo"). A guarda so vale quando ha banco: com o banco no ar e sem sessao,
// nao ha demo nenhuma pra mostrar.
//
// O QUE ELE COBRA
//
//   1. o layout do painel manda pro login quem nao tem sessao
//   2. a guarda respeita o modo demo (sem banco, deixa passar)
//   3. o layout continua sendo o ponto unico: se alguem tirar a guarda dali,
//      todas as paginas de dentro voltam a mostrar mock
//   4. as paginas continuam escopando pelo negocio da sessao
//
// Roda com: node testes/o-painel-sem-login-vai-pro-login.cjs
const path = require("node:path");
const fs = require("node:fs");

const raiz = path.join(__dirname, "..");

// Comentario nao conta como codigo. O `\r` sai antes do corte porque sem a flag
// `m` o `$` quer dizer fim da STRING, e a linha termina em `\r\n`.
const semComentario = (...p) =>
  fs
    .readFileSync(path.join(raiz, ...p), "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
    .join("\n");

const falhas = [];
const layout = semComentario("app", "(painel)", "layout.tsx");

// 1 e 2. a guarda existe e respeita a demo
if (!/redirect\("\/login"\)/.test(layout)) {
  falhas.push(
    "o layout do painel nao manda mais pro login: quem abrir sem sessao volta a " +
      "ver a fila e os clientes com dados de exemplo",
  );
}
if (!/!sessao && bancoConfigurado/.test(layout)) {
  falhas.push(
    "a guarda do layout mudou de forma: ela precisa valer so com banco, senao o " +
      "modo demo (sem banco) para de funcionar",
  );
}

// 3. e as paginas de dentro continuam escopando pelo negocio da sessao.
//
// Isto nao e redundante com a guarda: o layout impede a tela de abrir, e o
// escopo impede a tela de misturar tenant se um dia ela abrir por outro caminho.
const paginas = [];
const andar = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) andar(p);
    else if (e.name === "page.tsx") paginas.push(p);
  }
};
andar(path.join(raiz, "app", "(painel)"));

const semEscopo = [];
for (const abs of paginas) {
  const rel = path.relative(raiz, abs);
  const fonte = semComentario(...rel.split(path.sep));
  // Pagina que nao le dado nenhum do banco nao precisa de escopo.
  if (!/carregar[A-Z]|listar[A-Z]/.test(fonte)) continue;
  if (!/lerSessao\(\)/.test(fonte)) {
    semEscopo.push(rel + ": le dado do banco e nao olha a sessao");
  } else if (!/sessao\?\.negocioId|sessao\.negocioId/.test(fonte)) {
    semEscopo.push(rel + ": le a sessao e nao usa o negocio dela pra escopar");
  }
}

console.log("Paginas do painel conferidas: " + paginas.length);
console.log("");

const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};
cobra("pagina do painel lendo dado sem escopar pelo negocio", semEscopo);

if (falhas.length) {
  for (const f of falhas) if (typeof f === "string" && !f.startsWith("pagina")) console.log("ERRO  " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    sem login o painel manda pro login, e a demo sem banco continua de pe");
console.log("");
console.log("PASSOU");
