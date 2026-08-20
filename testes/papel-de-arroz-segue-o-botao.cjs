// DESMARCAR O PAPEL DE ARROZ TEM QUE DERRUBAR O TOTAL.
//
// O acessorio aparecia na tela em dois lugares: marcado no bolo, em cima, e
// como linha propria editavel embaixo. Pior que confundir quem aprova, isso
// cobrava errado: o motor so CRIA a linha do papel de arroz quando a observacao
// do bolo pede, e nunca tira. O dono desmarcou o botao, salvou, e o total
// continuou nos mesmos R$ 199,60.
//
// A primeira tentativa de conserto so escondia a linha enquanto o botao estava
// MARCADO, ou seja, funcionava exatamente no estado em que nao fazia falta.
//
// Este teste chama a MESMA rota que a tela chama, com sessao de verdade, e
// cobra os dois estados do botao. Nao le codigo nem confia em print: le o total
// que o servidor gravou.
//
// Roda com: node testes/papel-de-arroz-segue-o-botao.cjs
const pw = require("playwright-core");
const fs = require("fs"); const path = require("path"); const os = require("os");
const BASE = "https://docepao.enderecodigital.tech";
const LOGIN = { email: "admin@docepao.com", senha: "Docepao2026#" };
function chrome() {
  const b = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  for (const x of fs.readdirSync(b).filter((d) => d.startsWith("chromium-") && !d.includes("headless")).sort().reverse()) {
    const e = path.join(b, x, "chrome-win64", "chrome.exe");
    if (fs.existsSync(e)) return e;
  }
  throw new Error("chromium nao encontrado");
}
const PEDIDO = process.argv[2];
const CLIENTE = process.argv[3];
if (!PEDIDO || !CLIENTE) {
  console.log("uso: node testes/papel-de-arroz-segue-o-botao.cjs <pedidoId> <clienteId>");
  console.log("(um pedido com bolo; os ids saem do banco)");
  process.exit(2);
}
(async () => {
  const br = await pw.chromium.launch({ executablePath: chrome() });
  const p = await br.newPage();
  await p.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.fill('input[type="email"], input[name="email"]', LOGIN.email);
  await p.fill('input[type="password"], input[name="senha"]', LOGIN.senha);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(7000);

  // COM o papel de arroz na observacao do bolo, e SEM a linha (que e o que a
  // tela passa a enviar depois do conserto): o servidor tem que criar a linha.
  const comPapel = [{ produto: "bolo laka", categoria: "bolo_festa", qtd: 4, unidade: "kg",
    obs: "pao de lo de chocolate, topo de bolo e papel de arroz tema Frozen, nome Alice, 5 anos" }];
  // SEM o papel na observacao (botao desmarcado) e sem a linha: nao pode cobrar.
  const semPapel = [{ produto: "bolo laka", categoria: "bolo_festa", qtd: 4, unidade: "kg",
    obs: "pao de lo de chocolate, topo de bolo tema Frozen, nome Alice, 5 anos" }];

  const salvar = async (itens) => {
    const r = await p.request.post(BASE + "/api/montagem", {
      data: { clienteId: CLIENTE, pedidoId: PEDIDO, itens, dados: {} },
      timeout: 60000,
    });
    return await r.json().catch(() => ({}));
  };
  const a = await salvar(comPapel);
  console.log("com papel de arroz marcado:   total=" + JSON.stringify(a.total ?? a));
  const b = await salvar(semPapel);
  console.log("com papel de arroz desmarcado: total=" + JSON.stringify(b.total ?? b));
  const marcado = Number(a.totalCentavos || 0);
  const desmarcado = Number(b.totalCentavos || 0);
  const ok = marcado > desmarcado && marcado - desmarcado === 1200;
  console.log("");
  console.log(ok
    ? "OK: desmarcar tirou exatamente os R$ 12,00 do papel de arroz"
    : "ERRO: marcado=" + marcado + " desmarcado=" + desmarcado + " (a diferenca tinha que ser 1200)");
  await br.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.log("ERRO: " + String(e).slice(0, 220)); process.exit(1); });
