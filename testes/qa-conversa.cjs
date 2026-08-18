// ============================================================================
//  QA DA DORA — roda conversas inteiras contra o cérebro real e cobra cada
//  regra que já quebrou em teste manual. Cada verificação nasceu de um erro
//  que o dono encontrou; a ideia é que ele nunca precise achar o mesmo bug
//  duas vezes.
//
//  Usa /api/testar-ia, que é o mesmo `responder()` da produção. Os pedidos que
//  a IA fechar caem na fila de verdade, então limpe o banco depois de rodar.
// ============================================================================
const pw = require("playwright-core");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE = "https://docepao.enderecodigital.tech";
// Hora em que a bateria comecou: o teste so olha pedido criado DAQUI pra frente.
// Sem isso ele lia o ultimo pedido do negocio (um pedido real, ou o da
// demonstracao) e acusava a IA de inventar o que era dado de outra conversa.
const INICIO = new Date().toISOString();
const LOGIN = { email: "admin@docepao.com", senha: "Docepao2026#" };

function chrome() {
  const b = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  for (const x of fs.readdirSync(b).filter((x) => x.startsWith("chromium-") && !x.includes("headless")).sort().reverse()) {
    const e = path.join(b, x, "chrome-win64", "chrome.exe");
    if (fs.existsSync(e)) return e;
  }
  throw new Error("chromium não encontrado");
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------------------------------------------------------------------------
//  Cada cenário: passos com a fala do cliente e o que a resposta tem que
//  cumprir. `verificar` recebe a resposta daquele turno e o histórico inteiro.
// ---------------------------------------------------------------------------
const CENARIOS = [
  {
    nome: "Festa completa: categorias, recheios, ordem e bolo brigadeiro",
    passos: [
      { diz: "Boa noite" },
      { diz: "Quero fazer uma festa pro meu filho" },
      { diz: "30 pessoas" },
      {
        diz: "dia 30/08 de manha",
        checa: [
          {
            id: "SUGESTAO-GENERICA",
            porque: "citar 'coxinha'/'brigadeiro' antes de o cliente escolher faz parecer decidido",
            ok: (r) => !/(coxinhas?|brigadeiros?)\b/i.test(norm(r)) || /(salgados|docinhos)/i.test(norm(r)),
          },
        ],
      },
      { diz: "quais salgados tem?", checa: [{ id: "CARDAPIO-SALGADOS", porque: "a peça tem que ser enfileirada de verdade, não só prometida", ok: (r, h, extra) => (extra.cardapios || []).includes("salgados") }] },
      {
        diz: "quero coxinha de frango, empadinha e croissant, metade de cada",
        checa: [
          {
            id: "RECHEIO-NAO-INVENTADO",
            porque: "ela já registrou 'empadinha de queijo' sem ninguém falar queijo",
            // O que nao pode e ela INVENTAR o recheio. Perguntar a quantidade
            // primeiro e legitimo: aqui faltam as duas coisas (o cliente disse
            // "metade de cada" sem dizer de quanto), e a regra da casa e uma
            // pergunta por vez. Reprova so se ela citar um recheio que ninguem
            // falou ou seguir em frente sem perguntar nada.
            ok: (r, h) => {
              const t = norm(r);
              // Tudo que o CLIENTE ja escreveu nesta conversa.
              const dele = norm(
                (h || []).filter((m) => m.de === "cliente").map((m) => m.texto).join(" "),
              );
              // "produto de recheio" afirmado: o recheio tem que ter saido dele.
              const afirmacoes = [...t.matchAll(/(coxinha|empadinha|croissant|esfirra|risolis|mini bolha|pastel|quiche|enroladinho)s? de ([a-z]+)/g)];
              const inventou = afirmacoes.some((m) => !dele.includes(m[2]));
              const perguntou = /recheio|sabor|quantos|quantas|quanto/.test(t);
              return !inventou && perguntou;
            },
          },
        ],
      },
      { diz: "empadinha de brocolis e croissant de carne" },
      {
        diz: "e os docinhos?",
        checa: [
          {
            id: "DOCINHO-SABOR-ANTES-DA-FORMINHA",
            porque: "perguntou a cor da forminha antes de saber quais docinhos",
            ok: (r) => !/forminha/i.test(norm(r)) || /(sabor|qual|quais)/i.test(norm(r)),
          },
        ],
      },
      { diz: "metade brigadeiro metade beijinho" },
      { diz: "forminha amarela" },
      { diz: "quero bolo de brigadeiro, 2 kg" },
      { diz: "pao de lo branco" },
      {
        diz: "quero topo de bolo e papel de arroz",
        checa: [
          {
            id: "TOPO-PEDE-NOME-E-IDADE",
            porque: "sem nome e idade a peça não pode ser fabricada",
            ok: (r) => /(nome|idade|aniversariante|tema)/i.test(norm(r)),
          },
        ],
      },
      { diz: "tema Toy Story, Vinicius, 4 anos" },
      { diz: "caixa com tampa" },
      { diz: "so isso, pode fechar" },
      // Armadilha: o nome que ele dá é o do aniversariante, não o de quem paga.
      // Ela pode aceitar (e aí o pedido tem que ir sinalizado) ou insistir — as
      // duas saídas são boas, e a segunda é melhor ainda.
      { diz: "Vinicius" },
      { diz: "pode deixar no nome do Sandro entao" },
      {
        diz: "e so isso",
        fim: true,
        checa: [
          {
            id: "BOLO-NAO-VIRA-DOCINHO",
            porque: "bolo de brigadeiro já virou 2 docinhos de R$ 1,25",
            ok: (r, h, extra) => {
              const p = extra.pedido;
              if (!p) return "pendente";
              const bolo = p.itens.find((i) => /bolo/i.test(i.produto));
              return !!bolo && bolo.unit_centavos >= 4000;
            },
          },
          {
            id: "PAPEL-DE-ARROZ-E-ITEM",
            porque: "ficava só na observação e os R$ 12 sumiam do total",
            ok: (r, h, extra) => {
              const p = extra.pedido;
              if (!p) return "pendente";
              return p.itens.some((i) => /papel de arroz/i.test(i.produto));
            },
          },
          {
            id: "PAGAMENTO-NAO-INVENTADO",
            porque: "ela escreveu 'pix' numa conversa em que ninguém falou de pagamento",
            ok: (r, h, extra) => {
              const p = extra.pedido;
              if (!p) return "pendente";
              return !p.forma_pagamento;
            },
          },
          {
            id: "NOME-NAO-E-O-DO-ANIVERSARIANTE",
            porque: "o pedido saiu no nome da criança de 4 anos, que não paga nem retira",
            ok: (r, h, extra) => {
              const p = extra.pedido;
              if (!p) return "pendente";
              // ou o nome é de quem paga, ou o pedido foi sinalizado pra equipe
              return !/vinicius/i.test(p.cliente_nome || "") || !!p.precisa_confirmacao;
            },
          },
          {
            id: "UM-PEDIDO-SO",
            porque: "uma conversa já gerou três pedidos na fila",
            // 0 = ela se recusou a fechar por falta de dado, o que é bom e não
            // é o bug que esta checagem persegue (que é fechar VÁRIAS vezes).
            ok: (r, h, extra) => extra.totalPedidos <= 1,
          },
        ],
      },
    ],
  },
  {
    nome: "Pedido simples: sem festa, sem bolo",
    passos: [
      { diz: "oi, voces abrem domingo?" },
      { diz: "quero 100 coxinhas pra sexta 29/08" },
      { diz: "meu nome e Sandro" },
      { diz: "pago no pix", fim: true, checa: [
        // Só vale se o pedido deste cenário existir: a IA às vezes fecha uma
        // mensagem depois, e aí o último pedido do banco é o do cenário anterior.
        { id: "PAGAMENTO-QUANDO-DITO", porque: "a trava não pode derrubar o pagamento que o cliente REALMENTE falou",
          ok: (r, h, extra) => {
            const p = extra.pedido;
            if (!p || !/sandro/i.test(p.cliente_nome || "")) return "pendente";
            return /pix/i.test(p.forma_pagamento || "");
          } },
      ] },
    ],
  },
  // -------------------------------------------------------------------------
  //  COMPLEXAS: nasceram de conversas reais lidas na tela, uma a uma.
  // -------------------------------------------------------------------------
  {
    nome: "Indeciso: troca item no meio e a conversa nao pode entrar em laco",
    passos: [
      { diz: "vcs fazem salgado pra festa?" },
      { diz: "eh dia 12/09, 20 pessoas" },
      {
        diz: "quero 200 salgados, coxinha e empadinha, metade de cada",
        checa: [
          {
            id: "ANOTOU-O-QUE-ELE-ESCOLHEU",
            porque: "ele deu tipo e quantidade e a IA ficou repetindo pergunta sem anotar nada",
            ok: (r, h, extra) => (extra.itens || []).some((i) => /coxinha/i.test(i.produto)),
          },
        ],
      },
      { diz: "a empadinha pode ser de frango" },
      {
        diz: "pensando bem, tira a empadinha e poe risoles de carne",
        checa: [
          {
            id: "TROCA-DE-ITEM",
            porque: "o cliente trocou o item e o pedido ficou com os dois, ou perdeu os dois",
            ok: (r, h, extra) => {
              const itens = extra.itens || [];
              const temRisoles = itens.some((i) => /ris[óo]lis|risoles/i.test(i.produto));
              const temEmpadinha = itens.some((i) => /empadinha/i.test(i.produto));
              return temRisoles && !temEmpadinha;
            },
          },
        ],
      },
      {
        diz: "quero 100 brigadeiro com forminha branca",
        checa: [
          {
            id: "NAO-REPETE-CARDAPIO",
            porque: "'te mandei o cardapio de salgados' saiu oito vezes na mesma conversa",
            ok: (r, h) =>
              h.filter((m) => m.de === "ia" && /mandei o card[áa]pio/i.test(m.texto)).length <= 2,
          },
        ],
      },
    ],
  },
  {
    nome: "Pergunta preco antes de decidir, bolo de dois sabores",
    passos: [
      { diz: "quanto custa o bolo de festa?", checa: [{ id: "PECA-PEDIDA-E-A-CERTA", porque: "ele perguntou do BOLO e recebeu o cardapio de salgados", ok: (r, h, extra) => !(extra.cardapios || []).includes("salgados") }] },
      {
        diz: "quantos quilos pra 25 pessoas?",
        checa: [
          {
            id: "RESPONDE-A-PERGUNTA",
            porque: "ele fez uma pergunta de conta e levou outra pergunta de volta",
            ok: (r) => /2,5|2\.5|100 ?g|kg/i.test(r),
          },
        ],
      },
      {
        diz: "brigadeiro com morango entao, 2,5 kg, pao de lo de chocolate",
        checa: [
          {
            id: "DOIS-SABORES-NO-NOME",
            porque: "o pedido foi pra cozinha como 'bolo brigadeiro' e o morango sumiu do nome",
            ok: (r, h, extra) =>
              (extra.itens || []).some((i) => /brigadeiro/i.test(i.produto) && /morango/i.test(i.produto + " " + (i.obs || ""))),
          },
        ],
      },
      {
        diz: "nao quero salgado nem docinho",
        checa: [
          {
            id: "NAO-MANDA-RECUSADO",
            porque: "ele recusou e recebeu o cardapio da coisa recusada",
            ok: (r, h, extra) => !(extra.cardapios || []).includes("salgados") && !(extra.cardapios || []).includes("docinhos"),
          },
        ],
      },
    ],
  },
  {
    nome: "Bagunçado: metade de cada entre dois tipos, e nome parecido",
    passos: [
      { diz: "eh pro casamento da minha irma" },
      {
        diz: "150 salgados assados, esfirra e empadinha, metade de cada",
        checa: [
          {
            id: "METADE-DE-CADA",
            porque: "150 viraram 37 e 37: a divisao foi feita duas vezes",
            ok: (r, h, extra) => {
              const soma = (extra.itens || [])
                .filter((i) => /esfirra|empadinha/i.test(i.produto))
                .reduce((t, i) => t + (Number(i.qtd) || 0), 0);
              return soma === 150;
            },
          },
        ],
      },
      {
        diz: "quero 1 empadao de palmito tambem",
        checa: [
          {
            id: "EMPADAO-NAO-VIRA-EMPADINHA",
            porque: "empadao e empadinha tem nome parecido e preco muito diferente",
            ok: (r, h, extra) => (extra.itens || []).some((i) => /empad[ãa]o/i.test(i.produto)),
          },
        ],
      },
    ],
  },
];

// Regras que valem em TODA resposta.
const REGRAS_GERAIS = [
  { id: "SEM-TRAVESSAO", porque: "o dono reconhece na hora como texto de IA", ok: (r) => !r.includes("—") },
  // Cumprimento ("tudo bem?") não conta: é a mesma exceção que vale em produção.
  {
    id: "UMA-PERGUNTA-POR-VEZ",
    porque: "despejar 3 perguntas faz a pessoa responder só a última",
    ok: (r) =>
      r
        .split(/\n\s*\n/)
        .filter((b) => b.includes("?") && !/tudo bem|tudo certo|como vai|bom dia|boa tarde|boa noite/i.test(b))
        .length <= 1,
  },
  { id: "SEM-EMOJI", porque: "marca premium, nunca emoji", ok: (r) => !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(r) },
  { id: "SEM-JARGAO-INTERNO", porque: "o cliente não pode ler 'faixa A' nem 'registrei no sistema'", ok: (r) => !/faixa [abc]\b|registrei no sistema|ferramenta|precisa_confirmacao/i.test(norm(r)) },
];

(async () => {
  const br = await pw.chromium.launch({ executablePath: chrome() });
  const p = await (await br.newContext()).newPage();
  await p.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.fill('input[type="email"], input[name="email"]', LOGIN.email);
  await p.fill('input[type="password"], input[name="senha"]', LOGIN.senha);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(6000);
  if (p.url().includes("/login")) { console.log("LOGIN FALHOU"); await br.close(); process.exit(1); }

  const falhas = [];
  const passes = [];

  for (const cen of CENARIOS) {
    console.log("\n" + "=".repeat(78));
    console.log("CENARIO: " + cen.nome);
    console.log("=".repeat(78));
    const msgs = [];
    for (const passo of cen.passos) {
      msgs.push({ de: "cliente", texto: passo.diz });
      const r = await p.request.post(BASE + "/api/testar-ia", { data: { mensagens: msgs }, timeout: 120000 });
      let j = {};
      try { j = await r.json(); } catch { j = { erro: "HTTP " + r.status() }; }
      const resposta = String(j.resposta || j.erro || "");
      msgs.push({ de: "ia", texto: resposta });

      console.log("\n> " + passo.diz);
      console.log("  " + resposta.replace(/\n/g, "\n  "));
      if (j.cardapios?.length) console.log("  [pecas] " + j.cardapios.join(", "));

      // O pedido como ficou depois deste turno: e isso que separa teste de
      // verdade de teste que so olha texto.
      const extra = {
        cardapios: (j.cardapios || []).map((u) => String(u).split("/").pop().replace(".jpg", "")),
        itens: j.itens || [],
      };

      if (passo.fim) {
        const dados = await p.request.get(BASE + "/api/fila/contagem");
        const cont = await dados.json().catch(() => ({}));
        extra.totalPedidos = (cont.fila || 0) + (cont.aguardando || 0);
        extra.pedido = await buscarUltimoPedido(p);
      }

      const checagens = [...REGRAS_GERAIS, ...(passo.checa || [])];
      for (const c of checagens) {
        let res;
        try { res = c.ok(resposta, msgs, extra); } catch (e) { res = false; }
        if (res === "pendente") continue;
        (res ? passes : falhas).push({ cenario: cen.nome, id: c.id, porque: c.porque, turno: passo.diz, resposta });
      }
    }
  }

  console.log("\n\n" + "#".repeat(78));
  console.log("RESULTADO: " + passes.length + " ok, " + falhas.length + " falha(s)");
  console.log("#".repeat(78));
  const porId = {};
  for (const f of falhas) (porId[f.id] = porId[f.id] || []).push(f);
  for (const [id, lista] of Object.entries(porId)) {
    console.log("\nFALHOU " + id + "  (" + lista.length + "x)");
    console.log("  por que importa: " + lista[0].porque);
    console.log('  no turno: "' + lista[0].turno + '"');
    console.log("  resposta: " + lista[0].resposta.replace(/\n/g, " ").slice(0, 200));
  }
  await br.close();
})();

async function buscarUltimoPedido(p) {
  try {
    const r = await p.request.get(BASE + "/api/qa/ultimo-pedido?desde=" + encodeURIComponent(INICIO), { timeout: 30000 });
    if (!r.ok()) return null;
    return await r.json();
  } catch {
    return null;
  }
}
