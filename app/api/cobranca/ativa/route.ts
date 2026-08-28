// Liga e desliga a cobrança automática do orçamento parado, por negócio.
//
// Existe porque o interruptor da tela de Recuperar não ligava nada: era estado
// da própria tela, nascia dizendo "Ativada" e a dona concluía que o sistema
// estava cobrando quem sumiu. Não estava.

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { salvarCobrancaAtiva } from "@/lib/banco/negocios";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId;
  if (!negocioId) return Response.json({ ok: false, erro: "sem_sessao" }, { status: 401 });

  let body: { ativa?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, erro: "corpo_invalido" }, { status: 400 });
  }

  const ativa = body.ativa === true;
  await salvarCobrancaAtiva(negocioId, ativa);
  return Response.json({ ok: true, ativa });
}
