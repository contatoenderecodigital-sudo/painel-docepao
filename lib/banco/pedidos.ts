// ============================================================================
//  PEDIDOS (lado do painel) — lê a fila de aprovação e muda status (Postgres puro).
//  Mapeia as linhas pro tipo `Pedido` que as telas já usam.
//  Sem banco configurado, o painel cai no mock (ver lib/dados.ts).
//  Isolamento MULTI-TENANT: toda query filtra pelo negocioId (do login).
// ============================================================================

import { query, queryUm, transacao } from "./db";
import type { Pedido, PedidoStatus, ItemPedido } from "../tipos";

type LinhaFila = {
  id: string;
  status: PedidoStatus;
  retirada_data: string | null;
  retirada_hora: string | null;
  pessoas: number | null;
  total_centavos: number;
  observacoes: string | null;
  forma_pagamento: string | null;
  criado_em: string;
  precisa_confirmacao: boolean | null;
  aguardando_cliente: boolean | null;
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
    formaPagamento: (l.forma_pagamento as Pedido["formaPagamento"]) ?? null,
    criadoEm: l.criado_em,
    precisaConfirmacao: !!l.precisa_confirmacao,
    aguardandoCliente: !!l.aguardando_cliente,
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
            p.total_centavos, p.observacoes, p.forma_pagamento, p.criado_em,
            p.precisa_confirmacao, p.motivo_humano, p.aguardando_cliente,
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
        and coalesce(p.precisa_confirmacao, false) = false
        and coalesce(p.aguardando_cliente, false) = false
      order by p.criado_em asc`,
    [negocioId],
  );
  return linhas.map(mapear);
}

// Pedidos que a IA montou mas NÃO tinha como fechar sozinha: falta o valor do
// topo de bolo, um item fora da tabela, confirmar capacidade pra hoje. Ficavam
// misturados na fila de aprovação, onde aprovar mandava o pedido incompleto
// pro cliente. Aqui eles têm tela própria, com o motivo na frente.
export async function listarAguardandoConfirmacao(negocioId: string): Promise<Pedido[]> {
  const linhas = await query<LinhaFila>(
    `select p.id, p.status, p.retirada_data, p.retirada_hora, p.pessoas,
            p.total_centavos, p.observacoes, p.forma_pagamento, p.criado_em,
            p.precisa_confirmacao, p.motivo_humano, p.aguardando_cliente,
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
        and (coalesce(p.precisa_confirmacao, false) = true
             or coalesce(p.aguardando_cliente, false) = true)
      order by p.criado_em asc`,
    [negocioId],
  );
  return linhas.map(mapear);
}

// Tira a pendência: o pedido deixa de precisar de humano e cai na fila normal.
// A pendência da equipe some, mas o pedido NÃO vai direto pra aprovação: fica
// esperando o cliente dizer que aceita o total novo.
export async function limparPendencia(pedidoId: string, negocioId: string): Promise<void> {
  await query(
    `update pedidos set precisa_confirmacao = false, motivo_humano = null, aguardando_cliente = true
      where id = $1 and negocio_id = $2`,
    [pedidoId, negocioId],
  );
}

// O cliente respondeu que está certo: agora sim entra na fila de aprovação.
export async function registrarAceiteCliente(negocioId: string, clienteId: string): Promise<boolean> {
  const r = await query<{ id: string }>(
    `update pedidos set aguardando_cliente = false
      where negocio_id = $1 and cliente_id = $2 and status = 'confirmado'
        and coalesce(aguardando_cliente, false) = true
      returning id`,
    [negocioId, clienteId],
  );
  return r.length > 0;
}

// Existe pedido esperando o aceite deste cliente? (o cérebro pergunta antes de
// gastar uma ferramenta com isso)
export async function temPedidoAguardandoCliente(negocioId: string, clienteId: string): Promise<boolean> {
  const l = await queryUm<{ n: string }>(
    `select count(*) as n from pedidos
      where negocio_id = $1 and cliente_id = $2 and status = 'confirmado'
        and coalesce(aguardando_cliente, false) = true`,
    [negocioId, clienteId],
  );
  return Number(l?.n) > 0;
}

// Orçamentos PARADOS (status 'orcado') — a tela de recuperação.
export async function listarParados(negocioId: string): Promise<Pedido[]> {
  const linhas = await query<LinhaFila>(
    `select p.id, p.status, p.retirada_data, p.retirada_hora, p.pessoas,
            p.total_centavos, p.observacoes, p.forma_pagamento, p.criado_em,
            p.precisa_confirmacao, p.motivo_humano, p.aguardando_cliente,
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
            p.total_centavos, p.observacoes, p.forma_pagamento, p.criado_em,
            p.precisa_confirmacao, p.motivo_humano, p.aguardando_cliente,
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

// Um pedido COMPLETO por id (com itens, obs, foto). Usado pra abrir o detalhe
// de um pedido a partir de uma lista que só tem o resumo (ex: ficha do cliente).
// Escopado pelo negócio (multi-tenant): nunca vaza pedido de outro tenant.
export async function buscarPedido(
  pedidoId: string,
  negocioId: string,
): Promise<Pedido | null> {
  const linhas = await query<LinhaFila>(
    `select p.id, p.status, p.retirada_data, p.retirada_hora, p.pessoas,
            p.total_centavos, p.observacoes, p.forma_pagamento, p.criado_em,
            p.precisa_confirmacao, p.motivo_humano, p.aguardando_cliente,
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
      where p.id = $1 and p.negocio_id = $2`,
    [pedidoId, negocioId],
  );
  return linhas[0] ? mapear(linhas[0]) : null;
}

// Dados mínimos pra avisar o cliente no WhatsApp quando a equipe aprova/recusa.
// Volta null se o pedido não tiver cliente com telefone (não dá pra avisar).
export type AvisoPedido = {
  clienteId: string;
  telefone: string;
  nome: string;
  retiradaFmt: string | null; // "DD/MM/AAAA" já formatada no banco
  retiradaHora: string | null;
  totalCentavos: number; // total ATUAL, já com o item que a equipe lançou
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
    total_centavos: number | null;
  }>(
    `select p.cliente_id, c.nome, c.telefone,
            to_char(p.retirada_data, 'DD/MM/YYYY') as retirada_fmt,
            p.retirada_hora, p.total_centavos
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
    totalCentavos: Number(r.total_centavos) || 0,
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

// Acrescenta um item ao pedido e recalcula o total a partir da SOMA dos itens.
// O total nunca é ajustado "na mão": ele é sempre a soma das linhas, senão o
// cupom impresso e o valor cobrado divergem — e quem descobre é o cliente no
// balcão. Só mexe em pedido que ainda não foi aprovado.
export async function adicionarItem(
  pedidoId: string,
  negocioId: string,
  item: { produto: string; qtd: number; unitCentavos: number },
): Promise<void> {
  const subtotal = Math.round(item.qtd * item.unitCentavos);
  await transacao(async (q) => {
    const dono = await q<{ id: string; status: string }>(
      "select id, status from pedidos where id = $1 and negocio_id = $2",
      [pedidoId, negocioId],
    );
    const p = dono[0];
    if (!p) throw new Error("pedido não encontrado neste negócio");
    if (p.status === "aprovado" || p.status === "impresso") {
      throw new Error("pedido já aprovado: não dá pra mexer nos itens");
    }
    await q(
      `insert into pedido_itens (pedido_id, produto, categoria, qtd, unit_centavos, subtotal_centavos, unidade)
       values ($1, $2, 'extra', $3, $4, $5, 'un')`,
      [pedidoId, item.produto, item.qtd, item.unitCentavos, subtotal],
    );
    await q(
      `update pedidos set total_centavos = (
         select coalesce(sum(subtotal_centavos), 0) from pedido_itens where pedido_id = $1
       ) where id = $1`,
      [pedidoId],
    );
  });
}
