// ============================================================================
//  TUDO QUE A PADARIA PRECISA SABER, E DE QUE JEITO CADA COISA E RESPONDIDA
//
//  Pedido do dono, 24/08/2026, depois de eu passar o dia consertando pergunta
//  por pergunta:
//
//    "quero que voce rastreie todas as perguntas que vai ter que fazer pro
//    cliente ou informacoes que tem que coletar durante a conversa e entenda
//    qual tipo de resposta essas perguntas devem receber."
//
//  Ele esta certo, e a falta desta tabela e a raiz de quase todo defeito da
//  semana. Eu tratava toda resposta como texto solto e ia descobrindo caso a
//  caso: que a cor podia ser mais de uma, que o tema podia vir como foto, que a
//  quantidade podia vir por extenso. Cada descoberta virava um remendo.
//
//  AQUI CADA INFORMACAO DIZ TRES COISAS:
//
//    TIPO      o que a resposta e: numero, escolha do cardapio, texto livre,
//              sim ou nao, data, hora, ou imagem
//    QUANTAS   uma so, ou varias na mesma resposta
//    QUANDO    em que situacao a padaria precisa dela
//
//  E com isso o codigo sabe julgar a resposta na hora, em vez de aceitar
//  qualquer coisa e descobrir o problema na comanda impressa.
//
//  Esta tabela e documentacao E regra: quem le entende a conversa inteira sem
//  abrir mais nada, e o codigo usa ela pra saber o que ainda falta.
// ============================================================================

export type TipoDeResposta =
  /** Um numero. "cinquenta" e numero tanto quanto 50. */
  | "numero"
  /** Uma escolha da lista do cardapio. O que nao esta na lista nao existe. */
  | "escolha"
  /** Texto livre, do jeito que ele escrever. */
  | "texto"
  /** Botao, ou a palavra equivalente. */
  | "sim_nao"
  /** Dia, sempre no futuro e dentro do expediente. */
  | "data"
  /** Hora, sempre dentro do expediente daquele dia. */
  | "hora"
  /** Foto que ele manda. Vale sozinha ou junto do texto. */
  | "imagem";

export type Informacao = {
  id: string;
  /** O que a padaria precisa saber, em portugues. */
  oQue: string;
  tipo: TipoDeResposta | TipoDeResposta[];
  /** Uma resposta so, ou varias na mesma mensagem? */
  quantas: "uma" | "varias";
  /** Quando ela e necessaria. */
  quando: string;
  /** Onde ela fica no pedido, pra dona ver. */
  onde: string;
  /** Ela e obrigatoria pra fechar o pedido? */
  obrigatoria: boolean;
};

/**
 * A FESTA
 *
 * O caminho mais longo, e o unico onde a padaria propoe a quantidade antes de o
 * cliente escolher os sabores.
 */
export const INFORMACOES_DA_FESTA: Informacao[] = [
  {
    id: "pessoas",
    oQue: "quantas pessoas vao na festa",
    tipo: "numero",
    quantas: "uma",
    quando: "sempre, e e o que calcula a proposta",
    onde: "o pedido inteiro",
    obrigatoria: true,
  },
  {
    id: "aceite_da_base",
    oQue: "se a proposta serve como esta",
    tipo: "sim_nao",
    quantas: "uma",
    quando: "depois da proposta",
    onde: "vira a quantidade de cada familia",
    obrigatoria: true,
  },
  {
    id: "salgados",
    oQue: "quais salgados",
    tipo: "escolha",
    quantas: "varias",
    quando: "quando a festa tem salgado",
    onde: "uma linha por sabor, na comanda dos salgados",
    obrigatoria: true,
  },
  {
    id: "recheio_do_salgado",
    oQue: "o recheio, quando o item pede escolha",
    tipo: "escolha",
    quantas: "uma",
    quando: "risolis, mini bolha, esfirra e os assados. Coxinha nao pede: o recheio dela e fixo",
    onde: "observacao do proprio item",
    obrigatoria: true,
  },
  {
    id: "docinhos",
    oQue: "quais docinhos",
    tipo: "escolha",
    quantas: "varias",
    quando: "quando a festa tem docinho",
    onde: "uma linha por sabor, na comanda dos docinhos",
    obrigatoria: true,
  },
  {
    id: "forminha",
    oQue: "a cor da forminha",
    tipo: "escolha",
    quantas: "varias",
    // REGRA DO DONO, 24/08/2026: "voce pode aceitar uma ou mais cor e NAO quero
    // que peca o cliente qual cor de forminha usar para X docinho".
    //
    // Eu tinha feito ela perguntar item por item quando faltasse cor, e isso e
    // interrogatorio: a cliente escolhe as cores da festa dela, nao a cor de
    // cada docinho. As cores valem pro pedido todo.
    quando: "uma vez so, depois de escolher os docinhos. Nunca item por item",
    onde: "observacao de todos os docinhos",
    obrigatoria: true,
  },
  {
    id: "sabor_do_bolo",
    oQue: "o sabor do bolo",
    tipo: "escolha",
    quantas: "varias",
    quando: "quando a festa tem bolo. Dois sabores viram um bolo misto, cobrado pelo mais caro",
    onde: "a linha do bolo, e os dois sabores na observacao quando for misto",
    obrigatoria: true,
  },
  {
    id: "embalagem_do_bolo",
    oQue: "prato de MDF aberto ou embalagem com tampa",
    tipo: "sim_nao",
    quantas: "uma",
    quando: "sempre que tem bolo",
    onde: "observacao do bolo",
    obrigatoria: true,
  },
  {
    id: "topo",
    oQue: "se o bolo leva topo",
    tipo: "sim_nao",
    quantas: "uma",
    quando: "sempre que tem bolo",
    onde: "observacao do bolo, e o valor fica pendente pra equipe",
    obrigatoria: true,
  },
  {
    id: "papel_de_arroz",
    oQue: "se o bolo leva papel de arroz",
    tipo: "sim_nao",
    quantas: "uma",
    quando: "sempre que tem bolo",
    onde: "linha propria no pedido, R$ 12",
    obrigatoria: true,
  },
  {
    id: "tema",
    oQue: "o tema da peca personalizada",
    // ACEITA TEXTO E IMAGEM, e a imagem vale sozinha.
    //
    // Regra do dono: "topo de bolo e papel de arroz aceitam imagens e texto".
    // Quem manda a foto do Homem Aranha ja disse o tema, e insistir depois da
    // foto e o tipo de coisa que faz o cliente achar que ninguem olhou.
    tipo: ["texto", "imagem"],
    quantas: "varias",
    quando: "quando tem topo ou papel de arroz",
    onde: "observacao da peca, e as fotos ficam anexadas no pedido",
    obrigatoria: true,
  },
  {
    id: "escrito_na_peca",
    oQue: "o que vai escrito na peca (nome, idade, uma frase)",
    tipo: "texto",
    quantas: "uma",
    // Regra do dono: "a informacao que voce precisa coletar e o tema e o que o
    // cliente quer escrito no topo, ISSO SE ELE QUISER algo escrito".
    //
    // Tem topo que e so o desenho. Exigir nome e idade de quem nao quer nada
    // escrito e travar a conversa por uma regra que a padaria nao tem.
    quando: "quando tem topo ou papel de arroz, e ele pode dizer que nao quer nada escrito",
    onde: "observacao da peca",
    obrigatoria: false,
  },
  {
    id: "dia",
    oQue: "o dia da retirada",
    tipo: "data",
    quantas: "uma",
    quando: "sempre. No futuro, e num dia em que a padaria abre",
    onde: "cabecalho do pedido e da comanda",
    obrigatoria: true,
  },
  {
    id: "hora",
    oQue: "a hora da retirada",
    tipo: "hora",
    quantas: "uma",
    quando: "sempre. Dentro do expediente daquele dia",
    onde: "cabecalho do pedido e da comanda",
    obrigatoria: true,
  },
  {
    id: "nome",
    oQue: "o nome de quem retira",
    tipo: "texto",
    quantas: "uma",
    quando: "sempre",
    onde: "cabecalho do pedido e da comanda",
    obrigatoria: true,
  },
  {
    id: "pagamento",
    oQue: "como ele prefere pagar",
    tipo: "sim_nao",
    quantas: "uma",
    quando: "sempre. Pix, cartao ou dinheiro",
    onde: "cabecalho do pedido",
    obrigatoria: true,
  },
];

/**
 * O PEDIDO COMUM
 *
 * Ele ja disse o que quer, entao nao ha proposta nem numero de pessoas. O resto
 * das informacoes e o mesmo da festa, e cada uma so entra se o pedido tiver
 * aquele produto.
 */
export const INFORMACOES_DO_PEDIDO_COMUM: Informacao[] = [
  {
    id: "produtos",
    oQue: "o que ele quer",
    tipo: "escolha",
    quantas: "varias",
    quando: "sempre",
    onde: "as linhas do pedido",
    obrigatoria: true,
  },
  {
    id: "quantidade",
    oQue: "quanto de cada",
    tipo: "numero",
    quantas: "varias",
    quando: "sempre, e sem proposta pra repartir ele precisa dizer",
    onde: "a quantidade de cada linha",
    obrigatoria: true,
  },
  ...INFORMACOES_DA_FESTA.filter((i) =>
    ["recheio_do_salgado", "forminha", "sabor_do_bolo", "embalagem_do_bolo", "topo",
     "papel_de_arroz", "tema", "escrito_na_peca", "dia", "hora", "nome", "pagamento"].includes(i.id),
  ),
];

/**
 * SO INFORMACAO
 *
 * Ele nao esta pedindo nada, e a padaria nao coleta NADA. A unica coisa que ela
 * precisa entender e sobre o que e a pergunta, pra responder com o dado da casa.
 */
export const INFORMACOES_DA_CONVERSA_DE_INFORMACAO: Informacao[] = [
  {
    id: "assunto_da_pergunta",
    oQue: "sobre o que ele perguntou",
    tipo: "escolha",
    quantas: "uma",
    quando: "preco, horario, endereco, pagamento, prazo, entrega, ou outro",
    onde: "nao vai pro pedido: perguntar nao e pedir",
    obrigatoria: false,
  },
];
