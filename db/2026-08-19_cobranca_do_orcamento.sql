-- COBRANÇA DO ORÇAMENTO PARADO.
--
-- A tela de Recuperar existia desde o começo prometendo que "o sistema cobra
-- sozinho". Não cobrava: nada no código jamais marcava um pedido como 'orcado',
-- nada incrementava 'cobrancas', e a coluna 'cobrado_em' da tabela pedidos
-- nunca foi escrita. Com banco real a tela ficava vazia pra sempre, e o card de
-- recuperado no mês ficava em R$ 0,00 pra sempre também.
--
-- O orçamento parado de verdade não mora em pedidos: mora em pedido_montagem,
-- que é onde a Dora anota o que o cliente foi pedindo. Cliente que montou e
-- sumiu tem itens ali e nenhuma linha em pedidos. É esse o dinheiro em risco.
--
-- Tabela separada em vez de colunas novas em pedido_montagem de propósito: a
-- montagem é memória viva da conversa e é reescrita a cada mensagem, enquanto a
-- cobrança é histórico e não pode ser apagada junto.

create table if not exists docepao.cobranca_orcamento (
  negocio_id     uuid        not null,
  cliente_id     uuid        not null,
  -- Quantas vezes já cobramos e quando foi a última: as duas coisas decidem se
  -- pode cobrar de novo. Cobrar demais queima o cliente e a conta do WhatsApp.
  cobrancas      integer     not null default 0,
  cobrado_em     timestamptz,
  -- O cliente voltou a falar depois da cobrança: prova de que ela funcionou,
  -- mesmo que ele ainda não tenha fechado.
  cliente_viu_em timestamptz,
  -- A dona pode dispensar (cliente desistiu, comprou em outro lugar, foi
  -- engano). Dispensado sai da lista e nunca mais é cobrado.
  dispensado_em  timestamptz,
  criado_em      timestamptz not null default now(),
  primary key (negocio_id, cliente_id)
);

-- Quem cobrar primeiro é sempre por tempo parado, então o índice segue isso.
create index if not exists idx_cobranca_orcamento_negocio
  on docepao.cobranca_orcamento (negocio_id, cobrado_em desc nulls first);
