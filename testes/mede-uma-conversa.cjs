// MEDE UMA CONVERSA QUALQUER, LIDA NO BANCO.
//
// O `uma-conversa-contra-o-banco.cjs` tem as falas chumbadas dentro dele. Toda
// vez que eu queria medir OUTRA conversa, eu duplicava o arquivo. Este aqui
// recebe as falas de fora, entao medir um caminho novo custa um .json de tres
// linhas em vez de um arquivo de codigo.
//
// Roda com:
//   node testes/mede-uma-conversa.cjs caminho/das/falas.json
//
// O .json e uma lista de strings, na ordem em que o cliente fala:
//   ["quero 100 coxinhas", "dia 05/09 as 15h, nome Ana, pix", "pode confirmar"]
//
// NAO E PORTAO: fala com producao e cria pedido de verdade.
//
// O NUMERO E DA FAIXA DE TESTE, E AGORA O PAINEL SABE DISSO.
//
// A faixa 55119777700... ja era a declarada nos outros medidores, mas quem
// escondia cliente de teste era so o CRM, e so conhecia o 55000000 da tela
// "Testar IA". Resultado: cada medicao deixava na ficha da dona um cliente com
// o nome que a conversa deu ('Marcos Alves', 'Ana'), e o pedido dela entrava no
// faturamento da tela de Resultados, que nao filtrava nada.
//
// Agora a resposta mora num lugar so (`lib/banco/so-cliente-de-verdade.ts`), e
// as duas faixas estao la. A limpeza daqui tambem passou a apagar a linha de
// `clientes`, que ficava pra tras.
//
// Achado em 28/08/2026, lendo o `clientes.ts`.
const fs = require("node:fs");
const { execFile } = require("node:child_process");
const CHAVE = require("node:os").homedir() + "/.ssh/id_ed25519_hub";

const ssh = (c) =>
  new Promise((res, rej) =>
    execFile(
      "ssh",
      ["-i", CHAVE, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=no", "root@179.198.126.197", c],
      { timeout: 300000, maxBuffer: 10485760 },
      (e, s) => (e ? rej(e) : res(String(s))),
    ),
  );
const psql = (sql) =>
  ssh(
    "docker exec $(docker ps --filter name=gdgroavvfkkcdxvbrzvth5xc -q|head -1) " +
      "psql -U hub -d enderecodigital_hub -A -F'|' -t -c \"" + sql.replace(/"/g, '\\"') + "\"",
  );

const arq = process.argv[2];
if (!arq) {
  console.error("falta o arquivo de falas: node testes/mede-uma-conversa.cjs falas.json");
  process.exit(2);
}
const FALAS = JSON.parse(fs.readFileSync(arq, "utf8"));

// LEITURA QUE FALHA NAO PODE MATAR A MEDICAO.
//
// A conversa leva minutos e ja aconteceu: o nome de uma coluna estava errado, a
// consulta explodiu DEPOIS das sete falas, e a medicao inteira se perdeu por um
// erro de digitacao na parte mais barata do trabalho.
const olhar = (sql) => psql(sql).catch((e) => "(a consulta falhou: " + String(e).split("\n")[0].slice(0, 120) + ")");
// Faixa de teste propria, pra nao brigar com a conversa do outro script nem com
// a bateria, que usam telefones vizinhos.
const FONE = process.env.FONE || "5511977770077";

(async () => {
  console.log("limpando o " + FONE + "...");
  await psql(
    "delete from docepao.pedido_itens i using docepao.pedidos p, docepao.clientes c " +
      "where i.pedido_id=p.id and p.cliente_id=c.id and c.telefone='" + FONE + "'",
  ).catch(() => {});
  for (const t of ["pedidos p", "pedido_montagem pm", "mensagens m"]) {
    const a = t.split(" ")[1];
    await psql(
      "delete from docepao." + t + " using docepao.clientes c where " + a + ".cliente_id=c.id and c.telefone='" + FONE + "'",
    ).catch(() => {});
  }
  // E a propria linha de `clientes`, que ficava pra tras e aparecia no CRM da
  // dona com o nome que a conversa deu.
  await psql("delete from docepao.clientes where telefone='" + FONE + "'").catch(() => {});

  for (const f of FALAS) {
    console.log("  >> " + f.slice(0, 80));
    await ssh("/root/conversa.sh " + FONE + " '" + String(f).replace(/'/g, "") + "' >/dev/null 2>&1").catch(() => null);
  }

  console.log("");
  console.log("=== O QUE A PADARIA RESPONDEU ===");
  console.log(
    await olhar(
      "select m.papel || ' >> ' || replace(coalesce(m.conteudo,''), chr(10), ' ') from docepao.mensagens m " +
        "join docepao.clientes c on c.id=m.cliente_id where c.telefone='" + FONE + "' order by m.criado_em",
    ),
  );

  console.log("=== O PEDIDO NO BANCO (pedido_itens) ===");
  // A coluna do preco e `subtotal_centavos`, e nao `preco`: escrever o nome
  // errado aqui derrubou a medicao DEPOIS da conversa inteira ter rodado, o que
  // custa os minutos todos e nao devolve resposta nenhuma.
  const itens = await olhar(
    "select coalesce(i.qtd,0) || ' ~ ' || coalesce(i.produto,'') || ' ~ ' || coalesce(i.categoria,'?') " +
      "|| ' ~ ' || coalesce(i.obs,'') || ' ~ R$ ' || round(coalesce(i.subtotal_centavos,0)/100.0, 2) " +
      "from docepao.pedido_itens i join docepao.pedidos p on p.id=i.pedido_id " +
      "join docepao.clientes c on c.id=p.cliente_id where c.telefone='" + FONE + "' order by i.id",
  );
  console.log(itens.trim() || "(NADA, o pedido nao foi registrado)");

  console.log("=== A MONTAGEM (o que ficou em aberto) ===");
  const mont = await olhar(
    "select coalesce(x.qtd,0) || ' ~ ' || coalesce(x.produto,'') || ' ~ ' || coalesce(x.obs,'') " +
      "from docepao.pedido_montagem pm join docepao.clientes c on c.id=pm.cliente_id, " +
      "jsonb_to_recordset(pm.itens) as x(produto text, qtd numeric, obs text) " +
      "where c.telefone='" + FONE + "'",
  );
  console.log(mont.trim() || "(vazia)");
})();
