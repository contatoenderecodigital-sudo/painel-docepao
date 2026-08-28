// A UNIDADE DO ITEM E UMA DECISAO SO, NUM LUGAR SO.
//
// POR QUE ISTO EXISTE
//
// A unidade decide como o cupom da cozinha escreve a linha ("2 kg de bolo" ou
// "2 un de bolo") e como o painel mostra o campo de quantidade. Ela so pode
// valer "un" ou "kg".
//
// Na leitura da camada de banco, 28/08/2026, a mesma pergunta estava respondida
// de SEIS jeitos, em seis arquivos, e quatro deixavam passar:
//
//     produtos.ts    o.unidade === "kg" ? "kg" : "un"        certo
//     fechar.ts      l.unidade === "kg" ? "kg" : "un"        certo
//     conversas.ts   l.unidade ?? "un"                       grava o que vier
//     pedidos.ts     (i.unidade as "un" | "kg") ?? "un"      o cast lava o dado
//     parados.ts     l.unidade ?? itens[n]?.unidade ?? "un"  o "" tapa o padrao
//     resultados.ts  x.unidade || "un"                       so metade
//
// O `??` so troca `null` e `undefined`: unidade em branco no banco continua em
// branco. E o `as` nao converte nada, so cala o TypeScript: "KG" e "kg " chegam
// na comanda como se fossem tipo valido.
//
// O defeito nao era nenhum dos seis. Era existirem seis.
//
// O QUE ELE COBRA
//
//   1. a funcao unica acerta as entradas sujas que o banco devolve de verdade
//   2. ninguem mais decide unidade por conta propria no codigo vivo
//
// A segunda e a que importa: sem ela, daqui a um mes nasce o setimo jeito.
//
// Roda com: node testes/a-unidade-do-item-e-uma-decisao-so.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-unidade.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { unidadeDoItem } from '../lib/tipos.ts';",
    "",
    "// O que o Postgres devolve de verdade quando a coluna nao foi bem escrita,",
    "// mais o que um JSON de fora pode trazer.",
    "const KG = ['kg', 'KG', 'Kg', ' kg ', '  kg'];",
    "const UN = ['un', 'UN', '', ' ', null, undefined, 'unidade', 'litro', 0, 'quilo'];",
    "",
    "const erros = [];",
    "for (const v of KG) {",
    "  const d = unidadeDoItem(v);",
    "  if (d !== 'kg') erros.push(JSON.stringify(v) + ' devia ser kg e deu ' + JSON.stringify(d));",
    "}",
    "for (const v of UN) {",
    "  const d = unidadeDoItem(v);",
    "  if (d !== 'un') erros.push(JSON.stringify(v) + ' devia ser un e deu ' + JSON.stringify(d));",
    "}",
    "console.log(JSON.stringify({ medidas: KG.length + UN.length, erros }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-unidade.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

// -----------------------------------------------------------------------------
// 2. NINGUEM MAIS DECIDE UNIDADE POR CONTA PROPRIA
//
// Procura no codigo vivo qualquer linha que resolva unidade sozinha: o `?? "un"`,
// o `|| "un"`, o cast pro tipo, e o ternario do "kg". A propria `lib/tipos.ts` e
// este teste ficam de fora, porque sao o lugar onde a decisao MORA.
// -----------------------------------------------------------------------------
const PASTAS = ["lib", "app", "components"];
const FORA = new Set([path.join("lib", "tipos.ts")]);
const SUSPEITAS = [
  { re: /unidade[^\n]*\?\?\s*["']un["']/, o: 'o ?? "un" deixa a unidade em branco passar' },
  { re: /unidade[^\n]*\|\|\s*["']un["']/, o: 'o || "un" resolve a unidade fora da funcao unica' },
  { re: /as\s+["']un["']\s*\|\s*["']kg["']/, o: "o cast nao converte nada, so cala o TypeScript" },
  { re: /===\s*["']kg["']\s*\?\s*["']kg["']/, o: 'o ternario do "kg" e uma copia da funcao unica' },
  // A DECISAO TAMBEM SABE SE ESCONDER DENTRO DE UM SELECT.
  //
  // `coalesce(unidade, 'un')` no SQL parecia inofensivo e era a mesma armadilha
  // do `??`: coalesce so troca NULL, entao unidade em branco continuava em
  // branco -- e como mora numa string de query, nenhuma regra que olha codigo
  // TypeScript enxergava. Estava em tres lugares.
  { re: /coalesce\([^)]*unidade[^)]*,\s*["']un["']\)/i, o: "a unidade decidida dentro do SQL, onde coalesce so pega NULL" },
];

const arquivos = [];
const andar = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) andar(p);
    else if (/\.(ts|tsx)$/.test(e.name)) arquivos.push(p);
  }
};
for (const p of PASTAS) {
  const d = path.join(raiz, p);
  if (fs.existsSync(d)) andar(d);
}

const rogues = [];
for (const abs of arquivos) {
  const rel = path.relative(raiz, abs);
  if (FORA.has(rel)) continue;
  const linhas = fs.readFileSync(abs, "utf8").split("\n");
  linhas.forEach((linha, i) => {
    const codigo = linha.replace(/\r/g, "").replace(/\/\/.*$/, "");
    if (!/unidade|["']kg["']/.test(codigo)) return;
    // COMPARAR PODE; DECIDIR SOZINHO NAO. Uma linha que chama `unidadeDoItem`
    // ja tirou a decisao do lugar certo, e so esta perguntando o resultado --
    // e o caso das telas, que escrevem "kg" ou "un." conforme a resposta.
    if (codigo.includes("unidadeDoItem(")) return;
    for (const s of SUSPEITAS) {
      if (s.re.test(codigo)) {
        rogues.push(rel + ":" + (i + 1) + "  " + s.o + "\n            " + linha.trim());
        break;
      }
    }
  });
}

console.log("Valores medidos na funcao unica: " + r.medidas);
console.log("Arquivos varridos atras de outro dono da decisao: " + arquivos.length);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("a funcao unica leu a unidade errado", r.erros);
cobra("alguem decide unidade fora da funcao unica", rogues);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    a unidade sai de um lugar so, e o lixo do banco vira 'un'");
console.log("");
console.log("PASSOU");
