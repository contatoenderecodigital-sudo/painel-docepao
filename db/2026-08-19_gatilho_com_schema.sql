-- ============================================================================
--  O GATILHO DA APROVACAO NAO PODE DEPENDER DE QUEM CONECTOU.
--
--  Aprovar um pedido dispara este gatilho, que joga a comanda na fila de
--  impressao. A tabela estava escrita sem o schema, entao ele so funciona
--  quando a conexao vem com o search_path certo. Numa conexao de manutencao
--  (psql, script, backup restaurando) a aprovacao FALHA com "relation
--  fila_impressao does not exist", e o pedido aprovado nao chega na cozinha.
--
--  Aconteceu de verdade num teste: aprovar pelo banco quebrou, e so nao virou
--  problema porque foi teste.
--
--  Duas travas: o nome da tabela vai qualificado e a funcao fixa o proprio
--  search_path, entao ela passa a funcionar venha de onde vier a conexao.
-- ============================================================================

create or replace function docepao.on_pedido_aprovado()
returns trigger
language plpgsql
set search_path = docepao, public
as $$
begin
  if new.status = 'aprovado' and (old.status is distinct from 'aprovado') then
    -- on conflict: se ja existir uma comanda 'pendente' desse pedido, nao cria outra.
    insert into docepao.fila_impressao (negocio_id, pedido_id) values (new.negocio_id, new.id)
      on conflict (pedido_id) where status = 'pendente' do nothing;
    new.aprovado_em := now();
  end if;
  return new;
end;
$$;
