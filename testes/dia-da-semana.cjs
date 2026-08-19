// Testa a conversao de dia da semana com o codigo REAL, extraido do arquivo,
// e nao com uma copia digitada aqui que poderia divergir sem ninguem notar.
const fs = require("fs");
const fonte = fs.readFileSync("lib/ia/cerebro.ts", "utf8");

const ini = fonte.indexOf("const diaDaSemanaViraData = (texto: string): string | null => {");
const fim = fonte.indexOf("    const emSaoPaulo = (dias: number) => {");
if (ini < 0 || fim < 0) throw new Error("nao achei a funcao no arquivo");

const corpo = fonte
  .slice(ini, fim)
  .replace("(texto: string): string | null =>", "(texto) =>")
  .replace("const nomes: Record<string, number> =", "const nomes =");

const diaDaSemanaViraData = eval("(" + corpo.replace("const diaDaSemanaViraData = ", "").trim().replace(/;$/, "") + ")");

const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const nomeDia = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][hoje.getDay()];
console.log("hoje na padaria:", hoje.toLocaleDateString("pt-BR"), nomeDia);
console.log("");

const casos = [
  ["sexta", "21/08/2026"],
  ["sexta-feira", "21/08/2026"],
  ["na sexta", "21/08/2026"],
  ["sábado", "22/08/2026"],
  ["sabado que vem", "22/08/2026"],
  ["domingo", "23/08/2026"],
  ["segunda", "24/08/2026"],
  ["terça", "25/08/2026"],
  ["quarta", "26/08/2026"], // hoje e quarta: tem que ir pra semana que vem
  ["quinta", "20/08/2026"],
  ["30/08", null],
  ["amanha", null],
  ["banana", null],
];

let erros = 0;
for (const [entrada, esperado] of casos) {
  const deu = diaDaSemanaViraData(entrada);
  const ok = deu === esperado;
  if (!ok) erros++;
  console.log((ok ? "ok  " : "ERRO") + "  " + String(entrada).padEnd(16) + " -> " + String(deu) + (ok ? "" : "   (esperado " + esperado + ")"));
}
console.log("");
console.log(erros === 0 ? "TODOS OS CASOS PASSARAM" : erros + " CASO(S) FALHARAM");
process.exit(erros === 0 ? 0 : 1);
