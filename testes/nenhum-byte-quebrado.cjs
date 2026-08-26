// NENHUM ARQUIVO PODE TER BYTE DE CONTROLE NO MEIO DO CODIGO.
//
// O shell come a barra invertida quando o patch passa por heredoc: o limite de
// palavra vira o byte de backspace (0x08), a regex nunca casa, e o defeito e
// mudo. Nao da erro de compilacao, nao quebra teste nenhum: a guarda so para de
// funcionar e a venda passa.
//
// Aconteceu QUATRO vezes neste projeto em dois dias:
//   - o acessorio do bolo (topo/papel de arroz) que virou "^H"
//   - a quebra de linha do prompt que derrubou dois deploys seguidos
//   - o pedido explicito de cardapio, que deixou de casar e prendeu o cliente
//     sem conseguir ver a lista depois de ter dispensado uma vez
//
// Cada uma custou tempo procurando defeito em codigo que estava certo.
//
// Este teste varre o codigo e falha se achar. Roda em milissegundos.
//
// Roda com: node testes/nenhum-byte-quebrado.cjs
const fs = require("node:fs");
const path = require("node:path");

const PASTAS = ["lib", "app", "components", "testes"];
// O .json entra junto: a foto dos precos e um .json, e foi exatamente nele que
// o acento morreu sem ninguem ver.
const EXTENSOES = /\.(ts|tsx|cjs|mjs|js|json)$/;
// Byte de backspace, escape e outros controles que nao tem o que fazer em
// codigo. Quebra de linha, tabulacao e retorno de carro ficam de fora.
const CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

// O ACENTO DESTRUIDO E O MESMO DEFEITO, EM OUTRA ROUPA.
//
// Quando o texto passa pelo shell numa pagina de codigo que nao entende
// UTF-8, o acento nao vira erro: vira U+FFFD, o losango com interrogacao.
// O arquivo continua valido, o JSON continua parseando, e a chave passa a
// ser um nome que nao existe.
//
// Foi assim que a foto dos precos nasceu com dezesseis produtos com valor
// nulo, e eu cheguei a anotar que o cafe nao tinha cotacao no motor. Nao
// era o motor: era o nome que eu tinha destruido ao gravar o arquivo.
// Escrito por codigo, e nao como caractere literal, senao este proprio arquivo
// seria acusado por ele mesmo.
const ACENTO_DESTRUIDO = String.fromCharCode(0xfffd);

let erros = 0;
const achados = [];

function varrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
      varrer(p);
      continue;
    }
    if (!EXTENSOES.test(e.name)) continue;
    const texto = fs.readFileSync(p, "utf8");
    if (texto.includes(ACENTO_DESTRUIDO)) {
      erros++;
      achados.push(p + "  ACENTO DESTRUIDO (U+FFFD): o shell comeu o acento ao gravar este arquivo");
    }
    texto.split("\n").forEach((linha, i) => {
      if (CONTROLE.test(linha)) {
        erros++;
        const qual = [...linha].find((c) => CONTROLE.test(c));
        achados.push(
          p + ":" + (i + 1) + "  byte 0x" + qual.charCodeAt(0).toString(16).padStart(2, "0") +
          "  ->  " + linha.trim().slice(0, 70),
        );
      }
    });
  }
}

for (const d of PASTAS) if (fs.existsSync(d)) varrer(d);

console.log("Varri " + PASTAS.join(", ") + " atras de byte de controle no codigo.");
console.log("");
if (erros) {
  console.log(erros + " LINHA(S) COM BYTE QUEBRADO:");
  for (const a of achados.slice(0, 20)) console.log("  - " + a);
  console.log("");
  console.log("Quase sempre e uma barra invertida comida pelo shell.");
  console.log("Conserto: reescreva a regex SEM barra invertida, com (^|[^a-z]) e ($| ),");
  console.log("ou use a ferramenta de edicao em vez de heredoc.");
} else {
  console.log("NENHUM BYTE QUEBRADO NO CODIGO");
}
process.exit(erros === 0 ? 0 : 1);
