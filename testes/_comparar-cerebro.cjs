// QUAL CEREBRO LE MELHOR A CLIENTELA DESTA PADARIA.
//
// Nao existe modelo "mais inteligente" no abstrato: existe o que le MELHOR as
// frases que chegam nesta padaria. As frases daqui sao reais, tiradas da
// conversa do dono de 02/09/2026 e das medicoes anteriores, com o que cada uma
// PRECISA que o modelo devolva pra conversa andar.
//
// COMO RODA: manda as falas pra producao, uma por uma, e le no rastro do
// container o que o modelo devolveu ("modelo leu: ..."). Depois troca-se
// OPENAI_MODEL_FLUXO no deploy e roda de novo: os dois relatorios ficam lado a
// lado, com as MESMAS frases.
//
//   node testes/_comparar-cerebro.cjs
//
// Nao e teste de portao: e uma medicao, e por isso nao sai em `todos.cjs`. Roda
// contra a producao e custa dinheiro de API a cada chamada.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const FALAS = [
  {
    fala: "quero 50 salgados a mais e 50 docinhos a mais",
    depois: "Claro, é só dizer o que muda.",
    precisa: "salgado e docinho com quantidade",
    esperado: /salgado/i,
    porque: "e a resposta da proposta; sem ela a conversa trava (foi o defeito de 02/09)",
  },
  {
    fala: "Brigadeiro e beijinho e trufa de morango",
    depois: "E os docinhos, quais você vai querer?",
    precisa: "os tres docinhos",
    esperado: /brigadeiro/i,
    porque: "tres itens numa frase so, com sabor no ultimo",
  },
  {
    fala: "Quero coxinha, bolinha de queijo e ribolho e frango frito com molho.",
    depois: "Qual salgado você quer?",
    precisa: "coxinha e bolinha de queijo; o resto nao existe no cardapio",
    esperado: /coxinha/i,
    porque: "frase com erro de digitacao e produto inventado no meio",
  },
  {
    fala: "Laka e biz",
    depois: "E o bolo, qual sabor?",
    precisa: "os dois sabores de bolo",
    esperado: /laka|biz/i,
    porque: "bolo misto em duas palavras",
  },
  {
    fala: "nao quero topo nem papel de arroz",
    depois: "E papel de arroz, com a foto impressa no bolo? Fica R$ 12,00.",
    precisa: "as duas pecas recusadas",
    esperado: /pecas|naoQuer/i,
    porque: "uma frase respondendo duas perguntas, com negacao dupla",
  },
  {
    fala: "2 kg",
    depois: "O bolo é vendido por quilo. Quantos quilos você quer?",
    precisa: "o peso",
    esperado: /2/,
    porque: "resposta curta que so faz sentido junto da pergunta",
  },
];

const raiz = path.join(__dirname, "..");
const falar = (m) =>
  execFileSync("node", [path.join(__dirname, "falar.cjs"), m], {
    cwd: raiz, encoding: "utf8", timeout: 180000,
  });

const ssh = (cmd) =>
  execFileSync("ssh", ["-i", process.env.HOME + "/.ssh/id_ed25519_hub", "-o", "StrictHostKeyChecking=no",
    "root@179.198.126.197", cmd], { encoding: "utf8", timeout: 120000 });

const containerGrep =
  "docker logs --since 2m $(docker ps --format '{{.Names}}' | grep uyyqf | head -1) 2>&1 | grep -a 'fluxo-novo' | tail -1";

console.log("== comparar cerebro ==");
let quemE = "";
try {
  quemE = ssh("docker logs --since 24h $(docker ps --format '{{.Names}}' | grep uyyqf | head -1) 2>&1 | grep -a cerebro | tail -1").trim();
} catch {}
console.log(quemE || "(nao consegui ler qual cerebro esta no ar)");
console.log("");

let acertos = 0;
for (const c of FALAS) {
  try {
    execFileSync("node", [path.join(__dirname, "falar.cjs"), "--limpar"], { cwd: raiz, timeout: 120000 });
    // A pergunta anterior e o que da sentido a resposta: sem ela, medir a fala
    // sozinha mede outra coisa.
    if (c.depois) falar(c.depois === "Claro, é só dizer o que muda." ? "quero fazer uma festa pra 20 pessoas" : "oi");
    falar(c.fala);
    const linha = ssh(containerGrep);
    const leu = /modelo leu: ([^/]+)/.exec(linha);
    const oQueLeu = leu ? leu[1].trim() : "(nada)";
    const passou = c.esperado.test(oQueLeu);
    if (passou) acertos++;
    console.log((passou ? "ok    " : "ERRO  ") + JSON.stringify(c.fala).slice(0, 52));
    console.log("        precisa: " + c.precisa);
    console.log("        leu:     " + oQueLeu.slice(0, 90));
    if (!passou) console.log("        custa:   " + c.porque);
  } catch (e) {
    console.log("ERRO  " + JSON.stringify(c.fala).slice(0, 52) + " -> " + String(e).slice(0, 80));
  }
}

console.log("");
console.log("ACERTOS: " + acertos + " de " + FALAS.length);
