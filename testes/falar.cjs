// ============================================================================
//  FALAR UMA MENSAGEM COM A PADARIA E LER A RESPOSTA. UMA POR VEZ.
//
//  Pedido do dono em 30/08/2026, depois de ver que os medidores disparavam o
//  roteiro inteiro sem esperar resposta:
//
//      "EU QUERO QUE VOCE FACA MANUAL, LEIA OQ A I.A MANDOU E RESPONDA ELA
//       COMO SE FOSSE UM CLIENTE, NAO QUERO VC AUTOMATIZANDO TESTES"
//
//  Ele esta certo. Roteiro escrito antes nao e conversa: quem escreve as seis
//  falas de uma vez ja decidiu o que a padaria ia perguntar, e ai o teste passa
//  por cima do erro em vez de encontrar ele. Aqui a proxima fala e escolhida
//  DEPOIS de ler a resposta, que e como cliente faz.
//
//  Uso:
//    node testes/falar.cjs "oi, queria fazer um orcamento de festa"
//    node testes/falar.cjs --limpar          (comeca uma conversa do zero)
//    node testes/falar.cjs --ver             (so mostra a conversa ate agora)
//    node testes/falar.cjs --pedido          (mostra o pedido no banco)
//
//  O telefone sai de FONE, e o padrao e um numero da faixa de instrumento.
//  FICA FORA DO PORTAO: fala com o VPS.
// ============================================================================

const { execFile } = require("node:child_process");
const { conversaCom } = require("./_conversar.cjs");

const VPS = "root@179.198.126.197";
const CHAVE = require("node:os").homedir() + "/.ssh/id_ed25519_hub";
const FONE = process.env.FONE || "5511977770099";

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

// `--limpar` sozinho zera a conversa de teste; com um telefone, zera aquela.
// Serve pra deixar o painel limpo antes de uma medicao de verdade, e por isso
// vive AQUI e nao num comando solto: quem apaga conversa e uma ferramenta com
// nome, que passa pelo mesmo caminho todas as vezes.
async function limpar(fone = FONE) {
  const de = "(select id from docepao.clientes where telefone='" + fone + "')";
  await psql("delete from docepao.pedido_fotos where cliente_id in " + de).catch(() => {});
  await psql("delete from docepao.fila_impressao where pedido_id in (select id from docepao.pedidos where cliente_id in " + de + ")").catch(() => {});
  await psql("delete from docepao.pedido_itens where pedido_id in (select id from docepao.pedidos where cliente_id in " + de + ")").catch(() => {});
  await psql("delete from docepao.pedidos where cliente_id in " + de).catch(() => {});
  await psql("delete from docepao.pedido_montagem where cliente_id in " + de).catch(() => {});
  await psql("delete from docepao.mensagens where cliente_id in " + de).catch(() => {});
  await psql("delete from docepao.clientes where telefone='" + fone + "'").catch(() => {});
  console.log("conversa do " + fone + " zerada.");
}

async function ver() {
  const t = await psql(
    "select m.papel || ' >> ' || replace(coalesce(m.conteudo,''), chr(10), ' ') from docepao.mensagens m " +
      "join docepao.clientes c on c.id=m.cliente_id where c.telefone='" + FONE + "' order by m.criado_em",
  );
  console.log(String(t).trim() || "(nada ainda)");
}

async function pedido() {
  console.log("=== RASCUNHO (o que esta em aberto) ===");
  console.log(
    String(
      await psql(
        "select x.qtd || ' ~ ' || x.produto || ' ~ ' || coalesce(x.obs,'SEM OBS') from docepao.pedido_montagem pm " +
          "join docepao.clientes c on c.id=pm.cliente_id, jsonb_to_recordset(pm.itens) as x(produto text, qtd numeric, obs text) " +
          "where c.telefone='" + FONE + "'",
      ),
    ).trim() || "(vazio)",
  );
  console.log("=== DADOS DO RASCUNHO ===");
  console.log(
    String(
      await psql(
        "select pm.dados::text from docepao.pedido_montagem pm join docepao.clientes c on c.id=pm.cliente_id " +
          "where c.telefone='" + FONE + "'",
      ),
    ).trim() || "(vazio)",
  );
  console.log("=== PEDIDO REGISTRADO ===");
  console.log(
    String(
      await psql(
        "select 'status=' || p.status || ' data=' || coalesce(to_char(p.retirada_data,'DD/MM/YYYY'),'SEM') " +
          "|| ' hora=' || coalesce(p.retirada_hora::text,'SEM') " +
          // total_centavos, e nao `total`: a coluna guarda centavo, e foi ela
          // que fez esta consulta explodir na primeira conversa manual.
          "|| ' total=R$ ' || to_char(coalesce(p.total_centavos,0)/100.0,'FM999G990D00') " +
          "|| ' aguardando_cliente=' || case when coalesce(p.aguardando_cliente,false) then 'SIM' else 'nao' end " +
          "from docepao.pedidos p join docepao.clientes c on c.id=p.cliente_id where c.telefone='" + FONE + "'",
      ),
    ).trim() || "(nao registrado)",
  );
}

(async () => {
  const arg = process.argv[2];
  if (!arg) return console.error('uso: node testes/falar.cjs "sua mensagem"  |  --limpar  |  --ver  |  --pedido');
  if (arg === "--limpar") return limpar(process.argv[3] || FONE);
  if (arg === "--ver") return ver();
  if (arg === "--pedido") return pedido();

  const mandar = conversaCom({ ssh, psql, fone: FONE });
  console.log("cliente >> " + arg);
  const r = await mandar(arg);
  console.log("padaria >> " + r);
})().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
