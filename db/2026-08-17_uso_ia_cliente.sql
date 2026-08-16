-- ============================================================================
--  MIGRAÇÃO — Custo POR CONVERSA: amarra o uso de IA ao CLIENTE
--  Aplicar como SUPERUSER (a tabela mora no schema `public`; o role docepao_app
--  não tem DDL em public — o superuser roda esta migração).
--
--  Contexto: cada resposta do cérebro grava consumo em public.uso_ia amarrado
--  só ao negocio_id. Isso dá o total do negócio, mas não diz quanto CADA conversa
--  (cada cliente/atendimento) custou. Adicionamos cliente_id pra creditar o custo
--  por conversa e mostrá-lo no painel (Atendimentos).
--
--  GRANT: já existe GRANT do docepao_app na tabela public.uso_ia. O grant é POR
--  TABELA (não por coluna), então a coluna nova NÃO precisa de grant novo.
-- ============================================================================

-- 1) Coluna que amarra o consumo ao cliente (nullable: teste/demo grava NULL) ---
alter table public.uso_ia
  add column if not exists cliente_id uuid;

-- 2) Índice pro somatório por conversa (negocio_id + cliente_id) --------------
--    É exatamente o predicado da soma em listarConversas
--    (WHERE negocio_id = $1 AND cliente_id = c.id).
create index if not exists idx_uso_ia_negocio_cliente
  on public.uso_ia (negocio_id, cliente_id);
