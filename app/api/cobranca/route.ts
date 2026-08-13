// Salva o template da mensagem de cobrança automática, por negócio logado.

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { salvarMsgCobranca } from "@/lib/banco/negocios";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) return Response.json({ ok: false, erro: "sem sessao" }, { status: 401 });

  let body: { texto?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, erro: "corpo invalido" }, { status: 400 });
  }
  await salvarMsgCobranca(negocioId, body.texto ?? "");
  return Response.json({ ok: true });
}
