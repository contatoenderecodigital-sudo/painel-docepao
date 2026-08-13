// Salva a nota/preferências de um cliente (CRM), por negócio logado.

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { salvarNotaCliente } from "@/lib/banco/clientes";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) return Response.json({ ok: false, erro: "sem sessao" }, { status: 401 });

  let body: { telefone?: string; nota?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, erro: "corpo invalido" }, { status: 400 });
  }
  if (!body.telefone) return Response.json({ ok: false, erro: "falta telefone" }, { status: 400 });

  await salvarNotaCliente(negocioId, body.telefone, body.nota ?? "");
  return Response.json({ ok: true });
}
