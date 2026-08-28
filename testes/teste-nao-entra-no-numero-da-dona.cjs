// CONVERSA DE TESTE NAO E VENDA, E NAO E ATENDIMENTO.
//
// POR QUE ISTO EXISTE
//
// A tela de Resultados e o que a dona abre pra saber como foi o mes: faturado,
// pedidos, atendimentos, respostas, horario de pico, produtos mais vendidos.
//
// Ela NAO filtrava cliente de teste em lugar nenhum. Toda conversa que este
// projeto rodou contra a producao entrou nesses numeros: o pedido virou
// faturamento, as mensagens viraram atendimento e resposta, e o cliente ficou
// na ficha do CRM com o nome que a conversa deu ("Marcos Alves", "Ana").
//
// O CRM ate escondia cliente de teste, mas com a regra escrita dentro da
// propria query e conhecendo METADE das faixas: sabia do 55000000 da tela
// "Testar IA" e nao sabia do 55119777700 das medicoes por linha de comando,
// que e a faixa declarada no `medidor.cjs`, no `guardar-conversas.cjs` e no
// `uma-conversa-contra-o-banco.cjs`.
//
// Medir contra producao e regra desta casa ("ver de verdade, nao deduzir"). O
// preco disso e o painel saber separar o instrumento do cliente.
//
// O QUE ELE COBRA
//
//   1. as duas faixas de teste sao reconhecidas, e telefone de gente nao e
//   2. os recortes de dinheiro do `resultados.ts` carregam a exclusao
//   3. toda contagem de mensagem do `resultados.ts` carrega a exclusao
//   4. ninguem volta a escrever a regra na mao dentro de uma query
//
// Roda com: node testes/teste-nao-entra-no-numero-da-dona.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const sonda = path.join(__dirname, "_sonda-teste-cliente.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { ehClienteDeTeste, ehClienteDeVerdade, FAIXAS_DE_TESTE }",
    "  from '../lib/banco/so-cliente-de-verdade.ts';",
    "",
    "const sql = ehClienteDeTeste('c');",
    "const erros = [];",
    "",
    "// as duas faixas que o projeto usa de verdade",
    "for (const f of ['55000000%', '55119777700%']) {",
    "  if (!FAIXAS_DE_TESTE.includes(f)) erros.push('a faixa ' + f + ' saiu da lista');",
    "  if (!sql.includes(f)) erros.push('a faixa ' + f + ' nao entrou no SQL');",
    "}",
    "",
    "// os nomes que a bateria escreve",
    "for (const n of ['cliente de teste%', 'qa %']) {",
    "  if (!sql.includes(n)) erros.push('o nome de teste ' + JSON.stringify(n) + ' nao entrou no SQL');",
    "}",
    "",
    "// o alias tem que ser respeitado, senao a condicao vai pra query errada",
    "if (!sql.includes('c.telefone')) erros.push('o alias nao foi usado no telefone');",
    "if (ehClienteDeVerdade('c') !== 'not ' + sql) erros.push('o contrario nao e o contrario');",
    "",
    "console.log(JSON.stringify({ erros, sql }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-teste-cliente.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

// -----------------------------------------------------------------------------
// 2 e 3. OS RECORTES DA TELA DE RESULTADOS CARREGAM A EXCLUSAO
// -----------------------------------------------------------------------------
const resultados = fs.readFileSync(path.join(raiz, "lib", "banco", "resultados.ts"), "utf8");

const semExclusao = [];
// os tres recortes que decidem dinheiro e contagem de pedido
for (const nome of ["VENDIDO", "NA_FILA", "ESPERANDO_VALOR"]) {
  // REGEX MONTADA COM STRING COME A BARRA: a primeira versao disto usava
  // `new RegExp("const " + nome + "\s*=...")` e o `\s` virava um `s` solto, entao
  // o padrao procurava "const VENDIDOs*=" e nunca achava nada -- o teste
  // reprovava dizendo que o recorte tinha sumido do arquivo, e ele estava la.
  // E o mesmo tropeco que o `barra-comida-dentro-de-aspas` existe pra pegar.
  const i0 = resultados.indexOf("const " + nome + " =");
  const m = i0 < 0 ? null : [null, resultados.slice(i0, resultados.indexOf(";", i0))];
  if (!m) {
    semExclusao.push(nome + ": o recorte sumiu do arquivo");
  } else if (!/NAO_E_TESTE/.test(m[1])) {
    semExclusao.push(nome + ": conta pedido de cliente de teste");
  }
}

// e toda contagem de mensagem
const linhas = resultados.split(/\r?\n/);
linhas.forEach((linha, i) => {
  if (!/from mensagens m\b/.test(linha)) return;
  // o where costuma vir na linha seguinte; olha um pedaco pra frente
  const trecho = linhas.slice(i, i + 5).join(" ");
  if (!/MSG_NAO_E_TESTE/.test(trecho)) {
    semExclusao.push("resultados.ts:" + (i + 1) + ": conta mensagem de cliente de teste");
  }
});

// -----------------------------------------------------------------------------
// 4. NINGUEM ESCREVE A REGRA NA MAO DE NOVO
//
// Era assim que ela estava: solta dentro de uma query, num arquivo so, sabendo
// de metade das faixas.
// -----------------------------------------------------------------------------
const DONO = path.join("lib", "banco", "so-cliente-de-verdade.ts");
const naMao = [];
const andar = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) andar(p);
    else if (/\.(ts|tsx)$/.test(e.name)) {
      const rel = path.relative(raiz, p);
      if (rel === DONO) continue;
      fs.readFileSync(p, "utf8").split(/\r?\n/).forEach((linha, i) => {
        const codigo = linha.replace(/\r/g, "").replace(/\/\/.*$/, "");
        if (/telefone[^\n]*like\s*'55/.test(codigo) || /ilike\s*'(cliente de teste|qa )/.test(codigo)) {
          naMao.push(rel + ":" + (i + 1) + "  " + linha.trim());
        }
      });
    }
  }
};
for (const d of ["lib", "app", "components"]) {
  const dir = path.join(raiz, d);
  if (fs.existsSync(dir)) andar(dir);
}

console.log("Condicao gerada: " + r.sql.slice(0, 100) + "...");
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("a definicao de cliente de teste esta errada", r.erros);
cobra("a tela de Resultados conta teste como se fosse gente", semExclusao);
cobra("alguem escreveu a regra de cliente de teste na mao", naMao);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    o instrumento nao entra no numero da dona");
console.log("");
console.log("PASSOU");
