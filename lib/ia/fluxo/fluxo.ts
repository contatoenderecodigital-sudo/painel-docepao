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
import { falaDaEtapa, pecaDoCardapio, type Fala } from "./pergunta";
import { instrucaoDaEtapa, leituraQueCabeNaEtapa, etapaDesteProduto, type Leitura } from "./leitura";
import { juntarComAFrase, itensDeOutraEtapaNaFrase, produtosNaFrase, familiaDoQueEleNomeou } from "./leitor-da-frase";
import { afirmouOuNegou, cercaDaPalavra, falaDeFotoRecebida, formasDoCliente } from "../texto";
import { identificarProduto } from "./produto";
import { categoriaUnicaDaFamilia, categoriasDaFamilia, chavesDeFamilia, ehNomeDeFamilia, ehPizzaQueNaoESalgado, familiaDoProduto, nomeDaFamilia, opcaoDaFamiliaNaFrase, opcoesDaFamilia } from "./generico";
import { APELIDOS } from "../dados/apelidos";
import { produtoNoComeco, produtoPorNome, produtosDaCasa, coresDoCardapio, unidadeDoPedido } from "../dados/produtos";
import { semAcento as semAc, PALAVRAS_VAZIAS, listaEmPortugues } from "../texto";
import { escreverObs, lerObs, mexerNaObs, type Embalagem } from "@/lib/banco/obs-do-bolo";
import { calcularBase, avisoDePoucoPorSabor, sortidoDaCasa } from "./base";
import { motorPadrao, brl } from "../orcamento";
import { dataDeRetirada, disseQuantidade, pediuPraFalarComGente, respostaAoValor } from "./falas-do-cliente";
import { retiradaForaDoExpediente, avisoDeEspera } from "@/lib/padaria-aberta";
import { coresDaForminha, faltaCorDaForminha, saborQueFalta, recheioQueNaoExiste, MARCA_SABOR_A_CONFIRMAR, saborCabeNaLista, saboresQueFaltam } from "./sabor";
import { restricoesQueACasaNaoFaz, misturaQueACasaFaz, obsSemRestricao, obsPraComanda, avisoDaRestricao } from "./restricao";
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
export type Pensar = (args: { instrucao: string; mensagem: string }) => Promise<Leitura>;

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
 * A DICA QUE O NOME USA PRA DESEMPATAR, QUE NAO E A CATEGORIA DO ITEM.
 *
 * Sai da etapa e do que ele escreveu. A etapa do salgado nao vira
 * `salgado_frito` aqui: isso carimbava pizza e docinho como frito. A do bolo
 * olha a frase (caseiro, festa, kg) e a base da festa (bolo em quilo).
 */
function dicaDaEtapa(etapa: EtapaId, e: PedidoEmMontagem, produto: string, fala: string): string {
  if (etapa === "docinho") return "docinho";
  if (etapa === "salgado") return "salgado";
  if (etapa === "bolo") {
    const t = semAc(produto + " " + fala);
    if (/\bcaseiros?\b/.test(t)) return "bolo_caseiro";
    if (/\bfestas?\b/.test(t) || /\bkg\b/.test(t) || /\bquilos?\b/.test(t)) return "bolo_festa";
    if (e.ehFesta && e.base && Number(e.base.boloKg) > 0) return "bolo_festa";
    return "bolo";
  }
  return "";
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
    const paraRepartir = daFamilia.filter(({ i }) => {
      if (ehNomeDeFamilia(i.produto)) return true;
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
 */
function atualizarBasePeloTotalDito(e: Estado, l: Leitura): Estado {
  if (!e.base || !l.itens?.length) return e;
  const base = { ...e.base };
  let mudou = false;
  for (const i of l.itens) {
    const fam = nomeDaFamilia(i.produto);
    const qtd = Number(i.qtd);
    if (!fam || !(qtd > 0)) continue;
    const pref = prefixoDaFamilia(fam);
    if (pref === "salgado" && base.salgados !== qtd) {
      base.salgados = qtd;
      mudou = true;
    } else if (pref === "docinho" && base.docinhos !== qtd) {
      base.docinhos = qtd;
      mudou = true;
    } else if (pref === "bolo" && base.boloKg !== qtd) {
      base.boloKg = qtd;
      mudou = true;
    }
  }
  return mudou ? { ...e, base } : e;
}

/**
 * ELE PEDIU PRA CASA ESCOLHER. O CODIGO MONTA O SORTIDO.
 *
 * A IA so diz que ele delegou. Os produtos saem do catalogo, na ordem da dona,
 * com a conta dos 20 por sabor. Quem ja escolheu produto de verdade nesta
 * familia nao e sobrescrito: a delegacao nao apaga o que ele nomeou.
 */
function aplicarDelegacao(e: Estado, etapa: EtapaId): Estado {
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
      if (achados.length > 1 && qtdDita === achados.length) {
        for (const s of achados) abertos.push({ ...bruto, qtd: 1, sabor: s });
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
      const dica = dicaDaEtapa(etapa, e, String(i.produto), falaDoCliente);
      const quem = identificarProduto(String(i.produto), dica, falaDoCliente);
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
        const menor = identificarProduto(soDitas, dica, falaDoCliente);
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
      let produto = naoCabeNoBolo(semInvencao(escolhida ?? quem.produto), Number(i.qtd) || 0, falaDoCliente, String(i.produto), String(i.sabor ?? ""), rastro);

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
      if (
        (jaTemGenericoDestaFamilia || jaTemTipoDePizza) &&
        eTipoDePizza &&
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
          const depois = t.slice(inicio + alvo.length).trim().split(/\s+/).slice(0, 4).join(" ");
          const primeiraDoSabor = sabor.split(/\s+/)[0] ?? sabor;
          return depois.includes(primeiraDoSabor);
        })();
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
      obsItem = obsPraComanda(obsItem);

      // O PESO DO BOLO E QUANTIDADE, NAO OBSERVACAO.
      //
      // "um bolo de 2 kg de 4 leites": o modelo manda qtd 1 e escreve "2 kg" na
      // observacao. O bolo sai cobrado como UMA unidade, R$ 46,90 em vez de
      // R$ 93,80. Bolo e vendido por quilo, entao o numero de quilos que ele
      // falou E a quantidade.
      let qtd = Number(i.qtd) || 0;
      if (String(categoria).startsWith("bolo")) {
        const dito = falaDoCliente + " " + String(i.obs ?? "");
        const kg = (dito.match(/([0-9]+(?:[.,][0-9]+)?) *(?:kg|quilos?)(?![a-z])/i) ?? [])[1];
        const peso = kg ? Number(String(kg).replace(",", ".")) : 0;
        if (peso > 0 && peso <= 30) qtd = peso;
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
        const aqui = saborPedido ? semAc(saborPedido) : "";
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
        itens[achou] = { ...itens[achou], ...linha, obs: obsPraComanda(semRepetir.join(" | ")) };
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

  novo = atualizarBasePeloTotalDito(novo, l);
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
  const opcoesEsperando = novo.itens.flatMap((i) => saborQueFalta(i.produto, i.obs)?.opcoes ?? []);
  const escolheuUmaOpcao = opcoesEsperando.some((o) => {
    const alvo = semAc(String(o));
    return alvo.length > 2 && semAc(falaDoCliente).includes(alvo) &&
      afirmouOuNegou(semAc(falaDoCliente), cercaDoSabor(alvo)) !== false;
  });
  if (l.delegaEscolha === true && escolheuUmaOpcao) {
    rastro.push("o modelo leu como \"escolhe voce\", mas ele respondeu uma opcao da lista; nao deleguei");
  }
  const delegou = l.delegaEscolha === true && !escolheuUmaOpcao;
  if (delegou) novo = aplicarDelegacao(novo, etapa);

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

export async function responder(
  estadoAtual: Estado,
  mensagem: { texto: string; botaoId?: string | null },
  pensar: Pensar,
  // O roteiro pode vir de fora (os testes passam o deles). Sem ele, quem
  // escolhe e o tipo do pedido, e a escolha e refeita DEPOIS de ler a mensagem:
  // "festa pra 20 pessoas" troca o roteiro no meio da propria mensagem.
  etapas: Etapa[] | null = null,
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
  let leituraDesteTurno: Leitura | null = null;

  const roteiro = () => etapas ?? roteiroDoPedido(estado);
  const etapaAgora = etapaDaVez(estado, roteiro());
  rastro.push("etapa: " + etapaAgora.id);

  // ---------------------------------------------------------------- botao
  // QUEM DIGITA "SIM" RESPONDEU IGUAL A QUEM TOCOU NO BOTAO.
  //
  // Medido conversando com o servidor em 31/08/2026, e custava R$ 12,00 mais o
  // topo:
  //
  //   padaria >> E papel de arroz, com a foto impressa no bolo? Fica R$ 12,00.
  //   cliente >> Sim
  //   padaria >> O bolo vai com topo?
  //   cliente >> Sim
  //   banco   >> fluxo_topo = (vazio)   fluxo_papel = (vazio)
  //
  // As duas respostas se perderam. O texto livre vai pro modelo, e pra "Sim"
  // seco ele devolveu leitura vazia: nenhuma das duas pecas foi anotada, o papel
  // de arroz nao virou linha, e as perguntas do tema e do que vai escrito foram
  // puladas, porque elas so existem quando ha peca.
  //
  // Muita gente digita em vez de tocar no botao, e a padaria nao pode depender
  // do modelo pra entender um "sim". O leitor de sim e nao ja existia neste
  // repositorio (`respostaAoValor`), so nao era chamado aqui.
  //
  // Vale so quando a pergunta da vez FOI a da peca, e so quando a peca ainda
  // nao tem resposta: assim um "sim" solto no meio da conversa nao liga peca
  // nenhuma.
  const umaPecaEsperando =
    estado.pecas?.papelDeArroz === null || estado.pecas?.papelDeArroz === undefined
      ? "papel"
      : estado.pecas?.topo === null || estado.pecas?.topo === undefined
        ? "topo"
        : null;
  const ultimaPerguntou = semAc(String(estado.ultimaFala || ""));
  const simOuNao = mensagem.botaoId ? null : respostaAoValor(String(mensagem.texto || ""));
  // O QUE MANDA E A PERGUNTA QUE ACABOU DE SAIR, E NAO A ETAPA DA VEZ.
  //
  // Aqui exigia `etapaAgora.id === "pecas_do_bolo"`, e por isso o "Sim" do TOPO
  // continuava se perdendo depois que o do papel passou a funcionar. Medido
  // conversando com o servidor em 31/08/2026:
  //
  //   padaria >> E papel de arroz...?   cliente >> Sim   -> papel_sim, gravou
  //   padaria >> O bolo vai com topo?   cliente >> Sim   -> etapa ja era "dados"
  //
  // A maquina de etapas marca a etapa como cumprida quando as perguntas dela
  // foram FEITAS, e nao quando foram respondidas. Entao no turno em que o
  // cliente responde o topo, a etapa da vez ja e outra.
  //
  // A pergunta que acabou de sair e o que um atendente usaria pra saber do que
  // a pessoa esta falando, e e o que vale aqui: a peca ainda sem resposta, e a
  // ultima fala da padaria sendo sobre ela.
  const botaoDigitado =
    umaPecaEsperando && simOuNao
      ? umaPecaEsperando === "papel" && ultimaPerguntou.includes("papel")
        ? "papel_" + (simOuNao === "aceitou" ? "sim" : "nao")
        : umaPecaEsperando === "topo" && ultimaPerguntou.includes("topo")
          ? "topo_" + (simOuNao === "aceitou" ? "sim" : "nao")
          : null
      : null;

  if (mensagem.botaoId && DO_BOTAO[mensagem.botaoId]) {
    estado = DO_BOTAO[mensagem.botaoId](estado);
    rastro.push("botao: " + mensagem.botaoId + " (sem chamar a IA)");
  } else if (botaoDigitado && DO_BOTAO[botaoDigitado]) {
    estado = DO_BOTAO[botaoDigitado](estado);
    rastro.push("ele digitou a resposta do botao " + botaoDigitado + " (sem chamar a IA)");
  } else if (mensagem.texto.trim()) {
    // ----------------------------------------------------------- texto livre
    const instrucao = instrucaoDaEtapa(etapaAgora.id, estado);
    const crua = await pensar({ instrucao, mensagem: mensagem.texto });
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

    const { limpa, barrados, naoExistem, paraDepois } = leituraQueCabeNaEtapa(etapaAgora.id, crua);
    if (barrados.length) rastro.push("barrado nesta etapa: " + barrados.join(", "));

    // O QUE ESTA ESCRITO NA FRASE E O MODELO NAO LEU.
    //
    // Guardar item barrado nao cobre tudo: para ser barrado ele precisa ter
    // sido LIDO. Quando a instrucao da etapa nao fala daquela familia, o modelo
    // nem extrai. Foi o caso de "50 brigadeiro, forminha rosa, e um bolo de
    // 2 kg de 4 leites" na etapa da oferta: o brigadeiro entrou, o bolo nao, e
    // a padaria perguntou o sabor do bolo duas vezes ate a conversa morrer.
    const doTextoParaDepois = itensDeOutraEtapaNaFrase(
      String(mensagem.texto ?? ""),
      (produto) => etapaDesteProduto(produto) === etapaAgora.id,
    )
      .filter((p) => !(limpa.itens ?? []).some((i) => i.produto.toLowerCase() === p.produto.toLowerCase()))
      // A PALAVRA QUE JA E SABOR DE UM ITEM DESTA LEITURA NAO GERA ITEM NOVO.
      //
      // Medido em 31/08/2026, num pedido banal:
      //
      //   cliente >> quero 50 docinhos de morango
      //   modelo  >> 50x docinho [morango]
      //   frase   >> achei "morango" e anotei: bolo
      //   pedido  >> 50x docinho (morango)  E  50x bolo
      //
      // "morango" e sabor de docinho e nome de bolo de festa ao mesmo tempo, e
      // e uma das oito palavras do cardapio que sao produto E sabor. O leitor da
      // frase acha o bolo na mesma palavra que o modelo ja tinha dado ao
      // docinho, e o pedido ganha uma linha que ninguem pediu.
      //
      // E a mesma regra do `donoNaFrase`, um andar acima: palavra com dono nesta
      // leitura nao esta sobrando.
      .filter((p) => {
        const alvo = semAc(p.produto);
        const temDono = (limpa.itens ?? []).some((i) =>
          semAc(String(i.sabor ?? "") + " " + String(i.obs ?? "")).includes(alvo),
        );
        if (temDono) {
          rastro.push("nao anotei \"" + p.produto + "\" da frase: ja e sabor de outro item desta mensagem");
        }
        return !temDono;
      })
      // Ja esta no pedido, mesmo escrito de outro jeito? Entao nao guarda.
      .filter((p) => !jaTemEsseProduto(estado.itens, p.produto))
      // Guarda ja com o nome canonico. Estacionar "4 leites" e aplicar como
      // "bolo 4 leites" era a origem do mesmo bolo com dois nomes.
      //
      // O "BOLO" DA FRASE TEM QUE VIR JUNTO, SENAO O BOLO VIRA DOCINHO.
      //
      // `identificarProduto` era chamado sem dica nenhuma, e o comentario logo
      // abaixo afirmava que a ambiguidade "ja foi resolvida". Nao foi: sem dica,
      // "brigadeiro" resolve pro DOCINHO, que e R$ 1,25 a unidade, e o bolo de
      // brigadeiro e R$ 46,90 o quilo.
      //
      // O caminho e estreito e existe: quem acha o produto aqui e o leitor da
      // frase, e ele so procura nome de produto avulso, sem o prefixo. Entao "um
      // bolo de brigadeiro" chega aqui como "brigadeiro" puro. Quando o modelo
      // tambem le o item, o filtro logo acima mata a duplicata e ninguem ve;
      // quando ele se distrai (que e a razao deste bloco existir), entra um
      // docinho no lugar do bolo.
      //
      // A frase sabe: se o cliente escreveu "bolo" na frente, o prefixo volta e
      // `identificarProduto` resolve pelo nome completo, que e o desempate que o
      // proprio sistema ja usa. Achado lendo linha por linha em 27/08/2026.
      .map((p) => {
        const frase = semAc(String(mensagem.texto ?? ""));
        const onde = frase.indexOf(semAc(p.produto));
        // "bolo de brigadeiro" e "bolo brigadeiro": ate uma preposicao no meio.
        const antes = onde > 0 ? frase.slice(Math.max(0, onde - 12), onde) : "";
        const ehBolo = /\bbolo\s+(de\s+|da\s+|do\s+)?$/.test(antes);
        // E SO SE O BOLO EXISTIR DE VERDADE.
        //
        // "bolo de leite ninho" nao e produto da casa: leite ninho e docinho, e
        // o caseiro parecido chama "chocolate preto com leite ninho". Com o
        // prefixo colado sem conferir, entrava um "bolo leite ninho" que o
        // cardapio nao conhece e que ficaria sem preco no pedido.
        //
        // Trocar um erro de R$ 1,25 por uma linha sem preco nao e conserto. Se o
        // bolo existe, vale o bolo; se nao existe, vale o que o cliente falou, e
        // a padaria pergunta o sabor como ja faz pro que ela nao acha.
        const fala = String(mensagem.texto ?? "");
        const comBolo = ehBolo ? identificarProduto("bolo " + p.produto, undefined, fala).produto : null;
        const boloDeVerdade = comBolo && produtoPorNome(comBolo) ? comBolo : null;
        // A MESMA GUARDA DO OUTRO CAMINHO. Este injetor resolvia o nome por
        // conta propria, e por isso "quero 50 de limao" escapava dela e virava
        // 50 bolos caseiros de limao, R$ 1.545,00. Regra que vale num caminho e
        // nao no outro e regra que so protege metade dos pedidos.
        const canonico = boloDeVerdade ?? identificarProduto(p.produto, undefined, fala).produto;
        return { ...p, produto: naoCabeNoBolo(canonico, Number(p.qtd) || 0, fala, String(p.produto), "", rastro) };
      });
    if (doTextoParaDepois.length) {
      // ENTRA AGORA, NAO DEPOIS.
      //
      // Isto era guardado, e guardar custava SEMPRE um turno: o item e achado
      // JUSTAMENTE por ser de outra etapa, e o guardado so entra quando a
      // conversa chega naquela etapa, que e a mensagem seguinte.
      //
      // Medido em 26/08/2026, uma conversa contra o banco: o cliente escreveu
      // "um bolo de 2 kg de 4 leites" na primeira mensagem e ouviu de volta
      // "E o bolo, qual sabor?". O bolo tinha sido achado, guardado, e a
      // pergunta saiu mesmo assim. O pedido so fechava um turno depois, e nos
      // cenarios de duas mensagens ele nunca fechava.
      //
      // Entrar direto e seguro porque estes itens NAO sao palpite: sairam do
      // leitor deterministico contra o cardapio e ja vem com o nome canonico.
      // A ambiguidade que justificava a etapa ("brigadeiro" e docinho ou bolo?)
      // ja foi resolvida por `identificarProduto` la em cima.
      //
      // E e o que uma atendente faz: voce falou o bolo, ela anota o bolo, mesmo
      // estando no meio dos salgados.
      limpa.itens = [...(limpa.itens ?? []), ...doTextoParaDepois];
      rastro.push("achei na frase e anotei: " + doTextoParaDepois.map((d) => d.produto).join(", "));
    }

    // ITEM CITADO FORA DA HORA FICA GUARDADO, NAO E JOGADO FORA.
    if (paraDepois.length) {
      const jaGuardados = estado.guardados ?? [];
      const novos = paraDepois.filter(
        (p) => !jaGuardados.some((g) => g.produto.toLowerCase().trim() === p.produto.toLowerCase().trim()),
      );
      if (novos.length) {
        estado = { ...estado, guardados: [...jaGuardados, ...novos] };
        rastro.push("guardado pra depois: " + novos.map((n) => n.produto).join(", "));
      }
    }

    // E CHEGOU A HORA DE ALGUM QUE ESTAVA GUARDADO? Entra junto com esta leitura.
    if (estado.guardados?.length) {
      const agora = estado.guardados.filter(
        (g) => etapaDesteProduto(g.produto) === etapaAgora.id && !jaTemEsseProduto(estado.itens, g.produto),
      );
      // O que ja entrou por outro caminho sai da lista sem virar item de novo.
      const jaEntrou = estado.guardados.filter((g) => jaTemEsseProduto(estado.itens, g.produto));
      if (jaEntrou.length) {
        estado = {
          ...estado,
          guardados: estado.guardados.filter((g) => !jaEntrou.includes(g)),
        };
        rastro.push("guardado ja estava no pedido: " + jaEntrou.map((j) => j.produto).join(", "));
      }
      if (agora.length) {
        limpa.itens = [...(limpa.itens ?? []), ...agora];
        estado = {
          ...estado,
          guardados: (estado.guardados ?? []).filter((g) => !agora.includes(g)),
        };
        rastro.push("entrou o que estava guardado: " + agora.map((a) => a.produto).join(", "));
      }
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
    const nomeouProduto = produtosNaFrase(String(mensagem.texto ?? "")).length > 0;
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
    const lida = juntarComAFrase(limpa, String(mensagem.texto ?? ""));
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
        estado,
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
    const pediuItemNesteTurno = (lida.itens ?? []).length > 0;
    const soMencionouProduto = !pediuItemNesteTurno && produtosNaFrase(falaCru).length > 0;
    const eQueixa = limpa.situacao === "reclamacao" || limpa.situacao === "cancelar";
    const temProdutoNesteTurno =
      pediuItemNesteTurno || (soMencionouProduto && !eQueixa);
    if (limpa.situacao && !temProdutoNesteTurno) {
      const r = respostaDaSituacao(limpa.situacao, estado.itens.length > 0 || Boolean(estado.dados.data));
      rastro.push("situacao: " + limpa.situacao + (r.precisaHumano ? "; chamei a equipe" : ""));
      return {
        fala: { texto: r.texto, botoes: [], cardapio: null, podeReescrever: false },
        estado,
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

      const perguntouOTotal =
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
        : respostaDeInformacao(limpa.perguntou);
      if (resposta) {
        rastro.push("ele perguntou sobre " + limpa.perguntou.sobre + "; respondi sem anotar nada");
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
    if (!estado.tema && falaDeFotoRecebida(mensagem.texto)) {
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
  const semMisto = (obs?: string | null) =>
    String(obs ?? "")
      .split(" | ")
      .filter((p) => p.trim() && !/^misto\s*:/i.test(p.trim()))
      .join(" | ") || null;

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
                  .flatMap((o) => String(o).split(" | "))
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

  let fala = falaDaEtapa(proxima, estado, total, proxima.id === etapaAgora.id ? naoTemos : []);

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
      fala = falaDaEtapa(proxima, estado, total, proxima.id === etapaAgora.id ? naoTemos : []);
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
  if (foraDoHorario) {
    return {
      fala: {
        ...fala,
        texto: foraDoHorario + (fala.texto ? "\n\n" + fala.texto : ""),
        podeReescrever: false,
      },
      estado, etapa: proxima.id, rastro, chamouIA, confirmouEscrevendo, precisaHumano, motivoHumano,
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

    const forasteiros = estado.itens.filter((i) => !daCasa(String(i.produto || "")));
    if (forasteiros.length) {
      estado = { ...estado, itens: estado.itens.filter((i) => daCasa(String(i.produto || ""))) };
      rastro.push(
        "TIREI DO PEDIDO, nao existe no cardapio: " +
        forasteiros.map((i) => i.qtd + "x " + i.produto).join(", "),
      );
    }
  }

  rastro.push("proxima: " + proxima.id);


  return { fala, estado, etapa: proxima.id, rastro, chamouIA, confirmouEscrevendo, precisaHumano, motivoHumano };
}
