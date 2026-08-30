// O MESMO CLIENTE MANDANDO DUAS MENSAGENS AO MESMO TEMPO.
//
// O qa-concorrencia.cjs cobre clientes DIFERENTES em paralelo, que e o defeito
// da copia rasa ja consertado. Ninguem nunca mediu o mesmo cliente falando duas
// vezes na mesma respiracao, e no WhatsApp isso e comum: a pessoa manda "quero
// 200 coxinhas" e emenda "e 3 kg de cuca" um segundo depois.
//
// A suspeita vem da leitura do codigo, nao de defeito visto: `anotarItem` faz
// lerMontagem -> muda -> gravar, e o gravar reescreve a linha inteira com
// `on conflict do update set itens = excluded.itens`. Duas chamadas ao mesmo
// tempo leem o mesmo estado e a segunda escreve por cima da primeira. Se for
// isso, um dos itens some, e some em silencio.
//
// MEDIDO EM 30/08/2026, container `e914492`, TRES rodadas: os dois itens
// sobreviveram nas tres. `["coxinha|200","cuca|3"]` toda vez.
//
// Ou seja: a corrida que eu DEDUZI lendo o codigo nao se reproduz mandando as
// duas mensagens juntas pelo webhook. Nao virou trava nenhuma, e nao devia
// virar: por o pedido inteiro atras de um cadeado por causa de defeito que
// ninguem viu e trocar risco medido por risco novo.
//
// Tres rodadas verdes NAO provam ausencia, provam que nao aparece nesta
// pressao. Este arquivo fica pra quem desconfiar de novo poder olhar em vez de
// deduzir, que e a diferenca entre "eu li o codigo e acho" e "eu medi".
//
// FICA FORA DO PORTAO, junto com os outros que falam com o VPS: depende de
// rede, e portao que reprova sem defeito ensina a ignorar portao.
//
// Rodar na mao:  node testes/qa-concorrencia-mesmo-cliente.cjs
const { execFile } = require("child_process");

const VPS = "root@179.198.126.197";
const CHAVE = require("os").homedir() + "/.ssh/id_ed25519_hub";
const FONE = "5511955550005";

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

// As duas falas sao de familias diferentes de proposito: misturar seria outro
// defeito. Aqui a pergunta e so uma, os DOIS sobrevivem?
const FALAS = [
  "quero 200 coxinhas",
  "quero 3 kg de cuca de goiaba",
];

async function limpar() {
  const donde = "(select id from docepao.clientes where telefone = '" + FONE + "')";
  await psql("delete from docepao.pedido_itens where pedido_id in (select id from docepao.pedidos where cliente_id in " + donde + ");");
  await psql("delete from docepao.pedidos where cliente_id in " + donde + ";");
  await psql("delete from docepao.pedido_montagem where cliente_id in " + donde + ";");
  await psql("delete from docepao.mensagens where cliente_id in " + donde + ";");
  await psql("delete from docepao.clientes where telefone = '" + FONE + "';");
}

async function montagem() {
  const bruto = await psql(
    "select x.produto, x.qtd from docepao.pedido_montagem pm " +
      "join docepao.clientes c on c.id = pm.cliente_id, " +
      "jsonb_to_recordset(pm.itens) as x(produto text, qtd numeric) " +
      "where c.telefone = '" + FONE + "' order by 1",
  );
  return bruto.split(String.fromCharCode(10)).map((l) => l.trim()).filter(Boolean);
}

async function umaRodada(n) {
  await limpar();
  await Promise.all(
    FALAS.map((f) => ssh("/root/conversa.sh " + FONE + " '" + f + "' >/dev/null 2>&1").catch(() => null)),
  );
  // Esperar o banco faz parte: com o servidor ocupado uma das duas ainda nao
  // gravou, e isso seria falha de TEMPO num teste que mede MISTURA.
  let linhas = await montagem();
  for (let i = 0; i < 12 && linhas.length < 2; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    linhas = await montagem();
  }
  const temCoxinha = linhas.some((l) => /coxinha/i.test(l));
  const temCuca = linhas.some((l) => /cuca/i.test(l));
  console.log(
    "rodada " + n + ": " + (temCoxinha && temCuca ? "OS DOIS sobreviveram" : "PERDEU ITEM") +
    "  ->  " + JSON.stringify(linhas),
  );
  return temCoxinha && temCuca;
}

async function main() {
  // TRES RODADAS, porque corrida nao aparece toda vez. Uma rodada verde nao
  // prova ausencia; tres vermelhas provam presenca.
  let boas = 0;
  for (let n = 1; n <= 3; n++) if (await umaRodada(n)) boas++;
  console.log("");
  console.log(boas === 3 ? "OS TRES PASSARAM: nao vi item sumir" : "PERDEU ITEM EM " + (3 - boas) + " DE 3");
  await limpar();
  process.exit(boas === 3 ? 0 : 1);
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(2);
});
