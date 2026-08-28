# A leitura da cadeia, arquivo por arquivo

Decisão do dono, 27/08/2026, depois de eu passar o dia consertando por sonda em
vez de por leitura:

> *"vamo comecar de 1 e ir lendo e fazendo pra ficar tudo no padrao que tamo
> montando de preco produto sabor, é pra ler tudo mano, trabalho pesado e
> minucioso, não pode escapar nada, uma linha de código errada pode cagar tudo"*

A regra: **um arquivo por vez, inteiro, sem pular.** Conserta o que aparecer,
e só reporta quando terminar aquele arquivo. Ideia que surgir no meio vai pro
`IDEIAS-PRA-IA.md` e espera.

O motivo de ser na ORDEM DA MENSAGEM: quase todo defeito achado até aqui é peça
que funcionava e perdeu a conexão quando o cérebro antigo foi apagado. Eu
conferi as regras que ele tinha; não conferi o que chamava o quê.

---

## AS PERGUNTAS QUE ACHARAM DEFEITO

**Esta é a parte mais útil deste documento para a releitura.** A lista de cinco
perguntas nasceu no arquivo 1; estas oito cresceram com a leitura, e cada uma
está aqui porque ACHOU coisa, não porque parece boa ideia. O número é quantas
vezes ela achou.

| a pergunta | achou | o pior caso que ela pegou |
| --- | --- | --- |
| **essa lista é minha, ou é do cardápio?** | 11 | o padeiro saía de seis nomes à mão: pão novo cadastrado ia pra confeitaria |
| **quem mais responde essa mesma pergunta?** | 9 | quatro lugares decidiam se o produto era genérico, e consertar um criava beco no outro |
| **esse comentário descreve o código que está embaixo dele?** | 16 | o `marcarImpresso` prometia idempotência e cumpria em uma das duas escritas: pedido carimbado como impresso sem ter saído na cozinha |
| **esse arquivo lê o `catalogo.json` cru?** | 8 | a chave `pizza` fora dos quatro baldes: a meia pizza saía com o sabor colado no nome |
| **esse import, tipo ou galho tem chamador?** | 7 | `p.categoria === "bolo"` nunca casava: bolo de café cotado como docinho de R$ 1,25 |
| **esse valor está decidido em outro lugar também?** | 13 | a unidade do item, em TREZE lugares, três deles escondidos dentro de SQL |
| **essa regra tem fronteira de palavra?** | 3 | "certo" dentro de "incerto": alguém em dúvida aprovando um valor |
| **o teste que jura cobrir isso consegue falhar?** | 7 | o `` do Windows desligava o corte de comentário de cinco detectores, em silêncio |

E a nona, que só apareceu depois do arquivo 8 e é a mais cara de ignorar:

> **eu consertei um lado dessa regra em outro arquivo?** (achou 7)

Cinco defeitos vieram daí no cérebro, e um deles virou beco sem saída: trocar o
genérico do bolo na etapa sem trocar na fala fazia a padaria perguntar o prato
para sempre. Na camada de banco ela achou mais dois, e o pior foi o
`pedidoRegistradoDoCliente`: a guarda do "pedido não impresso não some" existia
na função gêmea, com o caso escrito no comentário, e faltava justamente na que
alimenta a tela onde a equipe conserta.

### As duas que nasceram na camada de banco

> **os dois lados desta comparação estão no mesmo fuso?** (achou 2)

`timestamptz` de um lado e o corte já convertido pra São Paulo do outro. O
Postgres converte o segundo usando o fuso da SESSÃO, então num container em UTC
o mês e o dia começam três horas antes. Achou o card de recuperado do mês e o
contador de mensagens de hoje, os dois errando dinheiro e número calados. O
`resultados.ts` já fazia do jeito certo, e foi ele que serviu de gabarito.

> **alguém LÊ este campo, ou só escrevem nele?** (achou 3)

Parente da pergunta do chamador, mas para DADO em vez de código, e mais difícil
de ver porque o campo é preenchido com capricho:

- o aviso `[o cliente respondeu MARCANDO esta mensagem...]` ia pro `historico`,
  que o cérebro novo nunca vê;
- `PedidoParaGravar.itens` era construído a cada pedido fechado e ninguém lia;
- `carregarHistorico(negocioId, clienteId, pedidoEmAberto)` jogava o terceiro
  parâmetro fora com um `void`, e o webhook fazia uma consulta ao banco só pra
  preencher esse parâmetro.

Nos três havia um comentário garantindo que alguém lia.

---

## COMO RETOMAR ISTO DEPOIS

Se a conversa se perder, o estado inteiro está em três lugares, e nenhum deles é
a minha memória:

1. **`ONDE-PAREI.md`** — o placar, o que está no ar, o que falta ler
2. **este arquivo** — arquivo por arquivo, defeito por defeito, com o que foi
   medido em cada um
3. **`git log --oneline`** — um commit por arquivo lido, com o resumo dentro

E os **59 testes** são o que impede o trabalho de se desfazer sozinho: cada
conserto tem isca provada, e isca provada quer dizer que eu removi o conserto e
vi o teste ficar vermelho.

---

## A ordem, e ATÉ QUE LINHA foi lido

A coluna do meio existe porque "eu li" não é verificável e eu já disse isso sem
ser verdade. **Ao ler um trecho, anotar aqui na hora**, e nunca marcar "lido
inteiro" sem que as faixas cubram o arquivo do começo ao fim.

Isto sobrevive à compactação. A minha memória de ter lido, não.

| # | arquivo | faixas lidas | estado |
| --- | --- | --- | --- |
| 1 | `app/api/whatsapp/route.ts` | 1-960, DUAS passadas | **INTEIRO** — 10 defeitos |
| 2 | `lib/ia/fluxo/atender.ts` | 1-330, DUAS passadas | **INTEIRO** — 6 defeitos |
| 3 | `lib/ia/fluxo/fluxo.ts` | 1-1690, sem buraco | **INTEIRO** — 9 defeitos |
| 4 | `lib/ia/fluxo/leitura.ts` | 1-681, sem buraco | **INTEIRO** — 10 defeitos |
| 5 | `lib/ia/fluxo/pensar-openai.ts` | 1-195, sem buraco | **INTEIRO** — 7 defeitos |
| 6 | `lib/ia/fluxo/produto.ts` | 1-227, sem buraco | **INTEIRO** — 3 defeitos |
| 7 | `lib/ia/fluxo/sabor.ts` | 1-295, sem buraco | **INTEIRO** — 6 defeitos |
| 8 | `lib/ia/fluxo/etapas.ts` | 1-626, sem buraco | **INTEIRO** — 5 defeitos |
| 9 | `lib/ia/fluxo/pergunta.ts` | 1-786, sem buraco | **INTEIRO** — 6 defeitos |
| 10 | `lib/ia/fluxo/fechar.ts` | 1-240, sem buraco | **INTEIRO** — 4 defeitos |
| 11 | `lib/ia/orcamento.ts` | 1-521, sem buraco | **INTEIRO** — 4 defeitos |
| 12 | `lib/banco/montagem.ts` | 1-440, sem buraco | **INTEIRO** — 3 defeitos |
| 13 | `lib/ia/fluxo/gravar.ts` | 1-267, sem buraco | **INTEIRO** — 1 defeito |
| 14 | `lib/banco/fila.ts` + `lib/cupom-escpos.ts` | 1-255 e 1-264, sem buraco | **INTEIRO** — 4 defeitos |

**O arquivo 1 quase entrou aqui como "inteiro" com dois buracos**: as linhas
631-635 e 768-789 tinham escapado, e só apareceram quando o dono perguntou pela
terceira vez se eu tinha lido mesmo. Foram lidas antes de a linha acima ser
escrita.

---

## A PRIMEIRA PASSADA NAO VALE

A segunda leitura dos arquivos 1 e 2 achou SETE defeitos que a primeira tinha
lido e nao visto, entre eles uma mensagem do cliente sendo jogada fora e um bolo
de 2 kg virando 2 pecas.

O tamanho do pedaco lido nao era o problema: a linha do defeito estava dentro do
que eu li. O problema e a pergunta. Na primeira passada eu leio pra entender o
que o codigo FAZ; so na segunda eu leio pra achar onde ele QUEBRA.

**Um arquivo so conta como lido depois da passada com estas cinco perguntas,
feitas em CADA linha:**

```
isso e uma lista e eu peguei so o primeiro?
esse import e usado mesmo?
esse comentario ainda descreve o que esta embaixo dele?
esse valor esta decidido em outro lugar tambem?
esse return larga alguma coisa pra tras?
```

---

## 1. `app/api/whatsapp/route.ts` — a porta de entrada

Toda mensagem do WhatsApp cai aqui primeiro: identifica de quem é, transcreve
áudio, chama a IA, manda a resposta e salva a conversa.

**Seis defeitos, e cinco deles são peça desligada pelo apagamento do cérebro.**

### O cliente esperava 22 segundos

Duas esperas no mesmo caminho fazendo o mesmo trabalho: 12s antes de carregar o
histórico, 10s antes de chamar a IA. Nasceram em datas diferentes, com valores
diferentes e explicações que se contradiziam.

Perigoso além de lento: o turno tem 60s antes do Vercel matar a função. 22
parado + 30 de IA + 4 de "digitando" dá 56, e quando estoura **a IA já foi
cobrada e o cliente não recebe nada.**

Ficou uma só, de 10s, ajustável sem deploy pela `ESPERA_SEGUNDOS`.

### O interruptor de emergência calava a padaria

`FLUXO_NOVO_PARA=off` existe pro dia em que a IA fizer besteira com cliente na
linha. A documentação dizia que ele "volta pra Dora antiga", e a Dora antiga foi
apagada em 26/08/2026.

Desligar não passava a bola pra ninguém: a mensagem era salva, o código caía
fora do `if` e acabava. Agora a conversa vai pra equipe e o cliente ouve isso.

### O recado do cardápio estava morto

O dono pediu que a regra do sabor misto e o preço do papel de arroz saíssem do
rodapé em letra miúda da imagem e virassem mensagem. Foi construído, e perdeu
quem chamasse: `RECADOS_CARDAPIO` seguia importado e nunca usado.

Os preços dali tinham sido corrigidos na mesma manhã — em código que não rodava.

### Duas idas ao banco por mensagem, pra nada

`carregarTenant` e `resumoPedidoFechado` eram consultados em toda mensagem e o
resultado não era lido por ninguém.

### Uma checagem que o próprio conserto ia deixar inútil

Ao tirar a segunda espera, a conferida "o cliente falou de novo?" ficaria
comparando com `Date.now()` e nunca daria verdadeiro. Passou a usar o marco do
turno.

### A lista de dezesseis verbos

Ela adivinhava, antes de chamar a IA, se o cliente queria mexer no pedido.
Errava em "coloca mais 50" e "em vez de 200", e quando errava a padaria
recomeçava do zero.

Saiu: o pedido em aberto vai sempre pra IA. Conferido antes de mexer que
`registrarPedido` grava **um pedido por conversa** — se já existe um esperando
aprovação, ele é atualizado, não duplicado.

### O que ficou em aberto neste arquivo

Na janela entre fechar e imprimir, **qualquer** mensagem agora restaura o pedido,
inclusive "obrigado". Não é destrutivo, mas a padaria pode devolver o resumo
inteiro pra quem só agradeceu. A ideia 1 do `IDEIAS-PRA-IA.md` resolve isso, e
saber o comportamento exato depende de ler os arquivos 8 e 9.

---

## 2. `lib/ia/fluxo/atender.ts` — quem junta tudo e responde

**Três defeitos.**

### Recomeçar apagava o rascunho e deixava o pedido de pé

`zerar` limpa o pedido em montagem, que é a conversa. O pedido já registrado,
esperando o cliente aceitar o valor, continuava vivo na fila. O cliente mandava
"cancela tudo", ouvia "apaguei tudo", e a equipe seguia com um pedido pra
produzir. **Alguém ia assar o que ele acabou de cancelar.**

Agora ele volta pra equipe com o motivo escrito.

### O chamado da equipe sumia em três saídas

`precisaHumano` é o único sinal que acende o aviso no painel da dona, e três
`return` não o levavam: o fechamento do pedido e os dois botões que respondem
sem chamar a IA.

Quem pedisse bolo sem lactose e fechasse na mesma mensagem entrava na fila sem
ninguém ser avisado — e a restrição já tinha saído da observação pra não virar
promessa. Ninguém ficava sabendo de nada.

### O cabeçalho mentia e contradizia a própria função

Dizia que o arquivo atendia "só os números de `FLUXO_NOVO_PARA`" e que "sem a
variável preenchida, ninguém cai aqui". O código faz o contrário, e a função
vinte linhas abaixo já dizia "quem cai no fluxo novo: todo mundo".


### Segunda passada no arquivo 1

- **mensagem perdida**: `messages?.[0]` pegava so a primeira do pacote; a
  segunda nao era respondida nem salva
- **bolo de 2 kg virando 2 pecas** ao devolver o pedido pro rascunho
- **sete imports mortos**
- **dois comentarios mentindo**

### Segunda passada no arquivo 2

- **o aceite do valor podia sumir calado** quando o registro falhava
- **beco sem saida** na pergunta do valor: repetia pra sempre, sem chamar ninguem
- **um import morto**

### O QUE AINDA NAO FOI MEDIDO

O laco das mensagens foi reestruturado (dois `return` viraram `continue`, o
fecho do bloco mudou). O compilador NAO pega erro de logica ai, e os 43 testes
nao cobrem o webhook: eles testam o cerebro, nao a porta de entrada.

Falta mandar UMA mensagem de verdade depois do deploy e ver se ela responde.


---

## 3. `lib/ia/fluxo/fluxo.ts` — o motor do fluxo

1690 linhas. Onde a leitura da IA vira pedido. **Nove defeitos.**

### "dois bolos" nunca foi dois bolos

    new RegExp("(?:[2-9][0-9]*|" + porExtenso + ")\s+bolos?")

Dentro de aspas, `\s` vira a letra "s" e `` vira byte de backspace. A regex
nascia como `(?:[2-9][0-9]*|(dois|duas|...))s+bolos?` e não casava com nada.
**Quem pedia dois bolos levava um.**

Os dois detectores de barra comida não pegavam: eles procuram byte estragado no
ARQUIVO, e aqui o arquivo tem dois caracteres normais. Nasceu o terceiro,
`barra-comida-dentro-de-aspas.cjs`, provado com isca.

### Perguntar apagava o pedido

`aplicar` rodava DEPOIS dos blocos de pergunta e de reclamação, e os dois saem
da função com `return`:

    cliente >> quanto é o cento de coxinha? quero 200
    no pedido >> nada

Não eram só os itens: data, hora, nome, cor da forminha, tudo que viesse junto.

### Sabor negado virava sabor pedido

"sem calabresa" dava calabresa na comanda: a checagem era só "a palavra está na
frase?". A pergunta "afirmou ou negou?" já existia no leitor da frase e foi
reusada, em vez de escrever uma segunda.

### Bolo de brigadeiro virando docinho de brigadeiro

`identificarProduto` chamado sem dica: "brigadeiro" resolve pro docinho de
R$ 1,25, e o bolo é R$ 46,90 o quilo. Agora o "bolo" da frase volta pro nome, e
só quando o bolo existe de verdade.

### O topo sumia na fusão dos bolos

Dois bolos viram um, e a observação mantida era só a do mais caro. Mas o topo e
o tema são carimbados no PRIMEIRO bolo da lista. Primeiro ≠ mais caro = topo
perdido, e topo é peça que a equipe encomenda com dois dias de antecedência.

### O aviso de horário engolia a pergunta

O comentário prometia "a etapa volta a perguntar, com o motivo na frente". O
código SUBSTITUÍA a fala pelo aviso: o cliente ouvia "não abrimos nesse horário"
e mais nada. E a etapa não era refeita depois de apagar a hora.

### Mais três

- uma guarda que nunca disparava (`itens === e.itens`, comparando cópia com
  original)
- a etapa do salgado lendo o catálogo cru, com o galho do bolo cinco linhas
  abaixo já fazendo pela lista única
- uma linha duplicada (`if (l.tema)` rodando duas vezes)

### Duas coisas conferidas que estavam CERTAS

Verificar e seguir também é resultado: o `??` dos dados não apaga o nome (os dois
caminhos filtram vazio antes), e a comparação por referência do item que espera
sabor funciona porque roda depois do carimbo da forminha.

---

## 4. `lib/ia/fluxo/leitura.ts` — o portão da etapa

681 linhas. Monta a instrução que a IA recebe, e decide o que da leitura dela
vira pedido. **Dez defeitos.**

### A etapa da oferta não tinha instrução nenhuma

`daEtapa` era `Record<string, string>`: o compilador aceitava qualquer chave e
não cobrava nenhuma. Faltava a `oferta`, e faltava calada. Quem respondesse
escrevendo em vez de tocar o botão chegava na IA com o bloco comum e mais nada:
nenhuma palavra sobre docinho, sobre bolo, sobre o que fazer com o que ele
pediu.

O estrago já estava escrito no `fluxo.ts`, no comentário do resgate que nasceu
pra tapar isto: *"50 brigadeiro, forminha rosa, e um bolo de 2 kg de 4 leites"
na etapa da oferta — o brigadeiro entrou, o bolo não, e a padaria perguntou o
sabor do bolo duas vezes até a conversa morrer.*

O tipo virou `Record<EtapaId, string>`. Agora o compilador é o dono da lista:
etapa nova em `etapas.ts` quebra o build aqui até ganhar instrução.

### Os quinze bolos caseiros sumiam quando guardados

    etapaDesteProduto("bolo caseiro cenoura")  ->  null
    etapaDesteProduto("bolo brigadeiro")       ->  docinho

Os dois vinham de uma cirurgia de texto: tirar o prefixo `bolo ` e procurar o
resto no vocabulário. "bolo caseiro cenoura" virava "caseiro cenoura", que não é
sabor nenhum. E "bolo brigadeiro" virava "brigadeiro", que a varredura acha no
DOCINHO primeiro.

Onde doía: o `fluxo.ts` estaciona o item citado fora da hora **já com o nome
canônico**, e depois pergunta a esta função de quem ele é. Null nunca casa com
etapa nenhuma, então o bolo caseiro ficava estacionado para sempre.

É o mesmo defeito que o comentário do `fluxo.ts` diz ter consertado em
26/08/2026. Consertou o bolo de festa; o caseiro ficou, porque o conserto foi na
string e não na fonte. Agora quem responde é a categoria do catálogo.

### O caso fundador do arquivo perdia o pedido

O bloco que separa bolo de docinho pela quantidade — o da Kemilly, escrito
dentro do próprio arquivo — terminava em `return []` seco:

    4 leites 1kg e 100 brigadeiros e 100 beijinhos
    entra  >> 1 kg de bolo 4 leites
    sai    >> os 200 docinhos, sem rastro

Com um item válido na frase, o desvio pra etapa do docinho nem dispara: ele
exige que NADA tenha entrado. Os 200 docinhos dela desapareciam — que é
exatamente o defeito que aquele bloco diz ter consertado.

### A padaria negava o que ela vende

`barrados` misturava três coisas: o que não existe, o que existe e é de outra
etapa, e o que a quantidade desmentiu. Quem consumia separava de novo por REGEX
no texto do rastro, e a separação vazava:

    cliente >> 50 brigadeiro        (na etapa do salgado)
    padaria >> Não achei brigadeiro no cardápio com esse nome.

O brigadeiro estava sendo guardado pra etapa do docinho na linha de cima. Ela
negava enquanto anotava. Agora `naoExistem` é lista própria e só o que a casa
não vende entra nela.

### Vinte e quatro produtos da casa eram barrados e perdidos

Pizza, cuca, cupcake, torta fria, empadão, calzone, franciscano, pão. As etapas
de produto são três e nenhuma cobre esses. Barrar só podia perder, porque não
existe um "depois" pra onde guardar: nenhuma etapa vai chamar por eles nunca.
Quem estava escolhendo salgado e dizia "e uma torta fria" perdia a torta E ouvia
que a padaria não tinha.

### O nome do catálogo era barrado na própria etapa dele

O vocabulário mostrado ao modelo é o nome curto ("brigadeiro"); o nome do
catálogo carrega a família ("bolo brigadeiro"). Quem chegasse pelo nome do
catálogo entrava pela porta certa e era tratado como intruso.

### O desvio de etapa era um chute

    etapa === "bolo" ? "docinho" : etapa === "docinho" ? "bolo" : undefined

Não olhava PARA O QUE tinha sido barrado. Medido: `50 xilofone` na etapa do
docinho levava a conversa pra etapa do BOLO. Xilofone não existe e ninguém falou
de bolo. E na etapa do salgado o mesmo código não levava a lugar nenhum, nem
quando o item barrado era claramente de outra família. Agora o destino sai do
item guardado, que sabe a resposta certa.

### Mais dois

- `import catalogo from "../dados/catalogo.json"`: o catálogo inteiro entrava no
  módulo e ninguém lia
- **seis blocos de comentário órfãos**: doc de uma função grudado em outra,
  todos por inserção de código novo logo abaixo de um bloco existente. O de
  `leituraQueCabeNaEtapa` ainda jura ser "a última trava antes de virar pedido"

### O que ficou de fora, e por quê

O portão só existe nas três etapas de produto. Nas outras oito (`abertura`,
`dados`, `oferta`, `confirmacao`...) `vocabularioDaEtapa` devolve lista vazia e
**qualquer coisa que o modelo devolver entra no pedido sem ser conferida** —
inclusive um produto inventado.

Não consertei nesta passada porque a defesa óbvia (barrar o que o catálogo não
conhece) nega a palavra de família: "quero um bolo" e "queria uma torta" não são
produto nenhum no catálogo, e são frases que gente escreve na abertura o tempo
todo. Trocar um item inventado por uma conversa travada na primeira mensagem é
um mau negócio, e medir isso exige rodar o modelo de verdade, não só o portão.

Uma coisa conferida que estava CERTA: a faixa de acentos escrita com os
caracteres literais (`U+0300`–`U+036F`, em quinze lugares do cérebro) é a mesma
coisa que `̀-ͯ`. Conferido nos bytes, não no olho.

---

## O que a leitura do arquivo 4 devolveu para os arquivos 1, 2 e 3

O dono perguntou, em 28/08/2026: *"e se faltou algo nos outros arquivos avisa
também né"*. Perguntei aos arquivos já fechados as mesmas coisas que o 4 me
obrigou a perguntar. Achei um, e ele era meu.

### O mesmo texto normalizado escrito dezesseis vezes

`String(t).toLowerCase().normalize("NFD").replace(...).trim()`. Uma linha, e ela
estava copiada dezesseis vezes no cérebro. **Sete delas no `fluxo.ts`**, que eu
tinha declarado lido inteiro.

E copiar não fica igual. Elas já divergiam: duas não chamavam `.trim()` (nome
com espaço atrás não casava), uma usava `?? ""` onde as outras usam `|| ""`, uma
trocava a ordem do `toLowerCase`.

É o mesmo defeito do `ESPERA_MS` do webhook, que tinha 12 segundos num lugar e
10 no outro. Nasceu `lib/ia/texto.ts`, e os arquivos 3 e 4 passaram a usá-lo:
sete cópias e quatro cópias viraram zero.

**Restam dezesseis cópias em quinze arquivos que eu ainda não li.** Não mexi
neles de propósito: trocar às cegas num arquivo que eu não li é o jeito de
trabalhar que o dono mandou parar. Cada um vira zero quando chegar a vez dele:

    falas-do-cliente 2, produtos 2, apelidos 2, orcamento, sabor, restricao,
    produto, pergunta, leitor-da-frase, informacao, generico, fatos,
    departamentos, cupom-escpos, montagem

### Duas coisas conferidas nos arquivos 1, 2 e 3 que estavam CERTAS

**Nenhum botão órfão.** Os dezoito botões oferecidos ao cliente têm tratador:
treze em `DO_BOTAO`, cinco lidos direto no `atender.ts`. O `fecha_sim` não está
no `DO_BOTAO` de propósito, porque fechar pedido não é mexer no rascunho.

**Nenhuma lista de etapa escrita à mão no código do fluxo.** Todas saem de
`etapas.ts`. A única que existia estava num TESTE, e foi ela que deixou passar a
instrução gigante da oferta.

### A barra invertida foi comida pela quarta vez

Três `` viraram byte de backspace ao escrever o normalizador de plural. O
`nenhum-byte-quebrado` pegou. A defesa funciona; o que não muda é o shell.

---

## 5. `lib/ia/fluxo/pensar-openai.ts` — a chamada da IA

195 linhas. A única parte do fluxo que gasta dinheiro. **Sete defeitos.**

### Dois campos que o código lê e o formato nunca pediu

O arquivo tem duas metades escritas em lugares diferentes dele mesmo: o
`FORMATO`, que vai no prompt dizendo "responda NESTE formato", e o limpador, que
lê a resposta campo por campo. As duas discordavam:

    ehFesta        lido na linha 132, e a instrução da abertura manda devolver.
                   O formato mostrava um objeto completo sem ele.
    papelDeArroz   lido na linha 154. O formato mostrava só { "topo": true }.

Sem `ehFesta` a conversa pula a proposta da festa inteira, e papel de arroz é
item cobrado. É o mesmo defeito que o comentário do `ehFesta` descreve, pelo
outro lado: lá a resposta certa morria na entrada, aqui ela nunca era pedida na
saída.

Nenhum teste podia ver isso, e vale entender por quê: o cérebro roda com modelo
de mentira nos testes, e modelo de mentira devolve o que a gente mandar. Só o
modelo de verdade obedece ao formato. Por isso o teste novo compara as duas
metades **na fonte**, e não pela resposta.

### Item sem quantidade era jogado fora

    {"produto":"coxinha"}   ->  sumia

A conferida era `Number(i.qtd) >= 0`, e `Number(undefined)` é NaN, que não é
maior nem igual a nada. Duas linhas abaixo, `Number(i.qtd) || 0` já sabia virar
zero, e zero é resposta legítima: na festa o total foi combinado na proposta e o
cliente só escolhe o sabor.

### O turno tem 60 segundos e esta chamada esperava dez minutos

O SDK da OpenAI vem com 10 min de timeout e 2 tentativas, e nada aqui dizia o
contrário. Chamada travada consumia o turno inteiro: o Vercel mata a função, **a
IA já foi cobrada e o cliente não recebe nada.** É o mesmo perigo que as duas
esperas do webhook criavam antes de virarem uma. Ficou 15s com uma repetição:
pior caso 30s, sobram 20 pro resto do turno.

### O que vem de fora entrava sem ser conferido

`situacao` e `prato` eram conferidos valor por valor ali do lado. `perguntou.sobre`
e `falouDeOutraEtapa` não: qualquer texto virava um `SobreOQue` ou um `EtapaId`,
e o tipo passou a mentir a partir dali. Uma etapa inexistente fazia o fluxo
gravar `assunto` e `retomarEm` apontando pro nada. A conversa se cura sozinha na
mensagem seguinte, mas gasta uma mensagem do cliente pra isso.

A união de tipo virou array (`SOBRE_O_QUE`), porque união o compilador apaga e o
que chega aqui é texto que o modelo escreveu. A lista de etapas sai de
`etapas.ts`.

### Mais dois

- `obs` entrava sem `String()`, sozinho entre os campos de texto. Objeto que o
  modelo devolvesse chegava na comanda como `[object Object]`
- o cabeçalho dizia que a instrução tem "374 a 704 caracteres". Medido: **791 a
  1874**, número de uma versão que não existe mais

### Testes novos

`o-formato-pede-tudo-que-o-codigo-le.cjs` e `o-limpador-nao-come-a-resposta.cjs`.
As duas iscas reproduzem os defeitos exatos que foram achados.

---

## 6. `lib/ia/fluxo/produto.ts` — um nome só por produto

227 linhas. **Três defeitos, e o principal é o próprio arquivo desobedecendo ao
que ele se propõe.**

### A meia pizza saía com o sabor colado no nome

O arquivo lia o `catalogo.json` cru e remontava os grupos do jeito dele, com uma
lista escrita à mão de **quatro baldes**: `salgados.frito`, `salgados.assado`,
`doces` e `outros_produtos`. O catálogo tem quinze chaves. A que ficou de fora
foi `pizza`:

    "pizza meia de frango"        ->  produto "pizza meia de frango", sem recheio
    "pizza redonda de calabresa"  ->  produto "pizza redonda", recheio calabresa

A redonda mora em `outros_produtos` e por isso funcionava. A meia e a inteira
moram em `pizza` e não tinham candidato nenhum: `identificarProduto` devolve o
texto cru quando não acha, e o texto cru vira o nome do produto. Comanda com
nome que não existe na tabela de preço, e a cozinha lendo "pizza meia de frango"
como se fosse um produto.

O comentário do `nomeCurto`, em `produtos.ts`, diz que isso acabou: *"cada
arquivo que precisava do nome curto o derivava sozinho, lendo o catálogo cru e
remontando os grupos do seu jeito... agora a lista única responde os dois nomes,
e ninguém precisa derivar"*. Este arquivo continuava derivando, e ele é
justamente o que se chama **"um nome só por produto"**.

Agora os candidatos saem de `produtosDaCasa()`. O `catalogo.json` não é mais
importado aqui.

### O teste que devia pegar isso não podia pegar

`o-nome-curto-alcanca-o-produto` perguntava `identificarProduto(p.nome)` e
comparava com `p.nome`. **Esse teste não podia falhar:** quando nenhum candidato
casa, a função devolve o texto cru, e o texto cru é o nome. Eco contava como
acerto, e foi assim que a chave `pizza` passou meses invisível.

Agora o nome vai com um sufixo (`p.nome + " de teste"`). Só passa quem realmente
casou, porque separar o produto do resto é coisa que o eco não faz. Isca
provada: recolocando o buraco da pizza, o teste fica vermelho.

### A quinta cópia do normalizador

`semAcMin`, com o `toLowerCase` em ordem trocada em relação às outras. Aponta
pro `lib/ia/texto.ts`.

### Uma coisa conferida que estava CERTA

Os 86 produtos da casa continuam separando produto de recheio depois da troca,
medido um por um. E a ambiguidade bolo/docinho segue funcionando: `brigadeiro`
sozinho é docinho, `bolo brigadeiro` é bolo, `cenoura` é bolo caseiro.

---

## 7. `lib/ia/fluxo/sabor.ts` — sabor em aberto é buraco no pedido

295 linhas. A trava que impede comanda sair sem recheio. **Seis defeitos, e os
três primeiros abriam a própria trava.**

### O apelido não chegava na trava

    saborQueFalta("risólis")  ->  pergunta o sabor
    saborQueFalta("risoles")  ->  NÃO PERGUNTA
    saborQueFalta("esfiha")   ->  NÃO PERGUNTA

A busca comparava letra por letra com o nome do cardápio. "risoles" e "esfiha"
são apelidos que a casa mantém em `apelidos.ts` justamente porque é assim que o
cliente escreve. Item que entrasse no pedido com esse nome **atravessava a trava
do fechamento em silêncio**, e a comanda ia pra cozinha sem recheio.

A função vinte linhas abaixo, `passouDoLimiteDeSabores`, já perguntava ao
catálogo. Duas funções do mesmo arquivo respondendo "que produto é este?" de
dois jeitos diferentes só podia divergir.

### O sabor negado contava como escolhido

    esfirra, obs "sem carne"        ->  achava que ele já tinha escolhido
    quiche,  obs "sem frango"       ->  idem
    esfirra, obs "não quero carne"  ->  idem

A conferida era só "a palavra está na linha?". A padaria parava de perguntar e a
comanda saía com uma esfirra sem recheio nenhum, carregando "sem carne" no
recado. Era a **quarta** pergunta desse tipo no sistema e a única que não usava
o `afirmouOuNegou`, que já resolve isso pro topo, pro papel de arroz e pro sabor
do bolo.

### O corte do nome era uma conta de caracteres

    "pastel carne"   o canônico é "mini bolha", 10 letras
    sobrava          "rne"   ->  não acha "carne", pergunta de novo

`linha.slice(nomeCanonico.length)` só funciona enquanto o cliente escrever o
nome do cardápio. **Treze jeitos de escrever davam isso**, e eu só descobri
porque o teste novo cobra o catálogo inteiro em vez de três exemplos meus.

O corte tinha que existir mesmo: "empadão com palmito" tem "palmito" no NOME, e
sem tirar o nome o produto respondia por si. Agora quem separa é
`identificarProduto`, que já devolve as duas metades.

### Um ciclo de import que eu mesmo criei

Ao reusar o `afirmouOuNegou` eu fechei um ciclo: `sabor.ts` importava do
`leitor-da-frase.ts`, que importa do `sabor.ts`. Não quebra hoje porque as duas
só se chamam dentro de função. Quebra no dia em que alguém chamar no topo do
módulo, e aí o erro é `undefined is not a function` em produção, longe daqui.

`afirmouOuNegou` e a cerca da palavra mudaram pro `lib/ia/texto.ts`.

### Mais dois

- `ItemDoCardapio`: tipo morto
- sexta cópia do normalizador, e a única sem `.trim()`. Por isso o
  `recheioQueNaoExiste` tinha que chamar `trim` por fora e os outros não
- a cerca da palavra estava escrita duas vezes, e **a segunda cópia nasceu com
  uma barra no lugar de duas**: `"\$&"` em vez de `"\$&"`. Em JavaScript
  `"\$"` não é escape válido e a barra some, então a cópia escapava nada

### Teste novo

`o-sabor-em-aberto-nao-passa.cjs`: 25 produtos que pedem escolha, em 61 jeitos
de escrever (nome do cardápio e apelidos da casa), cobrados nas três direções
(sem sabor pergunta, com sabor não pergunta, negando pergunta). Duas iscas
provadas.

---

## 8. `lib/ia/fluxo/etapas.ts` — a peça central, e só dados

626 linhas. **Cinco defeitos.** Por ser dado e não lógica, tudo aqui passa calado
pelo compilador.

### O cliente recusava e a padaria continuava perguntando

    naoQuer ["salgado"]      ->  a etapa do salgado é pulada
    naoQuer ["salgadinho"]   ->  NÃO é pulada
    naoQuer ["salgadinhos"]  ->  NÃO é pulada

A comparação era com a palavra crua que o modelo devolveu. Ele dizia que não
queria e a padaria seguia perguntando quais salgados ele queria.

### "bolos" fechava a etapa do bolo sem sabor nenhum

A etapa do bolo conferia `produto.toLowerCase() !== "bolo"`, escrito à mão,
enquanto salgado e docinho já usavam `temGenerico`. **O comentário do próprio
`temGenerico`, dez linhas acima, aponta isso**: *"o bolo já tinha esta regra,
escrita à mão na própria etapa dele"*. A versão à mão só reconhecia a palavra
exata, então "bolos" passava como sabor escolhido e a festa fechava com a
cozinha sem saber o que assar.

### O diminutivo estava comendo palavra de verdade

Este eu introduzi no arquivo 4 e só apareceu aqui. `comoOCardapioEscreve`
reduzia "-inho" pra achar "salgadinho", e meia padaria se chama no diminutivo:

    "docinho"   ->  "doco"
    "coxinha"   ->  "coxa"
    "beijinho"  ->  "beijo"

Funcionava **enquanto os dois lados passassem pela mesma redução**, e isso
escondia o estrago. Quebrou na hora em que um lado era uma expressão fixa: a
recusa comparava "doco" com `docinho|doce`.

Virou `formasDoCliente`, que devolve as formas da mais fiel à mais reduzida, e
quem chama tenta todas. Nenhuma palavra é destruída no caminho. Os três
consumidores (o portão da etapa, os nomes de família e a recusa) passaram a usar
a mesma.

### Dois comentários órfãos, e um descrevia função apagada

O doc da forminha estava colado noutra função. E havia o doc de um atalho que
**não existe mais**: ele foi apagado em 26/08/2026 porque fazia quem mandava
tudo de uma vez nunca ser perguntado do papel de arroz, que custa R$ 12 e a
padaria vende. O comentário ficou, descrevendo código que sumiu.

### O que o teste novo passou a cobrar

`as-etapas-estao-inteiras.cjs`, e as três coisas que nenhum compilador vê:

- **`SO()` engole id que não existe.** Ele monta cada roteiro com um `!` que
  mente pro compilador e um `.filter(Boolean)` atrás. Uma etapa some do fluxo
  sem erro nenhum, e o cliente nunca é perguntado daquilo.
- **Título de botão passando de 20 caracteres.** A Meta recusa a mensagem
  inteira: não é o botão que fica feio, é o cliente que não recebe nada. Os 9
  botões estão dentro, e agora ficam cobrados.
- **A recusa e o genérico**, com as duas iscas provadas.

---

## 9. `lib/ia/fluxo/pergunta.ts` — o que a padaria fala

786 linhas. **Seis defeitos**, e o primeiro eu tinha acabado de criar.

### A fala discordava da etapa, e a conversa travava

Uma hora depois de eu trocar o genérico da etapa do bolo por `ehNomeDeFamilia`,
li este arquivo e encontrei a **mesma comparação à mão** que eu tinha tirado de
lá, viva aqui:

    pedido com "bolos"
    a etapa diz  >> ainda falta o sabor
    a fala diz   >> "O bolo vai no prato de MDF aberto ou com tampa?"

O cliente responde o prato, a etapa continua aberta, e a padaria pergunta o
prato de novo. Beco sem saída.

E não dava pra consertar só um lado: **antes das duas mudarem**, "bolos" fechava
a etapa e a cozinha recebia bolo sem sabor. Trocar um pelo outro seria trocar de
defeito. É o argumento mais concreto que eu tenho pra ler a cadeia inteira antes
de dar qualquer coisa por pronta.

### A peça de cardápio era uma lista minha, e incompleta

`pecaDoCardapio` comparava o começo do nome do produto. Por isso precisava de
`"empadao"` **e** `"empadão"` como dois casos (não tirava acento), deixava
`bolos-caseiros.jpg` sem chamador nenhum, e não alcançava o docinho, que tem
produto de nove sabores.

Agora a chave é o **grupo** que a dona já usa no catálogo. O teste cobra que
todo grupo com produto de mais de seis sabores tenha peça, senão a padaria
despeja 31 sabores numa mensagem de WhatsApp e ninguém lê.

### O nome do papel de arroz, escrito à mão em dois lugares

Ele é o único adicional do bolo com preço de tabela, e o nome ia solto nas duas
chamadas ao motor. Se a dona renomear o item, os dois param de achar e **o preço
some da pergunta sem erro nenhum**: `preco > 0` vira falso e a frase sai sem
valor.

### Mais três

- **três blocos de comentário órfãos** empilhados, cada um descrevendo uma
  função que estava mais abaixo
- **oitava cópia do normalizador**, inline dentro de `valorDe`
- o `default:` do `switch` devolve fala vazia: etapa nova entra **muda** e
  ninguém percebe. Hoje as onze estão cobertas, e agora ficam cobradas

### Teste novo

`a-pergunta-nao-discorda-da-etapa.cjs`, 114 falas medidas nos dois roteiros. Ele
cobra quatro coisas que nenhum compilador vê: etapa aberta sem fala, a fala
contradizendo a etapa, botão acima de 20 caracteres ou mais de três por mensagem
(a Meta recusa a mensagem inteira e o cliente não recebe nada), e peça de
cardápio citada que não existe em disco. Duas iscas provadas.

---

## 10. `lib/ia/fluxo/fechar.ts` — o portão de saída

240 linhas. **Quatro defeitos.**

### A terceira cópia do mesmo `=== "bolo"`

A mesma comparação à mão que estava na etapa do bolo e na fala dela também
morava aqui. Só que esta já estava **coberta pelo laço de família vinte linhas
acima**, e era mais fraca que ele:

    pedido com "bolo"   ->  "qual bolo você quer" E "o sabor do bolo"
    pedido com "bolos"  ->  só o primeiro; a cópia à mão não pegava o plural

O cliente ouvia a mesma falta duas vezes, com palavras diferentes.

### "qual bolos você quer"

O portão aceita o jeito que o cliente escreveu, e depois devolvia **a palavra
crua dele** na pergunta. A padaria fala com o cliente, então ela fala certo:
nasceu `nomeDaFamilia`, que devolve o nome canônico.

### Total zero fechava pedido

Havia trava pra cotação vazia e não pra cotação toda zerada. Todo produto da
casa tem preço, então zero nunca é resposta certa, e um pedido de R$ 0,00 na
fila custa uma ligação pro cliente.

**Sem teste, e está escrito no código por quê:** eu tentei montar o estado que
dispara isso e não consegui. Com item de qtd zero a trava de cima já segura, e
com produto fora do cardápio a cotação volta vazia. Só dispara se o motor falhar
de um jeito que hoje eu não sei provocar, que é justamente quando rede embaixo
serve.

### Um comentário órfão

"Bolo sem sabor não se produz", colado no bloco do topo.

### Uma coisa que eu tentei melhorar e desfiz

Eu tinha juntado as duas chamadas de `motivoParaAEquipe` numa variável. Era
arrumação, não conserto, e **quebrou dois testes** que liam aquela expressão na
fonte pra provar que a pendência da equipe sai do motivo e não é ligada em todo
pedido. Não vale trocar duas guardas de verdade por uma chamada a menos numa
função pura. Desfiz.

### Um teste que cobrava a frase, e não o efeito

`pedido-so-fecha-com-tudo` exigia a expressão *"sabor do bolo"* no motivo. Com o
conserto acima o motivo passou a ser *"qual bolo você quer"* — mesmo efeito, e
sem a duplicata. **Teste que cobra a frase quebra quando a frase melhora.**
Agora ele cobra que o bolo sem sabor não feche e que o motivo fale do bolo.

---

## 11. `lib/ia/orcamento.ts` — o motor de preço

521 linhas. A única peça que escreve dinheiro. **Quatro defeitos, e dois deles
custavam dinheiro de verdade.**

### Uma leitura de negação só dele

Havia um `citadoDeVerdade` com a própria lista de palavras. Medido contra o
leitor da frase, em nove frases, **quatro discordavam**, e três cobravam R$ 12
de quem tinha recusado com todas as letras:

    "nao quero papel de arroz"      o motor cobrava
    "topo sim, papel de arroz nao"  o motor cobrava
    "papel de arroz nao"            o motor cobrava

E uma ia pro outro lado: *"tirar o papel de arroz"* o motor entendia e o leitor
da frase não. **Cada lista sabia um pedaço do português que a outra não sabia.**
Juntar as duas foi o conserto, e agora é uma só.

### Um galho que nunca disparou, e o bolo virava docinho

Quando a observação tem marca de bolo (topo, prato aberto, aniversariante), o
nome curto é sabor de BOLO e não o docinho de mesmo nome. O galho que fazia isso
procurava a categoria `"bolo"`, **que não existe neste motor**: elas são
`bolo_recheado`, `bolo_caseiro` e `bolo_salgado`.

    "café" com topo de bolo  ->  cotava o DOCINHO, R$ 1,25
    o certo                  ->  bolo caseiro café, R$ 35,90

Um bolo de 2 kg saindo por R$ 2,50. É o mesmo defeito que o `produto.ts` diz ter
consertado no fluxo, vivo aqui, e o próprio comentário do arquivo explica por
que isso importa: **o motor é chamado de outros lugares** (o painel da dona, o
pedido corrigido na mão) e ali o nome chega curto.

### A base da festa podia sugerir bolo salgado

`primeiroDaCategoria("bolo")` casa pelo começo, e há três categorias de bolo.
Ele devolvia o primeiro da ORDEM DO CATÁLOGO, e hoje dá certo **por acidente**.
No dia em que a dona reordenar a tela, a proposta passa a sugerir bolo salgado
de R$ 29,90 e ninguém descobre olhando código: o número simplesmente muda.

Pedir o mais barato também não serve, e foi medido: o mais barato entre os três
é justamente o bolo salgado. O certo é pedir a categoria certa.

### O normalizador local sombreava o de todo mundo

Um `const semAcento` dentro da função escondia o `semAcento` importado no topo do
arquivo: quem lesse o código veria o nome conhecido e estaria lendo outra função.
E com uma diferença de verdade: a local fazia `String(t)` sem o `|| ""`, então
`undefined` virava a palavra "undefined" e podia virar chave de preço.

### Teste novo

`o-motor-nao-cobra-o-que-foi-recusado.cjs`: os **30 sabores de bolo** da casa
pelo nome curto, os 12 docinhos, e as onze maneiras de aceitar ou recusar o papel
de arroz. Cobra a classe inteira, e não os três exemplos que eu tinha na mão.
Duas iscas provadas, e cada uma reproduziu o defeito exato.

---

## 12. `lib/banco/montagem.ts` — o pedido enquanto a conversa acontece

440 linhas. **Três defeitos**, e o principal trocava produto e preço por uma
palavra na observação.

### O segundo sabor do bolo saía de uma regex, não do cardápio

O nome do item precisa dizer os dois sabores de um bolo misto: é ele que a
cozinha lê e que o motor cota. A montagem achava o segundo com uma regex que
pega **qualquer** par de palavras ligado por "e" ou "com". Medido:

    "pão de ló branco e tema Frozen"  ->  b = "tema frozen"
    "prato aberto e papel de arroz"   ->  b = "papel de arroz"

O caso caro é o que casa. Item `bolo prestígio`, observação `prestígio com
ganache`: o nome virava `bolo prestígio com ganache`, **que existe no cardápio
como bolo CASEIRO** — R$ 33,90 a unidade no lugar de R$ 46,90 o quilo.

E ela barrava **sete dos trinta sabores da casa**, porque o formato não cabia
neles: "4 leites" e "0% lactose" têm dígito, "frutas (pêssego e abacaxi)" tem
parêntese, e "fubá com goiabada", "chocolate preto com leite ninho", "brigadeiro
com maracujá" e "prestígio com ganache" já têm "com" dentro do próprio nome.
Quem pedisse bolo brigadeiro com 4 leites levava só o brigadeiro.

Agora procura o NOME do sabor no catálogo, do mais longo pro mais curto, e exige
o conector na frente. O conector é o que separa "brigadeiro com morango" (dois
sabores) de "tema morango" (decoração).

### O filtro de três letras derrubava o "biz"

Ele existia pra barrar lixo, e quem barra lixo passou a ser o cardápio. Mantido,
derrubava exatamente um sabor: **"biz", de R$ 49,90**. É o mesmo defeito que o
motor de preço já tinha registrado no comentário dele: *"todo bolo misto com biz
saía cobrado pelo OUTRO sabor"*.

### A nona cópia do normalizador

Inline dentro de `observacaoLimpa`.

### Duas coisas conferidas que estavam CERTAS

**A hora fora do expediente não é gravada, e isso não é defeito.** Ela é apagada
só na memória do turno: `dadosQueMudaram` ignora valor nulo e `anotarDados`
também. Mas a guarda refaz a conta a cada mensagem, então na volta do banco a
hora velha cai de novo no mesmo filtro. E o `fecharPedido` recebe o estado **já
corrigido**, então o pedido não fecha com a padaria fechada. Segui em frente sem
mexer.

**O terceiro vocabulário de categoria é deliberado.** `CategoriaItem` não é o do
catálogo nem o do orçamento, e a tradução mora num lugar só
(`categoriaDoPedido`), documentada. O que está errado ali é o comentário: diz
"estas cinco" e lista sete.

### Teste novo

`o-segundo-sabor-do-bolo-e-do-cardapio.cjs`: os **30 sabores da casa** como
segundo sabor, e oito coisas que não são sabor. Ele importa a função de verdade,
depois de eu tentar extrair o corpo dela da fonte e executar com `new Function`,
que quebra no primeiro tipo de TypeScript que sobra dentro. Isca provada.

---

## 13. `lib/ia/fluxo/gravar.ts` — a ponte pro banco

267 linhas. **Um defeito, e ele é da família "nada some do pedido".**

### O que saía do pedido nunca saía do banco

`gravarEstado` só sabia ACRESCENTAR e CORRIGIR item. O que desaparecia do estado
ficava gravado pra sempre na tela da dona. O fluxo tem **três caminhos que tiram
item**, todos no `fluxo.ts`:

    1. recusar uma família   apaga o que já estava anotado dela
    2. recusar o papel       tira a linha do papel de arroz
    3. fundir dois bolos     dois viram UM misto, e o outro some da lista

Nos dois primeiros a conversa se cura sozinha: a recusa fica gravada e o filtro
roda de novo a cada mensagem. **Na fusão dos bolos não há flag pra refazer**, e o
bolo que sumiu do estado continuava na tela: a dona via dois bolos onde o cliente
pediu um misto.

E há um quarto caso, que é consequência e não caminho: quando o nome vira
canônico (`"cenoura"` → `"bolo caseiro cenoura"`), ficavam **as duas linhas**.

A remoção vai ANTES da gravação, e isso é parte do conserto: `anotarItem` junta
bolo com bolo pelo nome, então gravar primeiro faria o item novo cair dentro da
linha velha e a remoção depois levaria os dois. O teste cobra a ordem.

### O que o teste NÃO prova, e está escrito nele

`itensQueSairam` é pura e exportada pra poder ser provada sem banco, do mesmo
jeito que o `estadoDosDados` já era. Mas os estados do teste foram escritos a
partir da **leitura** dos três caminhos, e não de rodar o fluxo. Se um daqueles
caminhos mudar de forma, o teste continua verde e não devia. Quem cobre isso de
verdade é medir uma conversa contra o banco.

### Três coisas conferidas que estavam CERTAS

- `fluxo_perguntei` é gravado com `join(",")` sem espaço e lido com
  `split(",")`: os dois lados combinam
- o `slice(0, 20)` dos guardados é teto, não perda silenciosa de item do pedido
- a assimetria entre "só grava valor cheio" (nos dados do cliente) e "vazio vira
  a palavra `nenhum`" (na memória da conversa) é deliberada e está documentada:
  o único caminho que limpa de verdade é o recomeçar, e ele apaga a linha toda

---

## 14. `lib/banco/fila.ts` + `lib/cupom-escpos.ts` — o papel do mural

255 + 264 linhas. O fim da linha: se o item não sai no papel, ninguém produz.
**Quatro defeitos, e nenhum deles estava custando dinheiro hoje.**

### A décima cópia do normalizador, e a única que tinha razão de existir

O cupom precisa tirar o acento (a impressora térmica engasga) **sem** baixar a
caixa: o papel é lido por gente e o nome do cliente vai em maiúscula. A cópia
local fazia isso certo, e se chamava `semAcento` — **o mesmo nome da função que
o resto do sistema usa pra comparar**, que baixa a caixa e apara.

Nome igual e comportamento diferente é a mesma armadilha que apareceu no motor
de preço. Nasceu `tiraAcento` no módulo de texto, e `semAcento` passou a ser
construído em cima dele.

### `??` onde o comentário pedia `||`

    // Unidade vazia vira peça na impressão: 3 kg de bolo viram três bolos.
    unidade: i.unidade ?? unidadeDoProduto(...)

O `??` só pega `null` e `undefined`, e o caso que o comentário nomeia é a string
**vazia**, que a tela da dona pode gravar. **Não estava dando prejuízo**, e vale
dizer por quê: `unidadeDoItem`, no cupom, tem a própria cadeia de fallback e
acerta pela categoria. Mas a defesa que está escrita ali tem que ser a defesa que
roda ali.

### Dois comentários mentindo

Um duplicado, com duas versões da mesma explicação empilhadas. E outro dizendo
que *"a ponte remonta o cupom"* — era verdade até o layout mudar de casa, e o
cabeçalho do próprio arquivo explica a mudança.

### O que o teste passou a cobrar

`todo-produto-chega-na-cozinha.cjs`, os 86 produtos da casa um por um. Ele existe
porque três decisões independentes, em dois arquivos, precisam concordar:
`categoriaDoPedido` diz a categoria, `deptoDe` diz em que comanda ela cai, e
`deptosDoPedido` diz quais comandas o pedido tem. **`montarCupons` agrupa pela
segunda e imprime pela terceira**: comanda que uma cria e a outra não lista
simplesmente não sai, e o item só aparece no cupom do caixa. Não há erro nenhum
pra ninguém ver — o papel sai, só que sem aquele item.

Medido: os 86 chegam, escritos, com a unidade certa. Duas iscas provadas.

### Dois erros meus, no teste

A primeira versão pegava a primeira linha que continha o nome do produto, e essa
é o **cabeçalho da comanda** — sete produtos reprovaram por defeito do teste. E a
limpeza dos comandos ESC/POS tirava só o byte de controle, deixando a letra
grudada na linha (`E200 un coxinha`), o que fez os 86 reprovarem na tentativa
seguinte. Os dois consertados e explicados dentro do arquivo.

---

# A CADEIA INTEIRA FOI LIDA

Os catorze arquivos, do primeiro byte ao último, com as cinco perguntas em cada
linha. **78 defeitos consertados.**

O que a leitura ensinou, e que nenhuma sonda tinha achado antes:

- **peça consertada num arquivo vira defeito no seguinte** quando os dois
  decidiam a mesma coisa por conta própria. Aconteceu três vezes com o mesmo
  `produto === "bolo"`, e a terceira só apareceu porque eu já tinha lido as
  outras duas
- **o teste que jura cobrir aquilo é o próximo lugar a olhar.** Três defeitos
  passaram anos por baixo de um teste verde: a pizza sem candidato, a instrução
  gigante da oferta e o formato da IA sem `ehFesta`
- **a mesma linha copiada dez vezes já divergia em quatro delas**, e as
  divergências eram justamente onde doía

---

# DEPOIS DA CADEIA: OS 27 ARQUIVOS QUE ELA ALCANÇA

Medido em 28/08/2026: a partir do webhook, a IA alcança **42 arquivos**. A cadeia
eram 15. Sobram **27, com 5.744 linhas**, e há peça central ali.

| # | arquivo | linhas | estado |
| --- | --- | --- | --- |
| 15 | `lib/ia/dados/produtos.ts` | 517 | **INTEIRO** — 6 defeitos |
| 16 | `lib/ia/fluxo/leitor-da-frase.ts` | 516 | **INTEIRO** — 7 defeitos |
| 17 | `lib/ia/fluxo/falas-do-cliente.ts` | 357 | **INTEIRO** — 8 defeitos |
| 18 | `lib/ia/fluxo/informacao.ts` | 253 | **INTEIRO** — 6 defeitos |
| 19 | `lib/ia/persona.ts` | 223 → 52 | **INTEIRO** — 170 linhas mortas |
| 20 | `lib/ia/texto.ts` | 178 | **INTEIRO** — 2 defeitos meus |
| 21 | `lib/ia/fluxo/generico.ts` | 170 | **INTEIRO** |
| 22 | `lib/ia/fluxo/restricao.ts` | 161 | **INTEIRO** |
| 23 | `lib/ia/fluxo/dizer.ts` | 147 | **INTEIRO** |
| 24 | `lib/ia/fluxo/base.ts` | 140 | **INTEIRO** |
| 25 | `lib/ia/catalogo-em-texto.ts` | 120 | **APAGADO** — morto inteiro |
| 26 | `lib/ia/dados/apelidos.ts` | 112 | **INTEIRO** — 3 defeitos |
| 27 | `lib/ia/fluxo/situacao.ts` | 87 | **INTEIRO** |
| 28 | `lib/ia/fluxo/cotar.ts` | 49 | **INTEIRO** |

E a camada de banco, lida em 28/08/2026:

| # | arquivo | linhas | estado |
| --- | --- | --- | --- |
| 29 | `lib/banco/pedidos.ts` | 620 | **INTEIRO** — 6 defeitos |
| 30 | `lib/banco/montagem.ts` | 540 | **INTEIRO** — 2 defeitos |
| 31 | `lib/banco/conversas.ts` | 499 | **INTEIRO** — 6 defeitos |
| 32 | `lib/banco/resultados.ts` | 380 | **INTEIRO** — 1 defeito (o pior do dia) |
| 33 | `lib/banco/negocios.ts` | 340 | **INTEIRO** — 3 defeitos |
| 34 | `lib/banco/parados.ts` | 283 | **INTEIRO** — 2 defeitos |
| 35 | `lib/banco/fila.ts` | 275 | **INTEIRO** — 2 defeitos |
| 36 | `lib/banco/atendimentos.ts` | 217 | **INTEIRO** — 1 defeito |
| 37 | `lib/banco/db.ts` | 130 | **INTEIRO** — cabeçalho descrevia outra arquitetura |
| 38 | `lib/banco/clientes.ts` | 119 | **INTEIRO** — 1 defeito |
| 39 | `lib/banco/tipos-da-conversa.ts` | 60 | **INTEIRO** — 1 campo que ninguém lia |

Puxados junto, porque o rastro de um defeito passava por eles:
`lib/tipos.ts`, `lib/departamentos.ts`, `lib/cupom-escpos.ts`, `lib/mock.ts`,
`lib/negocio.ts`, `lib/ia/dados/produtos.ts`, `lib/ia/fluxo/generico.ts`,
`lib/ia/fluxo/leitor-da-frase.ts`, `app/(painel)/acoes.ts`,
`app/api/whatsapp/route.ts`, `app/api/montagem/route.ts`,
`app/api/cardapio/opcoes/route.ts` e quatro telas.
| — | banco e infra (9 arquivos) | 2.281 | não lidos |
| — | fora do cérebro (3 arquivos) | 530 | não lidos |

---

## 15. `lib/ia/dados/produtos.ts` — a fonte única

517 linhas. O arquivo que existe pra **ninguém mais ler o catálogo cru**.
**Seis defeitos**, e dois deles dentro da própria fonte única.

### O padeiro saía de uma lista de seis nomes

    /^(pao frances|pao de x|pao doce|cuca|cuca recheada|cachorro-quente)/

Ela acertava os sete produtos de hoje e **quebrava no dia seguinte**: o pão de
milho que a dona cadastrar amanhã entra na categoria `padaria`, não casa com
nenhum dos seis padrões, e a comanda dele sai na CONFEITARIA. Ninguém descobre
olhando código, porque o papel sai — só que no setor errado.

Medido: a categoria `padaria` tem exatamente os sete que vão pro padeiro, e
nenhuma outra vai pra lá. **A categoria responde sozinha.**

O salgadeiro continua sendo lista, e de propósito: o mini xis e o mini
sanduíche são `salgado_assado` iguais aos outros nove, e nada no cardápio os
distingue. É regra de quem produz, não dado do cardápio.

### Uma linha que parecia decidir e não decidia

Toda chamada passava `bancada: "confeitaria"` à mão, e o spread jogava fora.
Quem lesse acharia que aquela linha decide, e trocá-la pra `"padeiro"` não teria
efeito nenhum. O tipo agora proíbe passar.

### A fonte única lendo o JSON cru

Dentro do arquivo que existe pra isso não acontecer, `categoriaDoPedido` relia
`bolos_caseiros` direto do catálogo. A resposta já estava na própria lista.

### Mais três

- `const c` declarado, nunca usado, **mantido vivo por um `void c`**
- a décima primeira cópia do normalizador
- um comentário dizendo *"estas cinco"* sobre uma lista de sete

### E dois que escaparam da leitura da cadeia

Medindo quem ainda lê o `catalogo.json` cru, achei em arquivos que eu **já tinha
dado por lidos**: um import morto no `pergunta.ts` e a última leitura crua no
`fluxo.ts` (que remontava as faixas de preço pra chegar nos sabores). Os dois
passaram pela minha leitura sem eu ver. Dezessete arquivos liam o catálogo cru
em 26/08; hoje são dez, e nenhum deles é do fluxo da conversa.

### Teste novo

`a-bancada-sai-do-cardapio.cjs`. Ele cobra os 86 produtos **e a regra**: o teste
de resultado sozinho passaria com a lista antiga, porque ela acerta os sete de
hoje. O que a lista não faz é acertar o produto de amanhã, e isso só dá pra
cobrar olhando como a decisão é tomada. Isca provada.

---

## Fora da lista: `lib/departamentos.ts` — a unidade no papel

Achado varrendo o padrão do defeito da bancada. A mesma doença, no arquivo que
decide o que sai escrito na comanda:

    const KG_POR_NOME = /cachorro|pao frances|pao de x|pizza redonda|torta fria|
                         torta salgada|empadao|cuca|pao doce/;

E o conjunto de categorias listava `bolo_caseiro` e `pizza` como "por quilo por
natureza", **e eles não são**: o caseiro se vende por unidade (R$ 30,90 a
R$ 35,90 cada) e a pizza também.

Medido com o item chegando sem unidade gravada: **17 dos 86 produtos saíam com a
unidade errada** — os 15 bolos caseiros e as duas pizzas.

**Não estava dando prejuízo, e conferi por quê:** consultei o banco e toda linha
gravada tem unidade. A defesa é que estava errada. Agora quem responde primeiro
é o cardápio.

### O teste pegou um erro meu no meio do conserto

A primeira versão perguntava com `produtoNoComeco`, que casa pelo COMEÇO:

    "bolo prestígio com ganache"  começa com  "bolo prestígio"
    e "bolo prestígio" é o bolo de FESTA, vendido por quilo

O caseiro saiu em kg no papel, e o `todo-produto-funciona` reprovou na hora. É o
mesmo tropeço que o `produtos.ts` avisa no comentário do `produtoNoComeco`.
Virou `produtoPorNome`, que exige casamento exato.

### Provado contra a versão anterior

172 casos (os 86 pelo nome do catálogo e pelo nome curto), comparando a função
antiga com a nova: **0 pioraram, 33 melhoraram.**

### Um efeito colateral que valeu registrar

`departamentos.ts` passou a importar o cardápio, e o cardápio é um JSON. Sete
testes compilam os arquivos DE VERDADE com `tsc` (em vez de testar uma cópia
digitada, que esconderia divergência), e um deles morria com *"Cannot find
module './catalogo.json'"*. Faltava `--resolveJsonModule`.

---

## 16. `lib/ia/fluxo/leitor-da-frase.ts` — o código lendo junto com a IA

516 linhas. Ele existe pra segurar o que o modelo larga, e responde duas
perguntas que mudam o rumo da conversa: *"ele nomeou um produto?"* e *"o que ele
pediu fora da hora?"*. **Sete defeitos.**

### Catorze produtos eram invisíveis

A lista de nomes era a leitura crua do catálogo com **a mesma lista de quatro
baldes** que causou o buraco da pizza no `produto.ts`. Ficavam de fora
`bolos_caseiros` e `pizza`: **12 bolos caseiros e as 2 pizzas**.

Quem escrevesse *"na verdade quero um bolo de cenoura"* no meio do docinho não
nomeava produto nenhum, e a conversa **não ia pro bolo**.

### A tolerância a erro de digitação era desfeita na linha seguinte

    "100 coxinia"    achava coxinha     ->  item: nenhum
    "100 brigadero"  achava brigadeiro  ->  item: nenhum

O item era reprocurado pelo nome CANÔNICO com um `indexOf`, e "coxinia" não
contém "coxinha". Agora o leitor guarda **onde** cada nome casou.

### O sabor de um virava produto do outro

    "50 trufa de morango"  ->  50 trufa E 50 "morango"

"morango" é sabor de bolo de festa, então é produto quando dito sozinho. Colado
atrás de "trufa de" ele é o recheio, e virava linha própria que o motor cotaria
como bolo, a R$ 46,90 o quilo.

### Uma pizza virava duas linhas

    "quero uma pizza redonda"      ->  pizza inteira E pizza redonda
    "uma pizza meia de calabresa"  ->  pizza inteira E pizza meia

"uma pizza" é apelido da inteira, e os dois pedaços se sobrepõem. A regra nova é
geral: **dois nomes no mesmo pedaço da frase são um produto só, e vence o
maior**, porque o maior é o mais específico.

### O sabor colado no nome só existia pro salgado

`recheiosDoCatalogo` lia só os salgados. A cuca tem 7 sabores, a trufa 9, o
franciscano 8, a pizza 31, e nenhum chegava lá: *"2 cuca de chocolate"* perdia o
chocolate e a padaria perguntava de novo o que o cliente já tinha escrito.

### Dois que vieram da lista de apelidos

**`"de 30"` perdia os dígitos e virava `"de "`**, que está em quase toda frase:

    "50 brigadeiro, forminha rosa, e um bolo de 2 kg de 4 leites"
    achava  ->  brigadeiro, PIZZA REDONDA, 4 leites

E **`"meia"` é apelido da pizza meia e palavra da língua**. Esse eu introduzi ao
incluir as pizzas: *"meia dúzia de coxinha"* passou a dar 6 coxinha e **194 pizza
meia**. A régua nova (apelido de uma palavra precisa de cinco letras) saiu de
medir a lista inteira: "meia" é o único abaixo disso, e o único que é palavra
comum.

### Teste novo, e um erro meu dentro dele

`o-leitor-da-frase-acha-e-nao-inventa.cjs`, com **quatro iscas, uma por
conserto**, cada uma reproduzindo o defeito exato.

A primeira versão de uma das cobranças reprovava **todo** apelido curto,
inclusive o que eu tinha decidido descartar de propósito. Isso não cobra nada:
cobra a minha decisão de volta pra mim. Virou a pergunta certa: **o produto
continua tendo porta?**

---

## 17. `lib/ia/fluxo/falas-do-cliente.ts` — o que o código lê sem modelo

357 linhas. Três decisões que **não passam pelo modelo de propósito**, cada uma
com o motivo escrito: apagar o pedido de alguém não é decisão de redação; a
resposta ao valor é dinheiro com duas saídas; a saudação sai do relógio.

**Oito defeitos**, e justamente por serem regra e não interpretação, erravam
calados.

### "não, não apaga tudo" apagava o pedido

A negação era uma regra própria daqui, e exigia a forma exata `(nao|sem)
(quero|precisa|vamos)? (reiniciar|recomecar|zerar|apagar)`. O cliente escreveu
**"apaga"** e a lista tinha **"apagar"**.

Apagar o pedido de quem pediu pra NÃO apagar é o pior que essa função pode
fazer, e ela diz isso no próprio comentário. Agora a pergunta é feita ao
`afirmouOuNegou`, que é quem responde isso no sistema inteiro.

### "sim, mas não esquece do topo" era lido como recusa

O comentário dizia *"quem diz não PRIMEIRO está recusando"* e o código fazia
outra coisa: testava a recusa inteira antes, então "nao" em **qualquer** lugar
ganhava. O cliente aceitava o valor e o pedido ficava no limbo — que é
exatamente o defeito que essa função existe pra impedir.

### "incerto ainda" era lido como aceite

Sem fronteira de palavra, **"certo" casava dentro de "incerto"**. Alguém em
dúvida aprovando um valor.

### Duas listas de cumprimento, e elas já divergiam

`"como vai"` era cumprimento pra quem TIRA e não era pra quem PÕE:

    cliente >> Como vai, quero coxinha
    padaria >> Boa tarde, tudo bem? Como vai, quero coxinha

Dois cumprimentos na mesma frase, que é o tique de robô que a regra do dono manda
evitar.

### O "boa tarde" no meio da frase

O comentário sempre prometeu que *"boa tarde no meio de uma frase sobre horário
de retirada não é cumprimento"*, e o código procurava em qualquer lugar dos 40
primeiros caracteres. Quem escrevia `"retirar boa tarde nao, as 14h"` ficava sem
o bom dia da casa.

### Mais três

- o cabeçalho dizia **"são vinte e quatro linhas"**; são 357
- a décima terceira e a décima quarta cópias do normalizador, a segunda
  escondida dentro do leitor de dia da semana
- um bloco de doc órfão (a data de retirada) sobre a função errada

### Teste novo

`o-sim-e-o-nao-do-cliente.cjs`, **43 frases** que gente escreve de verdade, nos
dois sentidos: o que tem que valer e o que não pode valer. E a simetria entre pôr
e tirar cumprimento, que é o que impede as duas listas de divergirem de novo.
Três iscas provadas.

---

## 18. `lib/ia/fluxo/informacao.ts` — quando ele só quer saber

253 linhas. É onde a padaria fala **número** pro cliente. **Seis defeitos.**

### Trinta e seis de quarenta e três perguntas de preço ficavam sem resposta

O comentário do arquivo prometia que *"a família que a dona cadastrar amanhã já é
respondida sozinha"*. Não era: a busca passava por uma lista de nomes de família
com **cinco entradas**. Medido perguntando o preço de cada palavra de família e
de produto do catálogo:

    "quanto é a cuca?"      ->  nada
    "quanto é o cupcake?"   ->  nada
    "quanto é a coxinha?"   ->  nada

A padaria caía na saudação, como se não tivesse ouvido, e preço é a pergunta mais
feita que existe. Agora ela procura pelo **grupo** e pelo **produto** da lista
única: sobraram 3 sem resposta, e as três são pedaços de nome de grupo ("festa",
"caseiro", "fria") que ninguém pergunta sozinho.

### `/doce/` sequestrava a torta doce e o pão doce

As famílias eram procuradas por **pedaço de palavra**, e pedaço pega o nome de
outra família:

    "torta doce"  custa R$ 33,90  ->  a padaria respondia R$ 1,25 a R$ 2,25
    "pão doce"    custa R$ 22,90  ->  a mesma coisa
    "brigadeiro com maracujá" é bolo de R$ 46,90/kg  ->  R$ 1,25

Três preços errados na cara do cliente, **todos pra baixo**. A regra nova é a
ambiguidade, e não a ordem: quando o que ele escreveu resolve pra UM grupo só, o
grupo responde; quando resolve pra dois ("brigadeiro" é docinho **e** sabor de
bolo), a família decide — o mesmo desempate que `identificarProduto` já usa.

### Duas perguntas diferentes que eu tentei resolver com uma regra só

`"empadão"` é mais **amplo** que "empadão com palmito": a resposta é a faixa dos
dois. `"brigadeiro com maracujá"` é mais **estreito** que "brigadeiro": a resposta
é a dele.

Eu tentei "ganha o nome mais longo" e **errei os dois lados de uma vez** —
"empadão" passou a responder só o com palmito. Ficaram separadas, e o teste pegou
as duas.

### Dois `SobreOQue`, e o segundo era meu

Eu criei um no `leitura.ts` no arquivo 5, pra poder conferir em tempo de execução
o que o modelo manda. Dois tipos com o mesmo nome pro mesmo assunto é a mesma
doença das duas listas de cumprimento. Ficou um, e os motivos de cada caixa
seguem escritos aqui, que é onde a resposta é redigida.

### Mais dois

- o galho do salgado era o **único do arquivo** que ainda lia o `catalogo.json`
  cru, num lugar onde o docinho, o bolo e o resto já perguntavam pra lista.
  Conferido antes de trocar: os dois caminhos dão o mesmo número
- mais uma cópia do normalizador

### Teste novo

`a-pergunta-de-preco-tem-resposta.cjs`, **133 palavras de preço** e os 86
produtos. Ele cobra três coisas, e a terceira é a que impede o conserto de virar
defeito: **o número da resposta tem que ser o número do cardápio**. Responder
mais não pode significar responder diferente do que a casa cobra. Duas iscas
provadas.

---

## 19 a 24. Os seis pequenos do fluxo — 754 linhas

`generico` 170, `restricao` 161, `dizer` 147, `base` 140, `situacao` 87,
`cotar` 49. **Cinco defeitos**, e três deles são a segunda metade de conserto que
eu já tinha feito noutro arquivo.

### "Qual **uns bolos** você quer?"

`perguntaDaFamilia` devolvia a palavra CRUA que o cliente digitou, e o portão
aceita plural, artigo e diminutivo:

    "bolos"      ->  "Qual bolos você quer?"
    "uns bolos"  ->  "Qual uns bolos você quer?"
    "doces"      ->  "Qual doces você quer?"

O mesmo defeito já tinha sido consertado no fechamento com `nomeDaFamilia`, e
esta é a outra porta: a pergunta da etapa da confirmação.

### A recusa da base, pela segunda vez

`base.ts` tinha a mesma comparação de palavra crua que a etapa tinha. Medido,
numa festa de 20 pessoas:

    naoQuer ["salgado"]     ->  a base tira os 200 salgados
    naoQuer ["salgadinho"]  ->  a base continua com os 200, R$ 200 a mais

O cliente dizia que não queria e recebia a proposta com aquilo dentro.

### O timeout da IA, pela segunda vez

A reescrita da fala não tinha timeout, igual à leitura antes do arquivo 5. É a
**segunda** chamada de IA do turno: uma trava aqui mata o turno depois de a IA
já ter sido cobrada duas vezes.

Aqui o prazo ficou mais curto (8s, sem repetição): reescrever é enfeite, o texto
do código já está pronto e correto, e estourar não perde resposta nenhuma — só o
jeito de falar.

### Três declarações da mesma lista de situações

`"reclamacao" | "cancelar" | "status"` estava no tipo `Leitura`, no `situacao.ts`
e conferida à mão no limpador da IA. Virou um array (`SITUACOES`), pelo mesmo
motivo do `SOBRE_O_QUE`: união de tipo o compilador apaga, e o que chega do
modelo é texto.

### A terceira lista de saudação

`dizer.ts` tinha a sua, com uma entrada a mais que as outras duas.

### E o detector pegou uma barra minha

Ao escrever o conserto acima eu montei uma regex com `"\s*"` de uma barra só
dentro de aspas, que é exatamente o que o `barra-comida-dentro-de-aspas` existe
pra pegar. Ele reprovou na hora. **Quinta vez nesta sessão**, e a quinta vez que
uma defesa escrita antes segurou.

### Dois arquivos conferidos e CERTOS

`restricao.ts` (só a cópia do normalizador; o comportamento está certo nos onze
casos medidos, inclusive o `0% lactose` que a casa faz de verdade) e `cotar.ts`
e `situacao.ts`, sem defeito nenhum.

---

## 25. `lib/ia/persona.ts` — e um arquivo inteiro que morreu junto

223 linhas, das quais **170 eram uma função sem chamador nenhum**.

### O system prompt do cérebro antigo continuava aqui

`montarSystemPrompt` era a carta de trinta páginas: persona, cardápio inteiro,
quarenta regras e doze ferramentas, que ia em TODA mensagem. O cérebro foi
apagado em 26/08/2026 e o prompt ficou.

Conferido antes de apagar: `montarSystemPrompt` não aparecia em lugar nenhum do
repositório além da própria declaração — nem em código, nem em teste, nem em
documento.

Sobraram 52 linhas, e são as duas coisas vivas: o tipo `ConfigNegocio` e a
configuração `DOCE_PAO`, que o `informacao.ts` usa pra responder horário e
endereço.

### E `catalogo-em-texto.ts` inteiro caiu junto

120 linhas que só existiam pra alimentar aquele prompt. Ficaram sem chamador no
instante em que ele saiu.

### O detector de código fantasma tinha o próprio ponto cego

`nada-de-codigo-fantasma` varria **uma pasta escrita à mão** (`lib/ia/fluxo`), e
a persona mora um nível acima. **Mais uma lista minha, e desta vez dentro de um
teste.**

Ao alargar, errei duas vezes seguidas, e as duas ficaram escritas no teste:

1. **Alarguei a varredura de declaração e esqueci a de uso.** Ele acusou doze
   funções de `lib/banco` como mortas, e elas são usadas pelo painel. Falso
   positivo em detector é pior que buraco: quem vê doze acusações erradas para de
   acreditar na décima terceira, que é verdadeira.
2. **A minha lista de pendências cegou o detector.** Escrever os nomes dos órfãos
   dentro do arquivo fez eles passarem a ter "duas aparições" e saírem da conta.

### Quatro órfãos achados e NÃO apagados

`RECADO_DA_EQUIPE`, `anexarFotoAoPedido`, `dispensarOrcamento`,
`reativarOrcamento`. São órfãos de verdade, conferidos um por um no repositório
inteiro. Mas moram em arquivos da camada de banco que **eu ainda não li linha por
linha**, e apagar código de arquivo não lido é o oposto do que esta leitura é.

Ficaram anotados no teste, numa lista que **só pode encolher**: ele reprova se
aparecer órfão novo fora dela, e também se um daqui deixar de ser órfão sem sair
da lista.

### O teste que cobrava o prompt morto

`nada-pode-divergir` lia o TEXTO da persona e procurava frase proibida dentro
dele. Seguia verde cobrando um texto que ninguém mais lia. **Teste que cobra
código morto é pior que teste nenhum: dá a sensação de que a regra está
protegida.**

As três coisas que ele protegia foram medidas e continuam de pé no código vivo,
e agora são cobradas de quem faz o trabalho hoje: o apelido "pizza de metro"
chega em `pizza inteira` pelo `identificarProduto` e pelo leitor da frase; o
vocabulário de cada etapa sai do catálogo; as 21 cores saem de `coresDoCardapio`.

E ganhou uma cobrança que não existia: **todo produto do catálogo chega na lista
única, e a lista não inventa produto**. É a guarda que teria pego o defeito da
pizza meses atrás.

---

## 26 e 27. `apelidos.ts` e `texto.ts` — o cérebro fecha aqui

### O preço dependia da ORDEM DAS CHAVES de um objeto

`nomePeloApelido` percorria o objeto na ordem em que ele está escrito e devolvia
**o primeiro** que casasse. Por isso o comentário do `mini bolha doce` diz que
ele *"tem que vir ANTES do salgado"*:

    "pastel doce de banana"  casa "pastel doce" (R$ 1,25) E "pastel" (R$ 1,00)

Mover uma linha daquele arquivo trocaria o produto e o preço, sem erro nenhum.
Virou "ganha o mais longo", que é a mesma regra que o leitor da frase e a
resposta de preço já usam. **Provado com isca:** com as duas chaves invertidas o
resultado continua certo, e antes não continuaria.

### E aí descobri que a função estava morta

O `fluxo.ts` importava `nomePeloApelido` e **nunca chamava**. Eu melhorei uma
função morta antes de conferir quem a chamava. **Conferir o chamador vem
primeiro** — e é uma das cinco perguntas da lista, que eu pulei.

Apagada, depois de medir que os dois resolvedores vivos (`identificarProduto` e o
leitor da frase) acertam os cinco casos que importam.

### No `texto.ts`, que eu escrevi nesta sessão e nunca tinha relido

`comoOCardapioEscreve` estava **exportada e sem chamador**. Era a primeira
tentativa de entender "salgadinho", substituída por `formasDoCliente` no arquivo
8. E ela é a função que **destrói palavra**: "docinho" vira "doco". Deixar de pé
uma coisa dessas exportada é convite pra alguém usar sem saber.

`semArtigo` estava importada no `leitura.ts` sem ser chamada no corpo.

### O detector tinha um terceiro buraco: import contava como uso

Os dois achados acima passavam porque `nada-de-codigo-fantasma` lia o arquivo
inteiro, e uma importação que ninguém chama parecia uso. Agora as linhas de
import saem antes da conta — e foi assim que o `nomePeloApelido` apareceu.

**Três buracos no mesmo detector nesta sessão:** varria uma pasta escrita à mão,
procurava uso em três lugares escritos à mão, e contava import como uso. O
detector de código fantasma era, ele próprio, o lugar com mais lista minha do
repositório.


---

# A CAMADA DE BANCO — `lib/banco/`

O cérebro decide; esta camada é o que sobra depois. Ela é onde a decisão vira
linha no Postgres, e onde a linha volta pra tela e pro papel da cozinha. Um erro
aqui não aparece na conversa: aparece na comanda, no total, ou num pedido que
some.

## 28. `lib/banco/conversas.ts` — a conversa e o pedido gravados

### `MARCA_FECHADO` casava com nada, e não tinha como casar

`const MARCA_FECHADO = /^\*Pedido recebido\*/m` cortava o histórico no ponto em
que o pedido anterior fechou. Nenhuma mensagem do sistema escreve esse texto
desde que o cérebro antigo foi apagado — e, pior, **não teria como escrever**: a
mensagem de fechamento passa por reescrita da IA (`podeReescrever: true`), então
o texto dela não é estável. Uma marca fixa procurando um texto que muda.

Apagada junto com `cortarNoPedidoFechado` e `resumoPedidoFechado`. O defeito que
ela existia pra evitar não pode voltar: o fluxo novo manda ao modelo **uma
mensagem só**, nunca o histórico.

### `resumoPedidoFechado` estava morta e escondida por um comentário meu

O detector de código fantasma não a viu porque eu mesmo tinha citado o nome dela
num comentário, e comentário contava como uso. **Quarto buraco no mesmo detector
nesta sessão.** Corrigido: comentário não conta mais.

### `atender.ts` mentia quando a equipe já tinha mexido no pedido

`registrarPedido` joga quando `equipe_ajustou` está marcado — que é a proteção
certa. Mas o `catch` de cima transformava isso em *"Deu um probleminha aqui do
meu lado"*. O cliente ouvia falha de sistema quando o que houve foi a equipe
assumindo o pedido dele. Agora a resposta diz a verdade.

## 29. A unidade do item — a mesma pergunta respondida de SEIS jeitos

A unidade decide como o cupom da cozinha escreve a linha ("2 kg de bolo" ou
"2 un de bolo") e como o painel mostra a quantidade. Ela só pode valer `un` ou
`kg`. Estava assim:

| arquivo | como decidia | passa lixo? |
| --- | --- | --- |
| `produtos.ts` | `o.unidade === "kg" ? "kg" : "un"` | não |
| `fechar.ts` | `l.unidade === "kg" ? "kg" : "un"` | não |
| `conversas.ts` | `l.unidade ?? "un"` | **grava o que vier** |
| `pedidos.ts` | `(i.unidade as "un" \| "kg") ?? "un"` | **o cast lava o dado** |
| `parados.ts` | `l.unidade ?? itens[n]?.unidade ?? "un"` | **o `""` tapa o padrão** |
| `resultados.ts` | `x.unidade \|\| "un"` | só metade |

O `??` só troca `null` e `undefined`: unidade em branco no banco **continua em
branco**. E o `as` não converte nada, só cala o TypeScript, então `"KG"` ou
`"kg "` chegam na comanda como se fossem tipo válido.

E mais **seis** cópias do lado da tela (`cardapio/opcoes`, `AguardandoConfirmacao`,
`PedidoMontado` ×2, `Resultados` ×2), onde a divergência é pior ainda: o papel da
cozinha lia por uma regra e a tela por outra.

**Doze lugares decidindo a mesma coisa.** O defeito não era nenhum dos doze: era
existirem doze. Agora existe `unidadeDoItem` em `lib/tipos.ts`, e o teste
`a-unidade-do-item-e-uma-decisao-so.cjs` varre os 135 arquivos de `lib`, `app` e
`components` atrás de um décimo terceiro. Comparar o resultado pode; decidir
sozinho não.

## Achados do painel que ficaram anotados, não consertados

Estes são de tela, não de cérebro. A ordem combinada é terminar o cérebro
primeiro, então ficam aqui com o passo a passo pra não se perderem.

### Um pedido SEM DIA DE RETIRADA entra na fila de aprovação

`registrarPedido` segura o pedido sem data (`semData` → `precisa_confirmacao`,
com o motivo escrito: *"O cliente não disse o dia da retirada."*). Certo.

Só que `resolverPendencia(pedidoId, extra)` recebe **só um item extra opcional,
nunca uma data**. A equipe lê o motivo na tela, clica pra resolver, e:

1. `limparPendencia` tira o `precisa_confirmacao` e marca `aguardando_cliente`
2. o cliente responde "tá certo"
3. `registrarAceiteCliente` manda pra fila de aprovação
4. `listarFilaAprovacao` **não filtra data nenhuma**

O pedido chega na cozinha com um tracinho no lugar do dia. A cozinha produz por
dia: é exatamente o defeito que a guarda do `registrarPedido` existe pra impedir,
desfeito pelo botão.

Conserto certo: campo de data na ação de resolver pendência, obrigatório quando
`retirada_data` é nula. Travar o botão sem dar onde preencher seria trocar um
defeito por outro.

### A janela em que a IA pode reescrever o pedido que a equipe entregou

`temPedidoAguardandoCliente` é o portão: enquanto o pedido espera o cliente, o
fluxo nem roda. Mas ele está dentro de um `try/catch` que, em erro de banco,
**cai pro fluxo normal** — e aí o `registrarPedido` reescreve o total que a
equipe lançou e deixa o pedido com `aguardando_cliente` ligado, invisível nas
duas filas.

Na prática o caminho comum está coberto, porque quem mexe no pedido
(`adicionarItemPedido`, `salvarItensDoPedido`) marca `equipe_ajustou`, e aí o
`registrarPedido` joga. O buraco é só o `resolverPendencia(id, null)`: resolver
sem lançar item nenhum deixa `aguardando_cliente = true` com `equipe_ajustou =
false`.

Anotado com o caminho completo. Não é um `??` trocado: é desenho de estado, e
mexer nele sem medir é como os seis defeitos que meus próprios consertos criaram
nesta sessão.


## 30. A hora da retirada — a mesma pergunta respondida de CINCO jeitos

A hora nasce na conversa ("as 16h30"), vira `time` no Postgres (`16:30:00`), e
reaparece no cupom da cozinha, no painel, no aviso do WhatsApp e na tela do dia.
Cada ponto tinha o seu jeito:

| arquivo | como arrumava |
| --- | --- |
| `conversas.ts` | `horaPadrao` — ancorado no começo, valida 0-23 |
| `parados.ts` | `horaLimpa` — ancorado no começo, **não valida a hora** |
| `acoes.ts` | regex solta + `slice(0, 5)` |
| `pedidos.ts` | `slice(0, 5)` |
| `fila.ts` | `slice(0, 5)` |

E, do outro lado, o `horaNaFrase` no leitor — que é outro trabalho de verdade
(dentro de uma frase, número solto é quantidade de brigadeiro, não hora).

### Três defeitos, medidos rodando o código de ontem

```
campo  "as 16h30"              ->  null      pedido gravado SEM HORA
campo  "1630"                  ->  "16:00"   trinta minutos jogados fora, calado
frase  "quero as 9 da manha"   ->  null      a padaria pergunta de novo
frase  "as 8h da noite"        ->  "08:00"   doze horas antes
frase  "as 3h da tarde"        ->  "03:00"   três da manhã
frase  "as 12h da noite"       ->  "12:00"   meio-dia em vez de meia-noite
parados "99h"                  ->  "99:00"   hora que não existe, na tela
```

O `horaPadrao` estava ancorado (`/^(\d{1,2})/`) e o comentário dele prometia
entender "as 16h30". A string começa com "a", a regex exige dígito: null.

E o período do dia não entrava na conta em lugar nenhum do sistema. Numa padaria
que produz por hora marcada, "as 3h da tarde" virando 03:00 é o bolo pronto doze
horas antes de alguém buscar.

Agora são duas funções, cada uma com um trabalho: `horaDaRetirada`
(`lib/tipos.ts`) arruma o CAMPO, `horaNaFrase` (leitor) lê a FRASE. O teste
`a-hora-da-retirada-e-uma-decisao-so.cjs` mede 32 horas e varre os 135 arquivos
atrás de um terceiro dono.

## 31. `parseDataRetirada` — o segundo interpretador de data, mais fraco que o primeiro

Rodando o código de ontem, em 28/08/2026:

```
parseDataRetirada("05/01")  ->  "2026-01-05"
```

Oito meses no passado. Ele carimbava `new Date().getFullYear()` e pronto. Pedido
feito em dezembro pra 05 de janeiro nascia com a data do janeiro que já passou —
e dezembro é justamente quando se encomenda bolo pro ano novo numa padaria.

O `dataDeRetirada`, no `falas-do-cliente.ts`, já resolve isso desde 23/08/2026,
quando o dono testou "dia 05 de setembro" e o pedido foi anotado pra 2024. Ele
também entende "sexta", "sábado que vem", e o 31 de fevereiro que o JavaScript
vira 3 de março.

Ter um segundo parser na hora de gravar era desfazer aquele conserto na última
linha do caminho. Agora `parseDataRetirada` só traduz o formato.

## 32. O `` do Windows desligava CINCO detectores, em silêncio

Escrevendo o teste da data, o detector acusou um comentário que EXPLICAVA o
defeito de ser o defeito. A causa:

```js
linha.replace(/\/\/.*$/, "")   // nao tira nada
```

Sem a flag `m`, o `$` quer dizer fim da string. Toda linha deste repositório
termina em `
`, e o `.` do JavaScript não casa com ``: o `.*` para antes
dele, o `$` não vale ali, e o `replace` não troca nada. **O comentário segue
inteiro e o detector lê comentário como código.**

Estava assim em cinco lugares, incluindo o `barra-comida-dentro-de-aspas` — o
detector que já pegou o "shell come a barra invertida" cinco vezes nesta sessão.
É a mesma família: caractere invisível que desliga a regra sem dar erro.

Vale a nota de método: eu tinha "consertado" o quarto buraco do detector de
código fantasma mais cedo nesta sessão, e conferido só que o teste continuava
passando. Passar não prova que o conserto pegou.

## Anotado, não consertado: cinco SELECTs quase iguais em `pedidos.ts`

`listarFilaAprovacao`, `listarAguardandoConfirmacao`, `listarParados`,
`listarDoDia` e `buscarPedido` repetem a mesma lista de 15 colunas, diferindo só
no WHERE e no ORDER BY. Conferi coluna por coluna: **hoje são idênticos**, então
não é defeito ainda. Mas quem acrescentar um campo tem cinco lugares pra lembrar,
e divergência entre o banco e a tela já aconteceu neste sistema. Cabe um detector
que cobre a igualdade das cinco listas.


## 33. `pedidos.ts` — o conserto que ficou num lado só do par

`pedidoEmAberto` e `pedidoRegistradoDoCliente` respondem a mesma pergunta: qual
pedido deste cliente ainda está em curso. A primeira tem esta guarda, com o caso
escrito no comentário:

```sql
p.impresso_em is null
or p.retirada_data is null
or p.retirada_data >= hoje_em_sao_paulo
```

> "Pedido nao impresso NAO some da tela, mesmo com a data passada: e trabalho
> pendente. O do Paulo sumiu no dia seguinte sem nunca ter sido impresso, com o
> cliente pedindo pra mudar o pedido."

A segunda tinha só as duas últimas linhas. E a segunda é a que alimenta a
lateral onde a **equipe edita** o pedido: o trabalho pendente sumia justamente
da tela onde alguém consertaria.

É a nona pergunta da lista funcionando: *eu consertei um lado dessa regra em
outro arquivo?*

## 34. O mês do card de recuperação começava três horas antes

```sql
and coalesce(aprovado_em, confirmado_em, criado_em)
    >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
```

Coluna crua (`timestamptz`) de um lado, início do mês já convertido pra São
Paulo do outro. Comparar `timestamptz` com `timestamp` faz o Postgres converter
o segundo usando o fuso da **sessão**: num container em UTC, o mês começa três
horas antes, e as vendas da última madrugada do mês anterior entram no número.

O `resultados.ts` já faz do jeito certo (converte a coluna, não o corte). Esta
linha ficou pra trás. Agora as duas fazem igual, e o resultado deixa de depender
de como o banco foi subido.

Não consegui confirmar rodando contra a produção (o acesso ao psql foi negado
nesta sessão), então o conserto foi feito na forma que está certa nos dois
cenários, em vez de na forma que depende do fuso da sessão.

## 35. Duas funções diferentes com o mesmo nome, as duas sobre unidade

`unidadeDoItem` existia em `lib/tipos.ts` (a que eu criei hoje: responde sobre o
VALOR) e em `lib/departamentos.ts` (responde sobre a LINHA do ticket, com
escadas de socorro pro cardápio, pra categoria e pro próprio número).

Trabalhos diferentes, mesmo nome, mesmo assunto: convite pra alguém importar a
errada. A do ticket virou `unidadeDoTicket`, que combina com a `qtdDoTicket` ao
lado dela. E a primeira linha dela, que era `item.unidade === "kg"`, passou a
tolerar `"KG"` e `"kg "` — antes esses caíam na escada de baixo como se nada
estivesse gravado. Vazio continua caindo de propósito: ali o cardápio sabe mais
que o campo.

## Duas armadilhas de escrita que me pegaram hoje

**Crase dentro de template literal de SQL.** Escrevi `` `resultados.ts` `` num
comentário `--` dentro de uma query e a crase FECHOU o template. Aconteceu duas
vezes em dez minutos. O `tsc` pegou nas duas, mas só porque o resto virou lixo
sintático: uma crase em posição diferente mudaria a query calada.

**Abrir o arquivo pra escrita antes de terminar o texto.** Um script meu fazia
`open(p, "w").write(f(s))` — o Python abre (e TRUNCA) antes de avaliar `f(s)`.
`f(s)` deu erro no meio e o `departamentos.ts` ficou com zero byte. Recuperado
do git na hora. Monta tudo primeiro, abre depois.


## 36. A tela de Resultados contava os meus testes como venda da padaria

Este é o pior achado da leitura da camada de banco, e a causa é o próprio jeito
como a gente trabalha: medir contra a produção é regra desta casa. O preço disso
é o painel saber separar o instrumento do cliente, e ele não sabia.

O `clientes.ts` escondia cliente de teste do CRM com três condições escritas
dentro da própria query:

```sql
and c.telefone not like '55000000%'
and coalesce(c.nome, '') not ilike 'cliente de teste%'
and coalesce(c.nome, '') not ilike 'qa %'
```

O `resultados.ts` (faturado, pedidos, atendimentos, respostas, horário de pico,
produtos mais vendidos) **não tinha filtro nenhum**.

E o recorte que existia conhecia metade das faixas: sabia do `55000000` da tela
"Testar IA" e não sabia do `55119777700`, que é a faixa das medições por linha
de comando, declarada no `medidor.cjs`, no `guardar-conversas.cjs` e no
`uma-conversa-contra-o-banco.cjs` com o motivo escrito: *"é instrumento, e
instrumento não é cliente"*.

Resultado prático: cada conversa medida deixava na ficha do CRM um cliente com o
nome que a conversa deu ("Marcos Alves", "Ana"), indistinguível de gente, e o
pedido dela entrava no faturamento.

Agora existe `lib/banco/so-cliente-de-verdade.ts`, com as duas faixas e os dois
nomes num lugar só, usado pelo CRM e pelos recortes de dinheiro e de mensagem da
tela de Resultados. E o `mede-uma-conversa` passou a apagar também a linha de
`clientes`, que ficava pra trás depois da limpeza.

O teste `teste-nao-entra-no-numero-da-dona.cjs` cobra as três coisas: a
definição, os recortes, e que ninguém volte a escrever a regra na mão dentro de
uma query.

**Fica pra você conferir:** os números dos meses passados ainda incluem o que já
foi gravado. O filtro novo esconde daqui pra frente e também pra trás, porque
ele filtra na leitura, não na escrita, então a tela já deve mostrar o número
limpo. Vale abrir e comparar.

## 37. O detector da barra não lia a pasta onde eu mais erro

O `barra-comida-dentro-de-aspas` varria só `lib` e `app`, e só `.ts`/`.tsx`.
Mas o lugar onde regex é montada a partir de string com mais frequência é dentro
dos próprios testes: as sondas são arquivos escritos como texto.

Hoje o tropeço aconteceu duas vezes num teste novo (`new RegExp("const " + nome +
"\s*=...")`, com o `\s` virando um `s` solto), e o detector não enxergava
nada, porque não lia a pasta em que ele mesmo estava. Agora varre `components` e
`testes` também, e reconhece `.cjs` e `.mjs`: 107 arquivos viraram 216.

Confirmado com isca: um arquivo com o defeito é acusado, e some quando ele sai.


## 38. `atendimentos.ts` — um cast escondendo o compilador

```ts
const anuncio = (l as unknown as { origem_anuncio?: ... }).origem_anuncio ?? null;
```

O campo ESTAVA na query (`c.origem_anuncio`), só faltava no tipo da linha. O
cast resolvia calando o TypeScript, e é justamente o que esconde renomeação: no
dia em que a coluna mudasse de nome, o compilador ficaria quieto e a tela
pararia de mostrar de onde o cliente veio, sem ninguém saber. Declarado no tipo,
o compilador volta a trabalhar.

## Anotado, não consertado: sete cópias de "esta mensagem é do cliente"

```sql
coalesce(autor, case when papel = 'user' then 'cliente' else 'ia' end) = 'cliente'
```

Sete vezes, em três arquivos (`atendimentos.ts` ×5, `conversas.ts`,
`whatsapp/route.ts`). Conferi uma por uma: **hoje são idênticas**. Mesma família
da unidade e da hora, e o mesmo remédio (uma constante só), mas sem defeito vivo
pra provar o conserto. Fica escrito pra ser a próxima da fila.

## Anotado: o CRM conta pedido de um jeito e soma dinheiro de outro

Em `listarClientes`, `qtd_pedidos` conta `confirmado, aprovado, impresso` e
`total_gasto` soma só `aprovado, impresso`. É defensável (dinheiro só conta
depois que a equipe aprovou), mas não está escrito em lugar nenhum, e um número
que diz "3 pedidos, R$ 0,00" na ficha do cliente parece defeito pra quem lê.
Decisão sua: escrever o porquê ou igualar os dois.


## 39. O AVISO DO DIA não chega na IA, e a tela continua prometendo que chega

A dona tem um campo em Configurações pra escrever o "cérebro temporário" do dia:
*"sem pão após as 18h"*. O comentário do `negocios.ts` explica que ele expira
sozinho na virada, e o `lib/ia/tenant.ts` faz isso certinho
(`ehHojeBR(cfg.aviso_atualizado_em)`).

Só que `carregarTenant` é chamado por **dois lugares**: `/api/montagem` e
`/api/testar-ia`. O webhook do WhatsApp não chama mais: a chamada saiu junto com
o cérebro antigo, em 26/08/2026, e está escrito lá que ela "consultava o banco em
TODA mensagem e o resultado não era lido por ninguém".

**Numa conversa de verdade, o aviso do dia não existe.** A dona escreve, a tela
confirma que salvou, e a Dora nunca fica sabendo.

### E não é um fio solto: é incompatível com o desenho novo

No cérebro antigo o aviso ia pro prompt, e o modelo respondia em cima dele. No
novo, **a fala da padaria é escrita em código** (`falaDaEtapa`,
`respostaDeInformacao`); o modelo só LÊ a frase do cliente e reescreve o texto
pronto. Não há prompt onde enfiar "sem pão após as 18h" e esperar obediência, e
enfiar na reescrita seria abrir de novo a porta que este sistema fechou de
propósito: modelo inventando fato.

**Decisão sua, e é de produto, não de código:**

1. tirar o campo da tela, porque hoje ele mente; ou
2. dar mecanismo de verdade pro aviso: por exemplo, ele vira um fato que o
   código anexa à resposta (como o `RECADO_DA_EQUIPE` faz), ou uma regra que
   marca um produto como indisponível hoje e o orçamento respeita.

A segunda é a que a dona quer de verdade (ela escreveu o aviso pra mudar o que a
padaria responde), e é trabalho de desenho, não de conserto. Anotado aqui
inteiro pra não se perder.


## 40. Mais dois que prometiam o que não faziam

### `carregarMarcaCache` não tinha cache nenhum

Repasse de uma linha pro `carregarMarca`, sobrando de quando havia mesmo um cache
em memória. O cache saiu (dava bug com várias instâncias: trocar a logo e o
refresh cair numa com a marca antiga), o **nome ficou**, e seis telas o chamavam.

Nome que promete o que a função não faz é do mesmo tipo dos outros achados desta
leitura, e aqui a mentira é convidativa: *"já tem cache"* é argumento pra não
pensar no assunto. As seis telas passaram a chamar `carregarMarca` direto.

### `PedidoParaGravar.itens` era construído a cada pedido e jogado fora

O `fechar.ts` montava `itens` e `linhas`, com o comentário: *"os dois vão porque
o banco guarda um e o cupom sai do outro"*. O `registrarPedido`, único consumidor
do tipo em todo o repositório, **só lê `linhas`**.

Campo que ninguém lê é ruim; campo que ninguém lê com um comentário garantindo
que alguém lê é pior, porque no dia em que os dois divergissem a explicação já
estava escrita e errada.

## 41. O contador de "mensagens hoje" começava três horas antes

Mesmo defeito do card de recuperado do mês, no `negocios.ts`:

```sql
and criado_em >= (now() at time zone 'America/Sao_Paulo')::date
```

Coluna crua (`timestamptz`) de um lado, data local do outro. O comentário acima
dela já contava que `current_date` fazia a conta zerar às 21h de Brasília, e o
conserto resolveu metade: trocou o `current_date` pela data de São Paulo e deixou
a coluna sem converter. Num container em UTC, o corte cai às 21h do dia anterior
e a conta de hoje começa com as mensagens da noite de ontem.

Os dois eram a mesma pergunta ("este registro é de hoje/deste mês na padaria?")
resolvida em dois arquivos, e os dois erravam do mesmo jeito.


## 42. `montagem.ts` — o último leitor cru do catálogo no caminho da conversa

Ele lia `catalogo.json` direto pra saber se um sabor de pizza é doce ou salgado,
e isso decide se duas pizzas anotadas viram uma linha ou duas (o rastro de
20/08/2026: o cliente pediu uma salgada de três sabores e uma doce de brigadeiro,
e a cozinha recebeu UMA pizza de brigadeiro).

E não era preguiça: a lista que o `produtos.ts` expunha (`saboresDaPizza`) junta
os dois tipos e perde exatamente a separação de que ele precisava. **Faltava a
porta, então ele foi na fonte por fora.** Agora existe `saboresDaPizzaPorTipo()`
na fonte única, e o `montagem.ts` não conhece mais o JSON.

Arquivos lendo o `catalogo.json` cru: de **9** para **8**, e agora nenhum no
caminho da conversa de verdade.

## Anotado, não consertado: a família escrita à mão no `montagem.ts`

```ts
const familia = (c, p) =>
  /^salgado/.test(c) || /^salgado/.test(p) ? "salgado"
  : c === "docinho" || /^(docinho|doce)s?$/.test(p) ? "docinho"
  : /^bolo/.test(c) || /^bolos?$/.test(p) ? "bolo" : c;
```

É a tabela `FAMILIAS` do `generico.ts` escrita de novo, ao contrário e com
regex. Ela decide de qual linha genérica subtrair ("o cliente pediu 300 assados e
agora está dizendo quais são"), e esse trecho já custou um "salgado 200" fantasma
no pedido.

### Feito, na ordem certa

1. a regra saiu de dentro do `anotarItem` e virou `familiaDoItem`, exportada,
   pra o teste medir ELA e não uma reconstrução dela;
2. os **194 pares que o sistema produz de verdade** (todo produto do catálogo
   com a categoria que o `categoriaDoPedido` dá pra ele, mais as palavras
   genéricas com a categoria errada, que é como a linha genérica chega) foram
   passados pelas duas versões, uma ao lado da outra;
3. **uma única divergência**, e ela é o conserto:

```
outro | "pizza"     velha = outro      nova = pizza
```

A pizza não existia na regra antiga. Uma linha genérica de pizza nunca era
encontrada, então nunca era subtraída: o cliente pedia "3 pizzas" e depois
dizia os sabores, e as três genéricas continuavam no pedido.

Fora dos pares reais existem 30 divergências, todas do mesmo tipo: a categoria
diz uma família e o NOME diz outra (categoria `pizza` com produto "docinho").
São estados contraditórios que o sistema não produz, e está escrito no teste.

E o motivo maior: agora cadastrar uma família em `FAMILIAS` vale aqui sozinho.
Antes teria que lembrar de escrever a regex também, que é o tipo de lista minha
que a regra da casa proíbe.


## 43. `fila.ts` — a idempotência valia pra uma das duas escritas

O comentário do `marcarImpresso` promete: *"a guarda `status = 'imprimindo'`
garante idempotência: uma confirmação repetida/atrasada não re-transiciona um job
que já foi resolvido"*. E garantia mesmo, **na linha da fila**. O update do
PEDIDO vinha solto logo abaixo, e só exigia que a linha da fila existisse:

```sql
update pedidos set status = 'impresso', impresso_em = now()
 where id = (select pedido_id from fila_impressao where id = $1 and negocio_id = $2)
```

Um `ok=true` atrasado, chegando depois de o job já ter ido pra `erro`, não mexia
na fila e mesmo assim **carimbava o pedido como impresso**. Pedido marcado como
se tivesse saído na cozinha sem ter saído: é o pior estado deste sistema, e o
`pedidoEmAberto` usa exatamente o `impresso_em` pra decidir o que ainda é
trabalho pendente.

Agora o segundo update só acontece se o primeiro tiver pego alguma coisa
(`returning pedido_id`). A promessa do comentário passou a valer para as duas
escritas.


---

# A RELEITURA: O PIOR DEFEITO ESTAVA FORA DA CADEIA

A cadeia da IA e a camada de banco estavam lidas. A releitura começou por uma
varredura mecânica atrás da pergunta que mais achou coisa nesta sessão (*esse
valor está decidido em outro lugar também?*): linhas **idênticas** aparecendo em
três ou mais arquivos.

A maior parte era rotina (o `export const dynamic`, o `const sessao = await
lerSessao()`). Uma não era:

```
[13] const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
```

## 44. Dezesseis rotas do painel rodavam SEM LOGIN

O padrão inteiro era este:

```ts
const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
if (!negocioId) return Response.json({ erro: "sem sessao" }, { status: 401 });
```

Parece uma guarda. Não é. Enquanto o `NEGOCIO_PADRAO_ID` estiver no ambiente — e
está, o próprio `.env.example` manda pôr — a variável **nunca** é vazia, então o
401 nunca acontece e a rota roda sem sessão nenhuma, no tenant da padaria.

Este projeto não tem `middleware.ts`: cada rota se defende sozinha. Essa linha
era a defesa inteira.

### Medido contra a produção, sem escrever nada

Um POST sem cookie nenhum, com corpo inválido de propósito, só para a resposta
dizer até onde a requisição chegou:

```
POST /api/cliente/nota   (sem cookie, corpo invalido)  ->  400
GET  /api/conversas      (sem cookie)                  ->  401
```

O **400** é "corpo invalido": a requisição passou da checagem de sessão. Com um
corpo válido, teria escrito na ficha do cliente da padaria. O 401 do lado é uma
rota que faz a checagem certa (`if (!sessao) return 401`), e serve de controle.

### O que estava aberto

`whatsapp/desconectar` (derruba o WhatsApp da padaria), `whatsapp/ia`
(liga e desliga a Dora), `conversas/enviar` (manda mensagem em nome dela),
`conversas/assumir`, `conversas/anexo`, `conversas/template`,
`conversas/templates`, `conversas/ler`, `cobranca` e `cobranca/ativa`
(a cobrança automática), `marca/logo`, `midia/[id]` (a mídia de qualquer
mensagem), `cliente/nota`, `aviso` (×2) e `testar-ia`.

E a `whatsapp/embedded`, que grava o **token do WhatsApp** no tenant: ela lia a
sessão e caía no ambiente do mesmo jeito. É a mesma escrita do
`provisionar/route.ts`, que tem o motivo escrito no próprio cabeçalho — *"senão
qualquer um poderia apontar o atendimento da padaria para um número dele"* — e se
protege com segredo compartilhado.

### As quatro que podem dispensar a sessão, e por quê

| rota | o que a protege |
| --- | --- |
| `api/fila` | `Bearer PONTE_TOKEN` (a ponte da impressora não tem login) |
| `api/whatsapp` | assinatura HMAC da Meta |
| `api/whatsapp/provisionar` | `x-provision-secret` (vem do hub) |
| `api/cobranca/rodar` | exige sessão **ou** o token do relógio, na mesma linha |

O teste `rota-do-painel-exige-sessao.cjs` guarda essa lista: tirar uma dali é
dizer que ela passou a ter login, pôr uma nova é afirmar que ela tem outro
guarda. Isca provada: com o código de ontem, ele nomeia as dezesseis.

### O que isso ensina sobre a leitura

O defeito mais grave da sessão inteira não estava no cérebro nem no banco: estava
numa linha repetida em dezesseis arquivos que eu ainda não tinha aberto, e
apareceu numa varredura de **linhas idênticas**, não numa leitura linha a linha.

As duas coisas são necessárias. Ler acha o que está errado dentro de um arquivo;
varrer acha o que está errado por existir em muitos.


### E os outros dois repositórios?

Conferido, porque a regra é avisar do que falta nos outros arquivos também:

- **`enderecodigital-hub`**: tem `middleware.ts`, que gateia `/owner`,
  `/operacao` e `/parceiro` por papel antes de a rota rodar, e não usa o padrão
  do `NEGOCIO_PADRAO_ID`. Não tem esse defeito.
- **`site-enderecodigital`**: não usa `NEGOCIO_PADRAO_ID` em rota nenhuma.

O buraco era só do `painel-docepao`, e é justamente o repositório que **não tem
middleware**: cada rota se defendendo sozinha é o desenho que permite dezesseis
se defenderem errado do mesmo jeito.

**Vale considerar** (decisão sua, não fiz): um `middleware.ts` aqui também, que
exija sessão em tudo debaixo de `/api` menos a lista de quatro. Aí o defeito
deixa de ser possível em vez de ser proibido por teste.


## 45. A varredura seguinte: "TODA query filtra por negocio_id" é falso, e está tudo bem

Os cabeçalhos da camada de banco prometem, todos, que **toda** query filtra por
`negocio_id`. Varri as 29 queries que tocam tabela de tenant sem esse filtro, e
conferi uma por uma:

- **`negocios where id = $1`** (21 delas): o `id` do negócio **é** o tenant. O
  filtro é esse.
- **`pedido_itens where pedido_id = $1`** (4): o escopo vem da linha pai em
  `pedidos`, que o chamador já buscou com `negocio_id`. Nos dois casos que
  escrevem (`adicionarItem`, `salvarItensDoPedido`) a transação começa com
  `select id, status from pedidos where id = $1 and negocio_id = $2` e joga se
  não achar.
- **`update pedidos where id = $1`** (2): dentro de transação, depois da mesma
  verificação de dono.

**Nenhum vazamento entre tenants.** O que existe é a frase do cabeçalho dizendo
mais do que o código faz, e é o mesmo defeito de forma que esta leitura vem
corrigindo desde o começo: o próximo a ler acredita na frase e não confere o
caminho.

Não mexi no código porque não há o que consertar. Fica registrado que a garantia
real é **"o escopo vem do chamador, e todo caminho de escrita confere o dono
antes"**, que é uma promessa mais fraca e verdadeira.
