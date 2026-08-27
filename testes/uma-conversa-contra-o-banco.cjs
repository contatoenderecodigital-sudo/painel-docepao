// UMA CONVERSA, LIDA NO BANCO. A ferramenta mais barata que existe aqui.
//
// POR QUE ISTO EXISTE
//
// Em 26/08/2026 eu rodei DUAS baterias de 25 minutos antes de mandar uma
// conversa so. As duas devolveram 0/5 em todos os cenarios e nenhuma disse
// por que. Uma conversa unica, lida no banco, deu a resposta em dois minutos:
// o item achado na frase ficava guardado e so entrava no turno seguinte, e
// nos cenarios de duas mensagens o pedido nunca chegava a ser registrado.
//
// A montagem estava CERTA nas 25 conversas. Era o `pedido_itens` que estava
// vazio, e nenhuma nota de bateria mostra essa diferenca.
//
// NAO E PORTAO: fala com producao e cria pedido de verdade na faixa de teste
// (55119777700...), que nao e telefone de pessoa nenhuma. E instrumento, e
// roda na mao antes de gastar 25 minutos numa bateria.
//
// Roda com: node testes/uma-conversa-contra-o-banco.cjs
const { execFile } = require("child_process");
const CHAVE = require("os").homedir() + "/.ssh/id_ed25519_hub";
const ssh = (c) => new Promise((res, rej) => execFile("ssh",
  ["-i", CHAVE, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=no", "root@179.198.126.197", c],
  { timeout: 300000, maxBuffer: 10485760 }, (e, s) => (e ? rej(e) : res(String(s)))));
const psql = (sql) => ssh(
  "docker exec $(docker ps --filter name=gdgroavvfkkcdxvbrzvth5xc -q|head -1) " +
  "psql -U hub -d enderecodigital_hub -A -F'|' -t -c \"" + sql.replace(/"/g, '\\"') + "\"");

const FONE = "5511977770099";
const FALAS = [
  "boa tarde, quero 100 coxinha e 100 quiche de frango, 50 brigadeiro forminha rosa e um bolo de 2 kg de 4 leites, dia 05/09 as 15h, nome Carla Menezes, pix",
  "isso mesmo, pode confirmar",
];

(async () => {
  console.log("limpando o " + FONE + "...");
  for (const t of ["docepao.pedido_itens i using docepao.pedidos p, docepao.clientes c where i.pedido_id=p.id and p.cliente_id=c.id and c.telefone='" + FONE + "'"]) {
    await psql("delete from " + t).catch(() => {});
  }
  await psql("delete from docepao.pedidos p using docepao.clientes c where p.cliente_id=c.id and c.telefone='" + FONE + "'").catch(() => {});
  await psql("delete from docepao.pedido_montagem pm using docepao.clientes c where pm.cliente_id=c.id and c.telefone='" + FONE + "'").catch(() => {});
  await psql("delete from docepao.mensagens m using docepao.clientes c where m.cliente_id=c.id and c.telefone='" + FONE + "'").catch(() => {});

  for (const f of FALAS) {
    console.log("  >> " + f.slice(0, 70));
    await ssh("/root/conversa.sh " + FONE + " '" + f.replace(/'/g, "") + "' >/dev/null 2>&1").catch(() => null);
  }

  console.log("");
  console.log("=== O QUE A PADARIA RESPONDEU ===");
  console.log(await psql(
    "select m.papel || ' >> ' || replace(coalesce(m.conteudo,''), chr(10), ' ') from docepao.mensagens m " +
    "join docepao.clientes c on c.id=m.cliente_id where c.telefone='" + FONE + "' order by m.criado_em"));

  console.log("=== O PEDIDO NO BANCO (pedido_itens) ===");
  const itens = await psql(
    "select coalesce(i.qtd,0) || ' ~ ' || coalesce(i.produto,'') || ' ~ ' || coalesce(i.obs,'') from docepao.pedido_itens i " +
    "join docepao.pedidos p on p.id=i.pedido_id join docepao.clientes c on c.id=p.cliente_id where c.telefone='" + FONE + "'");
  console.log(itens.trim() || "(NADA — o pedido nao foi registrado)");

  console.log("=== A MONTAGEM (o que ficou em aberto) ===");
  const mont = await psql(
    "select coalesce(x.qtd,0) || ' ~ ' || coalesce(x.produto,'') || ' ~ ' || coalesce(x.obs,'') from docepao.pedido_montagem pm " +
    "join docepao.clientes c on c.id=pm.cliente_id, jsonb_to_recordset(pm.itens) as x(produto text, qtd numeric, obs text) " +
    "where c.telefone='" + FONE + "'");
  console.log(mont.trim() || "(vazia)");
})();
