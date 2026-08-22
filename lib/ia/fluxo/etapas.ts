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
  | "dados"
  | "confirmacao"
  | "registrado";

/** O caminho curto: quem pede "100 coxinhas pra sabado" nao passa pela festa. */
export type EtapaSimplesId = "item_simples" | "dados" | "confirmacao" | "registrado";

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
  pecas: { topo: boolean; papelDeArroz: boolean } | null;
};

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
  },
  {
    id: "salgado",
    rotulo: "escolhendo os salgados",
    pergunta: "Quais salgados você quer?",
    espera: { tipo: "escolha_do_cardapio", cardapio: "salgados" },
    cumprida: (p) => temCategoria(p, "salgado"),
    pulavel: (p) => recusou(p, "salgado"),
  },
  {
    id: "docinho",
    rotulo: "escolhendo os docinhos",
    pergunta: "Quais docinhos você quer?",
    espera: { tipo: "escolha_do_cardapio", cardapio: "docinhos" },
    cumprida: (p) => temCategoria(p, "docinho"),
    pulavel: (p) => recusou(p, "docinho|doce"),
  },
  {
    id: "bolo",
    rotulo: "escolhendo o bolo",
    pergunta: "Qual sabor de bolo você quer?",
    espera: { tipo: "escolha_do_cardapio", cardapio: "bolos-festa" },
    cumprida: (p) => temCategoria(p, "bolo"),
    pulavel: (p) => recusou(p, "bolo"),
  },
  {
    id: "pecas_do_bolo",
    rotulo: "topo e papel de arroz",
    pergunta: "O bolo vai com topo e papel de arroz?",
    espera: {
      tipo: "botao",
      opcoes: [
        { id: "peca_os_dois", titulo: "Os dois" },
        { id: "peca_so_topo", titulo: "Só o topo" },
        { id: "peca_nenhum", titulo: "Nenhum" },
      ],
    },
    // Responder "nenhum" tambem cumpre: o que nao pode e ficar sem resposta.
    cumprida: (p) => p.pecas !== null,
    pulavel: (p) => !temCategoria(p, "bolo"),
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
export function etapaDaVez(p: PedidoEmMontagem, etapas: Etapa[] = ETAPAS_DA_FESTA): Etapa {
  for (const e of etapas) {
    if (e.pulavel?.(p)) continue;
    if (!e.cumprida(p)) return e;
  }
  return etapas[etapas.length - 1];
}
