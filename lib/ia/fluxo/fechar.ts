// ============================================================================
//  O FECHAMENTO DO PEDIDO
//
//  O cliente tocou em Confirmar. Aqui a conversa vira pedido: passa pelo motor
//  de preco, vai pra fila da dona, e de la pra impressora.
//
//  NADA DISTO E NOVO
//
//  registrarPedido, o motor de preco, o painel e a impressao ja existem e nunca
//  deram problema. Esta peca so amarra o fluxo novo neles. O que mudou foi o
//  jeito de conduzir a conversa; o pedido continua sendo o mesmo pedido.
//
//  AS TRES TRAVAS QUE FICAM AQUI
//
//  1. PEDIDO SEM ITEM NAO FECHA. Ja aconteceu de um "Ok" do cliente zerar um
//     pedido de verdade: a lista vazia sobrescrevia as linhas e a encomenda
//     virava R$ 0,00 na tela dele. registrarPedido tambem recusa, e a trava
//     daqui existe pra a conversa nao chegar la sabendo que vai falhar.
//
//  2. O TOTAL E O DO MOTOR. O mesmo que escreveu a base e o resumo. Se o motor
//     errar, erram os tres juntos, e o cliente nunca ve um numero na proposta,
//     outro na confirmacao e um terceiro na comanda.
//
//  3. QUEM APROVA E A EQUIPE. O pedido entra como "precisa confirmacao" e fica
//     esperando a dona. A IA nunca confirma sozinha: foi a primeira regra que
//     o dono me deu neste projeto, e continua valendo.
// ============================================================================

import { registrarPedido, grudarFotosNoPedido } from "@/lib/banco/conversas";
import { motorPadrao } from "../orcamento";
import type { Estado } from "./fluxo";
import { prazoDoTopoAperta } from "./falas-do-cliente";
import { saboresQueFaltam } from "./sabor";
import { paraOMotor } from "./cotar";

/**
 * O QUE A EQUIPE PRECISA RESOLVER NESTE PEDIDO.
 *
 * Vai escrito na frente do pedido, na tela de espera do painel. Sao as duas
 * coisas que a Dora nao pode decidir sozinha:
 *
 *   O VALOR DO TOPO. Audio da dona, 11/08/2026: "se for so o nome, de 15 a 20
 *   reais; topo completo, 30; com flores e muito dourado, de 35 a 40. Ela vai
 *   ter que sempre confirmar com nos". Por isso a Dora nunca diz o valor.
 *
 *   O PRAZO DO TOPO. Audio de 29/07/2026: "tem que ser encomendado com dois
 *   dias de antecedencia, e no maximo ate sexta-feira; nao e nos que fazemos, a
 *   gente encomenda". Em cima da hora, quem confirma com a fornecedora e a
 *   equipe.
 */
function motivoParaAEquipe(e: Estado): string | undefined {
  if (e.pecas?.topo !== true) return undefined;
  const partes = [
    "Topo de bolo (tema " + e.tema + ", " + e.topoNome + ", " + e.topoIdade +
      "): falta a equipe lançar o valor.",
  ];
  const aperta = prazoDoTopoAperta(e.dados.data);
  if (aperta) partes.push("Atenção ao prazo: " + aperta + ".");
  return partes.join(" ");
}

export type PedidoFechado = {
  pedidoId: string;
  totalCentavos: number;
  linhas: { item: string; qtd: number; unidade: "un" | "kg"; unit: number; subtotal: number; obs?: string }[];
};

/** Falta alguma coisa pro pedido poder fechar? Devolve o que falta, em portugues. */
export function oQueFaltaPraFechar(e: Estado): string[] {
  const falta: string[] = [];
  if (!e.itens.length) falta.push("nenhum item no pedido");
  // ITEM SEM QUANTIDADE NAO SE PRODUZ.
  //
  // Na festa o cliente escolhe o sabor e o numero vem da proposta, entao existe
  // um instante em que o item esta anotado com zero. Se a proposta nao repartir
  // (porque ele nao aceitou nenhuma, por exemplo), esse zero nao pode virar
  // comanda: a cozinha receberia "0 coxinha".
  for (const i of e.itens) {
    if (!(Number(i.qtd) > 0)) falta.push("quantos " + i.produto + " você quer");
  }
  if (!e.dados.data) falta.push("o dia da retirada");
  if (!e.dados.hora) falta.push("a hora da retirada");
  if (!e.dados.nome) falta.push("o nome de quem retira");
  if (!e.dados.pagamento) falta.push("a forma de pagamento");
  // SABOR EM ABERTO E BURACO NO PEDIDO, E VALE PRA CASA INTEIRA.
  //
  // Nao so na festa: trufa, cuca recheada, empadao, torta, franciscano, esfirra.
  // Quem diz o que pede escolha e o catalogo, item por item.
  for (const f of saboresQueFaltam(e.itens)) {
    falta.push("o sabor do " + f.produto);
  }

  // Bolo sem sabor nao se produz: a cozinha fica sem saber o que assar.
  // TOPO SEM NOME E IDADE NAO SE PRODUZ.
  //
  // Cada topo e fabricado com o tema, o nome e o numero. Fechar assim manda pra
  // cozinha uma peca que ninguem sabe montar, e a equipe teria que ligar pro
  // cliente pra perguntar o que a conversa ja podia ter perguntado.
  if (e.pecas?.topo === true || e.pecas?.papelDeArroz === true) {
    if (!e.tema) falta.push("o tema da peça");
    if (!e.topoNome) falta.push("o nome do aniversariante");
    if (!e.topoIdade) falta.push("a idade do aniversariante");
  }
  const boloSemSabor = e.itens.find(
    (i) => String(i.categoria).startsWith("bolo") && String(i.produto).trim().toLowerCase() === "bolo",
  );
  if (boloSemSabor) falta.push("o sabor do bolo");
  return falta;
}

/**
 * FECHA O PEDIDO.
 *
 * Devolve null quando falta alguma coisa: quem decide o que fazer com isso e o
 * fluxo, que sabe qual etapa perguntar.
 */
export async function fecharPedido(
  negocioId: string,
  clienteId: string,
  e: Estado,
): Promise<PedidoFechado | null> {
  if (oQueFaltaPraFechar(e).length) return null;

  // O PRECO SAI DO MOTOR, NUNCA DA CONVERSA.
  const cot = motorPadrao.cotarPorItens(paraOMotor(e.itens));
  const linhas = (cot.linhas ?? []).map((l) => ({
    item: String(l.item),
    categoria: String(l.categoria ?? ""),
    qtd: Number(l.qtd) || 0,
    // "un" ou "kg", nao string qualquer: a unidade decide como o cupom escreve
    // a linha e como o painel mostra o campo.
    unidade: (l.unidade === "kg" ? "kg" : "un") as "un" | "kg",
    unit: Number(l.unit) || 0,
    subtotal: Number(l.subtotal) || 0,
    // undefined, nao null: e o que LinhaCotacao espera, e foi o compilador que
    // pegou a diferenca. Observacao vazia gravada como null vira "null" escrito
    // na comanda em alguns caminhos.
    obs: l.obs ?? undefined,
  }));

  // A cotacao pode voltar vazia se nenhum item bater com o cardapio. Fechar
  // assim apagaria o pedido de verdade que estivesse gravado.
  if (!linhas.length) {
    console.error("[fluxo] o motor nao achou nenhum item do pedido; nao fecho:", e.itens.map((i) => i.produto).join(", "));
    return null;
  }

  const totalCentavos = Math.round(Number(cot.total || 0) * 100);

  const pedidoId = await registrarPedido(negocioId, clienteId, {
    // `itens` e o que o cliente pediu; `linhas` e o que o motor cotou. Os dois
    // vao porque o banco guarda um e o cupom sai do outro.
    itens: e.itens.map((i) => ({ item: i.produto, qtd: i.qtd, obs: i.obs ?? undefined })),
    clienteNome: e.dados.nome ?? undefined,
    retiradaData: String(e.dados.data),
    retiradaHora: e.dados.hora ?? undefined,
    formaPagamento: e.dados.pagamento ?? undefined,
    totalCentavos,
    linhas,
    // AS DUAS FILAS DO PAINEL SAO COISAS DIFERENTES, E EU TROQUEI AS BOLAS.
    //
    // APROVACAO e a fila normal: o pedido esta completo e so espera a dona
    // olhar e aprovar. E o caminho de quase todo pedido.
    //
    // AGUARDANDO CONFIRMACAO e pra pedido que a equipe precisa RESOLVER antes
    // de poder aprovar: hoje, so o topo de bolo, que nao tem preco de tabela e
    // alguem precisa lancar.
    //
    // Eu marcava TODO pedido como "precisa confirmacao", achando que era "a
    // equipe precisa aprovar". Resultado no teste de 23/08/2026: um pedido sem
    // topo nenhum caiu na tela de espera com "falta confirmar detalhe com o
    // cliente", e nao havia detalhe nenhum a confirmar. Palavras do dono: "nao
    // tem nada pra padaria confirmar valor ne fiot".
    //
    // A regra que continua valendo, e ela nunca esteve em duvida: a IA NUNCA
    // confirma sozinha. Todo pedido passa pela dona; o que muda e em qual fila
    // ele espera.
    precisaConfirmacao: Boolean(motivoParaAEquipe(e)),
    // E QUANDO TEM TOPO, A DONA PRECISA SABER QUE FALTA LANCAR O VALOR.
    //
    // O topo e o unico item da casa sem preco de tabela: o total que o cliente
    // viu esta certo e nao inclui o topo. O painel ja tem tela propria pra
    // pedido que espera a equipe, e o motivo aparece na frente dele.
    motivoHumano: motivoParaAEquipe(e),
  });

  // AS FOTOS DE REFERENCIA VIRAM FOTOS DESTE PEDIDO.
  //
  // Elas ja eram salvas, mas ficavam soltas: a equipe nao via na hora de
  // aprovar, que e exatamente quando ela precisa olhar o bolo. Falha nao
  // impede o pedido de existir, entao vai com catch.
  await grudarFotosNoPedido(negocioId, clienteId, pedidoId).catch((e) =>
    console.error("[fluxo] falha ao grudar as fotos no pedido:", e),
  );

  return { pedidoId, totalCentavos, linhas };
}
