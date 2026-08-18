-- ============================================================================
--  A PONTE DA IMPRESSORA PRECISA APARECER NO PAINEL.
--
--  A ponte roda na maquina da padaria e some sem avisar: o icone continua na
--  barra de tarefas com o processo morto por tras. Aconteceu de verdade, e o
--  pedido aprovado simplesmente nao saiu na cozinha, com todo mundo achando que
--  tinha saido.
--
--  A propria consulta da fila vira o sinal de vida: a ponte chama /api/fila a
--  cada poucos segundos, e o servidor carimba a hora aqui. Se parar de carimbar,
--  o painel mostra que a impressora esta sem sinal.
-- ============================================================================

create table if not exists ponte_status (
  negocio_id uuid primary key references negocios(id) on delete cascade,
  visto_em timestamptz not null default now()
);
