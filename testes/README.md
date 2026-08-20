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

## qa-painel.cjs

O caminho da dona: foto de referencia chegando no pedido, bolo em kg com preco de
bolo, papel de arroz cobrado, o botao mostrando o valor certo, o total subindo
com o topo, o pedido esperando o cliente e so depois caindo na aprovacao.

```
node testes/qa-painel.cjs
```

## webhook-simulado.cjs

Simula uma mensagem chegando pelo webhook, ASSINADA como a Meta assina. E o
unico jeito de testar o caminho de producao inteiro (webhook, IA, gravacao da
conversa, peca de cardapio virando mensagem) sem depender do WhatsApp. Usa
numero ficticio por padrao, de proposito.

```
docker exec <container> node /tmp/wf.cjs 5511999990000 "me manda o cardapio de bolos" <phone_id>
```


## NUNCA rode dois portões ao mesmo tempo

Os testes `qa-*` e `pausa-nao-vaza` falam com a VPS de verdade e usam telefones
de teste FIXOS (5511955550001 a 0003, entre outros). Dois `node testes/todos.cjs`
rodando juntos disputam os mesmos clientes no banco: um limpa enquanto o outro
mede, e o resultado é uma reprovação que não existe.

Aconteceu em 20/08/2026: `pausa-nao-vaza` reprovou num portão e passou sozinho
no minuto seguinte, sem nenhuma mudança de código. Meia hora perdida procurando
defeito em código que estava certo.

Se um teste que fala com a VPS reprovar, a primeira coisa a fazer é rodar ele
SOZINHO antes de mexer em qualquer linha:

    node testes/pausa-nao-vaza.cjs

E rode o portão sem cano: `node testes/todos.cjs | tail` faz o `&&` seguinte ler
o código de saída do `tail`, e o commit passa com teste vermelho.

## A barra invertida morre no caminho do shell

Este arquivo nasceu com `/^(topo de bolo|...)\b/` e chegou no disco como
`/^(topo de bolo|...)^H/`, com o byte de backspace no lugar do limite de
palavra. A regex nunca casava e o teste reprovava um código correto.

Aconteceu três vezes neste projeto e já custou horas. Duas regras:

1. Patch em arquivo se escreve com a ferramenta Write ou Edit, nunca por
   heredoc, `sed -i` ou `node -e` com aspas.
2. Quando der pra escrever a regex **sem barra invertida**, escreva. `($| )`
   faz o mesmo que `\b` no fim de uma alternância e não tem como ser comido.

Pra conferir se um arquivo foi corrompido assim:

    grep -n "sua regex" arquivo.cjs | cat -A

Byte de backspace aparece como `^H`.
