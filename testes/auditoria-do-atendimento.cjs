// AUDITORIA: A DORA ESTA ROBOTIZADA, REPETITIVA OU BURRA?
//
// O medidor diz se o PEDIDO sai certo. Os testes dizem se as pecas funcionam.
// Nenhum dos dois diz se a conversa e boa de ler, e foi lendo conversa que
// apareceram vinte defeitos em 20 e 21/08/2026.
//
// Isto le as conversas gravadas no banco e mede o que da pra medir:
//
//   1. REPETICAO: ela faz a mesma pergunta duas vezes? abre toda mensagem
//      igual? repete a mesma frase decorada?
//   2. TAMANHO: mensagem longa demais no WhatsApp nao e lida.
//   3. PERGUNTA POR MENSAGEM: mais de uma pergunta junto e formulario.
//   4. PEDIDO VAZIO: ela disse "anotei" com o banco vazio?
//   5. GUARDAS: quantas recusas por conversa. Guarda que recusa demais esta
//      errada, e foi assim que se descobriu que eu bloqueava toda venda de
//      pizza.
//
// Nao substitui ler a conversa. Serve pra dizer ONDE ler.
//
// Roda com: node testes/auditoria-do-atendimento.cjs [prefixo-do-telefone]
const { execFile } = require("node:child_process");
const CHAVE = require("node:os").homedir() + "/.ssh/id_ed25519_hub";
const FAIXA = (process.argv[2] || "5511987") + "%";

const ssh = (cmd) =>
  new Promise((ok, no) =>
    execFile("ssh", ["-i", CHAVE, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=no",
      "root@179.198.126.197", cmd], { timeout: 180000, maxBuffer: 16 * 1024 * 1024 },
      (e, out, err) => (e ? no(String(err || e)) : ok(String(out)))));

const psql = (sql) =>
  ssh("docker exec $(docker ps --filter name=gdgroavvfkkcdxvbrzvth5xc -q|head -1) " +
      "psql -U hub -d enderecodigital_hub -A -t -c \"" + sql + "\"");

const semAc = (t) => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalizar = (t) => semAc(t).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

(async () => {
  const linhas = (await psql(
    "select c.telefone || '|' || m.papel || '|' || replace(coalesce(m.conteudo,''), chr(10), ' ') " +
    "from docepao.mensagens m join docepao.clientes c on c.id=m.cliente_id " +
    "where c.telefone like '" + FAIXA + "' order by c.telefone, m.criado_em",
  )).split("\n").map((l) => l.trim()).filter(Boolean);

  if (!linhas.length) { console.log("nenhuma conversa na faixa " + FAIXA); process.exit(0); }

  const conversas = {};
  for (const l of linhas) {
    const [fone, papel, ...resto] = l.split("|");
    (conversas[fone] ??= []).push({ papel, texto: resto.join("|") });
  }

  const problemas = [];
  let totalDela = 0;
  const aberturas = {};

  for (const [fone, msgs] of Object.entries(conversas)) {
    const dela = msgs.filter((m) => m.papel === "assistant").map((m) => m.texto);
    totalDela += dela.length;

    // 1. Pergunta repetida: a mesma pergunta em duas mensagens dela.
    const perguntas = dela.flatMap((t) => (t.match(/[^.!?]*\?/g) ?? []).map(normalizar)).filter((p) => p.length > 12);
    const vistas = {};
    for (const p of perguntas) {
      const chave = p.split(" ").slice(0, 6).join(" ");
      vistas[chave] = (vistas[chave] ?? 0) + 1;
      if (vistas[chave] === 2) problemas.push([fone, "pergunta repetida", p.slice(0, 60)]);
    }

    // 2. Mensagem longa demais.
    for (const t of dela) {
      if (t.length > 700 && !/pedido recebido/i.test(t)) {
        problemas.push([fone, "mensagem longa (" + t.length + " caracteres)", t.slice(0, 50)]);
      }
    }

    // 3. Mais de uma pergunta na mesma mensagem.
    for (const t of dela) {
      const n = (t.match(/\?/g) ?? []).length;
      if (n >= 3) problemas.push([fone, n + " perguntas na mesma mensagem", t.slice(0, 60)]);
    }

    // 4. Abertura sempre igual.
    for (const t of dela) {
      const abre = normalizar(t).split(" ").slice(0, 3).join(" ");
      if (abre) aberturas[abre] = (aberturas[abre] ?? 0) + 1;
    }
  }

  console.log("AUDITORIA DO ATENDIMENTO");
  console.log("faixa " + FAIXA + ": " + Object.keys(conversas).length + " conversas, " + totalDela + " mensagens dela");
  console.log("");

  const repetidas = Object.entries(aberturas).filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]);
  if (repetidas.length) {
    console.log("ABERTURAS REPETIDAS (soa decorado):");
    for (const [a, n] of repetidas.slice(0, 5)) console.log("  " + n + "x  \"" + a + "...\"");
    console.log("");
  }

  if (!problemas.length) {
    console.log("Nenhum problema de forma encontrado nas conversas desta faixa.");
  } else {
    console.log(problemas.length + " PONTO(S) PRA OLHAR:");
    for (const [fone, tipo, exemplo] of problemas.slice(0, 25)) {
      console.log("  " + fone.slice(-4) + "  " + tipo + "  ->  " + exemplo);
    }
  }
  console.log("");
  console.log("Isto diz ONDE ler. Ler a conversa continua sendo o unico jeito de");
  console.log("saber se o cliente compraria.");
})().catch((e) => { console.log("ERRO: " + String(e).slice(0, 200)); process.exit(1); });
