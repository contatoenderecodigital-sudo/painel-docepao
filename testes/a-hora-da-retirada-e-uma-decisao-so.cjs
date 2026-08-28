// A HORA DA RETIRADA: UMA FUNCAO PRA FRASE, UMA PRA CAMPO, E MAIS NENHUMA.
//
// POR QUE ISTO EXISTE
//
// A hora nasce na conversa ("as 16h30"), vira `time` no banco (16:30:00), e
// reaparece no cupom da cozinha, no painel, no aviso do WhatsApp e na tela do
// dia. Cada um desses pontos tinha o seu jeito de arrumar:
//
//     conversas.ts   horaPadrao   ancorado no comeco, valida 0-23
//     parados.ts     horaLimpa    ancorado no comeco, NAO valida a hora
//     acoes.ts       regex solta + slice(0,5)
//     pedidos.ts     slice(0, 5)
//     fila.ts        slice(0, 5)
//
// TRES DEFEITOS MEDIDOS EM 28/08/2026
//
// 1. "as 16h30"  ->  PEDIDO SEM HORA
//
//    O `horaPadrao` era ancorado (/^(\d{1,2})/) e o comentario dele prometia
//    entender "as 16h30". A string comeca com "a", a regex exigia digito, e a
//    funcao devolvia null.
//
// 2. "as 8h da noite"  ->  08:00
//
//    Doze horas antes, num pedido que a cozinha produz por hora marcada. O
//    periodo do dia nao entrava na conta em lugar nenhum do sistema.
//
// 3. "as 9 da manha"  ->  null
//
//    O comentario do `horaNaFrase` prometia essa frase desde sempre. Sem `h`
//    nem `:` depois do 9, a regra nao casava: a padaria perguntava a hora de
//    novo pra quem ja tinha respondido.
//
// E o "1630", que os normalizadores liam como 16:00, jogando fora os 30
// minutos sem avisar ninguem.
//
// O QUE ELE COBRA
//
//   1. o campo ("16h30", "16:30:00", "1630") vira sempre "HH:MM"
//   2. a frase inteira ("quero 50 brigadeiro as 9 da manha") le a hora certa
//   3. numero solto na frase NAO e hora: la ele e quantidade
//   4. ninguem mais arruma hora por conta propria no codigo vivo
//
// A terceira e a que impede o conserto de virar defeito: fazer a frase aceitar
// numero solto transformaria "50 brigadeiro" em 50 horas.
//
// Roda com: node testes/a-hora-da-retirada-e-uma-decisao-so.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-hora.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { horaDaRetirada } from '../lib/tipos.ts';",
    "import { lerAFrase } from '../lib/ia/fluxo/leitor-da-frase.ts';",
    "",
    "const erros = [];",
    "const cobra = (rotulo, deu, esperado, entrada) => {",
    "  if (deu !== esperado) erros.push(rotulo + ' ' + JSON.stringify(entrada) + ': deu ' + JSON.stringify(deu) + ', esperado ' + JSON.stringify(esperado));",
    "};",
    "",
    "// 1. O CAMPO. Entra o que o cliente falou e o que o Postgres devolve.",
    "const CAMPO = [",
    "  ['16h', '16:00'], ['16', '16:00'], ['16:00', '16:00'], ['16:30', '16:30'],",
    "  ['as 16h30', '16:30'], ['\u00e0s 16h30', '16:30'], ['16h30', '16:30'],",
    "  ['16:30:00', '16:30'], ['1630', '16:30'], ['830', '08:30'], ['8', '08:00'],",
    "  ['16.30', '16:30'], ['  16h30  ', '16:30'],",
    "  ['', null], [null, null], [undefined, null], ['24h', null], ['99h', null],",
    "  ['16:70', null], ['de manha', null],",
    "];",
    "for (const [entra, sai] of CAMPO) cobra('campo', horaDaRetirada(entra), sai, entra);",
    "",
    "// 2 e 3. A FRASE INTEIRA, que e outro trabalho: aqui numero solto e",
    "// quantidade de brigadeiro, nao hora.",
    "const hora = (frase) => lerAFrase(frase)?.dados?.hora ?? null;",
    "const FRASE = [",
    "  ['pode ser as 14h', '14:00'],",
    "  ['pode ser as 14:30', '14:30'],",
    "  ['quero as 9 da manha', '09:00'],",
    "  ['pode ser as 8 da noite', '20:00'],",
    "  ['as 3 da tarde', '15:00'],",
    "  ['as 8h da noite', '20:00'],",
    "  ['as 12 da noite', '00:00'],",
    "  ['as 12 da manha', '12:00'],",
    "  ['as 16h30', '16:30'],",
    "  // o numero solto NAO e hora",
    "  ['quero 50 brigadeiro', null],",
    "  ['2 kg de bolo', null],",
    "  // e a despedida no fim da frase nao muda a hora do pedido",
    "  ['pode ser as 8h, boa noite', '08:00'],",
    "];",
    "for (const [frase, sai] of FRASE) cobra('frase', hora(frase), sai, frase);",
    "",
    "console.log(JSON.stringify({ medidas: CAMPO.length + FRASE.length, erros }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-hora.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

// -----------------------------------------------------------------------------
// 4. NINGUEM MAIS ARRUMA HORA POR CONTA PROPRIA
//
// Procura no codigo vivo quem fatia a hora na mao ou escreve a sua propria
// regra de "HH:MM". As duas donas da decisao ficam de fora, e o teste tambem.
// -----------------------------------------------------------------------------
const PASTAS = ["lib", "app", "components"];
const FORA = new Set([
  path.join("lib", "tipos.ts"),                       // o campo
  path.join("lib", "ia", "fluxo", "leitor-da-frase.ts"), // a frase
]);
const SUSPEITAS = [
  { re: /(hora|Hora)[^\n]*\.slice\(0,\s*5\)/, o: "fatiar a hora na mao no lugar de chamar horaDaRetirada" },
  { re: /(hora|Hora)[^\n]*padStart\(2, ?["']0["']\)[^\n]*":"/, o: "montar HH:MM na mao" },
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
  fs.readFileSync(abs, "utf8").split("\n").forEach((linha, i) => {
    const codigo = linha.replace(/\r/g, "").replace(/\/\/.*$/, "");
    if (codigo.includes("horaDaRetirada(")) return;
    for (const s of SUSPEITAS) {
      if (s.re.test(codigo)) {
        rogues.push(rel + ":" + (i + 1) + "  " + s.o + "\n            " + linha.trim());
        break;
      }
    }
  });
}

console.log("Horas medidas: " + r.medidas);
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

cobra("a hora foi lida errado", r.erros);
cobra("alguem arruma hora fora das duas funcoes donas da decisao", rogues);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    a frase le a hora, o campo arruma a hora, e ninguem mais opina");
console.log("");
console.log("PASSOU");
