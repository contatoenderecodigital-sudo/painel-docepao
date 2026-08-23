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

/** O que a IA pode devolver. Nada alem disto entra no pedido. */
export type Leitura = {
  /** Itens que ele pediu, do vocabulario DESTA etapa. */
  itens?: { produto: string; qtd: number; obs?: string | null }[];
  /** Quantas pessoas vao na festa. */
  pessoas?: number;
  /** Aceitou a base como esta? So vale na etapa da base. */
  aceitouBase?: boolean;
  /** O que ele disse que NAO quer, pra nao oferecer de novo. */
  naoQuer?: string[];
  /** Topo e papel de arroz. So vale na etapa das pecas. */
  pecas?: { topo: boolean; papelDeArroz: boolean };
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
};

const nomes = (lista: { nome: string }[]) => lista.map((i) => String(i.nome));

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
      return [
        ...nomes((catalogo.salgados?.frito?.itens ?? []) as { nome: string }[]),
        ...nomes((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[]),
      ];
    case "docinho":
      return nomes((catalogo.doces?.itens ?? []) as { nome: string }[]);
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
export function instrucaoDaEtapa(etapa: EtapaId, p: PedidoEmMontagem): string {
  const vocab = vocabularioDaEtapa(etapa);
  const lista = vocab.length ? "\n\nO cardápio desta etapa: " + vocab.join(", ") + "." : "";

  const comum =
    "Você é a atendente de uma padaria e está anotando um pedido. " +
    "Leia SÓ a última mensagem do cliente e diga o que mudou no pedido. " +
    "Não escreva resposta pro cliente, não invente valor, não decida a próxima pergunta." +
    String.fromCharCode(10, 10) +
    // DIA, HORA, NOME E PAGAMENTO VALEM EM QUALQUER ETAPA.
    //
    // O cliente nao anda na ordem do sistema. Na conversa da kemilly ele
    // escreveu "dia 02" enquanto a etapa era outra, e o dado se perdia: a
    // padaria perguntava de novo depois, e quem ja tinha respondido acha que
    // ninguem leu.
    //
    // Estes quatro sao a unica excecao ao vocabulario da etapa, e sao seguros
    // porque nao competem com produto nenhum: ninguem confunde uma data com um
    // salgado. Item continua preso a etapa, que e onde mora a ambiguidade.
    "SEMPRE, em qualquer etapa: se ele falar o DIA da retirada, a HORA, o NOME " +
    "de quem retira ou a FORMA DE PAGAMENTO, devolva em dados. Isso vale mesmo " +
    "que a etapa seja outra, porque o cliente fala esses quatro quando lembra.";

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
      "docinho ou de bolo, devolva falouDeOutraEtapa em vez de anotar." + lista,
    docinho:
      "A etapa é ESCOLHER OS DOCINHOS. Só existe docinho aqui: se ele falar de " +
      "bolo ou de salgado, devolva falouDeOutraEtapa em vez de anotar. " +
      "A cor da forminha vai na observação do item." + lista,
    bolo:
      "A etapa é ESCOLHER O BOLO. Só existe sabor de bolo aqui: se ele falar de " +
      "docinho, devolva falouDeOutraEtapa em vez de anotar, MESMO que o nome do " +
      "docinho também seja sabor de bolo (brigadeiro, beijinho). " +
      "O peso em quilos vai na quantidade; o pão de ló vai na observação." + lista,
    pecas_do_bolo:
      "A etapa é TOPO E PAPEL DE ARROZ do bolo. Devolva pecas com topo e " +
      "papelDeArroz, cada um true ou false. O tema e o nome do aniversariante " +
      "vão na observação do bolo.",
    dados:
      "A etapa é PEGAR OS DADOS DA RETIRADA: nome de quem retira, dia, hora e " +
      "forma de pagamento. Devolva só o que ele falou nesta mensagem. " +
      "Data no formato DD/MM/AAAA.",
    confirmacao:
      "A etapa é CONFIRMAR O PEDIDO. Se ele confirmou, não há nada a mudar. " +
      "Se ele pediu para mudar algo, devolva falouDeOutraEtapa com a etapa do " +
      "que ele quer mudar.",
    abertura:
      "A conversa está começando. Descubra se é festa (várias famílias, número " +
      "de pessoas) ou pedido simples (um item, quantidade certa), e devolva o " +
      "que ele já falou.",
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
export function leituraQueCabeNaEtapa(
  etapa: EtapaId,
  leitura: Leitura,
): { limpa: Leitura; barrados: string[] } {
  const vocab = vocabularioDaEtapa(etapa);
  if (!vocab.length || !leitura.itens?.length) return { limpa: leitura, barrados: [] };

  const semAc = (t: string) =>
    String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const permitido = new Set(vocab.map(semAc));

  const barrados: string[] = [];
  const itens = leitura.itens.filter((i) => {
    // O nome pode vir com o sabor colado ("esfirra de carne"): vale o comeco.
    const nome = semAc(i.produto);
    const cabe = [...permitido].some((v) => nome === v || nome.startsWith(v + " "));
    if (!cabe) {
      barrados.push(i.produto);
      return false;
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
      return false;
    }

    return true;
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
  };
}
