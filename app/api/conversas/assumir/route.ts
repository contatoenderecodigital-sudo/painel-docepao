// ============================================================================
//  ASSUMIR / DEVOLVER a conversa.
//
//  Assumir  -> a IA para de responder este cliente (clientes.ia_pausada).
//  Devolver -> a IA volta a atender normalmente.
//
//  É a única forma de a equipe entrar numa conversa sem a IA falar por cima.
// ============================================================================

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { definirPausaIA } from "@/lib/banco/atendimentos";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });

  const negocioId = sessao.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) return Response.json({ erro: "sem_negocio" }, { status: 400 });

  let corpo: { clienteId?: string; assumir?: boolean };
  try {
    corpo = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (!corpo.clienteId) return Response.json({ erro: "sem_cliente" }, { status: 400 });

  try {
    await definirPausaIA(negocioId, corpo.clienteId, !!corpo.assumir);
  } catch (e) {
    console.error("[conversas/assumir] falha:", e);
    return Response.json({ erro: "falha" }, { status: 500 });
  }
  return Response.json({ ok: true, assumida: !!corpo.assumir });
}
