// REGEX MONTADA COM STRING PRECISA DA BARRA DOBRADA.
//
// POR QUE ISTO EXISTE
//
// O repositorio ja tinha DOIS detectores de barra comida, e nenhum dos dois
// pegava este caso. Achado lendo o `fluxo.ts` linha por linha em 27/08/2026:
//
//     new RegExp("(?:[2-9][0-9]*|" + porExtenso + ")\s+bolos?\b")
//
// Dentro de aspas, `\s` vira a LETRA "s" e `\b` vira o byte de backspace. A
// expressao que nascia era:
//
//     (?:[2-9][0-9]*|(dois|duas|tres|...))s+bolos?
//
// e ela NAO CASA COM NADA. "dois bolos", "2 bolos" e "tres bolos de 1 kg" davam
// todos falso, e quem pedia dois bolos levava um.
//
// POR QUE OS OUTROS DOIS DETECTORES NAO PEGAM
//
//   `nenhum-byte-quebrado` procura byte de controle NO ARQUIVO. Aqui o arquivo
//   tem dois caracteres normais: uma barra e a letra "s".
//
//   `regex-com-barra-comida` olha regex escrita com barras (/.../), e esta e
//   montada com aspas.
//
// O estrago so existe em tempo de execucao, quando o JavaScript monta a string.
// Por isso este terceiro: ele procura a barra SOLTA dentro de aspas, que e o
// momento exato em que ela se perde.
//
// Roda com: node testes/barra-comida-dentro-de-aspas.cjs
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const arquivos = [];
const varrer = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git|\.tmpv/.test(e.name)) varrer(p);
      continue;
    }
    // .cjs TAMBEM, E POR MOTIVO MEDIDO.
    //
    // Isto varria so `lib` e `app`, so `.ts`/`.tsx`. Mas o lugar onde eu monto
    // regex a partir de string com mais frequencia e AQUI DENTRO: as sondas dos
    // testes sao arquivos escritos como texto. Em 28/08/2026 o tropeco
    // aconteceu duas vezes num teste novo, e este detector nao enxergava nada,
    // porque ele nao lia a pasta em que estava.
    if (/\.(tsx?|cjs|mjs)$/.test(e.name)) arquivos.push(p);
  }
};
for (const d of ["lib", "app", "components", "testes"]) varrer(path.join(RAIZ, d));

// As letras que so significam alguma coisa em REGEX, e que dentro de aspas
// viram outra coisa (ou nada). \n, \t e \\ sao escapes de STRING de verdade e
// ficam de fora.
const SO_DE_REGEX = "sSwWbBdD";

const achados = [];
for (const arq of arquivos) {
  const linhas = fs.readFileSync(arq, "utf8").split("\n");
  linhas.forEach((linha, i) => {
    // Comentario nao vira codigo: e la que a gente EXPLICA o defeito.
    if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return;
    // O RETORNO DE CARRO DO WINDOWS COME O FIM DA LINHA, E O COMENTARIO VIRA
    // CODIGO.
    //
    // Sem a flag `m`, o cifrao da expressao quer dizer FIM DA STRING. Toda
    // linha deste repositorio termina com retorno de carro mais quebra de
    // linha, e o ponto do JavaScript nao casa com retorno de carro: o `.*`
    // para antes dele, o cifrao nao vale ali, e o `replace` nao troca nada.
    // O comentario segue inteiro e o detector le comentario como codigo.
    //
    // Nao da erro nenhum, so passa. E da familia do "shell come a barra
    // invertida", que ja custou horas duas vezes: caracter invisivel que
    // desliga a regra em silencio.
    //
    // Medido em 28/08/2026, escrevendo o teste da data: um comentario que
    // EXPLICAVA o defeito foi acusado de ser o defeito.
    const semComentario = linha.replace(/\r/g, "").replace(/\/\/.*$/, "");
    // So interessa linha que monta expressao regular a partir de texto.
    if (!/new RegExp\(/.test(semComentario)) return;

    for (const m of semComentario.matchAll(/"([^"]*)"|'([^']*)'/g)) {
      const dentro = m[1] ?? m[2] ?? "";
      // Barra sozinha (nao dobrada) seguida de letra que so vale em regex.
      const solta = new RegExp("(^|[^\\\\])\\\\[" + SO_DE_REGEX + "]");
      if (solta.test(dentro)) {
        achados.push({
          arquivo: path.relative(RAIZ, arq).replace(/\\/g, "/"),
          linha: i + 1,
          trecho: linha.trim().slice(0, 100),
        });
      }
    }
  });
}

console.log("Arquivos varridos: " + arquivos.length);
console.log("");

if (!arquivos.length) {
  console.log("ERRO  a varredura nao leu nada: o caminho quebrou");
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

if (achados.length) {
  console.log("ERRO  barra solta dentro de aspas, montando regex (" + achados.length + ")");
  for (const a of achados) {
    console.log("        " + a.arquivo + ":" + a.linha);
    console.log("            " + a.trecho);
  }
  console.log("");
  console.log("        Dentro de aspas a barra precisa ser DOBRADA: \\\\s, \\\\b, \\\\d.");
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    nenhuma regex montada com string perdeu a barra");
console.log("");
console.log("PASSOU");
