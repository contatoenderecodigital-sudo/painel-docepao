// ============================================================================
//  API DA FILA DE IMPRESSÃO — a ponte na padaria consome isto por HTTPS.
//  Autenticada por token (PONTE_TOKEN), pra ninguém de fora ler/mexer.
//   GET   -> jobs pendentes (com o pedido montado pro cupom)
//   POST  -> a ponte confirma impresso/erro  { filaId, ok, cupomTexto?, erro? }
//
//  Assim o Postgres NUNCA fica exposto na internet — só esta porta controlada.
// ============================================================================

import { NextRequest } from "next/server";
import { jobsPendentes, marcarImpresso } from "@/lib/banco/fila";

export const dynamic = "force-dynamic";

const TOKEN = process.env.PONTE_TOKEN;
const NEGOCIO = process.env.NEGOCIO_PADRAO_ID ?? "";

function autorizado(req: NextRequest): boolean {
  if (!TOKEN) return false; // sem token configurado, bloqueia
  const h = req.headers.get("authorization") || "";
  return h === `Bearer ${TOKEN}`;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return new Response("unauthorized", { status: 401 });
  const jobs = await jobsPendentes(NEGOCIO);
  return Response.json({ jobs });
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return new Response("unauthorized", { status: 401 });
  let body: { filaId?: string; ok?: boolean; cupomTexto?: string; erro?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (!body.filaId) return new Response("filaId obrigatório", { status: 400 });
  await marcarImpresso(NEGOCIO, body.filaId, body.ok !== false, body.cupomTexto, body.erro);
  return Response.json({ ok: true });
}
