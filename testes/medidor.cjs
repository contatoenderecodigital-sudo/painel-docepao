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
const CENARIOS = [
  {
    nome: "troca de bolo nao duplica",
    fala: [
      "boa tarde, quero um bolo de 2 kg de prestigio pra festa dia 12/09",
      "pao de lo branco",
      "na verdade muda pra 4 leites",
      "as 16h, nome Patricia Bonfanti, pix",
    ],
    esperado: { itens: ["4 leites"], proibidos: ["prestigio"], linhas: 1, fechou: true },
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
    esperado: { itens: ["brigadeiro"], proibidos: ["lactose", "vegano"], linhas: 1, fechou: true },
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
    esperado: { itens: ["brigadeiro"], linhas: 1, obsTem: ["rosa"], fechou: true },
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
      fechou: true,
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
    esperado: { soma: 150, proibidos: ["esfirra", "empadinha", "quiche"], fechou: true },
  },
  {
    // A CONVERSA DO PRINT DE 21/08, com o cliente de verdade.
    //
    //   Dora:    "Quais e quantos voce quer de coxinha, empadinha e mini bolha?"
    //   cliente: "50 de cada"                            -> 150 salgados
    //   Dora:    "Anotei 50 empadinhas e 50 mini bolhas." -> 100 salgados
    //
    // A coxinha sumiu. Nenhuma guarda a barrou: o modelo chamou anotar_item uma
    // vez em vez de tres, e nada no sistema era capaz de perceber. Sao 50
    // salgados nao faturados e uma festa com comida faltando, descoberto no dia
    // da retirada. Os tres produtos vem na fala DELE pra soma ser deterministica.
    nome: "de cada vale pra todos, nao so pros que tem sabor",
    fala: [
      "boa tarde, quero coxinha, empadinha e mini bolha pra uma festa de 15 pessoas dia 10/10",
      "50 de cada",
      "eu quero o bolha de carne e a empadinha de frango",
      "as 16h, nome Ana Beatriz Rocha, pix",
    ],
    esperado: { itens: ["coxinha", "empadinha", "bolha"], soma: 150, linhas: 3, fechou: true },
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
  // A DATA E O TOTAL TAMBEM SAO O ESTADO DO BANCO.
  //
  // Em 22/08/2026 o medidor deu 9 de 9 enquanto TODO pedido com data escrita em
  // numero ia pro banco no ano errado (12/09/2026 virava 2012-09-26), caia no
  // passado e sumia de Aprovacao e de Pedidos do dia. O cliente recebia "ja
  // passei pra nossa equipe" de um pedido que a padaria nunca ia ver.
  //
  // O medidor nao viu porque nunca leu a data. Ele conferia item, quantidade,
  // soma e fechamento — e o pedido EXISTIA, com os itens certos. Nota alta com
  // defeito grave e o pior resultado possivel: da alta em quem esta doente.
  //
  // O total em centavos entra pelo mesmo motivo: a soma das QUANTIDADES nao
  // pega item cobrado a mais. Na medicao do mesmo dia um pedido fechou com
  // R$ 197,25 de item que a cliente nunca pediu, e a soma das quantidades nao
  // acusou nada.
  const cab = await psql(
    "select coalesce(p.retirada_data::text,'') || '~' || coalesce(p.total_centavos,0) " +
      "from docepao.pedidos p join docepao.clientes c on c.id=p.cliente_id " +
      "where c.telefone='" + fone + "' order by p.criado_em desc limit 1",
  ).catch(() => "");
  const primeira = limpar(cab)[0] ?? "";
  const dataDoBanco = String(primeira.split("~")[0] ?? "").slice(0, 10);
  const totalCentavos = Number(String(primeira.split("~")[1] ?? "0")) || 0;
  return { linhas, fechou, soma, dataDoBanco, totalCentavos };
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

  // A DATA DO BANCO E A DATA QUE O CLIENTE FALOU.
  //
  // Sem esta linha o medidor deu 9 de 9 enquanto todo pedido com data escrita em
  // numero ia pro banco no ano errado e sumia da fila da padaria.
  if (e.data != null && estado.dataDoBanco !== e.data) {
    motivos.push("a data no banco e " + (estado.dataDoBanco || "(vazia)") + ", devia ser " + e.data);
  }
  // O DINHEIRO. A soma das QUANTIDADES nao pega item cobrado a mais: um pedido
  // fechou com R$ 197,25 de coisa que a cliente nunca pediu e a soma nao acusou.
  if (e.totalCentavos != null && estado.totalCentavos !== e.totalCentavos) {
    const brl = (c) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
    motivos.push("o total e " + brl(estado.totalCentavos) + ", devia ser " + brl(e.totalCentavos));
  }
  // ITEM QUE NINGUEM PEDIU. `proibidos` e uma lista escrita a mao, entao so pega
  // o que alguem lembrou de proibir. `soIsso` vira o contrario: nada alem desta
  // lista pode estar no pedido. Foi assim que 80 salgados entraram sozinhos.
  if (Array.isArray(e.soIsso)) {
    for (const linha of estado.linhas) {
      const produto = semAc(String(linha).split("~")[1] ?? "");
      if (!produto) continue;
      if (!e.soIsso.some((ok) => produto.includes(semAc(ok)) || semAc(ok).includes(produto))) {
        motivos.push("entrou item que ninguem pediu: " + String(linha).split("~")[1]);
      }
    }
  }

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
