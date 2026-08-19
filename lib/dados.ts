// ============================================================================
//  FONTE DE DADOS — decide entre banco real e mock.
//  Com banco configurado, lê do banco escopado pelo negocioId (do login).
//  Sem banco, cai no mock — o painel sempre abre, mesmo em demo.
//  As telas não sabem a diferença: recebem sempre o tipo `Pedido`.
// ============================================================================

import { cache } from "react";
import { bancoConfigurado } from "./banco/db";
import { PEDIDOS_MOCK, ORCAMENTOS_PARADOS_MOCK, METRICAS_MOCK } from "./mock";
import type { Pedido } from "./tipos";

// cache(): dentro da MESMA requisição, o layout e a página compartilham o
// resultado (a fila é buscada 1x, não 2x). Menos ida ao banco = navegação mais lisa.
export const carregarFilaAprovacao = cache(async (negocioId?: string): Promise<Pedido[]> => {
  if (!bancoConfigurado || !negocioId) {
    return PEDIDOS_MOCK.filter((p) => p.status === "confirmado");
  }
  const { listarFilaAprovacao } = await import("./banco/pedidos");
  return listarFilaAprovacao(negocioId);
});

// Pendentes de humano: a fila de aprovação passou a NÃO trazer esses (aprovar
// um pedido sem o valor do topo mandava o pedido incompleto pro cliente).
export const carregarAguardandoConfirmacao = cache(async (negocioId?: string): Promise<Pedido[]> => {
  if (!bancoConfigurado || !negocioId) {
    return PEDIDOS_MOCK.filter((p) => p.status === "confirmado" && p.precisaConfirmacao);
  }
  const { listarAguardandoConfirmacao } = await import("./banco/pedidos");
  return listarAguardandoConfirmacao(negocioId);
});

// Orcamento parado nao mora em pedidos: mora na montagem da conversa, onde a
// Dora anota o que o cliente foi pedindo. Quem montou e sumiu tem itens la e
// nenhuma linha em pedidos. Ate hoje isso lia status 'orcado' da tabela de
// pedidos, que nenhum caminho do codigo jamais grava: a tela vivia vazia.
export async function carregarParados(negocioId?: string): Promise<Pedido[]> {
  if (!bancoConfigurado || !negocioId) return ORCAMENTOS_PARADOS_MOCK;
  const { listarParados } = await import("./banco/parados");
  return listarParados(negocioId);
}

// Resultado da recuperação (o card "recuperados este mês" que prova o valor).
// Em demo, vem das métricas mock. Com banco real, soma os pedidos que fecharam
// depois de pelo menos uma cobrança automática (a prova de que a cobrança paga).
export type StatsRecuperacao = {
  recuperadoCentavos: number;
  recuperadosQtd: number;
  temDados: boolean;
};
export async function carregarStatsRecuperacao(negocioId?: string): Promise<StatsRecuperacao> {
  if (!bancoConfigurado || !negocioId) {
    return {
      recuperadoCentavos: METRICAS_MOCK.valorRecuperadoCentavos,
      recuperadosQtd: METRICAS_MOCK.orcamentosRecuperados,
      temDados: true,
    };
  }
  try {
    const { recuperadoNoMes } = await import("./banco/pedidos");
    const r = await recuperadoNoMes(negocioId);
    // temDados diz se ha o que mostrar: zero de verdade continua sendo zero.
    return { ...r, temDados: r.recuperadosQtd > 0 };
  } catch (e) {
    console.error("[recuperacao] falha ao somar:", e);
    return { recuperadoCentavos: 0, recuperadosQtd: 0, temDados: false };
  }
}

// Pedidos aprovados (a producao do dia). Sem banco, cai no mock.
export async function carregarDoDia(negocioId?: string): Promise<Pedido[]> {
  if (!bancoConfigurado || !negocioId) return PEDIDOS_MOCK;
  const { listarDoDia } = await import("./banco/pedidos");
  return listarDoDia(negocioId);
}

// Clientes (CRM). Sem banco, cai no mock.
export async function carregarClientes(negocioId?: string) {
  if (!bancoConfigurado || !negocioId) {
    const { CLIENTES_MOCK } = await import("./mock");
    return CLIENTES_MOCK;
  }
  const { listarClientes } = await import("./banco/clientes");
  return listarClientes(negocioId);
}

export async function carregarConversas(negocioId?: string) {
  if (!bancoConfigurado || !negocioId) {
    const { CONVERSAS_MOCK } = await import("./mock");
    return CONVERSAS_MOCK;
  }
  const { listarConversas } = await import("./banco/atendimentos");
  return listarConversas(negocioId);
}
