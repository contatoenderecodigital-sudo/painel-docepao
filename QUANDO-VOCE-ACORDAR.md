# Quando você acordar

31/08/2026, madrugada. Uma página, sem "falta pouco".

---

## O QUE ESTÁ DE PÉ, COM PROVA

**O pedido de festa fecha inteiro pelo WhatsApp.** Rodei a tua conversa do zero
contra o servidor, mensagem por mensagem, do "boa noite" até o pedido gravado.

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

No banco: `status=confirmado, data=12/09/2026, hora=18:00, total=R$ 448,80`.
Não imprimiu, porque não foi aprovado. A regra de "a impressora só dispara com o
pedido aprovado" está de pé.

**Portão em 134 testes verdes. Build limpo. Tudo no ar**, container no commit
`9953b51`.

---

## OS CATORZE DEFEITOS DOS TEUS PRINTS: TODOS FECHADOS

Os cinco que custavam dinheiro:

| defeito | custava |
| --- | --- |
| sem lactose sumia do pedido | R$ 18,00 no bolo, e a equipe nem era avisada |
| papel de arroz sumia ao salvar no painel | R$ 12,00, calado, em todo pedido com bolo |
| cor da forminha escolhida sozinha | 100 forminhas na cor errada |
| "quero carne" impresso na comanda | a cozinha lê a tua frase no lugar do recheio |
| nome do aniversariante não enchia o campo | equipe redigita |

Os outros nove eram conversa: cardápio repetido três vezes, quatro mensagens de
uma vez com duas dizendo a mesma coisa, topo perguntado antes do sabor fechar,
"dia 12" não entendido, "Qual nome está no pedido?", pergunta final sem botão,
"(queijo)" repetido, nome duplicado na linha do bolo, e a frase da coxinha que
saiu do nada.

---

## O QUE SÓ A CONVERSA ACHOU, DEPOIS

Com 130 testes verdes. Nenhum deles pegava:

1. **A guarda anti-invenção inventava.** Ela montou `mini frango`, que não existe
   em cardápio nenhum, e o motor cotava a linha fantasma como **R$ 120,00**.
2. **"Sim" digitado se perdia.** Você tocou nos botões e por isso não viu. Quem
   digita perdia o papel de arroz (R$ 12,00), o topo, o tema e o nome.
3. **O pedido fechava com o nome errado.** O resumo dizia "bolo brigadeiro com
   0% lactose" e o gravado dizia "bolo brigadeiro". **O preço estava certo e a
   comanda errada**: a confeitaria faria com lactose pra quem pediu sem. Esse é
   o mais perigoso da noite, porque nada gritava.
4. O recheio fixo dependia do modelo lembrar: a mesma fala, duas conversas
   seguidas, uma com frango e outra sem.
5. Item descartado segurava o sabor da pergunta.
6. "frango" foi lido como "escolhe você".
7. O painel lia a observação do bolo com expressão própria e mostrava
   "Gabriel Lucas | 12 anos | topo de bolo" no campo do nome.

---

## O QUE VIROU TRAVA, E NÃO REMENDO

1. **Nome fora do cardápio não vira linha do pedido.** Roda no fim, em todo
   caminho. Nome de família ("pizza" esperando o tipo) continua valendo.
2. **Produto de sabor único sai com o sabor do catálogo**, antes da disputa.
   Coxinha é frango, e pedir outro sabor ouve "a gente faz coxinha de frango".
3. **A observação do bolo tem um leitor só**, e o painel agora usa ele.
4. **"Sim" digitado vale como botão.**
5. **Responder uma opção não é delegar.**
6. **O nome que fecha é o nome que o cliente aceitou.**
7. **Quantidade de produto por unidade é inteira.**

Todas com teste, e cada teste com isca: desliguei o conserto e conferi que fica
vermelho. Teste que passa verde com o conserto desligado é decoração.

---

## DOIS "REMENDOS" QUE EU TINHA LISTADO E NÃO EXISTIAM

Eu te disse que kg contra unidade era remendo, e que o texto do cliente e o da
comanda eram montados em dois lugares. **Fui medir antes de mexer e os dois já
estavam certos.**

- A unidade nunca é guardada no fluxo: quem grava e quem imprime perguntam os
  dois ao catálogo.
- O resumo e o cupom já concordam em produto, quantidade e total.

Escrevi teste pros dois pra travar do jeito que estão. E fica registrado que eu
tinha listado por leitura, não por medição, que é o erro que mais me custou hoje.

---

## O CUSTO DA OPENAI, PUXADO DO BANCO

| dia | chamadas | tokens por chamada | custo |
| --- | --- | --- | --- |
| 20 a 23/08 | 21.000 | 22.000 a 26.000 | R$ 321 |
| 27/08 em diante | 2.400 | 778 | não estava sendo gravado |

O caro foi o tamanho do prompt do cérebro antigo, apagado em 26/08. Hoje uma
conversa de festa inteira custa uns **R$ 0,07**. Rodar teu pedido do começo ao
fim três vezes esta noite custou centavos.

O custo tinha parado de ser registrado em 27/08 (`estimarCustoCentBRL`
arredondava pra centavo inteiro e zerava tudo). Consertado, e por isso o painel
mostrava "Custo de IA: -".

---

## O QUE AINDA NÃO FOI MEDIDO

Sem enfeite, é isto que falta olhar:

- **O cupom no papel do pedido novo.** O de ontem você fotografou. O desta noite
  fecha com o nome certo no banco, mas eu não vi ele sair da impressora.
- **A tela de aprovação com o pedido de festa novo**, clicando aprovar de
  verdade.
- **Uma conversa que dá errado de propósito**: cliente que muda de ideia no meio,
  que pede coisa que não existe, que some e volta no dia seguinte.
- As perguntas de `PERGUNTAR-PRA-DONA.md`: sobraram seis, e as outras seis eu
  achei respondidas nos áudios.
