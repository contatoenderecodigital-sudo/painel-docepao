// A BUSCA DO CRM ACHA O CLIENTE PELO NUMERO QUE ESTA NA TELA.
//
// O DEFEITO, MEDIDO EM 28/08/2026
//
// A ficha do cliente mostra o telefone FORMATADO:
//
//     +55 (49) 99999-9999
//
// E a busca comparava contra o telefone CRU do banco:
//
//     clientes.filter((c) => (c.nome + " " + c.telefone).includes(t))
//     // c.telefone === "5549999999999"
//
// Entao a equipe procurava o cliente pelo numero escrito ali em cima, ou pelo
// numero que ele dita no balcao com traco e parenteses, e a tela respondia
// "Nenhum cliente encontrado" com o cliente cadastrado.
//
// A REGRA
//
// Quem digita letra procura nome. Quem digita numero procura telefone, e nao
// deveria precisar saber em que formato o banco guardou. Entao, com digito na
// busca, os dois lados viram so digitos, e o 55 do pais sai fora dos dois.
//
// O QUE ELE COBRA
//
//   1. o numero achado do jeito que a TELA mostra, e do jeito que a pessoa fala
//   2. o nome continua funcionando, inclusive parcial e sem ligar pra maiuscula
//   3. quem NAO e pra achar continua nao sendo achado
//   4. a tela usa esta regra, e nao uma copia local dela
//
// A quarta e a que impede o conserto de se perder: se alguem voltar a escrever
// o filtro dentro do componente, os tres primeiros continuam verdes e a tela
// volta a mentir. E o mesmo motivo que fez a regra sair de dentro dela.
//
// Roda com: node testes/a-busca-do-cliente-acha-o-numero-da-tela.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-busca-cliente.mjs");

// Como a ficha mostra: "+55 (49) 99999-9999". O `formatarTelefoneBR` e quem
// manda nisso, entao a sonda pergunta pra ELE em vez de eu escrever a mao.
const SONDA = [
  "import { filtrarClientes } from '../lib/busca-cliente.ts';",
  "import { formatarTelefoneBR } from '../lib/tipos.ts';",
  "",
  "const CLIENTES = [",
  "  { nome: 'Ana Paula', telefone: '5549999887766' },",
  "  { nome: 'Bruno Alves', telefone: '5549991112233' },",
  "  { nome: 'Carla Souza', telefone: '554988776655' },",
  "];",
  "",
  "const acha = (busca) => filtrarClientes(CLIENTES, busca).map((c) => c.nome);",
  "",
  "console.log(JSON.stringify({",
  "  comoATelaMostra: acha(formatarTelefoneBR('5549999887766')),",
  "  formatado:       acha('(49) 99988-7766'),",
  "  comTraco:        acha('99988-7766'),",
  "  comEspaco:       acha('49 99988 7766'),",
  "  soOFinal:        acha('7766'),",
  "  cru:             acha('5549999887766'),",
  "  semPais:         acha('49999887766'),",
  "  nome:            acha('ana'),",
  "  nomeParcial:     acha('Souza'),",
  "  vazio:           acha('   '),",
  "  naoExiste:       acha('91234-0000'),",
  "  nomeQueNaoTem:   acha('Roberto'),",
  "  comoATelaMostraDaCarla: acha(formatarTelefoneBR('554988776655')),",
  "}));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-busca-cliente.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

const falhas = [];
const confere = (chave, esperado) => {
  const achou = r[chave] ?? [];
  console.log("  " + chave.padEnd(24) + " -> " + (achou.length ? achou.join(", ") : "(nada)"));
  if (JSON.stringify(achou) !== JSON.stringify(esperado)) {
    falhas.push(
      chave + ": esperava " + JSON.stringify(esperado) + " e veio " + JSON.stringify(achou),
    );
  }
};

console.log("O que a busca acha:");
confere("comoATelaMostra", ["Ana Paula"]);
confere("formatado", ["Ana Paula"]);
confere("comTraco", ["Ana Paula"]);
confere("comEspaco", ["Ana Paula"]);
// Pedaco de numero acha TODO MUNDO que tem aquele pedaco, e esta certo: quem
// digita "7766" esta procurando, nao sabendo. A Ana termina em 887766 e a Carla
// tem 776655 no meio, entao as duas aparecem.
confere("soOFinal", ["Ana Paula", "Carla Souza"]);
confere("cru", ["Ana Paula"]);
confere("semPais", ["Ana Paula"]);
confere("nome", ["Ana Paula"]);
confere("nomeParcial", ["Carla Souza"]);
confere("vazio", ["Ana Paula", "Bruno Alves", "Carla Souza"]);
confere("naoExiste", []);
confere("nomeQueNaoTem", []);
// A Carla tem numero de OITO digitos (fixo antigo, sem o nono). Se a conta do
// pais estivesse errada, ela cairia fora justo por ser a diferente.
confere("comoATelaMostraDaCarla", ["Carla Souza"]);

// -----------------------------------------------------------------------------
// 4. A TELA USA ESTA REGRA, E NAO UMA COPIA DELA.
// -----------------------------------------------------------------------------
const tela = fs
  .readFileSync(path.join(raiz, "components", "Clientes.tsx"), "utf8")
  .split(/\r?\n/)
  .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
  .join("\n");

if (!/filtrarClientes\(/.test(tela)) {
  falhas.push(
    "components/Clientes.tsx nao chama mais o `filtrarClientes`: a regra da busca " +
      "voltou pra dentro da tela e deixou de ser medida aqui",
  );
}
// A marca do defeito nao e "filtrar" (a tela filtra aniversariante, e esta
// certo): e comparar TELEFONE com `includes` dentro da tela, que foi o que
// deixou de achar o numero que ela mesma mostra.
for (const linha of tela.split("\n")) {
  if (/telefone/.test(linha) && /\.includes\(/.test(linha)) {
    falhas.push(
      "components/Clientes.tsx voltou a comparar telefone por conta propria: " +
        JSON.stringify(linha.trim().slice(0, 80)),
    );
  }
}

console.log("");
if (falhas.length) {
  console.log("ERRO  a busca do cliente nao acha quem devia (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o numero que a tela mostra e o numero que a busca acha");
console.log("");
console.log("PASSOU");
