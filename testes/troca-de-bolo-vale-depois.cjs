// A TROCA DE BOLO VALE MESMO QUANDO ELA SO GRAVA DEPOIS.
//
// Medicao de 20/08/2026, cenario "troca de bolo nao duplica": 3 de 5. Nas duas
// execucoes que falharam o pedido fechou com o bolo que o cliente tinha
// rejeitado. O rastro explicou:
//
//   msg 1: quero um bolo de 2 kg de prestigio pra festa dia 12/09
//   msg 2: pao de lo branco
//   msg 3: na verdade muda pra 4 leites
//   msg 4: as 16h, nome Patricia Bonfanti, pix
//
// Ela so tentou gravar o bolo novo na mensagem 4. Nessa hora a fala do momento
// era "as 16h, nome Patricia Bonfanti, pix", sem palavra de troca nenhuma,
// entao o codigo recusava e mandava usar outra ferramenta. Ela desistia e o
// prestigio ficava.
//
// Foi o QUINTO defeito da mesma familia na mesma noite: guarda lendo so a
// ultima mensagem. Conversa nao e a ultima mensagem.
//
// O segundo caso deste arquivo saiu do mesmo rastro: ela chamou anotar_item com
// produto "topo de bolo" e categoria "bolo_festa", e a guarda de dois bolos
// tratou o topo como um bolo concorrente, mandando trocar o bolo de brigadeiro
// POR um topo de bolo. Topo nao e bolo, e o catalogo sabe disso.
//
// Roda com: node testes/troca-de-bolo-vale-depois.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const pasta = mkdtempSync(join(tmpdir(), "bolo-"));
execFileSync(
  "npx",
  ["tsc", "lib/ia/produtos.ts", "lib/tipos.ts", "--outDir", pasta,
   "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule"],
  { stdio: "pipe", shell: true },
);
const catalogo = require("../lib/ia/dados/catalogo.json");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

// A mesma regra do cerebro depois do conserto: a intencao de troca vale da
// conversa inteira, nao da fala do momento.
const TROCA = /\b(troca|trocar|muda|mudar|mude|em vez de|no lugar de|na verdade|ao inves|prefiro|melhor)\b/i;
const querTrocar = (falas) => TROCA.test(falas.join(" | "));

console.log("== a troca dita antes continua valendo depois ==");
const conversaReal = [
  "boa tarde, quero um bolo de 2 kg de prestigio pra festa dia 12/09",
  "pao de lo branco",
  "na verdade muda pra 4 leites",
  "as 16h, nome Patricia Bonfanti, pix",
];
conferir(querTrocar(conversaReal), "o caso real: troca na msg 3 vale na msg 4", "nao reconheceu");
conferir(
  !querTrocar(["as 16h, nome Patricia Bonfanti, pix"]),
  "e lendo so a ultima fala, como era antes, NAO reconhece",
  "o teste nao esta medindo o que quebrou",
);

console.log("");
console.log("== conversa sem troca nao vira troca ==");
for (const falas of [
  ["quero um bolo de 2 kg de brigadeiro pra sabado", "pao de lo branco", "nome Ana, pix"],
  ["boa tarde", "quanto custa o bolo?", "obrigada"],
  ["quero 100 coxinhas e um bolo de laka de 3 kg"],
]) {
  conferir(!querTrocar(falas), '"' + falas.join(" / ").slice(0, 44) + '" nao e troca', "virou troca sem motivo");
}

console.log("");
console.log("== topo de bolo NAO e um segundo bolo ==");
// O topo nao mora no catalogo: o valor e lancado pela equipe depois. Por isso a
// guarda o reconhece pelo NOME, do mesmo jeito que produtos.ts ja faz pra
// coloca-lo no enum da ferramenta. Se um dia mudar de nome nos dois lugares,
// este teste quebra antes de o cliente receber a instrucao absurda de trocar o
// bolo de brigadeiro POR um topo de bolo.
const { produtosDoCardapio } = require(join(pasta, "ia", "produtos.js"));
const ACESSORIO = /^(topo de bolo|papel de arroz|vela|velas)($| )/;
const semAcP = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

conferir(
  produtosDoCardapio().some((n) => semAcP(n) === "topo de bolo"),
  "o topo de bolo existe como produto que ela pode anotar",
  "sumiu do enum",
);
for (const nome of ["topo de bolo", "papel de arroz"]) {
  conferir(ACESSORIO.test(semAcP(nome)), '"' + nome + '" e acessorio, nao concorre com o bolo', "seria tratado como bolo");
}
for (const nome of ["bolo 4 leites", "bolo prestígio", "bolo laka", "bolo de brigadeiro"]) {
  conferir(!ACESSORIO.test(semAcP(nome)), '"' + nome + '" continua sendo bolo de verdade', "virou acessorio");
}

console.log("");
console.log(erros === 0 ? "A TROCA DE BOLO NAO SE PERDE" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
