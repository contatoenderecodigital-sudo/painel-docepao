// ============================================================================
//  AS ETAPAS DO PEDIDO
//
//  Esta e a peca central da IA nova, e de proposito ela e so DADOS: a lista das
//  etapas, o que cada uma pergunta, o que ela aceita de volta e quando esta
//  cumprida. Sem logica, sem chamada de modelo, sem efeito colateral.
//
//  POR QUE ISSO EXISTE
//
//  Na versao antiga a IA decidia sozinha o rumo da conversa e quarenta guardas
//  corriam atras corrigindo. Os defeitos que o dono viu no WhatsApp dele em
//  22 e 23/08/2026 nasceram todos disso:
//
//    - "4 leites 1kg e 100 brigadeiros e 100 beijinhos" virou "bolo 4 leites COM
//      brigadeiro", porque brigadeiro e sabor de bolo E nome de docinho, e nada
//      no sistema sabia que aquela frase falava de duas coisas diferentes.
//
//    - Ela perguntou "quer escolher os tipos de SALGADOS?", o cliente disse
//      "Sim", e o sistema mandou o cardapio de DOCINHOS.
//
//  Com etapa, esses dois somem por construcao: na etapa do BOLO so entra sabor
//  de bolo, e o cardapio que vai e o da etapa, nao o que a IA escreveu.
//
//  A REGRA QUE NAO SE QUEBRA
//
//  O codigo decide QUAL a proxima pergunta. A IA decide O QUE O CLIENTE QUIS
//  DIZER, dentro da etapa em que a conversa esta. Se um dia alguem precisar
//  perguntar "mas em que etapa a IA acha que esta?", o desenho ja se perdeu.
// ============================================================================

/** As etapas, na ordem em que a festa acontece. */
export type EtapaId =
  | "abertura"
  | "quantas_pessoas"
  | "base_da_festa"
  | "salgado"
  | "docinho"
  | "bolo"
  | "pecas_do_bolo"
  | "oferta"
  | "dados"
  | "confirmacao"
  | "registrado";

// AQUI TINHA UM "EtapaSimplesId", QUE NINGUEM USAVA.
//
// Era o desenho de um caminho curto separado pra pedido simples. Na hora de
// construir, o caminho curto saiu melhor de outro jeito: as etapas da festa se
// marcam como pulaveis quando nao ha festa, e quem pede "100 coxinhas pra
// sabado" cai direto nos dados sem precisar de lista propria.
//
// O tipo ficou pra tras e nunca foi apagado. Some agora junto com os outros
// restos de andaime que a varredura de 23/08/2026 achou.

/** O que a etapa espera receber de volta do cliente. */
export type Espera =
  // Botao de resposta: ate tres, 20 caracteres cada (limite da Meta).
  | { tipo: "botao"; opcoes: { id: string; titulo: string }[] }
  // Texto livre que a IA le SABENDO a etapa. E aqui que ela trabalha.
  | { tipo: "texto"; oQue: string }
  // Escolha de item do cardapio: a imagem vai junto e ele escreve o nome.
  | { tipo: "escolha_do_cardapio"; cardapio: string }
  // Nada a esperar: a etapa se resolve sozinha (o motor calcula, o codigo grava).
  | { tipo: "nada" };

export type Etapa = {
  id: EtapaId;
  /** Como a dona ve isso no painel quando assume a conversa no meio. */
  rotulo: string;
  /** O que ela pergunta aqui. Uma pergunta so, sempre. */
  pergunta: string | null;
  /** O que a etapa espera de volta. */
  espera: Espera;
  /**
   * A etapa esta cumprida? Recebe o pedido em montagem e responde sim ou nao.
   * E o unico jeito de avancar: nao existe "a IA achou que ja deu".
   */
  cumprida: (p: PedidoEmMontagem) => boolean;
  /**
   * Esta etapa pode ser pulada? Festa sem docinho pula a etapa do docinho, e
   * quem disse "so o bolo" pula salgado e docinho.
   */
  pulavel?: (p: PedidoEmMontagem) => boolean;
};

import { saboresQueFaltam } from "./sabor";
import { ehNomeDeFamilia } from "./generico";
import { formasDoCliente } from "../texto";

/** O que a conversa ja acumulou. E o unico estado que existe. */
export type PedidoEmMontagem = {
  ehFesta: boolean;
  pessoas: number | null;
  /** A base calculada pelo motor, quando a festa tem numero de pessoas. */
  base: { salgados: number; docinhos: number; boloKg: number; totalCentavos: number } | null;
  /** O cliente aceitou a base? Botao, nao frase. */
  baseAceita: boolean;
  itens: {
    produto: string;
    categoria: string;
    qtd: number;
    obs: string | null;
  }[];
  /** O que ele disse que NAO quer, pra nao oferecer de novo. */
  naoQuer: string[];
  dados: {
    nome: string | null;
    data: string | null;
    hora: string | null;
    pagamento: string | null;
  };
  /**
   * TOPO E PAPEL DE ARROZ, UM DE CADA VEZ.
   *
   * Cada um tem tres estados: null e "ainda nao perguntei", true e sim, false e
   * nao. Antes era um par de sim e nao so, e por isso a padaria nao conseguia
   * perguntar um sem ja ter resposta do outro.
   *
   * Decisao do dono em 23/08/2026, escolhendo entre lista de quatro opcoes e
   * duas perguntas de sim e nao: ficou com as duas perguntas, porque a lista
   * esconde as opcoes atras de um toque e a clientela da padaria ve melhor o
   * botao na tela.
   */
  pecas: { topo: boolean | null; papelDeArroz: boolean | null } | null;
  /**
   * QUANTAS VEZES A PADARIA JA REPETIU A PERGUNTA DA VEZ.
   *
   * Vive no `Estado` do fluxo e chega aqui porque `Estado` e um `PedidoEmMontagem`
   * com mais campos. Opcional de proposito: quem monta um pedido na mao (o
   * painel, um teste) nao precisa saber disto.
   *
   * Serve para UM caso so, e o caso e o detalhe opcional. Ver
   * `PERGUNTA-E-BOTAO.md`, na raiz do projeto.
   */
  insistiu?: number;
  /**
   * AS ETAPAS QUE A PADARIA JÁ PERGUNTOU NESTA CONVERSA.
   *
   * Serve pra saber que o cliente JÁ FOI PERGUNTADO e respondeu outra coisa.
   *
   * É uma LISTA que acumula, e não o nome da última pergunta. Guardar só a
   * última fazia a memória sumir assim que a conversa andava: no cenário 3 da
   * bateria a padaria perguntou o prato, o cliente falou de outra coisa, a
   * etapa seguiu, o resumo apareceu, ele escreveu "isso mesmo, pode confirmar"
   * e ouviu a pergunta do bolo DE NOVO. A etapa tinha reaberto porque o sinal
   * agora apontava para a confirmação.
   *
   * Perguntado uma vez, perguntado para sempre: a padaria não volta atrás.
   *
   * GUARDA A ETAPA E TAMBEM A PERGUNTA: `"bolo"` e `"bolo:prato"`.
   *
   * Uma etapa pode ter mais de uma pergunta. A do bolo pergunta o sabor e
   * depois o prato, e marcando só a etapa a marca da PRIMEIRA fazia a etapa se
   * dar por cumprida antes de a segunda sair. Por isso é `string[]` e não
   * `EtapaId[]`: quem pergunta pela etapa continua igual, e quem precisa saber
   * qual pergunta já saiu usa a chave.
   */
  etapasJaPerguntadas?: string[];
  /**
   * DE QUEM E O ANIVERSARIO, E QUANTOS ANOS FAZ.
   *
   * Pedido do dono, e ele tem razao: "importantissimo". O topo e fabricado com
   * o tema, o nome e a idade, entao quem faz a peca precisa dos dois. Sem isso
   * a comanda chega na cozinha sem o que escrever no topo.
   */
  topoNome: string | null;
  topoIdade: string | null;
  /**
   * O QUE VAI ESCRITO NA PECA, se ele quiser algo escrito.
   *
   * Regra do dono, 24/08/2026: "a informacao que voce precisa coletar e o tema e
   * o que o cliente quer escrito no topo, ISSO SE ELE QUISER algo escrito".
   *
   * Tem topo que e so o desenho. Exigir nome e idade de quem nao quer nada
   * escrito e travar a conversa por uma regra que a padaria nao tem. "Nada" e
   * resposta valida e fica gravada como resposta, nao como falta.
   */
  escrito: string | null;
  /**
   * O TEMA DA PECA PERSONALIZADA.
   *
   * "pode ser da miney" no teste do dono em 23/08/2026 caiu no vazio: ele falou
   * o tema, ninguem perguntou, ninguem anotou, e o pedido final saiu sem a
   * Minnie em lugar nenhum.
   *
   * Vale pro topo e pro papel de arroz: os dois sao fabricados com o tema.
   */
  tema: string | null;
  /**
   * A COR DA FORMINHA DO DOCINHO.
   *
   * Audio da dona, 29/07/2026: "na hora que a pessoa escolher docinho, a gente
   * SEMPRE pergunta a cor da forminha que ela quer: voce quer rosa, azul,
   * marrom, tem uma cor da tua preferencia?".
   *
   * Sao 21 cores no cardapio, entao nao cabe em botao: ela manda a lista e o
   * cliente escreve. Decisao do dono em 23/08/2026.
   */
  forminha: string | null;
  /**
   * COMO O BOLO VAI EMBALADO.
   *
   * Audio da dona, 29/07/2026: "e interessante perguntar se ela quer no prato
   * em MDF aberto, do jeito que esta na foto, ou se ela quer aquela embalagem
   * tradicional que vai a tampa".
   *
   * Nunca foi perguntado por nenhuma versao do sistema, e e escolha do cliente
   * que muda o que a cozinha monta.
   */
  prato: "aberto" | "tampa" | null;
  /**
   * A PADARIA JA OFERECEU O QUE FALTA?
   *
   * Ideia do dono, 23/08/2026: "tem que pedir se quer docinhos e bolo recheado
   * ne, tem que ter os order bump kkk".
   *
   * Ele esta certo e e o que a atendente do balcao faz: quem leva cem salgados
   * pra sabado quase sempre leva docinho junto, e ninguem ofereceu. Uma vez so,
   * sem insistir: oferta repetida vira empurra.
   */
  ofereceu: boolean;
};

// AQUI HAVIA O DOC DE UM ATALHO QUE NAO EXISTE MAIS.
//
// Ele dizia: "o cliente ja informou data, hora, nome e pagamento? serve para
// nao segurar o pedido por um detalhe". A funcao foi apagada em 26/08/2026,
// porque fazia demais -- quem mandava tudo de uma vez nunca era perguntado do
// papel de arroz, que custa R$ 12 e a padaria vende. O comentario ficou,
// descrevendo codigo que sumiu, colado na funcao seguinte.
//
// O motivo inteiro esta escrito onde o atalho foi retirado, na etapa
// `pecas_do_bolo`.

/**
 * A PADARIA JA PERGUNTOU ISSO E ELE NAO RESPONDEU.
 *
 * Vale SO para detalhe opcional (o papel de arroz, o topo, o prato). A regra
 * inteira esta em `PERGUNTA-E-BOTAO.md`, e ela tem tres partes:
 *
 *   1. se ele nao falou, PERGUNTA. Detalhe que a padaria vende nao pode deixar
 *      de ser oferecido so porque o resto do pedido ja esta pronto;
 *   2. se ele ja respondeu, NAO PERGUNTA DE NOVO. Vale a resposta escrita
 *      tanto quanto o botao;
 *   3. se ele ignorou UMA vez, SEGUE. Repetir faz o fluxo chamar a equipe por
 *      causa de um detalhe, e quem ignorou ja respondeu: ele nao quer.
 *
 * A parte 3 dizia "duas vezes" aqui e o `fluxo.ts` escolheu uma, em 25/08/2026,
 * com o motivo escrito la ("Agora a etapa segue ja na primeira ignorada"). Este
 * comentario ficou descrevendo a versao anterior ate 28/08/2026.
 *
 * Sem a parte 3, tirar o atalho que pulava a pergunta traria de volta o defeito
 * de 25/08/2026, em que o cliente respondia "isso mesmo, pode confirmar" e
 * ouvia a mesma pergunta do prato ate a conversa morrer.
 *
 * O QUE ELA RECEBE E UMA PERGUNTA, NAO SO UMA ETAPA.
 *
 * `"bolo"` quer dizer "alguma pergunta da etapa do bolo ja saiu"; `"bolo:prato"`
 * quer dizer "a pergunta DO PRATO ja saiu". A diferenca custou o prato, o topo
 * e o papel de arroz de todo bolo de festa, ate ser medida em 28/08/2026.
 */
const jaPerguntouEEleNaoRespondeu = (p: PedidoEmMontagem, oQue: string) =>
  (p.etapasJaPerguntadas ?? []).includes(oQue);

/**
 * A COR DA FORMINHA JA FOI PERGUNTADA?
 *
 * UMA PERGUNTA SO, PRO PEDIDO INTEIRO.
 *
 * Regra do dono, 24/08/2026: "voce pode aceitar uma ou mais cor e NAO quero que
 * peca o cliente qual cor de forminha usar para X docinho".
 *
 * Eu tinha feito ela cobrar item por item quando faltasse cor, e isso vira
 * interrogatorio: a cliente escolhe as cores da festa dela, nao a cor de cada
 * docinho. As cores que ele falar valem pro pedido todo, e a comanda dos
 * docinhos leva todas elas.
 */
const semForminha = (p: PedidoEmMontagem) => !p.forminha;

/** Falta escolher recheio ou sabor em algum item desta familia? */
const faltaSabor = (p: PedidoEmMontagem, pref: string) =>
  saboresQueFaltam(p.itens.filter((i) => String(i.categoria || "").startsWith(pref))).length > 0;

const temCategoria = (p: PedidoEmMontagem, pref: string) =>
  p.itens.some((i) => String(i.categoria || "").startsWith(pref));

/**
 * GENERICO NAO E PRODUTO: E UMA ESCOLHA QUE AINDA FALTA.
 *
 * "salgado", "docinho" e "bolo" e o que a proposta anota quando o cliente
 * aceitou a base mas ainda nao disse QUAL. Nao da pra fechar etapa com isso.
 *
 * O bolo ja tinha esta regra, escrita a mao na propria etapa dele. Os outros
 * dois nao tinham, e o preco disso foi medido em 26/08/2026, com a etapa
 * fechando e o motor escolhendo sozinho:
 *
 *   "docinho"  100 un  ->  cotado como DOCINHO DE CHURROS, R$ 1,75
 *                          (o brigadeiro, que e o comum, custa R$ 1,25)
 *   "salgado"  200 un  ->  cotado como SALGADO ASSADO, R$ 1,25
 *                          (o frito custa R$ 1,00)
 *
 * Nao era nem o mais caro nem o mais pedido: era o que o casamento por pedaco
 * alcancava primeiro. O cliente recebia preco fechado de uma coisa que ele
 * nunca escolheu, e a cozinha recebia churros.
 *
 * A lista e a mesma que a montagem conhece em `lib/banco/montagem.ts`.
 */
// A LISTA MORA NO `generico.ts`, E SO LA.
//
// Aqui havia uma copia, e ela ja discordava da original: "pizza" era nome de
// familia la e nao era aqui. Cada arquivo decidindo uma coisa sobre a mesma
// palavra e o defeito que mais se repetiu neste projeto.

/** Sobrou algum item nesta familia que ainda e generico? */
const temGenerico = (p: PedidoEmMontagem, pref: string) =>
  p.itens.some(
    (i) =>
      String(i.categoria || "").startsWith(pref) &&
      ehNomeDeFamilia(i.produto),
  );

/**
 * ELE RECUSOU ESTA FAMILIA?
 *
 * A comparacao era com a palavra CRUA que o modelo devolveu, e por isso o
 * diminutivo nao chegava. Medido em 28/08/2026, com um salgado ja no pedido:
 *
 *   naoQuer ["salgado"]       ->  a etapa do salgado e pulada
 *   naoQuer ["salgadinho"]    ->  NAO e pulada
 *   naoQuer ["salgadinhos"]   ->  NAO e pulada
 *
 * O cliente dizia que nao queria e a padaria continuava perguntando quais
 * salgados ele queria. `comoOCardapioEscreve` ja resolve artigo, plural e
 * diminutivo, e ja e usada no portao da etapa: usar a mesma aqui e o que impede
 * as duas de discordarem sobre a mesma palavra.
 */
const recusou = (p: PedidoEmMontagem, o: string) =>
  p.naoQuer.some((x) => formasDoCliente(x).some((f) => new RegExp(o, "i").test(f)));

/**
 * AS ETAPAS DA FESTA, NA ORDEM.
 *
 * A ordem importa e e a ordem em que a dona monta na cozinha: salgado, docinho,
 * bolo, pecas do bolo. Foi ela que pediu assim.
 */
export const ETAPAS_DA_FESTA: Etapa[] = [
  {
    id: "abertura",
    rotulo: "abrindo a conversa",
    pergunta: null, // a abertura responde ao que ele falou; nao tem pergunta fixa
    espera: { tipo: "texto", oQue: "o que ele precisa" },
    cumprida: (p) => p.ehFesta || p.itens.length > 0,
  },
  {
    id: "quantas_pessoas",
    rotulo: "perguntando quantas pessoas",
    pergunta: "Quantas pessoas vão na festa?",
    espera: { tipo: "texto", oQue: "o numero de pessoas" },
    cumprida: (p) => (p.pessoas ?? 0) > 0,
    // PEDIDO SIMPLES NAO TEM FESTA.
    //
    // "quero 100 coxinhas pra sabado" recebia "Quantas pessoas vao na festa?".
    // Quem pede um item com a quantidade certa ja disse tudo o que a padaria
    // precisa saber sobre quantidade: perguntar de festa ali e burocracia, e foi
    // o que o dono viu no primeiro teste.
    pulavel: (p) => !p.ehFesta,
  },
  {
    id: "base_da_festa",
    rotulo: "esperando aceitar a base",
    // A pergunta real e montada com os numeros do motor: aqui fica so o final.
    pergunta: "Pode ser assim?",
    espera: {
      tipo: "botao",
      opcoes: [
        { id: "base_sim", titulo: "Pode ser" },
        { id: "base_ajustar", titulo: "Quero ajustar" },
      ],
    },
    cumprida: (p) => p.baseAceita,
    // So festa tem base: pedido simples nao passa por aqui.
    pulavel: (p) => !p.ehFesta,
  },
  {
    id: "salgado",
    rotulo: "escolhendo os salgados",
    pergunta: "Quais salgados você quer?",
    espera: { tipo: "escolha_do_cardapio", cardapio: "salgados" },
    // SABOR EM ABERTO E BURACO NO PEDIDO.
    //
    // Risolis e mini bolha sao fritos e mesmo assim pedem recheio; coxinha nao
    // pede, porque o recheio dela e fixo. Quem separa os dois e o catalogo.
    cumprida: (p) =>
      temCategoria(p, "salgado") && !faltaSabor(p, "salgado") && !temGenerico(p, "salgado"),
    // Fora da festa ninguem oferece salgado a quem pediu uma torta.
    // Na festa ela pergunta por iniciativa propria (a proposta ja combinou o
    // total). No pedido comum ela so entra se o cliente TIVER pedido salgado:
    // quem quer dez paes nao e interrogado sobre coxinha.
    pulavel: (p) => recusou(p, "salgado") || (!p.ehFesta && !temCategoria(p, "salgado")),
  },
  {
    id: "docinho",
    rotulo: "escolhendo os docinhos",
    pergunta: "Quais docinhos você quer?",
    espera: { tipo: "escolha_do_cardapio", cardapio: "docinhos" },
    // A COR DA FORMINHA FAZ PARTE DE ESCOLHER O DOCINHO.
    //
    // A dona pergunta sempre, e nao e detalhe: ela monta a forminha antes de
    // rechear, entao a cor precisa estar na comanda quando a producao comeca.
    cumprida: (p) =>
      temCategoria(p, "docinho") &&
      !faltaSabor(p, "docinho") &&
      !semForminha(p) &&
      !temGenerico(p, "docinho"),
    pulavel: (p) => recusou(p, "docinho|doce") || (!p.ehFesta && !temCategoria(p, "docinho")),
  },
  {
    id: "bolo",
    rotulo: "escolhendo o bolo",
    pergunta: "Qual sabor de bolo você quer?",
    espera: { tipo: "escolha_do_cardapio", cardapio: "bolos-festa" },
    // O BOLO DA BASE ENTRA SO COM O PESO, E ISSO NAO CUMPRE A ETAPA.
    //
    // Quando o cliente aceita a base, o codigo ja anota "bolo" com os quilos
    // que a conta da casa mandou (100 g por pessoa). Mas o SABOR e escolha
    // dele, nao da casa: enquanto o produto for so "bolo", a etapa continua
    // aberta e ela pergunta o sabor. Sem isto, a festa fechava com um bolo sem
    // sabor nenhum e a cozinha ficava sem saber o que assar.
    // SABOR ESCOLHIDO E EMBALAGEM ESCOLHIDA.
    //
    // "bolo" sozinho nao e sabor: e o que a proposta anota quando o cliente
    // ainda nao escolheu. E o prato vem junto porque a dona pergunta junto, e
    // porque muda o que a cozinha monta na hora de embalar.
    // O PRATO: PERGUNTA UMA VEZ, MAS NAO PRENDE.
    //
    // Bateria dos cinco jeitos, 25/08/2026: o cliente mandou o pedido inteiro
    // numa mensagem so, com data, hora, nome e pagamento, e recebeu de volta
    // "o bolo vai no prato de MDF aberto ou na embalagem com tampa?". Respondeu
    // "isso mesmo, pode confirmar" e ouviu a MESMA pergunta. O pedido nunca
    // fechou, nos cinco jeitos de falar.
    //
    // O conserto de entao foi deixar passar quem ja informou tudo: quem ja
    // informou tudo passa direto. Isso resolveu o travamento e criou outro
    // problema, o mesmo que o papel de arroz tinha: quem manda tudo de uma vez
    // NUNCA e perguntado, e a cozinha fica sem saber como embalar.
    //
    // Agora vale a regra de `PERGUNTA-E-BOTAO.md`: pergunta uma vez, aceita a
    // resposta escrita igual ao botao, e segue quando ele ignora duas vezes.
    cumprida: (p) =>
      // O GENERICO E A MESMA PERGUNTA DAS OUTRAS DUAS FAMILIAS.
      //
      // Aqui estava escrito `produto.toLowerCase() !== "bolo"`, uma comparacao
      // a mao, enquanto o salgado e o docinho ja usavam `temGenerico`. O
      // comentario do proprio `temGenerico`, dez linhas acima, aponta isto: "o
      // bolo ja tinha esta regra, escrita a mao na propria etapa dele".
      //
      // A versao a mao so reconhecia a palavra exata: "bolos" ou "Bolo " ja
      // passavam como se fossem sabor escolhido, e a festa fechava com um bolo
      // sem sabor nenhum pra cozinha assar.
      // A ETAPA DO BOLO TERMINA NO SABOR.
      //
      // Ela tinha uma segunda pergunta, a do prato, e isso escondia um defeito:
      // a marca de "ja perguntei" e por ETAPA, entao a marca deixada pela
      // pergunta do SABOR dava a etapa por cumprida antes de o prato sair.
      // Medido em 28/08/2026, em conversa de verdade contra a producao, e o
      // efeito era o bolo de festa fechando sem prato, sem topo e sem papel de
      // arroz.
      //
      // O conserto da marca por pergunta continua de pe (a `pecas_do_bolo` usa
      // a `bolo:tres`). O que mudou depois foi a pergunta do prato SAIR, por
      // decisao do dono no mesmo dia: ela nao existe no fluxograma da Kemilly e
      // a equipe decide o prato na producao. A LEITURA ficou: quem falar "prato
      // aberto" continua sendo anotado.
      //
      // Entao sobrou o que a etapa sempre foi de verdade: qual sabor.
      temCategoria(p, "bolo") && !temGenerico(p, "bolo"),
    // O SABOR DO BOLO VALE FORA DA FESTA TAMBEM.
    //
    // Ate 23/08/2026 esta etapa era pulada em todo pedido que nao fosse festa,
    // entao quem encomendava um bolo avulso nunca era perguntado do sabor: a
    // comanda saia com "1 kg de bolo" e a cozinha sem saber o que assar.
    pulavel: (p) => recusou(p, "bolo") || (!p.ehFesta && !temCategoria(p, "bolo")),
  },
  {
    id: "pecas_do_bolo",
    rotulo: "papel de arroz e topo",
    // A fala de verdade sai de falaDasPecas, que pergunta o PAPEL primeiro
    // (fluxograma da Kemilly, confirmado pelo dono em 26/08/2026). Isto aqui e
    // so o rotulo da etapa; deixar "O bolo vai com topo?" escrito aqui fazia a
    // etapa se anunciar por uma pergunta que nao e mais a primeira.
    pergunta: "E papel de arroz, com a foto impressa no bolo?",
    espera: {
      tipo: "botao",
      opcoes: [
        { id: "papel_sim", titulo: "Sim" },
        { id: "papel_nao", titulo: "Não" },
      ],
    },
    // A etapa so acaba com os DOIS respondidos, e com nome e idade quando o
    // topo for sim. Responder "nao" tambem cumpre: o que nao pode e ficar sem
    // resposta.
    cumprida: (p) => {
      // PERGUNTAR UMA VEZ, SIM. REPETIR, NUNCA.
      //
      // Aqui houve um atalho que dizia: quem ja informou data, hora, nome e
      // pagamento nao fica preso por topo nem por papel de arroz. Ele nasceu
      // certo, pra destravar o pedido que nunca fechava, mas fazia demais:
      // quem mandava tudo de uma vez NUNCA era perguntado, e o papel de arroz,
      // que custa R$ 12 e a padaria vende, simplesmente nao era oferecido.
      //
      // Regra do dono, 26/08/2026: "ele precisa pedir se a pessoa nao falar que
      // quer. Se ela ja afirmou que quer sem ou com papel de arroz ou sem ou
      // com topo, nao pode refazer a mesma pergunta."
      //
      // Entao o que segura a etapa e a PERGUNTA NAO FEITA, e nao o dado que
      // falta. Quem ja respondeu, escrevendo ou no botao, passa direto: o
      // leitor da frase entende "sem topo e sem papel de arroz" e ja marca os
      // dois, entao responder por texto vale igual a tocar no botao.
      //
      // E quem ignorou duas vezes ja respondeu: nao quer. Segue.
      if (p.pecas?.topo == null || p.pecas?.papelDeArroz == null) {
        // A PERGUNTA DO BOLO NAO E A PERGUNTA DAS PECAS.
        //
        // Aqui estava `jaPerguntouEEleNaoRespondeu(p, "bolo")`, e num pedido
        // com bolo a etapa do bolo SEMPRE e perguntada. Entao esta etapa
        // nascia cumprida e o cliente nunca era perguntado do topo nem do papel
        // de arroz -- o topo, que a equipe orca e que tem prazo de dois dias
        // com a fornecedora, e o papel, que custa R$ 12 e a padaria vende.
        //
        // A padaria chegava a AVISAR que existe papel de arroz, no cardapio de
        // bolos, e nunca perguntava se ele queria.
        //
        // A `bolo:tres` fica porque ela e a pergunta juntada, que cobre o
        // prato, o papel e o topo de uma vez so: quem responde ela ja respondeu
        // esta etapa.
        return (
          jaPerguntouEEleNaoRespondeu(p, "pecas_do_bolo") ||
          jaPerguntouEEleNaoRespondeu(p, "bolo:tres")
        );
      }
      // Sem topo e sem papel nao ha peca personalizada: acabou aqui.
      if (p.pecas.topo === false && p.pecas.papelDeArroz === false) return true;
      // Com qualquer uma das duas, a fabrica precisa do TEMA (que pode ter
      // vindo por foto) e de saber o que vai ESCRITO, sendo "nada" uma resposta
      // valida: tem topo que e so o desenho.
      return Boolean(p.tema && (p.escrito || (p.topoNome && p.topoIdade)));
    },
    pulavel: (p) => !temCategoria(p, "bolo"),
  },
  {
    id: "oferta",
    rotulo: "oferecendo o que combina",
    pergunta: "Quer levar docinho ou bolo junto?",
    espera: {
      tipo: "botao",
      opcoes: [
        { id: "oferta_docinho", titulo: "Quero docinho" },
        { id: "oferta_bolo", titulo: "Quero bolo" },
        { id: "oferta_nao", titulo: "Só isso" },
      ],
    },
    // OFERTA SE FAZ UMA VEZ. NAO SE COBRA RESPOSTA.
    //
    // Isto era so `p.ofereceu`, e `ofereceu` so vira true no TOQUE do botao.
    // Quem respondia escrevendo ouvia a mesma oferta de novo, e de novo, e na
    // terceira a padaria desistia e chamava um humano:
    //
    //   cliente >> queria 2 pizzas pra sexta as 19h
    //   padaria >> Quer levar docinho ou bolo junto?
    //   cliente >> nome Marcos Alves, pix
    //   padaria >> Quer levar docinho ou bolo junto?
    //   cliente >> pode confirmar
    //   padaria >> Acho que nao estou conseguindo entender. Vou chamar a equipe.
    //
    // O pedido inteiro se perdia numa OFERTA, que e a coisa mais opcional que
    // existe na conversa. Medido em 26/08/2026, com uma conversa contra o banco.
    //
    // A bateria dos cinco jeitos nao pegava porque naqueles cenarios o cliente
    // acrescentava docinho e bolo depois, e ai a oferta virava pulavel por
    // outro motivo. Escapava por acidente.
    //
    // Agora vale a mesma regra dos detalhes opcionais: perguntou, ele falou
    // outra coisa, a padaria segue. Ver `PERGUNTA-E-BOTAO.md`.
    cumprida: (p) => p.ofereceu || jaPerguntouEEleNaoRespondeu(p, "oferta"),
    // Nao se oferece o que ele ja pediu, e nao se oferece na festa: la a
    // proposta ja traz salgado, docinho e bolo juntos.
    pulavel: (p) =>
      p.ehFesta ||
      !p.itens.length ||
      (temCategoria(p, "docinho") && temCategoria(p, "bolo")),
  },
  {
    id: "dados",
    rotulo: "pegando os dados da retirada",
    // Uma pergunta por vez: o codigo escolhe qual falta. Nome e pagamento vem
    // no fim, juntos, e so depois dos itens resolvidos.
    pergunta: null,
    espera: { tipo: "texto", oQue: "nome, dia, hora e forma de pagamento" },
    cumprida: (p) =>
      !!p.dados.nome && !!p.dados.data && !!p.dados.hora && !!p.dados.pagamento,
  },
  {
    id: "confirmacao",
    rotulo: "esperando confirmar o pedido",
    pergunta: "Confirma o pedido?",
    espera: {
      tipo: "botao",
      opcoes: [
        { id: "fecha_sim", titulo: "Confirmar" },
        { id: "fecha_mudar", titulo: "Mudar algo" },
      ],
    },
    cumprida: () => false, // so o botao fecha; nunca se cumpre sozinha
  },
  {
    id: "registrado",
    rotulo: "pedido com a equipe",
    pergunta: null,
    espera: { tipo: "nada" },
    cumprida: () => true,
  },
];

/**
 * A ETAPA DA VEZ.
 *
 * Primeira da lista que ainda nao esta cumprida e que nao pode ser pulada.
 * Funcao pura: mesma entrada, mesma saida, sem ler banco nem chamar modelo. E
 * assim que da pra testar o fluxo inteiro sem gastar um centavo de API.
 */
/**
 * O ROTEIRO DE CADA TIPO DE PEDIDO.
 *
 * Pedido do dono em 23/08/2026, e ele estava certo: "preciso que voce tenha uma
 * lista de ordem de coisas que voce tem que perguntar, mas apenas se o cliente
 * responder que sim para querer o produto em questao".
 *
 * Ate aqui existia UMA lista, a da festa, e cada etapa carregava uma marca
 * dizendo quando ela nao se aplicava. O resultado pro cliente era o mesmo, mas
 * pra saber o que acontece num pedido comum era preciso ler as treze etapas
 * marcando na cabeca quais sao puladas. Foi lendo assim que eu me perdi antes.
 *
 * Agora cada tipo de pedido tem o seu roteiro escrito, e da pra conferir de
 * bater o olho.
 */
const SO = (ids: EtapaId[]): Etapa[] =>
  ids.map((id) => ETAPAS_DA_FESTA.find((e) => e.id === id)!).filter(Boolean);

/** Festa: a proposta combina o total e o cliente escolhe os sabores. */
export const ROTEIRO_DA_FESTA: Etapa[] = SO([
  "abertura",
  "quantas_pessoas",
  "base_da_festa",
  "salgado",
  "docinho",
  "bolo",
  "pecas_do_bolo",
  "dados",
  "confirmacao",
  "registrado",
]);

/**
 * Pedido comum: ele ja disse o que quer, entao nao ha proposta nem numero de
 * pessoas. As etapas de familia continuam na lista porque e nelas que mora a
 * pergunta do sabor, e cada uma so entra se o pedido tiver aquele produto.
 */
export const ROTEIRO_COMUM: Etapa[] = SO([
  "abertura",
  "salgado",
  "docinho",
  "bolo",
  "pecas_do_bolo",
  "oferta",
  "dados",
  "confirmacao",
  "registrado",
]);

/**
 * QUAL ROTEIRO ESTA CONVERSA SEGUE?
 *
 * Festa e conclusao, nao ponto de partida: so vira festa quando a pessoa fala
 * de festa, de aniversario ou de um numero de gente. Enquanto isso nao
 * acontece, a conversa segue o roteiro comum, que e mais curto.
 */
export function roteiroDoPedido(p: PedidoEmMontagem): Etapa[] {
  return p.ehFesta ? ROTEIRO_DA_FESTA : ROTEIRO_COMUM;
}

export function etapaDaVez(p: PedidoEmMontagem, etapas: Etapa[] = ETAPAS_DA_FESTA): Etapa {
  for (const e of etapas) {
    if (e.pulavel?.(p)) continue;
    if (!e.cumprida(p)) return e;
  }
  return etapas[etapas.length - 1];
}
