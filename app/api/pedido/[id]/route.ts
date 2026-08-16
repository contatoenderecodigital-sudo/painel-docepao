// ============================================================================
//  UM PEDIDO COMPLETO (por id) — pra abrir o detalhe a partir de uma lista que
//  só tem o resumo (ex: histórico da ficha do cliente). Escopado pelo negócio
//  da sessão (multi-tenant): nunca devolve pedido de outro tenant.
// ============================================================================

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { buscarPedido } from "@/lib/banco/pedidos";
import { bancoConfigurado } from "@/lib/banco/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao();
  if (!sessao) return Response.json({ erro: "nao_autorizado" }, { status: 401 });
  if (!bancoConfigurado) return Response.json({ erro: "sem_banco" }, { status: 404 });

  const { id } = await params;
  if (!id) return Response.json({ erro: "id_ausente" }, { status: 400 });

  try {
    const pedido = await buscarPedido(id, sessao.negocioId);
    if (!pedido) return Response.json({ erro: "nao_encontrado" }, { status: 404 });
    return Response.json(pedido);
  } catch (e) {
    console.error("[pedido] falha ao buscar pedido:", e);
    return Response.json({ erro: "erro_interno" }, { status: 500 });
  }
}
