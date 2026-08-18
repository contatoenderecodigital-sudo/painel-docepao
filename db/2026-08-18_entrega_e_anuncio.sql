-- ============================================================================
--  O QUE O WHATSAPP CONTA DEPOIS DE ENVIAR, E DE ONDE O CLIENTE VEIO.
--
--  O webhook recebe dois avisos que a gente jogava fora:
--
--  1) STATUS de cada mensagem enviada (enviada, entregue, lida, falhou). Sem
--     isso a equipe nao sabe se o cliente recebeu o resumo do pedido, e falha
--     de envio (numero errado, janela de 24h fechada) passava despercebida: a
--     dona achava que tinha avisado e o cliente nunca soube.
--
--  2) REFERRAL do anuncio Click-to-WhatsApp: quando a conversa comeca por um
--     anuncio, a Meta manda a campanha junto da primeira mensagem. E a unica
--     chance de saber que aquele pedido veio de anuncio pago; depois some.
-- ============================================================================

alter table mensagens add column if not exists entregue_em timestamptz;
alter table mensagens add column if not exists lida_em timestamptz;
alter table mensagens add column if not exists falha text;

-- De qual anuncio veio o cliente (titulo, url e id do clique), guardado na
-- primeira mensagem em que a Meta mandou o referral.
alter table clientes add column if not exists origem_anuncio jsonb;

create index if not exists idx_mensagens_wamid on mensagens (wamid);
