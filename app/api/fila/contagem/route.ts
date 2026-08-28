// Contagem das duas filas, pro sino saber quando algo NOVO entrou.
// Leve de propósito: dois counts e uma lista curta. O sino chama a cada 7s
// (INTERVALO_MS), e só UMA aba busca: as outras escutam dela.
import { lerSessao } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/banco/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });
  if (!bancoConfigurado) return Response.json({ fila: 0, aguardando: 0, ajuda: 0 });

  try {
    const { queryUm } = await import("@/lib/banco/db");
    const l = await queryUm<{ fila: string; aguardando: string }>(
      `select
         count(*) filter (where coalesce(precisa_confirmacao, false) = false) as fila,
         count(*) filter (where coalesce(precisa_confirmacao, false) = true) as aguardando
       from pedidos where negocio_id = $1 and status = 'confirmado'`,
      [sessao.negocioId],
    );
    // Conversa que a IA passou pra equipe: sem isto o pedido de ajuda so
    // aparecia pra quem estivesse com a aba de atendimentos aberta.
    const a = await queryUm<{ ajuda: string }>(
      `select count(*) as ajuda from clientes
        where negocio_id = $1 and coalesce(handoff, false) = true`,
      [sessao.negocioId],
    );
    // Além do número, QUEM está esperando. "2 pedidos" não diz nada; "Sandro,
    // R$ 130 pra aprovar" a dona já sabe se resolve agora ou depois do forno.
    const { query } = await import("@/lib/banco/db");
    const itens = await query<{
      id: string;
      nome: string | null;
      total_centavos: number;
      pendente: boolean;
      esperando: boolean;
      motivo: string | null;
    }>(
      `select p.id, c.nome, p.total_centavos,
              coalesce(p.precisa_confirmacao, false) as pendente,
              coalesce(p.aguardando_cliente, false) as esperando,
              p.motivo_humano as motivo
         from pedidos p left join clientes c on c.id = p.cliente_id
        where p.negocio_id = $1 and p.status = 'confirmado'
        order by p.criado_em desc limit 8`,
      [sessao.negocioId],
    );

    return Response.json({
      fila: Number(l?.fila) || 0,
      aguardando: Number(l?.aguardando) || 0,
      ajuda: Number(a?.ajuda) || 0,
      itens: itens.map((i) => ({
        id: i.id,
        nome: i.nome || "Cliente",
        total: Number(i.total_centavos) || 0,
        onde: i.pendente || i.esperando ? "aguardando" : "fila",
        motivo: i.esperando ? "esperando o cliente responder" : i.motivo || null,
      })),
    });
  } catch (e) {
    console.error("[fila/contagem]", e);
    return Response.json({ fila: 0, aguardando: 0, ajuda: 0, itens: [] });
  }
}
