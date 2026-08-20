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

  // A HORA DA RETIRADA FALTAVA AQUI, E SEM ELA O PEDIDO NAO FECHA.
  //
  // O codigo se recusa a fechar pedido sem hora, de proposito: a cozinha produz
  // pela data E pela hora que estao na comanda. O roteiro ia ate o "pode
  // fechar" sem nunca falar em horario, entao a recusa estava certa e quem
  // cobrava a coisa errada era o teste. Cliente de verdade responde isso quando
  // ela pergunta, e agora ela pergunta.
  await falar("quero um bolo de brigadeiro de 2 kg pra sexta 29/08, as 16h");
  await falar("pao de lo branco");
  const comPeca = await falar("me manda o cardapio de bolos");
  checa("CARDAPIO-ENFILEIRADO", (comPeca.cardapios || []).length > 0, (comPeca.cardapios || []).join(","));

  await falar("quero topo de bolo e papel de arroz");
  await falar("tema Toy Story, Vinicius, 4 anos");
  const comFoto = await falar("segue a foto do tema", true);
  checa("FOTO-ACEITA", !comFoto.erro, comFoto.erro || "");
  await falar("no nome do Sandro, pago no pix, pode fechar");

  const ped = await (await p.request.get(BASE + URL_PEDIDO)).json().catch(() => null);
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
  // A peça de cardápio no chat NÃO é testável por aqui: o /testar-ia não grava
  // conversa de propósito. Quem cobre isso é testes/webhook-simulado.cjs, que
  // percorre o caminho de producao inteiro com a assinatura da Meta.
  const imagens = p.locator('img[alt="Imagem enviada"]');
  const qtdImg = await imagens.count();
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

  // O TESTE SO PODE MEXER NO PEDIDO QUE ELE MESMO CRIOU.
  //
  // Isto usava .first(): o PRIMEIRO card da tela, qualquer que fosse. Em
  // 20/08/2026 o dono deixou um pedido de demonstracao na fila (Patricia
  // Loureiro, bolo com topo) e saiu de casa. O portao rodou algumas vezes. Numa
  // rodada o teste lancou R$ 25 no pedido DELA, e numa rodada seguinte o mesmo
  // botao ja significava "o cliente respondeu por fora" e liberou o pedido pra
  // aprovacao. A conversa ficou com a Dora perguntando e respondendo sozinha.
  //
  // Estragar a demonstracao foi o de menos. Este teste fala com o painel de
  // PRODUCAO: rodando num dia com pedido de cliente de verdade na fila, ele
  // lancaria R$ 25 num pedido real e mandaria mensagem pra essa pessoa.
  //
  // Agora ele procura o card pelo nome que ele mesmo usou. Se nao achar, falha
  // dizendo isso, em vez de mexer no pedido do vizinho.
  const meuCard = p.locator("li,article,section,div").filter({ hasText: /Sandro/ }).last();
  const dentro = (await meuCard.count()) ? meuCard : null;
  if (!dentro) {
    checa("CARD-DO-PROPRIO-PEDIDO", false, "nao achei o card do pedido criado por este teste");
  }
  const campoProduto = dentro ? dentro.locator('input[placeholder="O que é"]').first() : p.locator("__nao_existe__");
  if (await campoProduto.count()) {
    await campoProduto.fill("topo de bolo");
    await dentro.locator('input[placeholder="R$ cada"]').first().fill("25");
    await p.waitForTimeout(500);
    const botao = dentro.locator("button").filter({ hasText: /Lançar .*e avisar/i }).first();
    const rotulo = (await botao.count()) ? (await botao.innerText()).replace(/\s+/g, " ").trim() : "";
    checa("BOTAO-MOSTRA-O-VALOR", /25,00/.test(rotulo), rotulo);
    if (await botao.count()) { await botao.click(); await p.waitForTimeout(6000); }
  } else {
    checa("FORMULARIO-DE-LANCAR-VALOR", false, "campo não encontrado");
  }

  const ped2 = await (await p.request.get(BASE + URL_PEDIDO)).json().catch(() => null);
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
  // Mesma regra do passo anterior, pelo mesmo motivo: este botao libera o pedido
  // pra aprovacao PULANDO a resposta do cliente. Apontado pro card errado, ele
  // fecha o pedido de outra pessoa por conta propria.
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  const meuCard2 = p.locator("li,article,section,div").filter({ hasText: /Sandro/ }).last();
  const botaoAceitou = (await meuCard2.count())
    ? meuCard2.locator("button").filter({ hasText: /Ele aceitou, liberar/i }).first()
    : p.locator("__nao_existe__");
  if (await botaoAceitou.count()) {
    await botaoAceitou.click();
    await p.waitForTimeout(5000);
  } else {
    checa("BOTAO-ACEITOU-NO-CARD-CERTO", false, "nao achei o botao dentro do card do proprio teste");
  }
  const ped3 = await (await p.request.get(BASE + URL_PEDIDO)).json().catch(() => null);
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
