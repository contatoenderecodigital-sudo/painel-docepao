// ============================================================================
//  A BATIDA DO RELOGIO DO LEMBRETE.
//
//  Pedido dele em 02/09/2026: avisar o cliente 10 horas antes da retirada.
//
//  ISTO AQUI SO PERGUNTA "e hora de avisar alguem?". Quem decide e
//  `lib/ia/lembrete.ts` (funcao pura, com teste); quem manda e
//  `lib/ia/rodada-de-lembretes.ts`. Chamar esta rota de minuto em minuto e
//  seguro: a marca no banco garante uma mensagem por pedido, e a rodada tem
//  trava de um minuto.
//
//  AUTENTICADA PELO MESMO TOKEN DA PONTE de proposito. Uma variavel de ambiente
//  a mais no deploy e uma variavel a mais pra esquecer, e em 02/09/2026 mexer
//  numa custou meia hora e quatro tentativas. E o mesmo grau de confianca: uma
//  maquina da casa falando com o painel.
//
//  Quem chama:
//    - o relogio do servidor (cron), de dez em dez minutos;
//    - a ponte da impressora, de carona na batida dela, pra funcionar mesmo sem
//      cron nenhum configurado.
// ============================================================================

import { NextRequest } from "next/server";
import { rodarLembretes } from "@/lib/ia/rodada-de-lembretes";

export const dynamic = "force-dynamic";

const TOKEN = process.env.PONTE_TOKEN;
const NEGOCIO = process.env.NEGOCIO_PADRAO_ID ?? "";

function autorizado(req: NextRequest): boolean {
  if (!TOKEN) return false; // sem token configurado, bloqueia
  return (req.headers.get("authorization") || "") === `Bearer ${TOKEN}`;
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return new Response("unauthorized", { status: 401 });
  if (!NEGOCIO) return Response.json({ ok: false, erro: "sem NEGOCIO_PADRAO_ID" }, { status: 500 });
  try {
    // `forcar` porque quem chama esta rota chamou de proposito: a trava de um
    // minuto existe pra carona da ponte, e nao pra quem pediu.
    const r = await rodarLembretes(NEGOCIO, { padaria: "Doce Pão", forcar: true });
    console.log("[lembrete] rodada:", JSON.stringify(r));
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error("[lembrete] rodada falhou:", e);
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}

// GET faz a mesma coisa: cron simples so sabe buscar URL.
export const GET = POST;
