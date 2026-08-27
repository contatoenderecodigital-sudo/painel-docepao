# O que perguntar pra dona

Este é o arquivo VIVO das perguntas. Toda vez que eu achar algo que o sistema
precisa saber e os áudios não respondem, cai aqui, com o motivo e o que muda no
atendimento dependendo da resposta.

Aberto em 26/08/2026, a pedido dele: *"anota tudo q precisa q eu peca num .md q
tu for achando"*.

Regra: pergunta que já foi respondida sai daqui e vira fato no catálogo ou em
`lib/ia/fatos.ts`, com a data e a origem da resposta.

---

## A LISTA, na ordem em que ele deve perguntar

Numeradas pra ele poder mandar por áudio e ela responder pelo número.

### Produto e preço

**1. O que muda no cupcake recheado?**

Ela citou o preço duas vezes e o tamanho em centímetros, e nunca disse o que é o
recheio. A IA vai precisar explicar isso pro cliente que perguntar "recheado de
quê?".

Achado hoje, e que torna a pergunta urgente: o sistema estava cobrando o cupcake
recheado pelo preço do sem recheio (R$ 2,00 no lugar de R$ 3,00, e R$ 5,00 no
lugar de R$ 7,00). Já corrigido. Mas se o recheio tiver sabores diferentes, a IA
vai ter que perguntar qual, e hoje ela não pergunta.

**2. O cupcake grande tem os mesmos dois sabores do pequeno?**

Ela citou "quatro leites e brigadeiro" falando dos pequenos. Do grande, falou só
tamanho e preço. Hoje o sistema assume que são os mesmos.

**3. `bolo prestígio com ganache` e `bolo prestígio` são a mesma coisa?**

Existem os dois no catálogo, e são produtos diferentes:

| nome | o que é | preço |
| --- | --- | --- |
| bolo prestígio | bolo de festa, por quilo | R$ 46,90/kg |
| bolo prestígio com ganache | bolo caseiro, por unidade | R$ 33,90 |

O sistema já sabe diferenciar os dois pelo nome completo (consertado em
26/08/2026: antes o caseiro saía cotado como o de festa, R$ 46,90 no lugar de
R$ 33,90, e ainda por quilo em vez de por unidade).

O que falta saber: quando o cliente diz **só "bolo de prestígio"**, a IA
pergunta qual dos dois, ou tem um que é o óbvio? Hoje ela entende como o de
festa, calada.

**4. Tem `banana caramelizada` e `laranja caramelizada` nos bolos caseiros?**

Os dois estão no catálogo, e o sistema agora trata como dois bolos diferentes
(antes a banana era cotada com o preço da laranja, R$ 34,90 no lugar de
R$ 30,90). Só quero confirmar com ela que são dois mesmo, e não um cadastrado
duas vezes com o nome trocado.

**4b. `café` é bolo caseiro E docinho ao mesmo tempo?**

O catálogo tem os dois: docinho de café R$ 1,25 e bolo caseiro de café R$ 35,90.
Hoje a IA já decide pela etapa da conversa (na hora do bolo é o bolo, na hora do
docinho é o docinho), mas se a dona confirmar que um dos dois não existe mais, a
ambiguidade some.

**4c. Dá pra fazer qualquer bolo sem lactose, ou só o `0% lactose`?**

O cardápio tem `0% lactose` como **sabor** de bolo de festa, faixa C, R$ 55,90 o
quilo. O brigadeiro é faixa A, R$ 46,90.

A pergunta é: se o cliente pedir **bolo de brigadeiro sem lactose**, a cozinha
faz e cobra faixa C? Ou `0% lactose` é um sabor fechado, que só existe daquele
jeito?

Isso vale dinheiro nos dois sentidos. Se dá pra fazer e a IA disser que não, a
padaria perde uma venda de R$ 55,90 o quilo. Se não dá e ela disser que sim, a
cozinha recebe um pedido que não consegue produzir.

**Enquanto ela não responde, a IA não decide:** ela tira a promessa da
observação (senão a comanda manda produzir uma coisa e o resumo promete outra) e
chama a equipe, que é o mesmo que a casa já faz com desconto e com entrega.

**4d. E o resto das restrições, a casa faz alguma?**

Glúten, vegano, diet e integral **não aparecem em lugar nenhum** do catálogo.
Preciso confirmar que é porque a padaria não faz mesmo, e não porque ninguém
cadastrou.

**5. Cachorro-quente: o cliente pode pedir "médio" ou "grande" pelo nome?**

O preço é o mesmo (R$ 19,90/kg), mas muda o produto na bancada.

### Regra de atendimento

**6. Desconto e beneficente: confirma que a IA nunca dá o preço por unidade?**

Nos áudios ela disse os valores (cachorro-quente R$ 1,20, pão de X R$ 1,40) e
disse também o que a IA deve responder:

> *"aí ela pode sempre falar assim, ah, então deixa eu ver a possibilidade de um
> desconto, eu já te retorno."*

Quero confirmar que é sempre assim, e que a IA nunca solta o valor.

**7. Sabor fora do catálogo: a IA anota e a equipe confirma, ou ela pergunta antes?**

Ela disse que a lista é aberta:

> *"coloca só esses dois sabores, quatro leites e brigadeiro, a princípio. Aí, se
> o cliente pedir outro sabor, a gente vai colocando"*

Hoje o sistema RECUSA o que não está no catálogo. Isso está errado, e o conserto
depende de saber se a IA aceita na hora ou passa pra equipe.

**8. O bolo com foto: a IA deve encaminhar pro grupo da confeitaria?**

É pergunta dela, e continua aberta:

> *"será que a nossa Dorinha vai conseguir encaminhar para a turma da
> confeitaria? Se não conseguir, não tem problema... será que tem como ensinar
> ela a fazer isso?"*

**9. Bolo redondo acima de 2,5 kg: a IA explica que fica mais alto, ou é conversa da equipe?**

Ela descreveu os degraus de peso e a mudança de altura, e ela mesma previu a
dúvida:

> *"Não sei se ela vai conseguir explicar isso para o cliente, mas aí qualquer
> coisa ela pode estar perguntando."*

---

## De onde vem cada uma

As perguntas 1, 2, 5, 6, 7, 8 e 9 saíram da varredura das 55 transcrições, em
`O-QUE-A-DONA-FALOU.md`, com a citação de origem.

As perguntas 3 e 4 saíram da padronização do catálogo, em 26/08/2026, medindo o
nome que a IA escreve contra o nome que o motor de preço entende.

---

## O QUE JÁ FOI RESPONDIDO

Nada ainda. Quando ela responder, a resposta entra aqui com a data, e a pergunta
sai da lista de cima.
