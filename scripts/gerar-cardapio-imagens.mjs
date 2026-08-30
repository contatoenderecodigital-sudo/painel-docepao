// ============================================================================
//  AS PEÇAS DO CARDÁPIO VIRANDO IMAGEM, SEM MÃO HUMANA
//
//  gerar-cardapio.mjs monta os HTML a partir do catálogo. Este aqui fotografa
//  os oito e grava direto em public/cardapios, que é de onde a Dora manda.
//
//  POR QUE ISSO PRECISAVA EXISTIR
//
//  Até 23/08/2026 a captura era manual: abrir cada HTML no Chrome, F12, ajustar
//  o tamanho, "capture full size screenshot", salvar com o nome certo. Oito
//  vezes, toda vez que a dona mexesse num preço.
//
//  Na prática ninguém refaz oito imagens à mão, e foi por isso que a imagem de
//  docinhos que a Dora mandava não trazia as cores da forminha: o HTML tinha
//  sido corrigido e a foto ficou pra trás. O cliente recebia um cardápio velho
//  e a Dora tinha que listar 21 cores no texto pra compensar.
//
//  Fato em dois lugares e um deles ficando pra trás: é sempre a mesma doença.
//
//  Uso:
//    node scripts/gerar-cardapio.mjs && node scripts/gerar-cardapio-imagens.mjs
// ============================================================================

import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ORIGEM = ".cardapios";
const DESTINO = "public/cardapios";
const LARGURA = 1080;

// O Chrome que o Playwright já baixou nesta máquina. playwright-core não traz
// navegador junto, e instalar um só pra isso seria 300 MB por nada.
function acharChrome() {
  const naMaquina = [
    "/usr/local/bin/google-chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const exe of naMaquina) {
    try {
      statSync(exe);
      return exe;
    } catch {}
  }
  const base = join(homedir(), "AppData", "Local", "ms-playwright");
  try {
    const pastas = readdirSync(base)
      .filter((d) => d.startsWith("chromium-"))
      .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    for (const p of pastas) {
      const exe = join(base, p, "chrome-win", "chrome.exe");
      try {
        statSync(exe);
        return exe;
      } catch {}
    }
  } catch {}
  throw new Error("nao achei Chrome nesta maquina (linux em /usr/bin ou Playwright no Windows)");
}

// O navegador recusa file:// vindo de automação, então as peças vão por HTTP
// local. Sobe e desce dentro deste script: nada fica rodando depois.
function servir(porta) {
  const s = createServer((q, r) => {
    // LÊ ANTES DE RESPONDER.
    //
    // Com o writeHead na frente, o pedido do favicon derrubava o script: o
    // arquivo não existe, o catch tentava mandar 404 e o cabeçalho de 200 já
    // tinha ido embora.
    let conteudo = null;
    try {
      conteudo = readFileSync(join(process.cwd(), ORIGEM, decodeURIComponent(q.url.split("?")[0])));
    } catch {}
    if (!conteudo) {
      r.writeHead(404);
      r.end("nao achei");
      return;
    }
    r.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    r.end(conteudo);
  });
  return new Promise((ok) => s.listen(porta, () => ok(s)));
}

const pecas = readdirSync(ORIGEM).filter((f) => f.endsWith(".html"));
if (!pecas.length) {
  console.log("Nenhum HTML em " + ORIGEM + ". Roda gerar-cardapio.mjs primeiro.");
  process.exit(1);
}

mkdirSync(DESTINO, { recursive: true });
const servidor = await servir(8791);
const navegador = await chromium.launch({ executablePath: acharChrome() });

// deviceScaleFactor 1 de proposito: o WhatsApp comprime a imagem de qualquer
// jeito, e peça de 1 MB demora a abrir no celular do cliente.
const pagina = await navegador.newPage({
  viewport: { width: LARGURA, height: 1400 },
  deviceScaleFactor: 1,
});

console.log("Capturando as peças do cardápio:");
for (const html of pecas) {
  const nome = html.replace(".html", "");
  await pagina.goto("http://localhost:8791/" + html, { waitUntil: "networkidle" });

  // O HTML traz "html { zoom: 4 }" de propósito: ele nasceu pra ser capturado à
  // mão, com o navegador em densidade 0,25. Aqui a densidade é 1, então o zoom
  // sai e a peça fica com os 1080 px de largura que ela foi desenhada pra ter.
  // Sem isso a imagem sai 4320 px e mais de 1 MB, que demora a abrir no celular
  // de quem está comprando.
  await pagina.addStyleTag({ content: "html { zoom: 1 !important; }" });
  await pagina.waitForTimeout(120);

  const buffer = await pagina.screenshot({ fullPage: true, type: "jpeg", quality: 90 });
  const destino = join(DESTINO, nome + ".jpg");
  writeFileSync(destino, buffer);
  console.log("  " + destino.padEnd(34) + Math.round(buffer.length / 1024) + " KB");
}

await navegador.close();
servidor.close();
console.log("");
console.log("As oito saíram do catálogo. Mudou preço ou sabor lá? Roda os dois scripts de novo.");
