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

// AS DATAS ESPERADAS SAO CALCULADAS, NAO ESCRITAS NA MAO.
//
// Elas eram fixas ("21/08/2026") e o teste quebrou sozinho na virada da
// meia-noite de 19 pra 20/08/2026, sem ninguem ter mexido em codigo nenhum.
// Teste que quebra com o calendario ensina a ignorar teste, e teste ignorado
// nao serve pra nada.
//
// A regra que o codigo implementa: dia da semana e a PROXIMA ocorrencia, e se
// o cliente falar o dia de HOJE, vai pra semana que vem. Numa padaria isso e o
// certo: encomenda pro mesmo dia e caso de falar com a equipe, nao de anotar.
const DIAS = { domingo: 0, segunda: 1, terça: 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6, sabado: 6 };
function proximo(nome) {
  const alvo = DIAS[nome];
  const d = new Date(hoje);
  const falta = ((alvo - d.getDay() + 7) % 7) || 7; // hoje conta como semana que vem
  d.setDate(d.getDate() + falta);
  return d.toLocaleDateString("pt-BR");
}

const casos = [
  ["sexta", proximo("sexta")],
  ["sexta-feira", proximo("sexta")],
  ["na sexta", proximo("sexta")],
  ["sábado", proximo("sabado")],
  ["sabado que vem", proximo("sabado")],
  ["domingo", proximo("domingo")],
  ["segunda", proximo("segunda")],
  ["terça", proximo("terca")],
  ["quarta", proximo("quarta")],
  ["quinta", proximo("quinta")],
  // O dia de HOJE, seja ele qual for: tem que ir pra semana que vem.
  [["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][hoje.getDay()], null],
  ["30/08", null],
  ["amanha", null],
  ["banana", null],
];
// O caso do dia de hoje calcula sozinho o esperado, que e sempre daqui a 7 dias.
casos[10][1] = proximo(["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sabado"][hoje.getDay()]);

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
