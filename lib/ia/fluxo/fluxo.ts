// ============================================================================
//  O MOTOR DO FLUXO
//
//  Junta as tres pecas: sabe a etapa, le a mensagem dentro dela, aplica o que
//  mudou e devolve o que a padaria vai dizer.
//
//  E UMA FUNCAO, NAO UM LACO
//
//  Recebe (estado, mensagem) e devolve (estado novo, fala). Sem laco de
//  ferramentas, sem a IA decidindo quantas voltas dar. A versao antiga tinha um
//  laco em que o modelo chamava ferramenta, lia a recusa, chamava de novo, e
//  numa conversa real ele chamou registrar_pedido CINCO vezes seguidas levando
//  a mesma negativa, ate a conversa morrer num "deixa eu chamar alguem da
//  equipe".
//
//  Aqui nao ha volta: uma mensagem entra, uma resposta sai.
//
//  BOTAO NAO CUSTA NADA
//
//  Quando a resposta e um botao, o id ja diz tudo e a IA nem e chamada. Em uma
//  festa inteira sao seis ou sete toques que deixam de virar chamada paga.
//
//  A CHAMADA DA IA VEM DE FORA
//
//  `pensar` e injetado por quem chama. Em producao e a OpenAI; no teste e uma
//  resposta gravada. E assim que o fluxo inteiro se testa sem gastar credito, e
//  foi por nao ter isso que a versao antiga so podia ser testada conversando
//  com o robo de verdade.
// ============================================================================

import { etapaDaVez, roteiroDoPedido, type Etapa, type EtapaId, type PedidoEmMontagem } from "./etapas";
import { falaDaEtapa, pecaDoCardapio, quandoDoPedido, type Fala } from "./pergunta";
import {
  instrucaoDaEtapa, leituraQueCabeNaEtapa, etapaDesteProduto, resumoDoAnotado,
  type Leitura, type TurnoDaConversa,
} from "./leitura";
import { juntarComAFrase, produtosNaFrase, ondeCadaProdutoAparece, familiaDoQueEleNomeou } from "./leitor-da-frase";
import { afirmouOuNegou, cercaDaPalavra, falaDeFotoRecebida, formasDoCliente } from "../texto";
import { identificarProduto } from "./produto";
import { categoriaUnicaDaFamilia, categoriasDaFamilia, chavesDeFamilia, ehNomeDeFamilia, ehPizzaQueNaoESalgado, familiaDoProduto, nomeDaFamilia, opcaoDaFamiliaNaFrase, opcoesDaFamilia } from "./generico";
import { APELIDOS } from "../dados/apelidos";
import { produtoNoComeco, produtoPorNome, produtosDaCasa, coresDoCardapio, unidadeDoPedido } from "../dados/produtos";
import { comoOClienteLe } from "../dados/grafia";
import { semAcento as semAc, PALAVRAS_VAZIAS, listaEmPortugues, numerosEscritos } from "../texto";
import { escreverObs, lerObs, mexerNaObs, type Embalagem } from "@/lib/banco/obs-do-bolo";
import { calcularBase, baseComQuantidades, ajusteDaBaseNaFrase, avisoDePoucoPorSabor, sortidoDaCasa } from "./base";
import { motorPadrao, brl } from "../orcamento";
import { dataDeRetirada, disseQuantidade, pediuPraFalarComGente, respostaAoValor } from "./falas-do-cliente";
import { retiradaForaDoExpediente, avisoDeEspera } from "@/lib/padaria-aberta";
import { coresDaForminha, faltaCorDaForminha, saborQueFalta, recheioQueNaoExiste, MARCA_SABOR_A_CONFIRMAR, saborCabeNaLista, saboresQueFaltam } from "./sabor";
import { restricoesQueACasaNaoFaz, misturaQueACasaFaz, obsSemRestricao, obsPraComanda, avisoDaRestricao, produtoDaRestricaoNaFrase } from "./restricao";
import { paraOMotor } from "./cotar";
import { respostaDeInformacao } from "./informacao";
import { respostaDaSituacao } from "./situacao";

/** O estado da conversa. E tudo que existe: nao ha memoria escondida. */
export type Estado = PedidoEmMontagem & {
  /**
   * A etapa pra onde voltar depois de resolver um desvio.
   *
   * "na verdade quero trocar o bolo" no meio dos docinhos: o fluxo vai pro
   * bolo, resolve, e volta pro docinho. Decidido com o dono em 23/08/2026,
   * porque resolver de longe e o que fazia a IA mexer no item errado.
   */
  retomarEm?: EtapaId | null;

  /**
   * A ETAPA QUE O CLIENTE POS NA MESA.
   *
   * Print do dono, 23/08/2026: ele perguntou "vcs fazem bolo?" e recebeu "O que
   * voce gostaria?". Perguntou de novo, palavra por palavra, e recebeu a mesma
   * volta. Quem pergunta duas vezes a mesma coisa nao esta insistindo, esta sem
   * resposta.
   *
   * Acontecia porque perguntar nao anota item nenhum: sem item, a abertura
   * continuava sendo a etapa da vez, e a abertura pergunta "o que voce precisa"
   * pra sempre.
   *
   * Aqui fica o que ele falou, e vale ate aquela etapa se resolver. Enquanto
   * durar, a conversa e sobre ISSO: quem pergunta de bolo ouve falar de bolo.
   */
  assunto?: EtapaId | null;
  /**
   * A ULTIMA PERGUNTA QUE A PADARIA FEZ, e quantas vezes ela ja insistiu nela.
   *
   * Teste da Kemilly, 23/08/2026: a mesma pergunta do tema saiu TRES vezes
   * seguidas, quase igual, porque as respostas dela (uma foto sem legenda e
   * "escrito trintei em rosa") nao viravam dado. Do lado do cliente isso e o
   * sinal mais claro de que ninguem esta lendo.
   *
   * Repetir e sinal de que a pergunta nao esta funcionando: quem insiste tem
   * que mudar de tatica, nao aumentar o volume.
   */
  ultimaFala?: string | null;
  insistiu?: number;
  /**
   * O QUE ELE PEDIU FORA DA HORA, GUARDADO ATE CHEGAR A HORA.
   *
   * "50 brigadeiro, forminha rosa, e um bolo de 2 kg de 4 leites" dito na etapa
   * do docinho: o bolo era descartado e, se ele nao repetisse, nao existia.
   * Agora fica aqui e entra sozinho quando a conversa chega no bolo.
   */
  guardados?: { produto: string; qtd: number; obs?: string | null }[];

  /**
   * O QUE FOI TIRADO DA OBSERVAÇÃO POR A CASA NÃO FAZER.
   *
   * Vive um turno só: `aplicar` põe, `responder` transforma em frase e limpa. É
   * o jeito de a função pura contar o que fez sem escrever em log de fora.
   *
   * Tirar calado é melhor que prometer "sem lactose" e entregar brigadeiro
   * normal, mas é pior que avisar: quem pede sem lactose tem motivo.
   */
  restricoesTiradas?: string[];
  // O `pedidoAprovado` mora em `PedidoEmMontagem`, e nao aqui: quem mais precisa
  // dele e a fala da abertura, que so enxerga aquele tipo. Ver `etapas.ts`.
  /**
   * A SUGESTAO DO MINIMO POR SABOR, quando FOMOS NOS que dividimos.
   *
   * "Num cento de salgados, o ideal e sempre 20 (...). Mas assim, sempre
   * sugerir", com o `recusar: false` do catalogo logo ao lado. Nao trava nada e
   * nao vira pergunta: sai na frente da pergunta da etapa e vive um turno so,
   * igual ao aviso de restricao.
   */
  poucoPorSabor?: string;
  /**
   * ELE MANDOU TIRAR ALGO E A FRASE SERVE PRA MAIS DE UMA LINHA.
   *
   * Guarda a FRASE dele, nao a lista de candidatos: os candidatos saem do
   * pedido na hora de perguntar, entao se a dona mexer no pedido pela tela
   * entre uma mensagem e outra a pergunta acompanha em vez de citar linha que
   * nao existe mais.
   *
   * DIFERENTE DO `poucoPorSabor` E DOS OUTROS AVISOS: aqueles vivem um turno e
   * saem na frente da pergunta da etapa. Este SUBSTITUI a pergunta da etapa e
   * ATRAVESSA a mensagem, porque e pergunta de verdade e precisa de resposta.
   * Por isso e gravado (`fluxo_tirando`): no WhatsApp cada mensagem e uma
   * chamada nova, e "eu ja perguntei isso" so existe se estiver no banco.
   *
   * Pergunta UMA vez. Se a resposta nao resolver, o campo e limpo e a conversa
   * anda: a Dora ja prendeu cliente em laco perguntando o sabor pra sempre, e
   * conversa que nao anda perde pedido igual conversa errada.
   */
  tirandoQual?: string | null;
  /**
   * O RECHEIO QUE O PRODUTO NAO TEM, pra padaria dizer qual e o dele.
   *
   * "coxinha de camarao" saia na comanda como "coxinha ~ camarao" e a
   * cozinha nao faz. Vive um turno so, igual ao aviso de restricao: sai na
   * frente da pergunta da etapa e some.
   */
  recheiosTrocados?: string[];
  /**
   * SABOR FORA DO CARDAPIO, so depois que o cliente insistiu.
   *
   * A dona: "se o cliente pedir outro sabor, a gente vai colocando". A padaria
   * mostra o cardapio primeiro. Se ele insiste, anota e chama a equipe.
   * Vive um turno na fala; a marca fica na observacao do item.
   */
  saboresAConfirmar?: string[];
};

/** Quem chama o modelo. Injetado pra dar pra testar sem gastar. */
/**
 * O QUE VAI PRO MODELO. E ELE PRECISA VER A CONVERSA, NAO SO A FRASE.
 *
 * `perguntaDaPadaria` e a ultima coisa que a padaria disse, e ate 03/09/2026 ela
 * NAO era mandada. O modelo recebia a frase do cliente sozinha:
 *
 *   padaria >> Quantas pessoas vao na festa?      (o modelo nunca viu isto)
 *   cliente >> 10
 *   modelo  >> 10x bolo, delegaEscolha
 *   pedido  >> 10 kg de bolo 4 leites, R$ 469,00
 *
 * Ele nao errou: ele nao tinha como saber do que se tratava. O unico contexto
 * que existia era a instrucao da etapa, escolhida pelo codigo -- e quando o
 * codigo escolhe a etapa errada, o modelo le a frase certa com a pergunta
 * errada, e o pedido inteiro sai torto.
 *
 * Palavra do dono, repetida durante um mes: *"deixa ela entender sozinha com
 * contexto, para de bloquear ela; cade o contexto dela?"*. Ele estava certo, e
 * a falta de contexto era literal: uma linha de `messages` que nao existia.
 */
export type Pensar = (args: {
  instrucao: string;
  mensagem: string;
  /**
   * A CONVERSA ATE AQUI, do mais antigo ao mais novo, sem a mensagem atual.
   *
   * Vai como turnos de conversa de verdade (`assistant` / `user`). E o que faz
   * "10" depois de "Quantas pessoas vao na festa?" ser dez pessoas, e o que
   * deixa o modelo saber de qual item era a pergunta do sabor. Medido 5 de 5
   * em 03/09/2026, inclusive com o codigo escolhendo a etapa ERRADA.
   */
  historico?: TurnoDaConversa[];
  /**
   * O QUE JA ESTA ANOTADO NO PEDIDO, como lembrete DEPOIS do historico.
   *
   * Fora do `system` de proposito: o system e o prefixo que a OpenAI guarda em
   * cache, e o pedido muda a cada mensagem. E depois do historico porque a
   * ordem de anotar que ficava so no comeco da instrucao era ignorada (17/08).
   */
  anotado?: string | null;
}) => Promise<Leitura>;
export type { TurnoDaConversa } from "./leitura";

export type Resposta = {
  fala: Fala;
  estado: Estado;
  etapa: EtapaId;
  /** O que aconteceu, em linhas curtas. Vai pro log e pro painel. */
  rastro: string[];
  /** Chamou a IA? Botao nao chama, e isso e dinheiro. */
  chamouIA: boolean;
  /**
   * ELE CONFIRMOU ESCREVENDO, sem tocar no botao.
   *
   * Vale so na etapa da confirmacao: "pode fechar" no meio dos docinhos e
   * conversa, nao e ordem de fechar pedido.
   */
  confirmouEscrevendo: boolean;
  /**
   * A conversa precisa de gente.
   *
   * Hoje so acontece quando a padaria ja insistiu na mesma pergunta e nao saiu
   * do lugar. E o unico caminho que acende o aviso no painel da dona: ate
   * 23/08/2026 o aviso aparecia sem a IA ter chamado ninguem, por causa de
   * cliente de teste esquecido no banco.
   */
  precisaHumano: boolean;
  /**
   * POR QUE ELA CHAMOU, em uma frase, pra quem abrir o painel.
   *
   * O aviso do painel dizia so que a IA tinha chamado. No pedido de festa de
   * 30/08/2026 ela prometeu "deixa eu confirmar com a equipe" sobre o sem
   * lactose, e nem o painel nem o sino nem a fila de aprovacao diziam de que se
   * tratava: pra descobrir era preciso ler as 47 mensagens da conversa. O
   * cliente ficou esperando um retorno que ninguem sabia que devia.
   */
  motivoHumano?: string | null;
  /**
   * A FOTO DESTE TURNO ERA O COMPROVANTE DO PIX.
   *
   * Quem salva a foto e a rota do WhatsApp, ANTES de o fluxo rodar: sem este
   * aviso ela nao teria como saber que aquela imagem e dinheiro, e o comprovante
   * ficaria guardado como referencia da peca, cobrindo a foto do bolo na tela do
   * pedido.
   */
  fotoEhComprovante?: boolean;
};

/**
 * O QUE CADA BOTAO SIGNIFICA.
 *
 * Lista fechada: id que nao esta aqui e tratado como texto. O id vem do proprio
 * codigo (pergunta.ts), entao nao ha o que interpretar.
 */
const DO_BOTAO: Record<string, (e: Estado) => Estado> = {
  base_sim: (e) => ({ ...e, baseAceita: true }),
  base_ajustar: (e) => ({ ...e, baseAceita: false }),
  // Um de cada vez, e sem apagar a resposta do outro: quem responde do topo
  // ainda nao respondeu do papel, e vice-versa.
  topo_sim: (e) => ({ ...e, pecas: { topo: true, papelDeArroz: e.pecas?.papelDeArroz ?? null } }),
  topo_nao: (e) => ({ ...e, pecas: { topo: false, papelDeArroz: e.pecas?.papelDeArroz ?? null } }),
  papel_sim: (e) => ({ ...e, pecas: { topo: e.pecas?.topo ?? null, papelDeArroz: true } }),
  papel_nao: (e) => ({ ...e, pecas: { topo: e.pecas?.topo ?? null, papelDeArroz: false } }),
  pag_pix: (e) => ({ ...e, dados: { ...e.dados, pagamento: "pix" } }),
  pag_cartao: (e) => ({ ...e, dados: { ...e.dados, pagamento: "cartao" } }),
  pag_dinheiro: (e) => ({ ...e, dados: { ...e.dados, pagamento: "dinheiro" } }),
  // AQUI FICAVAM OS BOTOES DO PRATO, E ELES SAIRAM COM A PERGUNTA.
  //
  // A pergunta do prato saiu em 28/08/2026, por decisao do dono: ela nao existe
  // no fluxograma da Kemilly, e a conversa medida mostrou o cliente ignorando as
  // tres perguntas do bolo e o pedido fechando com o prato em branco.
  //
  // Botao tratado que nenhuma etapa oferece e codigo morto, e foi o
  // `o-cliente-sempre-tem-saida` que cobrou: "ou some, ou alguem esqueceu de
  // oferecer".
  //
  // A LEITURA DO PRATO CONTINUA no `leitor-da-frase`: quem escrever "prato
  // aberto" ou "com tampa" tem o prato anotado e ele sai na comanda.

  // A oferta: aceitar leva pra etapa da familia, recusar segue pros dados. Nos
  // tres casos ela fica marcada como feita, porque oferta repetida vira empurra.
  oferta_docinho: (e) => ({ ...e, ofereceu: true, assunto: "docinho" }),
  oferta_bolo: (e) => ({ ...e, ofereceu: true, assunto: "bolo" }),
  oferta_nao: (e) => ({ ...e, ofereceu: true }),

  // "Mudar algo", no resumo final. Nao muda nada sozinho de proposito: quem
  // sabe o que ele quer mudar e ele, e a proxima fala dele diz. O que este
  // botao faz e desmarcar o aceite da proposta, pra conversa nao ficar tentando
  // fechar enquanto ele resolve.
  fecha_mudar: (e) => ({ ...e, retomarEm: null, assunto: null }),
  // "Confirmar", no resumo final. O estado nao muda aqui: quem fecha o pedido
  // e o `atender`, pelo id do botao. O que esta linha faz e impedir que o
  // toque mais importante da conversa caia no caminho do TEXTO e chame o
  // modelo pra ler a palavra "Confirmar" (custava uma chamada por pedido, e o
  // cabecalho deste arquivo jura que botao nao custa nada).
  fecha_sim: (e) => e,
};

// OS BOTOES FANTASMA SAIRAM DAQUI.
//
// salgado_sim, salgado_nao, mais_sim e mais_nao estavam nesta lista e NENHUMA
// etapa oferecia eles: codigo que nao roda, mas que quem le acredita. Pior: so
// o salgado tinha recusa, e o dono pediu explicitamente que as familias
// seguissem as mesmas regras. A recusa agora e por texto e vale nas tres
// (leitura.ts), que e o jeito que funciona tambem fora da janela de 24 horas,
// quando o WhatsApp nao deixa mandar botao nenhum.

/**
 * A CATEGORIA DO ITEM VEM DA ETAPA.
 *
 * Defeito que o teste pegou antes de ir pro ar: os itens entravam sem categoria
 * e a etapa do salgado nunca se dava por cumprida, entao a conversa ficava
 * presa perguntando salgado pra sempre, mesmo com coxinha e risolis anotados.
 *
 * A etapa e justamente quem sabe: estando no passo do salgado, o item e
 * salgado. Frito ou assado sai do cardapio, que e a mesma fonte do preco.
 */
// Exportada pra ser MEDIDA. A primeira versao do teste refez esta conta dentro
// da sonda, e por isso ficou verde com o conserto desfeito: media a copia.
export function categoriaDaEtapa(etapa: EtapaId, produto: string): string {
  const nome = semAc(produto);

  // O CATALOGO MANDA, MESMO DENTRO DA ETAPA DE OUTRA FAMILIA.
  //
  // Medido em 30/08/2026, conversa ao vivo: a etapa era a do salgado, o cliente
  // pediu pizza redonda, e `categoriaDaEtapa("salgado", ...)` devolvia
  // `salgado_frito` porque o nome nao estava na lista de frito/assado. A base
  // da festa (200 salgadinhos) caiu em cima da pizza, em quilo. Brigadeiro na
  // mesma etapa virou salgado_frito e entrou no mesmo rateio.
  //
  // Pizza nao e salgado de festa. Brigadeiro e docinho. A etapa so desempata
  // o que o cardapio nao conhece. Mini pizza, essa sim, e salgado assado.
  // Artigo na frente ("uma mini pizza") tambem tem que achar o produto.
  for (const f of formasDoCliente(produto)) {
    const doCatalogo = categoriaDoCatalogo(semAc(f));
    if (doCatalogo !== "outro") return doCatalogo;
    const daFamilia = categoriaUnicaDaFamilia(f);
    if (daFamilia) return daFamilia;
  }

  if (ehPizzaQueNaoESalgado(produto)) return "pizza";

  if (etapa === "salgado") {
    // O cardapio nao conhece o nome: frito e o padrao da casa, e e o que a
    // leitura anterior fazia quando nao achava na lista dos assados.
    return "salgado_frito";
  }
  if (etapa === "docinho") return "docinho";
  if (etapa === "bolo") {
    // NA ETAPA DO BOLO NEM TODO BOLO E DE FESTA.
    //
    // Estava fixo em "bolo_festa", e o caseiro saia cobrado por quilo. O
    // catalogo sabe qual e qual depois que o nome ja veio canonico. So
    // quando ele nao conhece o nome o padrao da etapa vale, e ai de festa
    // e o palpite da festa (o caseiro tem lista fechada e ja teria casado).
    const daCasa = produtoNoComeco(nome);
    if (daCasa?.categoria === "bolo_caseiro") return "bolo_caseiro";
    return "bolo_festa";
  }

  return "outro";
}

/**
 * DE QUE FAMILIA E ESTE PRODUTO, SEGUNDO O CARDAPIO.
 *
 * Casa pelo comeco do nome, sem acento: "esfirra de carne" e uma esfirra. O que
 * o cardapio nao conhece volta como "outro", que e honesto: melhor a dona ver
 * "outro" na tela e corrigir do que o sistema chutar familia errada e a comanda
 * sair no setor errado da cozinha.
 */
function categoriaDoCatalogo(nome: string): string {

  // A LISTA ÚNICA RESPONDE PRIMEIRO.
  //
  // Antes esta função remontava o catálogo, grupo por grupo, e cada grupo do
  // seu jeito. Um dos jeitos era `nome.startsWith("bolo ") -> bolo_festa`, e
  // isso mandava TODO bolo caseiro pra família errada, o que quer dizer preço
  // por quilo no lugar de por unidade e a comanda no setor errado.
  //
  // A lista única sabe a família de cada produto porque ela nasce do mesmo
  // lugar que o preço. Perguntar pra ela é uma linha.
  const daCasa = produtoNoComeco(nome);
  if (daCasa) return daCasa.categoria;

  // Bolo de festa: o sabor E o nome do produto ("marta rocha", "4 leites"), e
  // o cliente pode dizer só o sabor. A lista única guarda com o prefixo, então
  // o sabor solto ainda precisa desta passagem.
  // O SABOR SAI DA LISTA UNICA, E NAO DO JSON CRU.
  //
  // Esta era a ultima leitura crua do `catalogo.json` neste arquivo, e ela
  // remontava as faixas de preco pra chegar nos sabores. A lista unica ja
  // responde: o `nomeCurto` do bolo de festa E o sabor.
  //
  // O import do catalogo sai daqui junto. No `pergunta.ts` ele ja estava morto,
  // e os dois passaram pela minha leitura sem eu ver.
  const saboresDeBolo = produtosDaCasa()
    .filter((p) => p.categoria === "bolo_festa")
    .map((p) => semAc(p.nomeCurto));
  if (saboresDeBolo.some((sb) => nome === sb || nome.startsWith(sb))) return "bolo_festa";

  // "bolo" sozinho, ou um sabor que a casa ainda não cadastrou. É bolo de
  // festa porque o caseiro tem nome fechado e já teria casado ali em cima.
  if (nome === "bolo" || nome.startsWith("bolo ")) return "bolo_festa";

  // O que o cardápio não conhece volta como "outro", que é honesto: melhor a
  // dona ver "outro" na tela e corrigir do que o sistema chutar família errada.
  return "outro";
}

function categoriaNoCatalogo(produto: string): string | null {
  const p = produtoPorNome(produto) ?? produtoNoComeco(semAc(produto));
  return p?.categoria ?? null;
}

/**
 * A BASE DA FESTA SO CAI EM PRODUTO DAQUELA PERNA.
 *
 * `salgados: 200` e CONTA de salgadinho. Medido em 30/08/2026: o filtro era
 * `categoria.startsWith("salgado")`, e a pizza tinha acabado de receber
 * `salgado_frito` porque a etapa era a do salgado. Resultado: 200 kg de pizza
 * redonda. Brigadeiro no mesmo saco, categoria errada, comido pelo rateio.
 *
 * Pizza, padaria, docinho e bolo nunca entram no balde de salgado. Sem nome no
 * cardapio, so nome de familia de salgado (a linha generica da proposta).
 */
function entraNoRateioDaFamilia(
  i: { produto: string; categoria?: string },
  familia: string,
): boolean {
  const cat = categoriaNoCatalogo(i.produto);
  if (familia === "salgado") {
    if (cat) return cat === "salgado_frito" || cat === "salgado_assado";
    const fam = nomeDaFamilia(i.produto);
    return Boolean(fam && fam.startsWith("salgado"));
  }
  if (familia === "docinho") {
    if (cat) return cat === "docinho";
    return String(i.categoria || "").startsWith("docinho");
  }
  if (familia === "bolo") {
    if (cat) return cat.startsWith("bolo");
    return String(i.categoria || "").startsWith("bolo");
  }
  return String(i.categoria || cat || "").startsWith(familia);
}

function nomeouEsteItemNaFala(fala: string, produto: string): boolean {
  if (oClienteNomeouEsteProduto(fala, produto)) return true;
  const n = semAc(produto);
  return produtosNaFrase(fala).some((p) => {
    const a = semAc(p);
    return a === n || n.startsWith(a + " ") || a.startsWith(n + " ");
  });
}

/** Aplica no estado o que a IA leu. Nada entra sem passar por aqui. */
/**
 * O CLIENTE ESCOLHE O SABOR; A PROPOSTA DIZ QUANTO.
 *
 * Ele escreve "quero coxinha, risoles e esfirra" e nao fala numero nenhum,
 * porque o numero ja foi combinado: sao os 300 salgados da proposta que ele
 * aceitou. Entao o codigo reparte os 300 entre os tres, com o resto na primeira
 * linha pra soma bater exatamente.
 *
 * SE ELE DISSER A QUANTIDADE, A DELE MANDA. Quem escreve "200 coxinhas" quer
 * 200 coxinhas, e a proposta era proposta, nao contrato.
 */
function repartirABase(e: Estado, rastro: string[], falaDoCliente = ""): Estado {
  if (!e.baseAceita || !e.base) return e;

  // ELE DISSE ALGUM NUMERO NESTA MENSAGEM?
  //
  // Teste da Kemilly, 23/08/2026: ela escreveu "coxinha e mini bolha de carne",
  // sem numero nenhum, e o pedido saiu com 1 coxinha e 1 mini bolha. A proposta
  // de 200 salgados que ela tinha acabado de aceitar nao foi repartida.
  //
  // A instrucao mandava o modelo devolver zero quando ele nao dissesse a
  // quantidade, e o modelo devolveu 1. Prompt pede, codigo garante: quem sabe
  // se houve numero e a MENSAGEM, nao o modelo. Sem digito na fala, a
  // quantidade e da proposta, e o que o modelo mandou nao vale.
  const disseNumero = disseQuantidade(String(falaDoCliente));

  const alvos: [string, number][] = [
    ["salgado", e.base.salgados],
    ["docinho", e.base.docinhos],
    ["bolo", e.base.boloKg],
  ];

  const itens = [...e.itens];
  // As quantidades que ESTE trecho decidiu, pra saber se ficou pouco por sabor.
  const porSabor: number[] = [];
  // MUDOU DE VERDADE?
  //
  // A guarda de saida era `if (itens === e.itens) return e`, e ela NUNCA era
  // verdadeira: `itens` nasce de `[...e.itens]`, que e um array novo. Comparar
  // por referencia ali era comparar a copia com o original, e copia nunca e o
  // original.
  //
  // Entao a funcao sempre devolvia um estado novo, mesmo sem repartir nada.
  // Achado lendo linha por linha em 27/08/2026.
  let mudou = false;
  for (const [familia, total] of alvos) {
    if (!total) continue;
    const daFamilia = itens
      .map((i, idx) => ({ i, idx }))
      .filter(({ i }) => entraNoRateioDaFamilia(i, familia));
    if (!daFamilia.length) continue;

    // Sem numero nesta fala, reparte o que ele ACABOU de nomear (o modelo manda
    // 1) e o que ficou em zero. Nao volta a dividir o que ele ja tinha dito
    // quantidade: "50 coxinha" depois de "de frango" nao vira 100. Com numero
    // na fala, a dele manda e so completa quem ficou sem.
    // O LUGAR VAZIO SO DIVIDE QUANDO E O UNICO DA FAMILIA.
    //
    // Medido em 02/09/2026: base de 150 docinhos, ele escolheu brigadeiro e
    // beijinho, e o pedido fechou com 50 de cada. O marcador "docinho" contou
    // como terceira escolha e ficou com um terco de uma festa que ele nao vai
    // comer: 100 docinhos no lugar de 150.
    //
    // Ele SEGUE valendo enquanto o cliente nao escolheu ("quero docinho" sem
    // dizer qual): ali ele e o unico da familia e precisa levar a quantidade,
    // senao a proposta perde o docinho inteiro.
    const temEscolhaDeVerdade = daFamilia.some(({ i }) => !ehNomeDeFamilia(i.produto));
    const paraRepartir = daFamilia.filter(({ i }) => {
      if (ehNomeDeFamilia(i.produto)) return !temEscolhaDeVerdade;
      const temQtd = Number(i.qtd) > 0;
      if (disseNumero) return !temQtd;
      if (!temQtd) return true;
      return nomeouEsteItemNaFala(falaDoCliente, i.produto);
    });
    if (!paraRepartir.length) continue;

    const jaEscolhido = daFamilia
      .filter((x) => !paraRepartir.includes(x))
      .reduce((s, { i }) => s + (Number(i.qtd) > 0 ? Number(i.qtd) : 0), 0);
    const sobra = Math.max(0, total - jaEscolhido);
    if (!sobra) continue;

    const cada = Math.floor(sobra / paraRepartir.length);
    const resto = sobra - cada * paraRepartir.length;
    paraRepartir.forEach(({ idx }, ordem) => {
      const novaQtd = cada + (ordem === 0 ? resto : 0);
      // So conta como mudanca se o numero for outro: repartir 100 numa linha que
      // ja tinha 100 nao mudou nada.
      if (Number(itens[idx].qtd) !== novaQtd) mudou = true;
      itens[idx] = { ...itens[idx], qtd: novaQtd };
    });
    rastro.push("reparti " + sobra + " de " + familia + " entre " + paraRepartir.length + " escolha(s)");

    // O MINIMO POR SABOR SO FAZ SENTIDO EM PECA, NUNCA EM QUILO.
    //
    // O bolo entra nesta mesma divisao e vem em QUILOS: 2,5 kg cairia direto na
    // regra dos 20 e a padaria sugeriria "pelo menos 20 de cada" pra um bolo.
    // Por isso a conta olha so salgado e docinho, que sao os dois que a dona
    // citou e os dois que se vendem por cento.
    if (familia === "salgado" || familia === "docinho") {
      porSabor.push(...paraRepartir.map(({ idx }) => Number(itens[idx].qtd) || 0));
    }
  }

  if (!mudou) return e;
  // O aviso vive um turno: quem divide e este trecho, e a fala sai na proxima
  // resposta. Guardar no estado seria a padaria repetindo a sugestao pra sempre.
  const aviso = avisoDePoucoPorSabor(porSabor);
  return { ...e, itens, ...(aviso ? { poucoPorSabor: aviso } : {}) };
}

/**
 * A CERCA DO SABOR, pra perguntar se ele afirmou ou negou aquilo.
 *
 * Mesma fronteira de palavra que o leitor da frase usa: sem ela, "bacon" acharia
 * "bacon com milho" e a pergunta seria sobre o pedaco errado da frase.
 *
 * O sabor sai do catalogo, entao o escape aqui e higiene de regex, e nao
 * desconfianca do dado: um sabor com parentese no nome quebraria a expressao.
 */
const cercaDoSabor = cercaDaPalavra;

/**
 * O pedido ja tem este produto, escrito de outro jeito?
 *
 * "bolo 4 leites" e "4 leites" sao o mesmo bolo: o modelo poe o prefixo, o
 * cardapio nao. Sem comparar assim, o item guardado entrava DE NOVO e a fusao
 * do bolo misto escrevia "misto: bolo 4 leites e 4 leites" no cupom da cozinha.
 */
function jaTemEsseProduto(itens: { produto: string }[], produto: string): boolean {
  // O mesmo `semAc` de todo mundo, mais o prefixo do bolo.
  const limpo = (t: string) => semAc(t).replace(/^bolo +/, "").trim();
  const alvo = limpo(produto);
  if (!alvo) return false;
  return itens.some((i) => {
    const seu = limpo(i.produto);
    return seu === alvo || seu.includes(alvo) || alvo.includes(seu);
  });
}

function prefixoDaFamilia(chave: string): string {
  if (chave.startsWith("salgado")) return "salgado";
  if (chave === "docinho" || chave === "doce") return "docinho";
  if (chave.startsWith("bolo")) return "bolo";
  return chave;
}

function totalDitoDaFamilia(e: Estado, chave: string): number {
  const daLinha = e.itens.find((i) => nomeDaFamilia(i.produto) === chave);
  if (daLinha && Number(daLinha.qtd) > 0) return Number(daLinha.qtd);
  const pref = prefixoDaFamilia(chave);
  if (pref === "salgado") return e.base?.salgados ?? 0;
  if (pref === "docinho") return e.base?.docinhos ?? 0;
  if (pref === "bolo") return e.base?.boloKg ?? 0;
  return 0;
}

function temProdutoDeVerdade(e: Estado, pref: string): boolean {
  return e.itens.some((i) => {
    if (ehNomeDeFamilia(i.produto)) return false;
    if (pref === "salgado" || pref === "docinho" || pref === "bolo") {
      return entraNoRateioDaFamilia(i, pref);
    }
    return String(i.categoria || "").startsWith(pref);
  });
}

/**
 * ELE FALOU DESTE PRODUTO, OU A IA INVENTOU O TIPO?
 *
 * Medido no ar em 29/08/2026: "quero uma pizza" ficou familia, e na mensagem
 * seguinte ("escolhe voce os salgados") o modelo devolveu pizza inteira de
 * bacon. Ninguem falou inteira nem bacon. Os nomes e os apelidos saem do
 * catalogo, nao de uma lista minha.
 */
function oClienteNomeouEsteProduto(fala: string, produto: string): boolean {
  const t = semAc(fala);
  if (!t) return false;

  // O PLURAL DA FRASE, DEPOIS DA FORMA FIEL.
  //
  // A cerca de palavra recusa "inteira" dentro de "inteiras", e faz isso de
  // proposito: "carne" nao pode casar dentro de "descarnado". Mas o cliente
  // responde no plural quando pede mais de um, e a padaria pergunta assim.
  //
  // Medido contra a producao em 30/08/2026, com o container ja no SHA da main:
  //
  //   padaria >> Voce quer a pizza inteira, meia ou redonda?
  //   cliente >> quero 2 inteiras, uma de calabresa e uma de frango
  //   padaria >> Voce quer a pizza inteira, meia ou redonda?   (de novo)
  //
  // Das tres respostas que a propria padaria oferece, "inteira" era a unica
  // que ela nao lia: "redonda" e "meia" tem apelido proprio no catalogo, e
  // "inteira" so existe dentro do nome "pizza inteira". O corte do prefixo
  // (logo abaixo) entregava "inteira" contra uma frase que dizia "inteiras".
  //
  // A ordem e a mesma do `formasDoCliente`, e pelo mesmo motivo: a forma fiel
  // primeiro, a reduzida so se a fiel nao achou nada. E gramatica do
  // portugues, uma das tres origens legitimas, nao lista de palavra minha.
  const semPlural = t.replace(/(aes|oes|aos)\b/g, "ao").replace(/s\b/g, "");
  const achaNaFrase = (termo: string) => {
    const cerca = cercaDaPalavra(termo);
    return cerca.test(t) || cerca.test(semPlural);
  };

  const n = semAc(produto);
  if (n && achaNaFrase(n)) return true;
  for (const a of APELIDOS[produto] ?? []) {
    const aa = semAc(a);
    if (aa && achaNaFrase(aa)) return true;
  }
  const fam = familiaDoProduto(produto);
  if (fam && !ehNomeDeFamilia(produto)) {
    const resto = n.replace(semAc(fam), " ").replace(/ +/g, " ").trim();
    if (resto.length >= 4 && achaNaFrase(resto)) return true;
  }
  return false;
}

/**
 * QUEM MUDA O TOTAL DA FESTA NAO NEGOCIA: ATUALIZA A CONTA.
 *
 * "vamos fazer 150 salgados entao" nao pede pra recalcular pelas pessoas. O
 * numero novo e o da familia, e a proposta passa a ser esse.
 *
 * TRES BURACOS, MEDIDOS NA CONVERSA DELE DE 02/09/2026, e juntos travaram o
 * pedido inteiro:
 *
 *   padaria >> Pra 20 pessoas: 200 salgados, 100 docinhos, 2 kg. R$ 418,80.
 *   cliente >> (botao) Quero ajustar
 *   cliente >> quero 50 salgados a mais e 50 docinhos a mais
 *   padaria >> Pra 20 pessoas: 200 salgados, 100 docinhos... (A MESMA)
 *
 *   1. O NUMERO VINHA DO MODELO, e ele nao acerta "a mais": devolveu 100 numa
 *      mensagem e 150 na outra, quando o certo era 250. A conta agora sai da
 *      FRASE, que e onde o "50" e o "a mais" estao escritos.
 *
 *   2. O TOTAL NAO ERA REFEITO: a base passava a dizer 100 salgados e continuava
 *      cobrando os R$ 418,80 de 200. O cliente leria um numero e pagaria outro.
 *
 *   3. AJUSTAR NAO CONTAVA COMO RESPONDER. A etapa da base so se cumpre com
 *      `baseAceita`, entao a conversa ficava presa nela: os docinhos que ele
 *      escolheu depois, os salgados, tudo foi descartado, e vinte minutos
 *      depois a padaria propos a mesma base do comeco. O modelo tinha lido
 *      certo em todas as mensagens. Quem jogou fora fui eu.
 *
 * Ajustar e responder: era o que a propria padaria tinha oferecido.
 */
function atualizarBasePeloTotalDito(e: Estado, l: Leitura, fala = "", etapa?: EtapaId, rastro: string[] = []): Estado {
  if (!e.base) return e;

  // NA PROPOSTA, QUEM LE O AJUSTE E A FRASE, E NAO O MODELO.
  //
  // Medido em 02/09/2026 trocando o cerebro: pra "quero 50 salgados a mais e 50
  // docinhos a mais" o gpt-4.1-mini devolvia "50x salgado ;; 50x docinho" e o
  // deepseek-v4-flash nao devolvia item nenhum. A mesma frase, dois modelos,
  // dois resultados: com o segundo, o ajuste sumia de novo.
  //
  // Depender do modelo pra uma coisa que o codigo sabe ler sozinho e fragilidade
  // minha, nao defeito do modelo. O numero e o "a mais" estao ESCRITOS na frase,
  // e a padaria acabou de perguntar exatamente isso. Trocar de cerebro nao pode
  // mudar quanto a padaria cobra.
  const naProposta = etapa === "base_da_festa";
  const familias = (l.itens ?? []).filter((i) => nomeDaFamilia(i.produto) && Number(i.qtd) > 0);
  if (!familias.length && !naProposta) return e;

  // A frase manda, porque e onde esta o "a mais". Sem numero na frase (o cliente
  // respondeu "pode ser 150" numa mensagem so, por exemplo), vale o do modelo.
  const daFrase = ajusteDaBaseNaFrase(fala, e.base);
  if (!familias.length && !Object.keys(daFrase).length) {
    if (naProposta) rastro.push("na proposta, e a frase nao trouxe quantidade de familia");
    return e;
  }
  const doModelo: { salgados?: number; docinhos?: number; boloKg?: number } = {};
  for (const i of familias) {
    const pref = prefixoDaFamilia(nomeDaFamilia(i.produto) ?? "");
    const qtd = Number(i.qtd);
    if (pref === "salgado") doModelo.salgados = qtd;
    else if (pref === "docinho") doModelo.docinhos = qtd;
    else if (pref === "bolo") doModelo.boloKg = qtd;
  }
  const mudou = { ...doModelo, ...daFrase };

  const nova = baseComQuantidades(e, mudou);
  if (!nova) {
    rastro.push("nao consegui refazer a base com " + JSON.stringify(mudou));
    return e;
  }
  const igual =
    nova.salgados === e.base.salgados &&
    nova.docinhos === e.base.docinhos &&
    nova.boloKg === e.base.boloKg;
  if (igual) return e;

  // Ajustou na etapa da base: isso E a resposta da proposta, e a conversa segue.
  const respondeuAProposta = etapa === "base_da_festa";
  rastro.push(
    "ele mudou a base: " + nova.salgados + " salgados, " + nova.docinhos +
      " docinhos, " + nova.boloKg + " kg" + (respondeuAProposta ? " (e isso responde a proposta)" : ""),
  );
  return { ...e, base: nova, baseAceita: e.baseAceita || respondeuAProposta };
}

/**
 * ELE PEDIU PRA CASA ESCOLHER. O CODIGO MONTA O SORTIDO.
 *
 * A IA so diz que ele delegou. Os produtos saem do catalogo, na ordem da dona,
 * com a conta dos 20 por sabor. Quem ja escolheu produto de verdade nesta
 * familia nao e sobrescrito: a delegacao nao apaga o que ele nomeou.
 */
function aplicarDelegacao(e: Estado, etapa: EtapaId, delegaEm: string[] = []): Estado {
  // SO AS FAMILIAS QUE ELE DELEGOU. "os tipos de salgado e docinho pode
  // escolher voce" deixava a casa escolher o SABOR DO BOLO tambem (medido em
  // producao em 03/09/2026: o bolo saiu "4 leites" sem ninguem pedir). Quem
  // diz quais familias e o modelo; sem dizer, vale tudo, como antes.
  const delegou = (chave: string) =>
    !delegaEm.length || delegaEm.some((d) => prefixoDaFamilia(semAc(String(d))) === prefixoDaFamilia(chave));
  let itens = [...e.itens];
  let forminha = e.forminha;
  let mudou = false;

  // "ESCOLHE VOCE A COR DA FORMINHA" NAO E ESCOLHA DE DOCINHO.
  //
  // Medido em 30/08/2026: brigadeiro ja estava no pedido, o cliente disse
  // "escolhe voce a cor da forminha, confio", e a padaria perguntou "quais
  // docinhos" de novo. A delegacao so montava SORTIDO de produto, e pulava a
  // familia que ja tinha item. A cor sai do catalogo, primeira da lista da dona.
  if (faltaCorDaForminha(itens, forminha)) {
    const cores = coresDoCardapio();
    if (cores.length && (etapa === "docinho" || itens.some((i) => String(i.categoria || "").startsWith("docinho") || categoriaNoCatalogo(i.produto) === "docinho"))) {
      forminha = cores[0];
      mudou = true;
    }
  }

  const chaves = new Set<string>();
  for (const i of e.itens) {
    const n = nomeDaFamilia(i.produto);
    if (n) chaves.add(n);
  }
  if (!chaves.size) {
    if (etapa === "salgado" || etapa === "docinho" || etapa === "bolo") chaves.add(etapa);
    if (etapa === "base_da_festa" && e.base) {
      if (e.base.salgados > 0) chaves.add("salgado");
      if (e.base.docinhos > 0) chaves.add("docinho");
      if (e.base.boloKg > 0) chaves.add("bolo");
    }
  }
  if (chaves.size) {
    for (const chave of chaves) {
      const pref = prefixoDaFamilia(chave);
      if (!delegou(chave)) continue;
      if (temProdutoDeVerdade({ ...e, itens }, pref)) continue;
      const cats = categoriasDaFamilia(chave);
      if (!cats.length) continue;
      const total = totalDitoDaFamilia({ ...e, itens }, chave);
      const sortido = sortidoDaCasa(cats, total);
      if (!sortido.length) continue;
      itens = itens.filter(
        (i) => !(String(i.categoria || "").startsWith(pref) || prefixoDaFamilia(nomeDaFamilia(i.produto) ?? "") === pref),
      );
      itens.push(...sortido);
      mudou = true;
    }
  }
  if (!mudou) return e;
  const aceita = etapa === "base_da_festa" ? true : e.baseAceita;
  return { ...e, itens, forminha, baseAceita: aceita };
}

// O `rastro` entra aqui porque foi ele que achou o defeito do "tira a de
// calabresa": sem ele eu teria culpado a IA, e a IA estava fazendo a unica
// coisa que sabia fazer. Decisao tomada aqui dentro e decisao que precisa
// aparecer no log.
/** O maior bolo da casa, do proprio catalogo: "quadrado de 2,5 kg a 6 kg". */
const PESO_DO_MAIOR_BOLO = 6;

function naoCabeNoBolo(nome: string, qtd: number, fala: string, comoEleChamou: string, saborDito: string, rastro: string[] = []): string {
  const p = produtoPorNome(nome) ?? produtoNoComeco(nome);
  if (!p || !String(p.categoria).startsWith("bolo")) return nome;
  const familia = nomeDaFamilia(nome) ?? familiaDoProduto(nome);
  if (!familia || semAc(String(familia)) === semAc(nome)) return nome;

  // 1. BOLO POR QUILO COM QUANTIDADE ACIMA DE SEIS.
  const porPeso = unidadeDoPedido(nome, String(p.categoria)) === "kg";
  if (porPeso && qtd > PESO_DO_MAIOR_BOLO) {
    // SE EXISTE UM PRODUTO COM ESSE NOME QUE NAO E BOLO, E ELE.
    //
    // A guarda sabia que o numero era "de outro produto" e devolvia a FAMILIA,
    // ou seja, "nao sei qual, pergunta". Quando o cardapio tem o mesmo nome fora
    // dos bolos, nao ha o que perguntar: "50 brigadeiro" e o docinho de R$ 1,25,
    // e esta escrito no catalogo.
    //
    // Medido em 31/08/2026, e o item SUMIA do pedido:
    //
    //   cliente >> 50 brigadeiro e um bolo de 2 kg de 4 leites
    //   modelo  >> 50x brigadeiro
    //   resolveu>> bolo brigadeiro   (a palavra "bolo" da frase era do OUTRO item)
    //   guarda  >> virou a familia "bolo"
    //   fusao   >> "o bolo sem sabor virou o bolo de 4 leites"
    //   pedido  >> 2 kg de bolo 4 leites, e NENHUM docinho
    //
    // Os 50 docinhos desapareceram dentro do bolo. Devolver o docinho em vez da
    // familia corta a cadeia na origem, e e a resposta certa: e o que ele disse.
    const semBolo = semAc(nome).replace(/^bolo\s+/, "");
    const foraDoBolo = produtosDaCasa().find(
      (p) => semAc(p.nome) === semBolo && !String(p.categoria).startsWith("bolo"),
    );
    rastro.push(
      "nao anotei " + nome + " com " + qtd + ": o maior bolo da casa tem " +
      PESO_DO_MAIOR_BOLO + " kg, entao esse numero e de outro produto" +
      (foraDoBolo ? "; no cardapio esse nome e " + foraDoBolo.nome : ""),
    );
    return foraDoBolo ? foraDoBolo.nome : String(familia);
  }

  // 2. O BOLO VENDIDO POR UNIDADE NAO TEM TETO DE PESO, e escapava da
  //    regra de cima: "quero 50 de limao" virava 50 bolos caseiros de
  //    limao, R$ 1.545,00. O que denuncia ali e outra coisa: o nome do
  //    produto tem palavra que o cliente NAO disse ("caseiro"), e a
  //    palavra que ele disse tambem e sabor de outro produto (limao e
  //    sabor de trufa, de torta doce e de cuca recheada).
  //
  //    Sozinha, nenhuma das duas bastaria: "cenoura" tambem vira "bolo
  //    caseiro cenoura" sem ele dizer "caseiro", e ali esta certo, porque
  //    cenoura nao e sabor de mais nada.
  const ditasAqui = new Set(palavrasQueApontam(fala + " " + saborDito));
  const daFamiliaAqui = new Set(chavesDeFamilia().map((f) => semAc(f)));
  const naoDitas = palavrasQueApontam(nome).filter(
    (w) => !ditasAqui.has(w) && !daFamiliaAqui.has(w),
  );
  const ehSaborDeOutro = produtosDaCasa().some(
    (x) => x.nome !== nome && (x.sabores ?? []).some((s) => semAc(s) === semAc(comoEleChamou)),
  );
  if (naoDitas.length && ehSaborDeOutro) {
    rastro.push(
      "nao anotei " + nome + ": ele disse so \"" + comoEleChamou + "\", que tambem e sabor de outro produto",
    );
    return String(familia);
  }
  return nome;
}

/**
 * O RECHEIO FIXO SAI DO CARDAPIO, E NAO DA MEMORIA DO MODELO.
 *
 * "coxinha" e de frango e "bolinha de queijo" e de queijo: esta escrito no
 * catalogo, com `saborFixo`, e nao e escolha de ninguem. Mesmo assim a comanda
 * dependia do modelo lembrar de mandar o recheio junto.
 *
 * Medido conversando com o servidor em 31/08/2026, duas conversas seguidas com
 * a MESMA fala do cliente:
 *
 *   1a vez  modelo leu: 1x coxinha [frango]   ->  comanda com frango
 *   2a vez  modelo leu: 1x coxinha            ->  comanda SEM RECHEIO
 *
 * A cozinha recebia "50 un coxinha" e tinha que adivinhar. Dado que esta no
 * cardapio nao pode chegar na producao por sorte.
 *
 * RODA CEDO, ANTES DA DISTRIBUICAO DE SABOR, e isso importa: enquanto a coxinha
 * estava sem recheio anotado ela DISPUTAVA a palavra "frango" com o risolis, que
 * era quem a padaria tinha perguntado, e ganhava por ter recheio fixo. Com o
 * carimbo antes, ela ja esta resolvida e sai da disputa.
 */
/**
 * A PERGUNTA QUE ACABOU DE SAIR FOI A DO PESO, e isso e ESTADO, nao texto.
 *
 * Ate 03/09/2026 isto era `/quantos quilos/i.test(ultimaFala)`: o codigo lendo
 * a propria frase por regex pra saber o que tinha perguntado. A marca ja
 * existia: quem faz a pergunta grava `etapa:peso` em `etapasJaPerguntadas`, e
 * a ultima marca e a pergunta que acabou de sair.
 *
 * O modelo, vendo a conversa, ja devolve o item por quilo com o peso na
 * quantidade (medido 15 de 15 em 03/09/2026 com "2", "dois", "2 kg", "um e
 * meio" e "500g"). O que fica aqui e a rede pro dia em que ele nao devolver.
 */
function perguntaDePeso(e: Estado): boolean {
  const marcas = e.etapasJaPerguntadas ?? [];
  return /:peso$/.test(String(marcas[marcas.length - 1] ?? ""));
}

/**
 * ESTA FRASE PODE SER A RESPOSTA DO PESO?
 *
 * Medido conversando com a producao em 01/09/2026, e custava R$ 499,00 num bolo
 * so:
 *
 *   padaria >> O bolo e vendido por quilo. Quantos quilos voce quer?
 *   cliente >> nao quero topo nem papel de arroz nem prato
 *   padaria >> (a mesma pergunta, porque nao havia peso na frase)
 *   cliente >> dia 12 as 15h
 *   pedido  >> 12 kg de bolo biz          R$ 598,80 no lugar de R$ 99,80
 *
 * Foi defeito MEU, de 31/08: eu ensinei a padaria a ler numero solto como peso
 * depois da pergunta do peso, e nao disse o que e "solto". Enquanto a pergunta
 * ficar de pe, qualquer numero de qualquer frase virava quilo.
 *
 * Dois sinais objetivos, e nenhuma lista de palavras minha:
 *
 *   - a frase tem NO MAXIMO UM numero. "dia 12 as 15h" tem dois, e ninguem
 *     responde peso com dois numeros;
 *   - o modelo nao leu DADO de retirada nesta frase. Quem esta marcando dia,
 *     hora, nome ou pagamento nao esta falando de quilo.
 *
 * "2", "dois", "um e meio", "2 kg" e "pode ser 500g" continuam passando.
 */
function frasePodeSerPeso(fala: unknown, leuDados: boolean): boolean {
  if (leuDados) return false;
  return (String(fala ?? "").match(/[0-9]+(?:[.,][0-9]+)?/g) ?? []).length <= 1;
}

/**
 * O PEDAÇO DA FRASE QUE FALA DESTE PRODUTO.
 *
 * Medido conversando com a produção em 02/09/2026, na primeira conversa de
 * cliente decidido:
 *
 *   cliente >> queria 3 cucas e 2 kg de pao frances pra amanha
 *   modelo  >> 3x cuca ;; 2x pao frances        (leu certo)
 *   pedido  >> 2 kg de cuca, 2 kg de pão francês
 *
 * A cuca também é vendida por quilo, e o leitor de peso olhava a frase INTEIRA:
 * achou o "2 kg" do pão e aplicou na cuca também. As três cucas viraram dois
 * quilos, e o cliente só veria na retirada.
 *
 * Aqui a frase é cortada em volta do nome do produto, do jeito que uma pessoa
 * lê: o número que vale pra cuca é o que está perto da palavra "cuca". Sem achar
 * o nome, devolve a frase inteira, que é o comportamento de sempre — quem pede
 * um produto só continua podendo dizer o peso onde quiser.
 */
function oPedacoDesteProduto(fala: unknown, produto: unknown): string {
  const t = String(fala ?? "");
  const alvo = semAc(String(produto ?? ""));
  if (!t || !alvo) return t;
  // O CORTE É NO SEPARADOR, e não em número de letras.
  //
  // Cortar por janela de caracteres não resolve: em "3 cucas e 2 kg de pao
  // frances" o vizinho está a nove letras de distância, e qualquer janela útil
  // alcança ele. Quem separa dois pedidos numa frase é a vírgula e o "e", que é
  // como a pessoa escreve.
  const pedacos = t.split(/,| e /i);
  const meu = pedacos.find((p) => semAc(p).includes(alvo));
  return meu ?? t;
}

/**
 * O PESO QUE ESTA ESCRITO NUMA FRASE.
 *
 * Entende o que a clientela da padaria escreve: "2 kg", "2kg", "500g", "700
 * gramas", "2 quilos e meio", "1,7 kg".
 *
 * `numeroSolto` liga quando a padaria ACABOU de perguntar o peso: ali "2",
 * "dois" e "um e meio" tambem sao peso, porque ninguem repete a unidade na
 * resposta. Fora dessa hora fica desligado, senao qualquer numero da conversa
 * grudaria no item que estivesse em aberto.
 */
function pesoNaFala(fala: string, numeroSolto: boolean): number {
  const t = semAc(String(fala || ""));
  const m = t.match(/([0-9]+(?:[.,][0-9]+)?)\s*(kg|quilos?|gramas?|g)(?![a-z])(\s*e\s*meio)?/i);
  if (m) {
    let p = Number(String(m[1]).replace(",", "."));
    if (/^g/i.test(String(m[2]))) p = p / 1000;
    if (m[3]) p += 0.5;
    return p;
  }
  if (!numeroSolto) return 0;
  // "um e meio" e um e meio, e nao meio: a palavra vira numero antes.
  let comNumero = t;
  for (const [palavra, valor] of numerosEscritos({ umEUma: true })) {
    comNumero = comNumero.replace(
      new RegExp("(^|[^a-z0-9])" + palavra + "([^a-z0-9]|$)", "gi"),
      "$1" + valor + "$2",
    );
  }
  const so = comNumero.match(/(?:^|\s)([0-9]+(?:[.,][0-9]+)?)(\s*e\s*meio)?(?:\s|$)/i);
  if (so) return Number(String(so[1]).replace(",", ".")) + (so[2] ? 0.5 : 0);
  if (/\bmeio\b/i.test(t)) return 0.5;
  return 0;
}

function comORecheioDoCardapio(itens: Estado["itens"], rastro: string[]): Estado["itens"] {
  return itens.map((i) => {
    const p = produtoPorNome(String(i.produto || "")) ?? produtoNoComeco(String(i.produto || ""));
    if (!p?.saborFixo || p.sabores.length !== 1) return i;
    const fixo = p.sabores[0];
    if (semAc(String(i.obs ?? "")).includes(semAc(fixo))) return i;
    rastro.push("carimbei o recheio do cardapio: " + i.produto + " e de " + fixo);
    return { ...i, obs: [i.obs, fixo].filter(Boolean).join(" | ") };
  });
}

function aplicar(e: Estado, l: Leitura, etapa: EtapaId, falaDoCliente = "", rastro: string[] = []): Estado {
  let novo: Estado = { ...e };

  if (l.ehFesta === true) novo.ehFesta = true;
  // Numero de pessoas E festa, mesmo que ele nao tenha usado a palavra: quem
  // diz "somos 20" esta organizando alguma coisa.
  if (typeof l.pessoas === "number" && l.pessoas > 0) {
    novo.pessoas = l.pessoas;
    novo.ehFesta = true;
  }
  if (l.aceitouBase === true) novo.baseAceita = true;
  // Escrevendo tambem se responde, e so o que ele falou entra: dizer "quero
  // topo" nao pode apagar o papel de arroz que ele ja tinha recusado.
  // UMA FRASE PODE RESPONDER AS DUAS PERGUNTAS.
  //
  // Na medicao de 25/08 o cliente escreveu "na embalagem com tampa, sem topo e
  // sem papel de arroz" e o modelo devolveu so o prato. A padaria perguntou o
  // papel de arroz DUAS vezes depois disso e a conversa travou sem fechar.
  // Quem sabe o que ele respondeu e a MENSAGEM, nao o modelo: aqui o codigo le
  // a frase e completa o que o modelo deixou passar.
  // A leitura ja vem juntada com a frase la em cima, entao aqui e so aplicar.
  if (l.pecas) {
    // QUANDO ELE NOMEIA UMA DAS PECAS, SO VALE O VALOR DAQUELA.
    //
    // O modelo TROCA as duas, e isso foi medido duas vezes na mesma conversa de
    // 30/08/2026, com o rastro do lado:
    //
    //   cliente >> nao quero papel de arroz nao
    //   modelo  >> pecas={"topo":TRUE,"papelDeArroz":false}
    //
    //   cliente >> nao, sem topo
    //   modelo  >> pecas={"topo":false,"papelDeArroz":TRUE}
    //
    // Recusar uma e ele marca a OUTRA como aceita. Na producao isso pos um
    // papel de arroz de R$ 12,00 num pedido que o cliente tinha recusado, e o
    // topo, que a equipe orca a parte, num bolo que ia sem.
    //
    // A regra nao decide nada pelo cliente: ela so recusa o que ele NAO falou.
    // Se a frase nomeia uma peca, a outra fica como estava. Se nao nomeia
    // nenhuma ("pode ser", "quero sim"), as duas valem, porque ai ele esta
    // respondendo a pergunta que a padaria fez e o modelo e quem sabe qual era.
    const dito = semAc(falaDoCliente);
    const falouDoTopo = /(^|[^a-z])topo/.test(dito);
    const falouDoPapel = /papel|arroz/.test(dito);
    const nomeouUma = falouDoTopo !== falouDoPapel;
    const vale = (qual: "topo" | "papel") =>
      !nomeouUma || (qual === "topo" ? falouDoTopo : falouDoPapel);

    const antesTopo = novo.pecas?.topo ?? null;
    const antesPapel = novo.pecas?.papelDeArroz ?? null;
    novo.pecas = {
      topo: typeof l.pecas.topo === "boolean" && vale("topo") ? l.pecas.topo : antesTopo,
      papelDeArroz:
        typeof l.pecas.papelDeArroz === "boolean" && vale("papel")
          ? l.pecas.papelDeArroz
          : antesPapel,
    };
    if (nomeouUma) {
      const ignorada = falouDoTopo ? "papelDeArroz" : "topo";
      const veio = falouDoTopo ? l.pecas.papelDeArroz : l.pecas.topo;
      if (typeof veio === "boolean") {
        rastro.push("ignorei " + ignorada + "=" + veio + ": ele falou so da outra peca");
      }
    }
  }
  if (l.escrito) novo.escrito = String(l.escrito).trim();
  if (l.aniversariante?.nome) novo.topoNome = String(l.aniversariante.nome).trim();
  if (l.aniversariante?.idade) novo.topoIdade = String(l.aniversariante.idade).trim();
  if (l.tema) novo.tema = String(l.tema).trim();
  // AQUI HAVIA `novo.forminha = l.forminha` CRU, E ELE APAGAVA O QUE VINHA ANTES.
  //
  // Esta linha rodava vinte antes do bloco que decide a cor de verdade, e o
  // bloco compara a cor nova com A QUE JA ESTAVA. So que a que ja estava tinha
  // acabado de ser sobrescrita aqui, entao a comparacao era sempre com ela
  // mesma e a regra "lembrar nao e trocar" nunca disparava.
  //
  // Medido em 28/08/2026, na terceira conversa seguida: a montagem guardava
  // "rosa e azul" e o pedido fechado gravava "rosa". Era a MESMA regra que eu ja
  // tinha escrito duas vezes, derrubada por uma atribuicao esquecida acima dela.
  //
  // A atribuicao era redundante desde sempre: o bloco abaixo faz o mesmo
  // trabalho, e melhor.

  // AS CORES VALEM PRO PEDIDO TODO, E TODAS ELAS.
  //
  // Regra do dono, 24/08/2026: uma ou mais cores, e nunca perguntar cor por
  // docinho. Quem diz "azul e rosa" escolheu as cores da festa dela; separar
  // qual docinho vai em qual e detalhe que a padaria resolve na bancada.
  if (l.forminha) {
    // As cores ja vieram juntadas com a frase: aqui e so normalizar e guardar.
    // O CARIMBO NOS ITENS ACONTECE NO FIM DESTA FUNCAO, de proposito: ver o
    // comentario la embaixo.
    //
    // COR QUE O CLIENTE NAO DISSE NAO ENTRA.
    //
    // Medido no pedido de festa de 30/08/2026: o cliente escolheu "metade
    // brigadeiro e metade beijinho" e NUNCA falou de cor. O modelo devolveu
    // `forminha: "rosa"` por conta propria, o codigo aceitou, e a etapa da cor
    // se deu por cumprida. Resultado: a padaria nunca perguntou, a comanda dos
    // docinhos foi impressa com "forminha rosa" e a producao ia montar 100
    // forminhas na cor errada.
    //
    // A dona e explicita nos audios: "na hora que a pessoa escolher docinho, a
    // gente SEMPRE pergunta a cor da forminha". Quem escolhe a cor e o cliente,
    // ou ele delega com todas as letras, e ai quem escolhe e `aplicarDelegacao`.
    const naFala = semAc(falaDoCliente);
    const jaGuardadas = semAc(String(novo.forminha ?? ""));
    const ditasDeVerdade = coresDaForminha(String(l.forminha)).filter((c) => {
      const cor = semAc(c);
      return naFala.includes(cor) || jaGuardadas.includes(cor);
    });
    const inventadas = coresDaForminha(String(l.forminha)).filter((c) => !ditasDeVerdade.includes(c));
    if (inventadas.length) {
      rastro.push(
        "o modelo disse forminha " + inventadas.join(" e ") +
        " e o cliente nunca falou de cor; nao anotei e a etapa da cor continua de pe",
      );
    }
    const cores = ditasDeVerdade;
    if (cores.length) {
      // LEMBRAR DE UMA COR NAO APAGA A OUTRA, E ESTE E O LADO DA MEMORIA.
      //
      // A mesma regra foi escrita na montagem, que e o lado do BANCO, e eu
      // parei ali. Medido na conversa seguinte, em 28/08/2026:
      //
      //     cliente  >> sim, mas nao esquece da forminha rosa
      //     no banco >> forminha rosa          (o pedido fechado)
      //     na tela  >> forminha rosa e azul   (a montagem)
      //
      // A comanda da cozinha saia com uma cor e a tela da dona com duas. E o
      // fechamento usa o estado da MEMORIA, entao consertar so a gravacao nao
      // alcancava o pedido de verdade.
      //
      // Sexta vez nesta sessao que eu conserto um lado e o outro fica, e a
      // primeira em que o outro lado era meu, escrito dez minutos antes.
      const jaTem = String(novo.forminha ?? "")
        .split(/\s+e\s+|,/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
      const agora = cores.map((x) => x.trim().toLowerCase());
      const soLembrou = jaTem.length > 0 && agora.every((c) => jaTem.includes(c));
      novo.forminha = soLembrou ? jaTem.join(" e ") : agora.join(" e ");
    }
  }

  // (o tema ja foi aplicado la em cima; a linha repetida saiu em 27/08/2026)
  if (l.prato) novo.prato = l.prato;
  // ------------------------------------------------- "NAO QUERO" DESFAZ
  //
  // Toda pergunta sabia gravar sim e gravar nao, e nao sabia VOLTAR ATRAS. Foi o
  // beco do teste da Kemilly, 23/08/2026:
  //
  //   Dora:    O nome do topo vai ser qual?
  //   Kemilly: nao quero topo
  //   Dora:    Em nome de quem vai o topo?
  //   Kemilly: nao quero topo de bolo
  //   Dora:    Para quem eu coloco o nome no topo?
  //
  // Ela tinha um "sim" gravado (que nem era dela: veio de uma pergunta que a
  // reescrita trocou) e nao havia como desdizer. Agora recusa apaga o que
  // estava preso naquela resposta, e a conversa anda.
  if (l.naoQuer?.length) {
    novo.naoQuer = [...novo.naoQuer, ...l.naoQuer];
    const recusou = (o: string) => l.naoQuer!.some((x) => new RegExp(o, "i").test(String(x)));

    if (recusou("topo")) {
      novo.pecas = { topo: false, papelDeArroz: novo.pecas?.papelDeArroz ?? null };
      // O nome e a idade eram do topo. Sem topo, eles nao tem dono, a menos que
      // o papel de arroz continue de pe: ele tambem e fabricado com os dois.
      if (novo.pecas.papelDeArroz !== true) {
        novo.topoNome = null;
        novo.topoIdade = null;
      }
      // Desmarcar o topo NAO pode levar junto o tema, o nome nem o que a IA
      // anotou por fora: o papel de arroz pode continuar de pe e e fabricado
      // com os mesmos dados.
      novo.itens = novo.itens.map((i) =>
        String(i.categoria || "").startsWith("bolo")
          ? { ...i, obs: mexerNaObs(i.obs, { topo: false }) || null }
          : i,
      );
    }
    if (recusou("papel")) {
      novo.pecas = { topo: novo.pecas?.topo ?? null, papelDeArroz: false };
      novo.itens = novo.itens.filter((i) => !/papel de arroz/i.test(i.produto));
    }
    // Recusar uma familia tira o que ja estava anotado dela: quem diz "sem
    // docinho" depois de ter escolhido dois nao quer os dois no pedido.
    for (const [palavra, prefixo] of [["salgado", "salgado"], ["docinho|doce", "docinho"], ["bolo", "bolo"]] as const) {
      if (recusou(palavra)) {
        novo.itens = novo.itens.filter((i) => !String(i.categoria || "").startsWith(prefixo));
      }
    }

    // AJUSTAR A BASE E RESPONDER A BASE.
    //
    // A padaria oferece a base com estas palavras: "da R$ 628,20 no total, e da
    // pra ajustar o que voce quiser". Quem responde "nao quero docinho, so
    // salgado e bolo" AJUSTOU, que e exatamente o que foi oferecido. So que o
    // `baseAceita` era ligado por duas coisas apenas, o botao e um `aceitouBase`
    // do modelo, e nenhuma das duas acontece nesse caso.
    //
    // Medido em 27/08/2026 com uma festa de 30 pessoas, e o estrago foi total:
    //
    //   cliente >> nao quero docinho, so salgado e bolo
    //   padaria >> Pra 30 pessoas, uma base boa e 300 salgados, 0 docinhos...
    //   cliente >> coxinha e risoles de carne, metade de cada
    //   padaria >> Pra 30 pessoas, uma base boa e 300 salgados, 0 docinhos...
    //   cliente >> bolo de ninho com nutella, 3 kg
    //   padaria >> Acho que nao estou conseguindo entender direito por aqui.
    //
    // A base foi recalculada certo (os docinhos zeraram), e mesmo assim a
    // pergunta voltou duas vezes, ate a conversa cair no chamado pra equipe. O
    // cliente ainda mandou data, nome e pagamento, e ouviu a mesma frase.
    //
    // So vale quando a base JA FOI OFERECIDA. Quem diz "nao quero bolo" antes
    // de ver proposta nenhuma nao respondeu pergunta alguma, e ai a base tem
    // que ser oferecida normalmente, ja sem o bolo.
    if (!novo.baseAceita && novo.base && (novo.etapasJaPerguntadas ?? []).includes("base_da_festa")) {
      novo.baseAceita = true;
    }
  }

  if (l.dados) {
    novo.dados = {
      nome: l.dados.nome ?? novo.dados.nome,
      // A DATA PASSA PELA CONFERENCIA DO CODIGO.
      //
      // O modelo escreveu "05/09/2024" pra quem disse "dia 05 de setembro" em
      // agosto de 2026. Data que nao da pra entender vira null, e null faz a
      // padaria perguntar de novo em vez de anotar dia inventado.
      data: dataDeRetirada(l.dados.data) ?? novo.dados.data,
      hora: l.dados.hora ?? novo.dados.hora,
      pagamento: l.dados.pagamento ?? novo.dados.pagamento,
    };
  }

  // O SABOR DE UM ITEM DESCARTADO VOLTA A FICAR SOLTO.
  //
  // Ver o `donoNaFrase`, mais abaixo: ele marca como "ja tem dono" todo sabor
  // que o modelo amarrou a algum item, pra uma palavra nao grudar em dois
  // lugares. So que ele era montado da leitura CRUA, incluindo item que o fluxo
  // tinha jogado fora.
  //
  // Medido conversando com o servidor em 31/08/2026: o modelo respondeu a
  // pergunta do recheio do risolis com "1x mini sanduiche de pate de frango
  // [frango]", o item foi descartado por ser invencao, e mesmo assim o "frango"
  // ficou preso nele. O risolis nunca recebia o sabor e a padaria repetia a
  // pergunta pra sempre.
  //
  // Mora fora do `if` de proposito: quem le esta lista esta depois dele.
  const saboresDeItemDescartado: string[] = [];
  if (l.itens?.length) {
    // N SABORES COM QUANTIDADE N SAO N LINHAS, UMA DE CADA.
    //
    // Medido ao vivo em 30/08/2026, depois de a instrucao da quantidade entrar:
    //
    //   cliente >> quero 2 inteiras, uma de calabresa e uma de frango com catupiry
    //   no banco >> 2 ~ pizza inteira ~ frango com catupiry ~ R$ 240,00
    //
    // O dinheiro ficou certo e a COZINHA nao: a calabresa sumiu, e sairiam duas
    // pizzas iguais. O modelo devolve os dois sabores numa string so
    // ("calabresa | frango com catupiry"), o codigo trata como UM sabor, essa
    // string nao aparece literal na fala do cliente, e ela e descartada.
    //
    // A conta e sem chute: se ele pediu N e citou N sabores, cada pizza leva um.
    // Com qtd 1 e dois sabores fica UMA linha, que e a pizza de dois sabores, e
    // a inteira aceita ate quatro. Com N sabores e qtd diferente de N, tambem
    // nao mexe: nao da pra saber quantas de cada, e adivinhar seria pior.
    //
    // Quem diz o que e sabor e o CATALOGO, e nao a pontuacao: pedaco que nao e
    // sabor daquele produto e recado ("sem cebola") e continua junto.
    const abertos: NonNullable<typeof l.itens> = [];
    for (const bruto of l.itens) {
      // O QUE O MODELO DEVOLVE DE VERDADE, LIDO NO RASTRO EM 30/08/2026:
      //
      //   modelo leu: 2x pizza [calabresa e frango com catupiry]
      //
      // Duas coisas que eu tinha SUPOSTO errado, e as duas custaram um deploy:
      //
      //   1. o produto vem como NOME DE FAMILIA ("pizza"), e nao "pizza
      //      inteira". `produtoPorNome("pizza")` devolve null, entao procurar os
      //      sabores pelo nome do item nao acha nada.
      //   2. os sabores vem juntos por " e ", e nao por "|". Split em "|" nunca
      //      separava.
      //
      // Por isso aqui NAO SE SEPARA POR PONTUACAO: procura-se quais sabores do
      // CATALOGO aparecem dentro da string. Serve pra qualquer separador que o
      // modelo escolher, hoje ou amanha.
      const nome = String(bruto.produto ?? "");
      const doItem = produtoPorNome(nome)?.sabores ?? [];
      // Nome de familia nao e produto: os sabores saem dos produtos dela.
      const daFamilia = doItem.length
        ? doItem
        : produtosDaCasa()
            .filter((x) => semAc(x.nome).startsWith(semAc(nome) + " "))
            .flatMap((x) => x.sabores ?? []);

      // DO MAIS LONGO PRO MAIS CURTO, E CONSUMINDO O QUE CASOU.
      //
      // "frango" tambem casa DENTRO de "frango com catupiry". Sem consumir o
      // trecho, esta frase daria TRES sabores onde ha dois, e a conta de abrir
      // (um por pizza) sairia errada.
      const lista = [...new Set(daFamilia.map(String))].sort((a, b) => b.length - a.length);
      let resto = semAc(String(bruto.sabor ?? ""));
      const achados: string[] = [];
      for (const s of lista) {
        const alvo = semAc(s);
        if (alvo && resto.includes(alvo)) {
          achados.push(s);
          resto = resto.replace(alvo, " ");
        }
      }

      const qtdDita = Number(bruto.qtd) || 0;
      // BOLO MISTO PEDIDO NUM ITEM SO: ABRE, E A FUSAO JUNTA DE VOLTA.
      //
      // Cliente real em 31/08/2026:
      //
      //   padaria >> E o bolo, qual sabor?
      //   cliente >> Laka e biz
      //   padaria >> E o bolo, qual sabor?          (a mesma pergunta)
      //   cliente >> Laka e biz                     (ele repetiu)
      //
      // O modelo devolveu a FAMILIA com os dois sabores num item so
      // (`{produto: "bolo", sabor: "laka e biz"}`). Os sabores ficavam na
      // observacao e o produto continuava sendo "bolo", que e o marcador de
      // "ainda nao escolheu": a etapa via generico e perguntava de novo.
      //
      // Quando o modelo manda os dois bolos separados, o mesmo pedido resolve
      // certo, porque a fusao do bolo misto junta os dois numa linha so. Entao
      // aqui e so abrir do mesmo jeito e deixar a fusao fazer o que ela ja faz.
      //
      // SO PRA BOLO. Pizza com dois sabores e UMA pizza, e abrir viraria duas
      // linhas de R$ 120: e o defeito que custou R$ 240 num pedido de festa e
      // que a fusao do bolo nao protege, porque ela e do bolo.
      //
      // NO BOLO, O SABOR E O PROPRIO NOME DO PRODUTO ("bolo laka"), e nao uma
      // lista `sabores` dentro dele. Por isso a busca de cima nao acha nada aqui
      // e os nomes tem que sair de `opcoesDaFamilia`.
      const familiaDoBruto = ehNomeDeFamilia(nome) ? categoriasDaFamilia(nome) : [];
      const eFamiliaDeBolo = familiaDoBruto.some((c) => String(c).startsWith("bolo"));
      const saboresDeBolo = eFamiliaDeBolo
        ? (() => {
            const dito = semAc(String(bruto.sabor ?? ""));
            let sobra = dito;
            const achei: string[] = [];
            for (const o of opcoesDaFamilia(nome)
              .map(String)
              .sort((a, b) => b.length - a.length)) {
              const curto = semAc(o).replace(/^bolo\s+/, "");
              if (curto.length > 2 && sobra.includes(curto)) {
                achei.push(o);
                sobra = sobra.replace(curto, " ");
              }
            }
            return achei;
          })()
        : [];

      if (achados.length > 1 && qtdDita === achados.length) {
        for (const s of achados) abertos.push({ ...bruto, qtd: 1, sabor: s });
      } else if (saboresDeBolo.length > 1) {
        for (const s of saboresDeBolo) abertos.push({ ...bruto, produto: s, qtd: qtdDita, sabor: undefined });
      } else {
        abertos.push(bruto);
      }
    }
    const itens = [...novo.itens];
    // QUANTOS ITENS JA EXISTIAM ANTES DESTA LEITURA.
    //
    // A juncao logo abaixo existe pra CORRIGIR o que ja estava anotado ("muda
    // pra 100 brigadeiro"), e ela casa so pelo nome do produto. Como o laco
    // acumula dentro do mesmo array, dois itens ditos na MESMA frase caiam um
    // em cima do outro:
    //
    //   cliente >> quero 2 inteiras, uma de calabresa e uma de frango
    //   no banco >> 1 pizza inteira (calabresa | frango), R$ 120,00
    //
    // Ele pediu duas, a padaria cobrou uma, e a cozinha recebeu uma pizza so
    // com dois sabores no recado, sem saber o que montar. Medido ao vivo em
    // 30/08/2026, e medido de novo aqui: com o modelo devolvendo as DUAS
    // linhas certinhas, o codigo juntava as duas assim mesmo.
    //
    // O `HANDOFF-PRO-CLAUDE.md` dizia que o codigo gravava certo e que o
    // problema era so o modelo. Medi antes de escrever em cima disso, e nao
    // era: nenhuma forma de resposta do modelo conseguia produzir duas pizzas.
    //
    // POR QUE A MARCA E O TEMPO, E NAO O SABOR
    //
    // Separar por sabor parece obvio e cobraria DOBRADO de quem pede uma pizza
    // de dois sabores: a inteira aceita ate quatro, e "uma de calabresa e uma
    // de frango" tambem pode ser UMA pizza. Quem desempata e o modelo: se ele
    // devolveu dois itens, sao dois; se devolveu um com dois sabores, e um.
    //
    // Entao a juncao passa a valer so contra o que ja estava anotado ANTES
    // desta leitura. Corrigir continua corrigindo; falar de duas coisas na
    // mesma frase para de virar uma.
    const jaEstavam = itens.length;
    // O que a casa nao faz e foi tirado das observacoes deste turno.
    const restricoesTiradas: string[] = [];
    // O recheio que o produto nao tem, pra virar frase e nao comanda.
    const recheiosTrocados: string[] = [];
    // `abertos`, e nao `l.itens`: e a mesma lista com o item de N sabores ja
    // aberto em N linhas. Ver o comentario no comeco deste bloco.
    for (const i of abertos) {
      // O NOME, O APELIDO E O RECHEIO, RESOLVIDOS DE UMA VEZ.
      //
      // O modelo devolve "quiche de frango" como se fosse UM produto, e o
      // cardapio tem "quiche" com "frango" de recheio. Assim o item entrava com
      // o nome errado e a observacao vazia, e a cozinha nao sabia o recheio.
      //
      // Eu tinha tentado isso de dois jeitos que NUNCA dispararam: procurar o
      // recheio depois do nome (o nome ja continha o recheio, entao depois dele
      // nao vinha nada) e aproveitar o que sobrava do apelido ("chique de
      // frango" nao comeca com "quiche"). Os dois passaram no build, foram pro
      // ar e nao fizeram efeito nenhum, e a bateria deu resultado identico duas
      // vezes seguidas ate eu ir olhar o item gravado no banco.
      //
      // Agora a separacao e feita contra o CARDAPIO, que e quem sabe onde o
      // nome do produto termina.
      // UM NOME SO POR PRODUTO, decidido num lugar so (fluxo/produto.ts).
      //
      // Antes cada caminho escrevia do seu jeito: o modelo mandava "bolo 4
      // leites", o guardado mandava "4 leites", e os dois eram o mesmo bolo. A
      // comparacao falhava, o item entrava duas vezes e o cupom saiu com
      // "misto: bolo 4 leites e 4 leites". Medido na bateria dos cinco jeitos.
      //
      // A etapa entra como dica pra desempatar quem existe em dois lugares.
      // A CATEGORIA DO ITEM NAO E ESSA DICA. Medido em 30/08/2026: a dica da
      // etapa do salgado virava categoria do item, e pizza/brigadeiro saiam
      // como salgado_frito. A dica continua da etapa (e do que ele escreveu),
      // pra desempatar o NOME. A categoria do item sai do catalogo do produto
      // ja identificado.
      // SEM DICA DA ETAPA. Ate 03/09/2026 a etapa forcava a familia por regex
      // sobre a fala ("bolo" + /kg/ virava bolo_festa), e foi o coracao do
      // "10 kg de bolo": a etapa errada carimbava a familia errada. Quem
      // desempata agora e o nome que o modelo devolve COM o contexto da
      // conversa (o prefixo do bolo esta na regra do cardapio), e o catalogo.
      const quem = identificarProduto(String(i.produto), undefined, falaDoCliente);
      // ELE RESPONDEU QUAL, DENTRE AS QUE A PADARIA OFERECEU.
      //
      // O modelo devolve a familia crua ("pizza") quando o cliente responde
      // com a palavra que distingue e nao com o nome do produto. Medido ao
      // vivo em 30/08/2026: a padaria disse "inteira, meia ou redonda", o
      // cliente disse "quero 2 inteiras", e o modelo devolveu `pizza` com os
      // sabores no recado. O tipo nunca era escolhido e a conversa repetia a
      // pergunta ate morrer.
      //
      // A resposta e casada com as opcoes que a padaria ACABOU de oferecer,
      // que saem do catalogo. Preso ao contexto de proposito: cacar "inteira"
      // solta na frase transformaria "quero a torta inteira" numa pizza.
      const escolhida = ehNomeDeFamilia(quem.produto)
        ? opcaoDaFamiliaNaFrase(quem.produto, falaDoCliente)
        : null;
      // O SABOR QUE ELE NAO FALOU NAO ENTRA, NEM QUANDO VEM NO NOME DO PRODUTO.
      //
      // Medido na bancada em 30/08/2026, com a IA de verdade:
      //
      //   cliente >> o bolo eu quero misto de brigadeiro com ninho
      //   modelo  >> 1x brigadeiro com maracuja [brigadeiro com ninho]
      //   pedido  >> 3 kg de bolo brigadeiro com maracuja   R$ 140,70
      //
      // Ninho NAO e sabor de bolo de festa (a lista tem brigadeiro e brigadeiro
      // com maracuja). Em vez de dizer isso, o modelo trocou pelo mais parecido
      // do cardapio. A cozinha faria maracuja, e o cliente leria maracuja na
      // confirmacao de um bolo que ele pediu de ninho.
      //
      // A casa ja tem a regra certa pra sabor fora da lista: o item fica, o
      // sabor vai no recado, e na insistencia a equipe confere. Ela nao pegava
      // este caso porque so olhava o campo `sabor`, e aqui o modelo pos a
      // invencao no campo do PRODUTO.
      //
      // A regra e a mesma dos outros tres consertos de hoje: palavra que ele
      // nao falou nao entra. Se o nome que o modelo escolheu tem uma palavra
      // que nao esta na frase, e existe um produto MENOR que esta inteiro na
      // frase, vale o menor. O que sobrar vira recheio, que e o caminho do
      // recado e da equipe.
      // O MODELO MONTOU UM PRODUTO A PARTIR DE UMA PALAVRA DE SABOR?
      //
      // Fica marcado aqui e e lido logo abaixo do `semInvencao`. Ver o porque no
      // comentario grande la dentro.
      let inventouProduto = false;
      const semInvencao = (nome: string): string => {
        // O QUE JA ESTA NO PEDIDO TAMBEM E COISA QUE ELE FALOU.
        //
        // Ele disse "2 pizzas inteiras" num turno e no seguinte so "tira a de
        // calabresa". Olhando so a frase deste turno, "inteira" pareceria
        // invencao do modelo, e a guarda derrubava a linha pra "pizza": o pedido
        // ficava com uma pizza inteira E uma pizza solta, do mesmo sabor.
        //
        // E a mesma distincao de todos os outros consertos de hoje, na direcao
        // contraria: o que ja estava anotado nao precisa ser repetido pra valer.
        const ditas = new Set(
          palavrasQueApontam(
            falaDoCliente + " " + String(i.sabor ?? "") + " " + itens.map((x) => x.produto).join(" "),
          ),
        );
        // A PALAVRA DA FAMILIA NAO E INVENCAO: ELA VEM DA ETAPA.
        //
        // Quem responde "brigadeiro" na pergunta do bolo de festa esta pedindo
        // `bolo brigadeiro`, e o "bolo" veio da pergunta, nao da boca dele. Sem
        // esta excecao a guarda derrubava o bolo pro DOCINHO brigadeiro, que e
        // o defeito que ela deveria impedir, na direcao contraria. Pego pelo
        // `o-contexto-desempata-nome-duplicado.cjs` na primeira rodada.
        const daFamilia = new Set(chavesDeFamilia().map((f) => semAc(f)));
        // PLURAL E A MESMA PALAVRA.
        //
        // "quero 2 pizzas INTEIRAS" contra o produto "pizza INTEIRA": comparando
        // a palavra inteira, "inteiras" nao e "inteira", a guarda achava que o
        // codigo tinha inventado o tipo e derrubava a pizza inteira pra "pizza".
        // Dois testes pegaram isso na primeira rodada, e um deles era justamente
        // o das duas pizzas que custou o R$ 120,00 no lugar de R$ 240,00.
        //
        // A comparacao aceita uma ser comeco da outra, das duas direcoes, e so
        // em palavra de quatro letras pra cima: em palavra curta isso casaria
        // coisas diferentes.
        const eleFalou = (w: string) =>
          ditas.has(w) ||
          [...ditas].some((d) => d.length >= 4 && w.length >= 4 && (d.startsWith(w) || w.startsWith(d)));
        const doNome = palavrasQueApontam(nome);
        const inventadas = doNome.filter((w) => !eleFalou(w) && !daFamilia.has(w));
        if (!inventadas.length) return nome;
        // O maior pedaco do nome que ele REALMENTE falou. E resolvido pela MESMA
        // porta do resto (`identificarProduto`, com a dica da etapa), senao
        // "brigadeiro" na etapa do bolo cairia no docinho de R$ 1,25.
        const soDitas = doNome.filter((w) => eleFalou(w) || daFamilia.has(w)).join(" ");
        if (!soDitas.trim()) return nome;
        const menor = identificarProduto(soDitas, undefined, falaDoCliente);
        if (!menor?.produto || semAc(menor.produto) === semAc(nome)) return nome;
        // O QUE SOBRA TEM QUE SER PRODUTO DE VERDADE.
        //
        // Medido conversando com o servidor em 31/08/2026, e o log guardou
        // inteiro:
        //
        //   padaria >> Qual recheio do risólis você prefere, carne ou frango?
        //   cliente >> frango
        //   modelo  >> 1x mini sanduíche de patê de frango [frango]
        //   guarda  >> "ele nao falou sanduiche, pate; fiquei com mini frango"
        //   pedido  >> 1 ~ mini frango
        //
        // "mini frango" NAO EXISTE no cardapio. O modelo inventou um produto a
        // partir da palavra "frango", e esta guarda, que existe justamente pra
        // barrar invencao, arrancou as palavras nao ditas e produziu uma
        // invencao PIOR: um nome que nao existe em lugar nenhum.
        //
        // E custava dinheiro. O motor de preco casa nome por pedaco, e o mais
        // longo que termina em "frango" e "pizza inteira strogonoff de frango":
        // a linha fantasma seria cotada em R$ 120,00.
        //
        // Guarda que inventa e pior que o defeito que ela conserta, e esta e a
        // terceira vez que isso acontece neste arquivo. Se o nome reduzido nao
        // esta no cardapio, a guarda nao opina: devolve o que o modelo disse, e
        // quem decide se aquilo entra sao as guardas que perguntam se o CLIENTE
        // nomeou o produto.
        if (!produtoPorNome(menor.produto) && !produtoNoComeco(menor.produto)) {
          inventouProduto = true;
          rastro.push(
            "nao troquei \"" + nome + "\" por \"" + menor.produto +
            "\": esse nome nao existe no cardapio",
          );
          return nome;
        }
        rastro.push(
          "o modelo trocou o sabor: disse " + nome + " e ele nao falou " +
          inventadas.join(", ") + "; fiquei com " + menor.produto,
        );
        return menor.produto;
      };
      // BOLO POR QUILO NAO PASSA DE SEIS: ACIMA DISSO O NOME FOI LIDO ERRADO.
      //
      // Oito palavras do cardapio sao produto E sabor de outro produto ao mesmo
      // tempo. Levantadas em 30/08/2026, contra o catalogo inteiro:
      //
      //   brigadeiro, cafe, 4 leites, prestigio, porto alegre, bombom,
      //   morango, limao
      //
      // "morango" e um BOLO DE FESTA e tambem sabor de trufa e de torta doce.
      // Quando o cliente pede "50 de morango" escolhendo docinho, o codigo
      // resolvia pro bolo e o pedido ficava assim, medido:
      //
      //   "quero 50 de morango"   ->  50 kg de bolo morango    R$ 2.345,00
      //   "quero 50 de limao"     ->  50 bolos caseiros limao  R$ 1.545,00
      //   "quero 50 bombom"       ->  50 kg de bolo bombom
      //   "quero 50 prestigio"    ->  50 kg de bolo prestigio
      //
      // E o codigo ainda marcava `unico: true`, ou seja, se dava por certo: a
      // marca de ambiguidade so olha se o NOME bate com produtos de categorias
      // diferentes, e nao sabe que a palavra tambem e sabor.
      //
      // A regua sai do catalogo, nao de chute: "redondo de 300 g a 5,5 kg,
      // quadrado de 2,5 kg a 6 kg". Nao existe bolo de 50 kg nesta casa, entao
      // 50 nao e peso de bolo -- e a quantidade de outra coisa.
      //
      // O que entra no lugar e a FAMILIA com a palavra no recheio, que e a
      // forma que este arquivo ja usa pra "nao sei qual, pergunta": a padaria
      // pergunta em vez de anotar dois mil reais que ninguem pediu.
      const antesDaGuarda = semInvencao(escolhida ?? quem.produto);
      let produto = naoCabeNoBolo(antesDaGuarda, Number(i.qtd) || 0, falaDoCliente, String(i.produto), String(i.sabor ?? ""), rastro);

      // A PALAVRA QUE ELE DISSE NAO PODE SUMIR QUANDO A GUARDA VOLTA PRA FAMILIA.
      //
      // O comentario logo acima ja dizia a intencao: "o que entra no lugar e a
      // FAMILIA COM A PALAVRA NO RECHEIO". A familia entrava; a palavra, nao.
      //
      // Medido conversando com a producao em 02/09/2026:
      //
      //   cliente >> quero 50 de morango
      //   guarda  >> "esse numero e de outro produto"   (esta certa)
      //   pedido  >> 50 x bolo, sem sabor nenhum
      //   padaria >> "E o bolo, qual sabor?"            (ele acabou de dizer)
      //
      // A padaria perguntou justo o que ele tinha respondido, e perdeu a unica
      // informacao que ele deu. Guardando a palavra, a pergunta muda de "qual
      // sabor?" pra "voce quer bolo, docinho ou torta DE MORANGO?", que e a
      // duvida de verdade. Quem monta essa frase e `pergunta.ts`.
      //
      // Regra da casa, desde o primeiro dia: nada some do pedido.
      const virouFamilia = produto !== antesDaGuarda && ehNomeDeFamilia(produto);
      const oQueEleDisse = virouFamilia
        ? String(i.sabor ?? "").trim() || String(i.produto ?? "").trim()
        : "";

      // PRODUTO MONTADO EM CIMA DE UMA PALAVRA DE SABOR NAO E ITEM NOVO.
      //
      // Medido conversando com o servidor em 31/08/2026, com o log do container
      // na mao:
      //
      //   padaria >> Qual recheio do risólis você prefere, carne ou frango?
      //   cliente >> frango
      //   modelo  >> 1x mini sanduíche de patê de frango
      //
      // O cliente estava respondendo o recheio do risolis. O modelo pegou a
      // palavra "frango" e devolveu um produto que existe no cardapio e que
      // ninguem pediu, e o pedido ganhou uma linha a mais.
      //
      // Duas coisas tem que ser verdade ao mesmo tempo pra cair aqui: o nome tem
      // palavra que o cliente NUNCA falou (`inventouProduto`), e ele nao nomeou
      // esse produto nesta mensagem. Quem pede "mini sanduiche de pate de
      // frango" com todas as letras continua sendo atendido.
      //
      // Sem isto o "frango" tambem nao chegava no risolis: a resposta virava
      // item e a pergunta ficava de pe, repetida.
      // E A MENSAGEM E RESPOSTA DE SABOR, E NAO PEDIDO DE PRODUTO.
      //
      // Sem esta parte a guarda derrubou "quero 10 paes franceses pra amanha as
      // 9h, nome Ana, pix": o cliente escreveu no plural, a comparacao nao viu
      // "pao" dentro de "paes", e o pedido ficou vazio. Pego pelo
      // `toda-categoria-tem-etapa` na primeira rodada.
      //
      // O que separa um caso do outro nao e o nome, e a MENSAGEM: "frango" e
      // uma palavra so, e ela e opcao de sabor de um item que esta esperando
      // sabor. Isso e resposta, nao pedido novo.
      const ditasDaFala = palavrasQueApontam(falaDoCliente);
      const respostaDeSabor =
        ditasDaFala.length > 0 &&
        ditasDaFala.length <= 3 &&
        itens.some((x) => {
          const falta = saborQueFalta(x.produto, x.obs);
          return Boolean(falta?.opcoes?.some((o) => ditasDaFala.includes(semAc(o))));
        });
      if (inventouProduto && respostaDeSabor && !oClienteNomeouEsteProduto(falaDoCliente, produto)) {
        if (i.sabor) saboresDeItemDescartado.push(String(i.sabor));
        rastro.push(
          "o modelo montou \"" + produto + "\" em cima de uma palavra de sabor; " +
          "o cliente nao pediu esse produto, entao nao virou item",
        );
        continue;
      }
      const categoria = categoriaDaEtapa(etapa, produto);

      // A conta de "de que familia e este produto" mora em familiaDoProduto,
      // e so la. Ela estava escrita aqui em linha e faltava no
      // oClienteNomeouEsteProduto, que por isso descartava a resposta do
      // cliente sobre o tipo da pizza.
      const famDoItem = familiaDoProduto(produto);
      // So a pizza: os tres nomes sao TIPO, nao sabor. Bolo e salgado na lista
      // da familia sao o que ele escolhe, e pular eles some o pedido.
      const jaTemGenericoDestaFamilia =
        famDoItem === "pizza" &&
        itens.some((x) => ehNomeDeFamilia(x.produto) && nomeDaFamilia(x.produto) === "pizza");
      const jaTemTipoDePizza =
        famDoItem === "pizza" &&
        itens.some((x) => opcoesDaFamilia("pizza").some((o) => semAc(o) === semAc(x.produto)));
      const eTipoDePizza = opcoesDaFamilia("pizza").some((o) => semAc(o) === semAc(produto));
      // QUEM PEDIU DUAS PIZZAS LEVA DUAS PIZZAS.
      //
      // Esta guarda existe pra impedir o modelo de inventar uma segunda pizza em
      // cima de um sabor ("pizza de calabresa" virando pizza + calabresa), e o
      // defeito que ela conserta ja custou R$ 240 num pedido de festa.
      //
      // So que ela cortava tambem o pedido de verdade, medido conversando com a
      // producao em 02/09/2026:
      //
      //   cliente >> quero duas pizzas, uma de calabresa e uma de frango
      //   modelo  >> 1x pizza inteira [calabresa] ;; 1x pizza inteira [frango]
      //   pedido  >> 1 pizza inteira (calabresa)
      //
      // R$ 120,00 que a padaria deixa de cobrar, e o cliente descobre quando
      // chega pra buscar duas e leva uma.
      //
      // O que separa os dois casos e o NUMERO que ele escreveu: "duas pizzas" e
      // pedido, "pizza de calabresa" e uma pizza so.
      const pediuMaisDeUmaPizza = (() => {
        const t = semAc(String(falaDoCliente ?? ""));
        if (!/pizza/.test(t)) return false;
        let comNumero = t;
        for (const [palavra, valor] of numerosEscritos({ umEUma: false })) {
          comNumero = comNumero.replace(
            new RegExp("(^|[^a-z0-9])" + palavra + "([^a-z0-9]|$)", "gi"),
            "$1" + valor + "$2",
          );
        }
        const m = comNumero.match(/([0-9]+)\s+pizza/);
        return Boolean(m && Number(m[1]) > 1);
      })();
      if (
        (jaTemGenericoDestaFamilia || jaTemTipoDePizza) &&
        eTipoDePizza &&
        !pediuMaisDeUmaPizza &&
        !oClienteNomeouEsteProduto(falaDoCliente, produto)
      ) {
        continue;
      }
      if (eTipoDePizza && oClienteNomeouEsteProduto(falaDoCliente, produto)) {
        const soAFamilia = itens.filter(
          (x) => ehNomeDeFamilia(x.produto) && nomeDaFamilia(x.produto) === "pizza",
        );
        if (soAFamilia.length) {
          for (const g of soAFamilia) {
            const gi = itens.indexOf(g);
            if (gi >= 0) itens.splice(gi, 1);
          }
        }
      }

      let obsItem = i.obs ?? null;
      // A palavra guardada acima entra na observacao, que e onde a pergunta vai
      // procurar por ela. So quando ela ja nao esta escrita ali.
      if (oQueEleDisse && !semAc(String(obsItem ?? "")).includes(semAc(oQueEleDisse))) {
        obsItem = [oQueEleDisse, obsItem].filter(Boolean).join(" | ");
      }

      // O RECHEIO QUE ESTE PRODUTO NÃO TEM NÃO VAI PRA COZINHA.
      //
      // Sete produtos da casa têm recheio FIXO: a coxinha é de frango, a
      // bolinha é de queijo, o croquete é de carne com catupiry. Neles o
      // catálogo manda a IA NÃO perguntar recheio, e por isso ninguém conferia
      // o que o cliente escrevia junto:
      //
      //     "100 coxinha de camarão"  ->  comanda: 100 coxinha ~ camarao
      //
      // Medido em 27/08/2026. Produto certo, preço certo, e a COMANDA
      // PROMETENDO o que a cozinha não faz. Quem tem lista de sabor (esfirra,
      // quiche, empadão) já estava protegido: o sabor de fora não casa com a
      // lista e a padaria pergunta. Só os de recheio fixo passavam calado.
      //
      // É o mesmo desenho da restrição de dieta: tira da observação e DIZ, em
      // vez de tirar calado. Tirar calado seria melhor que prometer e pior que
      // avisar, e quem pede coxinha de camarão merece ouvir antes de retirar.
      // O SABOR CHEGA POR DUAS PORTAS, E A PRIMEIRA VERSÃO DAQUI SÓ OLHAVA UMA.
      //
      // Eu cobri o nome ("coxinha DE CAMARÃO") e deixei a porta principal
      // aberta. Medido contra a IA de verdade: ela devolve o produto limpo e o
      // sabor na OBSERVAÇÃO.
      //
      //     {"produto":"coxinha","qtd":100,"obs":"camarão"}   ->   comanda:
      //     coxinha ~ camarão
      //
      // O teste que eu tinha escrito passava sem o conserto, porque ele mandava
      // o sabor pelo nome, que é o caminho que o modelo NÃO usa.
      // O SABOR TEM CAMPO PRÓPRIO, E POR ISSO NÃO PRECISA DE LISTA MINHA.
      //
      // A primeira versão olhava a observação inteira e eu tinha escrito uma
      // lista de palavras pra não confundir recado com recheio ("sem", "bem",
      // "pouco", "capricha"). O dono cortou, com a mesma régua de sempre: nada
      // pode ser lista minha, só o cardápio e os preços são fixos.
      //
      // Ele está certo, e a solução é dar à IA um lugar pra dizer o que ela já
      // entendeu. Medido contra ela, ela separa sozinha:
      //
      //   "coxinha de camarao"              sabor=camarão  obs=""
      //   "coxinha sem cebola"              sabor=""       obs="sem cebola"
      //   "esfirra de carne com pouco sal"  sabor=carne    obs="com pouco sal"
      //   "capricha no recheio"             sabor=""       obs="capricha..."
      //
      // O código confere SÓ o sabor, contra o catálogo, que é lista legítima. O
      // recado passa intocado, e nenhuma palavra minha decide o que é o quê.
      // SABOR QUE O MODELO INVENTOU NAO ENTRA.
      //
      // Medido em 30/08/2026: o cliente disse "redonda", o modelo devolveu
      // pizza redonda E pizza inteira/meia de bacon. Os tipos que ele nao
      // nomeou ja saem. O bacon ainda grudava na redonda porque veio no
      // campo sabor, e a frase nao tinha bacon nenhum.
      //
      // Recheio que veio no NOME ("esfirra de carne") continua: e o catalogo
      // quem separa. Sabor so no campo do modelo vale quando a frase cita.
      // O SABOR QUE VAI PRA COMANDA SAI DO CATALOGO, E NAO DA FRASE DO CLIENTE.
      //
      // Medido no pedido de festa de 30/08/2026, e foi impresso assim:
      //
      //   padaria >> Qual sabor voce quer para o mini bolha?
      //   cliente >> quero carne
      //   comanda >> 50 un mini bolha (frito)
      //              > frito | quero carne
      //
      // O modelo devolveu `sabor: "quero carne"`, a frase inteira, e a guarda
      // de cima passou: ela exige que a FRASE cite o sabor, e a frase cita ela
      // mesma. Quem produz recebeu "quero carne" no lugar de "carne".
      //
      // "carne" esta no cardapio como recheio do mini bolha. Entao o sabor e
      // reduzido ao termo do catalogo que a frase contem. O que NAO bate com o
      // catalogo continua passando inteiro de proposito: sabor fora da lista e
      // caso de equipe, e a dona disse que a lista cresce ("se o cliente pedir
      // outro sabor, a gente vai colocando").
      const soODoCatalogo = (nomeDoProduto: string, dito: string): string => {
        const p = produtoPorNome(nomeDoProduto) ?? produtoNoComeco(nomeDoProduto);
        const opcoes = p?.sabores ?? [];
        if (!opcoes.length) return dito;
        const t = semAc(dito);
        if (opcoes.some((o) => semAc(o) === t)) return dito;
        const achado = [...opcoes]
          .sort((a, b) => b.length - a.length)
          .find((o) => {
            const alvo = semAc(o);
            return alvo.length > 2 && t.includes(alvo) && afirmouOuNegou(t, cercaDoSabor(alvo)) !== false;
          });
        if (achado) rastro.push("o modelo mandou o sabor como \"" + dito + "\"; no cardapio isso e \"" + achado + "\"");
        return achado ?? dito;
      };
      const saborDoModelo = i.sabor ? soODoCatalogo(produto, String(i.sabor)) : null;
      const saborCitado =
        saborDoModelo &&
        semAc(falaDoCliente).includes(semAc(saborDoModelo)) &&
        afirmouOuNegou(semAc(falaDoCliente), cercaDoSabor(semAc(saborDoModelo))) !== false;
      const saborPedido = quem.recheio ?? (saborCitado ? saborDoModelo : null);
      const outroRecheio = recheioQueNaoExiste(produto, saborPedido);
      if (outroRecheio) {
        // A CORRECAO SO SAI SOBRE O PRODUTO DE QUE SE ESTAVA FALANDO.
        //
        // Do pedido de festa de 30/08/2026, e o cliente nao entendeu nada:
        //
        //   padaria >> Qual sabor você quer para o mini bolha?
        //   cliente >> quero carne
        //   padaria >> A gente faz coxinha de frango. Quais docinhos você quer?
        //
        // Ele estava respondendo sobre o MINI BOLHA. A coxinha estava no pedido
        // desde antes, o "carne" da frase alcancou ela tambem, e como coxinha e
        // de frango no cardapio a padaria "corrigiu" um pedido que ninguem
        // tinha feito. Palavra dele: "falou um negocio da coxinha nada ver nem
        // entendi".
        //
        // Corrigir o cliente sobre algo que ele nao pediu e pior do que ficar
        // calado: ele para pra entender uma frase que nao era pra ele.
        //
        // Vale quando ELE nomeou o produto agora ("50 coxinha de calabresa") ou
        // quando a PADARIA acabou de perguntar sobre ele, que e o caso de quem
        // responde so o sabor.
        // O SABOR RECUSADO VOLTA A FICAR SOLTO.
        //
        // Medido conversando com o servidor em 31/08/2026:
        //
        //   padaria >> O mini bolha é de quê? Tem carne, queijo, presunto e frango.
        //   cliente >> quero carne
        //   modelo  >> 50x coxinha [carne]
        //   comanda >> 50 un mini bolha  > frito | quero carne
        //
        // O modelo grudou o "carne" na COXINHA, que e de frango e nem tem carne
        // na lista. O recheio foi recusado, certo. So que `donoNaFrase` continuou
        // marcando "carne" como palavra ocupada, entao ela nao podia mais grudar
        // no mini bolha, que era quem tinha sido perguntado: sobrou o caminho da
        // frase crua, e "quero carne" foi impresso na comanda da cozinha.
        //
        // Recheio que o produto nao aceita nao e dono de nada.
        if (saborPedido) saboresDeItemDescartado.push(String(saborPedido));
        // E ELE TEM QUE TER LIGADO ESSE SABOR A ESSE PRODUTO.
        //
        // Medido conversando com o servidor em 31/08/2026:
        //
        //   cliente >> entao me ve 50 coxinha e 50 risoles de carne
        //   modelo  >> 50x coxinha [carne]
        //   padaria >> A gente faz coxinha de frango.
        //
        // O "carne" era do RISOLES, e o modelo grudou na coxinha. O pedido saiu
        // certo (coxinha de frango, risolis de carne), mas o cliente ouviu uma
        // correcao sobre um pedido que ele nao fez, e isso e o que ele chamou de
        // "falou um negocio nada a ver".
        //
        // Nomear o produto na frase nao basta: ele nomeou a coxinha E o risoles.
        // O que separa e a PROXIMIDADE: "coxinha de carne" ele nao escreveu.
        // A janela vai do nome do produto ate o proximo produto citado, que e
        // como uma pessoa le uma lista de pedido.
        const ligouOSaborAEsteProduto = (() => {
          const t = semAc(falaDoCliente);
          const alvo = semAc(produto);
          const sabor = semAc(String(saborPedido ?? ""));
          if (!alvo || !sabor) return false;
          const inicio = t.indexOf(alvo);
          if (inicio < 0) return false;
          // A JANELA E DE PALAVRAS, e nao "ate o proximo produto".
          //
          // Procurar o proximo produto falhava pela grafia: o cliente escreve
          // "risoles" e o cardapio tem "risólis", entao o corte nunca acontecia
          // e a frase inteira virava janela.
          //
          // Quatro palavras cobrem como gente escreve o par ("coxinha de carne",
          // "coxinha, carne", "coxinha de frango com catupiry") e nao alcancam o
          // proximo item da lista ("coxinha e 50 risoles de carne").
          let depois = t.slice(inicio + alvo.length).trim().split(/\s+/).slice(0, 4).join(" ");
          // E A JANELA PARA NO PRODUTO VIZINHO.
          //
          // Medido conversando com a producao em 02/09/2026:
          //
          //   cliente >> coxinha e risoles de carne
          //   padaria >> A gente faz coxinha de frango.
          //
          // Ele nao pediu coxinha de carne: o "de carne" e do risoles, que esta
          // no meio do caminho. O modelo grudou o sabor nos dois, o codigo
          // corrigiu certo (coxinha e de frango) e AVISOU como se ele tivesse
          // pedido errado. Corrigir calado e o certo aqui.
          //
          // A busca do vizinho e por PRODUTO DA FRASE, e nao pelo nome do
          // cardapio: o cliente escreve "risoles" e a casa escreve "risólis", e
          // foi por isso que a versao anterior desistiu de cortar.
          // O corte usa a POSICAO de cada produto na frase, e nao o nome do
          // cardapio: "risoles" e "risólis" nunca casariam por texto.
          const fimDaJanela = inicio + alvo.length;
          for (const { onde } of ondeCadaProdutoAparece(falaDoCliente)) {
            if (onde <= inicio) continue;
            const quantoCabe = onde - fimDaJanela;
            if (quantoCabe >= 0 && quantoCabe < depois.length) {
              depois = depois.slice(0, quantoCabe).trim();
            }
          }
          const primeiraDoSabor = sabor.split(/\s+/)[0] ?? sabor;
          return depois.includes(primeiraDoSabor);
        })();
        // Quem responde "de carne" a pergunta da coxinha esta falando da
        // coxinha, e a padaria corrige ("a gente faz coxinha de frango"). A
        // leitura da ultima fala aqui so decide se AVISA; nunca muda o pedido.
        const eleNomeou =
          oClienteNomeouEsteProduto(falaDoCliente, produto) && ligouOSaborAEsteProduto;
        const aPerguntaEraDele =
          semAc(produto).length >= 4 && semAc(String(e.ultimaFala || "")).includes(semAc(produto));
        if (!eleNomeou && !aPerguntaEraDele) {
          rastro.push(
            "nao avisei que " + produto + " e de " + outroRecheio +
            ": ele nao falou desse produto nesta mensagem e a pergunta nao era dele",
          );
        } else {
          recheiosTrocados.push(produto + " de " + outroRecheio);
        }
        // Recheio fixo: o que ele pediu nao vai pra comanda. Tira do obs se
        // o leitor da frase tinha deixado o resto do "de X" como recado.
        if (saborPedido && String(obsItem ?? "").toLowerCase().includes(saborPedido.toLowerCase())) {
          obsItem = String(obsItem)
            .split(" | ")
            .filter((p) => semAc(p) !== semAc(saborPedido))
            .join(" | ") || null;
        }
      } else if (saborPedido && !String(obsItem ?? "").toLowerCase().includes(saborPedido.toLowerCase())) {
        // O SABOR VEM NA FRENTE DO RECADO, e não atrás.
        //
        // Estava escrito ao contrário, e a comanda saía assim:
        //
        //     esfirra ~ com pouco sal | carne
        //
        // Quem produz lê o recheio primeiro, porque é ele que decide o que a
        // pessoa vai montar. O recado vem depois, como recado.
        //
        //     esfirra ~ carne | com pouco sal
        //
        // Os dois inteiros: "frango bem passada" continua chegando junto.
        obsItem = [saborPedido, obsItem].filter(Boolean).join(" | ");
      }

      // A RESTRIÇÃO QUE É SABOR DO CARDÁPIO RESOLVE A FAMÍLIA SOZINHA.
      //
      // Medido conversando com a produção em 31/08/2026, logo depois de ela
      // aprender a responder que a casa faz:
      //
      //   padaria >> Fazemos sim: temos bolo 0% lactose, R$ 55,90 o quilo.
      //   cliente >> quero um sem lactose de 1 kg entao
      //   pedido  >> 1 bolo (sem lactose | 1 kg)      e ela perguntou o sabor
      //
      // "sem lactose" NÃO é observação: é o nome de um bolo de festa da casa.
      // Enquanto o produto ficava sendo a família, a padaria perguntava o sabor
      // que ele acabou de escolher, e o peso ficava preso na observação, porque
      // marcador de família não recebe peso.
      //
      // O nome sai do catálogo, pela mesma função que responde a pergunta dele.
      // Só vale pra família em aberto: quem já escolheu "brigadeiro sem lactose"
      // continua no caminho da mistura, que faz "bolo brigadeiro com 0% lactose".
      if (ehNomeDeFamilia(produto)) {
        const daRestricao = produtoDaRestricaoNaFrase(
          falaDoCliente + " " + String(i.obs ?? "") + " " + String(i.sabor ?? ""),
        );
        if (daRestricao && categoriasDaFamilia(produto).includes(String(categoria || ""))) {
          rastro.push("\"" + produto + "\" com restricao que a casa faz: e " + daRestricao);
          produto = daRestricao;
          // O NOME JA DIZ, ENTAO A OBSERVACAO NAO REPETE.
          //
          // Sem isto o cupom sai "bolo 0% lactose (sem lactose)". Nao da pra
          // usar `obsSemRestricao` aqui: ela guarda a restricao quando o produto
          // JA E assim, que e o certo em todo lugar menos neste, onde a
          // restricao acabou de virar o nome. Entao o pedaco sai pelo mesmo
          // detector que escolheu o nome.
          obsItem = (obsItem ?? "")
            .split(/[,|]/)
            .map((p) => p.trim())
            .filter(Boolean)
            .filter((p) => produtoDaRestricaoNaFrase(p) !== daRestricao)
            .join(" | ") || null;
        }
      }

      // A PROMESSA QUE A CASA NÃO CUMPRE SAI DA OBSERVAÇÃO.
      //
      // Medição de 20/08/2026: o pedido fechou com "30 brigadeiro (sem lactose,
      // forminha rosa)". A cliente PERGUNTOU se tem sem lactose, a padaria
      // respondeu certo que não tem, e a restrição foi parar na observação.
      //
      // A observação vai pra comanda E pro resumo do cliente. A cozinha produz
      // brigadeiro normal e entrega pra quem leu "sem lactose" na confirmação:
      // se essa pessoa tem intolerância, deixa de ser prejuízo e vira problema
      // de saúde.
      //
      // O ITEM FICA. Só a promessa sai, e o cliente é avisado logo abaixo.
      // O PRODUTO ENTRA NA CONTA. A casa faz UM bolo "0% lactose", e isso nao
      // quer dizer que ela tenha linha sem lactose: o brigadeiro continua sendo
      // brigadeiro normal. Sem passar o produto, a checagem viraria "a casa
      // trabalha com lactose zero" e o defeito voltaria inteiro.
      // A RESTRICAO QUE VIRA MISTURA NAO E TIRADA AQUI.
      //
      // Ela fica na observacao ate os bolos serem fundidos, la embaixo, e so
      // depois vira nome de produto. Renomear aqui, dentro do laco, criava um
      // bolo com nome novo ao lado do bolo que o leitor da frase tinha criado
      // com o nome velho, e a fusao juntava os dois escrevendo na comanda
      // "misto: bolo brigadeiro com 0% lactose e bolo brigadeiro". Medido.
      const tiradas = restricoesQueACasaNaoFaz(obsItem, produto)
        .filter((r) => !misturaQueACasaFaz(produto, r));
      if (tiradas.length) {
        obsItem = obsSemRestricao(obsItem, produto);
        restricoesTiradas.push(...tiradas);
      }
      obsItem = obsPraComanda(obsItem, produto);

      // O PESO DO BOLO E QUANTIDADE, NAO OBSERVACAO.
      //
      // "um bolo de 2 kg de 4 leites": o modelo manda qtd 1 e escreve "2 kg" na
      // observacao. O bolo sai cobrado como UMA unidade, R$ 46,90 em vez de
      // R$ 93,80. Bolo e vendido por quilo, entao o numero de quilos que ele
      // falou E a quantidade.
      let qtd = Number(i.qtd) || 0;
      // O PESO VALE PRA TODO PRODUTO VENDIDO POR QUILO, e nao so pro bolo.
      //
      // Sao 31 no cardapio: cuca, cuca recheada, pao frances, pao de X,
      // cachorro-quente, empadao, torta fria, torta doce, torta especial, bolo
      // salgado, calzone e pizza redonda, alem dos quinze bolos de festa.
      //
      // Medido em 31/08/2026: "quero um empadao de frango" fechava com 1 kg
      // calado, R$ 34,90, e quem queria dois pagava metade. Mesmo defeito que o
      // cliente pegou no bolo, nas outras onze familias.
      const vendidoPorQuilo =
        unidadeDoPedido(String(produto), String(categoria || "")) === "kg";
      if (vendidoPorQuilo) {
        const dito = falaDoCliente + " " + String(i.obs ?? "");
        // GRAMA E "E MEIO" TAMBEM SAO PESO, E OS DOIS CUSTAVAM DINHEIRO.
        //
        // Medido em 31/08/2026, com o cardapio da casa na mao (redondo comeca em
        // 300 g, e os degraus dela sao 300, 500, 700, 1 kg, 1,5 kg, 1,7 kg, 2 kg,
        // 2,5 kg):
        //
        //   "quero de 2 quilos e meio"  ->  2 kg     perde R$ 24,95
        //   "pode ser 500g"             ->  0 kg     a padaria perguntava de novo
        //
        // O leitor so entendia quilo inteiro, e metade dos tamanhos que a dona
        // faz nao e quilo inteiro.
        // Quem le o peso e `pesoNaFala`, aqui e no bloco de fora do laco. Duas
        // copias desta conta e o defeito que mais se repetiu neste sistema:
        // duas mãos guardando a mesma verdade, e uma fica pra tras.
        // SO O PEDACO QUE FALA DESTE PRODUTO, quando ha mais de um por quilo na
        // mesma frase: senao o peso de um vaza pro outro.
        const doProduto = (l.itens ?? []).filter(
          (x) => unidadeDoPedido(String(x.produto), "") === "kg",
        ).length > 1;
        let peso = pesoNaFala(
          doProduto ? oPedacoDesteProduto(dito, produto) + " " + String(i.obs ?? "") : dito,
          false,
        );

        // DEPOIS DA PERGUNTA DO PESO, NUMERO SOLTO E PESO.
        //
        // Medido em 31/08/2026, e era um beco sem saida:
        //
        //   padaria >> O pao frances é vendido por quilo. Quantos quilos você quer?
        //   cliente >> 2
        //   padaria >> O pao frances é vendido por quilo. Quantos quilos você quer?
        //
        // Ninguem repete a unidade na resposta: a padaria pergunta em quilo e a
        // pessoa responde "2". Sem isto a conversa nunca saia do lugar, o que e
        // pior do que o defeito que a pergunta veio consertar.
        //
        // E a mesma regra do "Sim" digitado: quem da sentido a resposta e a
        // pergunta que acabou de sair, e nao a forma da frase.
        //
        // SEM LER A ULTIMA FALA POR REGEX (03/09/2026). Quem sabe que o "2" e
        // peso e o modelo, que agora ve a pergunta na conversa e devolve o item
        // por quilo com qtd 2. O codigo so confere que o numero esta mesmo na
        // frase (nunca inventado) e que a frase nao e data.
        if (!peso && perguntaDePeso(e) && frasePodeSerPeso(falaDoCliente, Boolean(l.dados))) {
          peso = pesoNaFala(String(falaDoCliente || ""), true);
          if (peso) rastro.push("a padaria tinha perguntado o peso; li \"" + falaDoCliente + "\" como quilos");
        }

        if (peso > 0 && peso <= 30) {
          qtd = peso;
          // O PESO VIROU QUANTIDADE, ENTAO NAO E MAIS RECADO PRA COZINHA.
          //
          // Medido em 31/08/2026: "quero um sem lactose de 1 kg" fechava com a
          // linha "1 bolo 0% lactose (1 kg)". O quilo ja esta na quantidade, e
          // repetido na observacao ele vira instrucao de producao: a cozinha le
          // "1 kg" num bolo que ja diz 1 kg, e no dia em que os dois numeros
          // discordarem alguem vai seguir o errado.
          //
          // A conta do pedido nao e recado pra cozinha: e a mesma regra que tira
          // o "metade" da comanda.
          obsItem = (obsItem ?? "")
            .split(/[,|]/)
            .map((p) => p.trim())
            .filter(Boolean)
            .filter((p) => !/^[0-9]+(?:[.,][0-9]+)?\s*(kg|quilos?|gramas?|g)(\s*e\s*meio)?$/i.test(p))
            .join(" | ") || null;
        }
        // SEM PESO DITO, O BOLO DE FESTA NAO TEM QUANTIDADE: A PADARIA PERGUNTA.
        //
        // Cliente real em 31/08/2026, e ele teve que corrigir a padaria:
        //
        //   cliente >> gostaria de encomendar um bolo, quanto ficaria?
        //   cliente >> Laka e biz
        //   resumo  >> 1 kg de bolo biz   R$ 49,90
        //   cliente >> o bolo é 2kg, não 1kg
        //
        // O modelo devolve qtd 1 quando ninguem falou de peso, porque "um bolo"
        // e um bolo. So que bolo de festa e vendido POR QUILO, e ai o 1 vira um
        // preco: METADE do dinheiro, em todo pedido de bolo em que o cliente nao
        // pensa em dizer o peso, que e a maioria. Ninguem diz "quero 2 kg de
        // bolo", diz "quero um bolo".
        //
        // Zero aqui quer dizer "nao sei", e a etapa do bolo pergunta. Nao e o
        // mesmo que "quantos bolos": e quantos QUILOS.
        //
        // NA FESTA NAO SE PERGUNTA: o peso saiu da proposta que ele aceitou
        // ("2 kg de bolo pra 20 pessoas"), e perguntar de novo seria a padaria
        // esquecendo o que combinou duas mensagens atras.
        // SO ZERA BOLO QUE JA TEM SABOR.
        //
        // Enquanto o produto e a familia ("bolo", esperando o cliente escolher),
        // o numero que ele falou e DELE e nao pode sumir: "quero 50 de morango"
        // guarda o 50 pra padaria perguntar qual bolo com a quantidade na mao.
        // Zerar ali quebrou dois testes que ja existiam, e os dois protegiam a
        // mesma regra: nada some do pedido.
        // O PAO ZERA TAMBEM, POR DECISAO DELE EM 31/08/2026.
        //
        // Eu tinha aberto excecao pra padaria, porque a dona diz que o cliente
        // pede por unidade ("as vezes a pessoa encomendou 50 pao frances") e a
        // casa cobra por peso ("o pao frances e R$ 11,99 o quilo"). Ele decidiu
        // o contrario, e a regra dele e mais simples: "se a categoria eh KG nao
        // UNID tu fala pra ele, q eh em kg, ai tem escolher em kg nao em
        // quantidade".
        //
        // Zerar aqui nao apaga o pedido: a padaria pergunta o peso na mesma
        // mensagem, e o cliente escolhe na unidade em que a casa cobra. E o que
        // impede "50 pao frances" de virar 50 kg, R$ 599,50.
        const pesoDaFesta = Number(e.base?.boloKg) || 0;
        const daFesta = categoria === "bolo_festa" && e.ehFesta && pesoDaFesta > 0;
        if (!peso && !ehNomeDeFamilia(produto) && !daFesta) {
          if (qtd > 0) {
            rastro.push(
              "ninguem falou o peso do " + produto + "; nao chuto 1 kg, a padaria pergunta",
            );
          }
          qtd = 0;
        }
      }

      const linha = {
        produto,
        categoria,
        qtd,
        obs: obsItem,
      };

      // A busca pelo item que ja existe usa o nome NORMALIZADO, senao "chique"
      // e "quiche" viram duas linhas do mesmo produto no pedido.
      const achou = itens.findIndex((x, n) => {
        if (x.produto.toLowerCase().trim() !== produto.toLowerCase().trim()) return false;
        // O QUE JA ESTAVA ANOTADO: junta pelo nome, como sempre. E correcao.
        if (n < jaEstavam) return true;
        // NESTA MESMA LEITURA: so junta se for o MESMO sabor.
        //
        // A primeira versao disto nao juntava nada dentro do turno, e quebrou
        // quatro testes da festa de uma vez: o modelo devolve o mesmo produto
        // duas vezes quando reparte a base, e o risolis virou duas linhas de 66.
        //
        // Duplicata de verdade continua juntando. O que passa a nao juntar e
        // sabor DIFERENTE, que e o caso das duas pizzas.
        const laSabor = semAc(String(x.obs ?? ""));
        // O SABOR QUE VALE AQUI E O QUE O MODELO MANDOU, e nao o que sobrou
        // depois das guardas.
        //
        // Medido conversando com a producao em 02/09/2026:
        //
        //   cliente >> quero duas pizzas, uma de calabresa e uma de frango
        //   modelo  >> 1x pizza inteira [calabresa] ;; 1x pizza inteira [frango]
        //   pedido  >> 1 pizza inteira (calabresa)
        //
        // O sabor do SEGUNDO item era consumido por outra regra antes de chegar
        // aqui; sem sabor, ele virava duplicata e sumia dentro do primeiro. Uma
        // pizza a menos e R$ 120,00 que a padaria deixa de cobrar, e o cliente
        // so descobre quando chega pra buscar.
        const aqui = semAc(String(saborPedido || i.sabor || ""));
        if (!aqui) return true;
        return laSabor.includes(aqui);
      });
      // Repetir o mesmo item SUBSTITUI a quantidade, nao soma: "na verdade
      // quero 200" e correcao, nao pedido de mais 200. Somar ja dobrou pedido
      // de festa.
      //
      // MAS A OBSERVACAO NAO SE SUBSTITUI, ELA SE JUNTA.
      //
      // `{...itens[achou], ...linha}` escrevia por cima de TUDO, e a observacao
      // da linha nova vem so da leitura DESTE turno. Entao:
      //
      //     cliente >> 50 brigadeiro forminha rosa
      //     cliente >> muda pra 100 brigadeiro
      //     no pedido >> 100 brigadeiro, obs VAZIA
      //
      // O "forminha rosa" so nao sumia por sorte: o carimbo da cor roda logo
      // abaixo e reescreve a cor nos docinhos. Num salgado com "sem cebola" ou
      // num bolo com "misto: dois sabores", sumia de vez.
      //
      // E isto ficou MAIS provavel em 27/08/2026, quando a instrucao passou a
      // pedir que o modelo reporte correcao de quantidade: agora ele repete o
      // item com mais frequencia, e cada repeticao apagava o que estava anotado.
      //
      // Regra do dono, desde o primeiro dia: nada some do pedido.
      if (achou >= 0) {
        const antes = String(itens[achou].obs ?? "");
        const agora = String(linha.obs ?? "");
        // Junta sem repetir: cada pedaco da observacao e separado por " | ", e
        // o que ja estava escrito nao entra duas vezes.
        const pedacos = [...antes.split(" | "), ...agora.split(" | ")]
          .map((x) => x.trim())
          .filter(Boolean);
        const semRepetir = pedacos.filter((x, n) => pedacos.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === n);
        itens[achou] = { ...itens[achou], ...linha, obs: obsPraComanda(semRepetir.join(" | "), itens[achou].produto) };
      } else itens.push(linha);
    }
    novo.itens = itens;
    // Sem repetir: se ele pediu "sem lactose" em três docinhos, a padaria diz
    // uma vez. Repetir a mesma frase três vezes soa como robô travado.
    if (restricoesTiradas.length) novo.restricoesTiradas = [...new Set(restricoesTiradas)];
    if (recheiosTrocados.length) novo.recheiosTrocados = [...new Set(recheiosTrocados)];
  }

  // ------------------------------------------------------ o que ele mandou tirar
  //
  // DEPOIS do bloco dos itens, de proposito: a frase pode fazer as duas coisas
  // ("tira a de calabresa e poe 100 coxinhas"), e o pedido tem que refletir as
  // duas. Removendo antes, o indice da linha mudaria debaixo da juncao.
  const tirouALinha = (n: number, porque: string) => {
    const fora = novo.itens[n];
    rastro.push(porque + ": " + fora.produto + (fora.obs ? " [" + fora.obs + "]" : ""));
    novo.itens = novo.itens.filter((_, i) => i !== n);
  };

  if (e.tirandoQual) {
    // ELE ESTA RESPONDENDO QUAL TIRAR.
    //
    // A resposta pode chegar de dois jeitos, e as duas contam: o modelo pode
    // devolver `tirar` de novo, mas "a de calabresa" sozinha nao parece pedido
    // de remocao pra ele, parece escolha. Entao a frase CRUA tambem vale, e e
    // ela que resolve na maioria das vezes.
    //
    // A FRASE ACUMULA em vez de ser trocada, e e isso que faz a padaria ir
    // AFUNILANDO igual gente. Com uma pizza de forma, uma meia e uma redonda no
    // pedido, "tira a pizza" aponta as tres; ele responde "a redonda" e a frase
    // guardada vira "a pizza a redonda", que pontua a redonda duas vezes e as
    // outras uma. Sai a certa, e sem regra nova pra isso.
    const antes = linhasQueOClientePodeEstarTirando(novo.itens, e.tirandoQual).length;
    const somado = [e.tirandoQual, ...(l.tirar ?? []).map(String), falaDoCliente].join(" ");
    const quais = linhasQueOClientePodeEstarTirando(novo.itens, somado);

    if (quais.length === 1) {
      tirouALinha(quais[0], "ele respondeu qual tirar, e saiu");
      novo.tirandoQual = null;
    } else if (quais.length > 1 && quais.length < antes) {
      // AFUNILOU, entao pergunta de novo. Isto NAO e o laco que ja matou
      // conversa aqui: laco e perguntar de novo sem ter andado. Enquanto a
      // resposta dele diminui a lista, perguntar e o que gente faz.
      novo.tirandoQual = somado;
      rastro.push("ele respondeu e sobraram " + quais.length + " de " + antes + "; pergunto de novo");
    } else {
      // Nao andou: ou ele nao disse nada que diferencie, ou mudou de assunto.
      // Para de perguntar. A conversa segue, e o resumo do fim mostra o pedido
      // inteiro pra ele conferir.
      novo.tirandoQual = null;
      rastro.push("perguntei qual tirar e a resposta nao afunilou; parei de perguntar");
    }
  } else if (l.tirar?.length) {
    for (const frase of l.tirar) {
      const quais = linhasQueOClientePodeEstarTirando(novo.itens, String(frase));
      if (quais.length === 1) {
        tirouALinha(quais[0], "tirou do pedido");
        continue;
      }
      if (quais.length > 1) {
        // AMBIGUIDADE VIRA PERGUNTA, e nao silencio nem chute.
        //
        // Ele pode ter pedido duas pizzas e agora querer uma. "Tira a pizza"
        // serve pras duas, e escolher por ele custa o mesmo que nao tirar
        // nenhuma: ou fica o que ele mandou tirar, ou some o que ele nao
        // mandou. Gente pergunta "qual delas?", e a padaria tambem.
        novo.tirandoQual = String(frase);
        rastro.push("mandou tirar e serve pra " + quais.length + " linhas; vou perguntar qual");
        continue;
      }
      // Nao casou com nada: ele falou de coisa que nao esta no pedido. Isto
      // NAO e ambiguidade e nao vira pergunta, senao a padaria perguntaria
      // "qual deles?" sobre uma lista vazia.
      rastro.push("mandou tirar algo que nao esta no pedido: " + frase);
    }
  }

  novo = atualizarBasePeloTotalDito(novo, l, falaDoCliente, etapa, rastro);
  // DELEGAR E DIZER "ESCOLHE VOCE". RESPONDER UMA OPCAO E O CONTRARIO DISSO.
  //
  // Medido conversando com o servidor em 31/08/2026:
  //
  //   padaria >> Qual recheio você prefere no risólis, carne ou frango?
  //   cliente >> frango
  //   modelo  >> delegaEscolha
  //   padaria >> O risólis é de frango ou carne?
  //
  // O modelo leu a resposta como "tanto faz, escolhe voce". A delegacao monta
  // sortido e carimba cor por conta propria, entao a resposta do cliente sumia e
  // a padaria perguntava de novo a mesma coisa.
  //
  // Quem responde uma opcao da lista escolheu. So e delegacao quando a fala NAO
  // traz nenhuma das opcoes que estao esperando resposta.
  //
  // A GUARDA QUE ANULAVA O `delegaEscolha` SAIU EM 03/09/2026. Ela existia
  // porque o modelo cego lia "frango" como "escolhe voce". Vendo a pergunta na
  // conversa, ele devolve o sabor no item (medido). O que o modelo diz vale.
  const delegou = l.delegaEscolha === true;
  if (delegou) novo = aplicarDelegacao(novo, etapa, l.delegaEm ?? []);

  // A COR DA FORMINHA E CARIMBADA DEPOIS DOS ITENS, NAO ANTES.
  //
  // Bateria dos cinco jeitos, 25/08/2026: a cor ficava quando vinha sozinha
  // ("50 brigadeiro" e depois "forminha rosa") e SUMIA quando vinha na mesma
  // frase ("50 brigadeiro, forminha rosa"), em tres dos cinco jeitos de falar.
  //
  // O carimbo rodava no comeco desta funcao, quando o docinho daquele turno
  // ainda nao existia na lista, e o bloco dos itens logo abaixo substituia
  // novo.itens inteiro, apagando o que tinha sido carimbado. A cor certa estava
  // gravada no pedido e nao aparecia em item nenhum.
  if (novo.forminha) {
    const marca = "forminha " + novo.forminha;
    novo.itens = novo.itens.map((i) => {
      if (
        !String(i.categoria || "").startsWith("docinho") &&
        categoriaNoCatalogo(i.produto) !== "docinho"
      ) {
        return i;
      }
      const obs = String(i.obs ?? "")
        .split(" | ")
        .filter((x) => x && !/^forminha /i.test(x))
        .join(" | ");
      return { ...i, obs: [obs, marca].filter(Boolean).join(" | ") };
    });
  }

  // A RESPOSTA DO SABOR VAI PRO ITEM QUE ESTA ESPERANDO SABOR.
  //
  // "de calabresa" nao nomeia produto nenhum: e resposta a pergunta que a
  // padaria acabou de fazer. Sem isto ela caia no vazio, a padaria perguntava o
  // sabor de novo, e o pedido nunca fechava. Medido em 26/08/2026, numa
  // conversa de pizza que precisou de seis voltas pra fechar.
  //
  // SO GRUDA SE O SABOR FOR DAQUELE PRODUTO. "calabresa" e sabor de pizza e de
  // esfirra; se houvesse os dois esperando, escolher por conta propria seria
  // inventar. Por isso: um item esperando, e o sabor tem que estar na lista
  // DELE.
  //
  // E so quando o item ainda nao tem sabor: quem ja escolheu nao e
  // sobrescrito por uma palavra solta numa mensagem posterior.
  //
  // DELEGA A FORMINHA NAO E SABOR DA MINI PIZZA.
  //
  // "escolhe voce a forminha" com mini pizza esperando recheio virava
  // "mini pizza de escolhe voce a forminha". Delegar a cor nao responde
  // recheio de ninguem.
  // O QUE VALE E A DECISAO, E NAO A LEITURA CRUA.
  //
  // Esta porta olhava `l.delegaEscolha` direto. Quando o modelo lia "frango"
  // como "escolhe voce", o bloco de distribuir sabor ficava fechado mesmo depois
  // de o codigo decidir NAO delegar: o risolis continuava sem recheio e a
  // padaria repetia a pergunta.
  if (!delegou && !l.forminha) {
  const esperando = novo.itens.filter((i) => saborQueFalta(i.produto, i.obs));

  // PALAVRA QUE JA TEM DONO NESTA FRASE NAO ESTA SOLTA.
  //
  // Medido em 30/08/2026, e NAO e defeito de pizza:
  //
  //   cliente >> 2 kg de torta fria de frango e 1 kg de empadao
  //   modelo  >> 2x torta fria [frango] ;; 1x empadao      <- leu CERTO
  //   pedido  >> torta fria [frango] ;; empadao [FRANGO]
  //
  // O empadao foi pedido sem sabor. Quem carimbou foi este bloco: `frango` esta
  // na frase, esta na lista do empadao, e o empadao estava esperando. As tres
  // guardas passaram, e mesmo assim a resposta e errada.
  //
  // Falta a distincao que ja consertou a juncao de itens e a remocao: a palavra
  // NAO estava solta, ela tinha dono na propria frase. O modelo disse a quem
  // ela pertence quando devolveu `sabor` naquele item. Sobra de palavra de um
  // item nao e sabor do outro.
  //
  // VALE PRA LOJA INTEIRA, e nao pra uma familia. Torta fria e empadao dividem
  // `frango`; pizza inteira e redonda dividem os 31 sabores; bolo e cupcake
  // dividem brigadeiro. Onde duas listas do catalogo se encostam, este defeito
  // existia calado.
  //
  // E o que NAO muda: quando o modelo nao da dono a ninguem, a palavra continua
  // solta e continua grudando. E assim que "de frango" responde a pergunta da
  // padaria, que e a razao de este bloco existir.
  const pedacosDoSabor = (s: unknown) =>
    semAc(String(s ?? ""))
      .split(/,|\||\se\s/)
      .map((p) => p.trim())
      .filter(Boolean);
  // O item que o fluxo jogou fora nao segura o sabor dele. Ver o porque no
  // `saboresDeItemDescartado`, la em cima.
  const soltosDeNovo = new Set(saboresDeItemDescartado.flatMap(pedacosDoSabor));
  const donoNaFrase = new Set(
    (l.itens ?? []).flatMap((i) => pedacosDoSabor(i.sabor)).filter((p) => !soltosDeNovo.has(p)),
  );
  // Casa por pedaco que cresce, senao `frango` escaparia de `frango com
  // catupiry` e o vizinho levaria a metade da palavra.
  const jaTemDono = (opcao: string) => {
    const alvo = semAc(opcao);
    return !!alvo && [...donoNaFrase].some((d) => d === alvo || d.includes(alvo) || alvo.includes(d));
  };

  novo.itens = comORecheioDoCardapio(novo.itens, rastro);

  // A RESPOSTA DO PESO VALE MESMO QUANDO O MODELO NAO DEVOLVE ITEM NENHUM.
  //
  // Medido conversando com a producao em 31/08/2026, e era beco sem saida:
  //
  //   cliente >> bom dia, quero 50 pao frances pra amanha
  //   padaria >> O pao frances é vendido por quilo, R$ 11,99 o quilo. Quantos
  //              quilos você quer?
  //   cliente >> 2 kg
  //   padaria >> O pao frances é vendido por quilo... (a MESMA pergunta)
  //
  // O peso so era lido DENTRO do laco dos itens que o modelo devolveu. Quando a
  // pessoa responde so o peso, o modelo nao devolve produto nenhum (nao ha
  // produto na frase), o laco nao roda uma vez sequer e a resposta dela se
  // perde. A pergunta saia de novo, pra sempre.
  //
  // A regra e a mesma do "Sim" digitado e a mesma do numero solto: quem da
  // sentido a resposta e A PERGUNTA QUE ACABOU DE SAIR, e nao a forma da frase
  // nem o que o modelo conseguiu ler dela.
  //
  // So mexe em item vendido por quilo que esta esperando peso (qtd zerada), e
  // no primeiro deles: a padaria pergunta um de cada vez.
  //
  // O GATILHO E O ESTADO, E NAO A ULTIMA FALA POR REGEX (03/09/2026): existe um
  // item por quilo sem peso, o modelo nao devolveu item nenhum, e a frase e so
  // um numero ou um peso. Vale so quando o modelo nao leu nada, que e a rede
  // embaixo: com a conversa no prompt ele costuma devolver o item com o peso.
  if (perguntaDePeso(e) && !(l.itens ?? []).length && frasePodeSerPeso(falaDoCliente, Boolean(l.dados))) {
    const pesoDito = pesoNaFala(String(falaDoCliente || ""), true);
    if (pesoDito > 0 && pesoDito <= 30) {
      const n = novo.itens.findIndex(
        (i) =>
          Number(i.qtd) <= 0 &&
          unidadeDoPedido(String(i.produto), String(i.categoria || "")) === "kg",
      );
      if (n >= 0) {
        novo.itens = novo.itens.map((i, k) => (k === n ? { ...i, qtd: pesoDito } : i));
        rastro.push(
          "a padaria tinha perguntado o peso; " + pesoDito + " kg de " + novo.itens[n].produto,
        );
      }
    }
  }

  const tSolto = semAc(String(falaDoCliente || ""));
  const peloFixo = tSolto
    ? novo.itens.filter((i) => {
        const p = produtoPorNome(i.produto) ?? produtoNoComeco(i.produto);
        if (!p?.saborFixo || !p.sabores.length) return false;
        return p.sabores.some((s) => {
          const alvo = semAc(s);
          if (alvo.length <= 2 || !tSolto.includes(alvo)) return false;
          // QUEM JA TEM O SABOR ANOTADO NAO ESTA ESPERANDO RESPOSTA.
          //
          // Medido conversando em 31/08/2026, com os quatro salgados do pedido
          // do dono:
          //
          //   padaria >> O risólis é de carne ou frango?
          //   cliente >> frango
          //   padaria >> O risólis é de quê? Tem carne e frango.
          //
          // A coxinha e de frango no cardapio e ja estava anotada com frango.
          // Mesmo assim ela entrava aqui, e por ter recheio FIXO recebia
          // primeiro: o "frango" morria nela e o risolis continuava sem sabor.
          // A padaria perguntava a mesma coisa de novo, e a conversa nao andava.
          //
          // A regra de cima continua de pe pro caso que ela nasceu ("50 coxinha"
          // e depois "de frango", com a pizza esperando): la a coxinha ainda NAO
          // tem sabor anotado, e e ela mesma que esta esperando.
          if (semAc(String(i.obs ?? "")).includes(alvo)) return false;
          return afirmouOuNegou(tSolto, cercaDoSabor(alvo)) !== false;
        });
      })
    : [];
  // A PALAVRA QUE E OUTRO ITEM DO PEDIDO NAO E SABOR.
  //
  // Festa misturada: pizza redonda esperando sabor, cliente disse "e
  // brigadeiro". Brigadeiro e docinho E sabor doce de pizza. Grudar na pizza
  // fazia "calabresa" depois nao colar, e o pedido misturado perdia o recheio.
  const palavraEOutroItem = (palavra: string, item: (typeof novo.itens)[number]) => {
    const a = semAc(palavra);
    if (!a) return false;
    return novo.itens.some((i) => {
      if (i === item) return false;
      const n = semAc(i.produto);
      if (n === a || n.endsWith(" " + a)) return true;
      const casa = produtoPorNome(i.produto) ?? produtoNoComeco(i.produto);
      return Boolean(casa && (semAc(casa.nome) === a || semAc(casa.nomeCurto) === a));
    });
  };

  // RECHEIO DE QUEM JA TEM SABOR FIXO NAO VAI PRA QUEM ESTA ESPERANDO LISTA.
  //
  // Medido em 30/08/2026: "50 coxinha" e depois "de frango". A pizza redonda
  // pedia sabor, a coxinha e de frango no catalogo, e o recheio grudou na
  // pizza. Quem tem recheio fixo e bate com a frase recebe primeiro.
  if (peloFixo.length === 1) {
    const item = peloFixo[0];
    const p = produtoPorNome(item.produto) ?? produtoNoComeco(item.produto);
    const achado = [...(p?.sabores ?? [])]
      .sort((a, b) => b.length - a.length)
      .find((o) => {
        const alvo = semAc(o);
        if (alvo.length <= 2 || !tSolto.includes(alvo)) return false;
        return afirmouOuNegou(tSolto, cercaDoSabor(alvo)) !== false;
      });
    if (achado && !semAc(String(item.obs ?? "")).includes(semAc(achado))) {
      novo.itens = novo.itens.map((i) =>
        i === item ? { ...i, obs: [i.obs, achado].filter(Boolean).join(" | ") } : i,
      );
    }
  } else if (esperando.length >= 1) {
    const t = semAc(String(falaDoCliente || ""));
    const saborDeste = (item: (typeof novo.itens)[number]) => {
      const opcoes = saborQueFalta(item.produto, item.obs)?.opcoes ?? [];
      return [...opcoes]
        .sort((a, b) => b.length - a.length)
        .find((o) => {
          const alvo = semAc(o);
          if (alvo.length <= 2 || !t.includes(alvo)) return false;
          // O sabor que o modelo ja deu a outro item desta frase nao esta solto.
          if (jaTemDono(o)) return false;
          return afirmouOuNegou(t, cercaDoSabor(alvo)) !== false;
        });
    };
    const candidatos = esperando
      .map((item) => {
        const achado = saborDeste(item);
        return achado ? { item, achado } : null;
      })
      .filter((x): x is { item: (typeof novo.itens)[number]; achado: string } => Boolean(x));
    // REDE, E NAO GUARDA (03/09/2026): quem sabe de qual item era a pergunta do
    // sabor e o modelo, que ve a conversa e devolve o sabor no campo do item
    // certo. Este bloco inteiro so roda quando ele NAO devolveu o sabor, e o
    // desempate pela ultima fala fica aqui so pra esse caso: ele nunca desfaz
    // o que o modelo leu.
    const citadaNaPergunta = candidatos.filter(({ item }) => {
      const ultima = semAc(String(e.ultimaFala || ""));
      const n = semAc(item.produto);
      return Boolean(n) && n.length >= 4 && ultima.includes(n);
    });
    const daPizza = candidatos.filter(
      ({ item }) => categoriaNoCatalogo(item.produto) === "pizza" || categoriaNoCatalogo(item.produto) === "calzone",
    );
    const escolhido =
      candidatos.length === 1
        ? candidatos[0]
        : daPizza.length === 1
          ? daPizza[0]
          : citadaNaPergunta.length === 1
            ? citadaNaPergunta[0]
            : null;
    // CALABRESA NA MINI PIZZA QUANDO A REDONDA ESTAVA ESPERANDO.
    //
    // Medido na conversa ao vivo: pizza redonda sem sabor, mini pizza no
    // mesmo pedido, cliente disse "calabresa". A palavra serve nos dois
    // (catalogo). Sem desempatar, grudava na mini. Pizza nao e salgado de
    // festa: a palavra vai pra pizza quando as duas esperam.
    if (escolhido) {
      const { item, achado } = escolhido;
      if (!palavraEOutroItem(achado, item) && !semAc(String(item.obs ?? "")).includes(semAc(achado))) {
        novo.itens = novo.itens.map((i) =>
          i === item ? { ...i, obs: [i.obs, achado].filter(Boolean).join(" | ") } : i,
        );
      }
    } else if (esperando.length === 1 && /\?/.test(String(falaDoCliente || "")) === false) {
      // ELE INSISTIU NUM SABOR QUE A LISTA NAO TEM.
      //
      // "pistache" sozinho nao nomeia produto e nao esta nas opcoes. Sem isto
      // a resposta caia no vazio, a padaria perguntava de novo, e na
      // insistencia o bloco de equipe exigia obs ja preenchida: o sabor
      // pedido nunca chegava na comanda.
      const item = esperando[0];
      const cru = String(falaDoCliente || "").trim();
      const soIsto = semAc(cru);
      const jaTem = semAc(String(item.obs ?? ""));

      // FRASE QUE A LEITURA ENTENDEU COMO OUTRA COISA NAO E SABOR.
      //
      // Medido em producao em 30/08/2026, e o pedido fechou assim:
      //
      //   padaria >> Qual sabor voce quer no empadao?
      //   cliente >> pra retirar amanha as 18h
      //   padaria >> Qual sabor do empadao voce quer?
      //   cliente >> Eliezer
      //   pedido  >> 1 empadao (pra retirar amanha as 18h | Eliezer)  R$ 34,90
      //
      // A data e o nome viraram o SABOR, e isso foi pro cupom da cozinha.
      //
      // As tres guardas de cima passaram: o texto tem entre 3 e 40 letras, nao
      // cita produto nenhum, e nao estava na observacao. Elas medem a FORMA da
      // frase, e forma nao distingue "pistache" de "Eliezer".
      //
      // Quem distingue e a propria leitura: se o modelo devolveu `dados` nesta
      // mensagem, ele entendeu a frase como data, hora, nome ou pagamento. Uma
      // frase que ja tem dono nao esta sobrando pra virar sabor, que e a mesma
      // regra do carimbo logo acima e da juncao de itens.
      //
      // O QUE ISTO CUSTA, e e barato: "de pistache, pra amanha as 18h" perde o
      // pistache, porque a mensagem tambem trouxe a data. O sabor fora da lista
      // ja vai pra equipe de qualquer jeito; escrever a data no cupom nao tem
      // conserto depois que a cozinha leu.
      //
      // E NAO E SO `dados`. Medido de novo em 30/08/2026, na bancada:
      //
      //   cliente >> na embalagem com tampa
      //   comanda >> bolo brigadeiro (brigadeiro | ... | embalagem com tampa
      //              | NA EMBALAGEM COM TAMPA)
      //
      // A leitura entendeu a frase como `prato` e o codigo anotou a embalagem
      // no bolo, certo. Ai esta guarda, olhando so `dados`, deixou a MESMA
      // frase virar recheio, e a cozinha recebeu a embalagem escrita duas
      // vezes, uma delas no lugar do sabor.
      //
      // Entao vale pra todo campo que a leitura preencheu: se ela entendeu a
      // frase como prato, peca, tema, cor de forminha ou nome do aniversariante,
      // a frase tem dono e nao sobra pra virar sabor.
      const aFraseTemOutroDono =
        Object.values(l.dados ?? {}).some((v) => String(v ?? "").trim()) ||
        !!l.prato ||
        !!l.pecas ||
        !!l.tema ||
        !!l.forminha ||
        !!l.escrito ||
        !!l.aniversariante?.nome ||
        !!l.aniversariante?.idade;
      if (aFraseTemOutroDono && cru) rastro.push("nao usei a frase como sabor: a leitura ja deu outro dono a ela");

      if (
        cru &&
        !aFraseTemOutroDono &&
        soIsto.length >= 3 &&
        soIsto.length <= 40 &&
        !produtosNaFrase(cru).length &&
        !jaTem.includes(soIsto)
      ) {
        // SE O CARDAPIO TEM ESSE SABOR, VAI O NOME DO CARDAPIO.
        //
        // Este caminho existe pro sabor que a lista NAO tem ("pistache"), e ali
        // a frase inteira e o certo: e o que a equipe vai ler pra decidir. So
        // que ele tambem pegava frase que CONTEM um sabor da lista, e ai a
        // comanda saia com a fala do cliente no lugar do recheio:
        //
        //   cliente >> quero carne
        //   comanda >> 50 un mini bolha  > frito | quero carne
        //
        // Medido conversando com o servidor em 31/08/2026, e impresso assim no
        // cupom do pedido de festa da vespera.
        // PALAVRA QUE JA E O RECHEIO FIXO DE OUTRO ITEM NAO ESTA SOBRANDO.
        //
        // "50 coxinha" e depois "de frango": a coxinha e de frango no cardapio e
        // ja sai carimbada com ele, entao a frase nao esta pendente de ninguem.
        // Sem esta checagem ela caia aqui e virava observacao do unico item que
        // ainda esperava sabor, mesmo sendo uma pizza, que nem tem frango na
        // lista. A cozinha recebia "pizza redonda (de frango)".
        //
        // Pego pelo `a-festa-nao-reparte-pizza` no mesmo dia em que o carimbo do
        // recheio fixo entrou: duas regras certas que, juntas, faziam o errado.
        const jaEDeOutro = novo.itens.some((x) => {
          if (x === item) return false;
          const p = produtoPorNome(x.produto) ?? produtoNoComeco(x.produto);
          if (!p?.saborFixo) return false;
          return p.sabores.some((s) => {
            const alvo = semAc(s);
            return alvo.length > 2 && soIsto.includes(alvo);
          });
        });
        if (jaEDeOutro) {
          rastro.push("nao usei a frase como sabor: ela e o recheio fixo de outro item do pedido");
        }
        const daLista = jaEDeOutro ? undefined : (saborQueFalta(item.produto, item.obs)?.opcoes ?? [])
          .slice()
          .sort((a, b) => b.length - a.length)
          .find((o) => {
            const alvo = semAc(o);
            return alvo.length > 2 && soIsto.includes(alvo) &&
              afirmouOuNegou(soIsto, cercaDoSabor(alvo)) !== false;
          });
        const oQueEntra = daLista ?? cru;
        if (daLista) {
          rastro.push("a frase \"" + cru + "\" traz \"" + daLista + "\", que esta no cardapio; anotei o sabor");
        }
        if (!jaEDeOutro) {
          novo.itens = novo.itens.map((i) =>
            i === item ? { ...i, obs: [i.obs, oQueEntra].filter(Boolean).join(" | ") } : i,
          );
        }
      }
    }
  }
  }

  return novo;
}

/**
 * UMA MENSAGEM ENTRA, UMA RESPOSTA SAI.
 */
/**
 * QUAL LINHA DO PEDIDO ELE MANDOU TIRAR. -1 quando nao da pra ter certeza.
 *
 * O modelo devolve a frase ("a de calabresa", "o bolo") e quem escolhe a linha
 * e isto aqui, porque decisao que custa dinheiro nao mora no prompt.
 *
 * O SABOR VALE MAIS QUE O NOME, e essa e a regra toda. Quando existem duas
 * linhas do mesmo produto, o sabor e a UNICA coisa que as separa, e e por ele
 * que o cliente chama: "a de calabresa" nem cita a pizza. Entao procura-se
 * primeiro por sabor; so quando nenhum sabor casa e que o nome do produto
 * responde.
 *
 * -1 QUANDO DUAS LINHAS CASAM. Tirar a errada custa o mesmo que nao tirar
 * nenhuma, e ainda quebra "nada some do pedido". Ambiguidade nao e permissao
 * pra escolher.
 */

const palavrasQueApontam = (t: string): string[] =>
  semAc(t).split(/[^a-z0-9]+/).filter((p) => p && !PALAVRAS_VAZIAS.has(p));

export function linhasQueOClientePodeEstarTirando(
  itens: { produto: string; obs?: string | null }[],
  frase: string,
): number[] {
  const ditas = palavrasQueApontam(frase);
  if (!ditas.length) return [];

  // CONTA PALAVRA, NAO PROCURA O NOME INTEIRO DENTRO DA FRASE.
  //
  // A primeira versao procurava o nome do catalogo dentro da frase, e por isso
  // errava dos DOIS lados, os dois medidos em 30/08/2026:
  //
  //   "tira a pizza"  nao achava `pizza inteira`, porque o nome do cliente e
  //                   mais curto que o do catalogo. Sem casar com nada, virava
  //                   "falou de coisa que nao esta no pedido" e ninguem
  //                   perguntava nada. Era o exemplo que o dono deu.
  //
  //   "a redonda"     respondendo QUAL tirar, nao achava `pizza redonda` pelo
  //                   mesmo motivo, e a pergunta virava conversa perdida: a
  //                   padaria perguntava e ignorava a resposta.
  //
  // Contando palavra, os dois funcionam com a MESMA regra, e ela ainda da de
  // graca o que faltava: o sabor vale mais que o nome sem precisar de tratamento
  // separado, porque quem diz "a de calabresa" acerta uma palavra que so uma das
  // linhas tem, e quem diz "a pizza" acerta uma que as duas tem, o que e empate
  // e empate e ambiguidade.
  //
  // E VALE PRA RESPOSTA ACUMULADA. "a pizza" mais "a redonda" pontua a redonda
  // duas vezes e a inteira uma, entao afunilar sai sem codigo novo.
  const pontos = itens.map((x) => {
    const minhas = new Set(palavrasQueApontam(x.produto + " " + String(x.obs ?? "")));
    return [...minhas].filter((p) => ditas.includes(p)).length;
  });
  const melhor = Math.max(...pontos, 0);
  if (melhor > 0) return pontos.flatMap((p, n) => (p === melhor ? [n] : []));

  // ELE CHAMOU PELA FAMILIA, e nenhuma palavra do produto apareceu.
  //
  // "tira o salgado" com coxinha e risoles no pedido nao acerta palavra nenhuma,
  // e mesmo assim aponta os dois. Quem responde e a familia, que ja existe e ja
  // e usada no resto do fluxo.
  const familias = chavesDeFamilia().filter((f) => ditas.includes(semAc(f)));
  if (!familias.length) return [];
  return itens.flatMap((x, n) => (familias.includes(String(familiaDoProduto(x.produto))) ? [n] : []));
}

/**
 * COMO A PADARIA CHAMA ESTA LINHA quando precisa perguntar qual delas sai.
 *
 * Produto e observacao juntos, porque quando duas linhas casam com a mesma
 * frase e justamente a observacao que as separa. Sem ela a pergunta sairia
 * "pizza inteira ou pizza inteira?".
 *
 * A observacao vem do fluxo com " | " entre os pedacos, que e separador de
 * banco e nao de conversa. Na fala vira " e ".
 *
 * SEM ARTIGO, de proposito: o genero do produto nao esta no catalogo, e "a
 * croquete" e "o coxinha" sao erros que a clientela ve na hora. E a mesma razao
 * ja escrita no aviso de recheio trocado.
 */
function comoAPadariaChama(x: { produto: string; obs?: string | null }): string {
  const obs = String(x.obs ?? "").split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
  return x.produto + (obs.length ? " (" + obs.join(" e ") + ")" : "");
}

/** "tem A e B. Qual voce quer tirar?" com quantos forem. */
export function perguntaDeQualTirar(
  itens: { produto: string; obs?: string | null }[],
  quais: number[],
): string {
  const nomes = quais.map((n) => comoAPadariaChama(itens[n]));
  const lista = nomes.length <= 1 ? nomes.join("") : nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
  // "Qual DELES" supoe masculino, e pizza e feminina. O genero do produto nao
  // esta no catalogo, entao a frase e escrita sem precisar dele: e a mesma
  // razao ja anotada no aviso de recheio trocado ("a croquete", "o coxinha").
  return "No seu pedido tem " + lista + ". Qual você quer tirar?";
}

/**
 * A LEITURA NAO TROUXE NADA. `{}` e `{ itens: [] }` sao a mesma coisa: o modelo
 * leu a mensagem e ela nao mudou o pedido.
 */
function leituraVazia(l: Leitura | null | undefined): boolean {
  return Object.values(l ?? {}).every((v) => v == null || v === false || (Array.isArray(v) && !v.length));
}

export async function responder(
  estadoAtual: Estado,
  mensagem: { texto: string; botaoId?: string | null },
  pensar: Pensar,
  // O roteiro pode vir de fora (os testes passam o deles). Sem ele, quem
  // escolhe e o tipo do pedido, e a escolha e refeita DEPOIS de ler a mensagem:
  // "festa pra 20 pessoas" troca o roteiro no meio da propria mensagem.
  etapas: Etapa[] | null = null,
  // A CONVERSA ATE AQUI, lida do banco por quem chama. Sem ela (os testes), a
  // ultima fala da padaria faz as vezes do historico, que e o minimo que da
  // sentido a uma resposta curta.
  historico: TurnoDaConversa[] | null = null,
  // O AVISO DO DIA da dona ("sem pao apos as 18h"). A tela prometia que a IA
  // lia isso e nada lia: nao havia prompt onde enfiar. Agora vai junto do que
  // esta anotado, e o modelo responde sabendo.
  avisoDoDia: string | null = null,
): Promise<Resposta> {
  const rastro: string[] = [];
  let estado: Estado = { ...estadoAtual };
  let chamouIA = false;
  let naoTemos: string[] = [];
  let confirmouEscrevendo = false;
  let precisaHumano = false;
  // POR QUE ELA CHAMOU A EQUIPE, e nao so QUE chamou.
  //
  // No pedido de 30/08/2026 a Dora prometeu "deixa eu confirmar com a equipe" e
  // o painel acendeu um aviso generico. Ninguem descobriu que o assunto era o
  // sem lactose sem ler as 47 mensagens da conversa, e o cliente esperou um
  // retorno que ninguem sabia que devia.
  let motivoHumano: string | null = null;
  /** A foto que chegou e o comprovante do pix, e nao a referencia do bolo. */
  let ehComprovante = false;
  let leituraDesteTurno: Leitura | null = null;

  const roteiro = () => etapas ?? roteiroDoPedido(estado);
  // O PEDIDO JA APROVADO E ASSUNTO ENCERRADO, E NAO PEDIDO EM MONTAGEM.
  //
  // Medido na conversa dele de 02/09/2026:
  //
  //   01:20  equipe  >> A nossa equipe confirmou o seu pedido. Fica pra 10/09.
  //   01:26  cliente >> Ok, obrigada!
  //   01:26  padaria >> Pronto, seu pedido foi pra fila da equipe... o topo
  //                     entra a parte...
  //
  // Ela repetiu a fala de FECHAMENTO num pedido que ja estava confirmado e indo
  // pra producao. Pra quem le, parece que o pedido voltou pra fila.
  //
  // Com o pedido aprovado, a conversa passa a falar DELE: o que ele pedir de
  // novo continua virando pedido novo, e mudanca no que ja foi aprovado e da
  // equipe, porque a cozinha ja esta com aquilo na mao.
  //
  // AQUI HAVIA DUAS LISTAS DE PALAVRAS (dez verbos de mudanca e oito de
  // agradecimento) decidindo a resposta ANTES de chamar o modelo. Sairam em
  // 03/09/2026: quem le a mensagem e o modelo, com a conversa, e a decisao
  // mora logo depois da leitura (ver `respostaSobreOPedidoAprovado`).

  const etapaAgora = etapaDaVez(estado, roteiro());
  rastro.push("etapa: " + etapaAgora.id);

  // ---------------------------------------------------------------- botao
  //
  // O ATALHO DO "SIM" DIGITADO SAIU EM 03/09/2026. Ele lia a ultima fala por
  // regex pra saber de qual peca era o "Sim" e aplicava o botao SEM chamar o
  // modelo. Medido em producao: "sim, topo e papel de arroz, tema homem
  // aranha, escrito Theo 5 anos" ligou as duas pecas e PERDEU o tema e o
  // escrito, e a padaria perguntou o tema de novo. O modelo, vendo a
  // pergunta, le "Sim", "nao", a frase mista e o contraste ("quero topo mas
  // nao papel") 3 de 3. So o toque de botao de verdade dispensa o modelo.
  if (mensagem.botaoId && DO_BOTAO[mensagem.botaoId]) {
    estado = DO_BOTAO[mensagem.botaoId](estado);
    rastro.push("botao: " + mensagem.botaoId + " (sem chamar a IA)");
  } else if (mensagem.texto.trim()) {
    // ----------------------------------------------------------- texto livre
    const instrucao = instrucaoDaEtapa(etapaAgora.id, estado);
    // A CONVERSA VAI JUNTO, E O PEDIDO ANOTADO TAMBEM. Sem isso o modelo le a
    // frase do cliente no vazio, e "10" depois de "quantas pessoas?" vira dez
    // quilos de bolo. Medido 5 de 5 em 03/09/2026.
    const crua = await pensar({
      instrucao,
      mensagem: mensagem.texto,
      historico:
        historico ??
        (estado.ultimaFala ? [{ papel: "assistant" as const, conteudo: String(estado.ultimaFala) }] : []),
      anotado: [resumoDoAnotado(estado), avisoDoDia ? "Aviso da padaria hoje: " + avisoDoDia : null]
        .filter(Boolean)
        .join(" ") || null,
    });
    chamouIA = true;

    // O QUE O MODELO DEVOLVEU, NO RASTRO.
    //
    // O `DIARIO-DA-IA.md` chama o rastro do instrumento mais produtivo do
    // projeto: "em uma hora isso achou tres defeitos que os relatorios de teste
    // nao achavam, e nos tres a IA estava fazendo certo". Aquelas linhas eram do
    // cerebro velho, que trabalhava com ferramentas, e foram junto na demolicao
    // de 26/08/2026. Ninguem anotou a perda, e o diario continua recomendando.
    //
    // Sem isto, saber o que o modelo respondeu so da pra ADIVINHAR. Em
    // 30/08/2026 eu adivinhei duas vezes seguidas no mesmo defeito da pizza:
    // escrevi um conserto pra uma resposta que eu supus, deployei, medi, e o
    // banco continuou igual porque a resposta era outra.
    //
    // So os ITENS, e so o que decide linha (produto, quantidade, sabor): e o
    // que basta pra ler um defeito de pedido, e nao enche o log com a conversa.
    if (crua?.itens?.length) {
      rastro.push(
        "modelo leu: " +
          crua.itens
            .map((i) => (i.qtd ?? "?") + "x " + i.produto + (i.sabor ? " [" + i.sabor + "]" : ""))
            .join(" ;; "),
      );
    }

    // E O QUE NAO E ITEM TAMBEM, porque tambem decide dinheiro.
    //
    // O rastro so mostrava os itens, e por isso uma conversa de 30/08/2026 me
    // deixou sem resposta: o cliente disse "nao, sem topo" e o pedido ganhou um
    // papel de arroz de R$ 12,00 que ele tinha recusado no turno anterior. Pra
    // saber se a culpa era do modelo ou da minha guarda eu precisava do que ele
    // devolveu em `pecas` e em `naoQuer`, e isso nao estava em lugar nenhum.
    //
    // Fiquei deduzindo pelo estado gravado, que e o que este projeto ja aprendeu
    // a nao fazer: ler o codigo gera hipotese, o rastro da veredito. Uma linha
    // de log custa menos que uma hora de suposicao.
    const naoEItem: string[] = [];
    if (crua?.pecas) naoEItem.push("pecas=" + JSON.stringify(crua.pecas));
    if (crua?.naoQuer?.length) naoEItem.push("naoQuer=" + crua.naoQuer.join(","));
    if (crua?.tirar?.length) naoEItem.push("tirar=" + crua.tirar.join(","));
    if (crua?.dados && Object.values(crua.dados).some((v) => String(v ?? "").trim())) {
      naoEItem.push("dados=" + JSON.stringify(crua.dados));
    }
    if (crua?.confirmou === true) naoEItem.push("confirmou");
    if (crua?.delegaEscolha === true) naoEItem.push("delegaEscolha");
    if (crua?.aceitouBase === true) naoEItem.push("aceitouBase");
    if (naoEItem.length) rastro.push("modelo tambem leu: " + naoEItem.join(" / "));

    // O PEDIDO JA ESTA NA FILA E A MENSAGEM NAO MUDOU NADA: a padaria diz isso,
    // em vez de mostrar o resumo inteiro com o botao Confirmar de novo.
    //
    // Medido em 03/09/2026: "obrigada!" depois de fechar recebia "Fechando o
    // pedido: ..." de novo, porque o webhook devolve o pedido pendente pro
    // rascunho (pra ele poder mudar) e a confirmacao nunca se da por cumprida.
    // Sem lista de palavras: quem diz que a mensagem nao mudou nada e o modelo,
    // devolvendo {}. O que MUDAR o pedido continua entrando normal, e o
    // `registrarPedido` atualiza o pendente em vez de duplicar.
    //
    // EM QUALQUER ETAPA, e nao so na confirmacao: o rascunho devolvido pelo
    // webhook nao traz a memoria do fluxo (a oferta feita, as perguntas ja
    // feitas), entao a etapa da vez pode ser outra. Medido em 03/09/2026:
    // "obrigada!" depois de fechar ouvia "Quer levar docinho ou bolo junto?".
    // O PEDIDO JA APROVADO E ASSUNTO ENCERRADO, E NAO PEDIDO EM MONTAGEM.
    //
    // Medido na conversa dele de 02/09/2026: "Ok, obrigada!" depois de a equipe
    // confirmar recebia a fala de FECHAMENTO, como se o pedido tivesse voltado
    // pra fila. Ate 03/09 isto era decidido por duas listas de palavras ANTES
    // do modelo; agora quem le e o modelo (medido 3 de 3: "obrigada" vira {},
    // "da pra mudar pra sexta?" vira dados). Nada mudou = agradece; mexeu em
    // item, data, peca ou pediu pra cancelar = a cozinha ja esta com aquilo na
    // mao, e a mudanca e da equipe.
    //
    // SO NO MEIO DE UMA CONVERSA (ultimaFala existe). Quem chega do zero com um
    // pedido aprovado cai na ABERTURA, que ja pergunta se e sobre ele.
    if (estado.pedidoAprovado && !estado.itens.length && estado.ultimaFala) {
      const quando = quandoDoPedido(estado.pedidoAprovado);
      const mudouNada = leituraVazia(crua);
      const querMexer = Boolean(
        crua?.itens?.length || crua?.tirar?.length || crua?.dados || crua?.pecas ||
        crua?.naoQuer?.length || crua?.recomecar || crua?.falouDeOutraEtapa || crua?.situacao === "cancelar",
      );
      if (mudouNada || querMexer) {
        rastro.push("pedido ja aprovado; falei dele em vez de reabrir o fechamento");
        const textoDoAprovado = querMexer
          ? "Seu pedido já está confirmado com a equipe" +
            (quando ? " pra " + quando : "") +
            ", e eles já estão com ele pra produzir. Vou chamar alguém da equipe pra ver essa mudança com você."
          : "Imagina! Seu pedido está confirmado" +
            (quando ? " pra " + quando : "") +
            ". Qualquer coisa é só chamar por aqui.";
        return {
          fala: { texto: textoDoAprovado, botoes: [], cardapio: null, podeReescrever: false },
          estado: { ...estado, insistiu: 0, ultimaFala: textoDoAprovado },
          etapa: "registrado",
          rastro,
          chamouIA,
          confirmouEscrevendo: false,
          precisaHumano: querMexer,
          motivoHumano: querMexer
            ? "O cliente quer mudar um pedido JA APROVADO" + (quando ? " (retirada " + quando + ")" : "") +
              ". Ele escreveu: \"" + String(mensagem.texto ?? "").trim() + "\""
            : null,
        };
      }
    }

    if (estado.pedidoNaFila && leituraVazia(crua)) {
      const textoNaFila =
        "Seu pedido já está com a equipe da padaria pra aprovação. Assim que eles confirmarem " +
        "eu te aviso por aqui. Se quiser mudar alguma coisa, é só me dizer.";
      rastro.push("pedido ja na fila e a mensagem nao mudou nada; nao repeti o resumo");
      return {
        fala: { texto: textoNaFila, botoes: [], cardapio: null, podeReescrever: false },
        estado: { ...estado, insistiu: 0, ultimaFala: textoNaFila },
        etapa: "registrado",
        rastro,
        chamouIA,
        confirmouEscrevendo: false,
        precisaHumano: false,
        motivoHumano: null,
      };
    }

    const { limpa, barrados, naoExistem, paraDepois } = leituraQueCabeNaEtapa(etapaAgora.id, crua);
    if (barrados.length) rastro.push("barrado nesta etapa: " + barrados.join(", "));

    // AQUI MORAVAM 150 LINHAS QUE REMONTAVAM PELA FRASE O QUE A INSTRUCAO TINHA
    // MANDADO O MODELO ESCONDER: o injetor `itensDeOutraEtapaNaFrase`, o
    // `guardados` (item barrado estacionado pra etapa dele) e a volta dele.
    // Existiam porque o modelo so via o vocabulario da etapa e era instruido a
    // "devolver falouDeOutraEtapa em vez de anotar". Desde 03/09/2026 ele ve a
    // conversa, o pedido e o cardapio inteiro, e anota tudo: quem separa por
    // familia e o `aplicar`, pelo catalogo. O que ainda estiver em
    // `estado.guardados` de conversa antiga entra agora, de uma vez.
    if (estado.guardados?.length) {
      const sobrando = estado.guardados.filter((g) => !jaTemEsseProduto(estado.itens, g.produto));
      if (sobrando.length) {
        limpa.itens = [...(limpa.itens ?? []), ...sobrando];
        rastro.push("entrou o que estava guardado: " + sobrando.map((a) => a.produto).join(", "));
      }
      estado = { ...estado, guardados: [] };
    }
    // O que foi barrado por NAO EXISTIR no cardapio vira aviso pro cliente. O
    // que foi barrado por ser de outra familia nao: aquele a conversa resolve
    // indo pra etapa certa, e dizer "a gente nao faz brigadeiro" seria mentira.
    // A PADARIA SO NEGA O QUE ELA NAO VENDE.
    //
    // Isto era `barrados` filtrado por REGEX no texto do rastro, e o filtro so
    // conhecia UM dos casos que nao deviam virar negativa. Passavam os outros
    // dois: o item guardado pra etapa certa e o produto de familia sem etapa.
    //
    //   cliente >> 50 brigadeiro          (na etapa do salgado)
    //   padaria >> Nao achei brigadeiro no cardapio com esse nome.
    //
    // Negava enquanto guardava. Agora quem separa e a leitura, que sabe a
    // diferenca, e nao uma busca de texto aqui dentro.
    naoTemos = naoExistem;

    // ELE FALOU DE OUTRA ETAPA: VAI PRA LA E VOLTA DEPOIS.
    //
    // SABOR SOZINHO NAO E ASSUNTO NOVO, E RESPOSTA.
    //
    // "de calabresa" nao nomeia produto nenhum. Mas calabresa TAMBEM e sabor de
    // esfirra, entao o modelo lia isso como "ele falou de salgado" e a conversa
    // pulava pra etapa do salgado, mandava o cardapio de salgados, e a resposta
    // se perdia. Medido em 26/08/2026, com uma conversa de pizza:
    //
    //   padaria >> A pizza redonda e de qual sabor?
    //   cliente >> de calabresa
    //   padaria >> Quais salgados voce deseja?   (com o cardapio de salgados)
    //
    // Isso pega qualquer sabor que existe em duas familias, que sao quase
    // todos: calabresa, frango, carne, bacon, chocolate, morango.
    //
    // A regra e simples e verdadeira: pra mudar de assunto ele tem que NOMEAR
    // um produto. Sabor solto responde a pergunta que esta na mesa.
    // NOME DE FAMILIA NAO E SABOR SOLTO.
    //
    // A regra abaixo pede que ele NOMEIE um produto pra mudar de assunto, e ela
    // esta certa pro sabor ("de calabresa" e resposta, nao assunto novo). So que
    // familia tambem e nome: "queria uns salgados pra amanha" nao nomeia produto
    // nenhum, caia aqui, e o assunto que o cliente acabou de trazer era jogado
    // fora. Medido em 31/08/2026.
    //
    // "de calabresa" continua sendo sabor solto: calabresa nao e familia.
    const nomeouProduto =
      produtosNaFrase(String(mensagem.texto ?? "")).length > 0 ||
      Boolean(familiaDoQueEleNomeou(String(mensagem.texto ?? "")));
    if (!nomeouProduto && limpa.falouDeOutraEtapa) {
      rastro.push("sabor solto, nao assunto novo: fico onde estou");
      limpa.falouDeOutraEtapa = undefined;
    }

    // PERGUNTA DE OUTRA FAMILIA NAO CONTINUA A ETAPA.
    //
    // Print do dono, 30/08/2026, Rodrigo Zanella: a etapa era o bolo, o cliente
    // perguntou "voces fazem pizza de forma?" e a padaria mandou o cardapio de
    // bolos de festa, papel de arroz e topo pra equipe orcar. Depois parou e
    // acendeu "precisa de voce".
    //
    // O modelo, preso na etapa, nao devolve perguntou. O assunto do bolo nao
    // se cumpre sem item de bolo, e a mesma pergunta sai de novo ate a equipe.
    //
    // A frase nomeia a familia. Familia com etapa propria (bolo, salgado,
    // docinho) vira assunto. Familia sem etapa (pizza, cuca) e informacao:
    // responde o preco do catalogo, manda o cardapio certo, nao gruda.
    {
      const falaAgora = String(mensagem.texto ?? "");
      const famNomeada = familiaDoQueEleNomeou(falaAgora);
      const famDestaEtapa =
        etapaAgora.id === "pecas_do_bolo"
          ? "bolo"
          : etapaAgora.id === "bolo" || etapaAgora.id === "salgado" || etapaAgora.id === "docinho"
            ? etapaAgora.id
            : null;
      const ehPergunta = Boolean(limpa.perguntou?.sobre) || /\?/.test(falaAgora);
      if (ehPergunta && famNomeada && famNomeada !== famDestaEtapa) {
        const nomeado = produtosNaFrase(falaAgora)[0];
        // A ETAPA DO RESTO DO CARDAPIO NAO CONTA COMO "TEM ETAPA PROPRIA".
        //
        // Ela existe pra perguntar o TIPO do que ele ja pediu, e nao pra
        // receber quem so PERGUNTOU se a casa faz. Quem pergunta "voces fazem
        // pizza de forma?" quer o preco, nao um interrogatorio.
        //
        // Sem esta linha, a etapa nova (30/08/2026) desfaz o conserto do
        // mesmo dia: a pergunta de pizza no meio do bolo voltava a ser
        // desviada em vez de respondida.
        const daFamilia = nomeado ? etapaDesteProduto(nomeado) : null;
        const etapaDaFam: EtapaId | null =
          (daFamilia === "resto_do_cardapio" ? null : daFamilia) ||
          (famNomeada === "bolo" || famNomeada === "salgado" || famNomeada === "docinho"
            ? famNomeada
            : null);
        if (etapaDaFam && etapaDaFam !== etapaAgora.id) {
          limpa.falouDeOutraEtapa = etapaDaFam;
        } else if (!etapaDaFam) {
          const sobre =
            limpa.perguntou?.sobre && limpa.perguntou.sobre !== "outro" ? limpa.perguntou.sobre : "preco";
          limpa.perguntou = { sobre, familia: nomeado ?? famNomeada };
          limpa.falouDeOutraEtapa = undefined;
          rastro.push("perguntou de " + famNomeada + ", nao da etapa " + etapaAgora.id);
        }
      }
    }

    if (limpa.falouDeOutraEtapa && limpa.falouDeOutraEtapa !== etapaAgora.id) {
      // So marca a volta se a etapa de agora ainda nao estava resolvida: quem
      // termina o docinho e vai pro bolo nao precisa "voltar" pro docinho.
      const voltar = !etapaAgora.cumprida(estado) ? etapaAgora.id : estado.retomarEm ?? null;
      // O que ele trouxe vira o assunto, e o assunto sobrevive a mensagem: no
      // WhatsApp a proxima chega numa chamada nova, com o estado lido do banco.
      estado = { ...estado, retomarEm: voltar, assunto: limpa.falouDeOutraEtapa };
      rastro.push("falou de " + limpa.falouDeOutraEtapa + "; retomo em " + (voltar ?? "nada"));

      // A FAMILIA QUE ELE DISSE QUE QUER ENTRA NO PEDIDO NA HORA.
      //
      // Medido conversando com a producao em 31/08/2026:
      //
      //   cliente >> queria encomendar um bolo de aniversario
      //   cliente >> nao eh festa nao, so o bolo mesmo
      //   padaria >> O que você vai querer?
      //   cliente >> brigadeiro
      //   comanda >> 1 brigadeiro          (o DOCINHO, e o bolo nunca existiu)
      //
      // A conversa sabia que o assunto era bolo (esta escrito no rastro), mas
      // nada do bolo ia pro pedido: o modelo nao devolve item pra "queria
      // encomendar um bolo", porque nao ha produto nenhum na frase, so a
      // familia. Sem item, nao ha o que ancorar, e "brigadeiro" caiu no
      // docinho, que e um produto de verdade com esse nome exato.
      //
      // Familia em aberto ja e coisa deste sistema: e assim que "quero 50 de
      // morango" guarda o 50 enquanto a padaria pergunta qual bolo. Aqui e o
      // mesmo, sem quantidade: o item existe, a etapa dele pergunta o sabor, e
      // a resposta tem onde cair.
      //
      // PERGUNTA DE PRECO NAO ENTRA: quem so pergunta quanto custa cai no galho
      // de cima, que limpa `falouDeOutraEtapa` e nao chega ate aqui.
      // A CATEGORIA DO MARCADOR SO SERVE PRA ROTEAR, E TODA CATEGORIA DA
      // FAMILIA VAI PRA MESMA ETAPA (bolo_festa e bolo_caseiro vao pra bolo,
      // salgado_frito e salgado_assado vao pra salgado). Por isso a primeira
      // serve: ela some no instante em que o cliente escolhe o produto, e
      // marcador com qtd 0 nao entra em conta nenhuma.
      const fam = limpa.falouDeOutraEtapa;
      const cat = categoriasDaFamilia(fam)[0] ?? null;
      const jaTemDaFamilia = estado.itens.some((i) =>
        categoriasDaFamilia(fam).includes(String(i.categoria || "")),
      );
      // PERGUNTAR NAO E PEDIR, E ISSO JA CUSTOU UM PEDIDO INTEIRO.
      //
      // "boa tarde, quanto e a cuca?" virava "0 cuca" no pedido, e o item de
      // quantidade zero travava o fechamento ate o fim da conversa: R$ 218,80
      // ja combinados que nao foram registrados. Isso esta medido em 28/08/2026
      // e tem teste desde entao.
      //
      // Entao o marcador de familia so nasce quando os tres valem:
      //
      //   - a frase nao NOMEIA produto: quem nomeia cai na maquina que ja
      //     existe, que separa pergunta de pedido pelo numero;
      //   - o modelo nao leu a frase como pergunta;
      //   - e nao ha interrogacao escrita.
      // Nome de FAMILIA nao conta como produto nomeado: "um bolo" e a familia,
      // e e justamente o caso que este bloco existe pra resolver. "a coxinha",
      // que e produto de verdade, conta.
      const nomeouProdutoAqui = produtosNaFrase(String(mensagem.texto ?? "")).some(
        (n) => !ehNomeDeFamilia(n),
      );
      const pareceuPergunta =
        Boolean(limpa.perguntou?.sobre) || String(mensagem.texto ?? "").includes("?");
      if (cat && !jaTemDaFamilia && !nomeouProdutoAqui && !pareceuPergunta) {
        estado = {
          ...estado,
          itens: [
            ...estado.itens,
            {
              produto: fam,
              categoria: cat,
              qtd: 0,
              obs: null,
            },
          ],
        };
        rastro.push("ele disse que quer " + fam + " e nao tinha nenhum no pedido; anotei em aberto");
      }
    }

    // SO NA ETAPA DA CONFIRMACAO, E COM O PEDIDO NA TELA DELE.
    //
    // "pode ser" no meio dos docinhos e conversa; "pode ser" embaixo do resumo
    // de R$ 543,00 e ordem de fechar. O que separa os dois e a etapa, e por isso
    // isto e conferido aqui e nao no prompt.
    if (limpa.confirmou && etapaAgora.id === "confirmacao") {
      // SABOR E FORMINHA NAO FECHAM POR PALAVRA. A confirmação so vale quando
      // o item ja tem o que a cozinha precisa. Sem isto, pizza/empadao na
      // etapa da confirmacao (eles nao tem etapa propria) fechavam no "pode
      // confirmar" e a comanda ia sem recheio.
      const aindaFaltaSaborOuForminha =
        saboresQueFaltam(estado.itens).length > 0 ||
        faltaCorDaForminha(estado.itens, estado.forminha);
      if (aindaFaltaSaborOuForminha) {
        rastro.push("confirmou escrevendo mas falta sabor ou forminha; nao fecho");
      } else {
        confirmouEscrevendo = true;
        rastro.push("confirmou escrevendo, sem tocar no botao");
      }
    } else if (limpa.confirmou) {
      // HEDGE: o modelo marca confirmou em vez de anotar. Fechar e so na
      // etapa da confirmacao (e o atalho da oferta, mais abaixo). Aqui a
      // frase ainda aplica os itens; "certo?" nao apaga o pedido.
      rastro.push("modelo marcou confirmou fora da confirmacao; nao fecho, anoto o que a frase trouxe");
    }

    // O CODIGO LE A FRASE, NAO SO O MODELO.
    //
    // Aqui a leitura do modelo e completada pelo que esta escrito com todas as
    // letras na mensagem. E a regra unica que substituiu os resgates avulsos de
    // cor, de topo e de papel de arroz, cada um deles nascido de um defeito ja
    // entregue ao cliente.
    //
    // ISTO SUBIU EM 27/08/2026, E O MOTIVO E QUE COISA SUMIA DO PEDIDO.
    //
    // Ele rodava DEPOIS dos dois blocos abaixo, e os dois saem da funcao com
    // `return`. Entao quem perguntasse e pedisse na mesma mensagem perdia o
    // pedido:
    //
    //     cliente >> quanto e o cento de coxinha? quero 200
    //     padaria >> Salgado frito sai R$ 1,00 a unidade, R$ 100,00 o cento.
    //     no pedido >> nada
    //
    // E nao eram so os itens: data, hora, nome, cor da forminha, tudo o que
    // viesse junto ia embora com o `return`.
    //
    // "Perguntar nao e pedir" continua valendo, e continua sendo o modelo quem
    // separa: a instrucao dele diz, com todas as letras, que pergunta e
    // reclamacao NAO viram item. O que muda e que agora, quando ele devolve os
    // dois, os dois valem.
    // PERGUNTA SEM NUMERO NAO VIRA ITEM. PROMPT PEDE, CODIGO GARANTE.
    //
    // O paragrafo acima apostava que o modelo separaria pergunta de pedido,
    // porque a instrucao dele manda. MEDIDO CONTRA ELE DE VERDADE em
    // 28/08/2026, na primeira mensagem de uma conversa:
    //
    //     cliente >> boa tarde, quanto e a cuca?
    //     no pedido >> 0 cuca, R$ 0,00
    //
    // E o item de quantidade zero travou o fechamento ate o fim da conversa: o
    // pedido inteiro, R$ 218,80 ja combinado, NAO FOI REGISTRADO, porque falta
    // dizer "quantos cuca voce quer".
    //
    // Perguntar virou pedir, que e exatamente o defeito que o bloco logo abaixo
    // existe pra impedir, e o comentario dele diz isso com todas as letras.
    //
    // A regra do numero e o que separa os dois casos sem adivinhar intencao:
    //
    //     "quanto e a cuca?"                   pergunta, sem numero  -> nao entra
    //     "quanto e o cento de coxinha? quero 200"  pergunta COM numero -> entra
    //
    // O segundo e o caso que fez o `aplicar` subir pra ca, e ele continua de pe.
    // QUEM PEDE DESCONTO PRECISA DE UMA RESPOSTA, E ELA E DA EQUIPE.
    //
    // Medido conversando com a producao em 02/09/2026, logo depois de uma
    // reclamacao:
    //
    //   cliente >> quero um desconto no proximo entao
    //   padaria >> Como posso ajudar voce?
    //
    // A resposta de desconto existe desde 29/07 e sai do audio da dona ("quando
    // a pessoa pedir um desconto... a gente ja cobra unidade"), mas dependia de
    // o modelo marcar `perguntou: desconto`, e ele nao marcou.
    //
    // Dinheiro nao pode depender de o modelo lembrar: a palavra esta escrita na
    // frase, e quem decide desconto e gente, nunca a IA.
    if (
      !limpa.perguntou?.sobre &&
      /(^|[^a-z])(desconto|descontinho|abatimento)([^a-z]|$)/i.test(semAc(String(mensagem.texto ?? "")))
    ) {
      limpa.perguntou = { sobre: "desconto" };
      rastro.push("ele falou em desconto; isso e conversa de gente");
    }

    // "QUERO UM DE 2 KG" DEPOIS DE ELA CITAR UM PRODUTO E AQUELE PRODUTO.
    //
    // Medido conversando com a producao em 02/09/2026:
    //
    //   cliente >> voces fazem bolo sem lactose?
    //   padaria >> Fazemos sim: temos bolo 0% lactose, R$ 55,90 o quilo.
    //   cliente >> quero um de 2 kg entao
    //   padaria >> O que voce precisa?        (tres vezes)
    //
    // O "um" e o bolo que ELA acabou de oferecer. Sem nome de produto na frase o
    // modelo nao tem o que anotar, e o pedido nao tinha onde entrar: a conversa
    // ficou repetindo a pergunta com a venda ja feita.
    //
    // E a mesma regra do "Sim" digitado e da resposta do peso: quem da sentido a
    // resposta e a fala que ACABOU de sair. So vale quando ela citou UM produto
    // (numa lista de opcoes o cliente precisa dizer qual) e quando ele deu
    // quantidade ou peso, que e o que separa "quero um" de conversa solta.
    //
    // SAIU EM 03/09/2026. O bloco lia a ultima fala da padaria por regex pra
    // descobrir qual produto o "um" era. O modelo agora ve a conversa
    // ("Fazemos sim: temos bolo 0% lactose") e devolve o item com o peso.

    // RECLAMACAO NAO VIRA PEDIDO.
    //
    // Medido conversando com a producao em 02/09/2026:
    //
    //   cliente >> fiz um pedido semana passada e veio errado
    //   padaria >> Sinto muito. Vou chamar uma pessoa da equipe.
    //   cliente >> veio faltando 20 coxinha
    //   rastro  >> achei na frase e anotei: coxinha
    //
    // O cliente estava dizendo o que FALTOU no pedido de semana passada, e a
    // padaria anotou aquilo como pedido novo. Ele reclama e sai devendo.
    //
    // A guarda que trata reclamacao ja existia, e roda DEPOIS de a leitura ser
    // aplicada: o item ja tinha entrado quando ela decidiu que era queixa. Aqui
    // e antes, que e onde precisa ser.
    //
    // O QUE ELE PEDE DEPOIS CONTINUA VALENDO: isto vale so pro turno da queixa.
    // Na mensagem seguinte, "quero 100 coxinha" entra normal, e a conversa
    // segue com a equipe ja avisada.
    // O QUE SEPARA A QUEIXA DO PEDIDO E O VERBO.
    //
    // "veio faltando 20 coxinha" descreve o que faltou LA ATRAS; "quero 100
    // coxinha" pede agora. Os dois trazem produto e numero, entao contar item
    // nao separa: um teste que ja existia cobra que pedido com o modelo errando
    // a situacao continue valendo, e ele pegou esta guarda na primeira versao.
    //
    // A lista e de VERBO, e nao de produto nem de preco: nada aqui decide o que
    // a casa vende.
    //
    // SEM LISTA DE VERBOS (03/09/2026). Reclamacao e cancelamento vao pra
    // equipe de qualquer jeito; o que vier de item na mesma frase e assunto
    // dessa conversa com gente, e nao pedido novo anotado calado. Regra do
    // dono: nada pode ser lista minha.
    // E A SITUACAO GANHA DO ITEM. Medido contra o modelo com a conversa em
    // 03/09/2026 (3 de 3): "veio faltando 20 coxinha" volta com situacao
    // "reclamacao" E o item de 20 coxinhas (e o conteudo da queixa); "quero 2
    // pizzas pra festa" volta so com o item, sem situacao. O modelo com
    // contexto nao chama pedido de reclamacao, entao quando ele diz queixa, e
    // queixa: o item vai pra equipe no motivo, e nao pro pedido.
    const queixaSemPedido = limpa.situacao === "reclamacao" || limpa.situacao === "cancelar";

    const lida = juntarComAFrase(limpa, String(mensagem.texto ?? ""));

    // A LIMPEZA E DEPOIS DO LEITOR DA FRASE, e nao antes.
    //
    // Limpando so a leitura do modelo, o leitor da frase reconstruia o item na
    // sequencia: "20 coxinha" esta escrito ali, e ele faz o trabalho dele. O
    // resultado era o mesmo de antes, com um rastro dizendo que tinha limpado.
    if (queixaSemPedido && lida.itens?.length) {
      rastro.push(
        "situacao " + limpa.situacao + ": nao anotei " +
          lida.itens.map((x) => x.produto).join(", ") + " como pedido novo",
      );
      lida.itens = [];
    }
    leituraDesteTurno = lida;
    // PERGUNTA SEM NUMERO NAO VIRA ITEM. O MODELO HEDGEANDO TAMBEM NAO.
    //
    // O modelo devolve `{}` ou `perguntou` quando deveria anotar. A frase
    // "quero 50 coxinha" tem o produto e o numero: o leitor ja colocou na
    // leitura. Sem o numero, "quanto e a coxinha?" (com ? ou com perguntou)
    // nao inventa linha. Ponto de interrogacao e do mundo, nao lista minha.
    const falaCru = String(mensagem.texto ?? "");
    const soPerguntou =
      Boolean(lida.perguntou?.sobre) || /\?/.test(falaCru);
    if (soPerguntou && lida.itens?.length) {
      const comNumero = lida.itens.filter((i) => Number(i.qtd) > 0);
      if (comNumero.length !== lida.itens.length) {
        rastro.push(
          "pergunta sem numero nao virou item: " +
            lida.itens.filter((i) => !(Number(i.qtd) > 0)).map((i) => i.produto).join(", "),
        );
      }
      lida.itens = comNumero.length ? comNumero : undefined;
    }
    estado = aplicar(estado, lida, etapaAgora.id, falaCru, rastro);

    // ELE PEDIU GENTE. O modelo vazio nao impede: a frase basta.
    if (pediuPraFalarComGente(falaCru)) {
      rastro.push("ele pediu pra falar com gente; chamei a equipe");
      return {
        fala: {
          // A FRASE SAI DO `avisoDeEspera`, E NAO DAQUI.
          //
          // Estava chumbada, e prometia atendimento agora a qualquer hora. As
          // 23h o cliente lia "vou chamar alguem da equipe" e ninguem vinha ate
          // de manha. O `avisoDeEspera` foi escrito exatamente pra isso, em
          // `lib/padaria-aberta.ts`, e nunca tinha sido ligado: fechada, ele
          // avisa que a equipe responde na abertura, sem prometer hora.
          //
          // Achado em 30/08/2026 alargando o detector de codigo fantasma, que
          // varria quatro pastas escritas a mao e nao enxergava `lib/` na raiz.
          texto: "Claro. " + avisoDeEspera(),
          botoes: [],
          cardapio: null,
          podeReescrever: false,
        },
        estado: { ...estado, insistiu: 0, ultimaFala: "Claro. " + avisoDeEspera() },
        etapa: etapaAgora.id,
        rastro,
        chamouIA,
        confirmouEscrevendo: false,
        precisaHumano: true,
        motivoHumano: "O cliente pediu pra falar com alguém da padaria.",
      };
    }

    // ---------------------------------------- A CONVERSA NAO E UM PEDIDO
    //
    // A ROTA C, e ela vem ANTES de tudo: reclamacao, cancelamento e pergunta
    // sobre pedido ja feito nao sao pedido nenhum.
    //
    // Ate 24/08/2026 quem escrevia "meu pao veio queimado" caia no fluxo e a
    // Dora tentava montar uma encomenda. E o momento em que o cliente esta
    // bravo e a IA esta oferecendo docinho.
    //
    // Reclamacao e cancelamento sao SEMPRE da equipe: mexem com dinheiro, com
    // producao que talvez ja tenha comecado, e com a cara da padaria no bairro.
    //
    // Pedido misturado NAO e situacao. O modelo, vendo festa e pizza na mesma
    // frase, devolvia reclamacao ou perguntou.outro e o painel acendia
    // "Precisa de voce" sem ninguem ter pedido gente. Se a frase tem produto,
    // a leitura ja anotou: segue o pedido.
    // RECLAMACAO QUASE SEMPRE CITA O PRODUTO, E ISSO NAO A TRANSFORMA EM PEDIDO.
    //
    // Medido conversando com o servidor em 31/08/2026:
    //
    //   cliente >> o pedido que retirei ontem veio com salgado queimado
    //   padaria >> Bom dia, tudo bem? Como posso ajudar?
    //
    // O cliente reclamou e ouviu uma saudacao. Pior: o modelo tinha classificado
    // certo, e o codigo descartou a classificacao EM SILENCIO, porque a palavra
    // "salgado" esta na frase e a guarda tratava produto citado como pedido.
    //
    // Nao havia nem rastro: a linha "situacao: ..." so e escrita DENTRO do
    // bloco, entao de fora parecia que o modelo nao tinha lido nada. Passei um
    // tempo achando que era falha do modelo.
    //
    // A guarda continua existindo pelo motivo que ela nasceu: o modelo, vendo
    // festa e pizza na mesma frase, devolvia "reclamacao" e o painel acendia
    // "Precisa de voce" sem ninguem ter pedido gente. So que naquele caso ele
    // devolve ITENS junto, e e isso que separa um do outro. Frase que so
    // MENCIONA um produto, sem pedir nenhum, nao e pedido.
    //
    // DESDE 03/09/2026 SO O ITEM PEDIDO DESMENTE A SITUACAO. Mencionar um
    // produto ("meu pedido de coxinha ta pronto?") nao e pedido, e descartar a
    // situacao por isso, em silencio, era o modelo acertando e o codigo comendo.
    const pediuItemNesteTurno = (lida.itens ?? []).length > 0;
    if (limpa.situacao && !pediuItemNesteTurno) {
      const r = respostaDaSituacao(
        limpa.situacao,
        estado.itens.length > 0 || Boolean(estado.dados.data),
        estado.insistiu ?? 0,
      );
      rastro.push("situacao: " + limpa.situacao + (r.precisaHumano ? "; chamei a equipe" : ""));
      return {
        fala: { texto: r.texto, botoes: [], cardapio: null, podeReescrever: false },
        // Fora do assunto conta como insistencia: a segunda vez chama gente.
        estado: {
          ...estado,
          insistiu: limpa.situacao === "fora_do_assunto" ? (estado.insistiu ?? 0) + 1 : 0,
          ultimaFala: r.texto,
        },
        etapa: etapaAgora.id,
        rastro,
        chamouIA,
        confirmouEscrevendo: false,
        precisaHumano: r.precisaHumano,
        // O PAINEL PRECISA SABER DO QUE SE TRATA, e nao so que alguem chamou.
        //
        // Medido em producao em 31/08/2026: um cliente reclamou, o handoff
        // acendeu e o motivo ficou VAZIO. Foi a mesma queixa que ele fez do
        // "sem lactose": "em nenhum lugar tem, ngm sabe". A frase que o cliente
        // ouviu vai junto, porque e ela que a equipe precisa continuar.
        motivoHumano: r.precisaHumano
          ? (limpa.situacao === "reclamacao"
              ? "Reclamação do cliente"
              : limpa.situacao === "cancelar"
                ? "O cliente quer cancelar"
                : "Pergunta sobre um pedido já feito") +
            ". Eu respondi: \"" + r.texto + "\""
          : null,
      };
    }

    // ------------------------------------------ ELE SO PERGUNTOU: RESPONDE
    //
    // Terceiro roteiro, o da informacao. A resposta sai do codigo com o dado da
    // casa (preco do cardapio, horario, endereco) e NADA e anotado no pedido:
    // perguntar nao e pedir. No sistema antigo, "0% lactose nao e sem acucar
    // ne?" virou um bolo 0% lactose no pedido da cliente.
    //
    // A conversa nao sai do lugar: ele continua na mesma etapa, e a proxima
    // mensagem dele segue de onde parou.
    // PEDIDO COM NUMERO NAO VIRA SO CONFIRMACAO.
    //
    // O modelo hedgeia: devolve perguntou (ou confirmou) e esquece o item.
    // A frase ja anotou "50 coxinha". Se a gente sair daqui respondendo preco
    // e fingindo que nao anotou, a padaria fala "voce quer coxinha, certo?"
    // e o pedido fica vazio no turno seguinte quando a leitura nova nao
    // devolve o item de novo.
    //
    // Perguntar continua nao sendo pedir: sem quantidade na frase, o bloco
    // de cima tirou a linha e este return responde a pergunta.
    const anotouPedidoNesteTurno = (lida.itens ?? []).some((i) => Number(i.qtd) > 0);
    if (limpa.perguntou?.sobre && !anotouPedidoNesteTurno) {
      // "QUANTO FICA?" NO MEIO DO PEDIDO E O TOTAL DELE, NAO TABELA DE PRECO.
      //
      // Teste da Kemilly: ela perguntou "quanto fica?" com o pedido montado e a
      // padaria respondeu perguntando a forma de pagamento. A pergunta caiu no
      // vazio porque nao tinha familia junto.
      // O PRODUTO QUE ELE ESCREVEU GANHA DO PALPITE DO MODELO.
      //
      // A instrucao pede `perguntou.sobre = preco (com familia)`, e o modelo
      // preenche a familia com o que ELE acha. Medido numa conversa de verdade
      // em 28/08/2026, na primeira mensagem:
      //
      //     cliente >> boa tarde, quanto e a cuca?
      //     padaria >> Bolo de festa sai de R$ 46,90 a R$ 55,90 o quilo...
      //
      // Ele classificou a cuca como bolo. A cuca custa R$ 22,90 o quilo e a
      // resposta certa existe: quem recebe "cuca" responde certo. O que errou
      // foi a palavra que chegou ali.
      //
      // O leitor da frase sabe o que o cliente NOMEOU, e agora ele alcanca os 86
      // produtos da casa. Quando ele acha um, esse manda; quando nao acha
      // ("quanto e o cento de salgado?", que e familia e nao produto), vale o
      // que o modelo leu.
      const nomeadoNaFrase = produtosNaFrase(String(mensagem.texto ?? ""))[0];
      if (nomeadoNaFrase) limpa.perguntou = { ...limpa.perguntou, familia: nomeadoNaFrase };

      // "QUAIS TEM?" DEPOIS DE UMA ESCOLHA E PERGUNTA PELAS OPCOES, E NAO PELO PRECO.
      //
      // Medido na conversa dele de 02/09/2026:
      //
      //   padaria >> Qual salgado voce quer?
      //   cliente >> quais tem?
      //   padaria >> Do jeito que esta, seu pedido fica em R$ 77,65.
      //
      // Ele perguntou QUAIS existem e ouviu o total do pedido. O modelo leu
      // aquilo como pergunta de preco, e o codigo obedeceu.
      //
      // QUEM DESEMPATA E O CONTEXTO, E NAO A FRASE. A padaria acabou de fazer
      // uma pergunta de escolha; a resposta natural a "quais tem?" ali e a
      // lista, e ela ja esta montada na propria etapa. Nao ha lista de palavras
      // aqui: o sinal e a ultima fala ter sido uma escolha e ele nao ter nomeado
      // nenhum produto na pergunta ("quanto e a coxinha?" nomeia, e segue pro
      // preco, que e o certo).
      //
      // Deixar a etapa responder tambem manda a peca do cardapio junto, que e o
      // que o cliente precisa pra escolher.
      const ultimaFoiEscolha = /qual|quais|quer\?/i.test(semAc(String(estado.ultimaFala ?? "")));
      const perguntouAsOpcoes =
        ultimaFoiEscolha && !nomeadoNaFrase && !limpa.perguntou.familia &&
        /\b(quais|quais sao|o que tem|que tem|opcoes|tipos)\b/.test(semAc(String(mensagem.texto ?? "")));

      const perguntouOTotal =
        !perguntouAsOpcoes &&
        limpa.perguntou.sobre === "preco" && !limpa.perguntou.familia && estado.itens.length > 0;
      let resposta = perguntouOTotal
        ? {
            texto:
              "Do jeito que está, seu pedido fica em " +
              brl(
                Number(
                  motorPadrao.cotarPorItens(
                    paraOMotor(estado.itens),
                  ).total || 0,
                ),
              ) + ".",
            precisaHumano: false,
          }
        : perguntouAsOpcoes
          ? null
          : respostaDeInformacao(limpa.perguntou);
      if (perguntouAsOpcoes) {
        // Cai fora daqui SEM responder: a etapa da vez monta a pergunta com as
        // opcoes e manda a peca do cardapio junto, que e o que ele pediu.
        rastro.push("ele perguntou quais opcoes existem; deixei a etapa responder com a lista");
        // E A PERGUNTA VOLTA, porque ele NAO a ignorou: ele pediu a lista dela.
        //
        // "perguntado uma vez, perguntado pra sempre" existe pra a padaria nao
        // insistir com quem mudou de assunto. Quem responde "quais tem?" nao
        // mudou de assunto: esta respondendo, e precisa das opcoes pra escolher.
        //
        // Sem isto a etapa se dava por resolvida e a conversa PULAVA:
        //
        //   padaria >> Qual salgado voce quer?
        //   cliente >> quais tem?
        //   padaria >> Quer levar docinho ou bolo junto?
        //
        // O `insistiu` continua protegendo contra laco: quatro vezes a mesma
        // pergunta sem ele responder nada continua chamando a equipe.
        estado = {
          ...estado,
          etapasJaPerguntadas: (estado.etapasJaPerguntadas ?? []).filter(
            (x) => x !== etapaAgora.id && !String(x).startsWith(etapaAgora.id + ":"),
          ),
        };
      }
      if (resposta) {
        rastro.push("ele perguntou sobre " + limpa.perguntou.sobre + "; respondi sem anotar nada");

        // PERGUNTOU POR UMA RESTRICAO QUE A CASA FAZ? DIZ QUE FAZ, E QUANTO E.
        //
        // Medido conversando com a producao em 31/08/2026:
        //
        //   cliente >> oi, voces fazem bolo sem lactose?
        //   padaria >> Bolo de festa sai de R$ 46,90 a R$ 55,90 o quilo...
        //
        // Ela respondeu o preco do bolo e nao respondeu a pergunta. A casa FAZ:
        // o 0% lactose e sabor de bolo de festa da faixa C. Quem pergunta por
        // restricao pergunta ANTES de tudo, e vai embora com o silencio.
        //
        // O preco sai do motor, igual em todo o resto: quem escreve numero aqui
        // e o codigo, nunca a IA.
        const oQueACasaFaz = produtoDaRestricaoNaFrase(String(mensagem.texto ?? ""));
        if (oQueACasaFaz) {
          const oQuilo = Number(
            motorPadrao.cotarPorItens([{ item: oQueACasaFaz, qtd: 1 }]).linhas?.[0]?.subtotal ?? 0,
          );
          resposta = {
            ...resposta,
            texto:
              "Fazemos sim: temos " + oQueACasaFaz +
              (oQuilo > 0 ? ", " + brl(oQuilo) + " o quilo" : "") + "." +
              (resposta.texto ? " " + resposta.texto : ""),
          };
          rastro.push("ele perguntou por restricao que a casa faz: " + oQueACasaFaz);
        } else {
          // A RESTRICAO QUE A CASA NAO FAZ TAMBEM PRECISA DE RESPOSTA.
          //
          // "voces fazem bolo sem gluten?" ouvia so a tabela de preco do bolo, e
          // a pergunta ficava no ar. A frase e a mesma que o pedido ja usa, e ela
          // nao promete nada: quem confirma e a equipe.
          const naoFaz = restricoesQueACasaNaoFaz(String(mensagem.texto ?? ""));
          const aviso = avisoDaRestricao(naoFaz);
          if (aviso) {
            resposta = {
              texto: aviso + (resposta.texto ? String.fromCharCode(10, 10) + resposta.texto : ""),
              precisaHumano: true,
            };
            rastro.push("ele perguntou por restricao que a casa nao faz: " + naoFaz.join(", "));
          }
        }
        // PERGUNTOU POR UM SABOR QUE O PRODUTO NAO TEM? DIZ QUAL ELE E.
        //
        // Medido conversando com o servidor em 31/08/2026:
        //
        //   cliente >> tem coxinha de camarao?
        //   padaria >> Coxinha sai de R$ 1,00 a R$ 1,25 a unidade.
        //
        // Ele perguntou SE TEM e ouviu o preco. A resposta certa esta no
        // cardapio: coxinha e de frango, e camarao a casa nao faz. O caminho da
        // informacao so recebe a familia ("coxinha"), e o sabor da pergunta se
        // perdia antes de chegar nele.
        //
        // A mesma frase que o pedido ja usa quando ele PEDE o sabor errado
        // ("A gente faz coxinha de frango"), agora tambem quando ele PERGUNTA.
        // O preco continua vindo atras: quem pergunta por um sabor costuma
        // querer saber o preco tambem.
        //
        // O RESOLVEDOR PRECISA DO PEDACO DO PRODUTO, e nao da pergunta inteira:
        // `identificarProduto("tem coxinha de camarao?")` devolve a frase toda
        // como se fosse o nome. Aqui a pergunta ja trouxe a familia ("coxinha"),
        // entao basta cortar dali pra frente e tirar a pontuacao.
        const familiaPerguntada = semAc(String(limpa.perguntou.familia ?? ""));
        const textoCru = semAc(String(mensagem.texto ?? ""));
        const onde = familiaPerguntada ? textoCru.indexOf(familiaPerguntada) : -1;
        const soOProduto = onde >= 0 ? textoCru.slice(onde).replace(/[?!.,;]+$/, "").trim() : "";
        const quemEle = soOProduto ? identificarProduto(soOProduto) : { produto: "", recheio: null };
        const naoTem = quemEle.recheio ? recheioQueNaoExiste(quemEle.produto, quemEle.recheio) : null;
        if (naoTem) {
          rastro.push("ele perguntou por " + quemEle.produto + " de " + quemEle.recheio + ", que a casa nao faz");
          resposta = {
            ...resposta,
            texto: "A gente faz " + quemEle.produto + " de " + naoTem + ". " + resposta.texto,
          };
        }
        const peca = limpa.perguntou.familia ? pecaDoCardapio(limpa.perguntou.familia) : null;
        const famPerg = familiaDoQueEleNomeou(String(mensagem.texto ?? ""));
        const famAssunto = estado.assunto === "pecas_do_bolo" ? "bolo" : estado.assunto;
        if (famPerg && famAssunto && famPerg !== famAssunto) {
          estado = { ...estado, assunto: null };
        }
        estado = { ...estado, insistiu: 0, ultimaFala: resposta.texto };
        return {
          fala: { texto: resposta.texto, botoes: [], cardapio: peca, podeReescrever: false },
          estado,
          etapa: etapaAgora.id,
          rastro,
          chamouIA,
          confirmouEscrevendo: false,
          precisaHumano: resposta.precisaHumano,
          // O PAINEL PRECISA SABER DE QUE PERGUNTA SE TRATA.
          //
          // Medido em 31/08/2026, conversando: o cliente pediu a chave pix, a
          // IA chamou a equipe e `handoff_motivo` ficou VAZIO. Mesmo buraco que
          // eu tinha fechado na reclamacao, num caminho diferente: aqui e a
          // resposta de INFORMACAO que chama gente (pix sem chave cadastrada,
          // entrega, desconto).
          //
          // Vai a pergunta e a frase que o cliente ouviu, porque e essa conversa
          // que a equipe vai continuar. Sem isso, quem abre o painel ve "precisa
          // de voce" e nao sabe se e dinheiro, entrega ou reclamacao.
          motivoHumano: resposta.precisaHumano
            ? "Pergunta sobre " + String(limpa.perguntou.sobre) +
              ". Eu respondi: \"" + resposta.texto + "\""
            : null,
        };
      }
    }


    // A FOTO QUE ELE MANDOU JA E O TEMA.
    //
    // Regra do dono, 24/08/2026: "topo de bolo e papel de arroz aceitam imagens
    // e texto". Quem manda a foto do Homem Aranha ja disse o tema, e insistir
    // depois da foto e o tipo de coisa que faz o cliente achar que ninguem
    // olhou. Aconteceu no teste da Kemilly: ela mandou a imagem e a padaria
    // perguntou o tema de novo.
    //
    // A foto ja fica guardada no pedido pela rota do WhatsApp; aqui so se anota
    // que o tema veio por ela, pra conversa seguir.
    //
    // A FOTO DEPOIS DO PIX E O COMPROVANTE, E NAO O TEMA.
    //
    // Buraco que eu abri em 01/09/2026, no mesmo dia em que a chave pix entrou:
    // a padaria passou a dizer "me manda o comprovante aqui que eu anexo no
    // pedido", e nao sabia receber.
    //
    //   padaria >> A chave pix e o CNPJ ... me manda o comprovante aqui
    //   cliente >> (foto do comprovante)
    //   pedido  >> tema: conforme a foto que ele mandou
    //   padaria >> Quer levar docinho ou bolo junto?
    //
    // Quem acabou de pagar ouvia uma oferta, e o comprovante virava tema de bolo
    // na comanda da cozinha.
    //
    // Quem da sentido a foto e a frase que acabou de sair: se a padaria pediu o
    // comprovante, a foto que chega e o comprovante. E dinheiro, entao quem
    // confere e gente: a IA nao diz que o pagamento entrou.
    //
    // O GATILHO E O MODELO (03/09/2026), que ve a conversa e devolve
    // `comprovante: true`. A regex sobre a ultima fala fica so como rede: ela
    // nunca bloqueia nada, so acrescenta.
    if (
      falaDeFotoRecebida(mensagem.texto) &&
      (leituraDesteTurno?.comprovante === true || /comprovante/i.test(String(estado.ultimaFala || "")))
    ) {
      ehComprovante = true;
      rastro.push("a foto chegou depois do pedido de comprovante: e comprovante, nao tema");
    } else if (!estado.tema && falaDeFotoRecebida(mensagem.texto)) {
      estado = { ...estado, tema: "conforme a foto que ele mandou" };
      rastro.push("a foto virou o tema da peca");
    }
  }

  // ------------------------------------------- a base, calculada e aceita
  //
  // Duas coisas que o primeiro teste com conversa real mostrou faltando:
  //
  //   a base saia com "0 docinhos e 0 kg de bolo" porque eu pedia ao motor sem
  //   dizer quais familias entram;
  //
  //   e aceitar a base nao anotava nada, entao o pedido continuava vazio
  //   depois de um aceite de R$ 418,80 (a conversa do Sandro, de 22/08).
  if (estado.pessoas && !estado.base) {
    estado = { ...estado, base: calcularBase(estado) };
    if (estado.base) {
      rastro.push(
        "base: " + estado.base.salgados + " salgados, " + estado.base.docinhos +
          " docinhos, " + estado.base.boloKg + " kg de bolo",
      );
    }
  }
  // ACEITAR A PROPOSTA NAO ESCOLHE SABOR NENHUM.
  //
  // Ate 23/08/2026 aceitar virava pedido pronto: o codigo pegava os cinco
  // salgados e os quatro docinhos mais pedidos e dividia a conta entre eles. O
  // dono viu isso no teste dele e chamou pelo nome: "escolheu os salgadinhos e
  // os docinhos sortidos por conta propria". A conversa pulava direto pro bolo
  // e o cliente nunca via o cardapio.
  //
  // A proposta diz QUANTO (300 salgados, 150 docinhos, 3 kg de bolo). QUAL e
  // dele, e e por isso que existem as etapas do salgado e do docinho, cada uma
  // com o cardapio junto.
  //
  // O que a base faz agora e guardar o total. Quando ele escolher os sabores
  // sem dizer quantidade, o codigo reparte esse total entre o que ele escolheu.
  // O LUGAR VAZIO SAI QUANDO O CLIENTE ESCOLHE DE VERDADE.
  //
  // O marcador de familia ("salgado", "docinho") nasce quando ele diz que quer
  // aquilo sem escolher o tipo, pra etapa ter o que perguntar. Depois que ele
  // escolhe, o marcador nao e mais lugar vazio: ele vira uma linha a mais.
  //
  // Medido conversando com a producao em 02/09/2026, e custou 64 salgados:
  //
  //   base    >> 250 salgados (ele tinha pedido 50 a mais)
  //   cliente >> coxinha, bolinha de queijo e risoles de carne
  //   rastro  >> reparti 250 de salgado entre 4 escolha(s)
  //   pedido  >> 62 + 62 + 62 = 186 salgados
  //
  // As tres escolhas dele mais o marcador viraram quatro, e o rateio deu a
  // quarta parte pra uma linha que nao existe. Nos docinhos foi igual: 150
  // divididos por tres, com dois docinhos escolhidos.
  //
  // Defeito meu, de 01/09, quando o marcador passou a nascer em toda familia
  // que o cliente cita.
  {
    const familiasComEscolha = new Set(
      estado.itens
        // Escolha de verdade e a que tem QUANTIDADE: item em zero ainda esta
        // sendo montado, e nesse meio-tempo o lugar vazio da familia continua
        // sendo o que segura a pergunta da etapa.
        .filter((i) => !ehNomeDeFamilia(i.produto) && Number(i.qtd) > 0)
        .map((i) => String(i.categoria || "")),
    );
    const antes = estado.itens.length;
    estado.itens = estado.itens.filter(
      (i) =>
        !ehNomeDeFamilia(i.produto) ||
        !categoriasDaFamilia(i.produto).some((c) => familiasComEscolha.has(c)),
    );
    if (estado.itens.length !== antes) {
      rastro.push("ele escolheu de verdade; tirei o lugar vazio da familia do pedido");
    }
  }

  estado = repartirABase(estado, rastro, mensagem.texto);

  // ------------------------------------------- as pecas do bolo viram pedido
  //
  // PAPEL DE ARROZ TEM PRECO DE TABELA; TOPO NAO TEM.
  //
  // Papel de arroz e produto: o motor cota, entra na conta e sai na comanda como
  // linha. Topo nao esta no motor de proposito, porque cada peca e orcada pela
  // equipe. Se ele virasse item, a conta ficaria com um produto de valor zero e
  // a comanda imprimiria duas vezes a mesma coisa, que e um defeito que ja
  // aconteceu aqui.
  //
  // Entao topo vira OBSERVACAO do bolo, que e onde a cozinha le o que escrever
  // na peca, e o valor fica pendente pra dona lancar na tela.
  // O PAPEL DE ARROZ E UM POR BOLO, E NUNCA ZERO.
  //
  // Medido em 30/08/2026: o cliente disse "quero sim o papel de arroz" e o
  // pedido ficou com `0 ~ papel de arroz`. O leitor da frase acha o produto
  // escrito com todas as letras e anota SEM quantidade (ele nao disse um
  // numero, e nem diria), entao a linha nasce com zero. O injetor logo abaixo
  // via que a linha ja existia e nao mexia.
  //
  // O dinheiro estava protegido: o `fechar.ts` nao fecha com quantidade zero.
  // Mas o efeito e pior pra venda que cobrar errado -- a padaria passa a
  // perguntar "quantos papel de arroz voce quer?" e a conversa NUNCA fecha,
  // porque ninguem responde isso. Medido: o pedido inteiro morreu ali.
  //
  // Papel de arroz e peca do bolo, e peca de bolo e uma. Nao e escolha do
  // cliente, e a natureza do produto.
  const papelSemQuantidade = estado.itens.findIndex(
    (i) => /papel de arroz/i.test(i.produto) && !(Number(i.qtd) > 0),
  );
  if (estado.pecas?.papelDeArroz === true && papelSemQuantidade >= 0) {
    estado = {
      ...estado,
      itens: estado.itens.map((i, n) => (n === papelSemQuantidade ? { ...i, qtd: 1 } : i)),
    };
    rastro.push("o papel de arroz estava com quantidade zero; e um por bolo");
  }
  if (estado.pecas?.papelDeArroz === true && !estado.itens.some((i) => /papel de arroz/i.test(i.produto))) {
    estado = {
      ...estado,
      itens: [...estado.itens, { produto: "papel de arroz", categoria: "papel_de_arroz", qtd: 1, obs: null }],
    };
    rastro.push("papel de arroz virou item do pedido");
  }
  // CADA PECA LEVA A SUA PROPRIA OBSERVACAO, NUM FORMATO SO.
  //
  // O topo vira observacao do BOLO, porque nao e item; o papel de arroz tem
  // linha propria, que existe e tem preco, e leva a mesma descricao de arte.
  //
  // ATE 31/08/2026 ISTO MONTAVA O TEXTO NA MAO, e o pedido de festa de 30/08
  // mostrou o preco disso. O texto saia com dois separadores misturados
  // ("Gabriel Lucas | 12 anos | Topo: tema foto de referencia, Gabriel Lucas,
  // 12 anos") e cada consumidor cortava num deles: a cozinha imprimiu o nome
  // tres vezes, e o painel da equipe mostrou o campo do aniversariante VAZIO,
  // porque a tela procura "nome X" e aqui o nome saia pelado.
  //
  // Agora quem escreve e quem le sao o mesmo par de funcoes, e o teste
  // `a-observacao-do-bolo-tem-um-formato-so.cjs` faz o caminho de ida e volta.
  const escritoDito =
    estado.escrito && !/^(nada|nenhum|nao|sem nada|so o desenho)/i.test(estado.escrito)
      ? estado.escrito
      : null;
  const semNadaEscrito = Boolean(estado.escrito) && !escritoDito;
  const embalagem: Embalagem | null =
    estado.prato === "aberto" ? "prato aberto" : estado.prato ? "caixa com tampa" : null;

  // O QUE JA ESTA GRAVADO SO PERDE PRA UM VALOR NOVO, nunca pra um vazio. O
  // carimbo roda a cada mensagem, e sem isto a segunda volta da conversa
  // apagaria o tema que o cliente deu na primeira.
  const carimbar = (acharCategoria: (c: string) => boolean, ehOBolo: boolean) => {
    const i = estado.itens.findIndex((x) => acharCategoria(String(x.categoria || "")));
    if (i < 0) return;
    const velho = lerObs(estado.itens[i].obs);
    const resto = [...(velho.resto ?? [])];
    if (semNadaEscrito && !resto.includes("sem nada escrito")) resto.push("sem nada escrito");
    const texto = escreverObs({
      tema: estado.tema ?? velho.tema ?? null,
      nome: estado.topoNome ?? velho.nome ?? null,
      idade: estado.topoIdade ?? velho.idade ?? null,
      escrito: escritoDito ?? velho.escrito ?? null,
      // O topo mora na observacao do bolo. O papel de arroz NAO: ele e linha
      // com preco, e a linha e a verdade. Escrever nos dois lugares foi o que
      // deixou a tela e o pedido discordando.
      topo: ehOBolo ? estado.pecas?.topo === true || velho.topo === true : false,
      papelDeArroz: false,
      embalagem: ehOBolo ? embalagem ?? velho.embalagem ?? null : null,
      resto,
    });
    if (texto === String(estado.itens[i].obs ?? "")) return;
    const itens = [...estado.itens];
    itens[i] = { ...itens[i], obs: texto || null };
    estado = { ...estado, itens };
    rastro.push("anotei na comanda: " + texto);
  };
  carimbar((c) => c.startsWith("bolo"), true);
  if (estado.pecas?.papelDeArroz === true) carimbar((c) => c === "papel_de_arroz", false);

  // "dois bolos", "2 bolos", "3 bolos de 1 kg" contam bolos. "2,5 kg de bolo",
  // "tres quilos" dizem o peso de UM bolo. So o primeiro grupo vira dois bolos.
  function pediuVariosBolos(fala: string): boolean {
    const t = semAc(fala);
    const porExtenso = "(dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)";
    // A BARRA PRECISA SER DOBRADA DENTRO DE ASPAS, E AQUI ELA NAO ERA.
    //
    // Estava assim:
    //
    //     new RegExp("(?:[2-9][0-9]*|" + porExtenso + ")\s+bolos?\b")
    //
    // Dentro de uma string, `\s` vira a LETRA "s" e `\b` vira o byte de
    // backspace. A expressao que nascia era:
    //
    //     (?:[2-9][0-9]*|(dois|duas|tres|...))s+bolos?
    //
    // e ela nao casa com nada: "dois bolos", "2 bolos" e "tres bolos de 1 kg"
    // davam todos FALSO. Quem pedia dois bolos levava um.
    //
    // Os dois detectores do repositorio nao pegam este caso, e vale registrar
    // por que: eles procuram byte de controle no ARQUIVO, e aqui o arquivo tem
    // dois caracteres normais (barra e "s"). O estrago so existe em tempo de
    // execucao, quando o JavaScript monta a string.
    //
    // Achado lendo linha por linha em 27/08/2026.
    const contagem = new RegExp("(?:[2-9][0-9]*|" + porExtenso + ")\\s+bolos?\\b");
    if (!contagem.test(t)) return false;
    // "2 bolos de 1 kg" e contagem. "2 kg de bolo" nao casa acima, entao ok.
    return true;
  }

  // Tira qualquer "misto: ..." que ja esteja na observacao, pra nao empilhar.
  // CORTA NA VIRGULA E NA BARRA, PORQUE OS DOIS EXISTEM GRAVADOS.
  //
  // Isto cortava so na barra, e o "misto:" anterior costuma estar colado com
  // VIRGULA. Medido no pedido real do Alessandro, impresso na padaria em
  // 31/08/2026:
  //
  //   gravado  "biz, misto: bolo laka e bolo biz | misto: bolo biz e bolo laka"
  //   comanda  > misto: bolo laka e bolo biz
  //            > misto: bolo biz e bolo laka
  //
  // A cozinha leu a mesma coisa duas vezes, com os sabores em ordem trocada,
  // como se fossem dois recados diferentes. O limpador via so o segundo, porque
  // o primeiro estava dentro do pedaco "biz, misto: ...".
  //
  // Terceira vez que dois separadores no mesmo texto custam um defeito neste
  // projeto. Quem corta agora corta nos dois, igual ao cupom e ao `lerObs`.
  const semMisto = (obs?: string | null) =>
    String(obs ?? "")
      .split(/[,|]/)
      .filter((p) => p.trim() && !/^misto\s*:/i.test(p.trim()))
      .map((p) => p.trim())
      .join(", ") || null;

  // ------------------------------------------- MEIA A MEIA E UMA PIZZA SO
  //
  // Medido conversando com a producao em 02/09/2026:
  //
  //   cliente >> quero uma pizza inteira meio calabresa meio frango com catupiry
  //   modelo  >> 1x pizza [calabresa] ;; 1x pizza [frango com catupiry]
  //   pedido  >> 2 pizzas inteiras = R$ 240,00
  //
  // O modelo le "meio X meio Y" ao pe da letra e devolve duas. Quem sabe que
  // isso e UMA pizza com dois sabores e a casa, nao ele: e o mesmo caso do bolo
  // misto, com a diferenca de que na pizza o preco NAO muda com o sabor.
  //
  // R$ 120,00 a mais num pedido de R$ 120,00, e o cliente so descobre no resumo.
  // Este e o mesmo prejuizo que o comentario do bolo misto ja registrava, agora
  // pelo outro lado: la o defeito era juntar demais, aqui e nao juntar.
  //
  // SO COM A PALAVRA NA FRASE. Quem pede "duas pizzas, uma de calabresa e uma de
  // frango" quer duas mesmo, e a frase dele nao tem meio nem metade.
  {
    const falaPizza = semAc(String(mensagem.texto ?? ""));
    const meiaAMeia = /(^|[^a-z])(meio|meia|metade)([^a-z]|$)/.test(falaPizza);
    const pizzas = estado.itens
      .map((i, idx) => ({ i, idx }))
      .filter(({ i }) => String(i.categoria || "") === "pizza");
    if (meiaAMeia && pizzas.length > 1) {
      const sabores = pizzas
        .map(({ i }) => String(i.obs ?? "").trim())
        .filter(Boolean);
      const ficam = new Set(pizzas.slice(1).map(({ idx }) => idx));
      // A QUANTIDADE DA PIZZA QUE SOBRA E A MAIOR DAS QUE SE JUNTARAM, E NAO 1.
      //
      // Aqui estava `Math.max(1, Number(i.qtd) || 1)`, e era o unico lugar deste
      // projeto que escrevia `|| 1` num campo de quantidade. Ele transformava em
      // 1 o ZERO que o leitor tinha devolvido de proposito, DEPOIS de o leitor
      // obedecer a regra ("nao disse quantidade? qtd 0, nunca 1").
      //
      // O estrago: quem escreve "quero pizza meio calabresa meio frango" sem
      // numero fechava com UMA pizza, calado. Pizza inteira e R$ 120,00, entao
      // quem queria duas pagava metade. E as duas guardas que existem pra
      // impedir isso (`faltaQuantidade` e `oQueFaltaPraFechar`) nunca chegavam a
      // ver o zero: ele ja tinha sido tapado aqui.
      //
      // MAIOR, e nao soma: as linhas que se juntam sao a MESMA pizza, entao
      // somar faria "meio calabresa meio frango" virar duas. Com todas em zero o
      // resultado e zero, e ai a padaria pergunta, que e o certo.
      const quantasPizzas = Math.max(...pizzas.map(({ i }) => Number(i.qtd) || 0));
      estado = {
        ...estado,
        itens: estado.itens
          .map((i, idx) =>
            idx === pizzas[0].idx
              ? { ...i, qtd: quantasPizzas, obs: sabores.join(" | ") || i.obs }
              : i,
          )
          .filter((_, idx) => !ficam.has(idx)),
      };
      rastro.push("meia a meia e uma pizza so: " + sabores.join(" e "));
    }
  }

  // ------------------------------------------- BOLO MISTO E UM BOLO SO
  //
  // Teste da Kemilly: ela pediu "4 leites e biz" e o pedido saiu com DOIS bolos
  // de um quilo. Ela queria um bolo com os dois sabores, que e o que qualquer
  // pessoa entende por "4 leites e biz".
  //
  // Nota da dona no cardapio: "bolo misto vale o sabor mais caro". Entao o
  // pedido fica com o sabor caro na linha (pra conta sair certa) e os dois
  // escritos na observacao, que e o que a cozinha le.
  //
  // So junta quando ele nao pediu VARIOS BOLOS.
  //
  // Antes o teste era disseQuantidade(), que da true em qualquer digito. Ai
  // "quero 2,5kg de bolo" pulava a fusao, e a conversa de 25/08 fechou com TRES
  // bolos somando 6 kg pra quem pediu 2,5. Peso nao e contagem: quem diz o peso
  // esta redimensionando o mesmo bolo, quem diz "dois bolos" quer dois.
  if (!pediuVariosBolos(String(mensagem.texto))) {
    // "bolo" sem sabor e marcador de lugar, nao sabor: e o que a proposta anota
    // e o que a IA le de "quero encomendar bolo". Ele sai da mistura, senao a
    // comanda pede "misto: bolo e 4 leites e biz".
    const bolos = estado.itens.filter(
      (i) => String(i.categoria || "").startsWith("bolo") && String(i.produto).trim().toLowerCase() !== "bolo",
    );
    const semSabor = estado.itens.filter(
      (i) => String(i.categoria || "").startsWith("bolo") && String(i.produto).trim().toLowerCase() === "bolo",
    );
    if (bolos.length > 1 || (bolos.length === 1 && semSabor.length)) {
      const preco = (nome: string) =>
        Number(motorPadrao.cotarPorItens([{ item: nome, qtd: 1 }]).total || 0);
      const caro = [...bolos].sort((a, b) => preco(b.produto) - preco(a.produto))[0];
      const sabores = bolos.map((b) => b.produto).join(" e ");
      const misto = bolos.length > 1 ? "misto: " + sabores : null;
      // NA FESTA, O PESO DO BOLO E O DA BASE. E NAO O MAIOR PEDACO DELE.
      //
      // Medido conversando em 30/08/2026, festa de 30 pessoas:
      //
      //   base    >> 300 salgados, 150 docinhos, 3 kg de bolo
      //   cliente >> quero misto de brigadeiro com ninho
      //   rastro  >> reparti 3 de bolo entre 3 escolha(s)
      //   pedido  >> 1 kg de bolo          <- R$ 55,90 no lugar de R$ 167,70
      //
      // O rateio da base divide a quantidade entre os sabores, e para salgado e
      // docinho isso esta certo: 300 salgados viram 150 coxinha e 150 risoles,
      // que sao coisas diferentes saindo do forno.
      //
      // BOLO MISTO NAO E ASSIM. Misto e UM bolo com dois sabores, nao dois
      // bolos. Repartir o peso e depois pegar o maior pedaco derruba o bolo de
      // 3 kg pra 1 kg, e o cliente paga um terco do que ia levar.
      //
      // Quem sabe o peso certo e a BASE, que e onde a proposta escreveu "3 kg de
      // bolo" e onde a correcao do cliente cai quando ele muda o total. O maior
      // pedaco continua valendo fora da festa, que e o pedido de bolo avulso.
      const pesoDaBase = Number(estado.base?.boloKg) || 0;
      const maiorPedaco = [...bolos, ...semSabor].reduce((s, b) => Math.max(s, Number(b.qtd) || 0), 0);
      const peso = estado.ehFesta && pesoDaBase > 0 ? pesoDaBase : maiorPedaco;
      const outros = estado.itens.filter((i) => !String(i.categoria || "").startsWith("bolo"));
      estado = {
        ...estado,
        itens: [
          ...outros,
          {
            ...caro,
            qtd: peso,
            // A OBSERVACAO DE TODOS OS BOLOS VEM JUNTO, E NAO SO A DO MAIS CARO.
            //
            // Ficava so `caro.obs`, e o resto era jogado fora com as linhas. So
            // que o topo, o tema e a embalagem sao carimbados no PRIMEIRO bolo
            // da lista, e o primeiro nem sempre e o mais caro:
            //
            //     itens  [bolo biz (R$ 46,90), bolo strogonoff (R$ 55,90)]
            //     topo   carimbado no biz, que e o primeiro
            //     fusao  fica o strogonoff, e o topo some
            //
            // O topo e peca que a equipe ENCOMENDA fora, com dois dias de
            // antecedencia. Perder ele na fusao e a cozinha descobrir no dia.
            //
            // Sem limpar o "misto:" anterior a observacao empilhava a cada
            // mensagem: na conversa de 25/08 chegou a sete copias da mesma
            // frase, e isso vai impresso no cupom da cozinha.
            //
            // Achado lendo linha por linha em 27/08/2026.
            obs:
              [
                ...[...bolos, ...semSabor]
                  .map((b) => semMisto(b.obs))
                  .filter(Boolean)
                  // Nos dois separadores: o texto gravado mistura virgula e
                  // barra, e cortar so num deles deixava recado colado no outro.
                  .flatMap((o) => String(o).split(/[,|]/))
                  .map((x) => x.trim())
                  .filter(Boolean)
                  // Sem repetir: os dois bolos costumam trazer a mesma
                  // embalagem, e "prato de MDF aberto" duas vezes no cupom e
                  // ruido pra quem monta.
                  .filter((x, n, todos) => todos.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === n),
                misto,
              ]
                .filter(Boolean)
                .join(" | ") || null,
          },
        ],
      };
      rastro.push(
        misto
          ? "bolo misto: " + sabores + ", cotado pelo sabor mais caro (" + caro.produto + ")"
          : "o bolo sem sabor virou o bolo de " + caro.produto,
      );
    }
  }

  // A RESTRICAO QUE O CARDAPIO TEM VIRA SABOR, E NAO PROMESSA APAGADA.
  //
  // Ordem dele em 31/08/2026, depois do pedido de festa da vespera: *"se tem no
  // cardapio tem q add mano, dps a equipe resolve isso se n puder fazer, se ela
  // mandou no audio q faz eh pq faz"*.
  //
  // O que tinha acontecido:
  //
  //   cliente >> Vou querer de brigadeiro sem lactose
  //   padaria >> Sobre o sem lactose: deixa eu confirmar com a equipe...
  //   pedido  >> 2 kg de bolo brigadeiro   R$ 46,90/kg
  //
  // O sem lactose nao entrou, e a equipe tambem nunca foi avisada. O cliente
  // esperou um retorno que nao existia.
  //
  // A dona ja tinha respondido isso em audio (`docepao1608 (3).txt`): da pra
  // misturar, e vale o valor mais caro. Aqui embaixo, com os bolos ja fundidos
  // num so, o "sem lactose" da observacao vira o sabor "0% lactose" no nome, e
  // o motor cobra a faixa C: R$ 55,90 o quilo no lugar de R$ 46,90.
  {
    const i = estado.itens.findIndex((x) => String(x.categoria || "").startsWith("bolo"));
    if (i >= 0) {
      const bolo = estado.itens[i];
      for (const r of restricoesQueACasaNaoFaz(bolo.obs, bolo.produto)) {
        const misturado = misturaQueACasaFaz(bolo.produto, r);
        if (!misturado) continue;
        const itens = [...estado.itens];
        itens[i] = { ...bolo, produto: misturado, obs: obsSemRestricao(bolo.obs, bolo.produto) };
        estado = { ...estado, itens };
        rastro.push(
          "\"" + r + "\" e sabor de bolo no cardapio; o bolo virou " + misturado +
          " e o motor cobra pela faixa mais cara",
        );
        break;
      }
    }
  }

  // ELE MUDOU ALGUMA COISA NESTA MENSAGEM? (fora a contabilidade da conversa)
  //
  // Sobe pra ca porque dois lugares precisam da mesma resposta: adiar a etapa
  // que prendeu a conversa, e decidir se a insistencia foi "ele nao respondeu"
  // ou "ele respondeu outra coisa". Era declarado la embaixo e o adiamento nao
  // alcancava.
  //
  // `etapasAdiadas` entra na lista de contabilidade pelo mesmo motivo das
  // outras tres: e registro de como a conversa andou, nao e o pedido mudando.
  const soContabilidade = new Set(["ultimaFala", "insistiu", "etapasJaPerguntadas", "etapasAdiadas"]);
  const semContabilidade = (e: Estado) =>
    JSON.stringify(Object.fromEntries(
      Object.entries(e).filter(([k]) => !soContabilidade.has(k)).sort(([a], [b]) => a.localeCompare(b)),
    ));

  // ------------------------------- A ETAPA QUE ELE NAO QUER RESPONDER AGORA
  //
  // Medido conversando em 30/08/2026, festa de 30 pessoas. A cor da forminha e
  // bloqueio DURO do docinho, entao a conversa parou ali:
  //
  //   padaria >> De que cor voce quer a forminha dos docinhos?
  //   cliente >> quero misto de brigadeiro com ninho
  //   padaria >> De que cor voce quer a forminha dos docinhos?
  //   cliente >> nao quero papel de arroz nao
  //   padaria >> De que cor voce quer a forminha dos docinhos?
  //
  // Tres vezes a mesma pergunta. E pior que chato: como TUDO e lido como
  // resposta da etapa presa, "quero misto de brigadeiro com ninho" virou
  // DOCINHO, e o bolo nunca entrou no pedido.
  //
  // A regra da dona continua: a cor e cobrada, porque ela monta a forminha
  // antes de rechear. O que muda e que a pergunta nao PRENDE. Ela sai da
  // frente, a conversa segue no assunto que o cliente escolheu, e a etapa volta
  // quando nao houver mais nada pela frente, antes de fechar.
  //
  // As duas condicoes juntas, e nenhuma sozinha:
  //
  //   ja insisti duas vezes  ->  a pergunta ja saiu e ja foi repetida;
  //   e ele MUDOU alguma coisa no pedido  ->  ele esta conversando, so nao
  //   sobre isto. Sem esta segunda, quem manda "oi" tres vezes faria a padaria
  //   desistir de perguntar, e ai o dado se perde de verdade.
  if ((estadoAtual.insistiu ?? 0) >= 2 && !etapaAgora.cumprida(estado)) {
    const mudouAlgo = semContabilidade(estadoAtual) !== semContabilidade(estado);
    const jaAdiadas = estado.etapasAdiadas ?? [];
    if (mudouAlgo && !jaAdiadas.includes(etapaAgora.id)) {
      estado = { ...estado, etapasAdiadas: [...jaAdiadas, etapaAgora.id] };
      rastro.push("adiei a etapa " + etapaAgora.id + ": perguntei duas vezes e ele esta falando de outra coisa");
    }
  }

  // ------------------------------------------------- a etapa seguinte
  let proxima = etapaDaVez(estado, roteiro());

  // A PROPOSTA NAO SAI DA MESA POR SILENCIO DO MODELO.
  //
  // Medido no ar em 29/08/2026: festa pra 30, a padaria propôs 300 salgados,
  // o cliente disse "escolhe voce os tipos, confio", o modelo devolveu {}, e
  // `jaPerguntouEEleNaoRespondeu` pulou a base, o salgado, o docinho e o bolo.
  // Sobrou "Como voce prefere pagar?", com o pedido vazio.
  //
  // Quem fala do pedido sem aceitar, sem recusar, sem nomear e sem mudar dado
  // ainda esta na proposta. Dado de retirada nesta mensagem e outro assunto,
  // e ai a marca de perguntado continua valendo.
  if (
    etapaAgora.id === "base_da_festa" &&
    estado.ehFesta &&
    (estado.pessoas ?? 0) > 0 &&
    estado.base &&
    !estado.baseAceita &&
    leituraDesteTurno &&
    leituraDesteTurno.aceitouBase !== true &&
    leituraDesteTurno.delegaEscolha !== true &&
    !leituraDesteTurno.itens?.length &&
    !leituraDesteTurno.naoQuer?.length &&
    !leituraDesteTurno.dados &&
    !leituraDesteTurno.perguntou
  ) {
    const daBase = roteiro().find((x) => x.id === "base_da_festa");
    if (daBase && !daBase.cumprida(estado)) {
      proxima = daBase;
      rastro.push("a proposta ainda esta na mesa");
    }
  }

  // A volta so acontece quando o desvio ja se resolveu, senao a conversa fica
  // pulando entre duas etapas sem terminar nenhuma.
  if (estado.retomarEm && estado.retomarEm !== proxima.id) {
    const alvo = roteiro().find((x) => x.id === estado.retomarEm);
    if (alvo && !alvo.cumprida(estado) && !alvo.pulavel?.(estado)) {
      proxima = alvo;
      rastro.push("retomando em " + alvo.id);
    }
    if (alvo?.cumprida(estado)) estado = { ...estado, retomarEm: null };
  }
  if (proxima.id === estado.retomarEm) estado = { ...estado, retomarEm: null };

  // ------------------------------------- O ASSUNTO E DELE, NAO DA MINHA LISTA
  //
  // "vcs fazem bolo?" nao anota item nenhum, entao a lista de etapas continuava
  // apontando pra abertura e ele ouvia "o que voce precisa?" de novo. Duas
  // vezes, no print de 23/08/2026.
  //
  // Etapa pulavel quer dizer "nao pergunto por conta propria", e nunca quis
  // dizer "nao falo disso nem se ele pedir": pedido simples nao ouve falar de
  // bolo por iniciativa da padaria, mas quem PERGUNTA de bolo tem que ouvir
  // falar de bolo. Por isso aqui o pulavel nao vale, e a etapa cumprida sim:
  // assunto ja resolvido nao volta pra mesa.
  if (estado.assunto && estado.assunto !== proxima.id) {
    const lista = roteiro();
    const alvo = lista.find((x) => x.id === estado.assunto);
    // O ASSUNTO PODE VOLTAR, NAO PODE PULAR A FILA.
    //
    // Teste da Kemilly: ela abriu com "quero encomendar pra uma festa bolo e
    // docinhos e salgados" e a primeira pergunta foi o SABOR DO BOLO, antes de
    // "quantas pessoas" e antes da proposta. O assunto que ela trouxe atropelou
    // a ordem do roteiro, e ela escolheu bolo sem saber quanto ia dar.
    //
    // Voltar pra tras continua valendo ("na verdade quero trocar o docinho"), e
    // da abertura sai pra qualquer lugar, que e o caso de "vcs fazem bolo?".
    const daVez = lista.findIndex((x) => x.id === proxima.id);
    const doAssunto = lista.findIndex((x) => x.id === estado.assunto);
    const podeIr = proxima.id === "abertura" || doAssunto <= daVez;

    // ASSUNTO JA PERGUNTADO NAO VOLTA PRA MESA.
    //
    // O assunto voltava a cada mensagem enquanto a etapa nao se cumprisse, e
    // uma etapa de familia SO se cumpre com item daquela familia. Se o cliente
    // nao pede daquela familia, ela nunca se cumpre e a conversa fica presa.
    //
    // Medido em 26/08/2026, com uma conversa de pizza contra o banco. O modelo
    // classificou a pizza como SALGADO (ela e salgada, e pizza nao e etapa), o
    // assunto grudou em salgado, e:
    //
    //   cliente >> as redondas
    //   padaria >> Quais salgados voce quer?   (com o cardapio de salgados)
    //   cliente >> uma de calabresa e uma de frango com catupiry
    //   padaria >> Voce quer quais salgados?   (o mesmo cardapio de novo)
    //   cliente >> nome Marcos Alves, pix
    //   padaria >> Vou chamar uma pessoa da equipe.
    //
    // Isso pega qualquer produto que nao tem etapa propria: pizza, empadao,
    // torta, cuca, pao. A pergunta certa nunca chegava a sair.
    //
    // Agora vale a mesma regra dos detalhes opcionais: perguntou, ele falou
    // outra coisa, a padaria segue. Ver `PERGUNTA-E-BOTAO.md`.
    const jaPerguntei = (estado.etapasJaPerguntadas ?? []).includes(estado.assunto);

    if (alvo && !alvo.cumprida(estado) && podeIr && !jaPerguntei) {
      proxima = alvo;
      rastro.push("o assunto e " + alvo.id + " (foi ele quem trouxe)");
    } else {
      estado = { ...estado, assunto: null };
    }
  } else if (estado.assunto === proxima.id && proxima.cumprida(estado)) {
    estado = { ...estado, assunto: null };
  }

  // "PODE FECHAR" VENCE A OFERTA QUE ELE JA RECUSOU.
  //
  // Na primeira mensagem o cliente pode mandar item, dados, "so isso" e a
  // ordem de fechar juntos. A etapa no comeco do turno ainda e a oferta, mas
  // depois de aplicar a recusa o pedido ja esta na confirmacao. Exigir outra
  // mensagem ali e ignorar uma ordem clara.
  //
  // So vale quando a propria leitura marcou a aprovacao, o turno comecou na
  // oferta e todas as etapas chegaram ate a confirmacao. O fechamento ainda
  // passa por `oQueFaltaPraFechar`, entao isto nao inventa dado nem pula sabor.
  if (
    !confirmouEscrevendo &&
    leituraDesteTurno?.confirmou === true &&
    etapaAgora.id === "oferta" &&
    proxima.id === "confirmacao"
  ) {
    confirmouEscrevendo = true;
    rastro.push("pediu pra fechar e ja tinha recusado a oferta");
  }

  // O aviso so vale se a conversa continuar na MESMA etapa: se ela ja andou, o
  // cliente resolveu e o "a gente nao faz" chegaria fora de hora.
  // O TOTAL SAI DO MOTOR, E EU ESTAVA MANDANDO ZERO.
  //
  // Teste do dono em 23/08/2026: o resumo do pedido dele, com onze linhas de
  // comida, terminava em "*Total: R$ 0,00*". Ele perguntou "total ficou 0
  // reais?" e recebeu o mesmo resumo de volta.
  //
  // Nao era o motor errando: era eu passando 0 no lugar do total, na unica
  // chamada que monta a fala. O numero certo estava a uma linha de distancia.
  const total = estado.itens.length
    ? Math.round(
        Number(
          motorPadrao.cotarPorItens(
            paraOMotor(estado.itens),
          ).total || 0,
        ) * 100,
      )
    : 0;

  // A RETIRADA CABE NO EXPEDIENTE?
  //
  // Pedido do dono: hora que a padaria nao atende tem que ser DITA, nao
  // engolida. O horario sai de padaria-aberta.ts, o mesmo que a Dora usa pra
  // responder "que horas voces abrem": fonte unica, sem lista paralela.
  //
  // A hora que nao cabe e apagada, entao a etapa dos dados volta a perguntar, e
  // agora com o motivo na frente.
  const foraDoHorario = retiradaForaDoExpediente(estado.dados.data, estado.dados.hora);
  if (foraDoHorario) {
    estado = { ...estado, dados: { ...estado.dados, hora: null } };
    // A ETAPA SE REFAZ DEPOIS DE APAGAR A HORA.
    //
    // `proxima` foi escolhida la em cima, com a hora ainda no lugar, entao ela
    // podia ser a CONFIRMACAO. Apagar a hora sem refazer a escolha deixava a
    // conversa apontando pra uma etapa que nao vale mais.
    proxima = etapaDaVez(estado, roteiro());
    rastro.push("hora fora do expediente; avisei e perguntei de novo");
  }

  // O QUE ELE PEDIU E A CASA NAO FAZ, ELE PRECISA OUVIR — MUDE OU NAO DE ETAPA.
  //
  // Medido na conversa dele de 02/09/2026:
  //
  //   cliente >> Quero coxinha, bolinha de queijo e ribolho e frango frito com molho
  //   rastro  >> barrado nesta etapa: ribolho, frango frito com molho
  //   padaria >> (nao disse uma palavra sobre os dois)
  //
  // O aviso existia e so saia quando a proxima pergunta era a MESMA. Quando a
  // conversa andava, ele sumia: o cliente seguia achando que pediu quatro coisas
  // e ia descobrir na retirada que levava duas.
  //
  // A etapa seguinte nao tem nada a ver com isto. O aviso e sobre o que ELE
  // acabou de pedir, e some com a mensagem em que foi dito.
  let fala = falaDaEtapa(proxima, estado, total, naoTemos);

  // ------------------------------------------ QUAL DELES VOCE QUER TIRAR
  //
  // ESTA E A UNICA FALA DESTE ARQUIVO QUE SUBSTITUI A PERGUNTA DA ETAPA, e nao
  // entra na frente dela como os avisos fazem. O motivo e que ela nao e aviso:
  // e pergunta, e perguntar duas coisas na mesma mensagem faz o cliente
  // responder uma e a outra se perder. Gente nao faz isso.
  //
  // E por substituir, a etapa NAO pode ser marcada como ja perguntada: a
  // pergunta dela nao foi feita, e ela volta na proxima mensagem.
  let perguntandoQualTirar = false;
  if (estado.tirandoQual) {
    const quais = linhasQueOClientePodeEstarTirando(estado.itens, estado.tirandoQual);
    if (quais.length > 1) {
      perguntandoQualTirar = true;
      // `podeReescrever` fica ligado: aqui nao tem numero nenhum, e a reescrita
      // e proibida de trocar produto. O que ela faz e tirar o jeito de robo.
      fala = { ...fala, texto: perguntaDeQualTirar(estado.itens, quais), botoes: [], cardapio: null, opcoes: undefined, podeReescrever: true };
      rastro.push("perguntei qual tirar: " + estado.tirandoQual);
    } else {
      // Deixou de ser ambiguo entre uma mensagem e outra (a dona mexeu no
      // pedido pela tela, por exemplo). Nao pergunta o que nao tem mais duvida.
      estado = { ...estado, tirandoQual: null };
    }
  }

  // ------------------------------- O QUE A CASA NAO FAZ, ELA DIZ QUE NAO FAZ
  //
  // A restricao ja saiu da observacao la em `aplicar`, senao a comanda mandava
  // a cozinha produzir uma coisa e o resumo prometia outra pro cliente.
  //
  // Tirar calado seria melhor que prometer e pior que avisar: quem pede sem
  // lactose tem motivo, e merece ouvir antes de receber. A frase vem NA FRENTE
  // da pergunta da etapa, porque e a resposta ao que ele acabou de falar.
  if (estado.restricoesTiradas?.length) {
    const aviso = avisoDaRestricao(estado.restricoesTiradas);
    if (aviso) {
      fala = { ...fala, texto: aviso + (fala.texto ? "\n\n" + fala.texto : "") };
      // QUEM RESPONDE DE RESTRICAO E A EQUIPE. Decisao do dono, 26/08/2026.
      //
      // Nao e caso de recusar: o "0% lactose" existe no cardapio como sabor de
      // bolo de festa da faixa C, R$ 55,90 o quilo contra R$ 46,90 do
      // brigadeiro. Palavra dele: "se for por exemplo bolo de brigadeiro + o
      // sem lactose, la eles devem fazer no bolo ne, so fica mais caro".
      //
      // Entao responder "a gente nao tem" seria errado E perderia venda. E
      // responder "a gente faz" seria pior, porque quem decide o que a cozinha
      // produz e a cozinha. A IA passa adiante, que e o mesmo que a dona ja faz
      // com desconto e com entrega.
      precisaHumano = true;
      motivoHumano = "Restrição de dieta: " + estado.restricoesTiradas.join(", ") +
        ". A casa não faz, então tirei da observação e passei pra vocês.";
      rastro.push(
        "restricao de dieta (" + estado.restricoesTiradas.join(", ") +
        "); tirei da observacao e chamei a equipe",
      );
    }
    // Vive um turno so: o aviso ja foi dado, e repetir na proxima mensagem
    // seria a padaria insistindo numa coisa que o cliente ja ouviu.
    estado = { ...estado, restricoesTiradas: undefined };
  }

  // A SUGESTAO DO MINIMO POR SABOR, pelo mesmo caminho e pelo mesmo motivo.
  //
  // Diferenca importante em relacao ao aviso de restricao: este NAO chama a
  // equipe e NAO trava nada. O catalogo diz `recusar: false` com todas as
  // letras, e a dona explicou por que: "se a cliente falar 15, 15, 15, abre uma
  // excecao, nao tem problema nenhum". A padaria informa e segue.
  // O RECHEIO QUE O PRODUTO NÃO TEM, dito na frente da pergunta.
  //
  // Não chama a equipe e não recusa nada: o item continua no pedido, com o
  // recheio da casa. É o que uma atendente responderia a "coxinha de camarão",
  // e o cliente que quiser insistir fala de novo, que aí a equipe entra pelo
  // caminho de sempre.
  if (estado.recheiosTrocados?.length) {
    // SEM ARTIGO NA FRENTE DO PRODUTO, pelo mesmo motivo do limite de sabores:
    // "a croquete" e "o coxinha" são erros que a clientela vê na hora, e o
    // gênero do produto não está no catálogo. Dizer o que a casa FAZ resolve a
    // gramática e a conversa de uma vez, e é resposta em vez de recusa.
    fala = {
      ...fala,
      texto: "A gente faz " + estado.recheiosTrocados.join(", ") + "." +
        (fala.texto ? "\n\n" + fala.texto : ""),
    };
    estado = { ...estado, recheiosTrocados: undefined };
  }

  if (estado.poucoPorSabor) {
    fala = { ...fala, texto: estado.poucoPorSabor + (fala.texto ? "\n\n" + fala.texto : "") };
    rastro.push("sugeri o minimo por sabor (nao trava, so sugere)");
    estado = { ...estado, poucoPorSabor: undefined };
  }

  // A MESMA PECA DE CARDAPIO NAO VAI DUAS VEZES.
  //
  // ISTO RODA ANTES DA CONTAGEM DE INSISTENCIA, E NAO POR ESTETICA.
  //
  // A primeira versao ficava no fim da funcao, depois de `mesmaPergunta`, e
  // quebrou `sabor-fora-da-lista-espera-insistencia` na hora: a contagem compara
  // o texto novo com o guardado, e o texto so perdia a frase do cardapio DEPOIS
  // da comparacao. Turno 2 comparava texto longo com longo (contava), turno 3
  // comparava longo com curto (zerava), e o cliente que insistia tres vezes no
  // mesmo sabor nunca chegava na equipe.
  //
  // Aqui em cima o texto ja esta no formato final quando alguem o compara ou o
  // guarda, que e o unico jeito de os dois concordarem.
  //
  // Do pedido de festa de 30/08/2026, quatro minutos de conversa:
  //
  //   23:10  Quais sabores de salgados voce prefere?     [peca salgados]
  //   23:12  Qual recheio voce quer no risolis?          [peca salgados]
  //   23:14  Qual sabor voce quer para o mini bolha?     [peca salgados]
  //
  // A mesma imagem tres vezes, empurrando pra cima a conversa que o cliente
  // precisava reler. Palavra do dono: "inves dele falar os produtos q faltou
  // sabor e digitar pra eles os sabores q tem, ele mandou outro cardapio igual".
  //
  // Na segunda vez a peca sai e as opcoes entram no texto, que e o que uma
  // pessoa faria: ela ja te mandou o cardapio, agora ela te fala os sabores.
  //
  // AQUI, E NAO NA PERGUNTA, de proposito: toda pergunta que anexa peca passa
  // por este ponto, e assim nenhuma delas precisa lembrar da regra sozinha.
  if (fala.cardapio) {
    const mandadas = estado.pecasMandadas ?? [];
    if (mandadas.includes(fala.cardapio)) {
      const opcoes = (fala.opcoes ?? []).filter(Boolean);
      const jaCita = opcoes.length > 0 && opcoes.every((o) => semAc(fala.texto).includes(semAc(String(o))));
      const texto = fala.texto
        // A frase que promete a imagem sai junto com a imagem, senao a padaria
        // diz "te mandei o cardapio" e nao manda nada.
        .replace(/\s*(Te mandei|Já te enviei|Te enviei)[^.!?]*[.!?]/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      fala = {
        ...fala,
        cardapio: null,
        texto: (opcoes.length && !jaCita ? texto + " Tem " + listaEmPortugues(opcoes.map(String)) + "." : texto)
          .replace(/\s{2,}/g, " ")
          .trim(),
      };
      //
      rastro.push("a peca " + mandadas.join("/") + " ja foi mandada nesta conversa; escrevi os sabores no texto");
    } else {
      estado = { ...estado, pecasMandadas: [...mandadas, fala.cardapio] };
    }
  }

  // ------------------------------------ A MESMA PERGUNTA NAO SAI DUAS VEZES
  //
  // Se ela vai repetir o que acabou de perguntar, alguma coisa nao funcionou: a
  // resposta do cliente nao virou dado. Repetir igual e o que faz ele achar que
  // ninguem leu, e foi o que aconteceu tres vezes com o tema.
  //
  // Na segunda vez ela mostra as opcoes, quando a pergunta tem lista. Na
  // terceira, para de insistir e chama a equipe: tem coisa que a padaria
  // resolve numa frase e a Dora nao resolve em dez.
  // A FRASE DO CARDAPIO NAO CONTA NA COMPARACAO.
  //
  // A padaria manda a peca uma vez so, entao a MESMA pergunta sai com "Te mandei
  // o cardapio pra escolher" na primeira e sem ela na segunda. Comparando o
  // texto cru, a segunda parecia pergunta NOVA e a contagem zerava:
  //
  //   turno 1  O esfirra vai de quê? Te mandei o cardápio... Tem carne, ...
  //   turno 2  O esfirra vai de quê? Tem carne, ...            <- "diferente"
  //   turno 3  O esfirra vai de quê? Tem carne, ...            <- insistiu 1
  //
  // Quem insistia tres vezes no mesmo sabor fora da lista nunca chegava na
  // equipe, porque so na quarta a conta fechava. Pego pelo
  // `sabor-fora-da-lista-espera-insistencia` no mesmo dia em que a supressao da
  // peca entrou.
  //
  // O que se compara e a PERGUNTA, e a frase que promete a imagem e decoracao.
  const soAPergunta = (t: unknown) =>
    String(t ?? "")
      .replace(/\s*(Te mandei|Já te enviei|Te enviei)[^.!?]*[.!?]/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  const mesmaPergunta =
    Boolean(estado.ultimaFala) && soAPergunta(fala.texto) === soAPergunta(estado.ultimaFala);
  let insistiu = mesmaPergunta ? (estado.insistiu ?? 0) + 1 : 0;

  // SABOR FORA DA LISTA: a padaria mostra o cardapio. Se ele insiste, anota
  // pra equipe em vez de recusar a venda. A dona: "se o cliente pedir outro
  // sabor, a gente vai colocando".
  let aceitouSaborInsistido = false;
  if (insistiu >= 2) {
    const anotados: string[] = [];
    const itens = estado.itens.map((i) => {
      if (!saborQueFalta(i.produto, i.obs)) return i;
      const obs = String(i.obs ?? "").trim();
      if (!obs) return i;
      if (semAc(obs).includes(semAc(MARCA_SABOR_A_CONFIRMAR))) return i;
      if (obs.split(" | ").some((p) => saborCabeNaLista(i.produto, p))) return i;
      anotados.push(i.produto + " de " + obs);
      return { ...i, obs: obs + " (" + MARCA_SABOR_A_CONFIRMAR + ")" };
    });
    if (anotados.length) {
      aceitouSaborInsistido = true;
      estado = { ...estado, itens, saboresAConfirmar: anotados };
      proxima = etapaDaVez(estado, roteiro());
      fala = falaDaEtapa(proxima, estado, total, naoTemos);
      precisaHumano = true;
      motivoHumano = "Sabor fora do cardápio: " + anotados.join(", ") +
        ". O cliente insistiu, então anotei pra vocês confirmarem.";
      insistiu = 0;
      rastro.push(
        "sabor fora da lista, insistiu; anotei e chamei a equipe (" +
          anotados.join(", ") + ")",
      );
      fala = {
        ...fala,
        texto: "Anotei " + anotados.join(", ") +
          ". A equipe confirma se a casa faz esse sabor." +
          (fala.texto ? "\n\n" + fala.texto : ""),
      };
    }
  }
  // REPETIR A PERGUNTA NAO E O MESMO QUE NAO TER ENTENDIDO.
  //
  // A conta acima olha so pra pergunta que esta saindo. O comentario dizia "a
  // resposta do cliente nao virou dado", mas isso era suposicao, e ela e falsa
  // sempre que o cliente responde OUTRA coisa que a padaria entendeu bem.
  //
  // Medido em 27/08/2026, numa festa de aniversario com topo:
  //
  //   padaria >> A que horas voce vai passar para buscar?
  //   cliente >> quero topo sim
  //   padaria >> A que horas voce vai passar para buscar?
  //   cliente >> tema jardim encantado, nome Alice, 5 anos
  //   padaria >> Acho que nao estou conseguindo entender direito por aqui.
  //
  // A padaria entendeu tudo: o topo entrou, e o tema, o nome e a idade foram
  // parar na comanda como "Topo: tema jardim encantado, Alice, 5 anos". Ela
  // dizia que nao entendia enquanto anotava. Do lado do cliente isso e pior que
  // silencio, porque ele acabou de ser atendido e ouviu que ninguem entendeu.
  //
  // A hora continuava faltando, e por isso a pergunta volta. Voltar esta certo.
  // Desistir e que nao.
  const entendeuAlgo = semContabilidade(estadoAtual) !== semContabilidade(estado);
  // DE QUE ETAPA SAIU A PERGUNTA QUE ESTA INDO AGORA.
  //
  // E o sinal de "ele JA foi perguntado disto", usado pelos detalhes opcionais
  // (o prato do bolo, o topo, o papel de arroz) pra nao insistir.
  //
  // Antes esse sinal saia do `insistiu`, e ficava um turno atrasado: a etapa so
  // seguia depois de a mesma pergunta sair DUAS vezes. Na bateria dos cinco
  // jeitos isso derrubou o cenario 1, que era verde: quem manda o pedido
  // inteiro numa mensagem ouvia "o bolo vai no prato aberto ou com tampa?",
  // respondia "isso mesmo, pode confirmar", e ouvia a MESMA pergunta.
  //
  // Agora a etapa segue ja na primeira ignorada.
  // ACUMULA, NAO SUBSTITUI. Perguntado uma vez, perguntado pra sempre: guardar
  // so a ultima fazia a etapa REABRIR assim que a conversa andava.
  // MARCA A ETAPA E TAMBEM A PERGUNTA.
  //
  // Uma etapa pode ter mais de uma pergunta: a do bolo pergunta o sabor e
  // depois o prato. Marcando so a etapa, a marca da PRIMEIRA pergunta fazia a
  // etapa se dar por cumprida antes da segunda sair. Medido em 28/08/2026, em
  // duas conversas de verdade: o bolo de festa fechava sem prato, sem topo e
  // sem papel de arroz.
  //
  // Guarda as duas marcas de proposito. Quem pergunta pela etapa (o
  // `base_da_festa`, o desvio de assunto) continua funcionando igual, e quem
  // precisa saber QUAL pergunta ja saiu usa `etapa:chave`.
  const jaPerguntadas = estado.etapasJaPerguntadas ?? [];
  // A pergunta da etapa nao foi feita quando o "qual deles" tomou o lugar
  // dela, entao ela nao pode entrar como perguntada: entrando, a etapa seria
  // pulada e o dado dela nunca seria pedido.
  const marcas = perguntandoQualTirar
    ? []
    : [proxima.id, ...(fala.chave ? [proxima.id + ":" + fala.chave] : [])].filter(
        (m) => !jaPerguntadas.includes(m),
      );
  estado = {
    ...estado,
    ultimaFala: fala.texto || null,
    insistiu,
    etapasJaPerguntadas: marcas.length ? [...jaPerguntadas, ...marcas] : jaPerguntadas,
  };

  if (aceitouSaborInsistido) {
    // A pergunta mudou: nao cai no "nao estou entendendo".
  } else if (insistiu === 1 && fala.opcoes?.length && !fala.texto.includes(fala.opcoes[0])) {
    fala = { ...fala, texto: fala.texto + "\n\nAs opções são: " + fala.opcoes.join(", ") + "." };
    rastro.push("repeti a pergunta; mostrei as opcoes");
  } else if (insistiu >= 3 && !entendeuAlgo) {
    // A QUARTA VEZ NAO E PERGUNTA, E GENTE.
    //
    // Medido conversando com a producao em 31/08/2026:
    //
    //   padaria >> Qual cor você quer para a forminha dos docinhos?
    //   cliente >> 2 kg        padaria >> (a mesma pergunta)
    //   cliente >> sim         padaria >> (a mesma pergunta)
    //   cliente >> sim         padaria >> (a mesma pergunta)
    //
    // A pergunta so sai da frente quando o cliente MUDA alguma coisa no pedido
    // (o adiamento la de cima). Quem responde coisa que ela nao entende fica
    // preso no mesmo lugar pra sempre, e foi disso que ele reclamou olhando o
    // teste da Kemilly: "ela pediu a data 2 vzs seguida", "pede o nome 3 vezes".
    //
    // A regra da casa continua valendo: gente e ultimo recurso. So que quatro
    // vezes a MESMA pergunta, sem entender nada do que a pessoa respondeu, E o
    // ultimo recurso. Um atendente humano teria trocado de assunto ou chamado
    // alguem muito antes.
    //
    // A pergunta nao se perde: `ultimaFala` guarda ela, e quem assumir no painel
    // ve no motivo o que estava sendo perguntado.
    precisaHumano = true;
    motivoHumano =
      "Perguntei \"" + soAPergunta(String(fala.texto || "")) +
      "\" quatro vezes e nao consegui entender a resposta.";
    fala = {
      ...fala,
      texto: "Acho melhor chamar alguem da equipe pra te ajudar com isso. Ja te respondem por aqui.",
      botoes: [],
      cardapio: null,
      podeReescrever: false,
    };
    rastro.push("insisti " + insistiu + " vezes sem entender nada; chamei a equipe");
  } else if (insistiu >= 2) {
    // REPETIR NAO E CHAMAR A EQUIPE.
    //
    // O modelo devolve {}, o teste manda "oi", a etapa nao anda: a pergunta
    // que falta volta, COM o cardapio que a etapa ja tem. Dizer "nao estou
    // conseguindo entender" e acender Precisa de voce era o padrao do painel
    // de QA, e o dono viu: a IA nao tentou pensar.
    //
    // Gente so entra no ultimo recurso: entrega, restricao, interruptor, ou
    // ele pediu pra falar com a dona.
    rastro.push(
      "insisti " + insistiu + " vezes na mesma pergunta" +
      (entendeuAlgo ? " (entendi o cliente)" : "") +
      "; perguntei de novo, nao chamei a equipe",
    );
  }

  // O AVISO VEM NA FRENTE DA PERGUNTA, E NAO NO LUGAR DELA.
  //
  // Estava `texto: foraDoHorario`, que SUBSTITUIA a fala da etapa. O cliente
  // ouvia "a padaria nao abre nesse horario" e mais nada: nenhuma pergunta,
  // nenhuma opcao. Ele tinha que adivinhar sozinho que precisava dizer outra
  // hora, e a conversa gastava um turno inteiro nisso.
  //
  // O proprio comentario la em cima ja prometia o certo: "a etapa dos dados
  // volta a perguntar, e agora COM O MOTIVO NA FRENTE". O codigo nao fazia.
  //
  // E o mesmo desenho dos outros avisos deste arquivo (restricao, recheio,
  // minimo por sabor): a frase entra na frente, a pergunta continua.
  //
  // Achado lendo linha por linha em 27/08/2026.
  //
  // E SEM `return` ANTES DA TRAVA FINAL. Ate 03/09/2026 este bloco saia da
  // funcao aqui, e o turno em que o cliente dizia uma hora fora do expediente
  // pulava a trava do catalogo, o teto de 6 kg e o arredondamento da
  // quantidade, la embaixo. O aviso entra na frente da fala e a funcao segue.
  if (foraDoHorario) {
    fala = {
      ...fala,
      texto: foraDoHorario + (fala.texto ? "\n\n" + fala.texto : ""),
      podeReescrever: false,
    };
  }
  // ==========================================================================
  //  A TRAVA: NENHUMA LINHA DO PEDIDO CARREGA NOME QUE O CARDAPIO NAO TEM.
  //
  //  Regra do dono, e ela e antiga: "o que tem no cardapio nao mexe; nao tem
  //  como colocar um produto que nao existe o nome, pra isso que separei tudo
  //  bonitinho". Ele esta certo, e eu vinha tratando isso caso a caso, guarda
  //  por guarda, em vez de tratar como o que e: uma coisa que NUNCA pode
  //  acontecer, conferida num lugar so.
  //
  //  O que fez isso virar trava, medido em 31/08/2026 conversando com o
  //  servidor:
  //
  //    cliente >> frango                       (respondendo o recheio do risolis)
  //    modelo  >> 1x mini sanduiche de pate de frango
  //    guarda  >> "ele nao falou sanduiche, pate; fiquei com mini frango"
  //    pedido  >> 1 ~ mini frango
  //    motor   >> pizza inteira strogonoff de frango, R$ 120,00
  //
  //  Quem inventou o nome foi a MINHA guarda anti-invencao, montando um nome a
  //  partir de pedacos. E o motor de preco casa nome por pedaco, entao um nome
  //  que nao existe nunca fica sem preco: ele pega o produto mais parecido, e o
  //  mais parecido pode ser o mais caro da casa.
  //
  //  Aqui a checagem e a mais simples possivel, e e a unica que nao depende de
  //  eu ter lembrado dela no caminho certo: o nome existe no catalogo, ou e nome
  //  de FAMILIA (o "pizza" que espera o cliente escolher o tipo), ou a linha nao
  //  entra. Nome que nao existe nao vira aviso bonito nem palpite: some, e o
  //  rastro conta o que sumiu pra quem for ler.
  // ==========================================================================
  {
    const daCasa = (nome: string) =>
      Boolean(produtoPorNome(nome) || produtoNoComeco(nome) || ehNomeDeFamilia(nome));
    estado = { ...estado, itens: comORecheioDoCardapio(estado.itens, rastro) };

    // QUANTIDADE DE PRODUTO VENDIDO POR UNIDADE E INTEIRA.
    //
    // Nao existe meia coxinha na comanda. Quem produz recebe um numero pra
    // contar, e "50,5 coxinha" nao e um numero pra contar. Peso continua
    // aceitando fracao, que e o que "2,5 kg de bolo" precisa.
    //
    // A UNIDADE EM SI NAO PRECISA DE TRAVA, e eu quase escrevi uma sem
    // necessidade. Fui conferir antes: o estado do fluxo NAO guarda unidade, e
    // quem grava (`gravar.ts`) e quem imprime (`fila.ts`) perguntam os dois a
    // `unidadeDoPedido`, que le o catalogo. Ja e fonte unica. Guarda que protege
    // o que nao pode acontecer so faz o codigo parecer mais fragil do que e.
    estado = {
      ...estado,
      itens: estado.itens.map((i) => {
        const nome = String(i.produto || "");
        const qtd = Number(i.qtd) || 0;
        if (unidadeDoPedido(nome, String(i.categoria || "")) !== "un") return i;
        if (!(qtd > 0) || Number.isInteger(qtd)) return i;
        const inteira = Math.round(qtd);
        rastro.push(nome + " e vendido por unidade; arredondei " + qtd + " para " + inteira);
        return { ...i, qtd: inteira };
      }),
    };

    // NENHUM BOLO PASSA DO MAIOR QUE A CASA FAZ. EM CAMINHO NENHUM.
    //
    // O catalogo diz o tamanho, com a fonte da dona: "redondo de 300 g a 5,5 kg,
    // quadrado de 2,5 kg a 6 kg". Dez quilos nao existe.
    //
    // A trava ja existia (`naoCabeNoBolo`), e ela tem DOIS buracos que so
    // apareceram na conversa dele de 03/09/2026:
    //
    //   1. ela nao roda quando a CASA escolhe o sabor (`delegaEscolha`), que foi
    //      exatamente o caminho: "10x bolo" virou "10 bolo 4 leites";
    //   2. ela roda no meio do fluxo, e quem entra depois dela nao e conferido.
    //
    //   cliente >> gostaria de fazer pedido de docinhos salgados e bolo
    //   padaria >> Quantas pessoas vao na festa?
    //   cliente >> 10
    //   pedido  >> 10 kg de bolo 4 leites, R$ 469,00
    //
    // Por isso ela vem PRA CA, pro fim do fluxo, junto da trava do nome que nao
    // existe: aqui passa TODA linha, tenha ela vindo do modelo, da proposta, da
    // escolha da casa ou da correcao da equipe.
    //
    // E ELA NAO CORTA O NUMERO, PERGUNTA. Dez quilos pode ser erro de digitacao
    // ou pode ser DOIS BOLOS, e quem decide isso e a padaria com o cliente, nao
    // este arquivo. O peso volta a zero e a etapa do bolo pergunta de novo,
    // dizendo o tamanho que cabe.
    const bolosGrandes = estado.itens.filter(
      (i) =>
        // O LUGAR VAZIO DA FAMILIA NAO E UM BOLO AINDA.
        //
        // "quero 50 bombom" entra como `bolo` generico com 50, e o 50 e
        // informacao que o cliente deu: zerar ali seria fazer sumir o que ele
        // falou, que e a regra numero um da casa. O teto vale quando a linha
        // virar um bolo de verdade, e ai a conta e de quilo.
        //
        // O portao pegou isto em 03/09/2026, em dois testes de uma vez.
        !ehNomeDeFamilia(i.produto) &&
        String(i.categoria || "").startsWith("bolo") &&
        unidadeDoPedido(String(i.produto || ""), String(i.categoria || "")) === "kg" &&
        Number(i.qtd) > PESO_DO_MAIOR_BOLO,
    );
    if (bolosGrandes.length) {
      const nomes = bolosGrandes.map((i) => i.qtd + " kg de " + i.produto).join(", ");
      estado = {
        ...estado,
        itens: estado.itens.map((i) => (bolosGrandes.includes(i) ? { ...i, qtd: 0 } : i)),
        // O aviso sai na frente da pergunta e vive um turno, igual aos outros.
        poucoPorSabor:
          "O maior bolo que a gente faz tem " + PESO_DO_MAIOR_BOLO + " kg. " +
          "Pra mais que isso a gente faz em dois bolos, e eu preciso confirmar com a equipe.",
      };
      rastro.push(
        "nao cabe num bolo so: " + nomes + "; zerei o peso e a padaria pergunta de novo",
      );
    }

    const forasteiros = estado.itens.filter((i) => !daCasa(String(i.produto || "")));
    if (forasteiros.length) {
      estado = { ...estado, itens: estado.itens.filter((i) => daCasa(String(i.produto || ""))) };
      rastro.push(
        "TIREI DO PEDIDO, nao existe no cardapio: " +
        forasteiros.map((i) => i.qtd + "x " + i.produto).join(", "),
      );
    }
  }

  // O COMPROVANTE TEM RESPOSTA PROPRIA, E ELA NAO DIZ QUE O DINHEIRO ENTROU.
  //
  // A padaria pediu o comprovante, ele mandou. Responder a pergunta da etapa
  // ("quer levar docinho junto?") faz quem acabou de pagar achar que ninguem
  // olhou, e foi o que aconteceu na medicao de 01/09/2026.
  //
  // A IA CONFIRMA O RECEBIMENTO DA FOTO, e nao o pagamento: conferir se o valor
  // caiu e coisa de gente, igual aprovar pedido. Dizer "pagamento confirmado"
  // sem alguem ter olhado a conta e o tipo de erro que nao tem desfazer.
  if (ehComprovante) {
    precisaHumano = true;
    motivoHumano = "O cliente mandou o comprovante do pix. Confiram se o valor caiu.";
    fala = {
      ...fala,
      texto:
        "Recebi o comprovante, obrigado. Anexei no seu pedido e a equipe confere " +
        "o pagamento por aqui.",
      botoes: [],
      cardapio: null,
      podeReescrever: false,
    };
    rastro.push("respondi o comprovante e chamei a equipe pra conferir o valor");
  }

  rastro.push("proxima: " + proxima.id);

  // A FRASE SAI ESCRITA DO JEITO QUE SE LÊ.
  //
  // O cardápio da dona foi digitado sem alguns acentos, e o cliente lia
  // "O pao frances é vendido por quilo". O mesmo texto serve pra BUSCAR o
  // produto e pra MOSTRAR, e acentuar o catálogo direto quebrou oito testes em
  // 31/08/2026: meia dúzia de comparações espera a forma crua.
  //
  // Então a grafia é a última coisa que acontece, num ponto só. O catálogo
  // continua intacto, o motor cobra igual, e nada mais no sistema precisa saber
  // que isto existe. Ortografia não é produto novo: "pao frances" e "pão
  // francês" são o mesmo pão, com a mesma chave e o mesmo preço.
  fala = { ...fala, texto: comoOClienteLe(fala.texto) };

  return { fala, estado, etapa: proxima.id, rastro, chamouIA, confirmouEscrevendo, precisaHumano, motivoHumano, fotoEhComprovante: ehComprovante };
}
