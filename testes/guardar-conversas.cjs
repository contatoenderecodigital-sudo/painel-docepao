// Puxa as conversas da faixa do medidor pra um arquivo, pra ler como CLIENTE.
//
// O medidor limpa a faixa dele ANTES de comecar, entao rodar de novo apaga as
// conversas da rodada anterior. Em 20/08/2026 eu perdi as 40 conversas de uma
// medicao inteira justamente quando ia le-las. Isto aqui e o resgate manual,
// pra rodar logo depois da medicao.
//
// Roda com: node testes/guardar-conversas.cjs [arquivo]
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const CHAVE = require("node:os").homedir() + "/.ssh/id_ed25519_hub";
// NUNCA grava por cima em silencio: se o arquivo ja existe e a consulta vier
// vazia, o de antes vale mais que o de agora. Ver o FORA em todos.cjs.
const ARQUIVO = process.argv[2] || "conversas-da-medicao.txt";
const FAIXA = "55119777700%";

const sql =
  "select c.telefone || ' | ' || m.papel || ' >> ' || replace(coalesce(m.conteudo,''), chr(10), ' ') " +
  "from docepao.mensagens m join docepao.clientes c on c.id=m.cliente_id " +
  "where c.telefone like '" + FAIXA + "' order by c.telefone, m.criado_em";

execFile(
  "ssh",
  ["-i", CHAVE, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=no", "root@179.198.126.197",
   "docker exec $(docker ps --filter name=gdgroavvfkkcdxvbrzvth5xc -q|head -1) " +
   "psql -U hub -d enderecodigital_hub -A -t -c \"" + sql + "\""],
  { timeout: 180000, maxBuffer: 16 * 1024 * 1024 },
  (e, out, err) => {
    if (e) { console.log("ERRO: " + String(err || e).slice(0, 300)); process.exit(1); }
    // VAZIO NUNCA APAGA CHEIO.
    //
    // Em 21/08/2026 este arquivo rodou com a faixa do medidor ja limpa e gravou
    // ZERO BYTE por cima de 37 KB de conversa real. O arquivo e ignorado pelo
    // git, entao nao havia de onde recuperar. A mesma perda esta descrita no
    // cabecalho aqui em cima, do dia 20/08: duas vezes e padrao, nao azar.
    if (!String(out).trim()) {
      const tinha = fs.existsSync(ARQUIVO) ? fs.statSync(ARQUIVO).size : 0;
      console.log("a consulta voltou VAZIA: nao gravei nada.");
      if (tinha > 0) console.log("o " + ARQUIVO + " de antes continua intacto (" + tinha + " bytes).");
      console.log("a faixa " + FAIXA + " esta limpa no banco. Rode o medidor primeiro.");
      process.exit(0);
    }
    fs.writeFileSync(ARQUIVO, String(out));
    const linhas = String(out).split("\n").filter(Boolean).length;
    const fones = new Set(String(out).split("\n").filter(Boolean).map((l) => l.split(" | ")[0]));
    console.log("guardei " + linhas + " mensagens de " + fones.size + " conversas em " + ARQUIVO);
    console.log("leia como CLIENTE: pedido certo no banco nao prova que alguem compraria.");
  },
);
