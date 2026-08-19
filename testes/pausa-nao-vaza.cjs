// PAUSAR A IA NUMA CONVERSA NAO PODE CALAR AS OUTRAS.
//
// Quando a equipe assume um cliente, a Dora para de responder AQUELE cliente.
// Se isso vazasse pros outros, a padaria ficaria muda no meio do movimento e
// ninguem perceberia: nao da erro, nao aparece no painel, o cliente so nao
// recebe resposta e vai embora.
//
// O risco nao e teorico neste projeto. Ja aconteceu de o pedido de um cliente
// sair com o item de outro, por causa de um objeto compartilhado entre eles.
// Ler o codigo e ver "where id = $2" nao prova nada: prova e mandar mensagem de
// verdade com um cliente pausado e os outros nao.
//
// O teste tambem cobra o contrario, que e o que faz a pausa valer: o cliente
// pausado NAO pode receber resposta da Dora.
//
// Roda com: node testes/pausa-nao-vaza.cjs
const { execFile } = require("child_process");

const VPS = "root@179.198.126.197";
const CHAVE = require("os").homedir() + "/.ssh/id_ed25519_hub";

const PAUSADO = "5511955550001";
const LIVRE_A = "5511955550002";
const LIVRE_B = "5511955550003";

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

const falar = (fone, texto) =>
  ssh("/root/conversa.sh " + fone + " '" + texto + "' >/dev/null 2>&1").catch(() => null);

// Quantas respostas da Dora existem pra este telefone.
async function respostasDela(fone) {
  const r = await psql(
    "select count(*) from docepao.mensagens m join docepao.clientes c on c.id=m.cliente_id " +
      "where c.telefone='" + fone + "' and m.papel='assistant'",
  );
  return Number(String(r).trim()) || 0;
}

async function main() {
  console.log("limpando o banco de teste...");
  await psql(
    "delete from docepao.pedido_itens; delete from docepao.pedidos; " +
      "delete from docepao.pedido_montagem; delete from docepao.mensagens; delete from docepao.clientes;",
  );

  // Os tres precisam existir antes de pausar um deles.
  console.log("criando os tres clientes...");
  await Promise.all([
    falar(PAUSADO, "bom dia, quanto custa o cento de salgado"),
    falar(LIVRE_A, "bom dia, quanto custa o cento de salgado"),
    falar(LIVRE_B, "bom dia, quanto custa o cento de salgado"),
  ]);

  const antes = {
    pausado: await respostasDela(PAUSADO),
    a: await respostasDela(LIVRE_A),
    b: await respostasDela(LIVRE_B),
  };
  console.log("respostas antes de pausar: " + JSON.stringify(antes));

  let erros = 0;
  const conferir = (ok, oque, detalhe) => {
    console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
    if (!ok) erros++;
  };

  if (!antes.pausado || !antes.a || !antes.b) {
    console.log("");
    console.log("ERRO  os tres precisavam ter sido atendidos antes do teste comecar");
    console.log("      (sem isso o teste nao prova nada)");
    process.exit(1);
  }

  console.log("");
  console.log("pausando SO o " + PAUSADO + "...");
  await psql(
    "update docepao.clientes set ia_pausada = true where telefone = '" + PAUSADO + "'",
  );
  const quantosPausados = Number(
    String(await psql("select count(*) from docepao.clientes where coalesce(ia_pausada,false)")).trim(),
  );
  conferir(quantosPausados === 1, "so UM cliente ficou pausado no banco", quantosPausados + " ficaram pausados");

  console.log("");
  console.log("os tres falam de novo, ao mesmo tempo...");
  await Promise.all([
    falar(PAUSADO, "e o docinho, quanto fica"),
    falar(LIVRE_A, "e o docinho, quanto fica"),
    falar(LIVRE_B, "e o docinho, quanto fica"),
  ]);

  const depois = {
    pausado: await respostasDela(PAUSADO),
    a: await respostasDela(LIVRE_A),
    b: await respostasDela(LIVRE_B),
  };
  console.log("respostas depois: " + JSON.stringify(depois));
  console.log("");

  conferir(
    depois.a > antes.a,
    "o cliente LIVRE A continuou sendo atendido",
    "a padaria ficou muda pra ele por causa da pausa do vizinho",
  );
  conferir(
    depois.b > antes.b,
    "o cliente LIVRE B continuou sendo atendido",
    "a padaria ficou muda pra ele por causa da pausa do vizinho",
  );
  conferir(
    depois.pausado === antes.pausado,
    "o cliente PAUSADO nao recebeu resposta da Dora",
    "a pausa nao segurou: ela respondeu por cima da equipe",
  );

  console.log("");
  console.log(erros === 0 ? "A PAUSA FICA NA CONVERSA DELA" : "RESULTADO: " + erros + " falha(s)");
  process.exit(erros === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("erro no teste:", e.message);
  process.exit(1);
});
