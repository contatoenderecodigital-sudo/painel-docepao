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
import { ehNomeDeFamilia, ehPizzaQueNaoESalgado, nomeDaFamilia } from "./generico";
import { identificarProduto } from "./produto";

/**
 * SOBRE O QUE ELE PODE TER PERGUNTADO.
 *
 * Array e nao so uniao de tipo porque QUEM RECEBE a resposta do modelo precisa
 * conferir em tempo de execucao. Uniao de tipo o compilador apaga; o modelo
 * devolve texto, e texto nao passa por compilador nenhum.
 */
export const SOBRE_O_QUE = [
  "preco", "horario", "endereco", "pagamento", "pix", "entrega", "prazo", "desconto", "opcoes", "outro",
] as const;
export type SobreOQue = (typeof SOBRE_O_QUE)[number];

/** Uma fala da conversa, do jeito que o modelo a recebe. */
export type TurnoDaConversa = { papel: "user" | "assistant"; conteudo: string };

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
  /**
   * ELE PEDIU PRA CASA ESCOLHER OS TIPOS.
   *
   * "escolhe voce", "pode ser sortido", "fica a seu criterio". Nao e lista de
   * palavras: o modelo le a intencao e devolve o booleano. O codigo monta o
   * sortido pelo catalogo e pela regra da dona (20 por sabor, 5 no cento).
   *
   * Aceitar a proposta ("pode ser") NAO e isto: ali ele so disse o quanto.
   */
  delegaEscolha?: boolean;
  /**
   * EM QUAIS FAMILIAS ELE DELEGOU. "os tipos de salgado e docinho pode
   * escolher voce" nao entrega o SABOR DO BOLO pra casa. Medido em producao em
   * 03/09/2026: a delegacao montava o sortido das tres familias da base, e o
   * bolo saia "4 leites" sem o cliente ter escolhido. Vazio = tudo.
   */
  delegaEm?: string[];
  /** O que ele disse que NAO quer, pra nao oferecer de novo. */
  naoQuer?: string[];
  /**
   * O QUE ELE PEDIU PRA TIRAR DO PEDIDO, NAS PALAVRAS DELE.
   *
   * Isto NAO e o `naoQuer`, que fala de FAMILIA ("nao quero docinho") e de peca
   * do bolo. E tirar uma linha que ja esta no pedido.
   *
   * Medido em producao em 30/08/2026: o cliente pediu duas pizzas, disse "tira
   * a de calabresa" e fechou pagando pelas duas, R$ 240,00. O rastro mostrou o
   * modelo devolvendo `1x pizza inteira [frango com catupiry]`, que era o que
   * sobra, porque nao existia outro jeito de ele dizer isso. E o fluxo estava
   * certo em ignorar: item que SOME da leitura nao pode virar remocao, senao o
   * pedido se esvazia sozinho toda vez que o modelo esquece de repetir uma
   * linha.
   *
   * VEM A FRASE, NAO A LINHA. O modelo devolve a intencao com as palavras do
   * cliente ("a de calabresa", "o bolo") e quem decide QUAL linha sai e o
   * codigo, casando contra o pedido de verdade. Deixar o modelo apontar a linha
   * seria por decisao de dinheiro no prompt.
   */
  tirar?: string[];
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
  /**
   * A FOTO QUE CHEGOU E O COMPROVANTE DO PIX, e nao a referencia da peca.
   *
   * Quem da sentido a foto e a conversa: se a padaria acabou de pedir o
   * comprovante, a foto e o comprovante. Ate 03/09/2026 isso era uma regex
   * sobre a ultima fala; agora o modelo, que ve a conversa, diz.
   */
  comprovante?: boolean;
  /**
   * A PADARIA MANDOU O VALOR FINAL (com o topo orcado pela equipe) e perguntou
   * se esta certo. Ele aceitou = true; recusou, achou caro ou quer mudar o
   * valor = false. Ate 03/09/2026 isto era uma lista de palavras ANTES do
   * modelo, e "beleza, mas muda pra sexta" virava aceite e perdia a mudanca.
   */
  aceitouValor?: boolean;
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
const CATEGORIAS_NOMEADAS: Record<string, readonly string[]> = {
  salgado: ["salgado_frito", "salgado_assado"],
  docinho: ["docinho"],
  bolo: CATEGORIAS_DE_BOLO,
  // Papel de arroz e topo. Ja tinham dono, e o dono e a etapa das pecas.
  pecas_do_bolo: ["adicional_bolo"],
};

/**
 * NENHUMA CATEGORIA DO CATALOGO FICA SEM DONO.
 *
 * Aqui havia um objeto de tres linhas, e o comentario dele admitia o buraco:
 * "categoria que nao esta aqui existe e e vendida (pizza, cuca, cupcake,
 * torta, calzone), so nao tem etapa que pergunte por ela".
 *
 * Era uma lista minha, que e justamente o que a dona proibiu em 27/08/2026, e
 * custava um quarto do cardapio. Medido em 30/08/2026:
 *
 *   24 dos 86 produtos nao pertenciam a etapa nenhuma
 *   10 categorias orfas: padaria, cupcake, pizza, torta_fria, empadao,
 *      torta_recheada, bolo_salgado, franciscano, calzone
 *
 * O estrago nao era "a padaria nao pergunta". Era pior: a pergunta ate saia
 * (por `perguntaDaFamilia`), mas a RESPOSTA chegava numa etapa que nao
 * conhece aquele produto, e `leituraQueCabeNaEtapa` jogava fora. A conversa
 * repetia a mesma pergunta ate o cliente desistir. Medido contra a producao:
 *
 *   padaria >> Voce quer a pizza inteira, meia ou redonda?
 *   cliente >> quero 2 inteiras, uma de calabresa e uma de frango
 *   padaria >> Voce quer a pizza inteira, meia ou redonda?    (de novo)
 *   cliente >> dia 05/09 as 19h, nome Rodrigo Zanella, pix
 *   padaria >> Qual pizza voce prefere: inteira, meia ou redonda?
 *
 * O pedido nunca fechou e os dados dele se perderam no laco.
 *
 * Cada uma das nove familias orfas caia nisso por uma porta propria, e cada
 * uma virava um remendo. E por isso que as correcoes nao terminavam.
 *
 * Agora o dono das categorias que sobram e uma etapa so, e a conta e do
 * CATALOGO: se a dona cadastrar uma familia amanha, ela ja nasce com dono,
 * sem ninguem editar este arquivo. O teste `toda-categoria-tem-etapa.cjs`
 * cobra isso.
 */
export function categoriasSemEtapaPropria(): string[] {
  const comDono = new Set(Object.values(CATEGORIAS_NOMEADAS).flat());
  const todas = new Set(produtosDaCasa().map((p) => String(p.categoria || "")));
  return [...todas].filter((c) => c && !comDono.has(c)).sort();
}

/** As etapas que perguntam por produto, na ordem em que a conversa anda. */
const ETAPAS_DE_PRODUTO = [
  ...Object.keys(CATEGORIAS_NOMEADAS),
  "resto_do_cardapio",
] as EtapaId[];

/** As categorias que esta etapa atende. Junta o nomeado e o que sobra. */
export function categoriasDaEtapa(etapa: EtapaId): readonly string[] {
  if (etapa === "resto_do_cardapio") return categoriasSemEtapaPropria();
  return CATEGORIAS_NOMEADAS[etapa] ?? [];
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
      return comOsApelidos(daLista(...categoriasDaEtapa("salgado")));
    case "docinho":
      return comOsApelidos(daLista(...categoriasDaEtapa("docinho")));
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
      return comOsApelidos(daLista(...categoriasDaEtapa("bolo")));
    case "resto_do_cardapio":
      // TUDO QUE A CASA VENDE E NAO CABE NAS TRES DE CIMA.
      //
      // Pizza, torta, empadao, cupcake, pao, cuca, calzone, franciscano e
      // bolo salgado. Vinte e quatro produtos que ate 30/08/2026 nao tinham
      // etapa nenhuma, e cujas respostas eram descartadas por chegarem numa
      // etapa que nao os conhecia.
      //
      // A lista sai do catalogo, entao familia nova da dona ja entra aqui.
      return comOsApelidos(daLista(...categoriasDaEtapa("resto_do_cardapio")));
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
 * O CARDAPIO INTEIRO, AGRUPADO POR CATEGORIA, DO JEITO QUE O CLIENTE FALA.
 *
 * Ate 03/09/2026 o modelo via so o vocabulario DA ETAPA, e era instruido a
 * calar sobre o resto ("devolva falouDeOutraEtapa em vez de anotar"). Quem
 * pedia "50 brigadeiro e um bolo de 2 kg" na etapa do docinho tinha o bolo
 * jogado fora, e o codigo remontava por regex o que a instrucao tinha mandado
 * o modelo esconder. Com o cardapio inteiro e a conversa junto, o modelo
 * anota tudo e quem separa por familia e o `aplicar`, que ja sabe a categoria.
 *
 * Agrupado porque a categoria e informacao: e ela que diz que "brigadeiro" em
 * "bolo festa (por quilo)" e outro produto do "brigadeiro" em "docinho".
 * Nenhum nome escrito aqui: tudo sai de `produtosDaCasa()`.
 */
export function cardapioDaCasaParaOModelo(): string {
  const porCategoria = new Map<string, { nomes: string[]; unidade: string }>();
  for (const p of produtosDaCasa()) {
    const cat = String(p.categoria || "outro");
    const grupo = porCategoria.get(cat) ?? { nomes: [], unidade: p.unidade };
    // O BOLO VAI COM O NOME INTEIRO ("bolo brigadeiro", "bolo caseiro cenoura").
    // Medido em 03/09/2026: listando so o sabor, o modelo devolvia o ROTULO da
    // categoria como produto ("bolo festa" + sabor "brigadeiro"), e "bolo
    // festa" nao existe no cardapio. Com o nome inteiro na lista ele copia o
    // nome, que e o que o resto do sistema espera.
    const nome = (CATEGORIAS_DE_BOLO as readonly string[]).includes(cat) ? p.nome : p.nomeCurto;
    if (!grupo.nomes.includes(nome)) grupo.nomes.push(nome);
    porCategoria.set(cat, grupo);
  }
  const linhas: string[] = [];
  for (const [cat, g] of porCategoria) {
    // Apelido que repete um nome ja listado nao entra duas vezes.
    const vistos = new Set<string>();
    const nomes = comOsApelidos(g.nomes).filter((n) => {
      const chave = semAc(n);
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
    linhas.push("- " + cat.replace(/_/g, " ") + (g.unidade === "kg" ? " (por quilo)" : "") + ": " + nomes.join(", "));
  }
  return linhas.join("\n");
}

/**
 * O QUE JA ESTA ANOTADO, como lembrete curto depois da conversa.
 *
 * Vai como mensagem de sistema DEPOIS do historico e antes da frase do cliente,
 * nunca dentro do prefixo do system (que e o que a OpenAI guarda em cache). E o
 * que deixa o modelo saber que "muda pra 100" fala das 200 coxinhas que ja
 * estao no pedido, e que o "2 kg" e do bolo que ja foi escolhido.
 */
export function resumoDoAnotado(p: PedidoEmMontagem): string | null {
  const partes: string[] = [];
  if (p.itens.length) {
    partes.push(
      "itens: " +
        p.itens
          .map((i) => (Number(i.qtd) > 0 ? i.qtd + " " : "(sem quantidade) ") + i.produto + (i.obs ? " (" + i.obs + ")" : ""))
          .join("; "),
    );
  }
  if (p.ehFesta) partes.push("é festa" + (p.pessoas ? " pra " + p.pessoas + " pessoas" : ""));
  // O BOLO DA BASE QUE AINDA NAO TEM SABOR e um buraco que o modelo precisa ver:
  // sem isto, "brigadeiro" respondendo "qual sabor do bolo?" caia no docinho
  // brigadeiro ja anotado, e o modelo devolvia {} (medido em 03/09/2026).
  const temBolo = p.itens.some((i) => String(i.categoria || "").startsWith("bolo") || /^bolo/i.test(String(i.produto)));
  if (p.ehFesta && p.base && Number(p.base.boloKg) > 0 && !temBolo) {
    partes.push("falta o sabor do bolo (" + String(p.base.boloKg).replace(".", ",") + " kg da proposta)");
  }
  const d: Partial<PedidoEmMontagem["dados"]> = p.dados ?? {};
  const retirada = [
    d.data ? "dia " + d.data : null,
    d.hora ? "às " + d.hora : null,
    d.nome ? "no nome de " + d.nome : null,
    d.pagamento ? "pagamento " + d.pagamento : null,
  ].filter(Boolean);
  if (retirada.length) partes.push("retirada: " + retirada.join(", "));
  if (p.naoQuer?.length) partes.push("não quer: " + p.naoQuer.join(", "));
  // O QUE JA FOI RESPONDIDO TAMBEM ENTRA. Medido em 03/09/2026: com a forminha
  // fora do lembrete, o modelo via "rosa" no historico, achava que faltava
  // anotar, devolvia so `forminha: rosa` de novo e IGNORAVA o "brigadeiro" que
  // respondia a pergunta do bolo. O que esta anotado nao precisa ser repetido.
  if (p.forminha) partes.push("forminha: " + p.forminha);
  const pecas = [
    p.pecas?.topo === true ? "com topo" : p.pecas?.topo === false ? "sem topo" : null,
    p.pecas?.papelDeArroz === true ? "com papel de arroz" : p.pecas?.papelDeArroz === false ? "sem papel de arroz" : null,
  ].filter(Boolean);
  if (pecas.length) partes.push("bolo " + pecas.join(", "));
  if (p.tema) partes.push("tema: " + p.tema);
  if (p.escrito) partes.push("escrito na peça: " + p.escrito);
  if (p.prato) partes.push("embalagem: " + p.prato);
  if (!partes.length) return null;
  return "Já está anotado no pedido. " + partes.join(". ") + ".";
}

export function instrucaoDaEtapa(etapa: EtapaId, p: PedidoEmMontagem): string {
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
  // O CARDAPIO INTEIRO, EM TODA ETAPA. A lista por etapa era o que obrigava o
  // modelo a calar sobre o que nao coubesse nela, e o codigo a adivinhar o
  // resto por regex. Ver `cardapioDaCasaParaOModelo`.
  const lista =
    "\n\nCardápio da casa. Use o nome daqui mesmo que ele erre a escrita; " +
    "se não for nenhum, repita o que ele escreveu:\n" + cardapioDaCasaParaOModelo();

  const comum =
    "Você é a atendente de uma padaria anotando um pedido pelo WhatsApp. " +
    "Você vê a conversa até aqui e o que já está anotado. " +
    "Diga o que a ÚLTIMA mensagem do cliente muda no pedido, entendendo ela pelo contexto: " +
    "a pergunta que a padaria acabou de fazer é o que dá sentido a uma resposta curta " +
    "(\"10\", \"sim\", \"2 kg\", \"de frango\"). " +
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
    // NADA SOME. A instrucao antiga mandava o modelo devolver falouDeOutraEtapa
    // "em vez de anotar" o que nao fosse da etapa. O item sumia sem rastro e o
    // codigo tentava remontar pela frase. Agora ele anota tudo, e quem separa
    // por familia e o `aplicar`, que sabe a categoria de cada produto.
    "- Anote TUDO que ele pediu, de qualquer família, mesmo que a padaria tenha " +
    "perguntado de outra coisa. Nada some." + String.fromCharCode(10) +
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
    // TIRAR VALE EM QUALQUER ETAPA, pelo mesmo motivo de mudar a quantidade.
    //
    // E vem a FRASE dele, nao a linha: quem decide qual linha sai e o codigo,
    // casando contra o pedido de verdade. Sem isto o cliente que pediu duas
    // pizzas e tirou uma fechava pagando pelas duas, porque o unico jeito de o
    // modelo falar disso era repetir o que sobra, e repetir o que sobra e
    // indistinguivel de esquecer uma linha.
    // CURTA DE PROPOSITO, e o exemplo do JSON faz o resto do ensino.
    //
    // A primeira versao explicava tudo aqui e estourou o teto de 1400 em tres
    // etapas. A mais apertada, `pecas_do_bolo`, tinha 35 caracteres de folga, e
    // o proprio teto avisa que cortar ali e reintroduzir defeito conhecido pra
    // ganhar caractere. O exemplo em `pensar-openai.ts` ja mostra
    // `"tirar": ["a de calabresa"]`, e exemplo ensina formato melhor que frase.
    "- Vai tirar item? use tirar." + String.fromCharCode(10) +
    "- Hoje é " + hojeEmSaoPaulo() + ", e retirada é sempre no futuro." + String.fromCharCode(10) +
    "- Perguntou em vez de pedir? perguntou.sobre = preco (com familia), " +
    "horario, endereco, pagamento, pix, entrega, prazo, desconto, ou opcoes (\"quais tem?\", " +
    "\"que sabores?\", \"que tipos?\", com familia)." + String.fromCharCode(10) +
    // PEDIR A CHAVE E OUTRA COISA DE PERGUNTAR COMO PAGA.
    //
    // Cliente real em 31/08/2026, logo depois de fechar: "Show consegue me
    // passar o pix? dai ja pago". Ele ouviu a lista de formas de pagamento e
    // ficou sem pagar. Quem quer a chave ja escolheu como paga.
    // Desconto, preco beneficente e "da uma ajuda?" sao a mesma pergunta, e a
    // resposta e sempre da equipe. A IA nao pode soltar o preco por unidade que
    // a dona usa nesses casos: negociacao virando tabela custa margem.
    "- Pediu desconto, falou que e beneficente ou pediu ajuda = desconto." + String.fromCharCode(10) +
    "- Reclamou do que comprou = situacao \"reclamacao\". Quer cancelar = " +
    "\"cancelar\". Pergunta de pedido já feito = \"status\". Mensagem que não é assunto " +
    "da padaria (propaganda, outro negócio, número errado) = \"fora_do_assunto\", nunca {}. " +
    "Quer falar com uma pessoa, a dona, a equipe ou um atendente = \"humano\"." + String.fromCharCode(10) +
    "- Pediu pra apagar tudo e começar o pedido do zero = recomecar true (não é tirar item)." + String.fromCharCode(10) +
    "- Pergunta e reclamação NÃO viram item." + String.fromCharCode(10) +
    "- Foto que chega depois de a padaria pedir o comprovante do pix = comprovante true." + String.fromCharCode(10) +
    "- A padaria mandou o VALOR FINAL do pedido (com o topo) e perguntou se está certo? " +
    "Aceitou = aceitouValor true; recusou, achou caro ou quer outro valor = aceitouValor false. " +
    "Se ele aceitou mas pediu pra mudar outra coisa (data, item), mande as duas coisas."

  // QUANTIDADE QUE O CLIENTE NAO DISSE E ZERO. SEMPRE, E EM TODO PRODUTO.
  //
  // Regra dele, em 02/09/2026: *"sempre que o cliente quiser bolo ele tem que
  // pedir quantos kg, se ele já não tiver dito ou concordado"*, e a mesma coisa
  // pra docinho, pra salgado e pro resto.
  //
  // ATE HOJE ISTO SO VALIA DENTRO DA FESTA. Fora dela o modelo devolvia 1 por
  // padrao, e 1 é indistinguível de "ele disse um". Medido na conversa dele de
  // 02/09/2026:
  //
  //   cliente >> quero bolo, salgados, docinhos e cupcakes
  //   modelo  >> 1x bolo ;; 1x salgado ;; 1x docinho ;; 1x cupcake
  //   pedido  >> fechou em R$ 77,65, com UM de cada e o bolo sem peso nenhum
  //
  // Ele nao tinha dito quantidade de coisa nenhuma. O pedido inteiro era um
  // chute, e o chute vira dinheiro errado na comanda e no caixa.
  //
  // ZERO QUER DIZER "NINGUEM FALOU", e nao "zero unidades". Quem cobra a
  // resposta e a etapa, em `etapas.ts`: item em zero nao deixa o pedido fechar,
  // e a padaria pergunta na unidade em que a casa cobra.
  //
  // NA FESTA ELE JA CONCORDOU, e por isso a frase muda: ali o total saiu da
  // proposta que ele aceitou, e o codigo reparte em vez de perguntar de novo.
  const semNumero =
    p.baseAceita && p.base
      ? " Se ele NÃO disser a quantidade, devolva qtd 0: o total já foi combinado na proposta."
      : " Não disse quantidade? qtd 0, nunca 1.";

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

  // UMA LINHA POR SABOR, COM A QUANTIDADE DE CADA.
  //
  // Medido ao vivo em 30/08/2026, com o container no SHA da main:
  //
  //   cliente >> quero 2 inteiras, uma de calabresa e uma de frango
  //   no banco >> 1 pizza inteira (calabresa | frango), R$ 120,00
  //
  // Ele pediu duas e a padaria cobrou uma: R$ 120,00 no lugar de R$ 240,00, e
  // a cozinha receberia uma pizza so com dois sabores escritos no recado.
  //
  // O codigo ja aceita duas linhas. Quem devolvia uma era o modelo, lendo
  // "2 inteiras, uma de X e uma de Y" como um item so.
  //
  // FICA NAS QUATRO ETAPAS DE PRODUTO, E NAO NO BLOCO COMUM. Tentei no comum
  // primeiro e o teto de 1400 caracteres reprovou `pecas_do_bolo` com 1437.
  // O teste estava certo: papel de arroz e topo nao tem sabor nenhum, entao a
  // regra la seria carta a mais sem nada em troca. Vale pra qualquer familia
  // ("50 de carne e 50 de frango"), e por isso e escrita uma vez so.
  const porSabor =
    " \"uma de X e uma de Y\" = uma linha por sabor, com a quantidade de cada.";

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
      "A padaria acabou de perguntar QUANTAS PESSOAS vão na festa. Um número " +
      "solto aqui é pessoas. Se ele falar de outra coisa, anote o que ele disse.",
    base_da_festa:
      "A etapa é ACEITAR A BASE da festa que a padaria acabou de propor. " +
      "Se ele aceitou como está, aceitouBase = true. Se ele pediu para mudar " +
      "quantidade, devolva o que ele quer em itens. Se ele disse que não quer " +
      "alguma família (salgado, docinho, bolo), devolva em naoQuer." +
      " Pediu pra casa escolher os tipos? delegaEscolha = true, sem itens. " +
      "{} nessa frase e erro: a escolha da casa muda o pedido. " +
      "Aceitar a proposta não é pedir pra casa escolher.",
    salgado:
      "A padaria está perguntando QUAIS SALGADOS ele quer. Uma resposta curta " +
      "aqui (\"de frango\", \"50 de cada\") é sobre os salgados." +
      recusa("salgado"),
    docinho:
      "A padaria está perguntando QUAIS DOCINHOS ele quer (e depois a cor da " +
      "forminha). Nome que o cardápio também vende como bolo é o docinho aqui, " +
      "sem o prefixo de bolo, a não ser que ele fale de bolo." +
      recusa("docinho"),
    bolo:
      "A padaria está perguntando O SABOR DO BOLO (e depois o peso). A resposta dele " +
      "agora é o sabor do bolo: devolva em itens o produto \"bolo <sabor>\" (ex.: " +
      "\"bolo brigadeiro\", \"bolo 4 leites\"), mesmo que exista docinho de mesmo nome " +
      "já anotado, e não mexa nos docinhos. Dois sabores = bolo misto: um item por sabor." +
      // A frase da embalagem saiu: com ela na instrucao o modelo devolvia
      // `prato: "aberto"` sem o cliente ter dito nada (medido 3 de 3 em
      // 03/09/2026). Quem escrever "prato aberto" ou "com tampa" continua
      // sendo lido pelo leitor da frase.
      recusa("bolo"),
    resto_do_cardapio:
      "A padaria está perguntando QUAL TIPO ou RECHEIO do que ele já pediu " +
      "(pizza, torta, empadão, cupcake, pão, cuca, calzone). Use o nome do " +
      "cardápio inteiro (\"pizza inteira\", não \"inteira\").",
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
      "Se ele quer, devolva os itens; se recusou, devolva naoQuer com " +
      "\"docinho\" e \"bolo\". Se falou de outra coisa, leia normalmente: a oferta é " +
      "opcional e não trava a conversa.",
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
      "A etapa é CONFIRMAR O PEDIDO. Só se ele aprovou o pedido que acabou de " +
      "ver, devolva confirmou = true. Se ele pediu para mudar algo, devolva falouDeOutraEtapa " +
      "com a etapa do que ele quer mudar.",
    // O pedido ja esta com a equipe e esta etapa nunca e a da vez (`cumprida`
    // devolve true sempre). Fica aqui porque o tipo cobra, e cobrar e o ponto:
    // no dia em que ela virar uma etapa de verdade, isto aparece.
    registrado: "",
    abertura:
      "A conversa está começando e você ainda não sabe o que ele quer." + String.fromCharCode(10) + 
      "Se ele falou de uma festa ou do número de pessoas, devolva ehFesta = true." + String.fromCharCode(10) + 
      "Se ele pediu um produto direto (100 coxinhas, uma torta), devolva em itens." + String.fromCharCode(10) + 
      "Se ele PERGUNTOU de uma família sem quantidade, devolva falouDeOutraEtapa " +
      "com a etapa dela. Perguntar já diz do que ele quer falar." + String.fromCharCode(10) +
      "Se ele só cumprimentou, devolva {} e não invente nada: quem diz o que " +
      "quer é ele.",
  };

  // AS REGRAS DO CARDAPIO VALEM EM TODA ETAPA, E POR ISSO MORAM NUM BLOCO SO.
  //
  // Ate 03/09/2026 cada uma vivia so na etapa onde alguem tinha visto o
  // defeito: "qtd 0, nunca 1" so na festa (e o pedido de 02/09 fechou "um de
  // cada" na abertura), "uma linha por sabor" so nas etapas de produto (e a
  // pizza dupla fechou como uma na abertura), o prefixo do bolo so na etapa do
  // bolo (e o bolo virou docinho fora dela). Regra que vale num caminho e nao
  // em todos e o que produz o pedido errado justo no caminho que ninguem
  // testou.
  //
  //   "2 inteiras" sao 2: o modelo lia "2 inteiras, uma de calabresa e uma de
  //   frango" como UMA pizza de dois sabores (R$ 120,00 em vez de R$ 240,00).
  //   Terceira redacao desta regra; as duas anteriores falavam de linha e de
  //   sabor, e o que ele errava era o numero.
  //
  //   O prefixo do bolo existe porque "brigadeiro" e docinho de R$ 1,25 E bolo
  //   de R$ 46,90 o quilo. Quem desempata e o contexto, que agora ele tem.
  const regrasDoCardapio =
    "REGRAS DO CARDÁPIO, em qualquer etapa:" + String.fromCharCode(10) +
    "-" + semNumero + String.fromCharCode(10) +
    "- O número que ele disse é a quantidade: \"2 inteiras\" são 2, mesmo que " +
    "ele detalhe os sabores depois." + porSabor + String.fromCharCode(10) +
    "- O sabor ou recheio vai no campo sabor; recado pra cozinha vai em obs." + String.fromCharCode(10) +
    "- Bolo: o peso em quilos vai na quantidade. Sabor de bolo se escreve com o " +
    "prefixo (\"bolo 4 leites\", \"bolo brigadeiro\"); caseiro só se ele disse " +
    "caseiro (\"bolo caseiro cenoura\"). Sabor de bolo que NÃO está na lista (ninho, " +
    "pistache): produto \"bolo\" e o sabor no campo sabor, nunca um nome inventado. " +
    "O mesmo nome sem prefixo é o docinho. " +
    "Quem desempata é o contexto: o que a padaria perguntou e a unidade " +
    "(quilo é bolo, unidades é docinho)." + String.fromCharCode(10) +
    "- Mini pizza é salgado assado. Pizza inteira, meia, redonda e calzone não " +
    "são salgado. Use o nome inteiro (\"pizza inteira\", não \"inteira\")." + String.fromCharCode(10) +
    "- Cor da forminha dos docinhos vai em forminha." + String.fromCharCode(10) +
    "- Pediu pra casa escolher os tipos ou o sabor? delegaEscolha true, sem itens, e delegaEm " +
    "com as famílias que ele delegou (salgado, docinho, bolo). Delegou tudo? as três. " +
    "Aceitar a proposta não é pedir pra casa escolher.";

  return comum + String.fromCharCode(10, 10) + regrasDoCardapio + String.fromCharCode(10, 10) + (daEtapa[etapa] ?? "") + lista;
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
  const daCasa = produtoNoComeco(produto) ?? produtoPorNome(identificarProduto(produto).produto);
  if (daCasa) {
    for (const etapa of ETAPAS_DE_PRODUTO) {
      if (categoriasDaEtapa(etapa).includes(daCasa.categoria)) return etapa;
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
  if (!leitura.itens?.length)
    return { limpa: leitura, barrados: [], naoExistem: [], paraDepois: [] };

  // O PORTAO DEIXOU DE SER POR ETAPA EM 03/09/2026.
  //
  // Ate entao a etapa do salgado so deixava passar salgado, e o resto era
  // "guardado pra depois" ou mandava a conversa pra outra etapa por conta
  // propria (`falouDeOutraEtapa` inventado aqui). Existia porque o modelo so
  // via o vocabulario da etapa. Agora ele ve a conversa, o pedido e o cardapio
  // inteiro, e anota tudo; quem separa por familia e o `aplicar`, pelo
  // catalogo. O que sobra aqui e o que NAO depende de etapa:
  //
  //   1. o nome existe no cardapio (ou e familia que a casa vende), senao e
  //      recusado com verdade e o cliente ouve "nao achei isso";
  //   2. uma letra trocada nao nega o produto (a regua de letras, como rede);
  //   3. a unidade desempata o nome que serve pros dois: "bolo brigadeiro" em
  //      100 unidades e o docinho, e "brigadeiro" respondendo a pergunta do
  //      sabor do bolo, em quilos, e o bolo. Isto sai do catalogo (quem e por
  //      quilo, quem e por unidade, e o teto de 6 kg), nao da etapa.
  const todos = produtosDaCasa();
  const vocab = comOsApelidos(todos.map((p) => p.nomeCurto));
  const permitido = new Set(vocab.map(semAc));
  const comAcento = new Map(vocab.map((v) => [semAc(v), v]));
  const deBolo = todos.filter((p) => (CATEGORIAS_DE_BOLO as readonly string[]).includes(p.categoria));
  const porUnidadeComEsteNome = (curto: string) =>
    todos.find((p) => p.unidade === "un" && semAc(p.nomeCurto) === semAc(curto));

  const barrados: string[] = [];
  const naoExistem: string[] = [];
  const paraDepois: NonNullable<Leitura["itens"]> = [];

  // O ROTULO DE UMA CATEGORIA ("bolo festa", "salgado frito") nao e produto:
  // e a familia. Se o modelo devolver o rotulo, vale a primeira palavra dele,
  // que e o nome de familia que o resto do fluxo ja entende ("bolo").
  const rotulosDeCategoria = new Map(
    [...new Set(todos.map((p) => String(p.categoria || "")))].map((c) => [semAc(c.replace(/_/g, " ")), c.split("_")[0]]),
  );

  const itens = leitura.itens.flatMap((bruto) => {
    let i = bruto;
    if (rotulosDeCategoria.has(semAc(i.produto)) && !existeNoCardapio(i.produto)) {
      i = { ...i, produto: String(rotulosDeCategoria.get(semAc(i.produto))) };
    }
    const nome = semAc(i.produto);
    const jeitos = formasDoCliente(i.produto);
    let cabe =
      [...permitido].some((v) => nome === v || nome.startsWith(v + " ")) ||
      jeitos.some((j) => existeNoCardapio(j) || etapaDesteProduto(j)) ||
      daFamiliaDaCasa(i.produto) ||
      ehNomeDeFamilia(i.produto) ||
      ehPizzaQueNaoESalgado(i.produto);

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
      // "bolo leite ninho" nao existe, mas "bolo" existe: e um bolo com um sabor
      // que a casa nao tem na lista. Vira a familia "bolo" com o sabor a
      // confirmar pela equipe (caminho que ja existe), em vez de sumir com a
      // linha. Medido em 03/09/2026: "misto de brigadeiro com ninho".
      const m = /^ *bolo +(caseiro +)?(.+)$/i.exec(String(i.produto));
      if (m && m[2].trim()) {
        barrados.push(i.produto + " (sabor fora da lista; vira bolo com sabor a confirmar)");
        return [{ ...i, produto: m[1] ? "bolo caseiro" : "bolo", sabor: [i.sabor, m[2].trim()].filter(Boolean).join(" ") }];
      }
      naoExistem.push(i.produto);
      return [];
    }

    // A UNIDADE DESEMPATA O NOME QUE SERVE PROS DOIS (caso da kemilly, 22/08:
    // "4 leites 1kg e 100 brigadeiros e 100 beijinhos"). Bolo se vende por
    // quilo e o maior tem 6 kg; docinho se vende por unidade. Um "bolo
    // brigadeiro" de 100 e o docinho brigadeiro, e o rastro conta.
    const comPrefixo = /^ *bolo +(caseiro +)?/i.test(String(i.produto));
    const semCarimbo = String(i.produto).replace(/^ *bolo +(caseiro +)?/i, "");
    if (comPrefixo && Number(i.qtd) > PESO_DO_MAIOR_BOLO) {
      const docinho = porUnidadeComEsteNome(semCarimbo);
      if (docinho) {
        barrados.push(i.produto + " (" + i.qtd + ": e " + docinho.categoria + ", nao bolo)");
        return [{ ...i, produto: docinho.nomeCurto }];
      }
    }
    // E O CONTRARIO: a padaria perguntou o sabor do bolo e ele respondeu um
    // sabor de bolo, em quantidade de bolo. Sem o prefixo, o catalogo acharia o
    // docinho de mesmo nome (R$ 1,25 no lugar de R$ 46,90 o quilo).
    if (etapa === "bolo" && !comPrefixo && Number(i.qtd) <= PESO_DO_MAIOR_BOLO) {
      const bolo = deBolo.find((p) => semAc(p.nomeCurto) === nome || nome.startsWith(semAc(p.nomeCurto) + " "));
      if (bolo) {
        return [{ ...i, produto: bolo.nome + String(i.produto).slice(bolo.nomeCurto.length) }];
      }
    }

    return [i];
  });

  return { limpa: { ...leitura, itens }, barrados, naoExistem, paraDepois };
}

/** O maior bolo da casa, em quilos. Acima disso o nome so pode ser docinho. */
const PESO_DO_MAIOR_BOLO = 6;
