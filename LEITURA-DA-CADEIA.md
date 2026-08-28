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
| 9 | `lib/ia/fluxo/pergunta.ts` | 538-660 | falta quase tudo |
| 10 | `lib/ia/fluxo/fechar.ts` | 60-152 | falta o resto |
| 11 | `lib/ia/orcamento.ts` | 450-510 | falta quase tudo |
| 12 | `lib/banco/montagem.ts` | 114-155, 368-392 | falta quase tudo |
| 13 | `lib/ia/fluxo/gravar.ts` | nada | não lido |
| 14 | `lib/banco/fila.ts` + `lib/cupom-escpos.ts` | fila 100-140, cupom 200-260 | falta quase tudo |

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
