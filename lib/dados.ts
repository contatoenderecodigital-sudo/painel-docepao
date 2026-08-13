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

export async function carregarParados(negocioId?: string): Promise<Pedido[]> {
  if (!bancoConfigurado || !negocioId) return ORCAMENTOS_PARADOS_MOCK;
  const { listarParados } = await import("./banco/pedidos");
  return listarParados(negocioId);
}

// Resultado da recuperação (o card "recuperados este mês" que prova o valor).
// Em demo, vem das métricas mock. Com banco real, ainda não há rastreio de
// recuperação, então volta honesto (temDados=false -> a UI mostra travessão).
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
  return { recuperadoCentavos: 0, recuperadosQtd: 0, temDados: false };
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
