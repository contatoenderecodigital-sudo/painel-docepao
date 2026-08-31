# Quando você acordar

31/08/2026. Uma página, sem "falta pouco".

---

## O RESUMO EM TRÊS LINHAS

O pedido de festa fecha inteiro pelo WhatsApp, com a conta certa e cada item na
comanda certa. Vinte e nove defeitos foram fechados nesta madrugada, todos com
medição contra o servidor. **Dezoito deles só apareceram conversando**, e nenhum
dos testes pegava.

---

## O QUE ESTÁ DE PÉ, COM PROVA

Rodei a tua conversa do zero contra o servidor, mensagem por mensagem:

```
Fechando o pedido:
- 50 bolinha de queijo                                 R$ 1,00 cada = R$ 50,00
- 50 coxinha (frango)                                  R$ 1,00 cada = R$ 50,00
- 50 risólis (frango)                                  R$ 1,00 cada = R$ 50,00
- 50 mini bolha (frito, carne)                         R$ 1,00 cada = R$ 50,00
- 50 brigadeiro (forminha rosa)                        R$ 1,25 cada = R$ 62,50
- 50 beijinho (forminha rosa)                          R$ 1,25 cada = R$ 62,50
- 2 kg de bolo brigadeiro com 0% lactose
  (tema futebol, Gabriel Lucas, 12 anos, com topo)     R$ 55,90/kg = R$ 111,80
- 1 papel de arroz (tema futebol, Gabriel Lucas, 12 anos)  R$ 12,00 = R$ 12,00

Total: R$ 448,80
```

E o cupom que a cozinha receberia, montado com o código de agora:

```
== BOLO FESTA ==
2 kg    bolo brigadeiro com 0% lactose
  > tema futebol
  > nome Gabriel Lucas
  > 12 anos
  > topo de bolo
```

Compara com a foto que você mandou: lá o nome saía três vezes e **não dizia que
era sem lactose**.

Também rodei uma conversa difícil de ponta a ponta: cliente que dá quantidade e
dia na primeira frase, pergunta por um sabor que não existe, troca de item no
meio, pergunta o preço e fecha. Fechou certo, e o "pra sexta" da primeira
mensagem sobreviveu a doze turnos.

**Portão em 135 testes verdes. Build limpo. Tudo no ar.**

---

## OS CATORZE DOS TEUS PRINTS: FECHADOS

Os cinco que custavam dinheiro:

| defeito | custava |
| --- | --- |
| sem lactose sumia do pedido | R$ 18,00 no bolo, e a equipe nem era avisada |
| papel de arroz sumia ao salvar no painel | R$ 12,00, calado, em todo pedido com bolo |
| cor da forminha escolhida sozinha | 100 forminhas na cor errada |
| "quero carne" impresso na comanda | a cozinha lê a tua frase no lugar do recheio |
| nome do aniversariante não enchia o campo | equipe redigita |

Os outros nove eram conversa: cardápio três vezes, quatro mensagens de uma vez,
topo antes do sabor, "dia 12", "Qual nome está no pedido?", pergunta final sem
botão, "(queijo)" repetido, nome duplicado no bolo, e a coxinha do nada.

---

## OS QUINZE QUE SÓ A CONVERSA ACHOU

Com o portão verde o tempo todo:

**Custavam dinheiro ou comida errada:**

1. A guarda anti-invenção montou `mini frango`, que não existe, e o motor cotava
   a linha fantasma em **R$ 120,00**.
2. **"Sim" digitado se perdia.** Você tocou nos botões e por isso não viu. Quem
   digita perdia o papel de arroz, o topo, o tema e o nome do aniversariante.
3. **O pedido fechava com o nome errado**: resumo "bolo brigadeiro com 0%
   lactose", gravado "bolo brigadeiro". Preço certo, comanda errada, e a
   confeitaria faria com lactose.
4. **O docinho sumia dentro do bolo**: "50 brigadeiro e um bolo de 2 kg de 4
   leites" fechava só com o bolo.
5. O recheio fixo dependia do modelo lembrar: mesma fala, duas conversas, uma
   com frango e outra sem.
6. "salgadinho" virava o recheio **"nho"** na comanda.
7. "docinho de morango" virava bolo.

**Custavam confiança:**

8. **Cliente reclamando ouvia "Bom dia, como posso ajudar?"** O modelo
   classificava certo e o código descartava em silêncio, porque a frase citava
   um produto. E reclamação quase sempre cita.
9. Reclamação e cancelamento chegavam no painel **sem motivo**.
10. "tem coxinha de camarão?" era respondido com o preço, não com "a gente faz
    de frango".
11. "A gente faz coxinha de frango" saía quando o sabor era do outro item da
    lista.
12. Item descartado segurava o sabor da pergunta, e a padaria repetia.
13. "frango" foi lido como "escolhe você".
14. O painel mostrava "Gabriel Lucas | 12 anos | topo de bolo" no campo do nome.
15. O tipo do salgado saía duas vezes no cupom.

---

## O QUE VIROU TRAVA, E NÃO REMENDO

1. **Nome fora do cardápio não vira linha do pedido.** Roda no fim, em todo
   caminho. Nome de família ("pizza" esperando o tipo) continua valendo.
2. **Produto de sabor único sai com o sabor do catálogo**, antes da disputa.
3. **A família que o cliente diz manda** na hora de escolher o produto.
4. **A observação do bolo tem um leitor só**, e o painel usa ele.
5. **"Sim" digitado vale como botão.**
6. **Responder uma opção não é delegar.**
7. **O nome que fecha é o nome que o cliente aceitou.**
8. **Quantidade de produto por unidade é inteira.**
9. **Reclamação e cancelamento são sempre da equipe**, mesmo citando produto.

Cada uma com teste, e cada teste com isca: desliguei o conserto e conferi que
fica vermelho.

---

## DOIS "REMENDOS" QUE EU LISTEI E NÃO EXISTIAM

Eu te disse que kg contra unidade era remendo, e que o texto do cliente e o da
comanda eram montados em dois lugares. **Fui medir e os dois já estavam certos.**
A unidade nunca é guardada no fluxo, e o resumo já bate com o cupom. Escrevi
teste pros dois pra travar como estão.

---

## O CUSTO DA OPENAI, PUXADO DO BANCO

| dia | chamadas | tokens por chamada | custo |
| --- | --- | --- | --- |
| 20 a 23/08 | 21.000 | 22.000 a 26.000 | R$ 321 |
| 27/08 em diante | 2.400 | 778 | não estava sendo gravado |

O caro foi o prompt do cérebro antigo, apagado em 26/08. Hoje uma conversa de
festa inteira custa uns **R$ 0,07**. Toda a madrugada custou menos de R$ 2,00.

O custo tinha parado de ser registrado: `estimarCustoCentBRL` arredondava pra
centavo inteiro e zerava tudo. Consertado, e era por isso que o painel mostrava
"Custo de IA: -".

---

## O QUE EU ERREI, PRA FICAR REGISTRADO

- Listei três remendos e dois não existiam. Listei por leitura, não por medição.
- Chutei a causa do `mini frango` duas vezes antes de ler o log. As duas erradas.
- Montei duas sondas com resposta de modelo inventada por mim; o caso passava
  verde e a produção continuava quebrada. Quando peguei a resposta real do log,
  reproduzi de primeira.
- Meu carimbo do recheio fixo quebrou outra regra que estava certa. Quem pegou
  foi um teste que já existia.
- Levantei um alarme falso dizendo que sabor fora do cardápio entrava no pedido.
  Não entrava; minha sonda é que estava errada.

---

## AINDA ABERTO

- `quero 50 docinhos de morango` deixa uma linha de família "bolo" sobrando. A
  padaria pergunta "qual bolo?" a mais. Não custa dinheiro.
- Quem escreve "100 salgadinhos pra sexta" ouve "quantas pessoas vão ter na
  festa?". Ela se corrige na mensagem seguinte, mas a primeira pergunta é fora
  de lugar.

---

## O QUE AINDA NÃO FOI MEDIDO

- **O cupom saindo da impressora de verdade.** Montei o texto com o mesmo código
  do servidor e conferi, mas não aprovei nenhum pedido de teste: a ponte está
  online, e aprovar faria sair papel na padaria de madrugada.
- **A tela de aprovação**, clicando aprovar num pedido de festa.
- As seis perguntas que sobraram em `PERGUNTAR-PRA-DONA.md`.
