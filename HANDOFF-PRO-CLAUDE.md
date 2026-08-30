# Handoff pro Claude Code

## COLE ISTO NO CLAUDE CODE

```
Leia CLAUDE.md e HANDOFF-PRO-CLAUDE.md. Nao invente lista: so catalogo, mundo e ids do codigo.

O git que eu medi como origin/main, quando o conserto da conversa ao vivo foi reportado, e 41b23df (A conversa ao vivo nao carimba pizza como salgado nem inventa bacon). Confira git log -1 origin/main. O container no ar pode ser outro SHA: conferir docker, nao Coolify.

O que ja esta neste SHA (e no teste testes/a-conversa-ao-vivo-nao-reparte-pizza.cjs):
- "quero pizza e salgado tambem" na etapa do salgado nao vira 200 x pizza [salgado_frito]
- "redonda" nao inventa pizza de bacon
- 50 coxinha e 30 mini pizza nao viram 66
- calabresa vai pra pizza redonda, nao pra mini
- "escolhe voce a forminha" escolhe a primeira cor de coresDoCardapio()
- "sexta as 16h, nome Marina Costa, pix" entra via juntarComAFrase

Nao mexa nisso se o teste local passar. Producao so vale se o SHA do container for este.

Ainda aberto, nao afirme que esta consertado sem medir:
(a) "voces fazem pizza de forma?" respondeu como bolo de festa, chamou equipe pra orcar, e a IA parou
(b) a IA chama equipe a toa
(c) deploy: SHA do git vs SHA do container
(d) relogio 15h vs 3am

Nunca emoji, nunca travessao. Patch com Write/Edit, nunca heredoc.
```

---

## Regras do produto (de CLAUDE.md)

Painel Doce Pao: WhatsApp anota, equipe aprova, impressora imprime.

- Um cerebro so: `lib/ia/fluxo/*`. `FLUXO_NOVO_PARA=off` desliga a IA, nao troca de cerebro.
- Fonte unica dos produtos: `lib/ia/dados/produtos.ts`. Preco nao muda sem `node testes/o-catalogo-nao-mudou-preco.cjs`.
- Lista minha, nunca. Catalogo, mundo, ou id do codigo.
- Nada some do pedido. A IA nunca confirma sozinha. Nunca emoji, nunca travessao.
- Shell come barra invertida: Write/Edit, nunca heredoc.
- Guarda nova nasce com os dois lados.
- Build nao prova efeito. Medir uma conversa contra o banco. Bateria so prova o caminho dela.
- Portao: `node testes/todos.cjs`.
- Deploy: SHA do container, nao status do Coolify. Nunca deployar enquanto o dono testa.

Arquivos vivos: `O-QUE-FALTA.md`, `PERGUNTAR-PRA-DONA.md`, `PERGUNTA-E-BOTAO.md`, `ARQUITETURA.md`.

---

## SHA de referencia

Quando o conserto da conversa ao vivo foi reportado:

- `origin/main` = `41b23df4fe9775ccc92ed47539d900503fc2c3a9`
- commit: A conversa ao vivo nao carimba pizza como salgado nem inventa bacon
- branch desta entrega: `cursor/conversa-ao-vivo-0548`

Confira de novo com `git log -1 origin/main` antes de medir producao.

---

## PRs

Abertos no momento em que este arquivo foi escrito: nenhum, alem deste se o GitHub ja tiver o PR da branch `cursor/conversa-ao-vivo-0548`.

Ja mesclados na main (historico, nao reabrir):

- #7 `cursor/contexto-nome-duplicado-0548`
- #6 `cursor/festa-nao-vira-pizza-0548`
- #5 `cursor/catalogo-uma-lingua-so-0548`
- #4 `cursor/comanda-salgados-frito-assado-0548`
- #3 `cursor/padronizacao-final-0548`
- #2 `cursor/conversa-ao-vivo-delega-0548`
- #1 `cursor/pizza-familia-e-sabor-insistido-0548`

O conserto da conversa ao vivo (bacon, calabresa, sexta, forminha, 50/30) ja esta no commit `41b23df` da main. Esta branch acrescenta este handoff e o teste vivo se ainda nao estiver no working tree.

---

## O que o proximo agente ainda tem que medir

Nao esta consertado so porque esta escrito aqui.

(a) "voces fazem pizza de forma?" respondeu como bolo de festa, equipe orca, IA parou.
(b) IA chama equipe a toa.
(c) SHA do deploy vs SHA do container.
(d) relogio 15h vs 3am.
