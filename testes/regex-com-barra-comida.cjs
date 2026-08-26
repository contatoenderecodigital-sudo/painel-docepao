// ============================================================================
//  A BARRA INVERTIDA QUE SOME NO CAMINHO ATE O ARQUIVO.
//
//  Ja aconteceu CINCO vezes neste projeto, e tem duas caras:
//
//  1. "\b" vira o byte 0x08 (backspace). Essa o nenhum-byte-quebrado.cjs pega,
//     porque sobra um byte de controle no arquivo.
//
//  2. "\s" vira a letra "s", "\d" vira "d", "\w" vira "w". ESSA NAO SOBRA
//     RASTRO NENHUM: o arquivo fica valido, o TypeScript compila, o build passa
//     e a regra simplesmente procura a letra errada pra sempre. Foi o que
//     aconteceu em 25/08/2026 com a busca do recheio: passou a procurar a letra
//     "s" em vez de espaco, e so nao foi pro ar porque a funcao tinha teste
//     proprio ANTES de ser ligada.
//
//  ESTE ARQUIVO COBRE O CASO 2, E FOI AFINADO DUAS VEZES:
//
//  - A primeira versao tinha "]" no meio de uma classe de caracteres e fechava
//    a propria classe cedo demais. A regra ficava malformada e o detector nao
//    acusava NADA, nem a isca que eu plantei pra testar ele. Detector que diz
//    "nenhum" sem nunca ter pego nada e pior que detector nenhum: da alta.
//
//  - A segunda gritava em 16 lugares e 15 eram plural legitimo do portugues:
//    "(docinho|doce)s?" e "cr[ée]dito|d[ée]bito" nao tem barra comida nenhuma.
//    Detector que grita em tudo e ignorado em uma semana.
//
//  A regra final separa os dois casos, porque em portugues "s" depois de
//  parenteses e plural, e "d" depois de parenteses nao e nada.
//
//  Rodar:  node testes/regex-com-barra-comida.cjs
//  Testar o proprio detector:  node testes/regex-com-barra-comida.cjs --isca
// ============================================================================

const fs = require("fs");
const path = require("path");

const PASTAS = ["lib", "app", "components", "testes"];
const EXT = new Set([".ts", ".tsx", ".cjs", ".js", ".mjs"]);

// "d", "w" e as maiusculas nunca sao plural nem sufixo do portugues: qualquer
// uma delas colada num operador e suspeita, inclusive depois de parenteses.
const SEM_PLURAL = "dwSDW";
// "s" e o caso dificil: "(bolo|torta)s?" e plural de verdade e aparece o tempo
// todo. So conta quando abre um grupo ou a regex inteira, onde plural nao cabe.
const SO_NO_COMECO = "s";

const suspeitas = [];

function arquivos(dir, achados = []) {
  if (!fs.existsSync(dir)) return achados;
  for (const nome of fs.readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next" || nome.startsWith(".")) continue;
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) arquivos(p, achados);
    else if (EXT.has(path.extname(nome))) achados.push(p);
  }
  return achados;
}

/** Os trechos que sao regex: literal /.../ e o miolo de new RegExp("..."). */
function trechosDeRegex(linha) {
  const trechos = [];
  for (const m of linha.matchAll(/new RegExp\(\s*(["'])(.*?)\1/g)) trechos.push(m[2]);
  for (const m of linha.matchAll(/(?:^|[=(,:[!&|?]\s*)\/((?:[^\/\\\n]|\\.)+)\/[gimsuy]*/g)) {
    trechos.push(m[1]);
  }
  return trechos;
}

/** Esta posicao esta dentro de uma classe [ ... ]? La a letra e literal. */
function dentroDeClasse(corpo, ate) {
  const antes = corpo.slice(0, ate);
  return (antes.match(/\[/g) || []).length > (antes.match(/\]/g) || []).length;
}

function varrer(corpo, arq, linha) {
  const marcar = (achado, pos) => {
    if (dentroDeClasse(corpo, pos)) return;
    // Se a barra AINDA esta la, esta tudo certo: e o "\w+" escrito direito.
    if (pos > 0 && corpo[pos - 1] === String.fromCharCode(92)) return;
    suspeitas.push({
      arq,
      linha,
      achado,
      trecho: corpo.length > 70 ? corpo.slice(0, 70) + "..." : corpo,
    });
  };

  // "d", "w" e as maiusculas nunca sao sufixo do portugues. Seguidas de "+" ou
  // de "{" nao ha leitura inocente, em posicao nenhuma da regex.
  for (const m of corpo.matchAll(new RegExp("([" + SEM_PLURAL + "])([+{])", "g"))) {
    marcar(m[1] + m[2], m.index);
  }
  // Com "*" a leitura inocente existe, entao exige operador antes.
  for (const m of corpo.matchAll(
    new RegExp("([(|)^*+?{},[-])([" + SEM_PLURAL + "])([*])", "g"),
  )) {
    marcar(m[2] + m[3], m.index + 1);
  }
  // "s" e o caso dificil: "(bolo|torta)s?" e plural de verdade e aparece o
  // tempo todo. So conta quando abre a regex ou abre um grupo, onde plural nao
  // cabe, e seguido de repeticao (nunca de "?", que e sufixo opcional).
  for (const m of corpo.matchAll(
    new RegExp("([(|^])([" + SO_NO_COMECO + "])([*+])", "g"),
  )) {
    marcar(m[2] + m[3], m.index + 1);
  }
}

const pastas = process.argv.includes("--isca") ? [] : PASTAS;
for (const pasta of pastas) {
  for (const arq of arquivos(pasta)) {
    fs.readFileSync(arq, "utf8")
      .split(/\r?\n/)
      .forEach((linha, i) => {
        for (const corpo of trechosDeRegex(linha)) varrer(corpo, arq, i + 1);
      });
  }
}

// A ISCA: o detector precisa provar que pega o defeito antes de eu confiar num
// "nenhum encontrado". Sao os cinco casos reais que ja apareceram aqui.
if (process.argv.includes("--isca")) {
  const casos = [
    ["^ *(de|com)? *frango", false, "espaco literal, o jeito certo"],
    ["^s*(de|com)?s*frango", true, "\\s comido virou a letra s"],
    ["([0-9]{1,3})d*", true, "\\d comido virou a letra d"],
    ["nomew+", true, "\\w comido virou a letra w"],
    ["^(docinho|doce)s?$", false, "plural legitimo do portugues"],
    ["cart[ãa]o|cr[ée]dito|d[ée]bito", false, "d de debito, nao classe"],
    ["[aeious]*", false, "letra dentro de classe"],
    ["(s[óo] )?me diz", false, "so, nao classe"],
  ];
  let ok = 0;
  for (const [corpo, deviaPegar, porque] of casos) {
    suspeitas.length = 0;
    varrer(corpo, "isca", 0);
    const pegou = suspeitas.length > 0;
    const acertou = pegou === deviaPegar;
    ok += acertou ? 1 : 0;
    console.log(
      (acertou ? "ok" : "FALHA").padEnd(6) +
        (deviaPegar ? "pega  " : "ignora") +
        "  " +
        corpo.padEnd(32) +
        porque,
    );
  }
  console.log("");
  console.log(ok === casos.length ? "O DETECTOR FUNCIONA" : "O DETECTOR ESTA ERRADO");
  process.exit(ok === casos.length ? 0 : 1);
}

console.log("Varri " + PASTAS.join(", ") + " atras de classe de regex sem a barra.");
console.log("");

if (!suspeitas.length) {
  console.log("NENHUMA REGEX COM BARRA COMIDA");
  process.exit(0);
}

console.log(suspeitas.length + " SUSPEITA(S):");
for (const s of suspeitas) {
  console.log('  - ' + s.arq + ":" + s.linha + '  achou "' + s.achado + '" em: ' + s.trecho);
}
console.log("");
console.log("Se era pra ser uma classe, a barra foi comida e a regra procura a LETRA.");
console.log("Reescreva sem barra: espaco literal, [0-9], [a-z], (^|[^a-z]) pra borda.");
process.exit(1);
