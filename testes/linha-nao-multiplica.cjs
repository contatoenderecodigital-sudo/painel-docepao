// CONFIRMAR UM DETALHE NAO PODE CRIAR LINHA NOVA.
//
// Teste de aceitacao de 19/08/2026, cliente de coffee break. O pedido terminou
// assim no banco:
//
//   trufa 25 [forminha branca]
//   trufa 25 [morango, forminha branca]
//   trufa 25 [morango, forminha branca]
//   trufa 25 [forminha branca, morango]
//
// Cem trufas onde a cliente pediu VINTE E CINCO. E num laco eterno: a Dora
// perguntava o sabor, a cliente respondia, e em vez de COMPLETAR a linha
// nascia outra, entao o sabor nunca ficava preenchido e ela perguntava de novo.
// A conversa morreu no limite de mensagens sem fechar pedido nenhum.
//
// A causa era mecanica: o codigo so sabia juntar quando existia UMA linha do
// produto. Assim que existiam duas, desistia e passava a criar nova sempre.
//
// Roda com: node testes/linha-nao-multiplica.cjs
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const pasta = mkdtempSync(join(tmpdir(), "merge-"));
execFileSync(
  "npx",
  ["tsc", "lib/banco/montagem.ts", "lib/tipos.ts", "--outDir", pasta,
   "--module", "commonjs", "--target", "es2020",
   "--skipLibCheck", "--esModuleInterop", "--resolveJsonModule"],
  { stdio: "pipe", shell: true },
);

// A regra de juntar linha, lida do arquivo real. Os comentarios saem antes: eu
// explico o defeito antigo escrevendo a condicao velha, e o teste acusava o
// proprio comentario como se fosse codigo.
const fs = require("fs");
const fonte = fs
  .readFileSync("lib/banco/montagem.ts", "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log("== a regra nao pode mais exigir UMA linha so ==");
conferir(
  !/mesmoNome\.length === 1/.test(fonte),
  "a condicao 'mesmoNome.length === 1' saiu do codigo",
  "com duas linhas do mesmo produto, toda confirmacao vira linha nova de novo",
);
conferir(
  /mesmoNome\.length > 0/.test(fonte),
  "e vale pra qualquer numero de linhas",
  "a busca pela linha a completar nao esta abrangente",
);

console.log("");
console.log("== simulando o caso real da trufa ==");
// Reproduz a regra de escolha de linha do arquivo, com os dados reais.
const marca = (t) => String(t ?? "").trim().toLowerCase();
const ENFEITE = /^(sem +(sabor|recheio)|a +definir|nao +informad|n[ãa]o +especificad|indefinid|a +combinar)/i;
const limpar = (t) => (ENFEITE.test(t) ? "" : t);

// Compara por PEDACO: "forminha branca, morango" e "morango, forminha branca"
// sao a mesma coisa, e foi a ordem trocada que gerou a quarta linha de trufa.
const pedacos = (t) => new Set(t.split(",").map((x) => x.trim()).filter(Boolean));
const contem = (maior, menor) => [...menor].every((p) => maior.has(p));

function escolherLinha(linhas, obsNova) {
  const nova = limpar(marca(obsNova));
  const setNova = pedacos(nova);
  return linhas
    .map((x, k) => ({ k, antiga: limpar(marca(x.obs)) }))
    .filter(({ antiga }) => {
      if (!antiga || !nova) return true;
      const setAntiga = pedacos(antiga);
      return contem(setNova, setAntiga) || contem(setAntiga, setNova);
    })
    .sort((a, b) => b.antiga.length - a.antiga.length)[0];
}

// Como a conversa foi: a trufa entra com a forminha, e o sabor chega depois.
let trufas = [{ obs: "forminha branca" }];
const escolha1 = escolherLinha(trufas, "morango, forminha branca");
conferir(escolha1 && escolha1.k === 0, "o sabor completa a linha que ja existia", "criaria uma segunda linha");
trufas[0].obs = "morango, forminha branca";

// E o cliente confirma de novo, que foi o que gerou a terceira e a quarta.
const escolha2 = escolherLinha(trufas, "morango, forminha branca");
conferir(escolha2 && escolha2.k === 0, "confirmar de novo NAO cria a terceira linha", "o laco eterno volta");

const escolha3 = escolherLinha(trufas, "forminha branca, morango");
conferir(escolha3 && escolha3.k === 0, "e nem com as palavras em outra ordem", "criaria a quarta linha");

console.log("");
console.log("== mas sabor DIFERENTE continua sendo linha propria ==");
// Isto tem que continuar funcionando: metade de um sabor e metade de outro sao
// duas linhas de verdade, e juntar faria a cozinha produzir so uma.
const doisSabores = [{ obs: "morango" }];
const outra = escolherLinha(doisSabores, "cereja");
conferir(!outra, "cereja nao entra na linha do morango", "somem 25 trufas de um dos sabores");

const tresLinhas = [{ obs: "morango" }, { obs: "cereja" }, { obs: "nozes" }];
conferir(!escolherLinha(tresLinhas, "limao"), "com tres sabores, o quarto tambem e linha nova", "sabor sumindo");

console.log("");
console.log("== entre varias, completa a MAIS parecida ==");
const varias = [{ obs: "forminha branca" }, { obs: "morango" }];
const certa = escolherLinha(varias, "morango, forminha dourada");
conferir(certa && certa.k === 1, "o morango completa a linha do morango, nao a da forminha", "recheio cai na linha errada");

console.log("");
console.log(erros === 0 ? "LINHA NAO MULTIPLICA" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
