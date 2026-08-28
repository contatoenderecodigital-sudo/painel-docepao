// ============================================================================
//  A LEITURA DA MENSAGEM DENTRO DA ETAPA
//
//  Esta e a peca em que a IA trabalha, e e a mais importante do fluxo novo.
//
//  A IDEIA
//
//  Na versao antiga a IA recebia o cardapio inteiro, a conversa inteira e
//  quarenta regras, e tinha que decidir sozinha o que fazer. Aqui ela recebe
//  UMA pergunta: "o cliente respondeu isto, estando NESTA etapa. O que mudou?"
//
//  O CASO QUE MOTIVOU TUDO
//
//  Conversa real da kemilly, 22/08/2026:
//
//    cliente: 4 leites 1kg e 100 brigadeiros e 100 beijinhos
//    Dora:    Anotei o bolo 4 leites COM BRIGADEIRO, 1 kg
//
//  Brigadeiro e sabor de bolo E nome de docinho. Sem etapa, a mesma palavra
//  tinha dois significados e nada no sistema sabia desempatar: nasceram tres
//  guardas so pra isso, e mesmo assim o bolo foi recusado duas vezes e a
//  cliente teve que cobrar "ta e os doces q eu pedi?".
//
//  Com etapa nao ha empate: na etapa do BOLO o vocabulario e a lista de sabores
//  de bolo; na etapa do DOCINHO e a lista de docinhos. A palavra "brigadeiro"
//  so pode significar uma coisa, porque so uma lista esta na mesa.
//
//  O QUE ELA PODE E O QUE NAO PODE
//
//  Ela le e devolve o que mudou. Ela NAO escolhe a proxima pergunta, NAO escreve
//  valor, NAO decide fechar pedido. Isso e do codigo, e e o que separa este
//  desenho do anterior.
// ============================================================================

import type { EtapaId, PedidoEmMontagem } from "./etapas";
import { semAcento, formasDoCliente } from "../texto";
// A lista das tres situacoes mora com quem RESPONDE cada uma. Havia tres
// declaracoes dela: aqui, no `situacao.ts` e conferida a mao no limpador da IA.
import { SITUACOES, type SituacaoDaConversa } from "./situacao";
export { SITUACOES, type SituacaoDaConversa };
import { APELIDOS } from "../dados/apelidos";
import {
  produtosDaCasa, produtoNoComeco, produtoPorNome, gruposDaCasa, CATEGORIAS_DE_BOLO,
} from "../dados/produtos";

/**
 * SOBRE O QUE ELE PODE TER PERGUNTADO.
 *
 * Array e nao so uniao de tipo porque QUEM RECEBE a resposta do modelo precisa
 * conferir em tempo de execucao. Uniao de tipo o compilador apaga; o modelo
 * devolve texto, e texto nao passa por compilador nenhum.
 */
export const SOBRE_O_QUE = [
  "preco", "horario", "endereco", "pagamento", "entrega", "prazo", "desconto", "outro",
] as const;
export type SobreOQue = (typeof SOBRE_O_QUE)[number];

/** O que a IA pode devolver. Nada alem disto entra no pedido. */
export type Leitura = {
  /** Itens que ele pediu, do vocabulario DESTA etapa. */
  itens?: {
    produto: string;
    qtd: number;
    /**
     * O RECHEIO OU SABOR, separado do recado pra cozinha.
     *
     * Ate 27/08/2026 os dois vinham num campo so, e conferir o sabor contra o
     * cardapio significava arriscar apagar "sem cebola" da comanda. Com o campo
     * proprio, o codigo confere so o sabor e o recado passa intocado.
     */
    sabor?: string | null;
    obs?: string | null;
  }[];
  /** Quantas pessoas vao na festa. */
  pessoas?: number;
  /**
   * E FESTA?
   *
   * Festa e uma conclusao, nao um ponto de partida. Ela comecava marcada como
   * verdadeira no estado inicial, e quem mandava "boa noite" ouvia "Quantas
   * pessoas vao na festa?" de volta. Agora so vira festa quando a pessoa fala
   * de festa, aniversario, formatura ou de um numero de gente.
   */
  ehFesta?: boolean;
  /** Aceitou a base como esta? So vale na etapa da base. */
  aceitouBase?: boolean;
  /** O que ele disse que NAO quer, pra nao oferecer de novo. */
  naoQuer?: string[];
  /**
   * Topo e papel de arroz. So vale na etapa das pecas.
   *
   * Os dois sao opcionais de proposito: quem responde "quero o topo" nao disse
   * nada sobre papel de arroz, e obrigar o modelo a devolver os dois faria ele
   * chutar um. O que ele nao falar fica como estava.
   */
  pecas?: { topo?: boolean; papelDeArroz?: boolean };
  /**
   * DE QUEM E O ANIVERSARIO, E QUANTOS ANOS FAZ.
   *
   * O topo e fabricado com o tema, o nome e a idade. A padaria pergunta os dois
   * numa frase so, e o codigo cobra o que faltar: se ele responder so "Arthur",
   * a proxima pergunta e a idade.
   */
  aniversariante?: { nome?: string; idade?: string };
  /**
   * O QUE VAI ESCRITO NA PECA, quando ele quiser algo escrito.
   *
   * "Nada" e resposta valida: tem topo que e so o desenho, e exigir nome e idade
   * de quem nao quer nada escrito trava a conversa por uma regra que a padaria
   * nao tem.
   */
  escrito?: string;
  /** O tema da peca personalizada: "Minnie", "Homem Aranha", "futebol". */
  tema?: string;
  /** A cor da forminha do docinho, do cardapio de cores. */
  forminha?: string;
  /**
   * A CONVERSA NAO E UM PEDIDO.
   *
   * A Rota C: reclamacao e cancelamento sao sempre da equipe, e status a Dora
   * responde se souber. Ate 24/08/2026 quem escrevia "meu pao veio queimado"
   * caia no fluxo de pedido e recebia oferta de docinho.
   */
  situacao?: SituacaoDaConversa;
  /**
   * ELE SO PERGUNTOU, NAO PEDIU.
   *
   * "Quanto e o cento de salgado?" nao e pedido de salgado. No sistema antigo a
   * cliente perguntou "0% lactose nao e sem acucar ne?" e ganhou um bolo 0%
   * lactose no pedido dela.
   *
   * A resposta sai do codigo, com o dado da casa, e nada e anotado.
   */
  perguntou?: {
    sobre: SobreOQue;
    familia?: string;
  };
  /** Como o bolo vai embalado: prato de MDF aberto ou embalagem com tampa. */
  prato?: "aberto" | "tampa";
  /** Dados da retirada. */
  dados?: { nome?: string; data?: string; hora?: string; pagamento?: string };
  /**
   * ELE MUDOU DE ASSUNTO.
   *
   * "na verdade quero trocar o bolo" no meio dos docinhos. O fluxo volta pra
   * etapa citada, resolve, e retoma de onde parou. Decidido com o dono em
   * 23/08/2026: voltar e mais seguro que tentar resolver de longe, porque
   * resolver de longe e exatamente o que fazia a IA mexer no item errado.
   */
  falouDeOutraEtapa?: EtapaId;
  /** Ele mandou apagar tudo e comecar de novo. */
  recomecar?: boolean;
  /**
   * ELE CONFIRMOU O PEDIDO ESCREVENDO.
   *
   * O pedido so fechava com o toque no botao Confirmar, e isso era um beco de
   * verdade: quem escreve "pode fechar" nao fecha nada, e quem volta depois de
   * 24 horas NEM RECEBE BOTAO, porque o WhatsApp so deixa mandar botao dentro
   * da janela de conversa. O cliente ficava vendo o mesmo resumo pra sempre.
   */
  confirmou?: boolean;
};

/**
 * O TEXTO SEM ACENTO, MINUSCULO E APARADO.
 *
 * Estava escrito QUATRO vezes dentro deste arquivo, identico nas quatro. E o
 * mesmo defeito que o `ESPERA_MS` do arquivo 1: valor decidido em mais de um
 * lugar so fica igual enquanto ninguem mexe. Uma delas usava `?? ""` e as
 * outras `|| ""`, que ja e a divergencia comecando.
 */
const semAc = semAcento;

const nomes = (lista: { nome: string }[]) => lista.map((i) => String(i.nome));

/**
 * UMA LETRA TROCADA NAO PODE FAZER A PADARIA NEGAR O QUE ELA VENDE.
 *
 * Medido em 27/08/2026, na bateria dos cinco jeitos, cenario "com erro de
 * digitacao", cinco execucoes de cinco:
 *
 *   cliente >> 50 brigadero, forminha rosa
 *   padaria >> A gente nao faz brigadero.
 *   no banco >> 100 coxinha, 100 quiche, 2 kg de bolo   (o brigadeiro sumiu)
 *
 * Perdeu o docinho E a cor da forminha, que nao tinha mais em que linha morar.
 * E a padaria mentiu: ela faz brigadeiro, e faz mais brigadeiro do que qualquer
 * outra coisa.
 *
 * Isto passava ate hoje de manha, e passava POR SORTE: o modelo costumava
 * corrigir o erro antes de devolver o nome. Sistema que depende do modelo
 * acertar a digitacao nao tem defesa nenhuma, so nao tinha falhado ainda.
 *
 * POR QUE DISTANCIA 1, E NAO UMA COMPARACAO FROUXA
 *
 * O `apelidos.ts` avisa, com razao, que afrouxar por distancia de letra casa
 * produto errado: "esfirra" e "esfiha" estao a tres letras, e tres letras de
 * folga transformariam "coxinha" em outra coisa.
 *
 * Aqui a folga e de UMA letra, o nome precisa ter cinco ou mais, e o quase
 * acerto so vale quando UM UNICO produto do cardapio esta a essa distancia. Dois
 * candidatos empatados e ambiguidade, e ambiguidade volta a ser barrada: melhor
 * a padaria perguntar do que escolher errado.
 */
/**
 * TROCAR DUAS LETRAS DE LUGAR E UM ERRO SO, E NAO DOIS.
 *
 * A primeira versao disto era Levenshtein puro, que conta "coxniha" como DUAS
 * edicoes em relacao a "coxinha" (tira o "i", poe o "i"). Com a folga de uma
 * letra, todo dedo trocado no teclado caia fora.
 *
 * Medido em 27/08/2026 contra o cardapio inteiro, gerando os erros que gente de
 * verdade comete (letras trocadas de lugar, letra comida, letra dobrada):
 *
 *   567 erros testados, 384 chegavam no produto  (68%)
 *   dos 183 perdidos, 153 eram letras trocadas de lugar
 *
 * "ocxinha", "cxoinha", "coixnha", "coxniha", "coxihna", "coxinah": seis jeitos
 * de errar a mesma coxinha, todos fora. Nao era caso faltando numa lista, era a
 * regua errada.
 *
 * Damerau-Levenshtein (variante OSA) conta a troca de lugar como uma edicao so,
 * que e o que ela e pra quem digitou.
 */
function distancia(a: string, b: string): number {
  // Duas letras de diferenca de tamanho ja passam de uma edicao, seja qual for.
  if (Math.abs(a.length - b.length) > 1) return 2;
  const anterior2 = new Array(b.length + 1).fill(0);
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  let atual = new Array(b.length + 1).fill(0);
  let dois = anterior2;
  for (let i = 1; i <= a.length; i++) {
    atual[0] = i;
    let menor = atual[0];
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo);
      // A troca de lugar: "ab" virou "ba".
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        atual[j] = Math.min(atual[j], dois[j - 2] + 1);
      }
      if (atual[j] < menor) menor = atual[j];
    }
    // Passou de uma edicao em toda a linha: nao vai voltar. Para aqui.
    if (menor > 1) return 2;
    const gira = dois;
    dois = anterior;
    anterior = atual;
    atual = gira;
  }
  return anterior[b.length];
}

/**
 * O NOME DO CARDAPIO POR TRAS DESTA GRAFIA.
 *
 * "risoles", "risole", "rissoles" e "rissole" sao a mesma coisa: o `risólis` do
 * cardapio. Sem isto, a trava de unicidade la embaixo confundiria SINONIMO com
 * AMBIGUIDADE e recusaria o quase acerto justamente nos produtos que o cliente
 * mais escreve errado.
 *
 * Medido em 27/08/2026: dos 35 nomes do vocabulario do salgado, 21 pares estao
 * a duas letras um do outro, e TODOS os 21 sao apelidos do mesmo produto.
 */
function canonicoDaGrafia(nome: string): string {
  const alvo = semAc(nome);
  for (const [canonico, lista] of Object.entries(APELIDOS)) {
    if (lista.some((a) => semAc(a) === alvo)) return semAc(canonico);
  }
  return alvo;
}

/**
 * O UNICO PRODUTO DO CARDAPIO A UMA LETRA DESTE NOME, ou null.
 *
 * A unicidade e medida pelo PRODUTO, e nao pela grafia: cinco grafias do mesmo
 * risolis contam como um candidato so. Dois produtos DIFERENTES a uma letra
 * seriam ambiguidade de verdade, e ai a padaria pergunta em vez de escolher.
 */
function quaseIgual(nome: string, vocab: string[]): string | null {
  // O TAMANHO MINIMO E DO NOME DO CARDAPIO, NAO DO QUE O CLIENTE DIGITOU.
  //
  // Estava nos dois, e por isso quem comia uma letra de um produto de cinco
  // ficava de fora: "chodo" digitado como "hodo" tem quatro letras e nem era
  // olhado. O produto e que precisa ser comprido o bastante pra uma letra de
  // folga nao alcancar outra coisa; o que o cliente escreveu e o problema, nao
  // a regua.
  //
  // O piso de quatro no que ele digitou continua, porque abaixo disso uma letra
  // de folga vira quase qualquer palavra: "ovo", "com", "dos".
  if (nome.length < 4) return null;
  const perto = vocab.filter((v) => v.length >= 5 && distancia(nome, v) === 1);
  if (!perto.length) return null;
  const produtos = new Set(perto.map(canonicoDaGrafia));
  return produtos.size === 1 ? [...produtos][0] : null;
}

/**
 * O VOCABULARIO TAMBEM ACEITA O JEITO QUE O CLIENTE ESCREVE.
 *
 * A casa mantem uma lista de sinonimos em `apelidos.ts` justamente porque o
 * cliente nao escreve o nome do cardapio: escreve "risoles" e nao "risólis",
 * "esfiha" e nao "esfirra". O portao da etapa nao conhecia essa lista, entao
 * jogava fora um nome que o resto do sistema sabe traduzir.
 *
 * Medido em 27/08/2026, numa festa de 30 pessoas:
 *
 *   cliente >> coxinha e risoles de carne, metade de cada
 *   rastro  >> barrado nesta etapa: risoles de carne
 *
 * Os 300 salgados foram todos pra coxinha e o risoles SUMIU do pedido. Item que
 * some e a coisa mais grave que este sistema faz: se o cliente nao repetir, a
 * padaria produz metade do que ele pediu e ninguem descobre antes da retirada.
 *
 * Duas listas pro mesmo assunto sempre divergem, e este arquivo ja avisava
 * disso no cabecalho do `apelidos.ts`: "se as duas camadas usassem listas
 * diferentes, uma aceitaria o que a outra recusa, e isso ja aconteceu".
 */
function comOsApelidos(canonicos: string[]): string[] {
  const tem = new Set(canonicos.map(semAc));
  const extras: string[] = [];
  for (const [canonico, lista] of Object.entries(APELIDOS)) {
    if (tem.has(semAc(canonico))) extras.push(...lista);
  }
  return [...canonicos, ...extras];
}

/** Os nomes CURTOS (do jeito que o cliente fala) das categorias pedidas. */
const daLista = (...categorias: string[]) =>
  produtosDaCasa()
    .filter((p) => categorias.includes(p.categoria))
    .map((p) => p.nomeCurto);

/**
 * QUAIS CATEGORIAS DO CATALOGO CADA ETAPA COBRE.
 *
 * Um lugar so, e de proposito. Duas funcoes precisam desta fiacao -- a que monta
 * o vocabulario e a que descobre de quem e um produto -- e enquanto cada uma
 * tinha o seu jeito, elas discordavam:
 *
 *   vocabularioDaEtapa("bolo")     incluia o brigadeiro de bolo
 *   etapaDesteProduto("bolo brigadeiro")  ->  docinho
 *
 * Porque a segunda perguntava pelo NOME CURTO, e "brigadeiro" e nome curto nas
 * duas familias. Categoria nao empata: `bolo_festa` e `docinho` sao coisas
 * diferentes no catalogo, e o catalogo e quem sabe.
 *
 * Isto NAO e o cardapio escrito no codigo: nenhum produto aparece aqui. E a
 * ligacao entre as tres etapas de produto e os nomes de categoria que a casa ja
 * usa. Categoria que nao esta aqui existe e e vendida (pizza, cuca, cupcake,
 * torta, calzone), so nao tem etapa que pergunte por ela.
 */
const CATEGORIAS_DA_ETAPA = {
  salgado: ["salgado_frito", "salgado_assado"],
  docinho: ["docinho"],
  bolo: CATEGORIAS_DE_BOLO,
} as const;

const ETAPAS_DE_PRODUTO = Object.keys(CATEGORIAS_DA_ETAPA) as (keyof typeof CATEGORIAS_DA_ETAPA)[];

/**
 * O VOCABULARIO DA ETAPA.
 *
 * E a lista fechada do que a IA pode devolver ali. Fora dela nao existe: se o
 * cliente falar de outra coisa, ela devolve falouDeOutraEtapa e quem decide o
 * rumo e o codigo.
 */
export function vocabularioDaEtapa(etapa: EtapaId): string[] {
  switch (etapa) {
    case "salgado":
      return comOsApelidos(daLista(...CATEGORIAS_DA_ETAPA.salgado));
    case "docinho":
      return comOsApelidos(daLista(...CATEGORIAS_DA_ETAPA.docinho));
    case "bolo":
      // O BOLO CASEIRO TAMBEM E BOLO, E ISSO FALTAVA.
      //
      // O vocabulario saia so dos sabores de bolo de FESTA. Medido em
      // 27/08/2026: 14 dos 15 bolos caseiros eram BARRADOS na etapa do bolo.
      //
      //   cliente >> bolo de cenoura
      //   padaria >> Nao achei cenoura no cardapio com esse nome.
      //
      // Quinze produtos que a casa vende, de R$ 30,90 a R$ 35,90, invisiveis
      // pra quem estava montando uma festa. O unico que passava era o
      // "prestigio com ganache", e por acidente: "prestigio" tambem e sabor de
      // bolo de festa.
      //
      // Achado migrando este arquivo pra lista unica, que e o que o dono mandou
      // fazer. Cada migração destas achou defeito que ninguem sabia que existia.
      return comOsApelidos(daLista(...CATEGORIAS_DA_ETAPA.bolo));
    default:
      return [];
  }
}

/** Que dia e hoje, pelo relogio da padaria. O modelo nao tem relogio. */
function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

/**
 * A INSTRUCAO DA ETAPA.
 *
 * Curta de proposito. A carta de trinta paginas da versao antiga existia porque
 * a IA precisava saber tudo pra decidir tudo; aqui ela decide uma coisa so.
 */
/**
 * O CARDAPIO QUE A INSTRUCAO MOSTRA, QUE NAO E O MESMO QUE O PORTAO COBRA.
 *
 * Nas tres etapas de produto os dois coincidem, e por isso durante muito tempo
 * pareceram a mesma coisa. Na OFERTA eles divergem, e a diferenca importa:
 *
 *   mostrar   docinho e bolo, que e o que a padaria acabou de oferecer
 *   cobrar    nada, porque na oferta o cliente tambem manda dado da retirada,
 *             corrige quantidade e pede salgado de novo
 *
 * Se a oferta cobrasse o que mostra, um salgado dito ali seria guardado pra uma
 * etapa que ja passou, e etapa que ja passou nao volta sozinha: o item ficaria
 * parado pra sempre. Mostrar sem cobrar da ao modelo o vocabulario e nao tira
 * nada do cliente.
 */
function cardapioDaInstrucao(etapa: EtapaId): string[] {
  if (etapa === "oferta") {
    return comOsApelidos(daLista(...CATEGORIAS_DA_ETAPA.docinho, ...CATEGORIAS_DA_ETAPA.bolo));
  }
  return vocabularioDaEtapa(etapa);
}

export function instrucaoDaEtapa(etapa: EtapaId, p: PedidoEmMontagem): string {
  const vocab = cardapioDaInstrucao(etapa);
  // QUEM ENTENDE ERRO DE DIGITAÇÃO É QUEM TEM CONTEXTO, E ISSO É A IA.
  //
  // O cardápio já ia na instrução, mas nada mandava ela RESPONDER com o nome
  // dele. Então "brigadero" voltava como "brigadero", e o portão do código, que
  // só sabe comparar letra, jogava fora.
  //
  // Isso pôs meu código pra fazer o trabalho errado: julgar ortografia. A régua
  // de letras não escala e o dono disse por quê, escrevendo torto de propósito:
  // "tipo eu digitando errado vc entende pq tem contexto". Um humano lê
  // "enmtendwer" e entende; nenhuma distância de letra chega lá.
  //
  // Uma linha aqui vale por qualquer lista de erros, e vale pra padaria nova
  // que entrar amanhã: o cardápio dela vai junto e a regra é a mesma.
  //
  // A régua de letras continua existindo, e virou o que ela deveria ter sido
  // desde o começo: rede embaixo, pro dia em que o modelo escorregar.
  // E A OUTRA METADE DA REGRA, QUE FALTOU NA PRIMEIRA VERSÃO E CUSTOU CARO.
  //
  // Mandar usar o nome do cardápio, só isso, fez a IA ENCAIXAR qualquer coisa
  // no cardápio. Medido contra ela de verdade em 27/08/2026:
  //
  //   "50 xilofone"            ->  50 BRIGADEIROS (obs: xilofone)
  //   "50 macarons"            ->  brigadeiro
  //   "daquele docinho preto"  ->  brigadeiro
  //   "bolo de chocolate"      ->  mineira
  //
  // Um xilofone virou cinquenta brigadeiros. Corrigir a escrita e trocar o
  // produto são coisas diferentes, e a instrução só pedia a primeira.
  //
  // Com a segunda metade, o que não é do cardápio volta como o cliente
  // escreveu, o portão barra, e a padaria diz "não achei isso no cardápio" e
  // mostra o que tem. Que é o que uma atendente faria: ela entende "brigadero",
  // e não entrega brigadeiro pra quem pediu macaron.
  const lista = vocab.length
    ? "\n\nCardápio da etapa. Use o nome daqui mesmo que ele erre; " +
      "se não for nenhum, repita o que ele escreveu: " + vocab.join(", ") + "."
    : "";

  const comum =
    "Você é a atendente de uma padaria e está anotando um pedido. " +
    "Leia SÓ a última mensagem do cliente e diga o que mudou no pedido. " +
    "Não escreva resposta pro cliente, não invente valor, não decida a próxima pergunta." +
    String.fromCharCode(10, 10) +
    // ESTE BLOCO ENTRA EM TODA ETAPA, ENTAO CADA PALAVRA AQUI CUSTA EM TODAS.
    //
    // Ele ja estourou o limite de 1.500 caracteres duas vezes, e o teste que
    // reprova por isso existe porque instrucao comprida e exatamente o que faz
    // o modelo se perder. Cada linha daqui virou uma linha so, com o motivo
    // registrado aqui em cima em vez de dentro do texto que a IA le:
    //
    //   DIA, HORA, NOME E PAGAMENTO em qualquer etapa. O cliente nao anda na
    //   ordem do sistema: a Kemilly escreveu "dia 02" no meio dos salgados e o
    //   dado se perdia. Sao seguros porque nao competem com produto nenhum.
    //
    //   HOJE E QUE DIA. O modelo nao tem relogio: "dia 05 de setembro" virou
    //   05/09/2024, um ano e meio no passado, numa padaria sob encomenda.
    //
    //   PERGUNTAR NAO E PEDIR. No sistema antigo a cliente perguntou "0%
    //   lactose nao e sem acucar ne?" e ganhou um bolo 0% lactose no pedido.
    //
    //   A ROTA C. Quem escrevia "meu pao veio queimado" caia no fluxo de pedido
    //   e recebia oferta de docinho.
    "SEMPRE, em qualquer etapa:" + String.fromCharCode(10) +
    "- dia, hora, nome de quem retira e forma de pagamento vão em dados." + String.fromCharCode(10) +
    // CORRIGIR O QUE JA PEDIU VALE EM QUALQUER ETAPA, igual a data.
    //
    // Bateria dos cinco jeitos, cenario "mudando de ideia no meio", cinco
    // execucoes de cinco:
    //
    //   cliente >> quero 200 coxinha e 100 quiche de frango
    //   cliente >> na verdade muda a coxinha pra 100
    //   no banco >> 200 coxinha        (a correcao se perdeu)
    //
    // O modelo estava na etapa da oferta, respondeu sobre a oferta e largou a
    // correcao. O leitor da frase segurava o numero, mas o fluxo descartava:
    // ele so guarda item que AINDA NAO esta no pedido, e coxinha ja estava.
    //
    // Consertar isso no codigo exigiria adivinhar INTENCAO: "muda pra 100" e
    // troca, "mais 100" e soma, e a diferenca sao cem coxinhas. Isso e leitura,
    // e leitura e da IA. A mesma solucao que dia, hora e pagamento ja usam: sao
    // seguros em qualquer etapa porque nao competem com produto nenhum.
    "- Mudou a quantidade do que já pediu? mande o item com o total NOVO." + String.fromCharCode(10) +
    "- Hoje é " + hojeEmSaoPaulo() + ", e retirada é sempre no futuro." + String.fromCharCode(10) +
    "- Perguntou em vez de pedir? perguntou.sobre = preco (com familia), " +
    "horario, endereco, pagamento, entrega, prazo, desconto ou outro." + String.fromCharCode(10) +
    // Desconto, preco beneficente e "da uma ajuda?" sao a mesma pergunta, e a
    // resposta e sempre da equipe. A IA nao pode soltar o preco por unidade que
    // a dona usa nesses casos: negociacao virando tabela custa margem.
    "- Pediu desconto, falou que e beneficente ou pediu ajuda = desconto." + String.fromCharCode(10) +
    "- Reclamou do que comprou = situacao \"reclamacao\". Quer cancelar = " +
    "\"cancelar\". Pergunta de pedido já feito = \"status\"." + String.fromCharCode(10) +
    "- Pergunta e reclamação NÃO viram item.";

  // NA FESTA, O NUMERO JA FOI COMBINADO.
  //
  // Ele aceitou "300 salgados no total" e agora diz quais quer. Se o modelo
  // inventar uma quantidade, ela briga com a proposta; se devolver 0, o codigo
  // reparte os 300 entre o que ele escolheu.
  const semNumero =
    p.baseAceita && p.base
      ? " Se ele NÃO disser a quantidade, devolva qtd 0: o total já foi combinado na proposta."
      : "";

  // A RECUSA E RESPOSTA, NAO SILENCIO.
  //
  // So a etapa da proposta sabia ouvir "nao quero". Nas etapas de familia, quem
  // dissesse "nao quero docinho" nao anotava item (nao pediu nada) e nao
  // recusava nada (ninguem estava ouvindo), entao a etapa continuava aberta e a
  // padaria perguntava de docinho pra sempre. Beco igual ao de "vcs fazem
  // bolo?", e nas tres familias.
  //
  // Escrita uma vez e usada nas tres de proposito: o dono pediu que as regras
  // fossem as mesmas em todas as familias, senao cada uma quebra de um jeito.
  //
  // CURTA DE PROPOSITO: ela entra em tres etapas, entao cada palavra aqui custa
  // tres vezes. A lista de exemplos ("nao quero, sem X, pode tirar, deixa pra
  // la") saiu em 27/08/2026 pra caber o aviso de correcao de quantidade: o
  // modelo entende recusa sem precisar de quatro sinonimos.
  const recusa = (familia: string) =>
    " Se ele recusar " + familia + ", devolva naoQuer com essa palavra.";

  // O TIPO E `EtapaId`, E NAO `string`, E ISSO NAO E ENFEITE.
  //
  // Com `Record<string, string>` o compilador aceita qualquer chave e nao cobra
  // nenhuma. Faltava a etapa da OFERTA, e faltava calada: quem escrevesse em
  // vez de tocar o botao chegava na IA com o bloco comum e MAIS NADA. Nenhuma
  // palavra sobre docinho, sobre bolo, sobre o que fazer com o que ele pediu.
  //
  // O estrago esta escrito no `fluxo.ts`, no comentario do resgate que nasceu
  // pra tapar isto: "50 brigadeiro, forminha rosa, e um bolo de 2 kg de 4
  // leites" na etapa da oferta -- o brigadeiro entrou, o bolo nao, e a padaria
  // perguntou o sabor do bolo duas vezes ate a conversa morrer.
  //
  // Com o tipo fechado, o compilador passa a ser o dono da lista: cadastrar uma
  // etapa nova em `etapas.ts` quebra o build aqui ate ela ganhar instrucao. A
  // etapa que de fato nao precisa de uma diz isso com "" na cara, escolhido por
  // alguem, em vez de sumir da lista sem ninguem notar.
  const daEtapa: Record<EtapaId, string> = {
    quantas_pessoas:
      "A etapa é QUANTAS PESSOAS vão na festa. Devolva o número em pessoas. " +
      "Se ele falar de outra coisa, devolva falouDeOutraEtapa.",
    base_da_festa:
      "A etapa é ACEITAR A BASE da festa que a padaria acabou de propor. " +
      "Se ele aceitou como está, aceitouBase = true. Se ele pediu para mudar " +
      "quantidade, devolva o que ele quer em itens. Se ele disse que não quer " +
      "alguma família (salgado, docinho, bolo), devolva em naoQuer.",
    salgado:
      "A etapa é ESCOLHER OS SALGADOS. Só existe salgado aqui: se ele falar de " +
      "docinho ou de bolo, devolva falouDeOutraEtapa em vez de anotar." +
      recusa("salgado") + semNumero + lista,
    docinho:
      "A etapa é ESCOLHER OS DOCINHOS. Só existe docinho aqui: se ele falar de " +
      "bolo ou de salgado, devolva falouDeOutraEtapa em vez de anotar. " +
      "Se ele disser a COR da forminha (rosa, azul, dourada, verde tiffany), " +
      "devolva em forminha." + recusa("docinho") + semNumero + lista,
    bolo:
      "A etapa é ESCOLHER O BOLO. Só sabor de bolo aqui: se ele falar de " +
      "docinho, devolva falouDeOutraEtapa, mesmo que o nome sirva pros dois " +
      "(brigadeiro, beijinho). O peso em quilos vai na quantidade." +
      " Embalagem: prato \"aberto\" ou \"tampa\"." +
      recusa("bolo") + semNumero + lista,
    pecas_do_bolo:
      "A etapa é TOPO E PAPEL DE ARROZ, e o NOME e a IDADE do aniversariante." +
      String.fromCharCode(10) +
      "Em pecas, devolva SÓ o que ele falou: topo e papelDeArroz, true ou false." +
      String.fromCharCode(10) +
      "O que ele quiser ESCRITO na peça vai em escrito, e \"nada\" ou \"só o " +
      "desenho\" também é resposta. Nome e idade vão em aniversariante: " +
      "\"Arthur, 5 anos\" é nome e idade." + String.fromCharCode(10) +
      "O TEMA vai em tema, e tema é tudo que vá escrito ou desenhado na peça: " +
      "personagem, cor, frase (\"escrito trintei em rosa\"), assunto." +
      String.fromCharCode(10) +
      // O beco do teste da Kemilly: ela disse "nao quero topo" tres vezes e a
      // padaria continuou perguntando o nome do topo.
      "Não quer o topo? naoQuer com \"topo\". Não quer o papel? naoQuer com " +
      "\"papel\". Vale mesmo se ele já disse sim antes: quem muda de ideia manda.",
    oferta:
      "A padaria acabou de oferecer DOCINHO ou BOLO junto com o que ele pediu. " +
      "Se ele quer, devolva os itens; se ele recusou (só isso, não, mais nada), " +
      "devolva naoQuer com \"docinho\" e \"bolo\". Se ele falou de outra coisa " +
      "(dados da retirada, mudar o pedido), leia normalmente: a oferta é " +
      "opcional e não trava a conversa." + String.fromCharCode(10) +
      // O CARDAPIO SAI PELO MESMO CANO DAS OUTRAS ETAPAS, e nao despejado aqui
      // dentro. A primeira versao colava os 42 nomes no meio da regra, e o
      // teste que mede o tamanho conta como REGRA tudo que vem antes do marcador
      // "Cardápio da etapa.". A instrucao da oferta virou a maior do sistema
      // (1788) e passou despercebida porque o teste media uma lista de cinco
      // etapas escrita a mao, e a oferta nao estava nela.
      "Aqui valem docinho E bolo ao mesmo tempo. Quantidade em unidades é " +
      "docinho; peso em quilos é bolo." + lista,
    dados:
      "A etapa é PEGAR OS DADOS DA RETIRADA: nome de quem retira, dia, hora e " +
      "forma de pagamento. Devolva só o que ele falou nesta mensagem. " +
      "Data no formato DD/MM/AAAA." + String.fromCharCode(10) +
      // "Quero decidir os sabores dos salgados" no meio dos dados foi ignorado
      // no teste de 23/08/2026: ela respondeu perguntando a forma de pagamento.
      // Esta etapa e a unica que nao sabia mandar a conversa de volta.
      "Se ele quiser mexer no PEDIDO (trocar sabor, escolher salgado, mudar o " +
      "bolo, tirar item), devolva falouDeOutraEtapa com a etapa: salgado, " +
      "docinho, bolo ou pecas_do_bolo.",
    confirmacao:
      "A etapa é CONFIRMAR O PEDIDO. Se ele confirmou de qualquer jeito (pode " +
      "fechar, isso mesmo, confirmo, tá certo, pode ser, fechado), devolva " +
      "confirmou = true. Se ele pediu para mudar algo, devolva falouDeOutraEtapa " +
      "com a etapa do que ele quer mudar.",
    // O pedido ja esta com a equipe e esta etapa nunca e a da vez (`cumprida`
    // devolve true sempre). Fica aqui porque o tipo cobra, e cobrar e o ponto:
    // no dia em que ela virar uma etapa de verdade, isto aparece.
    registrado: "",
    abertura:
      "A conversa está começando e você ainda não sabe o que ele quer." + String.fromCharCode(10) + 
      "Se ele falou de FESTA, aniversário, formatura, coffee break ou de um " +
      "número de pessoas, devolva ehFesta = true." + String.fromCharCode(10) + 
      "Se ele pediu um produto direto (100 coxinhas, uma torta), devolva em itens." + String.fromCharCode(10) + 
      "Se ele PERGUNTOU de uma família sem dizer quantidade (vocês fazem bolo? " +
      "tem salgadinho? faz docinho?), devolva falouDeOutraEtapa com a etapa " +
      "daquela família: salgado, docinho ou bolo. Perguntar já é dizer sobre o " +
      "que ele quer falar." + String.fromCharCode(10) +
      "Se ele só cumprimentou, devolva {} e não invente nada: quem diz o que " +
      "quer é ele.",
  };

  const jaTem = p.itens.length
    ? "\n\nJá está anotado: " + p.itens.map((i) => i.qtd + " " + i.produto).join(", ") + "."
    : "";

  return comum + "\n\n" + (daEtapa[etapa] ?? "") + jaTem;
}

/**
 * O ITEM E DE OUTRA ETAPA, OU NAO EXISTE?
 *
 * Sao coisas diferentes e o tratamento tem que ser diferente. O que existe no
 * cardapio e so foi citado fora da hora fica GUARDADO para quando a conversa
 * chegar la. O que nao existe continua sendo recusado, porque ai a recusa e
 * honesta e o cliente precisa ser avisado.
 */
export function etapaDesteProduto(produto: string): EtapaId | null {
  // O PREFIXO "bolo" PRECISA SAIR ANTES DE COMPARAR.
  //
  // O vocabulario da etapa do bolo lista os sabores como o cardapio escreve,
  // sem prefixo ("4 leites"). O nome canonico do sistema carrega ele ("bolo 4
  // leites"), porque e o prefixo que separa o bolo do docinho de mesmo nome.
  //
  // Quando o canonico passou a valer, em 26/08/2026, esta comparacao parou de
  // casar e o bolo guardado nunca era aplicado: ficava estacionado pra sempre.
  // Peguei medindo UMA conversa contra o banco antes de rodar a bateria.
  // A CATEGORIA DO CATALOGO DECIDE ANTES DO NOME. MEDIDO EM 27/08/2026:
  //
  //   etapaDesteProduto("bolo caseiro cenoura")  ->  null
  //   etapaDesteProduto("bolo brigadeiro")       ->  docinho
  //
  // Os dois vinham da cirurgia de texto logo abaixo. "bolo caseiro cenoura"
  // menos o prefixo "bolo " e "caseiro cenoura", que nao e sabor nenhum, e os
  // QUINZE bolos caseiros davam null. E "bolo brigadeiro" menos o prefixo e
  // "brigadeiro", que a varredura encontra no DOCINHO primeiro.
  //
  // Onde isso doia: o `fluxo.ts` estaciona o item citado fora da hora ja com o
  // nome canonico, e depois pergunta a esta funcao de quem ele e pra aplicar na
  // etapa certa. Null nunca casa com etapa nenhuma, entao o bolo caseiro ficava
  // estacionado PARA SEMPRE. E o mesmo defeito que o comentario do `fluxo.ts`
  // diz ter consertado em 26/08/2026: consertou o bolo de festa, e o caseiro
  // ficou, porque o conserto foi na string e nao na fonte.
  //
  // O nome do cardapio pergunta pelo CATALOGO, que sabe a categoria de cada
  // produto sem ninguem cortar prefixo. E a etapa continua saindo de
  // `vocabularioDaEtapa`, que e o unico lugar onde categoria vira etapa: aqui
  // nao nasce uma segunda lista dizendo a mesma coisa de outro jeito.
  const daCasa = produtoNoComeco(produto);
  if (daCasa) {
    for (const etapa of ETAPAS_DE_PRODUTO) {
      if ((CATEGORIAS_DA_ETAPA[etapa] as readonly string[]).includes(daCasa.categoria)) return etapa;
    }
    // Existe na casa e nenhuma etapa pergunta por ele: pizza, cuca, cupcake,
    // torta, calzone. Null aqui e verdade, e quem chama precisa saber que e
    // diferente de "nao existe" -- ver `existeNoCardapio`.
    return null;
  }

  // O modelo nem sempre devolve o nome canonico: "cenoura" e "4 leites" chegam
  // pelados, e o catalogo nao acha nenhum dos dois pelo nome curto. Entao a
  // busca pelo vocabulario continua, agora como segunda tentativa.
  const nome = semAc(produto).replace(/^bolo +/, "");
  for (const etapa of ETAPAS_DE_PRODUTO) {
    const cabe = vocabularioDaEtapa(etapa)
      .map(semAc)
      .some((v) => nome === v || nome.startsWith(v + " "));
    if (cabe) return etapa;
  }
  return null;
}

/**
 * AS FAMILIAS QUE A CASA VENDE, TIRADAS DO CATALOGO.
 *
 * Nenhum nome escrito aqui. Sao a primeira palavra do nome de cada produto e os
 * pedacos dos grupos que a dona cadastra. Se ela criar a familia "salgado
 * vegano" amanha, "vegano" entra aqui sozinho.
 */
let familiasCache: Set<string> | null = null;
function familiasDaCasa(): Set<string> {
  if (familiasCache) return familiasCache;
  const f = new Set<string>();
  // A familia entra com o nome do catalogo, sem reducao: e ele que e canonico.
  for (const p of produtosDaCasa()) f.add(semAcento(String(p.nome).split(" ")[0]));
  for (const g of gruposDaCasa()) {
    for (const parte of semAc(g).split(/[-_]/)) {
      if (parte.length >= 4) f.add(semAcento(parte));
    }
  }
  f.delete("");
  familiasCache = f;
  return f;
}

/**
 * A CASA VENDE ALGO PARECIDO COM ISTO?
 *
 * Usado onde a etapa nao tem cardapio proprio (abertura, dados, oferta,
 * confirmacao): oito das onze etapas. Ali o portao desistia na primeira linha e
 * QUALQUER COISA que o modelo devolvesse entrava no pedido.
 *
 * Isso nao e hipotese. Medido contra o modelo de verdade em 27/08/2026, com a
 * instrucao antiga: "50 xilofone" virou 50 BRIGADEIROS, "50 macarons" virou
 * brigadeiro, "daquele docinho preto" virou brigadeiro. A instrucao foi
 * corrigida pra ele devolver o que nao conhece do jeito que o cliente escreveu,
 * e nas tres etapas de produto o portao pega. Nas outras oito nao pegava
 * ninguem, e a abertura e onde a maioria dos pedidos nasce.
 *
 * A regua e generosa de proposito: familia basta. Negar "quero um bolo" pra
 * ganhar uma negativa de xilofone seria um pessimo negocio.
 */
export function daFamiliaDaCasa(produto: string): boolean {
  const familias = familiasDaCasa();
  // Todos os jeitos em que ele pode ter escrito, do mais fiel ao mais reduzido.
  for (const t of formasDoCliente(produto)) {
    if (!t) continue;
    for (const f of familias) {
      if (t === f || t.startsWith(f + " ")) return true;
    }
  }
  return false;
}

/**
 * EXISTE NO CARDAPIO, MESMO QUE NENHUMA ETAPA PERGUNTE POR ELE.
 *
 * `etapaDesteProduto` devolve null para duas coisas MUITO diferentes: o que a
 * casa nao vende, e o que a casa vende mas nenhuma etapa cobre -- pizza, cuca,
 * cupcake, torta fria, empadao, calzone, franciscano, pao. Sao 24 produtos.
 *
 * Tratar os dois igual fazia a padaria negar o que ela vende: quem estivesse na
 * etapa do salgado e dissesse "e uma torta fria" ouvia "Nao achei torta fria no
 * cardapio com esse nome", e o item sumia do pedido.
 */
export function existeNoCardapio(produto: string): boolean {
  return Boolean(produtoNoComeco(produto) || produtoPorNome(produto));
}

/**
 * A LEITURA CABE NA ETAPA?
 *
 * Ultima trava antes de virar pedido. Ela tem DUAS reguas, e por muito tempo o
 * comentario aqui so descrevia uma:
 *
 *   etapa COM cardapio (salgado, docinho, bolo)
 *     so entra o que esta no vocabulario dela. E o que impede o docinho de
 *     virar recheio de bolo mesmo se o modelo insistir.
 *
 *   etapa SEM cardapio (as outras oito, incluindo a abertura)
 *     entra o que a casa vende ou o que e da familia dela. Antes desta segunda
 *     regua a funcao devolvia tudo intocado, e o comentario dizia que nao.
 *
 * Devolve a leitura limpa e a lista do que foi barrado, pra ficar no rastro.
 */
export function leituraQueCabeNaEtapa(
  etapa: EtapaId,
  leitura: Leitura,
): {
  limpa: Leitura;
  barrados: string[];
  /**
   * O QUE A CASA NAO VENDE. So isto pode virar "nao achei no cardapio".
   *
   * Ate 28/08/2026 existia so o `barrados`, e ele misturava tres coisas
   * diferentes: o que nao existe, o que existe e e de outra etapa, e o que a
   * quantidade desmentiu. Quem chamava tinha que separar de novo por REGEX no
   * texto do rastro (`/e docinho, nao bolo/`), e a separacao vazava:
   *
   *   cliente >> 50 brigadeiro       (na etapa do salgado)
   *   padaria >> Nao achei brigadeiro no cardapio com esse nome.
   *
   * O brigadeiro estava guardado pra etapa do docinho na linha de cima. A
   * padaria negou o produto que ela mais vende enquanto o anotava.
   */
  naoExistem: string[];
  paraDepois: NonNullable<Leitura["itens"]>;
} {
  const vocab = vocabularioDaEtapa(etapa);
  if (!leitura.itens?.length)
    return { limpa: leitura, barrados: [], naoExistem: [], paraDepois: [] };

  // A ETAPA SEM CARDAPIO PROPRIO TAMBEM TEM PORTAO, SO QUE MAIS LARGO.
  //
  // Aqui a funcao devolvia tudo intocado, e o comentario dela jurava ser "a
  // ultima trava antes de virar pedido". Era, em tres das onze etapas. Nas
  // outras oito, incluindo a ABERTURA (onde a maioria dos pedidos nasce),
  // qualquer coisa que o modelo devolvesse entrava sem ninguem conferir.
  //
  // O que passa aqui: produto do catalogo, apelido que alcanca uma etapa, e
  // palavra de familia que a casa vende ("bolo", "torta", "salgados", "paes").
  // O que nao passa: o que nao tem nada a ver com o que ela faz.
  if (!vocab.length) {
    const naoExistem: string[] = [];
    const itens = leitura.itens.filter((i) => {
      // O NOME REDUZIDO TAMBEM E PERGUNTADO AO CATALOGO.
      //
      // "um laka" e "uns brigadeiros" nao existem em lugar nenhum escritos
      // assim, e as duas primeiras perguntas comparam letra por letra. Reduzir
      // antes faz o artigo e o plural pararem de esconder o produto.
      // OS TRES JEITOS SAO PERGUNTADOS, E NAO SO O MAIS REDUZIDO.
      //
      // A reducao tira o "s" de toda palavra, e ha produto cujo nome TERMINA em
      // "s": "4 leites" reduzido vira "4 leite", que nao existe no cardapio.
      // Medido: "um 4 leites", "um churros" e "um ingles" eram negados, e os
      // tres sao bolo que a casa vende.
      //
      //   cru        o que o modelo devolveu
      //   sem artigo "um 4 leites"    -> "4 leites"
      //   reduzido   "uns salgadinhos" -> "salgado"
      const jeitos = formasDoCliente(i.produto);
      if (jeitos.some((j) => existeNoCardapio(j) || etapaDesteProduto(j)) || daFamiliaDaCasa(i.produto)) {
        return true;
      }
      naoExistem.push(i.produto);
      return false;
    });
    return { limpa: { ...leitura, itens }, barrados: [...naoExistem], naoExistem, paraDepois: [] };
  }

  const permitido = new Set(vocab.map(semAc));

  const barrados: string[] = [];
  const naoExistem: string[] = [];
  // O QUE FOI CITADO FORA DA HORA NAO E JOGADO FORA.
  //
  // Ate 25/08/2026 o item barrado sumia: o codigo guardava so o NOME numa lista
  // para decidir o rumo da conversa, e o item em si era descartado. Quem
  // escrevia "50 brigadeiro, forminha rosa, e um bolo de 2 kg de 4 leites" na
  // etapa do docinho tinha o BOLO descartado, e se nao repetisse, nao existia.
  // E o mesmo defeito do quiche por outra porta.
  const paraDepois: NonNullable<Leitura["itens"]> = [];
  // O nome do cardapio COM acento, achado pelo nome sem acento. O quase acerto
  // reescreve o produto pro nome da casa, e nao pra versao sem acento dele.
  const comAcento = new Map(vocab.map((v) => [semAc(v), v]));

  const itens = leitura.itens.flatMap((bruto) => {
    let i = bruto;
    // O nome pode vir com o sabor colado ("esfirra de carne"): vale o comeco.
    const nome = semAc(i.produto);
    let cabe = [...permitido].some((v) => nome === v || nome.startsWith(v + " "));

    // UMA LETRA TROCADA NAO NEGA O PRODUTO. Ver `quaseIgual` la em cima: uma
    // letra de folga, cinco letras no minimo, e um unico candidato.
    if (!cabe) {
      const lista = [...permitido];
      const inteiro = quaseIgual(nome, lista);
      if (inteiro) {
        i = { ...i, produto: comAcento.get(inteiro) ?? inteiro };
        cabe = true;
      } else {
        // "coxinia de frango": o erro esta no produto e o resto e o sabor.
        const primeiro = nome.split(" ")[0];
        const soOPrimeiro = primeiro !== nome ? quaseIgual(primeiro, lista) : null;
        if (soOPrimeiro) {
          i = { ...i, produto: (comAcento.get(soOPrimeiro) ?? soOPrimeiro) + nome.slice(primeiro.length) };
          cabe = true;
        }
      }
    }

    // O NOME DO CATALOGO TAMBEM E O NOME DESTA ETAPA.
    //
    // O vocabulario mostrado ao modelo e o nome CURTO ("brigadeiro"), e o nome
    // do catalogo carrega a familia ("bolo brigadeiro"). Quem chegasse aqui
    // pelo nome do catalogo era barrado NA PROPRIA ETAPA dele:
    //
    //   etapa do bolo, item "bolo brigadeiro"
    //   antes  >> barrado, guardado pra depois, e a conversa mandada pro docinho
    //
    // O item entrava pela porta certa e era tratado como intruso. Quem sabe de
    // quem e o produto e o catalogo, e ele ja foi perguntado logo acima.
    if (!cabe && etapaDesteProduto(i.produto) === etapa) cabe = true;

    if (!cabe) {
      barrados.push(i.produto);
      // Existe no cardapio e alguma etapa vai perguntar por ele? Guarda pra la.
      if (etapaDesteProduto(i.produto)) {
        paraDepois.push(i);
        return [];
      }
      // EXISTE, E NENHUMA ETAPA VAI PERGUNTAR POR ELE.
      //
      // Sao 24 produtos da casa: pizza, cuca, cupcake, torta fria, empadao,
      // calzone, franciscano, pao. As etapas de produto sao tres (salgado,
      // docinho, bolo) e nenhuma delas cobre esses.
      //
      // Barrar aqui so podia perder o item, porque nao existe um "depois" pra
      // onde guardar: nenhuma etapa vai chamar por ele nunca. Antes disto, quem
      // estava escolhendo salgado e dizia "e uma torta fria" perdia a torta E
      // ouvia que a padaria nao tinha.
      if (existeNoCardapio(i.produto)) return [i];

      naoExistem.push(i.produto);
      return [];
    }

    // A QUANTIDADE DESEMPATA O NOME QUE SERVE PROS DOIS.
    //
    // Este e o caso da kemilly, e o filtro de vocabulario sozinho NAO resolve:
    // brigadeiro e sabor de bolo de verdade, entao "brigadeiro" passa na etapa
    // do bolo. Ela escreveu:
    //
    //   4 leites 1kg e 100 brigadeiros e 100 beijinhos
    //
    // Os 100 brigadeiros eram os docinhos dela. O que separa uma coisa da outra
    // nao e o nome, e a UNIDADE: bolo se vende por quilo (1, 2, 3 kg) e docinho
    // por unidade (25, 50, 100). Ninguem encomenda um bolo de 100 quilos.
    if (etapa === "bolo" && Number(i.qtd) > 20) {
      barrados.push(i.produto + " (" + i.qtd + ": e docinho, nao bolo)");
      // E ELE PRECISA SER GUARDADO, SENAO O CONSERTO PERDE O PEDIDO QUE VEIO
      // CONSERTAR.
      //
      // Este bloco nasceu da frase da kemilly, que esta escrita logo acima, e
      // ate 28/08/2026 ele terminava em `return []` seco. Rodando a frase dela
      // inteira na etapa do bolo:
      //
      //   4 leites 1kg e 100 brigadeiros e 100 beijinhos
      //   entra  >> 1 kg de bolo 4 leites
      //   sai    >> os 100 brigadeiros e os 100 beijinhos, sem rastro
      //
      // Com um item valido na frase, o desvio pra etapa do docinho la embaixo
      // nem acontece (ele exige que NADA tenha entrado). Os 200 docinhos dela
      // desapareciam do pedido -- que e exatamente o defeito que este bloco diz
      // ter consertado.
      //
      // A quantidade disse que o modelo carimbou de bolo o que e docinho, entao
      // guarda-se a leitura sem o carimbo, e so quando ela e docinho de
      // verdade.
      const semCarimbo = String(i.produto).replace(/^ *bolo +(caseiro +)?/i, "");
      if (etapaDesteProduto(semCarimbo) === "docinho") {
        paraDepois.push({ ...i, produto: semCarimbo });
      }
      return [];
    }

    return [i];
  });

  // O que foi barrado por ser de outra familia manda a conversa pra la, em vez
  // de sumir calado. Sumir calado foi o que fez os 200 docinhos da kemilly
  // desaparecerem do pedido.
  // A ETAPA DE DESTINO SAI DO ITEM GUARDADO, E NAO DE UM CHUTE.
  //
  // Isto era `etapa === "bolo" ? "docinho" : ...`, um pingue-pongue entre as
  // duas familias que nao olhava PARA O QUE tinha sido barrado. Medido em
  // 28/08/2026, na etapa do docinho:
  //
  //   cliente >> 50 xilofone
  //   antes   >> a conversa ia pra etapa do BOLO
  //
  // Xilofone nao existe, ninguem falou de bolo, e o cliente era levado pro bolo
  // porque a etapa da vez era a do docinho. Na etapa do salgado o mesmo codigo
  // devolvia `undefined` e nao levava a lugar nenhum, nem quando o item barrado
  // era claramente de outra familia.
  //
  // `paraDepois` sabe a resposta certa: ele so recebe item que existe E tem
  // etapa. Perguntar a ele e a mesma regra da fonte unica que vale no resto.
  const destinoGuardado = paraDepois.length ? etapaDesteProduto(paraDepois[0].produto) : null;
  const mandaPraOutraEtapa =
    destinoGuardado && destinoGuardado !== etapa && !itens.length && !leitura.falouDeOutraEtapa
      ? destinoGuardado
      : undefined;

  return {
    limpa: { ...leitura, itens, ...(mandaPraOutraEtapa ? { falouDeOutraEtapa: mandaPraOutraEtapa as EtapaId } : {}) },
    barrados,
    naoExistem,
    paraDepois,
  };
}
