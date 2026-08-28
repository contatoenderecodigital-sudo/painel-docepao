// O FORMATO PEDE TUDO QUE O CODIGO LE.
//
// POR QUE ISTO EXISTE
//
// A conversa com a IA tem duas metades escritas em lugares diferentes do mesmo
// arquivo:
//
//     FORMATO      o JSON de exemplo que vai no prompt: "responda NESTE formato"
//     o limpador   o codigo que le a resposta, campo por campo
//
// Quando as duas discordam, o prejuizo e silencioso e sempre do mesmo lado: o
// codigo espera um campo que o modelo nunca foi convidado a mandar.
//
// Achado lendo o arquivo em 28/08/2026, e eram dois:
//
//     ehFesta        o limpador le, e a instrucao da abertura manda devolver.
//                    O formato mostrava um objeto completo SEM ele. Sem
//                    ehFesta a conversa pula a proposta da festa inteira.
//     papelDeArroz   o limpador le. O formato mostrava so { "topo": true }.
//                    Papel de arroz e item cobrado.
//
// Os dois passaram meses assim, e nenhum teste podia ver: o cerebro roda com
// modelo de mentira nos testes, e modelo de mentira devolve o que a gente
// mandar. So o modelo de verdade obedece ao formato.
//
// O QUE ELE COBRA
//
// As duas metades, comparadas na fonte:
//
//   1. todo campo que o limpador le (`lido.X`) aparece no FORMATO
//   2. todo campo do FORMATO e lido por alguem
//
// A segunda importa tanto quanto a primeira: campo no formato que ninguem le e
// token pago em toda mensagem pra nada.
//
// Roda com: node testes/o-formato-pede-tudo-que-o-codigo-le.cjs
const fs = require("node:fs");
const path = require("node:path");

const arq = path.join(__dirname, "..", "lib", "ia", "fluxo", "pensar-openai.ts");
const fonte = fs.readFileSync(arq, "utf8");

// ------------------------------------------------------- os campos do FORMATO
const bloco = fonte.match(/const FORMATO = `[^`]*`/);
if (!bloco) {
  console.log("ERRO  nao achei o FORMATO em pensar-openai.ts");
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}
const json = bloco[0].match(/\{[\s\S]*\}/);
// Chave de primeiro nivel: a que comeca a linha com dois espacos de indentacao.
const doFormato = new Set(
  (json ? json[0].split("\n") : [])
    .map((l) => l.match(/^  "([a-zA-Z]+)":/))
    .filter(Boolean)
    .map((m) => m[1]),
);

// ------------------------------------------------------ os campos que o codigo le
// Tudo que aparece como `lido.<campo>` no limpador.
const lidos = new Set([...fonte.matchAll(/\blido\.([a-zA-Z]+)/g)].map((m) => m[1]));

// Os campos de dentro de `pecas`, que sao lidos como `lido.pecas.X`.
const dentroDePecas = new Set([...fonte.matchAll(/\blido\.pecas\.([a-zA-Z]+)/g)].map((m) => m[1]));
const noFormatoPecas = new Set(
  [...(json ? json[0].matchAll(/"pecas": \{([^}]*)\}/g) : [])]
    .flatMap((m) => [...m[1].matchAll(/"([a-zA-Z]+)":/g)].map((x) => x[1])),
);

console.log("Campos no FORMATO: " + doFormato.size);
console.log("Campos que o limpador le: " + lidos.size);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra(
  "o codigo le campo que o FORMATO nunca pede ao modelo",
  [...lidos].filter((c) => !doFormato.has(c)),
);
cobra(
  "o FORMATO pede campo que ninguem le (token pago em toda mensagem)",
  [...doFormato].filter((c) => !lidos.has(c)),
);
cobra(
  "dentro de pecas, o codigo le campo que o FORMATO nao mostra",
  [...dentroDePecas].filter((c) => !noFormatoPecas.has(c)),
);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o formato pedido e exatamente o formato lido");
console.log("");
console.log("PASSOU");
