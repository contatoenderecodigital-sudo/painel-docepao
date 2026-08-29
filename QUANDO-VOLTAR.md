# QUANDO VOLTAR DA COLAÇÃO

Escrito enquanto você estava fora. O detalhe técnico está no
`LEITURA-DA-CADEIA.md` (itens 68 a 71) e o estado geral no `ONDE-PAREI.md`.

---

## O QUE MUDOU HOJE, EM UMA FRASE

**A leitura acabou, e a bateria achou o que ela não achou.** Cérebro, banco,
rotas e telas foram lidos por inteiro. Depois disso, medir contra a produção
achou um travamento que impedia o pedido de ser registrado.

---

## PRIMEIRO: A BATERIA ACHOU O QUE A LEITURA NÃO ACHOU

Depois de fechar a leitura, rodei a bateria inteira contra a produção: 15
cenários, 3 execuções cada. Deu **10 de 15**. E quatro das cinco falhas eram o
**mesmo defeito**, que setenta e uma entradas de leitura não tinham achado:

```
cliente >> quero fazer uma festa dia 06/09, 100 coxinhas e 50 esfirras
padaria >> Quantas pessoas vão na festa?
cliente >> e 60 brigadeiros, forminha dourada
padaria >> Quantas pessoas vão na festa?
cliente >> um bolo de 3 kg de laka, pao de lo branco
padaria >> Quantas pessoas vão SER na festa?
cliente >> sem topo e sem papel de arroz
padaria >> Quantas pessoas vão PARTICIPAR da festa?
```

**O pedido nunca era registrado.** Quem dizia "festa" e seguia ditando os itens
ficava preso: a etapa só fechava com o número de pessoas, e só era pulável fora
de festa.

E a IA disfarçava: cada repetição saía com outra frase, porque a reescrita varia
o texto. Lendo o log, não parecia repetição. **O que denunciou foi o pedido
faltando no banco.**

> Ler a conversa acha o que está feio. Só o banco acha o que está faltando.

Três coisas desse conserto que valem a pena você saber:

1. **Consertar uma etapa empurrava o travamento pra próxima.** Sem número de
   pessoas não existe proposta, então a conversa passava da primeira e parava na
   segunda, esperando o cliente aceitar algo que nunca foi oferecido.
2. **Meu conserto da segunda estava errado, e um teste que já existia pegou.**
   Usei a base como guarda, e ela só é calculada depois: a guarda pulava a
   proposta justo de quem tinha acabado de pedir uma.
3. **Um dos cinco cenários era teste ruim, não defeito.** Dois cobravam pedido
   registrado sem nunca mandar o cliente confirmar, e reprovavam com a mesma
   mensagem do travamento real. Duas causas com a mesma mensagem de erro é uma
   delas passando despercebida.

### Uma armadilha de medição que me custou meia hora

O `mede-uma-conversa` usa um telefone que cai DENTRO da faixa que o medidor apaga
antes de cada bateria. Rodei os dois ao mesmo tempo: o medidor apagou a conversa
da medição no meio dela, o pedido fechou sem o bolo, e **parecia regressão
grave**. Era medição contaminada. O aviso está escrito no topo do arquivo, onde
morde. **Uma medição de cada vez.**

---

## SEGUNDO: O QUE EU QUEBREI E CONSERTEI

Antes da bateria, medindo uma conversa depois de um conserto meu ir pro ar:

```
padaria >> E papel de arroz, com a foto impressa no bolo? Fica R$ 12,00.
cliente >> dia 12/09 as 10h, nome Ana Paula, pix
padaria >> Só faltam os detalhes do bolo: quer papel de arroz (R$ 12,00),
           e quer topo de bolo?
```

Perguntou o papel de arroz duas vezes. Consertado e medido de novo.

O motivo importa: **a etapa tinha duas contas do que ainda falta**, e elas só
divergiam com um cliente que muda de ritmo no meio da conversa (responde picado,
e de repente manda tudo numa mensagem só). Nenhum dos quatro casos do teste
passava por ali. E o teste ficou verde com isso no ar porque comparava o TEXTO
das perguntas: as duas frases são diferentes, mas pro cliente é a mesma pergunta.

> O cliente não ouve a frase, ouve o assunto.

---

## TERCEIRO: OS QUATRO DEFEITOS DAS TELAS

| tela | o que estava acontecendo |
| --- | --- |
| **Clientes** | procurar o cliente pelo telefone **do jeito que a própria tela mostra** não achava ninguém |
| **Sino** | pedia permissão de notificação pra padaria e **nunca mandou uma** |
| **Pedido** | reimprimir falhava calado: o cupom não saía e a tela não dizia nada |
| **Conectar** | sem data no banco, afirmava "conectado desde hoje" |

O do sino é o mais estranho de todos. A função existia, pedia a permissão, estava
listada como dependência do efeito (o que faz ela parecer usada), e não era
chamada em lugar nenhum. O comentário dela dizia que era pra funcionar com a aba
minimizada, "que é o caso real da padaria". Era o único caso que não existia.

---

## QUARTO: A CAIXA DE ENTRADA CONGELAVA CALADA

Este é o que eu mais queria te contar.

O `Atendimentos` busca o servidor a cada 6 segundos. Com a sessão caída, ele
parava **com cara de tela viva**: a equipe fica olhando uma caixa de entrada que
não recebe mais nada, lê aquilo como "parou de chegar mensagem", e o cliente está
mandando do outro lado sem ninguém responder.

É a tela mais usada de todas, e ela não estava na lista de telas com polling do
meu próprio teste. Agora está, e o aviso dela fica fixo no alto: toast some em 3
segundos e quem chega perto do balcão depois nunca soube.

Junto com isso fechei as **21 chamadas** que não tratavam sessão expirada, em 8
componentes. Estava anotado aqui como decisão sua se valia fechar agora. Fechei,
porque essa uma mudou o tamanho do problema.

---

## O QUE EU PRECISO DE VOCÊ

### 1. Duas decisões que são suas, e travam trabalho

Eram três até eu ler os documentos. A terceira não era sua: ver logo abaixo.

| o que | a pergunta |
| --- | --- |
| **Aviso do dia** | a dona escreve "sem pão após as 18h" e **a IA nunca fica sabendo**. No cérebro novo a fala é escrita em código, então não existe prompt onde enfiar o aviso. Quer que eu faça o aviso entrar nas etapas, ou tira o campo da tela? |
| **Pedido sem dia de retirada** | a equipe resolve a pendência e não tem onde preencher a data. O aviso já diz que falta. Entra um campo de data ali? |

#### A "decisão nova" que eu te passei NÃO era sua. Era dívida minha.

Eu te escrevi que a delegação ("pode escolher você os tipos, confio") era
decisão sua. **Estava errado**, e só descobri lendo os documentos:

| onde | o que diz |
| --- | --- |
| `O-QUE-FIZ-ENQUANTO-VOCE-DORMIA.md` (21/08) | a delegação foi implementada e medida, com a formatura de R$ 1.675,20 como caso real |
| `O-QUE-O-VELHO-PROTEGIA.md` (26/08) | regras **25, 26 e 27**, marcadas *precisa de conversa*: não portadas |
| `DIARIO-DA-IA.md` (20/08) | a bateria fechou **8 de 8** com esses cenários verdes |

Ou seja: **funcionava, morava no cérebro velho, e foi apagado em 26/08.** Não
era pergunta pra você, era trabalho meu que ficou por fazer.

Isso agora está escrito no `CLAUDE.md`, com a lição junto: regra marcada como
"não portada" é dívida com vencimento, e o vencimento é a próxima medição.

### 2. Duas coisas de minutos, que só você pode fazer

1. **Abrir a tela de Resultados.** Os números mudaram: as conversas de teste
   saíram do faturamento e da contagem de atendimento.
2. **Trocar `SESSION_SECRET` e `PONTE_TOKEN`** se algum dia foram compartilhados.
   Não achei nenhum vazado, mas depois das dezesseis rotas abertas é barato
   fechar o assunto.

### 3. Duas que precisam de olho humano, não de teste

| o que | como conferir |
| --- | --- |
| impressão duplicada | é comportamento de banco com a ponte no meio. Vale olhar na próxima impressão de verdade |
| fuso do card de recuperado do mês | não consegui rodar `psql` contra a produção na hora. Consertei certo nos dois cenários, mas vale olhar o número |

---

## O PLACAR

| | |
| --- | --- |
| defeitos consertados | **247** |
| testes no portão | **84**, cada um com isca provada |
| leitura | **fechada**: cérebro, banco, rotas e telas |
| bateria contra a produção | rodada 4 vezes hoje, 15 cenários x 3 execuções |

### O que a bateria consertou, em ordem

| defeito | como estava |
| --- | --- |
| **travamento do `quantas_pessoas`** | quem dizia "festa" e ditava os itens ficava preso, e o pedido nunca era registrado |
| **travamento do `base_da_festa`** | apareceu ao consertar o de cima, esperando aceite de proposta que nunca foi feita |
| **iniciativa sem base aceita** | um bolo pra sexta virou festa e a padaria foi oferecer salgado a quem nunca falou de salgado |
| **aviso de horário com duas perguntas** | o aviso terminava em pergunta e o fluxo colava a da etapa atrás |
| **cenário pedindo o impossível** | retirada 15h num domingo em que a casa fecha das 12h às 16h |

### O que ainda falha, e o que é cada um

| cenário | o que é |
| --- | --- |
| `quem pede assado nao recebe frito` | **a raiz foi consertada em 29/08**: nome de família chegava como `outro` e a etapa era pulada. Falta medir |
| `mudar o total nao vira negociacao` | mesma raiz, mais a mudança de quantidade não entendida no meio do cardápio (item 4 do *cortar pela raiz*, no `O-QUE-FALTA.md`) |
| `troca de bolo nao duplica` | o bolo trocado deixa uma linha com **quantidade zero**. Parei antes de consertar: o caminho é o do *misto*, que precifica bolo |
| `bolo sem lactose` | o sabor do bolo vira um docinho separado na comanda |

O primeiro tinha diagnóstico errado meu: eu chamei de decisão sua, e era código.

### E uma perda que ninguém tinha anotado

**O rastro não existe mais.** As linhas `[rastro]`, que o `DIARIO-DA-IA.md`
chama do instrumento mais produtivo do projeto, eram do cérebro velho, que
trabalhava com ferramentas. Foram junto na demolição de 26/08 e o diário ainda
recomenda usá-las.

Hoje sobra uma linha por turno (`[fluxo-novo] etapa: X / proxima: Y`), e ela
sozinha foi o que achou o defeito de 29/08. Vale decidir se a gente reconstrói
um rastro pro fluxo novo: seria o instrumento mais barato de tudo que existe
aqui, e a leitura inteira do repositório não achou o que ele achou em um turno.

---

## O QUE EU SUGIRO FAZER A SEGUIR

**Continuar na bateria, e não voltar pra leitura.**

A leitura acabou e entregou muito: 71 entradas, mais de 240 defeitos. Mas hoje
ficou provado que ela tem um limite. O travamento do `quantas_pessoas` estava em
oito linhas de código que eu li com atenção, e **passou**. Duas condições que,
cada uma sozinha, estão certas: fechar com o número de pessoas está certo, pular
fora de festa está certo. O defeito só existe na combinação, e só aparece com um
cliente que se comporta de um jeito específico.

> Ler acha o que está errado dentro de um arquivo.
> Varrer acha o que está errado por existir em muitos.
> **Medir acha o que está errado entre os arquivos, que é onde o cliente vive.**

Então o próximo trabalho é **escrever cenários novos**, e não reler código. Os 15
de hoje cobrem o pedido normal bem. O que falta é o cliente difícil: o que
pergunta preço e some, o que muda de ideia três vezes, o que responde outra coisa,
o que manda áudio, o que volta no dia seguinte. Cada um desses é um cenário, e
cada cenário novo tem chance real de achar defeito, porque foi assim hoje.

Foi o que você mesmo estabeleceu: *build não prova efeito*. Setenta e uma
entradas de leitura não provam que a conversa fecha certo. Só a conversa prova.
