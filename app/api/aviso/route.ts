// Aviso do dia do negócio logado. POST salva o texto; DELETE limpa.
// O reset diário é automático (o carregarTenant só injeta se for de hoje).

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { salvarAvisoDoDia, limparAvisoDoDia } from "@/lib/banco/negocios";

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
  const texto = (body.texto ?? "").trim();
  if (!texto) {
    await limparAvisoDoDia(negocioId);
    return Response.json({ ok: true, limpo: true });
  }
  await salvarAvisoDoDia(negocioId, texto);
  return Response.json({ ok: true, atualizadoEm: new Date().toISOString() });
}

export async function DELETE() {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) return Response.json({ ok: false, erro: "sem sessao" }, { status: 401 });
  await limparAvisoDoDia(negocioId);
  return Response.json({ ok: true });
}
