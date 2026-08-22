// VER OS BOTOES NO CELULAR
//
// Manda os tres tipos de botao direto pela API do WhatsApp, sem passar pela
// IA: nao gasta um centavo de OpenAI, e o dono ve na tela do celular dele
// exatamente como o cliente vai ver.
//
// COMO USAR
//
//   1. Mande um "oi" do seu celular pro WhatsApp da padaria. Isso abre a
//      janela de 24 horas da Meta: sem ela, mensagem livre nao sai.
//   2. Rode:  node testes/ver-os-botoes-no-celular.cjs
//
// Ele acha sozinho o ultimo numero que falou com a padaria, PAUSA a IA pra
// esse contato (senao ela responde e gasta credito por nada), manda os tres
// exemplos, e no fim religa a IA.
//
// Se voce tocar em algum botao, a resposta chega no sistema como um ID
// ("base_sim"), nao como frase. E disso que vem a diferenca: nao ha o que
// interpretar, entao nao ha o que interpretar errado.
const { execFile } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");

const CHAVE = path.join(os.homedir(), ".ssh", "id_ed25519_hub");
const HOST = "root@179.198.126.197";
const APP = "uyyqf7kzymaxlyq9kl";

const ssh = (cmd) =>
  new Promise((ok, no) =>
    execFile(
      "ssh",
      ["-i", CHAVE, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=15", HOST, cmd],
      { timeout: 120000, maxBuffer: 8 * 1024 * 1024 },
      (e, out, err) => (e ? no(new Error(String(err || e).slice(0, 400))) : ok(String(out))),
    ),
  );

const psql = (sql) =>
  ssh(
    "docker exec $(docker ps --filter name=gdgroavvfkkcdxvbrzvth5xc -q|head -1) " +
      'psql -U hub -d enderecodigital_hub -A -t -c "' + sql.replace(/"/g, '\\"') + '"',
  );

// Sobrou de quando eu procurava credencial no env do container. Fica porque e
// util pra espiar outra variavel qualquer, mas o WhatsApp vem do banco.
const envDoApp = async (nome) =>
  (await ssh(
    "docker inspect $(docker ps --filter name=" + APP + " -q|head -1) " +
      "--format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^" + nome + "=' | head -1",
  ))
    .trim()
    .replace(new RegExp("^" + nome + "="), "");

// O envio roda DENTRO do servidor: o token nao passa por aqui e a chamada sai
// do mesmo IP de sempre.
async function mandarBotoes(telefone, texto, botoes, token, phoneId) {
  const corpo = JSON.stringify({
    messaging_product: "whatsapp",
    to: telefone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: texto },
      action: {
        buttons: botoes.map((b) => ({ type: "reply", reply: { id: b.id, title: b.titulo.slice(0, 20) } })),
      },
    },
  });
  const cmd =
    "curl -s -X POST 'https://graph.facebook.com/v21.0/" + phoneId + "/messages' " +
    "-H 'Authorization: Bearer " + token + "' -H 'Content-Type: application/json' " +
    "-d " + JSON.stringify(corpo).replace(/'/g, "'\\''");
  const r = await ssh(cmd);
  return r.trim();
}

(async () => {
  console.log("procurando o ultimo numero que falou com a padaria...");
  const linha = (
    await psql(
      "select c.telefone || '|' || coalesce(c.nome,'?') from docepao.clientes c " +
        "join docepao.mensagens m on m.cliente_id = c.id " +
        "group by c.id, c.telefone, c.nome order by max(m.criado_em) desc limit 1",
    )
  ).trim();

  if (!linha) {
    console.log("");
    console.log("Ninguem falou com a padaria ainda.");
    console.log("Manda um 'oi' do seu celular pro WhatsApp da padaria e roda de novo.");
    process.exit(1);
  }

  const [telefone, nome] = linha.split("|");
  console.log("achei: " + telefone + " (" + nome + ")");

  // PAUSA A IA: senao ela responde cada botao e gasta credito atoa.
  await psql("update docepao.clientes set ia_pausada = true, ia_pausada_em = now() where telefone = '" + telefone + "'");
  console.log("IA pausada pra esse contato (religo no fim)");

  // AS CREDENCIAIS MORAM NO BANCO, POR NEGOCIO.
  //
  // O sistema e multi-tenant: cada padaria tem o seu token e o seu numero, e
  // eles ficam em negocios.config, nao no env do container. As variaveis
  // WHATSAPP_* do container sao a conta guarda-chuva e a Meta recusa mandar
  // por elas ("Object with ID ... does not exist, cannot be loaded due to
  // missing permissions"). Foi o que aconteceu na primeira tentativa.
  const cred = (
    await psql(
      "select (config->>'whatsapp_token') || '|' || (config->>'whatsapp_phone_id') " +
        "from docepao.negocios where config->>'whatsapp_token' is not null limit 1",
    )
  ).trim();
  const [token, phoneId] = cred.split("|");
  if (!token || !phoneId) {
    console.log("nao achei as credenciais do WhatsApp no cadastro do negocio");
    process.exit(1);
  }
  console.log("usando o numero da padaria (phone_id " + phoneId.slice(0, 6) + "...)");

  const exemplos = [
    {
      texto:
        "Pra 20 pessoas, uma base boa é 200 salgados no total, 100 docinhos e 2 kg de bolo.\n\n" +
        "Dá R$ 418,80 no total, e dá pra ajustar o que você quiser.",
      botoes: [
        { id: "base_sim", titulo: "Pode ser" },
        { id: "base_ajustar", titulo: "Quero ajustar" },
      ],
    },
    {
      texto: "O bolo vai com topo e papel de arroz?",
      botoes: [
        { id: "peca_os_dois", titulo: "Os dois" },
        { id: "peca_so_topo", titulo: "Só o topo" },
        { id: "peca_nenhum", titulo: "Nenhum" },
      ],
    },
    {
      texto: "Como você prefere pagar?",
      botoes: [
        { id: "pag_pix", titulo: "Pix" },
        { id: "pag_cartao", titulo: "Cartão" },
        { id: "pag_dinheiro", titulo: "Dinheiro" },
      ],
    },
  ];

  console.log("");
  for (const [i, ex] of exemplos.entries()) {
    const r = await mandarBotoes(telefone, ex.texto, ex.botoes, token, phoneId);
    const ok = /"messages"/.test(r);
    console.log(
      (ok ? "enviado " : "FALHOU  ") + (i + 1) + "/3  " + ex.botoes.map((b) => "[" + b.titulo + "]").join(" "),
    );
    if (!ok) console.log("         resposta da Meta: " + r.slice(0, 300));
    await new Promise((r2) => setTimeout(r2, 1500));
  }

  await psql("update docepao.clientes set ia_pausada = false, ia_pausada_em = null where telefone = '" + telefone + "'");
  console.log("");
  console.log("IA religada.");
  console.log("Olha o celular: os botoes estao na conversa da padaria.");
  console.log("Pode tocar neles pra ver como fica; a IA esta ligada de novo e vai responder.");
})().catch((e) => {
  console.log("ERRO: " + String(e.message || e).slice(0, 400));
  process.exit(1);
});
