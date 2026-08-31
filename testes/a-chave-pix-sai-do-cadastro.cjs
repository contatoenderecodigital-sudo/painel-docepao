// A CHAVE PIX SAI DO CADASTRO, E SO DELE.
//
// Cliente real em 31/08/2026, logo depois de fechar um pedido de R$ 299,80:
//
//   cliente >> Show consegue me passar o pix? dai ja pago
//   padaria >> A gente aceita pix, cartão em até 3 vezes ou dinheiro na
//              retirada. Não cobramos entrada, mas se você quiser adiantar, pode.
//
// Ele pediu a CHAVE e ouviu a lista de formas de pagamento, que e a resposta de
// "como posso pagar". Quem pede a chave ja escolheu como paga. O cliente ficou
// sem pagar e a padaria sem o dinheiro na mao.
//
// A chave nao existia em lugar nenhum do sistema: nem no codigo, nem no banco.
//
// AS DUAS METADES:
//
//   sem chave cadastrada  ->  "deixa eu confirmar com a equipe", e chama a equipe
//   com chave cadastrada  ->  manda a chave e pede o comprovante
//
// A IA NUNCA INVENTA A CHAVE. Chave errada e cliente pagando pra outra pessoa, e
// isso nao tem desfazer. Por isso o caminho sem chave chama gente em vez de
// tentar adivinhar.
//
// Roda com: node testes/a-chave-pix-sai-do-cadastro.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-chave-pix.mts");
fs.writeFileSync(
  sonda,
  [
    'import { respostaDeInformacao } from "../lib/ia/fluxo/informacao.ts";',
    'import { DOCE_PAO } from "../lib/ia/persona.ts";',
    "",
    "// Sem chave cadastrada, que e como o sistema esta hoje.",
    "DOCE_PAO.chavePix = null;",
    "DOCE_PAO.pixTitular = null;",
    "const semChave = respostaDeInformacao({ sobre: 'pix' } as never);",
    "",
    "// Com a chave que a dona ainda vai informar.",
    "DOCE_PAO.chavePix = '49999999999';",
    "DOCE_PAO.pixTitular = 'Padaria Doce Pão';",
    "const comChave = respostaDeInformacao({ sobre: 'pix' } as never);",
    "",
    "// A pergunta de COMO PAGA continua sendo outra coisa.",
    "const pagamento = respostaDeInformacao({ sobre: 'pagamento' } as never);",
    "",
    "console.log(JSON.stringify({ semChave, comChave, pagamento }));",
  ].join("\n"),
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-chave-pix.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}

const r = JSON.parse(bruto.trim().split("\n").pop());
let erros = 0;
const falha = (m) => { console.log("ERRO  " + m); erros++; };
console.log("== a chave pix sai do cadastro ==");

if (!r.semChave) {
  falha("sem chave cadastrada a padaria nao respondeu nada");
} else {
  if (r.semChave.precisaHumano !== true) {
    falha("sem chave, tem que chamar a equipe: quem espera a chave esta com o dinheiro na mao");
  }
  if (/\d{5,}/.test(r.semChave.texto)) {
    falha("sem chave cadastrada, apareceu numero na resposta: " + JSON.stringify(r.semChave.texto));
  }
  if (!/equipe/i.test(r.semChave.texto)) {
    falha("sem chave, a resposta nao diz que alguem vai passar: " + JSON.stringify(r.semChave.texto));
  }
  if (!erros) console.log("ok    sem chave cadastrada, chama a equipe e nao inventa numero");
}

if (!r.comChave) {
  falha("com chave cadastrada a padaria nao respondeu nada");
} else {
  const problemas = [];
  if (!r.comChave.texto.includes("49999999999")) problemas.push("a chave nao aparece na resposta");
  if (!/Doce Pão/.test(r.comChave.texto)) problemas.push("o titular nao aparece, e e o que o cliente confere antes de mandar");
  if (r.comChave.precisaHumano !== false) problemas.push("com a chave cadastrada nao precisa chamar ninguem");
  if (!/comprovante/i.test(r.comChave.texto)) problemas.push("nao pede o comprovante, que e o que amarra o pagamento ao pedido");
  if (problemas.length) falha("com chave: " + problemas.join("; "));
  else console.log("ok    com chave cadastrada, manda a chave, o titular e pede o comprovante");
}

if (!r.pagamento || !/cartão|cartao/i.test(r.pagamento.texto)) {
  falha("a pergunta de COMO PAGA deixou de responder as formas de pagamento");
} else if (r.pagamento.texto === (r.comChave && r.comChave.texto)) {
  falha("a resposta de como paga virou a mesma da chave; sao perguntas diferentes");
} else {
  console.log("ok    \"como posso pagar\" continua respondendo as formas de pagamento");
}

console.log(erros ? "REPROVOU EM " + erros : "PASSOU");
process.exit(erros ? 1 : 0);
