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

const recusou = (p: PedidoEmMontagem, o: string) =>
  p.naoQuer.some((x) => new RegExp(o, "i").test(x));

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
    cumprida: (p) => temCategoria(p, "salgado") && !faltaSabor(p, "salgado"),
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
      temCategoria(p, "docinho") && !faltaSabor(p, "docinho") && !semForminha(p),
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
    cumprida: (p) =>
      p.itens.some(
        (i) => String(i.categoria || "").startsWith("bolo") && String(i.produto).trim().toLowerCase() !== "bolo",
      ) && p.prato !== null,
    // O SABOR DO BOLO VALE FORA DA FESTA TAMBEM.
    //
    // Ate 23/08/2026 esta etapa era pulada em todo pedido que nao fosse festa,
    // entao quem encomendava um bolo avulso nunca era perguntado do sabor: a
    // comanda saia com "1 kg de bolo" e a cozinha sem saber o que assar.
    pulavel: (p) => recusou(p, "bolo") || (!p.ehFesta && !temCategoria(p, "bolo")),
  },
  {
    id: "pecas_do_bolo",
    rotulo: "topo e papel de arroz",
    pergunta: "O bolo vai com topo?",
    espera: {
      tipo: "botao",
      opcoes: [
        { id: "topo_sim", titulo: "Sim" },
        { id: "topo_nao", titulo: "Não" },
      ],
    },
    // A etapa so acaba com os DOIS respondidos, e com nome e idade quando o
    // topo for sim. Responder "nao" tambem cumpre: o que nao pode e ficar sem
    // resposta.
    cumprida: (p) => {
      if (p.pecas?.topo == null || p.pecas?.papelDeArroz == null) return false;
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
    cumprida: (p) => p.ofereceu,
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
