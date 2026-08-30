// SO A LISTA UNICA ABRE O catalogo.json.
//
// POR QUE ISTO EXISTE
//
// Ate 26/08/2026 havia dezessete arquivos importando o JSON direto, cada um
// remontando a estrutura irregular do seu jeito. Foi a origem do bolo de cafe
// a R$ 1,25 e do churros a R$ 34,90.
//
// A lista unica (`lib/ia/dados/produtos.ts`) e o leitor. Teste, foto de preco
// e o proprio JSON podem continuar lendo a fonte. O resto de `lib/`, `app/` e
// `components/` pergunta pra lista.
//
// A TELA ENTROU NA VARREDURA EM 30/08/2026.
//
// Eram so `lib/` e `app/`, e a tela e justamente onde a copia se esconde
// melhor: `components/PedidoMontado.tsx` tinha as 21 cores de forminha
// reescritas a mao. Componente de cliente nao pode importar o JSON de qualquer
// jeito (o catalogo inteiro viraria bundle de navegador), entao o dado desce
// pela rota que a tela ja chama.
//
// Roda com: node testes/o-catalogo-tem-um-leitor.cjs
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const PERMITIDO = new Set(["lib/ia/dados/produtos.ts"]);

const arquivos = [];
const varrer = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git/.test(e.name)) varrer(p);
      continue;
    }
    if (!/\.tsx?$/.test(e.name)) continue;
    arquivos.push(p);
  }
};
varrer(path.join(RAIZ, "lib"));
varrer(path.join(RAIZ, "app"));
varrer(path.join(RAIZ, "components"));
if (!arquivos.length) {
  console.log("ERRO  a varredura nao leu arquivo nenhum: o caminho quebrou");
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

const leitores = [];
for (const arq of arquivos) {
  const rel = path.relative(RAIZ, arq).replace(/\\/g, "/");
  if (PERMITIDO.has(rel)) continue;
  const texto = fs.readFileSync(arq, "utf8");
  if (/from\s+["'][^"']*catalogo\.json["']/.test(texto) || /require\([^)]*catalogo\.json/.test(texto)) {
    leitores.push(rel);
  }
}

console.log("Arquivos varridos: " + arquivos.length);
if (leitores.length) {
  console.log("ERRO  ainda leem catalogo.json direto (" + leitores.length + ")");
  for (const a of leitores) console.log("        " + a);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    so produtos.ts importa catalogo.json em lib/, app/ e components/");
console.log("");
console.log("PASSOU");
