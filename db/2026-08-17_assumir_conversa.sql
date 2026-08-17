-- ============================================================================
--  ASSUMIR A CONVERSA — a equipe entra e a IA cala a boca.
--
--  Até aqui o painel tinha só `handoff`, que é outra coisa: é a IA PEDINDO a
--  equipe. Ela só pintava a conversa de destaque na lista — a IA continuava
--  respondendo por cima de quem tivesse entrado. Na prática a dona não tinha
--  como assumir um atendimento.
--
--  `ia_pausada` é a trava de verdade: com ela ligada, o webhook grava a
--  mensagem do cliente, marca como não lida e NÃO chama a IA.
-- ============================================================================

alter table clientes
  add column if not exists ia_pausada boolean not null default false,
  add column if not exists ia_pausada_em timestamptz;

comment on column clientes.ia_pausada is
  'A equipe assumiu esta conversa: o webhook nao chama a IA enquanto for true.';
