// ============================================================================
//  QA DE CONCORRENCIA — VARIOS CLIENTES FALANDO AO MESMO TEMPO
//
//  Nasceu de um defeito real: com tres clientes conversando juntos, o pedido de
//  um saiu com o item do outro. Quem pediu 3 cucas ficou com coxinha, quem pediu
//  200 coxinhas ficou com as cucas, e um pedido fechou assim e foi pra cozinha.
//
//  A causa era uma copia rasa de um objeto compartilhado ({ ...VAZIA }): o
//  mesmo array de itens servia todos os clientes sem pedido. Com UM cliente por
//  vez, que era como todo teste rodava, isso nunca aparece.
//
//  Este teste manda as mensagens de verdade pelo webhook, em paralelo, e cobra o
//  obvio: cada cliente termina com o que ELE pediu, e nada do vizinho.
//
//  Rodar:  node testes/qa-concorrencia.cjs
// ============================================================================

const { execFile } = require("child_process");

const VPS = "root@179.198.126.197";
const CHAVE = require("os").homedir() + "/.ssh/id_ed25519_hub";

// Cada cliente com um produto que ninguem mais pede, pra mistura ficar obvia.
//
// O sabor de cuca aqui era BANANA, e o teste quebrou em 19/08/2026 acusando que
// nada foi anotado. Nao era bug: a padaria NAO faz cuca de banana. Os sabores
// sao chocolate, doce de leite, abacaxi, vinho, goiaba, frutas vermelhas e
// limao. A guarda de sabor nasceu depois deste teste e estava certa em recusar.
// Trocado por goiaba, que existe, senao o teste cobraria uma venda que a
// padaria nao pode fazer.
const CLIENTES = [
  { fone: "5511911110001", diz: "quero 3 kg de cuca de goiaba pra dia 22/08 as 10h", esperado: /cuca/i, proibido: /coxinha|bolo|brigadeiro/i },
  { fone: "5511922220002", diz: "quero 200 coxinhas pra dia 23/08 as 16h", esperado: /coxinha/i, proibido: /cuca|bolo|brigadeiro/i },
  { fone: "5511933330003", diz: "quero 2 kg de bolo de morango pra dia 24/08 as 18h", esperado: /bolo/i, proibido: /cuca|coxinha/i },
];

function ssh(comando) {
  return new Promise((resolve, reject) => {
    execFile(
      "ssh",
      ["-i", CHAVE, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=no", VPS, comando],
      { timeout: 240000, maxBuffer: 10 * 1024 * 1024 },
      (err, saida) => (err ? reject(err) : resolve(String(saida))),
    );
  });
}

const psql = (sql) =>
  ssh(
    "docker exec $(docker ps --filter name=gdgroavvfkkcdxvbrzvth5xc -q|head -1) " +
      "psql -U hub -d enderecodigital_hub -A -F'|' -t -c \"" + sql.replace(/"/g, '\\"') + "\"",
  );

async function main() {
  console.log("limpando o banco de teste...");
  await psql(
    "delete from docepao.pedido_itens; delete from docepao.pedidos; " +
      "delete from docepao.pedido_montagem; delete from docepao.mensagens; delete from docepao.clientes;",
  );

  console.log("mandando as " + CLIENTES.length + " mensagens ao mesmo tempo...");
  await Promise.all(
    CLIENTES.map((c) => ssh("/root/conversa.sh " + c.fone + " '" + c.diz + "' >/dev/null 2>&1").catch(() => null)),
  );

  const linhas = (
    await psql(
      "select c.telefone, x.produto from docepao.pedido_montagem pm " +
        "join docepao.clientes c on c.id=pm.cliente_id, " +
        "jsonb_to_recordset(pm.itens) as x(produto text) order by 1",
    )
  )
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split("|"));

  let falhas = 0;
  for (const c of CLIENTES) {
    const meus = linhas.filter(([fone]) => fone === c.fone).map(([, produto]) => produto);
    const temOSeu = meus.some((p) => c.esperado.test(p));
    const temDoOutro = meus.filter((p) => c.proibido.test(p));
    console.log("\n" + c.fone + ": " + (meus.join(", ") || "(nada anotado)"));
    if (!temOSeu) {
      console.log("  FALHOU: nao anotou o que ele pediu");
      falhas++;
    }
    if (temDoOutro.length) {
      console.log("  FALHOU: pegou item de outro cliente -> " + temDoOutro.join(", "));
      falhas++;
    }
    if (temOSeu && !temDoOutro.length) console.log("  ok");
  }

  console.log("\n" + (falhas === 0 ? "RESULTADO: nenhum cliente se misturou" : "RESULTADO: " + falhas + " falha(s)"));
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("erro no teste:", e.message);
  process.exit(1);
});
