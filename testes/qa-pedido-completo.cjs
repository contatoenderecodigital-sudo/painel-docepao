// ============================================================================
//  QA DO PEDIDO COMPLETO — a conversa vai até o fim e o pedido é conferido
//  campo por campo.
//
//  O alvo é claro: a dona só informa o valor do topo e aprova. Se o pedido
//  precisar de correção dela, a IA falhou. Este teste mede exatamente isso.
//
//  Cria pedido de verdade: limpe o banco antes e depois.
// ============================================================================
const pw = require("playwright-core");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE = "https://docepao.enderecodigital.tech";
const LOGIN = { email: "admin@docepao.com", senha: "Docepao2026#" };

function chrome() {
  const b = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  for (const x of fs.readdirSync(b).filter((d) => d.startsWith("chromium-") && !d.includes("headless")).sort().reverse()) {
    const e = path.join(b, x, "chrome-win64", "chrome.exe");
    if (fs.existsSync(e)) return e;
  }
  throw new Error("chromium não encontrado");
}

// Conversa de festa completa, como o dono faz: muda de ideia, responde curto,
// dá o nome do aniversariante quando pedem o nome do pedido.
const ROTEIRO = [
  "Bom dia",
  "quero fazer uma festa pro meu filho",
  "20 pessoas",
  // A HORA FALTAVA NESTE ROTEIRO, E O PEDIDO NUNCA FECHAVA.
  //
  // O codigo se recusa a fechar pedido sem hora de retirada, de proposito: a
  // cozinha produz pela data E pela hora que estao na comanda. O roteiro ia ate
  // o fim sem falar em horario, entao a recusa estava certa e o teste e que
  // cobrava a coisa errada. Cliente de verdade responde isso quando ela
  // pergunta, e agora ela pergunta (o retorno de anotar_dados diz o que falta).
  "dia 30/08, as 15h",
  "quero sim",
  "me manda o cardapio de salgados",
  "quero 50 coxinha, 50 bolinha de queijo, 50 esfirra e 50 pastel assado",
  // Pede um recheio que NAO existe pro item de proposito: ela tem que avisar
  // em vez de trocar em silencio, e o cliente entao escolhe um valido.
  "esfirra de carne e pastel assado de palmito",
  "entao pastel assado de calabresa",
  "e os docinhos?",
  "50 brigadeiro e 50 beijinho",
  "forminha vermelha",
  "agora o bolo",
  "quero bolo de 4 leites",
  "2 kg",
  "pao de lo de chocolate",
  "quero topo de bolo e papel de arroz",
  "tema Capitao America",
  "Davi, 10 anos",
  "no prato aberto",
  "Sandro Teste",
  "vou pagar no cartao",
];

const checks = [];
function checa(id, ok, detalhe) {
  checks.push({ id, ok: !!ok, detalhe: detalhe || "" });
  console.log((ok ? "  ok    " : "  FALHA ") + id + (detalhe ? "  (" + detalhe + ")" : ""));
}


// O CORTE POR HORA, QUE JA EXISTIA E NAO ESTAVA SENDO USADO.
//
// /api/qa/ultimo-pedido devolve o ULTIMO pedido do negocio. Sem o corte, o
// teste conferia o pedido de OUTRA pessoa: em 20/08/2026 ele leu o pedido de
// demonstracao do dono e reprovou tudo, alem de ter mexido nele na tela.
// O parametro "desde" foi criado exatamente pra isso.
const DESDE = encodeURIComponent(new Date().toISOString());
// O telefone do cliente que a rota /api/testar-ia usa: e o pedido DESTE teste,
// tenha ele sido criado agora ou atualizado por cima do da rodada anterior.
const URL_PEDIDO = "/api/qa/ultimo-pedido?telefone=5500000000000&desde=" + DESDE;

(async () => {
  const br = await pw.chromium.launch({ executablePath: chrome() });
  const p = await (await br.newContext()).newPage();
  await p.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.fill('input[type="email"], input[name="email"]', LOGIN.email);
  await p.fill('input[type="password"], input[name="senha"]', LOGIN.senha);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(6000);
  if (p.url().includes("/login")) { console.log("LOGIN FALHOU"); await br.close(); process.exit(1); }

  const msgs = [];
  let resumos = 0;
  console.log("=== CONVERSA ===");
  for (const texto of ROTEIRO) {
    msgs.push({ de: "cliente", texto });
    const r = await p.request.post(BASE + "/api/testar-ia", { data: { mensagens: msgs }, timeout: 120000 });
    const j = await r.json().catch(() => ({}));
    const resp = String(j.resposta || j.erro || "");
    msgs.push({ de: "ia", texto: resp });
    if (/\*Pedido recebido\*/.test(resp)) resumos++;
    console.log("\n> " + texto);
    console.log("  " + resp.replace(/\n/g, "\n  ").slice(0, 260));
  }

  console.log("\n=== CONFERINDO O PEDIDO ===");
  const ped = await (await p.request.get(BASE + URL_PEDIDO)).json().catch(() => null);
  const cont = await (await p.request.get(BASE + "/api/fila/contagem")).json().catch(() => ({}));

  checa("PEDIDO-FOI-CRIADO", !!ped, ped ? "R$ " + (ped.total_centavos / 100).toFixed(2) : "nenhum");
  if (ped) {
    const itens = ped.itens || [];
    const acha = (re) => itens.find((i) => re.test(i.produto));
    const obsDe = (re) => String(acha(re)?.obs ?? "");

    checa("UM-PEDIDO-SO", (cont.fila || 0) + (cont.aguardando || 0) === 1, "fila=" + cont.fila + " aguardando=" + cont.aguardando);
    checa("UM-RESUMO-SO", resumos <= 1, resumos + " resumo(s) enviados");
    checa("DATA-CERTA", /-08-30$/.test(String(ped.retirada_data || "")), String(ped.retirada_data));
    checa("NOME-DE-QUEM-PAGA", /sandro/i.test(ped.cliente_nome || ""), ped.cliente_nome || "");
    checa("PAGAMENTO-CARTAO", /cart/i.test(ped.forma_pagamento || ""), ped.forma_pagamento || "vazio");

    const bolo = acha(/^bolo/i);
    checa("BOLO-4-LEITES-EM-KG", bolo && /4 leites/i.test(bolo.produto) && bolo.unidade === "kg" && bolo.qtd == 2,
      bolo ? bolo.produto + " " + bolo.qtd + bolo.unidade : "sem bolo");
    checa("BOLO-PRECO-DE-BOLO", bolo && bolo.unit_centavos >= 4000, bolo ? bolo.unit_centavos + "c" : "-");
    checa("PAPEL-DE-ARROZ", !!acha(/papel de arroz/i));
    checa("ESFIRRA-COM-CARNE", /carne/i.test(obsDe(/esfirra/i)), obsDe(/esfirra/i) || "sem obs");
    checa("PASTEL-COM-CALABRESA", /calabresa/i.test(obsDe(/pastel/i)), obsDe(/pastel/i) || "sem obs");
    checa("FORMINHA-VERMELHA", /vermelh/i.test(obsDe(/brigadeiro/i)), obsDe(/brigadeiro/i) || "sem obs");
    checa("TOPO-COM-NOME-E-IDADE", /davi/i.test(obsDe(/^bolo/i)) && /10/.test(obsDe(/^bolo/i)), obsDe(/^bolo/i).slice(0, 60));
    checa("TOPO-NAO-VIROU-ITEM", !acha(/topo/i), acha(/topo/i)?.produto || "correto");

    // O único motivo aceitável de pendência é o valor do topo.
    const motivo = String(ped.motivo_humano || "");
    const soTopo = !ped.precisa_confirmacao || /topo/i.test(motivo);
    checa("SO-FALTA-O-TOPO", soTopo, motivo || "sem pendencia");
    checa("SEM-OUTRAS-PENDENCIAS", !/nome|data|pagamento|recheio/i.test(motivo), motivo || "-");
  }

  const falhas = checks.filter((c) => !c.ok);
  console.log("\n" + "#".repeat(70));
  console.log("PEDIDO COMPLETO: " + (checks.length - falhas.length) + " ok, " + falhas.length + " falha(s)");
  console.log("#".repeat(70));
  for (const f of falhas) console.log("FALHOU " + f.id + "  " + f.detalhe);
  await br.close();
})();
