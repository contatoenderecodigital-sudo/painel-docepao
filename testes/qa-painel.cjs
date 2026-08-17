// ============================================================================
//  QA DO PAINEL — o caminho que a DONA percorre, não o cliente.
//
//  Cobre o que antes eu deixava pro teste manual: foto de referência chegando
//  no pedido, peça de cardápio aparecendo na conversa, o visualizador de imagem
//  cabendo na tela, e o fluxo do topo de bolo inteiro (lançar valor, avisar o
//  cliente, esperar o aceite, cair na aprovação).
//
//  Roda com o painel no ar. Cria pedido de teste: limpe o banco depois.
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

// JPEG 1x1 válido: serve de "foto de referência" sem depender de arquivo externo.
const FOTO_1PX =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
  "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

const resultados = [];
function checa(id, ok, detalhe) {
  resultados.push({ id, ok: !!ok, detalhe: detalhe || "" });
  console.log((ok ? "  ok   " : "  FALHA") + "  " + id + (detalhe ? "  (" + detalhe + ")" : ""));
}

(async () => {
  const br = await pw.chromium.launch({ executablePath: chrome() });
  const ctx = await br.newContext({ viewport: { width: 1500, height: 950 } });
  const p = await ctx.newPage();
  const errosConsole = [];
  p.on("console", (m) => { if (m.type() === "error") errosConsole.push(m.text().slice(0, 120)); });

  await p.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.fill('input[type="email"], input[name="email"]', LOGIN.email);
  await p.fill('input[type="password"], input[name="senha"]', LOGIN.senha);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(6000);
  if (p.url().includes("/login")) { console.log("LOGIN FALHOU"); await br.close(); process.exit(1); }

  // ---------------------------------------------------------------------
  console.log("\n1) Conversa com foto e topo de bolo (cria o pedido pendente)");
  // ---------------------------------------------------------------------
  const msgs = [];
  const falar = async (texto, comFoto) => {
    msgs.push({ de: "cliente", texto });
    const corpo = { mensagens: msgs };
    if (comFoto) { corpo.imagem = FOTO_1PX; corpo.imagemMime = "image/jpeg"; }
    const r = await p.request.post(BASE + "/api/testar-ia", { data: corpo, timeout: 120000 });
    const j = await r.json().catch(() => ({}));
    msgs.push({ de: "ia", texto: j.resposta || "" });
    return j;
  };

  await falar("quero um bolo de brigadeiro de 2 kg pra sexta 29/08");
  await falar("pao de lo branco");
  const comPeca = await falar("me manda o cardapio de bolos");
  checa("CARDAPIO-ENFILEIRADO", (comPeca.cardapios || []).length > 0, (comPeca.cardapios || []).join(","));

  await falar("quero topo de bolo e papel de arroz");
  await falar("tema Toy Story, Vinicius, 4 anos");
  const comFoto = await falar("segue a foto do tema", true);
  checa("FOTO-ACEITA", !comFoto.erro, comFoto.erro || "");
  await falar("no nome do Sandro, pago no pix, pode fechar");

  const ped = await (await p.request.get(BASE + "/api/qa/ultimo-pedido")).json().catch(() => null);
  checa("PEDIDO-CRIADO", !!ped, ped ? "total " + ped.total_centavos : "nenhum");
  if (ped) {
    const bolo = (ped.itens || []).find((i) => /bolo/i.test(i.produto));
    checa("BOLO-EM-KG-COM-PRECO-DE-BOLO", bolo && bolo.unit_centavos >= 4000 && bolo.unidade === "kg",
      bolo ? bolo.produto + " " + bolo.unit_centavos + "c " + bolo.unidade : "sem bolo");
    checa("PAPEL-DE-ARROZ-COBRADO", (ped.itens || []).some((i) => /papel de arroz/i.test(i.produto)));
    checa("PAGAMENTO-GRAVADO", /pix/i.test(ped.forma_pagamento || ""), ped.forma_pagamento || "vazio");
    checa("VAI-PRA-AGUARDANDO-NAO-PRA-APROVACAO", !!ped.precisa_confirmacao, ped.motivo_humano || "");
  }

  // ---------------------------------------------------------------------
  console.log("\n2) A foto virou foto de referência do pedido");
  // ---------------------------------------------------------------------
  await p.goto(BASE + "/aguardando", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(3000);
  const temFoto = await p.getByText(/foto de refer/i).count();
  checa("FOTO-NO-CARD-DO-PEDIDO", temFoto > 0);

  // ---------------------------------------------------------------------
  console.log("\n3) Peça de cardápio aparece na conversa e o visualizador cabe na tela");
  // ---------------------------------------------------------------------
  await p.goto(BASE + "/atendimentos", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(4000);
  const conversa = p.locator("button,[role=button]").filter({ hasText: /Cliente de teste|Sandro/ }).first();
  if (await conversa.count()) { await conversa.click(); await p.waitForTimeout(3000); }
  const imagens = p.locator('img[alt="Imagem enviada"]');
  const qtdImg = await imagens.count();
  checa("PECA-APARECE-NA-CONVERSA", qtdImg > 0, qtdImg + " imagem(ns)");
  if (qtdImg > 0) {
    await imagens.first().click();
    await p.waitForTimeout(1500);
    const cx = p.locator('img[alt="Imagem"]').first();
    if (await cx.count()) {
      const cx1 = await cx.boundingBox();
      const vp = p.viewportSize();
      checa("VISUALIZADOR-CABE-NA-TELA", cx1 && cx1.height <= vp.height + 2,
        cx1 ? Math.round(cx1.height) + "px de " + vp.height : "sem caixa");
      await p.keyboard.press("Escape").catch(() => {});
      await p.mouse.click(5, 5);
      await p.waitForTimeout(800);
    }
  }

  // ---------------------------------------------------------------------
  console.log("\n4) Lançar o valor do topo e avisar o cliente");
  // ---------------------------------------------------------------------
  await p.goto(BASE + "/aguardando", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(3000);
  const campoProduto = p.locator('input[placeholder="O que é"]').first();
  if (await campoProduto.count()) {
    await campoProduto.fill("topo de bolo");
    await p.locator('input[placeholder="R$ cada"]').first().fill("25");
    await p.waitForTimeout(500);
    const botao = p.locator("button").filter({ hasText: /Lançar .*e avisar/i }).first();
    const rotulo = (await botao.count()) ? (await botao.innerText()).replace(/\s+/g, " ").trim() : "";
    checa("BOTAO-MOSTRA-O-VALOR", /25,00/.test(rotulo), rotulo);
    if (await botao.count()) { await botao.click(); await p.waitForTimeout(6000); }
  } else {
    checa("FORMULARIO-DE-LANCAR-VALOR", false, "campo não encontrado");
  }

  const ped2 = await (await p.request.get(BASE + "/api/qa/ultimo-pedido")).json().catch(() => null);
  if (ped2) {
    checa("TOPO-ENTROU-NO-PEDIDO", (ped2.itens || []).some((i) => /topo/i.test(i.produto)),
      (ped2.itens || []).map((i) => i.produto).join(", "));
    checa("TOTAL-SUBIU-COM-O-TOPO", ped && ped2.total_centavos >= (ped.total_centavos || 0) + 2500,
      (ped?.total_centavos || 0) + " -> " + ped2.total_centavos);
    checa("FICA-ESPERANDO-O-CLIENTE", !!ped2.aguardando_cliente);
    checa("AINDA-NAO-ESTA-NA-APROVACAO", !!ped2.aguardando_cliente || !!ped2.precisa_confirmacao);
  }

  // ---------------------------------------------------------------------
  console.log("\n5) Aceite do cliente libera pra aprovação");
  // ---------------------------------------------------------------------
  const botaoAceitou = p.locator("button").filter({ hasText: /Ele aceitou, liberar/i }).first();
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  if (await botaoAceitou.count()) {
    await botaoAceitou.click();
    await p.waitForTimeout(5000);
  }
  const ped3 = await (await p.request.get(BASE + "/api/qa/ultimo-pedido")).json().catch(() => null);
  checa("LIBERADO-PRA-APROVACAO", ped3 && !ped3.aguardando_cliente && !ped3.precisa_confirmacao,
    ped3 ? "aguardando=" + ped3.aguardando_cliente + " pendente=" + ped3.precisa_confirmacao : "sem pedido");

  const cont = await (await p.request.get(BASE + "/api/fila/contagem")).json().catch(() => ({}));
  checa("APARECE-NA-FILA-DE-APROVACAO", (cont.fila || 0) >= 1, JSON.stringify(cont));

  checa("SEM-ERRO-DE-CONSOLE", errosConsole.length === 0, errosConsole.slice(0, 2).join(" | "));

  // ---------------------------------------------------------------------
  const falhas = resultados.filter((r) => !r.ok);
  console.log("\n" + "#".repeat(70));
  console.log("PAINEL: " + (resultados.length - falhas.length) + " ok, " + falhas.length + " falha(s)");
  console.log("#".repeat(70));
  for (const f of falhas) console.log("FALHOU " + f.id + "  " + f.detalhe);
  await br.close();
})();
