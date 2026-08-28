// ============================================================================
//  MÍDIA DE UMA MENSAGEM — serve a imagem/áudio/documento que chegou pelo
//  WhatsApp (guardada em base64 no banco) pro chat conseguir mostrar.
//  Protegida por sessão e ESCOPADA pelo negócio da sessão (multi-tenant).
// ============================================================================

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { buscarMidiaMensagem } from "@/lib/banco/atendimentos";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId;
  if (!negocioId) return new Response("nao autorizado", { status: 401 });

  const { id } = await ctx.params;
  const midia = await buscarMidiaMensagem(negocioId, id);
  if (!midia) return new Response("nao encontrado", { status: 404 });

  const bin = Buffer.from(midia.dados, "base64");
  const headers: Record<string, string> = {
    "Content-Type": midia.mime,
    "Cache-Control": "private, max-age=86400",
    "Content-Length": String(bin.length),
  };
  if (midia.nome) headers["Content-Disposition"] = `inline; filename="${midia.nome.replace(/"/g, "")}"`;
  return new Response(new Uint8Array(bin), { status: 200, headers });
}
