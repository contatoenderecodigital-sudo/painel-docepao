// Compila as guardas uma vez e entrega pros testes.
//
// Antes cada teste lia o cerebro.ts e RECORTAVA a funcao por comentario. Toda
// funcao nova no meio do arquivo quebrava tres testes de uma vez, o que
// aconteceu tres vezes em 19/08/2026 e sempre custou tempo com coisa que nao
// era o defeito. Agora e import de verdade: mudar o arquivo de lugar nao
// quebra mais nada, e o teste roda o codigo REAL, nao uma copia digitada.
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

let cache = null;

module.exports = function guardas() {
  if (cache) return cache;
  const pasta = mkdtempSync(join(tmpdir(), "guardas-"));
  execFileSync(
    "npx",
    ["tsc", "lib/ia/guardas.ts", "lib/tipos.ts", "--outDir", pasta,
     "--module", "commonjs", "--target", "es2020",
     "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule"],
    { stdio: "pipe", shell: true },
  );
  cache = require(join(pasta, "ia", "guardas.js"));
  return cache;
};
