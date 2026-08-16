"use server";

// ============================================================================
//  AÇÕES DO PAINEL (Server Actions) — rodam no servidor, mexem no banco.
//  Aprovar -> status 'aprovado' -> trigger cria a linha na fila de impressão
//  -> a ponte na padaria imprime. Recusar -> status 'recusado'.
//
//  Sem banco configurado (demo), são no-op: a animação da tela já resolve.
// ============================================================================

import { bancoConfigurado } from "@/lib/banco/db";
import { lerSessao } from "@/lib/auth";

export async function aprovarPedido(pedidoId: string): Promise<{ ok: boolean }> {
  if (!bancoConfigurado) return { ok: true };
  const sessao = await lerSessao();
  if (!sessao) return { ok: false };
  const { mudarStatus } = await import("@/lib/banco/pedidos");
  await mudarStatus(pedidoId, "aprovado", sessao.negocioId);
  return { ok: true };
}

export async function recusarPedido(pedidoId: string): Promise<{ ok: boolean }> {
  if (!bancoConfigurado) return { ok: true };
  const sessao = await lerSessao();
  if (!sessao) return { ok: false };
  const { mudarStatus } = await import("@/lib/banco/pedidos");
  await mudarStatus(pedidoId, "recusado", sessao.negocioId);
  return { ok: true };
}

// Reimprime um pedido JÁ APROVADO: recoloca um job 'pendente' na fila de
// impressão (mesmo formato do trigger on_pedido_aprovado), e a ponte imprime de
// novo no próximo poll. Em demo (sem banco) é no-op de sucesso.
export async function reimprimirPedido(pedidoId: string): Promise<{ ok: boolean }> {
  if (!bancoConfigurado) return { ok: true };
  const sessao = await lerSessao();
  if (!sessao) return { ok: false };
  const { reenfileirarImpressao } = await import("@/lib/banco/fila");
  const ok = await reenfileirarImpressao(sessao.negocioId, pedidoId);
  return { ok };
}
