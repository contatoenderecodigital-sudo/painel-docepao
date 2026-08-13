// Liga/desliga a resposta automatica da IA pro negocio logado (sem desconectar
// o numero). O webhook le config.ia_ativa e para de responder quando desligado.

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { definirIaAtiva } from "@/lib/banco/negocios";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) return Response.json({ ok: false, erro: "sem sessao" }, { status: 401 });

  let body: { ativa?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, erro: "corpo invalido" }, { status: 400 });
  }
  await definirIaAtiva(negocioId, Boolean(body.ativa));
  return Response.json({ ok: true, ativa: Boolean(body.ativa) });
}
