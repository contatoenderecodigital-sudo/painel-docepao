// SO A LISTA UNICA ABRE O catalogo.json.
//
// POR QUE ISTO EXISTE
//
// Ate 26/08/2026 havia dezessete arquivos importando o JSON direto, cada um
// remontando a estrutura irregular do seu jeito. Foi a origem do bolo de cafe
// a R$ 1,25 e do churros a R$ 34,90.
//
// A lista unica (`lib/ia/dados/produtos.ts`) e o leitor. Teste, foto de preco
// e o proprio JSON podem continuar lendo a fonte. O resto de `lib/` e `app/`
// pergunta pra lista.
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

console.log("ok    so produtos.ts importa catalogo.json em lib/ e app/");
console.log("");
console.log("PASSOU");
