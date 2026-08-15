-- ============================================================================
--  MIGRAÇÃO — Handoff inteligente + Foto de referência do pedido
--  Aplicar no schema `docepao` do Postgres.
--
--  1) pedidos ganha a pendência de confirmação da equipe (o pedido cai na fila
--     JÁ MONTADO, só com um aviso pra dona revisar, em vez de virar beco).
--  2) pedido_fotos: a foto de referência (bolo decorado, tema de festa) guardada
--     em base64 NO BANCO (não no filesystem: o container é efêmero). Uma foto
--     entra "pendente" (pedido_id null) quando o cliente manda antes do pedido
--     fechar, e é ligada ao pedido no registrarPedido.
-- ============================================================================

set search_path to docepao, public;

-- gen_random_uuid() (no Supabase costuma já existir; garante em Postgres puro).
create extension if not exists pgcrypto;

-- 1) Handoff inteligente ------------------------------------------------------
alter table pedidos
  add column if not exists precisa_confirmacao boolean not null default false,
  add column if not exists motivo_humano       text;

-- 2) Foto de referência do pedido --------------------------------------------
create table if not exists pedido_fotos (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null,
  cliente_id  uuid,
  pedido_id   uuid references pedidos(id) on delete cascade,
  dados       text not null,                      -- imagem em base64 (sem prefixo data:)
  mime        text not null default 'image/jpeg',
  criado_em   timestamptz not null default now()
);

-- Buscar a foto de um pedido (rota que serve a imagem no painel).
create index if not exists idx_pedido_fotos_pedido
  on pedido_fotos (pedido_id);

-- Ligar as fotos PENDENTES ao pedido no fechamento (por negócio + cliente).
create index if not exists idx_pedido_fotos_pendentes
  on pedido_fotos (negocio_id, cliente_id)
  where pedido_id is null;
