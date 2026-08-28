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
| 1 | `app/api/whatsapp/route.ts` | 1-949, sem buraco | **INTEIRO** — 6 defeitos |
| 2 | `lib/ia/fluxo/atender.ts` | 1-316, sem buraco | **INTEIRO** — 3 defeitos |
| 3 | `lib/ia/fluxo/fluxo.ts` | 520-740 | falta o resto (~1450) |
| 4 | `lib/ia/fluxo/leitura.ts` | os trechos que mexi | falta quase tudo |
| 5 | `lib/ia/fluxo/pensar-openai.ts` | 28-120 | falta o resto |
| 6 | `lib/ia/fluxo/produto.ts` | 1-200 | falta o fim |
| 7 | `lib/ia/fluxo/sabor.ts` | 1-196 e os trechos novos | falta conferir o meio |
| 8 | `lib/ia/fluxo/etapas.ts` | nada | não lido |
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
