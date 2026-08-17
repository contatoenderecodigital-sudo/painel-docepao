-- ============================================================================
--  FORMA DE PAGAMENTO NO PEDIDO.
--
--  O card da fila mostrava "Pagamento na retirada" em TODO pedido — porque o
--  badge lia do banco e o banco não tinha a coluna. A equipe via sempre a mesma
--  coisa, independente do que o cliente combinou, e o padrão virava mentira.
-- ============================================================================

alter table pedidos
  add column if not exists forma_pagamento text;

comment on column pedidos.forma_pagamento is
  'Como o cliente disse que vai pagar: pix, cartao, dinheiro. Null = nao informado.';
