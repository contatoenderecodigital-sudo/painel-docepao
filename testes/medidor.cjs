// O MEDIDOR: RODA A MESMA CONVERSA VARIAS VEZES E JULGA PELO BANCO.
//
// Ate agora eu media atendimento lendo a conversa e achando bonito. Isso nao e
// medida, e impressao. Duas coisas mudam aqui, e as duas vieram da pesquisa:
//
// 1. O GABARITO E O ESTADO DO BANCO, nao o texto. E como o tau-bench (Sierra)
//    avalia agente de atendimento: compara o estado final do banco com o estado
//    esperado. Texto bonito com pedido errado e reprovacao, nao aprovacao.
//
// 2. RODA K VEZES E EXIGE ACERTO NAS K. O mesmo diálogo da resultado diferente
//    a cada execucao: no tau-bench, agentes de ponta acertam uma vez em ~60% dos
//    casos mas acertam OITO seguidas em menos de 25%. Rodar uma vez e sorteio.
//    A metrica que vale e pass^k, e e ela que este arquivo imprime.
//
// O que este medidor NAO faz: conversar como gente. Ele manda o roteiro, entao
// serve pra medir se a MAQUINA aguenta (preco, item, troca, fechamento). Medir
// se a CONVERSA funciona e a bateria de personas ao vivo, que e outra coisa e
// custa muito mais caro.
//
// Roda com:  node testes/medidor.cjs
//            node testes/medidor.cjs 3          (3 repeticoes em vez de 5)
//            node testes/medidor.cjs 5 troca    (so os cenarios com "troca")
const { execFile } = require("child_process");

const VPS = "root@179.198.126.197";
const CHAVE = require("os").homedir() + "/.ssh/id_ed25519_hub";
const REPETICOES = Number(process.argv[2]) || 5;
const FILTRO = (process.argv[3] || "").toLowerCase();

function ssh(comando) {
  return new Promise((resolve, reject) => {
    execFile(
      "ssh",
      ["-i", CHAVE, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=no", VPS, comando],
      { timeout: 300000, maxBuffer: 10 * 1024 * 1024 },
      (err, saida) => (err ? reject(err) : resolve(String(saida))),
    );
  });
}

const psql = (sql) =>
  ssh(
    "docker exec $(docker ps --filter name=gdgroavvfkkcdxvbrzvth5xc -q|head -1) " +
      "psql -U hub -d enderecodigital_hub -A -F'|' -t -c \"" + sql.replace(/"/g, '\\"') + "\"",
  );

// ---------------------------------------------------------------------------
//  OS CENARIOS. Cada um e um defeito real que ja custou dinheiro.
//
//  esperado.itens: o que TEM que estar anotado, por pedaco do nome
//  esperado.proibidos: o que NAO pode aparecer (o item velho de uma troca)
//  esperado.linhas: quantas linhas o pedido tem que ter (pega duplicata)
//  esperado.fechou: se tem que existir pedido registrado no fim
// ---------------------------------------------------------------------------
const CENARIOS = [
  {
    nome: "troca de bolo nao duplica",
    fala: [
      "boa tarde, quero um bolo de 2 kg de prestigio pra festa dia 12/09",
      "pao de lo branco",
      "na verdade muda pra 4 leites",
      "as 16h, nome Patricia Bonfanti, pix",
    ],
    esperado: { itens: ["4 leites"], proibidos: ["prestigio"], linhas: 1 },
  },
  {
    nome: "pergunta de preco nao vira item",
    fala: [
      "bom dia, quanto custa a torta doce por quilo?",
      "e o empadao, quanto fica?",
      "obrigada, vou pensar e falar com meu marido",
    ],
    esperado: { itens: [], linhas: 0, fechou: false },
  },
  {
    nome: "produto que a padaria nao faz nao entra",
    fala: [
      "voces tem docinho sem lactose?",
      "e bolo vegano?",
      "entao me ve 30 brigadeiros mesmo, pra sexta as 15h",
      "forminha rosa, nome Camila Souza, cartao",
    ],
    esperado: { itens: ["brigadeiro"], proibidos: ["lactose", "vegano"], linhas: 1 },
  },
  {
    nome: "festa com quatro familias fecha",
    fala: [
      "quero fazer uma festa dia 06/09, 100 coxinhas e 50 esfirras de calabresa",
      "e 60 brigadeiros, forminha dourada",
      "um bolo de 3 kg de laka, pao de lo branco",
      "sem topo e sem papel de arroz",
      "as 15h, nome Fernanda Klein, cartao",
    ],
    esperado: { itens: ["coxinha", "esfirra", "brigadeiro", "laka"], linhas: 4, fechou: true },
  },
  {
    nome: "cor da forminha nao volta a ser perguntada",
    fala: [
      "quero 60 brigadeiros pra sabado as 10h",
      "forminha rosa",
      "nome Terezinha Bosco, dinheiro",
    ],
    esperado: { itens: ["brigadeiro"], linhas: 1, obsTem: ["rosa"] },
  },
];

const alvos = CENARIOS.filter((c) => !FILTRO || c.nome.toLowerCase().includes(FILTRO));
const semAc = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Uma execucao de um cenario, num telefone que nao existiu antes.
async function rodar(cenario, fone) {
  for (const texto of cenario.fala) {
    await ssh("/root/conversa.sh " + fone + " '" + texto.replace(/'/g, "") + "' >/dev/null 2>&1").catch(() => null);
  }
  // O PEDIDO MORA EM DOIS LUGARES, DEPENDENDO DE TER FECHADO OU NAO.
  //
  // Enquanto o cliente conversa, os itens ficam em pedido_montagem. Quando o
  // pedido e registrado, eles vao pra pedido_itens e a montagem e APAGADA.
  // A primeira versao deste medidor lia so a montagem, entao todo cenario que
  // fechou certo aparecia como "(nada)" e era reprovado. O medidor errado teria
  // me feito consertar codigo que estava funcionando.
  const deMontagem = await psql(
    "select coalesce(x.produto,'') || '~' || coalesce(x.obs,'') from docepao.pedido_montagem pm " +
      "join docepao.clientes c on c.id=pm.cliente_id, jsonb_to_recordset(pm.itens) as x(produto text, obs text) " +
      "where c.telefone='" + fone + "'",
  ).catch(() => "");
  const doPedido = await psql(
    "select coalesce(i.produto,'') || '~' || coalesce(i.obs,'') from docepao.pedido_itens i " +
      "join docepao.pedidos p on p.id=i.pedido_id join docepao.clientes c on c.id=p.cliente_id " +
      "where c.telefone='" + fone + "'",
  ).catch(() => "");
  const limpar = (t) => String(t).split("\n").map((l) => l.trim()).filter(Boolean);
  const doPed = limpar(doPedido);
  // Fechou? Entao o pedido e a verdade. Nao fechou? A montagem e o que existe.
  const linhas = doPed.length ? doPed : limpar(deMontagem);
  const fechou = doPed.length > 0;
  return { linhas, fechou };
}

// O estado bateu com o gabarito?
function julgar(cenario, estado) {
  const e = cenario.esperado;
  const tudo = semAc(estado.linhas.join(" | "));
  const motivos = [];

  for (const item of e.itens ?? []) {
    if (!tudo.includes(semAc(item))) motivos.push("faltou " + item);
  }
  for (const proibido of e.proibidos ?? []) {
    if (tudo.includes(semAc(proibido))) motivos.push("sobrou " + proibido);
  }
  for (const obs of e.obsTem ?? []) {
    if (!tudo.includes(semAc(obs))) motivos.push("perdeu a observacao " + obs);
  }
  if (e.linhas != null && estado.linhas.length !== e.linhas) {
    motivos.push("esperava " + e.linhas + " linha(s), veio " + estado.linhas.length);
  }
  if (e.fechou === true && !estado.fechou) motivos.push("nao registrou o pedido");
  if (e.fechou === false && estado.fechou) motivos.push("registrou pedido de quem so perguntou");

  return motivos;
}

async function main() {
  console.log("MEDIDOR: " + alvos.length + " cenario(s), " + REPETICOES + " execucao(oes) cada.");
  console.log("O gabarito e o ESTADO DO BANCO, nao o texto da conversa.");
  console.log("");

  const resultado = [];
  let base = 5511977770000;

  for (const cenario of alvos) {
    const falhas = [];
    for (let i = 1; i <= REPETICOES; i++) {
      const fone = String(++base);
      const estado = await rodar(cenario, fone);
      const motivos = julgar(cenario, estado);
      if (motivos.length) falhas.push({ i, motivos, viu: estado.linhas });
      process.stdout.write(motivos.length ? "x" : ".");
    }
    const acertos = REPETICOES - falhas.length;
    console.log("  " + acertos + "/" + REPETICOES + "  " + cenario.nome);
    resultado.push({ cenario, acertos, falhas });
  }

  console.log("");
  console.log("=".repeat(70));
  let perfeitos = 0;
  for (const r of resultado) {
    const ok = r.acertos === REPETICOES;
    if (ok) perfeitos++;
    console.log(
      (ok ? "pass^" + REPETICOES + "  " : "FALHOU  ") +
        r.cenario.nome +
        "  (" + r.acertos + "/" + REPETICOES + ")",
    );
    for (const f of r.falhas) {
      console.log("          execucao " + f.i + ": " + f.motivos.join("; "));
      console.log("          o banco tinha: " + (f.viu.join(" | ") || "(nada)"));
    }
  }
  console.log("=".repeat(70));
  console.log(
    "pass^" + REPETICOES + ": " + perfeitos + " de " + alvos.length + " cenarios acertaram TODAS as execucoes.",
  );
  // Nao derruba o build: este medidor gasta minutos e mensagem de verdade, e
  // serve pra decidir, nao pra travar commit. Quem trava commit e o todos.cjs.
  process.exit(0);
}

main().catch((e) => {
  console.error("erro no medidor:", e.message);
  process.exit(1);
});
