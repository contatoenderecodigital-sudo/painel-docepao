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

import { brl, motorPadrao } from "../orcamento";
import type { Etapa, PedidoEmMontagem } from "./etapas";
import { saudacaoDaHora, prazoDoTopoAperta } from "./falas-do-cliente";
import {
  saboresAlemDoLimite,
  coresDoCardapio,
  faltaCorDaForminha,
  proximoSaborQueFalta,
  ehSalgadoDoCardapio,
} from "./sabor";
import { ehNomeDeFamilia, perguntaDaFamilia, opcoesDaFamilia, nomeDaFamilia, familiaDoNome } from "./generico";
import { paraOMotor } from "./cotar";
import { produtoNoComeco, produtoPorNome } from "../dados/produtos";
import { semAcento, listaEmPortugues } from "../texto";

/**
 * O NOME DO PAPEL DE ARROZ, NUMA LINHA SO.
 *
 * Ele e o unico adicional do bolo com preco de tabela, e o nome estava escrito
 * a mao em DOIS lugares pra pedir o preco ao motor. Se a dona renomear o item
 * no cardapio, os dois param de achar e o preco simplesmente SOME da pergunta,
 * sem erro nenhum: `preco > 0` vira falso e a frase sai sem o valor.
 */
const PAPEL_DE_ARROZ = "papel de arroz";

/** Quanto custa o papel de arroz hoje, pelo motor. Zero quer dizer nao achei. */
function precoDoPapelDeArroz(): number {
  const cot = motorPadrao.cotarPorItens([{ item: PAPEL_DE_ARROZ, qtd: 1 }]);
  return Number(cot.linhas?.[0]?.subtotal ?? 0);
}

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
  /**
   * QUAL PERGUNTA DESTA ETAPA E ESTA.
   *
   * Uma etapa pode ter MAIS DE UMA pergunta: a do bolo pergunta o sabor e
   * depois o prato. A conversa marcava "ja perguntei" pela ETAPA, e a marca da
   * primeira pergunta matava a segunda: o prato nunca era perguntado, e a
   * etapa das pecas, que confiava na mesma marca, morria junto. Bolo de festa
   * fechava sem prato, sem topo e sem papel de arroz, tres coisas que a
   * padaria vende e que a cozinha precisa saber.
   *
   * Medido em duas conversas de verdade em 28/08/2026.
   *
   * Com a chave, a conversa marca `bolo` E `bolo:prato`: quem pergunta pela
   * etapa continua funcionando, e quem precisa saber QUAL pergunta ja saiu tem
   * como perguntar.
   */
  chave?: string;
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
  // A FAMILIA RECUSADA NAO APARECE NA PROPOSTA.
  //
  // A frase listava as tres sempre, com o zero e tudo. Medido numa conversa de
  // verdade em 28/08/2026:
  //
  //   cliente >> nao quero salgadinho, so docinho e bolo
  //   padaria >> uma base boa e 0 SALGADOS NO TOTAL, 100 docinhos e 2 kg de bolo
  //
  // A conta estava certa (R$ 218,80, ja sem os salgados) e o texto devolvia pro
  // cliente a coisa que ele acabou de recusar. Quem le "0 salgados" acha que a
  // padaria nao entendeu, e repete.
  const kg = String(b.boloKg).replace(".", ",");
  const partes = [
    b.salgados > 0 ? b.salgados + " salgados no total" : null,
    b.docinhos > 0 ? b.docinhos + " docinhos" : null,
    b.boloKg > 0 ? kg + " kg de bolo" : null,
  ].filter(Boolean);
  if (!partes.length) return "Me diz o que você quer levar que eu monto a conta.";
  const lista =
    partes.length === 1
      ? partes[0]
      : partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1];
  return (
    "Pra " + p.pessoas + " pessoas, uma base boa é " + lista + "." + String.fromCharCode(10, 10) +
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

/**
 * A PEÇA DE CARDÁPIO DESTE PRODUTO, quando a lista de sabor é longa demais
 * para caber numa frase.
 *
 * As peças são as que existem em `public/cardapios/`. Só as famílias com lista
 * longa precisam disso: quem tem dois ou três sabores cabe no texto, e ler a
 * resposta escrita é mais rápido para o cliente do que abrir uma imagem.
 */
/**
 * A PECA DE CADA GRUPO DA CASA.
 *
 * Isto e fiacao de verdade: os arquivos de `public/cardapios/` sao oito imagens
 * fisicas e nao tem como sair do catalogo. O que da pra fazer, e o que foi
 * feito, e a chave ser o GRUPO que a dona ja usa, e nao um pedaco do nome do
 * produto.
 *
 * A versao anterior comparava o comeco do nome, e por isso:
 *
 *   - precisava de "empadao" E "empadão" como dois casos, porque nao tirava
 *     acento;
 *   - deixava `bolos-caseiros.jpg` sem chamador nenhum;
 *   - nao alcancava o docinho, que tem produto de nove sabores.
 *
 * Grupo que nao esta aqui e grupo cujo cardapio nao existe em imagem, e o teste
 * cobra que todo grupo com produto de mais de seis sabores esteja.
 */
const CARDAPIO_DO_GRUPO: Record<string, string> = {
  "salgado-festa": "salgados",
  "docinho-festa": "docinhos",
  "bolo-festa": "bolos-festa",
  "bolo-caseiro": "bolos-caseiros",
  pizza: "pizza",
  // Calzone e pizza fechada, e mora na mesma peca.
  calzone: "pizza",
  "torta-fria": "tortas-empadao",
  empadao: "tortas-empadao",
  "torta-doce": "tortas-empadao",
  // SEPARADAS EM 30/08/2026 por ordem do dono: cupcake e doce, franciscano e
  // salgado de R$ 12,00; cuca e confeitaria, pao e padaria, salas diferentes.
  cupcake: "cupcakes",
  franciscano: "franciscano",
  pao: "paes",
  cuca: "cucas",
};

export function pecaDoCardapio(produto: string): string | null {
  const p = produtoNoComeco(produto) ?? produtoPorNome(produto);
  if (p) {
    if (CARDAPIO_DO_GRUPO[p.grupo]) return CARDAPIO_DO_GRUPO[p.grupo];
    if (String(p.categoria).startsWith("salgado")) return "salgados";
    if (String(p.categoria).startsWith("docinho")) return "docinhos";
    return null;
  }
  return familiaDoNome(produto) === "pizza" || nomeDaFamilia(produto) === "pizza" ? "pizza" : null;
}

function falaSeTemFamilia(p: PedidoEmMontagem, aviso = ""): Fala | null {
  const familia = p.itens.find((i) => ehNomeDeFamilia(i.produto));
  if (!familia) return null;
  const pergunta = perguntaDaFamilia(familia.produto);
  if (!pergunta) return null;
  const peca = pecaDoCardapio(familia.produto);
  return {
    texto: aviso + pergunta + (peca ? " Te mandei o cardápio pra escolher." : ""),
    botoes: [],
    cardapio: peca,
    podeReescrever: true,
    opcoes: opcoesDaFamilia(familia.produto),
  };
}

function falaSeTemPizza(p: PedidoEmMontagem, aviso = ""): Fala | null {
  const tem = p.itens.some((i) => {
    if (ehSalgadoDoCardapio(i.produto, i.categoria)) return false;
    return nomeDaFamilia(i.produto) === "pizza" || familiaDoNome(i.produto) === "pizza";
  });
  if (!tem) return null;
  return falaSeTemFamilia(p, aviso);
}

function pediuTudoDeUmaVez(p: PedidoEmMontagem): boolean {
  return Boolean(p.dados?.data && p.dados?.hora && p.dados?.nome && p.dados?.pagamento);
}

/**
 * QUEM MANDOU TUDO NUMA MENSAGEM SÓ OUVE UMA PERGUNTA SÓ.
 *
 * Os detalhes do bolo (papel de arroz e topo) são perguntas separadas de
 * propósito, com botão em cada, porque a clientela da padaria enxerga melhor o
 * botão na tela. Decisão do dono em 23/08/2026.
 *
 * ERAM TRÊS ATÉ 28/08/2026: o prato saiu, por decisão do dono, depois de uma
 * conversa medida em que o cliente ignorou as três e o pedido fechou com o
 * prato em branco. A leitura do prato ficou: se ele falar por conta, anota.
 *
 * Mas isso custa turnos, e para quem escreveu o pedido inteiro numa mensagem
 * viram interrogatório. Medido em 26/08/2026: o cliente que mandou item, data,
 * hora, nome e pagamento de uma vez levava quatro mensagens para fechar,
 * respondendo uma pergunta de cada vez.
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
function falaDosDetalhesDoBolo(
  p: PedidoEmMontagem,
  faltaPapel: boolean,
  faltaTopo: boolean,
): Fala | null {
  if (!pediuTudoDeUmaVez(p)) return null;

  // O QUE FALTA E O MESMO CALCULO DA PERGUNTA SEPARADA (28/08/2026).
  //
  // Antes esta funcao olhava so `=== null`, e a separada olhava tambem as
  // marcas. Duas contas do mesmo assunto divergiram na primeira conversa em que
  // o cliente ignorou o papel de arroz: a marca `pecas_do_bolo:papel` ja estava
  // gravada, a separada respeitava e ia pro topo, mas a JUNTADA voltava, via os
  // dois campos vazios e perguntava o papel DE NOVO. Medido contra a producao.
  //
  // Agora quem sabe o que falta e uma so, e ela manda nas duas.
  const falta: string[] = [];
  if (faltaPapel) {
    // O valor sai do motor, nunca escrito à mão: é o mesmo número do cardápio.
    const preco = precoDoPapelDeArroz();
    falta.push("quer papel de arroz com a foto impressa" + (preco > 0 ? " (" + brl(preco) + ")" : ""));
  }
  if (faltaTopo) falta.push("e quer topo de bolo");

  // Um só faltando não precisa de pergunta juntada: a pergunta normal, com
  // botão, é melhor.
  if (falta.length < 2) return null;

  return {
    texto: "Só faltam os detalhes do bolo: " + falta.join(", ") + "?",
    botoes: [],
    cardapio: null,
    // Tem valor de tabela dentro, então a IA não reescreve.
    podeReescrever: false,
    // Esta cobre as TRES de uma vez: quem responde aqui não é perguntado de
    // novo, nem do prato nem das peças.
    chave: "tres",
  };
}

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
function falaDasPecas(p: PedidoEmMontagem): Fala {
  // PERGUNTA IGNORADA NAO SE REPETE: ELA DA LUGAR A PROXIMA.
  //
  // A regra do dono e "se ele ignorou, segue". Seguir quer dizer ir pra
  // PROXIMA pergunta, e nao repetir a mesma: ele ignorou o papel de arroz, e o
  // topo ele ainda nem ouviu.
  //
  // Sem isto, dar chave pra cada pergunta desta etapa deixava a fala presa no
  // papel pra sempre, que e o beco de 25/08/2026 por outra porta. Medido aqui
  // mesmo, em 28/08/2026, antes de ir pro ar.
  //
  // E a pergunta JUNTADA vale pelas duas: ela pergunta o papel e o topo na
  // mesma frase, entao quem a ouviu ja ouviu as duas.
  const jaPerguntou = (chave: string) => {
    const marcas = p.etapasJaPerguntadas ?? [];
    return marcas.includes("pecas_do_bolo:" + chave) || marcas.includes("pecas_do_bolo:tres");
  };

  const topo = p.pecas?.topo ?? null;
  const papel = p.pecas?.papelDeArroz ?? null;
  const faltaPapel = papel === null && !jaPerguntou("papel");
  const faltaTopo = topo === null && !jaPerguntou("topo");

  // A pergunta juntada só existe pra quem mandou tudo de uma vez, e ela lê o
  // MESMO `falta` daqui: se uma das duas já foi perguntada, ela sai de cena e
  // deixa a separada cobrar só o que sobrou.
  const juntas = falaDosDetalhesDoBolo(p, faltaPapel, faltaTopo);
  if (juntas) return juntas;

  // PAPEL DE ARROZ ANTES DO TOPO.
  //
  // Ordem do fluxograma que a Kemilly desenhou, confirmada pelo dono em
  // 26/08/2026. Antes o topo vinha primeiro. As duas continuam sendo perguntas
  // separadas, que foi a decisao do dono em 23/08: a lista de quatro opcoes
  // esconde as escolhas atras de um toque, e a clientela da padaria enxerga
  // melhor o botao na tela.

  if (faltaPapel) {
    // O VALOR SAI DO MOTOR, NAO DA MINHA MEMORIA.
    //
    // Papel de arroz e o unico adicional do bolo com preco de tabela. Escrever
    // "R$ 12" aqui na mao seria mais um numero pra divergir do cardapio no dia
    // em que a dona mudar. Por ter valor, esta fala nao passa pela reescrita.
    const preco = precoDoPapelDeArroz();
    return {
      texto:
        "E papel de arroz, com a foto impressa no bolo?" +
        (preco > 0 ? " Fica " + brl(preco) + "." : ""),
      chave: "papel",
      botoes: [
        { id: "papel_sim", titulo: "Sim" },
        { id: "papel_nao", titulo: "Não" },
      ],
      cardapio: null,
      podeReescrever: preco <= 0,
    };
  }

  if (faltaTopo) {
    return {
      texto: "O bolo vai com topo?",
      chave: "topo",
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
      chave: "tema",
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
      chave: "escrito",
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
  return falaDoSaborQueFalta(proximoSaborQueFalta(p.itens, familia));
}

/**
 * SABOR EM ABERTO E DA CASA INTEIRA, NAO SO DO SALGADO.
 *
 * A etapa do salgado perguntava recheio. Pizza, empadão, cuca recheada,
 * calzone, franciscano, cupcake e torta nao tem etapa propria: o cliente
 * pedia, a padaria ia pedir o dia da retirada, e o sabor so aparecia na
 * confirmacao (ou nunca). A dona: se o produto tem sabor, tem que escolher,
 * e e geral da padaria.
 *
 * Quem decide a lista e o catalogo (`sabores[]` sem `saborFixo`). Coxinha
 * nao entra. Pao frances nao entra.
 */
function falaDoSaborQueFalta(
  semSabor: { produto: string; opcoes: string[] } | undefined,
): Fala | null {
  if (!semSabor) return null;
  const peca = pecaDoCardapio(semSabor.produto);
  // A peca sai do grupo do catalogo. Salgado, pizza, empadao, cuca, cupcake:
  // o mesmo desenho. Sem peca, a lista cabe no texto (quiche, esfirra curta).
  const lista =
    semSabor.opcoes.length && (!peca || semSabor.opcoes.length <= 6)
      ? " Tem " + listaEmPortugues(semSabor.opcoes) + "."
      : "";
  const foto = peca ? " Te mandei o cardápio pra escolher." : "";
  return {
    texto: "O " + semSabor.produto + " vai de quê?" + foto + lista,
    botoes: [],
    cardapio: peca,
    podeReescrever: true,
    opcoes: semSabor.opcoes,
    chave: "sabor",
  };
}

function falaDeSaborEmAberto(p: PedidoEmMontagem, etapaId?: string): Fala | null {
  const demais = saboresAlemDoLimite(p.itens)[0];
  if (demais) {
    return {
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
  const familia =
    etapaId === "salgado" || etapaId === "docinho" || etapaId === "bolo" ? etapaId : null;
  return falaDoSaborQueFalta(proximoSaborQueFalta(p.itens, familia));
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

  const temDocinho = p.itens.some((i) => {
    if (String(i.categoria || "").startsWith("docinho")) return true;
    const pCasa = produtoPorNome(i.produto) ?? produtoNoComeco(i.produto);
    return String(pCasa?.categoria || "").startsWith("docinho");
  });

  if (!temDocinho) {
    return {
      texto: aviso + "Agora os docinhos: quais você quer?",
      botoes: [],
      cardapio: "docinhos",
      podeReescrever: true,
    };
  }

  return falaDaForminha(p) ?? {
    texto: aviso + "Agora os docinhos: quais você quer?",
    botoes: [],
    cardapio: "docinhos",
    podeReescrever: true,
  };
}

function falaDaForminha(p: PedidoEmMontagem): Fala | null {
  if (!faltaCorDaForminha(p.itens, p.forminha)) return null;
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
  // O GENERICO E O MESMO GENERICO DA ETAPA. AS DUAS CAMADAS TEM QUE CONCORDAR.
  //
  // Aqui estava `produto.toLowerCase() !== "bolo"`, a mesma comparacao a mao que
  // a etapa do bolo tinha. Quando a etapa passou a usar `ehNomeDeFamilia`, em
  // 28/08/2026, esta ficou pra tras e as duas discordaram. Medido:
  //
  //   pedido com "bolos"
  //   a etapa diz  >> ainda falta o sabor
  //   a fala diz   >> "O bolo vai no prato de MDF aberto ou com tampa?"
  //
  // O cliente responde o prato, a etapa continua aberta, e a padaria pergunta o
  // prato de novo. Beco sem saida, e ele so aparece quando as duas camadas sao
  // lidas juntas.
  //
  // Antes das duas mudarem, "bolos" fechava a etapa e a cozinha recebia bolo sem
  // sabor. Trocar um pelo outro seria trocar de defeito.
  const temSabor = p.itens.some(
    (i) => String(i.categoria || "").startsWith("bolo") && !ehNomeDeFamilia(i.produto),
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
      chave: "sabor",
    };
  }

  // A PERGUNTA DO PRATO SAIU, POR DECISAO DO DONO EM 28/08/2026.
  //
  // Ela nao existe no fluxograma da Kemilly, e ja estava anotada como decisao
  // em aberto no ARQUITETURA.md. O que decidiu foi uma conversa medida contra a
  // producao: o cliente ignorou as tres perguntas do bolo e mandou "pode
  // confirmar", e o pedido foi pra fila com o prato em branco e sem aviso
  // nenhum pra equipe. Entre perguntar e aceitar ficar sem resposta, ou nao
  // perguntar, ele escolheu nao perguntar: a equipe decide o prato na producao,
  // como sempre fez.
  //
  // O QUE FICOU: a LEITURA. Se o cliente falar "prato aberto" por conta dele, o
  // leitor da frase continua entendendo, o campo continua sendo gravado e o
  // prato continua saindo na comanda. Tirar a pergunta nao e jogar fora o que
  // ele disser.
  //
  // A pergunta juntada, pra quem manda tudo de uma vez, continua existindo com
  // os dois detalhes que sobraram: papel de arroz e topo.
  return falaDasPecas(p);
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

/** O resumo que vai antes de confirmar: item por item, com a conta fechada. */
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
    if (linhasDoMotor.length === p.itens.length) return linhasDoMotor[posicao];
    const alvo = semAcento(produto);
    return linhasDoMotor.find((l) => {
      const nome = semAcento(String(l.item));
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
  // "A GENTE NÃO FAZ X" É NEGAÇÃO, E QUASE SEMPRE MENTIRA.
  //
  // Medido em 27/08/2026, na etapa do bolo:
  //
  //   cliente >> bolo de chocolate, 2 kg
  //   padaria >> A gente não faz chocolate. E o bolo, qual sabor?
  //
  // A casa faz brigadeiro, laka, bombom, biz, prestígio e dois amores, que são
  // todos bolos de chocolate, e ainda tem "chocolate preto com leite ninho" nos
  // caseiros. Ela negou o sabor mais pedido do Brasil por ele não estar escrito
  // com essa palavra na lista.
  //
  // A dona já tinha respondido isso: *"se o cliente pedir outro sabor, a gente
  // vai colocando"*. A lista da casa é ABERTA, e negar por ela é perder venda
  // por regra nossa, não por regra da padaria.
  //
  // Então o que era negação vira convite. A pergunta da etapa já vai logo
  // depois, com o cardápio junto, e o cliente escolhe vendo o que existe em vez
  // de ouvir que não existe.
  //
  // NÃO É O MESMO QUE PROMETER. A padaria não diz "a gente faz": ela diz que
  // não achou com aquele nome e mostra o que tem. Quem decide o que a cozinha
  // produz é a cozinha, e essa regra já valeu pra restrição de dieta e pro topo.
  const aviso = naoTemos.length
    ? "Não achei " + naoTemos.join(" nem ") + " no cardápio com esse nome. "
    : "";
  // Tipo de pizza (inteira/meia/redonda) e produto, nao sabor. Escolhe o
  // produto primeiro; o sabor vem na pergunta unificada logo abaixo.
  const daPizza = falaSeTemPizza(p, aviso);
  if (daPizza) return daPizza;
  // Recheio e sabor de QUALQUER produto do catalogo, nao so salgado.
  // Um de cada vez: na etapa da familia, o da familia; senão o primeiro.
  // Confirmacao e registrado ficam com a ordem deles (resumo, fim).
  if (etapa.id !== "confirmacao" && etapa.id !== "registrado") {
    const doSabor = falaDeSaborEmAberto(p, etapa.id);
    if (doSabor) return doSabor;
  }
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

    case "resto_do_cardapio": {
      // A PERGUNTA SAI DA FAMILIA QUE ELE NOMEOU.
      //
      // Esta etapa atende nove familias (pizza, torta, empadao, cupcake, pao,
      // cuca, calzone, franciscano, bolo salgado), e cada uma tem a sua
      // pergunta e a sua peca de cardapio. Escrever uma frase fixa aqui seria
      // a padaria perguntando de pizza pra quem falou de torta.
      //
      // `falaSeTemFamilia` ja monta a certa: le a familia do item que ainda
      // esta generico, pega as opcoes do catalogo e manda a peca junto.
      const daFamilia = falaSeTemFamilia(p, aviso);
      if (daFamilia) return daFamilia;
      // Sem familia em aberto, o que falta e recheio. A pergunta sai com as
      // opcoes do proprio cardapio daquele item, e nao de uma lista fixa.
      //
      // O fallback nunca deveria ser alcancado (a etapa so entra quando falta
      // uma das duas coisas), mas fala e obrigatoria: devolver a pergunta da
      // etapa e melhor do que devolver silencio se a conta mudar um dia.
      return (
        falaDoSaborQueFalta(proximoSaborQueFalta(p.itens, null)) ?? {
          texto: aviso + "O que mais você quer?",
          botoes: [],
          cardapio: null,
          podeReescrever: true,
        }
      );
    }

    case "pecas_do_bolo":
      return falaDasPecas(p);

    case "oferta":
      return falaDaOferta(p);

    case "dados": {
      const d = falaDosDados(p);
      // A PERGUNTA DE DADO SAI EXATAMENTE COMO ESTA ESCRITA AQUI.
      //
      // Do pedido de festa de 30/08/2026, o que o cliente leu na tela contra o
      // que este arquivo escreve:
      //
      //   codigo  >> O pedido fica no nome de quem?
      //   chegou  >> Qual nome está no pedido?
      //
      //   codigo  >> Pra que dia você quer retirar?
      //   chegou  >> Para que dia você quer buscar?
      //
      // Palavra do dono sobre a primeira: "horrivel essa pergunta (...) parece
      // q eh um pedido pronto ja o jeito q ela falou". Ele esta certo: "qual
      // nome esta no pedido" e quem confere cadastro, e a padaria esta anotando
      // agora.
      //
      // Sao quatro perguntas de uma palavra de resposta (dia, hora, nome,
      // pagamento). A reescrita nao tem o que melhorar nelas, e ja custou caro
      // uma vez: foi ela que trocou o assunto da pergunta no teste da Kemilly e
      // gravou TOPO = SIM num "sim" que era sobre a embalagem.
      return { texto: d.texto, botoes: d.botoes, cardapio: null, podeReescrever: false };
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
      const daFamilia = falaSeTemFamilia(p);
      if (daFamilia) return daFamilia;

      const doSabor = falaDeSaborEmAberto(p, etapa.id);
      if (doSabor) return doSabor;

      const daForminha = falaDaForminha(p);
      if (daForminha) return daForminha;

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
