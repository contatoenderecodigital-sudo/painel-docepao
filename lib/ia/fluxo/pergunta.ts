// ============================================================================
//  A PERGUNTA DA ETAPA
//
//  Dada a etapa da vez e o que ja foi combinado, monta o que a padaria vai
//  dizer: o texto, os botoes e o cardapio que vai junto.
//
//  QUEM ESCREVE O NUMERO E O CODIGO, NUNCA A IA.
//
//  Na versao antiga a IA escrevia o valor e o codigo corria atras conferindo.
//  Ela chegou a responder "R$ 44,90 o quilo" pra uma torta de R$ 36,90, e a
//  guarda de preco inventado nasceu disso. Aqui o numero sai do motor de preco
//  (orcamento.ts), o mesmo que faz a conta do pedido: se o motor errar, erram
//  os dois juntos, e nao ha divergencia possivel entre o que ela fala e o que
//  a padaria cobra.
//
//  A IA entra depois, e so pra reescrever com o jeito dela de falar. O numero
//  ja esta fechado quando chega nela.
// ============================================================================

import catalogo from "../dados/catalogo.json";
import { brl, motorPadrao } from "../orcamento";
import type { Etapa, PedidoEmMontagem } from "./etapas";
import { saudacaoDaHora, prazoDoTopoAperta } from "./falas-do-cliente";
import { saboresQueFaltam, saboresAlemDoLimite, coresDoCardapio } from "./sabor";
import { ehNomeDeFamilia, perguntaDaFamilia, opcoesDaFamilia } from "./generico";
import { paraOMotor } from "./cotar";

export type Fala = {
  /** O que a padaria diz. Uma pergunta so, sempre. */
  texto: string;
  /** Botoes de resposta: ate tres, 20 caracteres cada (limite da Meta). */
  botoes: { id: string; titulo: string }[];
  /** Peca de cardapio que vai junto, quando a etapa pede escolha. */
  cardapio: string | null;
  /**
   * A IA pode reescrever este texto com o jeito dela?
   *
   * Onde tem numero, NAO pode: e o unico jeito de garantir que o valor que o
   * cliente le e o valor que a padaria cobra.
   */
  podeReescrever: boolean;
  /**
   * AS RESPOSTAS QUE ESTA PERGUNTA ACEITA, quando ela e de escolha fechada.
   *
   * Serve pra insistir melhor: se o cliente respondeu uma coisa que nao esta na
   * lista, a segunda pergunta mostra a lista em vez de repetir a primeira
   * palavra por palavra. Foi o que faltou no teste da Kemilly, com o tema
   * perguntado tres vezes iguais.
   */
  opcoes?: string[];
};

/**
 * A BASE DA FESTA, ESCRITA COM OS NUMEROS DO MOTOR.
 *
 * "Pra 20 pessoas, uma base boa e 200 salgados no total, 100 docinhos e 2 kg de
 * bolo. Da R$ 418,80 no total."
 */
function falaDaBase(p: PedidoEmMontagem): string {
  const b = p.base;
  if (!b) return "Quantas pessoas vão na festa?";
  const kg = String(b.boloKg).replace(".", ",");
  return (
    "Pra " + p.pessoas + " pessoas, uma base boa é " + b.salgados + " salgados no total, " +
    b.docinhos + " docinhos e " + kg + " kg de bolo." + "\n\n" +
    "Dá " + brl(b.totalCentavos / 100) + " no total, e dá pra ajustar o que você quiser."
  );
}

/**
 * O QUE FALTA NOS DADOS, UMA COISA POR VEZ.
 *
 * Perguntar nome, dia, hora e pagamento na mesma frase e formulario, e ja fez
 * cliente responder so a primeira e ignorar o resto. A ordem aqui e a que
 * importa pra padaria: sem dia e hora ela nem sabe se consegue fazer.
 */
function falaDosDados(p: PedidoEmMontagem): { texto: string; botoes: Fala["botoes"] } {
  const d = p.dados;
  if (!d.data) return { texto: "Pra que dia você quer retirar?", botoes: [] };
  if (!d.hora) return { texto: "Que horas você vai buscar?", botoes: [] };
  if (!d.nome) return { texto: "O pedido fica no nome de quem?", botoes: [] };
  return {
    texto: "Como você prefere pagar?",
    botoes: [
      { id: "pag_pix", titulo: "Pix" },
      { id: "pag_cartao", titulo: "Cartão" },
      { id: "pag_dinheiro", titulo: "Dinheiro" },
    ],
  };
}

/** O resumo que vai antes de confirmar: item por item, com a conta fechada. */
/**
 * TOPO E PAPEL DE ARROZ, UMA PERGUNTA DE CADA VEZ.
 *
 * O WhatsApp so deixa mandar tres botoes por mensagem, e as opcoes de verdade
 * sao quatro: os dois, so o topo, so o papel, nenhum. O dono escolheu resolver
 * com duas perguntas de sim e nao em vez de uma lista de quatro linhas, porque
 * a lista esconde as opcoes atras de um toque e ele conhece a clientela.
 *
 * Duas perguntas cobrem as quatro combinacoes e deixam tudo visivel na tela.
 *
 * O TEMA, O NOME E A IDADE
 *
 * Sempre que houver topo OU papel de arroz, porque as duas pecas sao fabricadas
 * com o tema, o nome e o numero. Era so o topo ate 23/08/2026, e no teste do
 * dono o papel de arroz passou sem nada: nem tema, nem nome, nem idade.
 *
 * A pergunta do nome e da idade sai numa frase so, que e como uma atendente
 * perguntaria, e o CODIGO confere se vieram os dois. Se faltar um, ele cobra o
 * que faltou.
 *
 * Foi o medo do dono que desenhou isso: "numa pergunta so e mais real, mas meu
 * medo e ela errar". Perguntar junto e cobrar no codigo resolve os dois lados.
 */
/**
 * QUEM MANDOU TUDO NUMA MENSAGEM SÓ OUVE UMA PERGUNTA SÓ.
 *
 * Os três detalhes do bolo (prato, papel de arroz e topo) são perguntas
 * separadas de propósito, com botão em cada, porque a clientela da padaria
 * enxerga melhor o botão na tela. Decisão do dono em 23/08/2026.
 *
 * Mas isso custa três turnos, e para quem escreveu o pedido inteiro numa
 * mensagem os três viram interrogatório. Medido em 26/08/2026: o cliente que
 * mandou item, data, hora, nome e pagamento de uma vez levava quatro mensagens
 * para fechar, respondendo uma pergunta de cada vez.
 *
 * Decisão do dono, no mesmo dia: *"somente nesse caso faz a opção junta as três
 * numa pergunta só"*. E ele está certo pelo motivo certo: quem escreve em bloco
 * está mostrando que não quer pingue-pongue, e quem responde picado já está no
 * ritmo de troca curta, onde o botão ajuda.
 *
 * O sinal é o mesmo `jaTemOsDados` que existia antes, usado ao contrário: ele
 * pulava as perguntas, e agora junta. Perde o botão nesse caminho, e vale a
 * troca: o leitor da frase entende as três respostas escritas de uma vez, o que
 * está medido em `testes/pergunta-uma-vez-e-nao-repete.cjs`.
 */
/**
 * A PEÇA DE CARDÁPIO DESTE PRODUTO, quando a lista de sabor é longa demais
 * para caber numa frase.
 *
 * As peças são as que existem em `public/cardapios/`. Só as famílias com lista
 * longa precisam disso: quem tem dois ou três sabores cabe no texto, e ler a
 * resposta escrita é mais rápido para o cliente do que abrir uma imagem.
 */
function pecaDoCardapio(produto: string): string | null {
  const t = String(produto || "").toLowerCase();
  if (t.startsWith("pizza") || t.startsWith("calzone")) return "pizza";
  if (t.startsWith("cupcake") || t.startsWith("franciscano")) return "cupcakes-franciscano";
  if (t.startsWith("torta") || t.startsWith("empadao") || t.startsWith("empadão")) return "tortas-empadao";
  if (t.startsWith("cuca")) return "cucas-paes";
  return null;
}

function pediuTudoDeUmaVez(p: PedidoEmMontagem): boolean {
  return Boolean(p.dados?.data && p.dados?.hora && p.dados?.nome && p.dados?.pagamento);
}

/** Os três detalhes do bolo numa pergunta só, para quem já mandou o resto. */
function falaDosTresDetalhes(p: PedidoEmMontagem): Fala | null {
  if (!pediuTudoDeUmaVez(p)) return null;

  const falta: string[] = [];
  if (p.prato === null) falta.push("o bolo vai no prato de MDF aberto ou na embalagem com tampa");
  if ((p.pecas?.papelDeArroz ?? null) === null) {
    // O valor sai do motor, nunca escrito à mão: é o mesmo número do cardápio.
    const cot = motorPadrao.cotarPorItens([{ item: "papel de arroz", qtd: 1 }]);
    const preco = Number(cot.linhas?.[0]?.subtotal ?? 0);
    falta.push("quer papel de arroz com a foto impressa" + (preco > 0 ? " (" + brl(preco) + ")" : ""));
  }
  if ((p.pecas?.topo ?? null) === null) falta.push("e quer topo de bolo");

  // Um só faltando não precisa de pergunta juntada: a pergunta normal, com
  // botão, é melhor.
  if (falta.length < 2) return null;

  return {
    texto: "Só faltam os detalhes do bolo: " + falta.join(", ") + "?",
    botoes: [],
    cardapio: null,
    // Tem valor de tabela dentro, então a IA não reescreve.
    podeReescrever: false,
  };
}

function falaDasPecas(p: PedidoEmMontagem): Fala {
  // A pergunta juntada vem primeiro, e só existe pra quem mandou tudo de uma vez.
  const juntas = falaDosTresDetalhes(p);
  if (juntas) return juntas;

  const topo = p.pecas?.topo ?? null;
  const papel = p.pecas?.papelDeArroz ?? null;

  // PAPEL DE ARROZ ANTES DO TOPO.
  //
  // Ordem do fluxograma que a Kemilly desenhou, confirmada pelo dono em
  // 26/08/2026. Antes o topo vinha primeiro. As duas continuam sendo perguntas
  // separadas, que foi a decisao do dono em 23/08: a lista de quatro opcoes
  // esconde as escolhas atras de um toque, e a clientela da padaria enxerga
  // melhor o botao na tela.

  if (papel === null) {
    // O VALOR SAI DO MOTOR, NAO DA MINHA MEMORIA.
    //
    // Papel de arroz e o unico adicional do bolo com preco de tabela. Escrever
    // "R$ 12" aqui na mao seria mais um numero pra divergir do cardapio no dia
    // em que a dona mudar. Por ter valor, esta fala nao passa pela reescrita.
    const cot = motorPadrao.cotarPorItens([{ item: "papel de arroz", qtd: 1 }]);
    const preco = Number(cot.linhas?.[0]?.subtotal ?? 0);
    return {
      texto:
        "E papel de arroz, com a foto impressa no bolo?" +
        (preco > 0 ? " Fica " + brl(preco) + "." : ""),
      botoes: [
        { id: "papel_sim", titulo: "Sim" },
        { id: "papel_nao", titulo: "Não" },
      ],
      cardapio: null,
      podeReescrever: preco <= 0,
    };
  }

  if (topo === null) {
    return {
      texto: "O bolo vai com topo?",
      botoes: [
        { id: "topo_sim", titulo: "Sim" },
        { id: "topo_nao", titulo: "Não" },
      ],
      cardapio: null,
      podeReescrever: true,
    };
  }

  // O TEMA, E A FOTO DE REFERENCIA.
  //
  // Vale pras duas pecas: topo e papel de arroz sao fabricados com o tema. No
  // teste de 23/08/2026 o cliente escreveu "pode ser da miney" por conta
  // propria, ninguem tinha perguntado, e o tema sumiu do pedido.
  //
  // A foto e pedida junto porque o sistema ja sabe guardar imagem no pedido, e
  // porque tema escrito ("minnie rosa") e tema visto sao coisas diferentes na
  // hora de fabricar.
  if ((topo === true || papel === true) && !p.tema) {
    const oQue = topo === true && papel === true ? "o topo e o papel de arroz" : topo === true ? "o topo" : "o papel de arroz";
    return {
      texto:
        "Qual vai ser o tema d" + (oQue.startsWith("o topo e") ? "essas peças" : "esse " + oQue.replace("o ", "")) +
        "? Se você quiser, me manda uma imagem pra gente fazer parecido.",
      botoes: [],
      cardapio: null,
      podeReescrever: true,
    };
  }

  // O QUE VAI ESCRITO NA PECA, SE ELE QUISER ALGO ESCRITO.
  //
  // Regra do dono, 24/08/2026: "a informacao que voce precisa coletar e o tema e
  // o que o cliente quer escrito no topo, ISSO SE ELE QUISER algo escrito".
  //
  // Tem topo que e so o desenho. Antes a padaria exigia nome E idade e nao
  // aceitava "nada", entao quem so queria o desenho ficava presos na pergunta.
  //
  // E a pergunta fala da PECA QUE ELE PEDIU: no teste da Kemilly ela respondeu
  // nao pro topo, sim pro papel de arroz, e levou "qual nome e idade vao no
  // TOPO?".
  if ((topo === true || papel === true) && !p.escrito && (!p.topoNome || !p.topoIdade)) {
    const peca = topo === true && papel === true ? "nas peças" : topo === true ? "no topo" : "no papel de arroz";
    return {
      texto:
        "O que você quer escrito " + peca + "? Pode ser o nome e a idade, uma frase, " +
        "ou nada se for só o desenho.",
      botoes: [],
      cardapio: null,
      podeReescrever: true,
    };
  }

  // Tudo respondido: quem escolhe a proxima etapa e a lista, nao esta fala.
  return { texto: "", botoes: [], cardapio: null, podeReescrever: true };
}

/**
 * ALGUM ITEM DESTA FAMILIA ESTA SEM O RECHEIO ESCOLHIDO?
 *
 * "2 kg de empadao" sem dizer se e de frango ou de palmito para a cozinha no
 * meio da manha, e alguem tem que ligar pro cliente. A pergunta sai com as
 * opcoes do proprio cardapio, entao ela nunca oferece o que a casa nao faz.
 */
function perguntaDoSabor(p: PedidoEmMontagem, familia: string): Fala | null {
  const falta = saboresQueFaltam(p.itens.filter((i) => String(i.categoria || "").startsWith(familia)));
  if (!falta.length) return null;
  const f = falta[0];
  return {
    texto: "O " + f.produto + " vai de quê? Tem " + f.opcoes.join(", ") + ".",
    botoes: [],
    cardapio: null,
    podeReescrever: true,
    opcoes: f.opcoes,
  };
}

/**
 * OS DOCINHOS, E A COR DA FORMINHA.
 *
 * Audio da dona, 29/07/2026: "na hora que a pessoa escolher docinho, a gente
 * SEMPRE pergunta a cor da forminha que ela quer: voce quer rosa, azul, marrom,
 * tem uma cor da tua preferencia?".
 *
 * A cor vai na comanda dos docinhos, porque ela monta a forminha antes de
 * rechear: se a cor chega depois, a producao ja comecou errada.
 *
 * SEM BOTAO, DE PROPOSITO. Sao 21 cores no cardapio e o WhatsApp so deixa
 * mandar tres botoes. Escolher tres seria escolher pelo cliente, entao a lista
 * vai escrita e ele responde o que quiser. Decisao do dono em 23/08/2026.
 */
function falaDoDocinho(p: PedidoEmMontagem, aviso: string): Fala {
  const semSabor = perguntaDoSabor(p, "docinho");
  if (semSabor) return semSabor;

  const temDocinho = p.itens.some((i) => String(i.categoria || "").startsWith("docinho"));

  if (!temDocinho) {
    return {
      texto: aviso + "Agora os docinhos: quais você quer?",
      botoes: [],
      cardapio: "docinhos",
      podeReescrever: true,
    };
  }

  // UMA PERGUNTA SO, PRO PEDIDO INTEIRO.
  //
  // Regra do dono, 24/08/2026: "voce pode aceitar uma ou mais cor e NAO quero
  // que peca o cliente qual cor de forminha usar para X docinho".
  //
  // Eu tinha feito ela cobrar item por item quando faltasse cor ("e o
  // cajuzinho, vai em qual cor?"), e isso vira interrogatorio: a cliente escolhe
  // as cores da festa dela, nao a cor de cada docinho. Todas as cores que ele
  // falar valem pro pedido todo.
  const cores = coresDoCardapio();
  return {
    texto:
      "De que cor você quer a forminha dos docinhos?" +
      (cores.length ? "\n\nTem " + cores.join(", ") + ". Pode escolher mais de uma." : ""),
    botoes: [],
    cardapio: null,
    podeReescrever: true,
    opcoes: cores,
  };
}

/**
 * O BOLO: O SABOR, E COMO ELE VAI EMBALADO.
 *
 * Audio da dona, 29/07/2026: "e interessante perguntar se ela quer no prato em
 * MDF aberto, do jeito que esta na foto, ou se ela quer aquela embalagem
 * tradicional que vai a tampa".
 *
 * Nunca foi perguntado por nenhuma versao do sistema. Aqui vale botao, porque
 * as opcoes sao exatamente duas e a resposta e fechada.
 */
function falaDoBolo(p: PedidoEmMontagem, aviso: string): Fala {
  const temSabor = p.itens.some(
    (i) => String(i.categoria || "").startsWith("bolo") && String(i.produto).trim().toLowerCase() !== "bolo",
  );

  if (!temSabor) {
    // PODE MISTURAR DOIS SABORES, E ELA TEM QUE DIZER ISSO.
    //
    // Esta na nota do cardapio, com as palavras da dona: "bolo misto vale o
    // sabor mais caro". O sistema ja cobrava certo, mas nunca contava pro
    // cliente que dava pra misturar, e quem nao sabe nao pede.
    //
    // Esta fala nao passa pela reescrita: e regra de preco, e reescrita de
    // regra de preco vira promessa errada no balcao.
    return {
      texto:
        aviso +
        "E o bolo, qual sabor?" +
        "\n\nSe quiser, dá pra misturar dois sabores no mesmo bolo. Nesse caso vale o valor do mais caro dos dois.",
      botoes: [],
      cardapio: "bolos-festa",
      podeReescrever: false,
    };
  }

  // Quem mandou tudo numa mensagem ouve os três detalhes juntos, e o prato é um
  // deles. Sem isto, ele levaria a pergunta do prato aqui e a das peças logo
  // depois, que é o interrogatório que a pergunta juntada existe pra evitar.
  const juntas = falaDosTresDetalhes(p);
  if (juntas) return juntas;

  return {
    texto: "O bolo vai no prato de MDF aberto ou na embalagem com tampa?",
    botoes: [
      { id: "prato_aberto", titulo: "Prato aberto" },
      { id: "prato_tampa", titulo: "Com tampa" },
    ],
    cardapio: null,
    podeReescrever: true,
  };
}

/**
 * O QUE ELA DIZ DEPOIS DE REGISTRAR O PEDIDO.
 *
 * Tres situacoes diferentes, e o cliente precisa saber em qual esta:
 *
 *   pedido comum   -> foi pra fila, a equipe confirma
 *   com topo       -> foi pra fila E a equipe ainda vai orcar o topo
 *   topo em cima da hora -> a equipe ainda vai ver se quem fabrica pega
 */
function falaDoFim(p: PedidoEmMontagem): string {
  const base = "Pronto, seu pedido foi pra fila da equipe da padaria. Assim que eles confirmarem, eu te aviso por aqui.";
  if (p.pecas?.topo !== true) return base;

  const aperta = prazoDoTopoAperta(p.dados.data);
  return (
    base +
    "\n\n_O topo entra à parte: a equipe faz o orçamento dele e confirma o valor com você._" +
    (aperta
      ? "\n_Como é " + aperta + ", eles também vão confirmar se dá tempo de fazer._"
      : "")
  );
}

/**
 * O QUE COMBINA COM O QUE ELE JA PEDIU.
 *
 * Ideia do dono, 23/08/2026: quem leva cem salgados pra sabado quase sempre
 * leva docinho junto, e ate hoje ninguem oferecia. E o que a atendente do
 * balcao faz sem pensar.
 *
 * DUAS REGRAS QUE MANTEM ISSO HONESTO
 *
 * So oferece o que ele NAO pediu, e uma vez so. Oferta repetida vira empurra, e
 * padaria de bairro vive de o cliente voltar.
 */
function falaDaOferta(p: PedidoEmMontagem): Fala {
  const tem = (pref: string) => p.itens.some((i) => String(i.categoria || "").startsWith(pref));
  const faltaDocinho = !tem("docinho");
  const faltaBolo = !tem("bolo");

  const botoes: Fala["botoes"] = [];
  if (faltaDocinho) botoes.push({ id: "oferta_docinho", titulo: "Quero docinho" });
  if (faltaBolo) botoes.push({ id: "oferta_bolo", titulo: "Quero bolo" });
  botoes.push({ id: "oferta_nao", titulo: "Só isso" });

  const oQue =
    faltaDocinho && faltaBolo ? "docinho ou bolo" : faltaDocinho ? "docinho" : "bolo";
  return {
    texto: "Quer levar " + oQue + " junto?",
    botoes,
    cardapio: null,
    podeReescrever: true,
  };
}

function falaDaConfirmacao(p: PedidoEmMontagem, totalCentavos: number): string {
  // CADA LINHA COM O SEU VALOR, IGUAL A COMANDA.
  //
  // Pedido do dono, 23/08/2026: "ja tem que colocar o valor de cada produto do
  // lado de cada um, igual na comanda, quantidade x preco". Ele esta certo:
  // resumo que so mostra o total obriga o cliente a confiar, e cliente que nao
  // consegue conferir liga pra padaria.
  //
  // O valor sai do MOTOR, linha por linha, o mesmo que soma o total e o mesmo
  // que imprime a comanda. Se algum item nao for cotado, a linha sai sem valor
  // em vez de sair com valor inventado.
  //
  // "3 kg de bombom" tambem nao e comida: o sabor do bolo sozinho nao diz que e
  // bolo, e saiu assim no resumo do teste anterior.
  const cot = motorPadrao.cotarPorItens(paraOMotor(p.itens));
  // O MOTOR PODE DEVOLVER A LINHA COM OUTRO NOME.
  //
  // "biz" volta como "bolo biz", porque no cardapio o sabor e do bolo. Casando
  // so pelo nome exato, a linha do bolo saia SEM valor no resumo, e justo a
  // mais cara. Aqui casa por posicao primeiro, que e o jeito certo, e cai pro
  // nome quando o motor pular algum item que ele nao conhece.
  const linhasDoMotor = cot.linhas ?? [];
  const valorDe = (produto: string, posicao: number) => {
    const semAc = (t: string) =>
      String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    if (linhasDoMotor.length === p.itens.length) return linhasDoMotor[posicao];
    const alvo = semAc(produto);
    return linhasDoMotor.find((l) => {
      const nome = semAc(String(l.item));
      return nome === alvo || nome.endsWith(" " + alvo) || nome.startsWith(alvo + " ");
    });
  };

  const linhas = p.itens.map((i, posicao) => {
    const ehBolo = i.categoria.startsWith("bolo");
    const nome = ehBolo && !/bolo/i.test(i.produto) ? "bolo de " + i.produto : i.produto;
    const l = valorDe(i.produto, posicao);
    const quanto = l
      ? "  " + brl(Number(l.unit)) + (l.unidade === "kg" ? "/kg" : " cada") + " = " + brl(Number(l.subtotal))
      : "";
    return (
      "- " + i.qtd + (ehBolo ? " kg de " : " ") + nome + (i.obs ? " (" + i.obs + ")" : "") + quanto
    );
  });
  const d = p.dados;
  return (
    "Fechando o pedido:" + "\n" + linhas.join("\n") + "\n\n" +
    "Retirada " + (d.data ?? "") + (d.hora ? " às " + d.hora : "") + "\n" +
    "No nome de " + (d.nome ?? "") + ", pagamento " + (d.pagamento ?? "") + "\n" +
    "*Total: " + brl(totalCentavos / 100) + "*" +
    // O TOPO NAO ENTRA NO TOTAL, E O CLIENTE PRECISA SABER DISSO ANTES.
    //
    // Ele e o unico item da casa sem preco de tabela: cada peca e fabricada com
    // o tema, o nome e a idade, e quem lanca o valor e a equipe, na tela do
    // painel. Dizer "em torno de R$ 30" e ancora, nao estimativa: o cliente le
    // 30, a equipe lanca 45, e a diferenca vira discussao no balcao com a dona.
    // Uma companhia aerea ja foi obrigada por tribunal a honrar o numero que o
    // robo dela inventou.
    //
    // Entao o resumo avisa que falta o topo, e nao diz quanto.
    (p.pecas?.topo === true
      ? "\n\n_O topo entra à parte: a equipe faz o orçamento dele e confirma com você._"
      : "")
  );
}

/**
 * MONTA A FALA DA ETAPA.
 *
 * Funcao pura: mesma entrada, mesma saida. Nao le banco, nao chama modelo, nao
 * manda mensagem. Por isso o fluxo inteiro se testa de graca.
 */
export function falaDaEtapa(
  etapa: Etapa,
  p: PedidoEmMontagem,
  totalCentavos = 0,
  /**
   * O QUE A PADARIA NAO FAZ, ELA DIZ.
   *
   * Sem isto o fluxo repete a mesma pergunta pra sempre. Aconteceu no teste: o
   * cliente pediu "bolo de ninho", que a Doce Pao nao faz, o codigo barrou
   * certo e a resposta foi de novo "E o bolo, qual sabor?". Quem barra tem que
   * explicar, senao o cliente acha que ela nao entendeu e repete igual.
   */
  naoTemos: string[] = [],
): Fala {
  const aviso = naoTemos.length
    ? "A gente não faz " + naoTemos.join(" nem ") + ". "
    : "";
  switch (etapa.id) {
    case "quantas_pessoas":
      return { texto: "Quantas pessoas vão na festa?", botoes: [], cardapio: null, podeReescrever: true };

    case "base_da_festa":
      return {
        texto: falaDaBase(p),
        botoes: [
          { id: "base_sim", titulo: "Pode ser" },
          { id: "base_ajustar", titulo: "Quero ajustar" },
        ],
        cardapio: null,
        // Tem dinheiro no texto: nao se reescreve.
        podeReescrever: false,
      };

    case "salgado": {
      // O SABOR PRIMEIRO, SE ALGUM ITEM ESTIVER SEM.
      //
      // Risolis e mini bolha sao fritos e pedem recheio; coxinha nao pede. Quem
      // separa os dois e o catalogo, nao uma lista minha.
      const semSabor = perguntaDoSabor(p, "salgado");
      if (semSabor) return semSabor;
      return {
        texto: aviso + "Quais salgados você quer?",
        botoes: [],
        cardapio: "salgados",
        podeReescrever: true,
      };
    }

    case "docinho":
      return falaDoDocinho(p, aviso);

    case "bolo":
      return falaDoBolo(p, aviso);

    case "pecas_do_bolo":
      return falaDasPecas(p);

    case "oferta":
      return falaDaOferta(p);

    case "dados": {
      const d = falaDosDados(p);
      return { texto: d.texto, botoes: d.botoes, cardapio: null, podeReescrever: true };
    }

    case "confirmacao": {
      // O RESUMO NÃO APARECE ENQUANTO FALTA ESCOLHER.
      //
      // Quem chega aqui com um nome de família no pedido ("2 pizzas") não tem
      // resumo pra ver: não dá pra somar o que ele não escolheu. Antes o resumo
      // saía com o produto que o motor tinha alcançado sozinho, e o pedido
      // fechava por R$ 240,00 numa pizza que ninguém pediu.
      //
      // Sem esta pergunta, bloquear no fechamento vira TRAVA: a padaria recusa
      // fechar e não diz o que falta, e o cliente fica olhando o mesmo resumo.
      // O bloqueio sem a pergunta é pior que o defeito.
      const familia = p.itens.find((i) => ehNomeDeFamilia(i.produto));
      if (familia) {
        const pergunta = perguntaDaFamilia(familia.produto);
        if (pergunta) {
          return {
            texto: pergunta,
            botoes: [],
            cardapio: null,
            podeReescrever: true,
            opcoes: opcoesDaFamilia(familia.produto),
          };
        }
      }

      // SABOR A MAIS TAMBÉM PERGUNTA, pelo mesmo motivo do de menos.
      //
      // A pizza de forma vai até 4 sabores, a meia e a redonda até 2. O
      // catálogo diz isso em `sabores_ate` desde sempre, e ninguém lia: uma
      // redonda fechava com CINCO sabores e ia pra uma cozinha que não faz.
      //
      // A trava sozinha seria pior que o defeito. Por isso a padaria devolve os
      // sabores que ELE mesmo falou, pra ele marcar os que cabem, em vez de
      // dizer "escolhe menos" e deixar o cliente rolar a conversa pra lembrar o
      // que tinha pedido.
      const demais = saboresAlemDoLimite(p.itens)[0];
      if (demais) {
        return {
          // SEM ARTIGO NA FRENTE DO PRODUTO.
          //
          // "No pizza redonda" e "a cuca" com "o" na frente sao erros que a
          // clientela ve na hora. O genero do produto nao esta no catalogo e
          // adivinhar pela ultima letra erra em "torta fria" e "franciscano".
          // Comecar a frase pelo nome resolve sem inventar gramatica.
          texto:
            demais.produto.charAt(0).toUpperCase() + demais.produto.slice(1) +
            " vai até " + demais.limite + " sabores, e vieram " + demais.escolhidos.length +
            ". Quais " + demais.limite + " você quer?",
          botoes: [],
          cardapio: null,
          podeReescrever: true,
          opcoes: demais.escolhidos,
        };
      }

      // E O SABOR TAMBÉM, pelo mesmo motivo.
      //
      // O sabor em aberto já bloqueava o fechamento, e SÓ as etapas do salgado e
      // do docinho perguntavam. Quem pede pizza, empadão, torta ou calzone
      // chegava aqui com o sabor faltando, via o resumo, escrevia "pode
      // confirmar" e via o mesmo resumo de novo, para sempre.
      //
      // Medido em 26/08/2026 com uma conversa de pizza: o pedido saía certo em
      // produto e preço (2 kg de pizza redonda, R$ 83,80) e nunca era
      // registrado, porque faltava o sabor e ninguém perguntava.
      const semSabor = saboresQueFaltam(p.itens)[0];
      if (semSabor) {
        // LISTA LONGA VIRA CARDÁPIO, NÃO PAREDE DE TEXTO.
        //
        // A pizza tem 31 sabores. Despejar os 31 numa mensagem de WhatsApp é
        // pior que não responder: ninguém lê, e a peça de cardápio existe
        // exatamente para isso. É o que a padaria já faz nas etapas de família.
        const peca = pecaDoCardapio(semSabor.produto);
        if (semSabor.opcoes.length > 6 && peca) {
          return {
            texto: "O " + semSabor.produto + " vai de quê? Te mandei o cardápio pra escolher.",
            botoes: [],
            cardapio: peca,
            podeReescrever: true,
            opcoes: semSabor.opcoes,
          };
        }
        return {
          texto: "O " + semSabor.produto + " vai de quê? Tem " + semSabor.opcoes.join(", ") + ".",
          botoes: [],
          cardapio: null,
          podeReescrever: true,
          opcoes: semSabor.opcoes,
        };
      }

      return {
        texto: falaDaConfirmacao(p, totalCentavos),
        botoes: [
          { id: "fecha_sim", titulo: "Confirmar" },
          { id: "fecha_mudar", titulo: "Mudar algo" },
        ],
        cardapio: null,
        // O resumo e a conta: nao se reescreve nem uma virgula.
        podeReescrever: false,
      };
    }

    case "registrado":
      return {
        // A ULTIMA FALA MUDA COM O QUE O PEDIDO TEM.
        //
        // Pedido do dono em 23/08/2026: "uma mensagem customizada dependendo da
        // coisa; se for pra confirmacao, avisar que a equipe vai orcar o valor;
        // se for pra aprovacao, avisar que foi pra fila".
        //
        // Sao coisas diferentes de verdade: com topo o cliente ainda nao sabe o
        // valor final, e mandar ele embora achando que sabe e o comeco de uma
        // discussao no balcao.
        texto: falaDoFim(p),
        botoes: [],
        cardapio: null,
        podeReescrever: true,
      };

    case "abertura":
      // A PRIMEIRA FALA DA PADARIA COMECA COM O CUMPRIMENTO. SEMPRE.
      //
      // Regra do dono, em 23/08/2026: "nem boa noite ela me deu, que e o basico
      // de todo atendimento; a primeira fala dela vai ser dizendo bom dia,
      // tarde ou noite e tudo bem".
      //
      // Ele esta certo, e isso nao pode depender de a IA lembrar. A saudacao
      // sai do RELOGIO e vem escrita daqui: quem manda "boa noite" as duas da
      // tarde recebe "boa tarde", que e o certo, e quem nao cumprimentou
      // recebe do mesmo jeito, porque quem atende cumprimenta primeiro.
      // A PRIMEIRA MENSAGEM DA PADARIA.
      //
      // Voltava vazia, e por isso quem mandou "boa noite" recebeu "Quantas
      // pessoas vao na festa?": sem fala propria, o fluxo caia direto na etapa
      // seguinte. Ninguem chega numa padaria e ouve uma pergunta sobre uma
      // festa que ele nao mencionou.
      //
      // Aqui a pergunta e aberta de proposito: quem chega pode querer uma
      // festa, dez paes ou so o preco da torta, e e ele quem diz.
      return {
        texto: saudacaoDaHora() + ", tudo bem? O que você precisa?",
        botoes: [],
        cardapio: null,
        podeReescrever: true,
      };

    default:
      return { texto: "", botoes: [], cardapio: null, podeReescrever: true };
  }
}
