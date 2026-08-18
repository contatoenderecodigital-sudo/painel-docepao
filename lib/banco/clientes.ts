// ============================================================================
//  CLIENTES (CRM) — ficha de cada cliente com histórico agregado de pedidos.
//  As "preferências / notas" da equipe ficam em negocios.config.clientes_notas
//  (mapa telefone -> texto), pra não precisar de migração de schema.
//  Isolamento multi-tenant: toda query filtra por negocio_id.
// ============================================================================

import { query, queryUm } from "./db";
import type { ClienteCRM, PedidoResumo } from "../tipos";

type Linha = {
  id: string;
  nome: string | null;
  telefone: string;
  aniversario: string | null;
  selos: number;
  cliente_desde: string | null;
  qtd_pedidos: number;
  total_gasto: number;
  ultimo_pedido: string | null;
  pedidos: PedidoResumo[] | null;
};

export async function listarClientes(negocioId: string): Promise<ClienteCRM[]> {
  const linhas = await query<Linha>(
    `select c.id, c.nome, c.telefone, c.aniversario, c.selos,
            c.criado_em as cliente_desde,
            coalesce(agg.qtd, 0) as qtd_pedidos,
            coalesce(agg.total, 0) as total_gasto,
            agg.ultimo as ultimo_pedido,
            coalesce(ped.pedidos, '[]'::json) as pedidos
       from clientes c
       left join lateral (
         select count(*) filter (where status in ('confirmado','aprovado','impresso')) as qtd,
                sum(total_centavos) filter (where status in ('aprovado','impresso')) as total,
                max(criado_em) as ultimo
           from pedidos where cliente_id = c.id and negocio_id = $1
       ) agg on true
       left join lateral (
         select json_agg(json_build_object(
                  'id', s.id, 'data', s.retirada_data, 'totalCentavos', s.total_centavos,
                  'status', s.status, 'criadoEm', s.criado_em,
                  'itens', (select count(*) from pedido_itens i where i.pedido_id = s.id)
                ) order by s.criado_em desc) as pedidos
           from (select * from pedidos where cliente_id = c.id and negocio_id = $1 order by criado_em desc limit 8) s
       ) ped on true
      -- O cliente da tela "Testar IA" nao e cliente da padaria: ele aparecia no
      -- CRM da dona, entrava na contagem e no futuro apareceria em relatorio.
      where c.negocio_id = $1
        and c.telefone not like '55000000%'
        and coalesce(c.nome, '') not ilike 'cliente de teste%'
        and coalesce(c.nome, '') not ilike 'qa %'
      order by agg.ultimo desc nulls last
      limit 500`,
    [negocioId],
  );

  const notas = await carregarNotasClientes(negocioId);
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome || "Cliente",
    telefone: l.telefone,
    aniversario: l.aniversario,
    selos: Number(l.selos) || 0,
    qtdPedidos: Number(l.qtd_pedidos) || 0,
    totalGastoCentavos: Number(l.total_gasto) || 0,
    ultimoPedidoEm: l.ultimo_pedido,
    clienteDesde: l.cliente_desde,
    nota: notas[l.telefone] ?? null,
    pedidos: (l.pedidos ?? []).map((p) => ({
      id: p.id,
      data: p.data,
      totalCentavos: Number(p.totalCentavos) || 0,
      status: p.status,
      criadoEm: p.criadoEm,
      itens: Number(p.itens) || 0,
    })),
  }));
}

export async function carregarNotasClientes(negocioId: string): Promise<Record<string, string>> {
  const n = await queryUm<{ notas: Record<string, string> }>(
    `select coalesce(config->'clientes_notas', '{}'::jsonb) as notas from negocios where id = $1`,
    [negocioId],
  );
  return n?.notas ?? {};
}

export async function salvarNotaCliente(
  negocioId: string,
  telefone: string,
  nota: string,
): Promise<void> {
  const t = (nota ?? "").trim();
  if (!t) {
    await query(
      `update negocios set config = jsonb_set(
         coalesce(config, '{}'::jsonb), '{clientes_notas}',
         coalesce(config->'clientes_notas', '{}'::jsonb) - $2::text
       ) where id = $1`,
      [negocioId, telefone],
    );
    return;
  }
  await query(
    `update negocios set config = jsonb_set(
       coalesce(config, '{}'::jsonb), '{clientes_notas}',
       coalesce(config->'clientes_notas', '{}'::jsonb) || jsonb_build_object($2::text, $3::text)
     ) where id = $1`,
    [negocioId, telefone, t],
  );
}
