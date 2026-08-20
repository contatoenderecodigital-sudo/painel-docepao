// ============================================================================
//  QA — devolve o último pedido registrado, cru, pro teste automatizado
//  conferir o que a IA de fato gravou (e não o que ela DISSE que gravou).
//
//  A diferença entre os dois foi metade dos bugs até aqui: o resumo no WhatsApp
//  dizia "bolo 2 kg x R$ 49,90" e no banco estava "2 un de brigadeiro".
//
//  Só leitura, e exige sessão do painel como qualquer outra rota.
// ============================================================================

import { lerSessao } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/banco/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });
  if (!bancoConfigurado) return Response.json(null);

  // O teste passa a hora em que a bateria comecou. Sem esse corte, o endpoint
  // devolvia o ultimo pedido do negocio, e um pedido REAL de cliente (ou o da
  // demonstracao) era lido como se fosse do cenario: a bateria acusou pagamento
  // inventado que na verdade era o pix do Marcelo.
  const desde = new URL(req.url).searchParams.get("desde");
  // DE QUEM E O PEDIDO. O corte por hora nao bastava.
  //
  // A bateria do painel usa sempre o MESMO cliente de teste, entao o registro
  // ATUALIZA o pedido anterior em vez de criar um novo, e o corte por hora
  // descartava justamente o pedido que o teste acabou de mexer. Sem filtro
  // nenhum era pior: em 20/08/2026 a bateria leu o pedido de demonstracao do
  // dono e reprovou tudo.
  //
  // Com o telefone, o teste le o pedido DELE, tenha sido criado agora ou
  // atualizado. Continua so leitura e continua exigindo sessao.
  const telefone = new URL(req.url).searchParams.get("telefone");
  try {
    const { queryUm } = await import("@/lib/banco/db");
    const p = await queryUm<Record<string, unknown>>(
      `select p.id, p.status, p.total_centavos, p.forma_pagamento, p.precisa_confirmacao,
              p.motivo_humano, p.aguardando_cliente, p.retirada_data,
              c.nome as cliente_nome,
              coalesce((select json_agg(json_build_object(
                'produto', i.produto, 'qtd', i.qtd, 'unit_centavos', i.unit_centavos,
                'subtotal_centavos', i.subtotal_centavos, 'obs', i.obs, 'unidade', i.unidade))
               from pedido_itens i where i.pedido_id = p.id), '[]'::json) as itens
         from pedidos p left join clientes c on c.id = p.cliente_id
        where p.negocio_id = $1
          and ($2::timestamptz is null or p.criado_em >= $2 or c.telefone = $3)
          and ($3::text is null or c.telefone = $3)
        order by p.criado_em desc limit 1`,
      [sessao.negocioId, desde, telefone],
    );
    return Response.json(p ?? null);
  } catch (e) {
    console.error("[qa/ultimo-pedido]", e);
    return Response.json(null);
  }
}
