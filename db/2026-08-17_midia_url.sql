-- ============================================================================
--  MÍDIA POR URL NA MENSAGEM.
--
--  Os cardápios que a IA manda vão por LINK pro WhatsApp, não por upload. Como
--  a gente só gravava o texto, a dona abria a conversa no painel e via a Dora
--  dizendo "te mandei o cardápio" sem cardápio nenhum: sem saber o que o
--  cliente recebeu, ela não tem como continuar o atendimento.
--
--  Guardar o base64 dessas peças seria 400 KB por envio, repetidos, pra uma
--  imagem que já está publicada no nosso domínio. A URL basta.
-- ============================================================================

alter table mensagens
  add column if not exists midia_url text;

comment on column mensagens.midia_url is
  'Imagem publicada (cardapio). Alternativa a midia_dados, que guarda base64 do que o cliente enviou.';
