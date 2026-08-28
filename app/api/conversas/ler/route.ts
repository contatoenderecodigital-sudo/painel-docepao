// Marca as mensagens do cliente como lidas ao abrir a conversa (zera o badge).

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { marcarConversaLida } from "@/lib/banco/atendimentos";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId;
  if (!negocioId) return Response.json({ ok: false }, { status: 401 });

  let body: { clienteId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (!body.clienteId) return Response.json({ ok: false }, { status: 400 });

  await marcarConversaLida(negocioId, body.clienteId);
  return Response.json({ ok: true });
}
