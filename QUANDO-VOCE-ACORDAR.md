# Quando você acordar

31/08/2026, segunda noite. Uma página, sem "falta pouco".

---

## O RESUMO EM TRÊS LINHAS

Testei tudo conversando, como tu mandou: fingi ser cliente na produção, uma
mensagem por vez, lendo cada resposta. **Nove defeitos novos**, todos medidos,
todos fechados com regra e teste. O portão foi de 138 para 156 testes.

Quatro conversas inteiras fecham certo hoje: o pedido do Alessandro, uma festa de
30 pessoas, um bolo com todas as peças e o bolo sem lactose.

---

## O QUE ESTÁ DE PÉ, COM PROVA

**Festa de 30 pessoas**, do "oi" ao pedido registrado:

```
- 150 coxinha (frango)                    R$ 1,00 cada = R$ 150,00
- 150 risólis (carne)                     R$ 1,00 cada = R$ 150,00
- 75 brigadeiro (forminha preta)          R$ 1,25 cada = R$  93,75
- 75 beijinho (forminha preta)            R$ 1,25 cada = R$  93,75
- 3 kg de bolo laka                       R$ 46,90/kg  = R$ 140,70
Total: R$ 628,20     (o mesmo valor da proposta que ele aceitou)
```

**Bolo com todas as peças**, no mesmo formato:

```
- 2 kg de bolo brigadeiro
  (tema homem aranha, Miguel, 5 anos, com topo, prato aberto)  R$ 93,80
- 1 papel de arroz (tema homem aranha, Miguel, 5 anos)         R$ 12,00
Total: R$ 105,80
_O topo entra à parte: a equipe faz o orçamento dele e confirma com você._
```

**Bolo sem lactose**, que antes era venda perdida:

```
cliente >> oi, voces fazem bolo sem lactose?
padaria >> Fazemos sim: temos bolo 0% lactose, R$ 55,90 o quilo.
cliente >> quero um sem lactose de 1 kg entao
pedido  >> 1 kg de bolo 0% lactose   R$ 55,90   -> fila da equipe
```

Os três foram registrados esperando a equipe. Nenhum foi aprovado por mim: a
impressora está online e sairia papel na padaria.

---

## OS NOVE DEFEITOS QUE EU ACHEI CONVERSANDO

**1. O pedido fechava COM a peça que o cliente recusou por escrito.**
Escrevi "nao quero topo nem papel de arroz". O atalho do botão digitado pegava só
a peça perguntada e jogava fora o resto da frase: a comanda saiu com topo, que é
o único item da casa sem preço de tabela. Agora a resposta vale pra cada peça que
a frase nomeia.

**2. Quatro vezes a mesma pergunta.**
A cor da forminha foi perguntada quatro vezes seguidas, comendo minhas respostas.
É o que tu reclamou no teste da Kemilly: "pede o nome 3 vezes". Agora a quarta
vez chama a equipe, com o motivo escrito.

**3. Pedi um bolo e saí com um docinho.**
"queria encomendar um bolo de aniversário" não virava item nenhum, porque não há
produto na frase, só a família. Sem item, ela perguntava "o que você vai querer?"
pra sempre, e "brigadeiro" caía no docinho de R$ 1,25 em vez do bolo de R$ 46,90
o quilo.

**4. O plural não era família.**
"quero salgado" achava; "queria uns salgados pra amanhã" não achava nada. Valia
pra salgados, docinhos, doces e salgadinhos, que é como todo mundo escreve.

**5. "Vocês fazem bolo sem lactose?" ouvia a tabela de preço.**
A casa faz, é sabor de festa da faixa C. Quem pergunta por restrição pergunta
antes de tudo e vai embora com o silêncio. Agora ela responde com o nome do
catálogo e o preço do motor, e fecha a venda sozinha, como tu decidiu. Sem
glúten, vegano, diet e integral continuam indo pra equipe.

**6. E depois de responder, o pedido não entendia.**
"quero um sem lactose de 1 kg" virava a família bolo com "sem lactose" na
observação, e ela perguntava o sabor que eu tinha acabado de escolher.

**7. A resposta do peso se perdia.**
"O pão francês é vendido por quilo. Quantos quilos?" / "2 kg" / a mesma pergunta
de novo, pra sempre. O peso só era lido dentro da lista de itens que o modelo
devolve, e quem responde só o peso não cita produto nenhum.

**8. "2 pao frances" para dois QUILOS de pão.**
Conta certa, linha que engana. O "kg" estava preso ao bolo, e por quilo a casa
vende 31 produtos.

**9. A pergunta que chama a equipe chegava sem motivo.**
Pedi o pix, ela chamou a equipe, e o painel mostrou "precisa de você" sem dizer
do quê. Mesmo buraco da reclamação, noutra porta.

---

## O QUE FALTA, E É TEU

**1. A chave pix.** Enquanto a dona não passar, quem pede a chave cai pra equipe.
Está em `PERGUNTAR-PRA-DONA.md`, pergunta 6. É a mais urgente: cliente que quer
pagar na hora esbarra nisso.

**2. As outras 7 perguntas pra dona**, no mesmo arquivo. A 7 é o cardápio sem
acento ("pao frances" aparece assim pro cliente).

**3. Aprovar um pedido de teste e ver o cupom sair.** Eu não fiz de propósito: a
ponte está online e imprimiria papel de verdade na padaria.

**4. Os dois números do WhatsApp**, que já estavam na lista de ontem.

---

## O QUE EU APRENDI, E VALE MAIS QUE OS CONSERTOS

**Sonda que entrega o item pronto testa a si mesma.** Os dois testes de peso que
já existiam ficaram verdes com a produção quebrada, porque nenhum deles perguntou
o que acontece quando o modelo não lê nada.

**Um defeito escondia o outro.** O erro do pedido sem lactose só apareceu depois
que ela aprendeu a responder que faz. Por isso conversar de novo depois de cada
deploy faz parte do conserto, e não é conferência.

**Conta certa com tela errada é defeito.** O cliente não confere a conta, ele lê
a linha.
