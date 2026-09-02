-- O LEMBRETE DA RETIRADA SAI UMA VEZ SO.
--
-- Pedido dele em 02/09/2026: "colocar um tempo ali de avisar 10 horas antes do
-- horario que eles agendaram para buscar o produto deles".
--
-- QUEM GUARDA O "JA AVISEI" E O BANCO, e nao a memoria do processo. O container
-- reinicia, o deploy troca a imagem, e duas rodadas podem se cruzar. Sem marca
-- gravada, cada reinicio manda o lembrete de novo pra todo mundo que estiver na
-- janela, e o cliente recebe a mesma mensagem cinco vezes.
--
-- Fica no PEDIDO porque e do pedido que se lembra: um cliente pode ter dois
-- pedidos pra semanas diferentes, e cada um tem o seu aviso.
alter table docepao.pedidos
  add column if not exists lembrete_em timestamptz;

-- A rodada do lembrete procura por data de retirada entre os aprovados. Sem o
-- indice ela varre a tabela inteira a cada passada do relogio.
create index if not exists idx_pedidos_lembrete
  on docepao.pedidos (negocio_id, status, retirada_data)
  where lembrete_em is null;
