-- ============================================================================
--  PEDIDO QUE A EQUIPE JÁ AJUSTOU NÃO É SOBRESCRITO PELA IA.
--
--  A equipe lançou o valor do topo, a Dora avisou o cliente, o cliente aceitou
--  e a IA registrou o pedido DE NOVO com a lista antiga. O item que a equipe
--  lançou sumiu, o total voltou ao que era e a pendência reabriu.
--
--  Com esta marca, registrarPedido para de atualizar: o trabalho da equipe vale
--  mais que a última tentativa do modelo.
-- ============================================================================

alter table pedidos
  add column if not exists equipe_ajustou boolean not null default false;

comment on column pedidos.equipe_ajustou is
  'A equipe lancou item ou valor neste pedido; a IA nao pode mais sobrescrever.';
