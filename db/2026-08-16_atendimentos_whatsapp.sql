-- ============================================================================
--  MIGRAÇÃO — Atendimentos vira WhatsApp Web (mídia recebida + autoria + leitura)
--  Aplicar no schema `docepao` do Postgres (role do painel não tem DDL).
--
--  Contexto: o número da padaria sai do celular pra Cloud API da Meta. A dona
--  perde o WhatsApp normal, então o painel VAI SUBSTITUIR o WhatsApp dela. Pra
--  isso a conversa precisa guardar TUDO que o WhatsApp guarda:
--
--  1) mensagens.autor       — distingue quem falou: 'cliente' | 'ia' | 'equipe'.
--     (papel continua 'user'/'assistant' pro contexto da IA; a mensagem que a
--      DONA digita entra papel='assistant' + autor='equipe'.)
--  2) mensagens.tipo        — 'texto' | 'imagem' | 'audio' | 'documento'.
--  3) mensagens.midia_*     — a mídia recebida guardada em base64 NO BANCO (o
--     container é efêmero; filesystem some entre deploys), servida por
--     /api/midia/[id] escopada por negócio + sessão.
--  4) mensagens.wamid       — id da mensagem na Meta (rastreio/idempotência).
--  5) mensagens.lida        — controle de "não lida" da conversa.
--  6) clientes.handoff      — a IA pediu a equipe ("precisa de você"): destaca a
--     conversa na lista até alguém assumir.
-- ============================================================================

set search_path to docepao, public;

-- 1) Colunas novas em mensagens ----------------------------------------------
alter table mensagens
  add column if not exists autor       text,
  add column if not exists tipo        text not null default 'texto',
  add column if not exists midia_mime  text,
  add column if not exists midia_dados text,          -- base64, sem prefixo data:
  add column if not exists midia_nome  text,          -- nome do arquivo (documento)
  add column if not exists wamid       text,
  add column if not exists lida        boolean not null default false;

-- Backfill: deriva o autor do papel no histórico já existente.
update mensagens set autor = case when papel = 'user' then 'cliente' else 'ia' end
  where autor is null;

-- Histórico já existente conta como LIDO (não queremos um monte de "não lidas"
-- aparecendo no primeiro deploy). Mensagens novas do cliente entram lida=false.
update mensagens set lida = true where lida = false;

-- 2) Handoff da IA por cliente ------------------------------------------------
alter table clientes
  add column if not exists handoff boolean not null default false;

-- 3) Índices ------------------------------------------------------------------
-- Ordenação/carregamento do histórico por conversa.
create index if not exists idx_mensagens_cliente_criado
  on mensagens (negocio_id, cliente_id, criado_em);

-- Contagem de não-lidas (só o que interessa: mensagens ainda não lidas).
create index if not exists idx_mensagens_nao_lidas
  on mensagens (negocio_id, cliente_id)
  where lida = false;
