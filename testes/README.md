# QA da conversa

Roda conversas inteiras contra o cérebro real (o mesmo `responder()` da
produção, pela rota `/api/testar-ia`) e cobra cada regra que já quebrou em
teste manual. Cada verificação nasceu de um erro encontrado no WhatsApp de
verdade, pra ninguém precisar achar o mesmo bug duas vezes.

## Rodar

```
node testes/qa-conversa.cjs
```

Precisa do Playwright instalado (já está em `node_modules`) e do login do painel.

## Importante

Os pedidos que a IA fechar durante o teste **caem na fila de verdade**. Limpe o
banco antes e depois, senão eles se misturam com pedido de cliente.

## O que ele cobre

Regras gerais, em toda resposta: sem travessão, sem emoji, uma pergunta por vez
(cumprimento não conta), sem jargão interno ("faixa A", "registrei no sistema").

Por cenário: sugestão inicial falando por categoria e não por tipo; peça de
cardápio realmente enfileirada e não só prometida; recheio perguntado e nunca
inventado; sabor do docinho antes da cor da forminha; nome e idade pedidos
quando há topo; bolo entrando como bolo em kg e não como docinho de R$ 1,25;
papel de arroz virando item próprio; forma de pagamento que o cliente falou
gravada, e a que ele não falou recusada; nome do aniversariante sinalizado
quando vai como nome do pedido; e um pedido só por conversa.
