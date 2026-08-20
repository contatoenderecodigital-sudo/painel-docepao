// O QUE A EQUIPE VE NA TELA, CONFERIDO PELO NAVEGADOR DE VERDADE.
//
// Existe pra eu parar de pedir print pro dono quando algo "continua aparecendo".
// Em 20/08/2026 eu jurei que era cache do navegador dele, mandei limpar e abrir
// janela anonima, e o erro era meu: eu tinha filtrado a lista SOMENTE-LEITURA em
// vez da lista editavel. Quem me tirou do buraco foi ler o codigo; isto aqui
// serve pra descobrir sozinho da proxima vez.
//
// Uso: node testes/painel-visto-de-fora.cjs "Fernanda"
const pw = require("playwright-core");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE = "https://docepao.enderecodigital.tech";
const LOGIN = { email: "admin@docepao.com", senha: "Docepao2026#" };
const ALVO = process.argv[2] || "Fernanda";

function chrome() {
  const b = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  for (const x of fs.readdirSync(b).filter((d) => d.startsWith("chromium-") && !d.includes("headless")).sort().reverse()) {
    const e = path.join(b, x, "chrome-win64", "chrome.exe");
    if (fs.existsSync(e)) return e;
  }
  throw new Error("chromium nao encontrado");
}

(async () => {
  const br = await pw.chromium.launch({ executablePath: chrome() });
  const p = await br.newPage();
  await p.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.fill('input[type="email"], input[name="email"]', LOGIN.email);
  await p.fill('input[type="password"], input[name="senha"]', LOGIN.senha);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(7000);
  // A home e a fila de aprovacao: so mostra quem ja esta esperando aprovacao.
  // A tela de edicao do pedido mora dentro da conversa, em Atendimentos.
  await p.goto(BASE + "/atendimentos", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(6000);

  // A lista de conversas: qualquer elemento clicavel que carregue o nome.
  const alvo = p.locator("*").filter({ hasText: new RegExp(ALVO, "i") }).last();
  if (!(await alvo.count())) {
    // Sem isto eu so sei que "nao achei", que e a mesma cegueira que me fez
    // culpar o cache do navegador do dono por um erro meu.
    console.log("nao achei " + ALVO + " na tela. URL: " + p.url());
    const visivel = (await p.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 400);
    console.log("o que a tela mostra: " + visivel);
    await br.close();
    process.exit(1);
  }
  await alvo.click({ timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(6000);

  // O card do pedido comeca fechado: sem abrir, a lista de itens nem existe e a
  // conferencia daria "ok" por nao ter encontrado nada. Zero linha nao e prova
  // de nada, e passar por isso seria o mesmo erro de antes com outra roupa.
  for (const rotulo of [/pedido/i, /itens/i, /corrigir/i, /editar/i]) {
    const b = p.locator("button").filter({ hasText: rotulo }).first();
    if (await b.count()) { await b.click({ timeout: 8000 }).catch(() => {}); await p.waitForTimeout(2500); }
    if (await p.locator('select[aria-label="Categoria"]').count()) break;
  }
  const cats = p.locator('select[aria-label="Categoria"]');
  const n = await cats.count();
  const valores = [];
  for (let i = 0; i < n; i++) valores.push((await cats.nth(i).inputValue()).trim());
  console.log("linhas editaveis na tela: " + n);
  if (n === 0) {
    console.log("INCONCLUSIVO: nao consegui abrir a lista de itens, entao nada foi conferido");
    await br.close();
    process.exit(1);
  }
  console.log("categorias: " + (valores.join(" | ") || "(nenhuma)"));
  console.log(
    valores.includes("papel_de_arroz")
      ? "ERRO: a linha do papel de arroz AINDA aparece na lista editavel"
      : "ok: a linha do papel de arroz nao aparece na lista editavel",
  );

  // O seletor tambem nao pode mais OFERECER papel de arroz pra criar na mao.
  if (n > 0) {
    const ops = await cats.first().locator("option").allInnerTexts();
    console.log(
      ops.some((o) => /papel de arroz/i.test(o))
        ? "ERRO: 'Papel de arroz' ainda aparece na lista de categorias"
        : "ok: 'Papel de arroz' saiu da lista de categorias",
    );
  }
  await br.close();
})().catch((e) => { console.log("ERRO: " + String(e).slice(0, 200)); process.exit(1); });
