-- ============================================================================
--  PEDIDO EM MONTAGEM — o pedido existe DURANTE a conversa, não só no fim.
--
--  Até aqui a IA remontava o pedido inteiro do zero a cada chamada: relia as
--  quarenta mensagens, juntava tudo de novo e mandava a lista completa. Um
--  pedido de festa tem quinze decisões espalhadas, e a cada remontagem ela
--  podia perder uma. Foi assim que o bolo virou docinho três vezes, a data
--  virou hoje, o papel de arroz sumiu e o pedido inteiro foi apagado por uma
--  chamada vazia.
--
--  Aqui o pedido nasce vazio quando a conversa começa e vai sendo PREENCHIDO
--  campo a campo. A IA acrescenta e corrige; nunca reescreve o todo. O que já
--  está preenchido não se perde porque ninguém remonta.
--
--  Vale pra QUALQUER pedido, não só festa: quem encomenda o aniversário também
--  leva pão pra semana, e um painel que só existe pra festa some justamente
--  quando o pedido fica misturado.
--
--  itens: [{ produto, categoria, qtd, unidade, obs }]
--  dados: { retirada_data, retirada_hora, cliente_nome, forma_pagamento, observacoes }
-- ============================================================================

create table if not exists pedido_montagem (
  negocio_id   uuid not null,
  cliente_id   uuid not null,
  itens        jsonb not null default '[]'::jsonb,
  dados        jsonb not null default '{}'::jsonb,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (negocio_id, cliente_id)
);

comment on table pedido_montagem is
  'O pedido sendo montado nesta conversa. Preenchido campo a campo pela IA, visivel e editavel no painel. Vira pedido de verdade no fechamento.';
