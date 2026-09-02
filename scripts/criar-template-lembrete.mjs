// ============================================================================
//  CADASTRA O TEMPLATE DO LEMBRETE NA META, sem passar pela tela.
//
//  Existe por um motivo bem concreto: o corpo do template precisa ser IGUAL,
//  palavra por palavra, ao texto que `lib/ia/lembrete.ts` monta. Digitado na
//  mao no Gerenciador, uma virgula a mais passa despercebida e o cliente
//  recebe uma frase diferente da que o sistema acha que mandou.
//
//  Aqui o corpo sai do MESMO lugar que a frase de verdade, entao os dois nao
//  tem como divergir.
//
//  Roda com:
//
//      node scripts/criar-template-lembrete.mjs           (so mostra o que vai fazer)
//      node scripts/criar-template-lembrete.mjs --criar   (cria de verdade)
//
//  AS CREDENCIAIS ELE BUSCA SOZINHO, no banco de producao, pela mesma chave
//  ssh que os testes do servidor ja usam. Elas nao aparecem em tela nenhuma do
//  painel (e nao devem mesmo aparecer), entao pedir pra alguem "copiar do
//  painel" era mandar cacar o que nao esta la.
//
//  Se preferir passar na mao, as duas variaveis continuam valendo:
//
//      WHATSAPP_WABA_ID=...  WHATSAPP_TOKEN=...  node scripts/...
// ============================================================================

import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

const NOME = "lembrete_retirada";
const IDIOMA = "pt_BR";
const CATEGORIA = "UTILITY";

// O CORPO, com as duas variaveis. Tem que casar com `textoDoLembrete`.
const CORPO =
  "Oi, {{1}}! Passando pra lembrar do seu pedido na Doce Pão que fica pronto " +
  "{{2}}. Qualquer coisa é só me chamar por aqui.";

// Os exemplos que a Meta pede pra revisar. Sem eles ela reprova e nao diz bem
// por que.
const EXEMPLOS = ["Renata", "amanhã, às 18:30"];

async function main() {
  const criar = process.argv.includes("--criar");

  /** As credenciais deste negocio, lidas do banco de producao. */
  async function doBanco() {
    const chave = homedir() + "/.ssh/id_ed25519_hub";
    if (!existsSync(chave)) return null;
    const sql =
      "select concat((config::jsonb)->>'whatsapp_waba_id', '~', (config::jsonb)->>'whatsapp_token') " +
      "from docepao.negocios where slug='docepao'";
    const comando =
      "docker exec $(docker ps --filter name=gdgroavvfkkcdxvbrzvth5xc -q|head -1) " +
      'psql -U hub -d enderecodigital_hub -A -t -c "' + sql + '"';
    const saida = await new Promise((ok) =>
      execFile(
        "ssh",
        ["-i", chave, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=no",
         "root@179.198.126.197", comando],
        { timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
        (erro, texto) => ok(erro ? "" : String(texto)),
      ),
    );
    const [id, tok] = saida.trim().split("~");
    return id && tok ? { waba: id, token: tok } : null;
  }

  let waba = process.env.WHATSAPP_WABA_ID || "";
  let token = process.env.WHATSAPP_TOKEN || "";
  if (!waba || !token) {
    const d = await doBanco();
    if (d) {
      waba = d.waba;
      token = d.token;
      console.log("Credenciais lidas do banco de producao (negocio docepao).\n");
    }
  }

  console.log("Template que vai ser cadastrado:\n");
  console.log("  nome       " + NOME);
  console.log("  categoria  " + CATEGORIA);
  console.log("  idioma     " + IDIOMA);
  console.log("  corpo      " + CORPO);
  console.log("  exemplos   " + EXEMPLOS.join("  |  "));
  console.log("");

  if (!waba || !token) {
    console.log("Nao consegui as credenciais.\n");
    console.log("Elas vem do banco de producao pela chave ~/.ssh/id_ed25519_hub.");
    console.log("Se a chave nao estiver ai, ou o negocio nao estiver conectado na");
    console.log("Meta, da pra passar na mao:\n");
    console.log("  WHATSAPP_WABA_ID=<id da waba> WHATSAPP_TOKEN=<token> \\");
    console.log("    node scripts/criar-template-lembrete.mjs --criar");
    return 1;
  }

  const BASE = "https://graph.facebook.com/v21.0";

  // PRIMEIRO OLHA SE JA EXISTE. Cadastrar duas vezes o mesmo nome da erro, e o
  // erro da Meta nesse caso nao diz que o motivo e esse.
  const lista = await fetch(
    BASE + "/" + waba + "/message_templates?fields=name,status,language,components&limit=200",
    { headers: { Authorization: "Bearer " + token } },
  );
  const jaTem = await lista.json();
  if (!lista.ok) {
    console.error("Nao consegui listar os templates:", JSON.stringify(jaTem).slice(0, 500));
    return 1;
  }
  const igual = (jaTem.data ?? []).find((t) => t.name === NOME && t.language === IDIOMA);
  if (igual) {
    const corpoLa = (igual.components ?? []).find((c) => c.type === "BODY")?.text ?? "";
    console.log("Este template JA EXISTE nesta conta, com status " + igual.status + ".");
    if (corpoLa.trim() !== CORPO.trim()) {
      console.log("\nATENCAO: o corpo cadastrado esta DIFERENTE do que o codigo manda.");
      console.log("  la:    " + corpoLa);
      console.log("  aqui:  " + CORPO);
      console.log("\nApague o de la pelo Gerenciador e rode este script de novo.");
    } else {
      console.log("O corpo bate com o do codigo. Nao ha nada a fazer.");
    }
    return 0;
  }

  if (!criar) {
    console.log("Nada foi criado. Rode de novo com --criar pra cadastrar de verdade.");
    return 0;
  }

  const r = await fetch(BASE + "/" + waba + "/message_templates", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: NOME,
      language: IDIOMA,
      category: CATEGORIA,
      components: [{ type: "BODY", text: CORPO, example: { body_text: [EXEMPLOS] } }],
    }),
  });
  const saiu = await r.json();
  if (!r.ok) {
    console.error("A Meta recusou:", JSON.stringify(saiu).slice(0, 800));
    return 1;
  }
  console.log("Criado. Status: " + (saiu.status ?? "?") + "  (id " + (saiu.id ?? "?") + ")");
  console.log("");
  console.log("APPROVED  ja esta valendo, nao precisa fazer mais nada aqui.");
  console.log("PENDING   a Meta esta revisando, costuma sair em minutos.");
  console.log("REJECTED  veja o motivo no Gerenciador, em Modelos de mensagem.");
  return 0;
}

process.exitCode = await main();
