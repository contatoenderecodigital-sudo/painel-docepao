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

import catalogo from "../dados/catalogo.json";
import type { EtapaId, PedidoEmMontagem } from "./etapas";
import { APELIDOS } from "../dados/apelidos";

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
   * ELE SO PERGUNTOU, NAO PEDIU.
   *
   * "Quanto e o cento de salgado?" nao e pedido de salgado. No sistema antigo a
   * cliente perguntou "0% lactose nao e sem acucar ne?" e ganhou um bolo 0%
   * lactose no pedido dela.
   *
   * A resposta sai do codigo, com o dado da casa, e nada e anotado.
   */
  /**
   * A CONVERSA NAO E UM PEDIDO.
   *
   * A Rota C: reclamacao e cancelamento sao sempre da equipe, e status a Dora
   * responde se souber. Ate 24/08/2026 quem escrevia "meu pao veio queimado"
   * caia no fluxo de pedido e recebia oferta de docinho.
   */
  situacao?: "reclamacao" | "cancelar" | "status";
  perguntou?: {
    sobre: "preco" | "horario" | "endereco" | "pagamento" | "entrega" | "prazo" | "desconto" | "outro";
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

const nomes = (lista: { nome: string }[]) => lista.map((i) => String(i.nome));

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
  const semAc = (t: string) =>
    String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
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

function comOsApelidos(canonicos: string[]): string[] {
  const semAc = (t: string) =>
    String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const tem = new Set(canonicos.map(semAc));
  const extras: string[] = [];
  for (const [canonico, lista] of Object.entries(APELIDOS)) {
    if (tem.has(semAc(canonico))) extras.push(...lista);
  }
  return [...canonicos, ...extras];
}

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
      return comOsApelidos([
        ...nomes((catalogo.salgados?.frito?.itens ?? []) as { nome: string }[]),
        ...nomes((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[]),
      ]);
    case "docinho":
      return comOsApelidos(nomes((catalogo.doces?.itens ?? []) as { nome: string }[]));
    case "bolo":
      return ((catalogo.bolos_recheados?.faixas ?? []) as { sabores?: string[] }[])
        .flatMap((f) => f.sabores ?? [])
        .map(String);
    default:
      return [];
  }
}

/**
 * A INSTRUCAO DA ETAPA.
 *
 * Curta de proposito. A carta de trinta paginas da versao antiga existia porque
 * a IA precisava saber tudo pra decidir tudo; aqui ela decide uma coisa so.
 */
/** Que dia e hoje, pelo relogio da padaria. O modelo nao tem relogio. */
function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export function instrucaoDaEtapa(etapa: EtapaId, p: PedidoEmMontagem): string {
  const vocab = vocabularioDaEtapa(etapa);
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
  // NA FESTA, O NUMERO JA FOI COMBINADO.
  //
  // Ele aceitou "300 salgados no total" e agora diz quais quer. Se o modelo
  // inventar uma quantidade, ela briga com a proposta; se devolver 0, o codigo
  // reparte os 300 entre o que ele escolheu.
  const semNumero =
    p.baseAceita && p.base
      ? " Se ele NÃO disser a quantidade, devolva qtd 0: o total já foi combinado na proposta."
      : "";

  const recusa = (familia: string) =>
    " Se ele disser que NÃO quer " + familia + " (não quero, sem " + familia +
    ", pode tirar, deixa pra lá), devolva naoQuer com a palavra " + familia + ".";

  const daEtapa: Record<string, string> = {
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
 * A LEITURA CABE NA ETAPA?
 *
 * Ultima trava antes de virar pedido: item que nao esta no vocabulario da etapa
 * nao entra, por mais que a IA tenha devolvido. E o que impede o docinho de
 * virar recheio de bolo mesmo se o modelo insistir.
 *
 * Devolve a leitura limpa e a lista do que foi barrado, pra ficar no rastro.
 */
/**
 * O ITEM E DE OUTRA ETAPA, OU NAO EXISTE?
 *
 * Sao coisas diferentes e o tratamento tem que ser diferente. O que existe no
 * cardapio e so foi citado fora da hora fica GUARDADO para quando a conversa
 * chegar la. O que nao existe continua sendo recusado, porque ai a recusa e
 * honesta e o cliente precisa ser avisado.
 */
export function etapaDesteProduto(produto: string): EtapaId | null {
  const semAc = (t: string) =>
    String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  // O PREFIXO "bolo" PRECISA SAIR ANTES DE COMPARAR.
  //
  // O vocabulario da etapa do bolo lista os sabores como o cardapio escreve,
  // sem prefixo ("4 leites"). O nome canonico do sistema carrega ele ("bolo 4
  // leites"), porque e o prefixo que separa o bolo do docinho de mesmo nome.
  //
  // Quando o canonico passou a valer, em 26/08/2026, esta comparacao parou de
  // casar e o bolo guardado nunca era aplicado: ficava estacionado pra sempre.
  // Peguei medindo UMA conversa contra o banco antes de rodar a bateria.
  const nome = semAc(produto).replace(/^bolo +/, "");
  for (const etapa of ["salgado", "docinho", "bolo"] as EtapaId[]) {
    const cabe = vocabularioDaEtapa(etapa)
      .map(semAc)
      .some((v) => nome === v || nome.startsWith(v + " "));
    if (cabe) return etapa;
  }
  return null;
}

export function leituraQueCabeNaEtapa(
  etapa: EtapaId,
  leitura: Leitura,
): { limpa: Leitura; barrados: string[]; paraDepois: NonNullable<Leitura["itens"]> } {
  const vocab = vocabularioDaEtapa(etapa);
  if (!vocab.length || !leitura.itens?.length) return { limpa: leitura, barrados: [], paraDepois: [] };

  const semAc = (t: string) =>
    String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const permitido = new Set(vocab.map(semAc));

  const barrados: string[] = [];
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

    if (!cabe) {
      barrados.push(i.produto);
      // Existe no cardapio e so nao e a hora? Guarda para quando for.
      if (etapaDesteProduto(i.produto)) paraDepois.push(i);
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
      return [];
    }

    return [i];
  });

  // O que foi barrado por ser de outra familia manda a conversa pra la, em vez
  // de sumir calado. Sumir calado foi o que fez os 200 docinhos da kemilly
  // desaparecerem do pedido.
  const mandaPraOutraEtapa =
    barrados.length && !itens.length && !leitura.falouDeOutraEtapa
      ? (etapa === "bolo" ? "docinho" : etapa === "docinho" ? "bolo" : undefined)
      : undefined;

  return {
    limpa: { ...leitura, itens, ...(mandaPraOutraEtapa ? { falouDeOutraEtapa: mandaPraOutraEtapa as EtapaId } : {}) },
    barrados,
    paraDepois,
  };
}
