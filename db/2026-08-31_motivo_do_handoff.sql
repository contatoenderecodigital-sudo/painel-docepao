-- POR QUE A IA CHAMOU A EQUIPE
--
-- No pedido de festa de 30/08/2026 a Dora disse pro cliente "sobre o sem
-- lactose: deixa eu confirmar com a equipe e ja te retorno por aqui", e a
-- equipe nunca ficou sabendo de que se tratava. O painel acendia o aviso
-- generico ("A IA pediu a equipe nesta conversa") e o sino dizia so "1 conversa
-- esperando voce responder".
--
-- Palavra do dono: "pode ver q em nenhum lugar tem o lactose, ngm sabe, nem no
-- painel aprovacao nem nada".
--
-- Sem o motivo, quem abre a conversa precisa ler 47 mensagens pra descobrir o
-- que a IA prometeu, e enquanto isso o cliente espera um retorno.

alter table docepao.clientes add column if not exists handoff_motivo text;
