-- ============================================================================
--  ACEITE DO CLIENTE ANTES DA APROVAÇÃO.
--
--  Quando a equipe descobria o valor do topo e lançava, o pedido ia DIRETO pra
--  fila de aprovação: a dona aprovava e mandava imprimir um orçamento que o
--  cliente ainda não tinha aceitado. Se ele desistisse ao ver o valor novo, a
--  produção já tinha começado.
--
--  Agora existe um degrau no meio: a Dora manda o total novo, o pedido fica
--  "aguardando o cliente", e só entra na fila de aprovação quando ele responde
--  que está certo.
-- ============================================================================

alter table pedidos
  add column if not exists aguardando_cliente boolean not null default false;

comment on column pedidos.aguardando_cliente is
  'Cliente ainda nao respondeu ao orcamento atualizado; o pedido nao entra na fila de aprovacao enquanto for true.';
