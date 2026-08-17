// Contagem das duas filas, pro sino saber quando algo NOVO entrou.
// Leve de propósito: só dois counts, chamado a cada 20s por aba aberta.
import { lerSessao } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/banco/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });
  if (!bancoConfigurado) return Response.json({ fila: 0, aguardando: 0 });

  try {
    const { queryUm } = await import("@/lib/banco/db");
    const l = await queryUm<{ fila: string; aguardando: string }>(
      `select
         count(*) filter (where coalesce(precisa_confirmacao, false) = false) as fila,
         count(*) filter (where coalesce(precisa_confirmacao, false) = true) as aguardando
       from pedidos where negocio_id = $1 and status = 'confirmado'`,
      [sessao.negocioId],
    );
    return Response.json({ fila: Number(l?.fila) || 0, aguardando: Number(l?.aguardando) || 0 });
  } catch (e) {
    console.error("[fila/contagem]", e);
    return Response.json({ fila: 0, aguardando: 0 });
  }
}
