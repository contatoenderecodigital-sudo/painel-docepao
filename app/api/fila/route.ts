// ============================================================================
//  API DA FILA DE IMPRESSÃO — a ponte na padaria consome isto por HTTPS.
//  Autenticada por token (PONTE_TOKEN), pra ninguém de fora ler/mexer.
//   GET   -> jobs pendentes (com o pedido montado pro cupom)
//   POST  -> a ponte confirma impresso/erro  { filaId, ok, cupomTexto?, erro?, aguardando? }
//           aguardando=true e a impressora sem papel ou de tampa aberta: o job
//           volta pra fila sem gastar tentativa (nao e falha, e espera).
//
//  Assim o Postgres NUNCA fica exposto na internet — só esta porta controlada.
// ============================================================================

import { NextRequest } from "next/server";
import { jobsPendentes, marcarImpresso, marcarPonteViva } from "@/lib/banco/fila";

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
  // A pergunta da ponte E o sinal de vida dela: carimba antes de responder.
  // Falha aqui nao pode atrapalhar a impressao, entao segue mesmo se der erro.
  marcarPonteViva(NEGOCIO).catch((e) => console.error("[fila] sinal de vida:", e));
  // O LEMBRETE DA RETIRADA PEGA CARONA NA BATIDA DA PONTE.
  //
  // Ele precisa de um relogio, e o unico relogio que este sistema ja tem e a
  // ponte da impressora perguntando pela fila a cada poucos segundos. Assim o
  // aviso de 10 horas antes funciona sem cron nenhum configurado, e continua
  // funcionando se alguem configurar um (a marca no banco garante uma mensagem
  // por pedido, e a rodada tem trava de um minuto).
  //
  // FIRE AND FORGET, igual ao sinal de vida logo acima: a impressao da cozinha
  // nao pode esperar por uma consulta de lembrete, nem quebrar se ela falhar.
  import("@/lib/ia/rodada-de-lembretes")
    .then((m) => m.rodarLembretes(NEGOCIO, { padaria: "Doce Pão" }))
    .catch((e) => console.error("[fila] rodada de lembretes:", e));
  const jobs = await jobsPendentes(NEGOCIO);
  return Response.json({ jobs });
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return new Response("unauthorized", { status: 401 });
  let body: { filaId?: string; ok?: boolean; cupomTexto?: string; erro?: string; aguardando?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (!body.filaId) return new Response("filaId obrigatório", { status: 400 });
  await marcarImpresso(NEGOCIO, body.filaId, body.ok !== false, body.cupomTexto, body.erro, body.aguardando === true);
  return Response.json({ ok: true });
}
