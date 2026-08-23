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

import { registrarPedido } from "@/lib/banco/conversas";
import { motorPadrao } from "../orcamento";
import type { Estado } from "./fluxo";

export type PedidoFechado = {
  pedidoId: string;
  totalCentavos: number;
  linhas: { item: string; qtd: number; unidade: "un" | "kg"; unit: number; subtotal: number; obs?: string }[];
};

/** Falta alguma coisa pro pedido poder fechar? Devolve o que falta, em portugues. */
export function oQueFaltaPraFechar(e: Estado): string[] {
  const falta: string[] = [];
  if (!e.itens.length) falta.push("nenhum item no pedido");
  if (!e.dados.data) falta.push("o dia da retirada");
  if (!e.dados.hora) falta.push("a hora da retirada");
  if (!e.dados.nome) falta.push("o nome de quem retira");
  if (!e.dados.pagamento) falta.push("a forma de pagamento");
  // Bolo sem sabor nao se produz: a cozinha fica sem saber o que assar.
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
  const cot = motorPadrao.cotarPorItens(
    e.itens.map((i) => ({ item: i.produto, qtd: i.qtd, obs: i.obs ?? undefined })),
  );
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
    // A EQUIPE APROVA, SEMPRE.
    //
    // Primeira regra que o dono me deu: a IA nunca confirma sozinha. O pedido
    // entra na fila e espera a dona olhar, e so depois vira producao.
    precisaConfirmacao: true,
  });

  return { pedidoId, totalCentavos, linhas };
}
