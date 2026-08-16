// ============================================================================
//  PEDIDOS (lado do painel) — lê a fila de aprovação e muda status (Postgres puro).
//  Mapeia as linhas pro tipo `Pedido` que as telas já usam.
//  Sem banco configurado, o painel cai no mock (ver lib/dados.ts).
//  Isolamento MULTI-TENANT: toda query filtra pelo negocioId (do login).
// ============================================================================

import { query, queryUm } from "./db";
import type { Pedido, PedidoStatus, ItemPedido } from "../tipos";

type LinhaFila = {
  id: string;
  status: PedidoStatus;
  retirada_data: string | null;
  retirada_hora: string | null;
  pessoas: number | null;
  total_centavos: number;
  observacoes: string | null;
  criado_em: string;
  precisa_confirmacao: boolean | null;
  motivo_humano: string | null;
  tem_foto: boolean | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  itens: ItemBruto[] | null;
};
type ItemBruto = {
  produto: string;
  categoria: string | null;
  qtd: number;
  unit_centavos: number;
  subtotal_centavos: number;
  obs: string | null;
  unidade: string | null;
};

function mapear(l: LinhaFila): Pedido {
  return {
    id: l.id,
    clienteNome: l.cliente_nome || "Cliente",
    clienteTelefone: l.cliente_telefone || "",
    status: l.status,
    retiradaData: l.retirada_data,
    retiradaHora: l.retirada_hora ? l.retirada_hora.slice(0, 5) : null,
    pessoas: l.pessoas,
    totalCentavos: l.total_centavos,
    observacoes: l.observacoes,
    criadoEm: l.criado_em,
    precisaConfirmacao: !!l.precisa_confirmacao,
    motivoHumano: l.motivo_humano,
    temFoto: !!l.tem_foto,
    itens: (l.itens ?? []).map(
      (i): ItemPedido => ({
        produto: i.produto,
        categoria: i.categoria || "",
        qtd: i.qtd,
        unitCentavos: i.unit_centavos,
        subtotalCentavos: i.subtotal_centavos,
        obs: i.obs,
        unidade: (i.unidade as "un" | "kg") ?? "un",
      }),
    ),
  };
}

// Fila de aprovação: pedidos 'confirmado' com seus itens e o cliente.
// Os itens vêm agregados em JSON (um SELECT só, sem N+1).
export async function listarFilaAprovacao(negocioId: string): Promise<Pedido[]> {
  const linhas = await query<LinhaFila>(
    `select p.id, p.status, p.retirada_data, p.retirada_hora, p.pessoas,
            p.total_centavos, p.observacoes, p.criado_em,
            p.precisa_confirmacao, p.motivo_humano,
            exists(select 1 from pedido_fotos f where f.pedido_id = p.id) as tem_foto,
            c.nome as cliente_nome, c.telefone as cliente_telefone,
            coalesce(
              (select json_agg(json_build_object(
                 'produto', i.produto, 'categoria', i.categoria, 'qtd', i.qtd,
                 'unit_centavos', i.unit_centavos, 'subtotal_centavos', i.subtotal_centavos, 'obs', i.obs, 'unidade', i.unidade))
               from pedido_itens i where i.pedido_id = p.id),
              '[]'::json) as itens
       from pedidos p
       left join clientes c on c.id = p.cliente_id
      where p.negocio_id = $1 and p.status = 'confirmado'
      order by p.criado_em asc`,
    [negocioId],
  );
  return linhas.map(mapear);
}

// Orçamentos PARADOS (status 'orcado') — a tela de recuperação.
export async function listarParados(negocioId: string): Promise<Pedido[]> {
  const linhas = await query<LinhaFila>(
    `select p.id, p.status, p.retirada_data, p.retirada_hora, p.pessoas,
            p.total_centavos, p.observacoes, p.criado_em,
            p.precisa_confirmacao, p.motivo_humano,
            exists(select 1 from pedido_fotos f where f.pedido_id = p.id) as tem_foto,
            c.nome as cliente_nome, c.telefone as cliente_telefone,
            coalesce(
              (select json_agg(json_build_object(
                 'produto', i.produto, 'categoria', i.categoria, 'qtd', i.qtd,
                 'unit_centavos', i.unit_centavos, 'subtotal_centavos', i.subtotal_centavos, 'obs', i.obs, 'unidade', i.unidade))
               from pedido_itens i where i.pedido_id = p.id),
              '[]'::json) as itens
       from pedidos p
       left join clientes c on c.id = p.cliente_id
      where p.negocio_id = $1 and p.status = 'orcado'
      order by p.orcado_em asc nulls last`,
    [negocioId],
  );
  return linhas.map(mapear);
}

// Pedidos APROVADOS (aprovado/impresso) — a tela de producao do dia.
export async function listarDoDia(negocioId: string): Promise<Pedido[]> {
  const linhas = await query<LinhaFila>(
    `select p.id, p.status, p.retirada_data, p.retirada_hora, p.pessoas,
            p.total_centavos, p.observacoes, p.criado_em,
            p.precisa_confirmacao, p.motivo_humano,
            exists(select 1 from pedido_fotos f where f.pedido_id = p.id) as tem_foto,
            c.nome as cliente_nome, c.telefone as cliente_telefone,
            coalesce(
              (select json_agg(json_build_object(
                 'produto', i.produto, 'categoria', i.categoria, 'qtd', i.qtd,
                 'unit_centavos', i.unit_centavos, 'subtotal_centavos', i.subtotal_centavos, 'obs', i.obs, 'unidade', i.unidade))
               from pedido_itens i where i.pedido_id = p.id),
              '[]'::json) as itens
       from pedidos p
       left join clientes c on c.id = p.cliente_id
      where p.negocio_id = $1 and p.status in ('aprovado', 'impresso')
      order by p.retirada_data asc nulls last, p.retirada_hora asc nulls last`,
    [negocioId],
  );
  return linhas.map(mapear);
}

// Dados mínimos pra avisar o cliente no WhatsApp quando a equipe aprova/recusa.
// Volta null se o pedido não tiver cliente com telefone (não dá pra avisar).
export type AvisoPedido = {
  clienteId: string;
  telefone: string;
  nome: string;
  retiradaFmt: string | null; // "DD/MM/AAAA" já formatada no banco
  retiradaHora: string | null;
};
export async function dadosAvisoPedido(
  pedidoId: string,
  negocioId: string,
): Promise<AvisoPedido | null> {
  const r = await queryUm<{
    cliente_id: string | null;
    nome: string | null;
    telefone: string | null;
    retirada_fmt: string | null;
    retirada_hora: string | null;
  }>(
    `select p.cliente_id, c.nome, c.telefone,
            to_char(p.retirada_data, 'DD/MM/YYYY') as retirada_fmt,
            p.retirada_hora
       from pedidos p
       left join clientes c on c.id = p.cliente_id
      where p.id = $1 and p.negocio_id = $2`,
    [pedidoId, negocioId],
  );
  if (!r || !r.cliente_id || !r.telefone) return null;
  return {
    clienteId: r.cliente_id,
    telefone: r.telefone,
    nome: r.nome || "",
    retiradaFmt: r.retirada_fmt,
    retiradaHora: r.retirada_hora,
  };
}

// Muda o status de um pedido. 'aprovado' dispara o trigger da fila de impressão.
export async function mudarStatus(
  pedidoId: string,
  status: PedidoStatus,
  negocioId: string,
): Promise<void> {
  const carimbo =
    status === "confirmado" ? ", confirmado_em = now()" : "";
  await query(
    `update pedidos set status = $1${carimbo} where id = $2 and negocio_id = $3`,
    [status, pedidoId, negocioId],
  );
}
