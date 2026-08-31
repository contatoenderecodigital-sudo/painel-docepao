# Painel Doce Pão

Sistema de atendimento por WhatsApp da Padaria Doce Pão. A IA anota o pedido, a
equipe aprova, a impressora imprime.

Este arquivo é lido no começo de toda sessão e sobrevive à compactação. É o
mínimo que não pode ser esquecido. O resto está nos arquivos apontados aqui.

---

## Onde a coisa mora

| arquivo | o que é |
| --- | --- |
| `O-QUE-FALTA.md` | o backlog vivo, com o estado medido de cada coisa |
| `PERGUNTAR-PRA-DONA.md` | as perguntas abertas para a dona da padaria |
| `PERGUNTA-E-BOTAO.md` | a regra de toda etapa com botão. **Ler antes de criar uma** |
| `IDEIAS-PRA-IA.md` | ideias que aparecem no meio da leitura e ficam esperando o fim dela |
| `LEITURA-DA-CADEIA.md` | os 14 arquivos na ordem da mensagem, e o que cada leitura achou |
| `O-QUE-A-DONA-FALOU.md` | varredura das 55 transcrições, com citação de origem |
| `ARQUITETURA.md` | como as peças se encaixam |

---

## UM CÉREBRO SÓ

`lib/ia/fluxo/*` é o sistema. `FLUXO_NOVO_PARA=off` não troca de cérebro: ele
**desliga a IA**, pro dia em que ela fizer besteira com cliente na linha.

**O cérebro velho não existe mais.** `cerebro.ts` e `guardas.ts` foram apagados
em 26/08/2026, com 13.950 linhas. Este arquivo mandava não editá-los até
29/08, três dias depois de eles sumirem.

**O que a demolição custou, e ainda não foi pago.** O levantamento em
`O-QUE-O-VELHO-PROTEGIA.md` marcou as regras 25, 26 e 27 como *precisa de
conversa*, ou seja: não portadas para o fluxo. São a **delegação da escolha**
("escolhe você os tipos, confio") e a **mudança de total**. As três estavam
funcionando e medidas em 21/08, e voltaram a falhar na bateria de 28/08.

Antes de apagar a gente levantou o que se perde. O que faltou foi reimplementar.

**A lição que fica, e vale além deste caso:** regra marcada como "não portada"
é dívida com data de vencimento, e o vencimento é a próxima medição.

### Antes de editar, confira quem chama

Editar arquivo que ninguém importa já custou duas rodadas inteiras aqui: os
consertos passaram no build, passaram no deploy, e não fizeram nada.

---

## A FONTE ÚNICA DOS PRODUTOS

`lib/ia/dados/produtos.ts` é a lista onde todo produto responde às mesmas
perguntas: `nome · preco · unidade · categoria · grupo · bancada · sabores[] ·
saborFixo`.

Ela existe porque havia **dezessete** arquivos importando `catalogo.json` direto,
cada um remontando a estrutura irregular do seu jeito. A migração está em
andamento: ver `O-QUE-FALTA.md` seção 2.

**Nenhum preço pode mudar sem alguém ver.** A prova roda com:

```
node testes/o-catalogo-nao-mudou-preco.cjs
```

Ela compara os 83 produtos contra uma foto versionada. Refazer a foto só com
`--tirar-foto`, e só depois de olhar o que mudou.

**O nome canônico tem prefixo, e o prefixo não é enfeite:**

```
brigadeiro             docinho,       R$ 1,25 a unidade
bolo brigadeiro        bolo de festa, R$ 46,90 o quilo
bolo caseiro cenoura   bolo caseiro,  R$ 34,90 a unidade
```

Um sabor sem o prefixo vira o docinho de mesmo nome. Já transformou um bolo de
2 kg em R$ 2,50.

---

## LISTA MINHA, NUNCA. CATÁLOGO E PREÇO, SEMPRE.

Regra do dono, 27/08/2026, depois de me cobrar três vezes no mesmo dia:

> *"não dá pra ser só uma lista tua, nada pode ser só uma lista tua assim, só o
> cardápio e valores, o que é fixo mesmo"*

**Antes de escrever uma lista de palavras no código, pergunte de onde ela devia
sair.** Só três origens são legítimas:

| origem | exemplo |
| --- | --- |
| o **catálogo** | produtos, sabores, cores de forminha, preços, limites |
| o **mundo** | dias da semana, meses, formato de data |
| o **próprio código** | nomes de campo, ids de etapa, ids de botão |

Tudo o mais é a IA que resolve, porque ela tem o contexto e a lista não tem.

**Foi medido, e a diferença é grande.** Eu vinha consertando erro de digitação
com régua de distância de letra:

```
567 erros gerados contra o cardápio, 384 chegavam ao produto   (68%)
"mini bloha de carne" e "pao de batta": a régua NUNCA alcança (duas palavras)
```

Uma linha na instrução da IA resolveu os dois, e vale pra padaria nova que
entrar amanhã, porque o cardápio dela vai junto.

**E quando a lista parece inevitável, o que falta é dar um lugar pra IA dizer o
que ela já entendeu.** Eu tinha escrito treze palavras (`sem`, `bem`, `pouco`,
`capricha`...) pra separar recado de recheio numa observação. A lista sumiu
quando o `sabor` ganhou campo próprio no formato: ela separa sozinha, e o código
confere só o sabor, contra o catálogo.

**A régua de letras continua**, e virou o que deveria ter sido: rede embaixo,
pro dia em que o modelo escorregar. Nunca o mecanismo principal.

---

## A PADARIA AINDA NÃO ESTÁ ONLINE

**Não existe cliente de verdade neste sistema ainda.** Toda conversa no banco é
teste, e o dono usa o painel pra LER esses testes.

Isso muda o que é defeito. Em 30/08/2026 eu vi a caixa da equipe cheia de
"QA Automatizado" e "precisa de você", medi que todos eram das faixas de
instrumento, e comecei a filtrar teste pra fora da caixa e do sino. **O conserto
ia esconder o teste dele da própria tela dele.** Foi revertido.

Onde o filtro de teste VALE: no dinheiro. Resultados e CRM não podem contar
conversa de teste como faturamento, e por isso `so-cliente-de-verdade.ts` é usado
lá e só lá.

Onde ele NÃO vale: em tudo que serve pra ele olhar o que a IA fez. Caixa de
atendimento, fila de aprovação e sino mostram tudo, de propósito.

Quando a padaria entrar no ar, isto muda, e a decisão é dele.

---

## AS REGRAS QUE NÃO SE QUEBRAM

**SÓ ENTRA NO PEDIDO O QUE ESTÁ NO CARDÁPIO.** Nome que o catálogo não tem não
vira linha, nunca, nem montado por pedaço. Nome de FAMÍLIA ("pizza" esperando o
tipo) continua valendo, porque é marcador de lugar. A trava roda no fim do fluxo,
em todo caminho, e o teste é `so-entra-no-pedido-o-que-esta-no-cardapio.cjs`.

Isto nasceu caro: em 31/08/2026 a guarda anti-invenção montou `mini frango` a
partir de pedaços de outro nome, e o motor de preço, que casa nome por pedaço,
cotou a linha fantasma como pizza inteira de strogonoff, **R$ 120,00**. Palavra
do dono: *"não tem como colocar um produto que não existe o nome, pra isso que
separei tudo bonitinho"*.

**DADO QUE ESTÁ NO CATÁLOGO NÃO PODE DEPENDER DO MODELO LEMBRAR.** Produto de
sabor único (`saborFixo`) sai carimbado com o sabor dele, do catálogo, antes de
qualquer disputa. "coxinha" e "coxinha de frango" são a mesma coisa; pedir outro
sabor ouve "a gente faz coxinha de frango". Medido: a mesma fala, em duas
conversas seguidas, uma vez trouxe o recheio e a outra não.

**GUARDA MINHA ERRA MAIS QUE O MODELO.** Dos sete defeitos achados conversando
em 31/08/2026, quatro eram código meu decidindo errado, e o mais caro era a
guarda que existe justamente pra impedir invenção. Antes de escrever guarda
nova, medir se o defeito é do modelo ou de outra guarda.

**DUAS REGRAS CERTAS FAZEM O ERRADO JUNTAS.** O carimbo do recheio fixo tirou a
coxinha da disputa pela palavra "frango", e a frase caiu na pizza, que nem tem
frango na lista. Depois de mexer numa regra, rodar o portão inteiro: quem pegou
foi um teste que já existia.

**Nada some do pedido.** Se falta o cliente informar algo, é só pedir pra ele.
Guarda que bloqueia registro faz o modelo apagar o item.

**A IA nunca confirma pedido sozinha.** Aprovar é só o botão do painel, atrás do
login. A impressora só dispara com o pedido aprovado.

**Nunca emoji, nunca travessão.** Vale para código, prompt e tela.

**O shell come a barra invertida.** Patch em arquivo se escreve com Write ou
Edit, nunca com heredoc. `\b` vira byte de backspace e `\s` vira a letra "s", e
a regex simplesmente para de casar, sem erro nenhum. Já custou horas três vezes.
Os dois detectores:

```
node testes/nenhum-byte-quebrado.cjs
node testes/regex-com-barra-comida.cjs
```

**Guarda nova nasce com teste dos DOIS lados:** pega o defeito E deixa passar o
caso legítimo. Guarda que trava venda é pior que o bug.

**Não dizer "falta pouco".** Dizer o que está feito e o que está aberto, com
nome.

---

## COMO SE PROVA QUE ALGO FUNCIONA

**Sonda com resposta de modelo inventada por mim mente.** Duas vezes em
31/08/2026 eu montei a leitura do modelo à mão, o caso passou verde, e a produção
continuou quebrada. A terceira vez eu peguei do LOG DO CONTAINER a resposta real
e reproduzi de primeira:

```
docker logs --since 10m $(docker ps --format '{{.Names}}' | grep uyyqf) | grep 'fluxo-novo'
```

O rastro traz o que o modelo leu e o que cada guarda decidiu. **Ler o código não
achou a causa; o log achou.** Chutei duas vezes antes de ir lá, e as duas
estavam erradas.

**Conversar acha o que teste não acha.** Em 31/08/2026 o portão tinha 130 verdes
e uma conversa de quinze mensagens achou sete defeitos, três deles custando
dinheiro. A ferramenta é `testes/falar.cjs`, uma mensagem por vez, lendo a
resposta antes de escolher a próxima.

**Build não prova efeito.** Deploy confirmado e função no bundle não valem nada.

**Medir UMA conversa contra o banco antes da bateria.** Bateria que devolve o
mesmo resultado duas vezes é suspeita, não resultado.

Isto não é conselho, é a regra mais cara de ignorar. Em 26/08/2026 rodei **duas
baterias de 25 minutos** antes de mandar uma conversa só. A conversa única deu a
resposta em dois minutos, e era um defeito estrutural que as duas baterias
tinham mostrado como "0/5" sem dizer por quê.

O script está em `testes/` como modelo: manda as falas, lê `pedido_itens` e
`pedido_montagem` do telefone de teste, imprime os dois. Cinco minutos por volta
em vez de vinte e cinco.

**Arquivo de saída não é prova sem a data.** Li o `conversas-da-medicao.txt` e
apresentei uma conversa perfeita como prova de que o sistema estava certo. O
arquivo era de horas antes: as rodadas que eu tinha matado nunca chegaram a
escrevê-lo. Conferir `ls -la` antes de usar como evidência.

**Bateria verde prova os caminhos dela, e nada além.** O `pass^5` = 5 de 5
significa que aqueles cinco jeitos de pedir funcionam. Em 26/08/2026, com a
bateria cheia, UMA conversa de pizza de três mensagens achou cinco defeitos:

- a oferta que só o botão cumpria, e que entregava pra um humano quem
  respondesse escrevendo
- o nome de família fechando pedido com o produto errado (R$ 240 numa pizza que
  ninguém pediu)
- o `assunto` grudado numa etapa que nunca se cumpre
- o sabor bloqueando o fechamento sem ninguém perguntar
- o sabor solto sendo lido como mudança de assunto

Os cinco cenários da bateria pedem coxinha, quiche, brigadeiro e bolo. **Nenhum
pede pizza.** Quando terminar de consertar o que a bateria cobre, medir um
pedido de uma família que ela não toca.

**Bloquear sem perguntar é pior que o defeito.** Fiz isso três vezes num dia. A
padaria recusa fechar, não diz o que falta, e o cliente fica olhando o mesmo
resumo até a conversa morrer. Toda trava nova nasce com a pergunta junto.

**Ver de verdade:** abrir a tela, rodar, olhar o log e o banco antes de afirmar.

**Ler o rastro antes de culpar a IA.** Na maioria das vezes o defeito era uma
guarda minha bloqueando o certo.

O portão:

```
node testes/todos.cjs
```

83 testes, fecha em uns dois minutos, e **não fala com a rede**. Os quatro que
falam com o VPS são instrumento e rodam na mão:

```
node testes/pausa-nao-vaza.cjs
node testes/qa-conversa.cjs
node testes/qa-concorrencia.cjs
node testes/guardar-conversas.cjs
```

A bateria que decide (fala com a IA de verdade, uns 25 minutos):

```
node testes/medidor.cjs 5 "cinco jeitos"
```

---

## DEPLOY

Push na `main` dispara o webhook do Coolify.

**Confira pelo SHA do container, nunca pelo status do Coolify**, que trava em
`running:unknown`:

```
ssh -i ~/.ssh/id_ed25519_hub root@179.198.126.197 \
  "docker ps --format '{{.Image}}' | grep uyyqf7"
```

A tag da imagem tem que bater com o `git rev-parse HEAD`.

**Nunca deployar enquanto o dono está testando:** cada push derruba o container
e a tela cai na cara dele.

**Nunca medir com deploy no meio:** cada mensagem pega uma versão diferente e o
número sai misturado.

Push no GitHub exige a conta `contatoenderecodigital-sudo`:

```
gh auth switch -u contatoenderecodigital-sudo
```

---

## BANCO

Postgres na VPS `179.198.126.197`, container `gdgroavvfkkcdxvbrzvth5xc`, banco
`enderecodigital_hub`, usuário `hub`. Schemas: `docepao`, `docepao_teste`.

Foi migrado de MySQL em 19/08/2026. **Nunca reintroduzir tradutor de SQL.**
