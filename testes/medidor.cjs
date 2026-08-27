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
//  esperado.soma: quanto as quantidades tem que somar (pega mudanca de total)
//  esperado.fechou: se tem que existir pedido registrado no fim
// ---------------------------------------------------------------------------
// O GABARITO DOS CINCO JEITOS. Um objeto so, usado pelos cinco de proposito:
// se eu escrevesse cinco copias, uma divergiria sem ninguem perceber.
const MESMO_PEDIDO = {
  itens: ["coxinha", "quiche", "brigadeiro", "4 leites"],
  obsTem: ["rosa", "frango"],
  linhas: 4,
  // 100 + 100 + 50 + 2 kg de bolo
  soma: 252,
  fechou: true,
};

const CENARIOS = [
  // ==========================================================================
  //  O MESMO PEDIDO DITO DE CINCO JEITOS.
  //
  //  Ate aqui eu escrevia UM cenario por defeito, entao cada teste provava que
  //  aquele bug especifico nao voltou, e a familia dele continuava aberta. Foi
  //  assim que dez defeitos couberam numa conversa so com setenta testes verdes.
  //
  //  Estes cinco pedem A MESMA COISA e tem que terminar com O MESMO PEDIDO no
  //  banco. Muda so o jeito de falar: tudo de uma vez, picado, tres respostas
  //  na mesma frase, com erro de digitacao, e mudando de ideia no meio.
  //
  //  Se um passar e outro nao, a leitura depende do jeito de falar, e e isso
  //  que nao pode. O gabarito e identico nos cinco de proposito.
  // ==========================================================================
  {
    nome: "cinco jeitos 1: tudo numa mensagem so",
    fala: [
      "boa tarde, quero 100 coxinha e 100 quiche de frango, 50 brigadeiro forminha rosa e um bolo de 2 kg de 4 leites, dia 05/09 as 15h, nome Carla Menezes, pix",
      "isso mesmo, pode confirmar",
    ],
    esperado: MESMO_PEDIDO,
  },
  {
    nome: "cinco jeitos 2: uma coisa por mensagem",
    fala: [
      "boa tarde, queria fazer um pedido",
      "100 coxinha",
      "100 quiche de frango",
      "50 brigadeiro",
      "forminha rosa",
      "um bolo de 2 kg de 4 leites",
      "dia 05/09",
      "as 15h",
      "nome Carla Menezes",
      "pix",
      "isso mesmo, pode confirmar",
    ],
    esperado: MESMO_PEDIDO,
  },
  {
    nome: "cinco jeitos 3: tres respostas na mesma frase",
    fala: [
      "boa tarde, quero 100 coxinha e 100 quiche de frango",
      "50 brigadeiro, forminha rosa, e um bolo de 2 kg de 4 leites",
      "dia 05/09 as 15h, nome Carla Menezes, pix",
      "isso mesmo, pode confirmar",
    ],
    esperado: MESMO_PEDIDO,
  },
  {
    nome: "cinco jeitos 4: com erro de digitacao",
    fala: [
      "boa tarde, quero 100 coxinia e 100 chique de frango",
      "50 brigadero, forminha rosa",
      "um bolo de 2 kg de 4 leites, dia 05/09 as 15h, nome Carla Menezes, pix",
      "isso mesmo, pode confirmar",
    ],
    esperado: MESMO_PEDIDO,
  },
  {
    nome: "cinco jeitos 5: mudando de ideia no meio",
    fala: [
      "boa tarde, quero 200 coxinha e 100 quiche de frango",
      "na verdade muda a coxinha pra 100",
      "50 brigadeiro, forminha rosa",
      "um bolo de 2 kg de 4 leites, dia 05/09 as 15h, nome Carla Menezes, pix",
      "isso mesmo, pode confirmar",
    ],
    esperado: MESMO_PEDIDO,
  },
  {
    // A CONVERSA DE 25/08/2026, QUE QUEBROU EM DEZ LUGARES DE UMA VEZ.
    //
    // Ela tinha 48 mensagens e passou por todas as etapas. Os setenta testes do
    // repositorio estavam verdes e nenhum viu, porque nenhum media uma conversa
    // inteira de festa com troca no meio. Os defeitos:
    //
    //   1. o quiche foi pedido TRES vezes e nunca entrou (a guarda de recheio
    //      recusava o registro e a IA apagava o item pra satisfazer a guarda)
    //   2. sobraram TRES bolos somando 6 kg pra quem pediu 2,5
    //   3. bolo de festa gravado com unidade "un", cobrado por unidade
    //   4. "azul e amarelo" virou "azul": a segunda cor sumia
    //   5. "misto: ..." repetido sete vezes na observacao do cupom
    //
    // Este cenario cobre os cinco de uma vez. Se qualquer um voltar, ele reprova.
    nome: "festa completa com troca no meio nao perde item nem duplica bolo",
    fala: [
      "boa tarde, quero fazer pedido de bolo, doces e salgados pra 25 pessoas",
      "pode ser essa base mesmo",
      "metade quiche de frango e metade coxinha",
      "cafe, churros, brigadeiro e beijinho",
      "forminha azul e amarelo",
      "bolo de 4 leites e strogonoff de nozes, 2,5 kg",
      "na embalagem com tampa, sem topo e sem papel de arroz",
      "dia 02/09 as 14h, nome Ana Prass, cartao",
      // Sem esta fala o pedido fica esperando o cliente e o cenario reprova por
      // "nao registrou", que e o teste faltando um turno, nao a IA errando.
      "isso mesmo, pode confirmar",
    ],
    esperado: {
      itens: ["quiche", "coxinha", "brigadeiro", "beijinho"],
      // Um bolo so, cotado pelo sabor mais caro dos dois.
      obsTem: ["azul e amarelo", "strogonoff"],
      // 4 salgados/docinhos + 1 bolo. Tres bolos aqui e o defeito voltando.
      linhas: 7,
      fechou: true,
    },
  },
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
    // O BOLO DE FESTA SEM LACTOSE: A PADARIA TALVEZ FACA, E POR ISSO E DA EQUIPE.
    //
    // Caso levantado pelo dono em 26/08/2026: "se for por exemplo bolo de
    // brigadeiro + o sem lactose, la eles devem fazer no bolo ne, so fica mais
    // caro".
    //
    // Ele esta certo, e o cardapio confirma: "0% lactose" e sabor de bolo de
    // festa da faixa C, R$ 55,90 o quilo contra R$ 46,90 do brigadeiro.
    //
    // O que este cenario cobra e o meio termo, que e o dificil:
    //
    //   o BOLO fica no pedido, porque e venda de verdade;
    //   a palavra "lactose" NAO fica na observacao, porque a comanda nao pode
    //   mandar a cozinha produzir uma coisa enquanto o resumo promete outra;
    //   e o pedido NAO fecha sozinho, porque quem responde e a equipe.
    nome: "bolo sem lactose vai pra equipe e nao vira promessa",
    fala: [
      "boa tarde, queria um bolo de 2 kg de brigadeiro pra sexta as 16h",
      "ele pode ser sem lactose? minha filha tem intolerancia",
      "nome Aline Ribeiro, pix",
    ],
    esperado: { itens: ["brigadeiro"], proibidos: ["lactose"], linhas: 1, fechou: false },
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
  {
    // O PONTO CEGO QUE EU ADMITI E NAO TINHA FECHADO.
    //
    // O rastro mostrou a Dora chamando anotar_item de pizza OITO vezes numa
    // conversa so, e a guarda recusando as oito, porque o cliente escreve
    // "pizza de forma" e o catalogo diz "pizza inteira". Toda venda de pizza
    // estava morta e o medidor dava nota cheia, porque nao tinha cenario de
    // pizza. Medir so o que ja funciona e o jeito mais facil de passar.
    nome: "pizza fecha e nao e recusada",
    fala: [
      "boa tarde, voces fazem pizza de forma?",
      "quero 2 de calabresa pra sexta as 19h",
      "nome Rodrigo Zanella, pix",
    ],
    esperado: { itens: ["pizza"], linhas: 1, fechou: true },
  },
  {
    // A secretaria pediu ASSADOS e recebeu "40 mini bolha, que e o pastel
    // frito da casa". Quem pede assado tem motivo, e frito e outra coisa.
    nome: "quem pede assado nao recebe frito",
    fala: [
      "bom dia, preciso de 200 salgados assados pra quarta as 9h",
      "pode escolher voce os tipos, confio",
      "isso mesmo, nome Juliana Reis, boleto faturado",
    ],
    esperado: {
      itens: ["esfirra"],
      proibidos: ["coxinha", "mini bolha", "risolis", "bolinha", "croquete"],
      soma: 200,
    },
  },
  {
    // Ponto exato em que a secretaria desistiu: mandou baixar de 200 pra 150 e
    // a Dora pediu licenca tres vezes. O gabarito aqui e um numero: se o banco
    // ainda mostra 200, ela conversou e nao fez.
    nome: "mudar o total nao vira negociacao",
    fala: [
      "quero 200 salgados fritos pra sexta as 18h, pode escolher os tipos",
      "pode ser assim sim",
      "na verdade muda pra 150 salgados",
      "nome Marcia Fontana, pix",
    ],
    esperado: { soma: 150, proibidos: ["esfirra", "empadinha", "quiche"] },
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
    "select coalesce(x.qtd,0) || '~' || coalesce(x.produto,'') || '~' || coalesce(x.obs,'') from docepao.pedido_montagem pm " +
      "join docepao.clientes c on c.id=pm.cliente_id, jsonb_to_recordset(pm.itens) as x(produto text, qtd numeric, obs text) " +
      "where c.telefone='" + fone + "'",
  ).catch(() => "");
  const doPedido = await psql(
    "select coalesce(i.qtd,0) || '~' || coalesce(i.produto,'') || '~' || coalesce(i.obs,'') from docepao.pedido_itens i " +
      "join docepao.pedidos p on p.id=i.pedido_id join docepao.clientes c on c.id=p.cliente_id " +
      "where c.telefone='" + fone + "'",
  ).catch(() => "");
  const limpar = (t) => String(t).split("\n").map((l) => l.trim()).filter(Boolean);
  const doPed = limpar(doPedido);
  // Fechou? Entao o pedido e a verdade. Nao fechou? A montagem e o que existe.
  const linhas = doPed.length ? doPed : limpar(deMontagem);
  const fechou = doPed.length > 0;
  // A SOMA DAS QUANTIDADES E O UNICO JEITO DE JULGAR UMA MUDANCA DE TOTAL.
  //
  // Sem ela, o cenario da reducao de 200 pra 150 passava com 200 no banco: o
  // medidor via as linhas certas e nao via que o numero nao mudou. Medidor que
  // nao enxerga o defeito e pior que medidor nenhum, porque da alta.
  const soma = linhas.reduce((s, l) => s + (Number(String(l).split("~")[0]) || 0), 0);
  return { linhas, fechou, soma };
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
  if (e.soma != null && estado.soma !== e.soma) {
    motivos.push("esperava somar " + e.soma + " unidade(s), somou " + estado.soma);
  }
  if (e.fechou === true && !estado.fechou) motivos.push("nao registrou o pedido");
  if (e.fechou === false && estado.fechou) motivos.push("registrou pedido de quem so perguntou");

  return motivos;
}

async function main() {
  console.log("MEDIDOR: " + alvos.length + " cenario(s), " + REPETICOES + " execucao(oes) cada.");
  console.log("O gabarito e o ESTADO DO BANCO, nao o texto da conversa.");
  console.log("");

  // A FAIXA DO MEDIDOR E LIMPA ANTES, E SO ELA.
  //
  // Os telefones sao os mesmos a cada rodada (5511977770001 em diante). Sem
  // limpar, a segunda medicao lia o pedido da PRIMEIRA: o cenario "aparecia"
  // aprovado com o resultado de uma hora atras, e a conversa nova entrava por
  // cima de um historico que ela nao teve. Numero de medidor mentiroso e pior
  // que nao medir, porque a gente para de procurar.
  //
  // O recorte e proposital e literal: so telefone que comeca com 55119777700.
  // Em 19/08/2026 um teste apagou o banco inteiro no meio de uma medicao e
  // levou junto o pedido de impressao que estava sendo usado pra outra coisa.
  // Limpeza de teste mexe no que o teste criou, e em mais nada.
  const FAIXA = "55119777700%";
  console.log("limpando a faixa do medidor (" + FAIXA + ")...");
  for (const sql of [
    "delete from docepao.pedido_itens i using docepao.pedidos p, docepao.clientes c " +
      "where i.pedido_id=p.id and p.cliente_id=c.id and c.telefone like '" + FAIXA + "'",
    "delete from docepao.pedidos p using docepao.clientes c " +
      "where p.cliente_id=c.id and c.telefone like '" + FAIXA + "'",
    "delete from docepao.pedido_montagem m using docepao.clientes c " +
      "where m.cliente_id=c.id and c.telefone like '" + FAIXA + "'",
    "delete from docepao.mensagens m using docepao.clientes c " +
      "where m.cliente_id=c.id and c.telefone like '" + FAIXA + "'",
    "delete from docepao.clientes where telefone like '" + FAIXA + "'",
  ]) {
    await psql(sql).catch((e) => console.log("  (aviso) " + String(e).slice(0, 80)));
  }
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

  // AS CONVERSAS FICAM GUARDADAS, NAO SO A NOTA.
  //
  // Este medidor julga pelo ESTADO DO BANCO, que e o que impede texto bonito
  // com pedido errado de passar. So que o contrario tambem existe: pedido certo
  // no fim de um atendimento que faria qualquer pessoa desistir no meio. Foi
  // lendo conversa que apareceram dez defeitos em 20/08/2026, todos invisiveis
  // pra nota.
  //
  // O medidor LIMPA a faixa dele antes de comecar. Rodar de novo apagava as
  // conversas da rodada anterior, e eu perdi as 40 conversas de uma medicao
  // inteira justamente quando fui ler. Agora elas saem pra arquivo antes disso
  // poder acontecer.
  try {
    const linhas = await psql(
      "select c.telefone || ' | ' || m.papel || ' >> ' || replace(coalesce(m.conteudo,''), chr(10), ' ') " +
      "from docepao.mensagens m join docepao.clientes c on c.id=m.cliente_id " +
      "where c.telefone like '" + FAIXA + "' order by c.telefone, m.criado_em",
    );
    const fs = require("node:fs");
    const arquivo = "conversas-da-medicao.txt";
    fs.writeFileSync(arquivo, String(linhas));
    console.log("");
    console.log("As conversas desta rodada ficaram em " + arquivo + ".");
    console.log("Leia como CLIENTE: o pedido certo no banco nao prova que alguem compraria.");
  } catch (e) {
    console.log("(nao consegui salvar as conversas: " + String(e).slice(0, 80) + ")");
  }
  // Nao derruba o build: este medidor gasta minutos e mensagem de verdade, e
  // serve pra decidir, nao pra travar commit. Quem trava commit e o todos.cjs.
  process.exit(0);
}

main().catch((e) => {
  console.error("erro no medidor:", e.message);
  process.exit(1);
});
