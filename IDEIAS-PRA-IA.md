# Ideias para a IA trabalhar melhor

As ideias que aparecem no meio da leitura dos arquivos e **não se implementam na
hora**. Elas ficam aqui até a leitura da cadeia terminar, e aí a gente decide
juntas, vendo o quadro inteiro.

O motivo de esperar é o de sempre neste projeto: mexer no meio da leitura, sem
ver o que vem depois, é como quase todo defeito nasceu.

---

## 1. Perguntar de cara se é pedido novo ou pedido que já existe

**Ideia do dono, 27/08/2026.** Quando o cliente manda mensagem, a padaria
começa perguntando de qual assunto ele está falando: um pedido novo, ou um
pedido que ele já fez. A partir daí ela conversa sabendo em cima do quê está
mexendo, e não se confunde.

### O que ela resolve

Existe uma janela entre o cliente fechar o pedido e a cozinha imprimir. Nela, o
pedido já está registrado e o rascunho da conversa está vazio.

Até 27/08/2026 o código tentava adivinhar, por uma lista de dezesseis verbos
minha (`mudar`, `troca`, `acrescenta`...), se a mensagem era sobre mexer no
pedido. Errava em "coloca mais 50", "em vez de 200" e "deixa 100", e quando
errava a padaria recomeçava do zero, perguntando o que o cliente já tinha
respondido.

A lista saiu no mesmo dia: o pedido em aberto passou a ir SEMPRE pra IA, que
entende o que a lista não entendia. Só que agora qualquer mensagem naquela
janela restaura o pedido, inclusive um "obrigado", e a padaria pode devolver o
resumo inteiro pra quem só agradeceu.

A pergunta do dono resolve isso na raiz: em vez de o código adivinhar de que o
cliente está falando, **a padaria pergunta**, que é o que uma atendente faz.

### A ressalva, que é do desenho e não da ideia

Perguntar isso pra **todo mundo** cansa quem está chegando pela primeira vez, e
a maioria das conversas é gente nova pedindo coisa nova. A pergunta só se
justifica quando existe pedido em aberto de verdade.

Então a regra provável é:

```
tem pedido em aberto?   ->  pergunta de qual ele está falando
não tem?                ->  atende direto, como hoje
```

### O que falta decidir

- A pergunta vira **botão** ("Pedido novo" / "O que eu já pedi")? A clientela da
  padaria enxerga melhor botão, e essa resposta tem só duas saídas.
- Vale também **depois** de a cozinha imprimir? Aí não dá mais pra mexer, e a
  resposta certa é chamar a equipe.
- O que acontece com quem responde outra coisa? A regra da casa já é: perguntar
  uma vez, e se ele responder outra coisa, seguir com o que ele falou.
