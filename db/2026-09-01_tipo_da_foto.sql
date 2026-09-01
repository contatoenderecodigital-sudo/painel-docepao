-- A FOTO DO BOLO E O COMPROVANTE DO PIX NAO SAO A MESMA COISA.
--
-- Ate hoje toda foto que o cliente mandava entrava igual, e a tela do pedido
-- mostrava UMA so, a mais recente:
--
--   select dados, mime from pedido_fotos ... order by criado_em desc limit 1
--
-- Com a chave pix no ar (01/09/2026), o cliente manda a foto do tema e depois o
-- comprovante. O comprovante e mais recente, entao ele COBRIA a foto do bolo na
-- fila de aprovacao e na producao: a cozinha perdia a referencia da peca.
--
-- O dono viu isso antes de acontecer, perguntando de onde viria o comprovante se
-- a pessoa ja tinha anexado a foto do bolo.
--
-- 'referencia' e o padrao porque e o que toda foto era ate agora.
alter table docepao.pedido_fotos
  add column if not exists tipo text not null default 'referencia';

-- Quem procura o comprovante de um pedido procura por isso.
create index if not exists idx_pedido_fotos_tipo
  on docepao.pedido_fotos (pedido_id, tipo);
