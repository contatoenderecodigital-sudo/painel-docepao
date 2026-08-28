// ============================================================================
//  PEDIDOS (lado do painel) — lê a fila de aprovação e muda status (Postgres puro).
//  Mapeia as linhas pro tipo `Pedido` que as telas já usam.
//  Sem banco configurado, o painel cai no mock (ver lib/dados.ts).
//  Isolamento MULTI-TENANT: toda query filtra pelo negocioId (do login).
// ============================================================================

import { query, queryUm, transacao } from "./db";
import type { Pedido, PedidoStatus, ItemPedido } from "../tipos";
import { unidadeDoItem, horaDaRetirada } from "../tipos";

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
    retiradaHora: horaDaRetirada(l.retirada_hora),
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
        unidade: unidadeDoItem(i.unidade),
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

// O cliente NÃO aceitou o valor que a equipe lançou (ou complicou de outro
// jeito): o pedido volta pra fila de pendência da dona, com o motivo.
//
// Sem isto, recusa deixava o pedido preso em 'esperando o cliente' pra
// sempre: sumia da fila de pendência e nunca chegava na aprovação. A IA
// marcava a conversa como 'precisa de você', mas o pedido ficava num limbo
// que ninguém olha.
export async function devolverPedidoParaEquipe(
  negocioId: string,
  clienteId: string,
  motivo: string,
): Promise<boolean> {
  const r = await query<{ id: string }>(
    `update pedidos set aguardando_cliente = false, precisa_confirmacao = true, motivo_humano = $3
      where negocio_id = $1 and cliente_id = $2 and status = 'confirmado'
        and coalesce(aguardando_cliente, false) = true
      returning id`,
    [negocioId, clienteId, motivo.slice(0, 300)],
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
    // Marca que a EQUIPE mexeu: a partir daqui a IA não sobrescreve mais este
    // pedido. Sem isso ela registrava de novo com a lista antiga, o item que a
    // equipe lançou sumia e a pendência reabria.
    await q(
      `update pedidos set equipe_ajustou = true, total_centavos = (
         select coalesce(sum(subtotal_centavos), 0) from pedido_itens where pedido_id = $1
       ) where id = $1`,
      [pedidoId],
    );
  });
}

// O PEDIDO NAO SOME DA CONVERSA QUANDO O CLIENTE ACEITA.
//
// Assim que o aceite entrava, todo o estado virava zero: a IA recebia um "ok" do
// cliente e respondia "quer comecar um pedido ou so tirar uma duvida?", com o
// pedido dele parado na mao da equipe e uma pendencia de valor em aberto. Pedido
// so vira historia depois que o ticket imprime e a data de retirada passa.
export type PedidoEmAberto = {
  id: string;
  status: string;
  aguardandoCliente: boolean;
  retiradaData: string | null;
  retiradaHora: string | null;
  totalCentavos: number;
  motivoHumano: string | null;
  impresso: boolean;
  formaPagamento: string | null;
  quemRetira: string | null;
  itens: { produto: string; qtd: number; unidade: string; obs: string | null }[];
};

export async function pedidoEmAberto(
  negocioId: string,
  clienteId: string,
): Promise<PedidoEmAberto | null> {
  const l = await queryUm<{
    id: string;
    status: string;
    aguardando_cliente: boolean;
    retirada_data: string | null;
    retirada_hora: string | null;
    total_centavos: number;
    motivo_humano: string | null;
    impresso_em: string | null;
    forma_pagamento: string | null;
    quem_retira: string | null;
  }>(
    `select p.id, p.status::text as status,
            coalesce(p.aguardando_cliente, false) as aguardando_cliente,
            to_char(p.retirada_data, 'DD/MM/YYYY') as retirada_data,
            p.retirada_hora,
            coalesce(p.total_centavos, 0) as total_centavos,
            p.motivo_humano, p.impresso_em, p.forma_pagamento, c.nome as quem_retira
       from pedidos p left join clientes c on c.id = p.cliente_id
      where p.negocio_id = $1 and p.cliente_id = $2
        and p.status in ('confirmado', 'aprovado', 'impresso')
        -- Pedido nao impresso NAO some da tela, mesmo com a data passada: e
        -- trabalho pendente, e e justamente quando passou que alguem precisa
        -- ver. O do Paulo sumiu no dia seguinte sem nunca ter sido impresso,
        -- com o cliente pedindo pra mudar o pedido.
        -- O dia que vale e o da padaria: com current_date (UTC), pedido pra
        -- hoje sumia depois das 21h de Brasilia.
        and (
          p.impresso_em is null
          or p.retirada_data is null
          or p.retirada_data >= (now() at time zone 'America/Sao_Paulo')::date
        )
      order by p.criado_em desc
      limit 1`,
    [negocioId, clienteId],
  );
  if (!l) return null;
  const itens = await query<{ produto: string; qtd: string; unidade: string; obs: string | null }>(
    `select produto, qtd, unidade, obs
       from pedido_itens where pedido_id = $1 order by id`,
    [l.id],
  );
  return {
    id: l.id,
    status: l.status,
    aguardandoCliente: Boolean(l.aguardando_cliente),
    retiradaData: l.retirada_data,
    // Crua do banco isto e "16:30:00", e este objeto vai pro CEREBRO: a
    // padaria chegava a repetir a hora com os segundos pro cliente.
    retiradaHora: horaDaRetirada(l.retirada_hora),
    totalCentavos: Number(l.total_centavos) || 0,
    motivoHumano: l.motivo_humano,
    impresso: Boolean(l.impresso_em),
    formaPagamento: l.forma_pagamento,
    quemRetira: l.quem_retira,
    itens: itens.map((i) => ({
      produto: i.produto,
      qtd: Number(i.qtd) || 0,
      unidade: unidadeDoItem(i.unidade),
      obs: i.obs,
    })),
  };
}

// O pedido REGISTRADO que a equipe ainda nao aprovou, pro painel do atendimento
// continuar mostrando o que foi fechado. Assim que a aprovacao imprime o ticket
// ele sai da tela: e o unico momento em que o pedido deixa de estar em curso.
export type PedidoNaTela = {
  id: string;
  status: string;
  clienteNome: string | null;
  formaPagamento: string | null;
  observacoes: string | null;
  totalCentavos: number;
  retiradaData: string | null;
  retiradaHora: string | null;
  itens: { produto: string; categoria: string; qtd: number; unidade: string; obs: string | null }[];
};

export async function pedidoRegistradoDoCliente(
  negocioId: string,
  clienteId: string,
): Promise<PedidoNaTela | null> {
  const p = await queryUm<{
    id: string;
    status: string;
    total_centavos: number;
    retirada_data: string | null;
    retirada_hora: string | null;
    forma_pagamento: string | null;
    observacoes: string | null;
    cliente_nome: string | null;
  }>(
    `select p.id, p.status::text as status, coalesce(p.total_centavos, 0) as total_centavos,
            to_char(p.retirada_data, 'DD/MM/YYYY') as retirada_data, p.retirada_hora,
            p.forma_pagamento, p.observacoes, c.nome as cliente_nome
       from pedidos p
       left join clientes c on c.id = p.cliente_id
      where p.negocio_id = $1 and p.cliente_id = $2
        and p.status in ('confirmado', 'aprovado', 'impresso')
        -- O dia que vale e o da padaria: com current_date (UTC), pedido pra
        -- hoje sumia depois das 21h de Brasilia.
        --
        -- E PEDIDO NAO IMPRESSO NAO SOME, MESMO COM A DATA PASSADA.
        --
        -- Esta guarda existia no pedidoEmAberto logo acima, com o caso
        -- escrito ("o do Paulo sumiu no dia seguinte sem nunca ter sido
        -- impresso, com o cliente pedindo pra mudar o pedido") e NAO existia
        -- aqui. As duas funcoes respondem a mesma pergunta, qual pedido deste
        -- cliente ainda esta em curso, e esta e a que alimenta a lateral onde
        -- a equipe EDITA o pedido. O trabalho pendente sumia justamente da
        -- tela onde alguem consertaria.
        --
        -- Achado na leitura da camada de banco, 28/08/2026: um conserto que foi
        -- feito num lugar so, num par de funcoes gemeas.
        and (
          p.impresso_em is null
          or p.retirada_data is null
          or p.retirada_data >= (now() at time zone 'America/Sao_Paulo')::date
        )
      order by p.criado_em desc
      limit 1`,
    [negocioId, clienteId],
  );
  if (!p) return null;
  const itens = await query<{
    produto: string;
    categoria: string;
    qtd: string;
    unidade: string;
    obs: string | null;
  }>(
    `select produto, coalesce(categoria, '') as categoria, qtd, unidade, obs
       from pedido_itens where pedido_id = $1 order by id`,
    [p.id],
  );
  return {
    id: p.id,
    status: p.status,
    clienteNome: p.cliente_nome,
    formaPagamento: p.forma_pagamento,
    observacoes: p.observacoes,
    totalCentavos: Number(p.total_centavos) || 0,
    retiradaData: p.retirada_data,
    retiradaHora: horaDaRetirada(p.retirada_hora),
    itens: itens.map((i) => ({
      produto: i.produto,
      categoria: i.categoria,
      qtd: Number(i.qtd) || 0,
      unidade: unidadeDoItem(i.unidade),
      obs: i.obs,
    })),
  };
}

// A EQUIPE EDITANDO O PEDIDO JA FECHADO, DIRETO NO ATENDIMENTO.
//
// Ate o ticket sair o pedido ainda esta em curso: a cozinha so fica sabendo dele
// quando imprime, entao aprovar sem imprimir nao fecha nada. Enquanto nao
// imprimiu, a equipe muda item, quantidade e observacao pela lateral da conversa
// e o pedido inteiro e reescrito com os precos recalculados.
export async function salvarItensDoPedido(
  negocioId: string,
  pedidoId: string,
  itens: {
    produto: string;
    categoria: string;
    qtd: number;
    unidade: "un" | "kg";
    obs: string | null;
    unitCentavos: number;
    subtotalCentavos: number;
  }[],
): Promise<number> {
  if (itens.length === 0) throw new Error("pedido sem item: nao gravo por cima do que existe");
  let total = 0;
  await transacao(async (q) => {
    const dono = await q<{ id: string; status: string; impresso_em: string | null }>(
      "select id, status::text as status, impresso_em from pedidos where id = $1 and negocio_id = $2",
      [pedidoId, negocioId],
    );
    const p = dono[0];
    if (!p) throw new Error("pedido nao encontrado neste negocio");
    // Aprovar dispara a impressao: o papel ja saiu na cozinha e mexer aqui
    // deixaria a producao fazendo uma coisa e o caixa cobrando outra.
    if (p.status !== "confirmado" || p.impresso_em) {
      throw new Error("pedido ja aprovado: a cozinha recebeu, nao da pra mexer por aqui");
    }
    await q("delete from pedido_itens where pedido_id = $1", [pedidoId]);
    for (const i of itens) {
      await q(
        `insert into pedido_itens (pedido_id, produto, categoria, qtd, unit_centavos, subtotal_centavos, obs, unidade)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [pedidoId, i.produto, i.categoria, i.qtd, i.unitCentavos, i.subtotalCentavos, i.obs, i.unidade],
      );
      total += i.subtotalCentavos;
    }
    // Marca que a EQUIPE mexeu: dai pra frente a IA nao reescreve este pedido.
    await q("update pedidos set total_centavos = $2, equipe_ajustou = true where id = $1", [pedidoId, total]);
  });
  return total;
}

// QUANTO A COBRANCA AUTOMATICA TROUXE DE VOLTA, NO MES.
//
// O card da tela de Recuperar vinha zerado com banco real (a agregacao nunca
// tinha sido escrita) e cheio com dados de exemplo sem banco. Aqui e o numero
// da padaria: pedidos que fecharam DEPOIS de pelo menos uma cobranca. Sem a
// cobranca, esse dinheiro tinha grande chance de nao existir.
export async function recuperadoNoMes(
  negocioId: string,
): Promise<{ recuperadoCentavos: number; recuperadosQtd: number }> {
  const l = await queryUm<{ total: string; qtd: string }>(
    `select coalesce(sum(total_centavos), 0) as total, count(*) as qtd
       from pedidos
      where negocio_id = $1
        and status in ('aprovado', 'impresso')
        and coalesce(cobrancas, 0) > 0
        -- OS DOIS LADOS DA COMPARACAO NO MESMO FUSO.
        --
        -- Estava com a COLUNA crua (timestamptz) de um lado e o inicio do mes
        -- ja convertido pra Sao Paulo do outro. Comparar timestamptz com
        -- timestamp faz o Postgres converter o segundo usando o fuso da SESSAO:
        -- num container em UTC, o mes comecava tres horas antes, e as vendas da
        -- ultima madrugada do mes anterior entravam neste numero.
        --
        -- O resultados.ts ja faz do jeito certo (converte a COLUNA, nao o
        -- corte) e esta linha ficou pra tras. Agora as duas fazem igual, e o
        -- resultado deixa de depender de como o banco foi subido.
        and (coalesce(aprovado_em, confirmado_em, criado_em) at time zone 'America/Sao_Paulo')
            >= date_trunc('month', now() at time zone 'America/Sao_Paulo')`,
    [negocioId],
  );
  return { recuperadoCentavos: Number(l?.total) || 0, recuperadosQtd: Number(l?.qtd) || 0 };
}
