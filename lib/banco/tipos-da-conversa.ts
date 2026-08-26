// ============================================================================
//  OS TIPOS DA CONVERSA E DO PEDIDO GRAVADO
//
//  POR QUE ISTO EXISTE
//
//  Os dois moravam em `lib/ia/cerebro.ts`, o cérebro antigo. Não era a casa
//  deles: `Mensagem` é o formato que a persistência usa, e `PedidoParaGravar` é
//  o que o banco precisa receber. Nenhum dos dois é decisão de IA.
//
//  Ficaram lá porque o cérebro antigo era o único que gravava pedido. Quando ele
//  foi apagado, em 26/08/2026, os dois vieram para cá, que é onde já vive quem
//  os usa.
//
//  DESACOPLADO DO SDK DE PROPÓSITO. `Mensagem` não é o tipo da OpenAI nem da
//  Anthropic: é o formato da casa. Foi assim que dava para trocar de provedor
//  sem mexer no banco, e continua sendo.
// ============================================================================

import type { LinhaCotacao } from "@/lib/ia/orcamento";

/** Uma fala da conversa, do jeito que o banco guarda. */
export type Mensagem = { role: "user" | "assistant"; content: string };

/**
 * O PEDIDO PRONTO PARA GRAVAR.
 *
 * As linhas já vêm calculadas pelo motor de orçamento, e isso é regra: o banco
 * não recalcula preço. Se recalculasse, existiriam duas contas para o mesmo
 * pedido e um dia elas divergiriam.
 */
export type PedidoParaGravar = {
  itens: { item: string; qtd: number; obs?: string }[];
  linhas: LinhaCotacao[];
  retiradaData: string;
  retiradaHora?: string;
  formaPagamento?: string;
  observacoes?: string;
  clienteNome?: string;
  totalCentavos: number;
  /**
   * O pedido está montado mas depende da equipe para fechar.
   *
   * Cai na fila de aprovação JÁ MONTADO, com o aviso na frente, em vez de virar
   * um beco em que o cliente fica esperando alguém aparecer. O caso mais comum
   * é o topo de bolo, cujo valor só a equipe sabe.
   */
  precisaConfirmacao?: boolean;
  /** O que a equipe precisa resolver. Vira o texto que a dona lê no painel. */
  motivoHumano?: string;
};
