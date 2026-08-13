// Pedidos do dia (aprovado/impresso) pro auto-update do painel de produção.

import { lerSessao } from "@/lib/auth";
import { carregarDoDia } from "@/lib/dados";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });
  const pedidos = await carregarDoDia(sessao.negocioId);
  return Response.json(pedidos);
}
