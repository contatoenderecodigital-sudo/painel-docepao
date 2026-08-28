# ONDE PAREI

Escrito pra você ler de manhã, e pra sobreviver se a conversa compactar sozinha.
**Atualizado a cada arquivo terminado.** O registro técnico completo, defeito por
defeito, está no `LEITURA-DA-CADEIA.md`; aqui fica só o estado e o rumo.

---

## TUDO QUE FICOU PENDENTE, NUMA LISTA SÓ

Esta seção existe porque você perguntou, e a pergunta estava certa: *"quando tu
não corrige tu esquece, não sei se tu tá deixando algo pendente"*.

Estava tudo anotado, e estava **espalhado em doze lugares** de dois documentos
com 2.300 linhas. Espalhado assim, some. Agora está aqui, e o resto dos dois
documentos é o detalhe de cada um.

### 1. Decisões que são suas, não minhas

| o que | o problema | onde está o detalhe |
| --- | --- | --- |
| **Aviso do dia** | a dona escreve "sem pão após as 18h" e a IA nunca fica sabendo. No cérebro novo a fala é escrita em código, então não existe prompt onde enfiar o aviso | `LEITURA` item 39 |
| **Dispensar orçamento** | o banco sabe dispensar (`dispensarOrcamento`), e não existe botão em tela nenhuma. O filtro roda em toda carga da tela de Recuperar lendo uma lista que nunca enche | `LEITURA` item 45, e a lista do `nada-de-codigo-fantasma` |
| **Pedido sem dia de retirada** | a equipe resolve a pendência e não tem onde preencher a data. **O aviso já diz que falta o dia e por que importa** (28/08); falta decidir se entra um CAMPO de data ali | `LEITURA`, seção do `pedidos.ts` |
| **CRM: pedidos e dinheiro** | conta pedido `confirmado+aprovado+impresso` e soma dinheiro só de `aprovado+impresso`. Defensável, mas não está escrito, e a ficha mostra "3 pedidos, R$ 0,00" | `LEITURA` item pós-38 |
| **rota de preview pública** | `app/preview/atendimentos` serve a tela com dados falsos, sem login. Não vaza nada (é mock), mas o próprio comentário dela diz "apagar depois". Apagar, ou pôr atrás do login |
| **`middleware.ts` no painel** | hoje cada rota se defende sozinha, e foi por isso que dezesseis se defenderam errado do mesmo jeito. Um middleware faria o defeito deixar de ser possível, em vez de proibido por teste | `LEITURA` item 44 |

### 2. Coisas que eu vi, medi, e decidi NÃO mexer

Todas são risco latente, não defeito vivo. Conferi uma por uma.

| o que | por que não mexi |
| --- | --- |
| cinco `SELECT` quase iguais em `pedidos.ts` | conferi coluna por coluna: **hoje são idênticos**. Mexer sem defeito vivo é risco sem prêmio |
| sete cópias de "esta mensagem é do cliente" em SQL | idem: as sete são idênticas hoje |
| dezesseis cópias do normalizador de texto | estão nos quinze arquivos que eu **ainda não li**. Vão junto com a leitura |
| "TODA query filtra por `negocio_id`" é falso | varri as 29 que não filtram: nenhuma vaza entre tenants. O que existe é a frase dizendo mais que o código |

### 2b. Achados na leitura do `app/`, anotados e não consertados

| o que | por que não mexi |
| --- | --- |
| **login sem limite de tentativas** | o `bcrypt` já é lento, o que limita a força bruta, mas não há bloqueio. O hub tem limitador, o painel não tem nenhum. Precisa de um, e é peça nova |
| **`assinar`/`verificar` duplicados** | `app/sso/route.ts` e `lib/auth.ts` têm a mesma assinatura de sessão escrita duas vezes. Hoje idênticas; se uma mudar, a outra para de validar o cookie e ninguém descobre por erro, só por gente deslogada sem motivo |

### 2c. Sessão expirada nas AÇÕES: levantado, consertado só onde pesa

Contei **21 chamadas de ação** (salvar, mandar, trocar) em 8 componentes, e
**nenhuma** tratava o 401:

| componente | chamadas |
| --- | --- |
| `Atendimentos.tsx` | 8 |
| `AvisoDoDia`, `Clientes`, `LogoUpload`, `PainelConexao`, `PedidoMontado`, `Recuperar` | 2 cada |
| `ToggleIA.tsx` | 1 |

**Consertei o `PedidoMontado`**, que é o que edita pedido e mexe em dinheiro. O
resto ficou, e o critério foi este: no polling a tela **mente continuamente**
(mostra dado velho como se fosse novo); numa ação, ela diz "tente de novo", que
é um conselho ruim mas a pessoa percebe que falhou.

O helper já existe (`avisoDeSessao`), então cada um é uma linha. **Decisão sua**
se vale passar nos 20 restantes agora ou deixar pra quando alguém reclamar.

### 3. Consertos SEM isca automatizada, que precisam de olho humano

| o que | como conferir |
| --- | --- |
| **idempotência da impressão** | comportamento de banco com a ponte no meio. Vale conferir na próxima impressão de verdade |
| **fuso do card de recuperado do mês** | não consegui rodar `psql` contra a produção na hora (acesso negado). Consertei na forma certa nos dois cenários, mas vale olhar o número |

### 4. O que eu recomendo que VOCÊ faça, e leva minutos

1. **Abrir a tela de Resultados.** Os números mudaram hoje: as conversas de teste saíram do faturamento e da contagem de atendimento.
2. **Trocar `SESSION_SECRET` e `PONTE_TOKEN`** se algum dia foram commitados ou compartilhados. Não achei nenhum vazado, mas depois de dezesseis rotas abertas é barato fechar o assunto.

### 4b. A REGRA QUE EU APRENDI HOJE, E QUE VOCÊ PODE ME COBRAR

Três testes deste repositório cobravam a FORMA da regra em vez do efeito dela, e
os três mentiram:

| teste | o que ele cobrava | o que aconteceu |
| --- | --- | --- |
| `pergunta-uma-vez-e-nao-repete` | uma marca escrita à mão | **verde com o defeito no ar** |
| `o-bolo-de-festa-nao-fecha-sem-as-pecas` | uma marca que ninguém escreve | **verde com o defeito no ar** |
| `nada-fica-sem-ser-perguntado` | a expressão dentro de um arquivo | **reprovou sem defeito nenhum** |

Quando um teste precisa olhar o código em vez de rodá-lo, ele tem que cobrar que
a decisão **passe pelo dono dela**, e não o texto da decisão. Está escrito com
exemplo no `LEITURA-DA-CADEIA.md`, item 55.

### 5. O que falta LER, que é a missão principal

| | linhas | estado |
| --- | --- | --- |
| `lib/ia/` (cérebro) | ~7.600 | **lido**, 28 arquivos |
| `lib/banco/` | ~4.700 | **lido**, 11 arquivos |
| `app/` (rotas e páginas) | 3.922 | **lido**, 8 defeitos |
| `components/` (telas) | 8.129 | **falta** |

**Só falta `components/`.** São as telas, e é a maior pasta: 8.129 linhas.

O `app/` rendeu 8 defeitos em 3.922 linhas, e três deles eram de autenticação
(as dezesseis rotas, o SSO e o painel mostrando mock sem login). A pasta que
falta é de tela, então o risco muda de forma: menos segurança, mais "o que a
dona vê não é o que está no banco".

---

`:
sem a flag `m`, o `$` quer dizer fim da string, e o `.` do JavaScript não casa
com ``. **O comentário segue inteiro e o detector lê comentário como código.**
Estava assim até no `barra-comida-dentro-de-aspas`, o detector que pegou o
"shell come a barra" cinco vezes nesta sessão. Mesma família: caractere
invisível que desliga a regra sem dar erro.

---


## O QUE ESTÁ NO AR AGORA

Produção roda o commit **`a7cc1d1`**, confirmado pela imagem do container (nunca
pelo status do Coolify, que trava em `running:unknown`):

```
ssh -i ~/.ssh/id_ed25519_hub root@179.198.126.197 \
  "docker ps --format '{{.Image}}' | grep uyyqf7"
```

No ar estão **os dezoito primeiros arquivos, 105 defeitos**. O `informacao.ts`
(mais 6) está commitado aqui e ainda não subiu.

---

## A REGRA QUE EU ESTOU SEGUINDO

Ler cada arquivo do primeiro byte ao último, com estas cinco perguntas em cada
linha:

```
isso e uma lista e eu peguei so o primeiro?
esse import e usado mesmo?
esse comentario ainda descreve o que esta embaixo dele?
esse valor esta decidido em outro lugar tambem?
esse return larga alguma coisa pra tras?
```

A lista completa das perguntas que ACHARAM defeito, com quantas vezes cada uma
achou e o pior caso que pegou, está no `LEITURA-DA-CADEIA.md`, na seção **AS
PERGUNTAS QUE ACHARAM DEFEITO**. É por onde eu começaria uma releitura.

E três regras que a própria leitura ensinou, e que valem mais que as cinco:

1. **Lista minha, nunca.** Só o cardápio e os preços são fixos. Toda vez que
   apareceu uma lista de nomes escrita à mão, ela acertava o hoje e errava o
   amanhã.
2. **Medir antes de afirmar.** Nada entra no registro sem eu ter rodado.
3. **Isca em todo conserto.** Removo o conserto e confirmo que o teste fica
   vermelho. Teste que passa dos dois jeitos não prova nada.

---

## O PLACAR

| | |
| --- | --- |
| arquivos lidos inteiros | **28** do cérebro + **11** da camada de banco |
| defeitos consertados | **218** |
| testes no portão | **67**, todos verdes |
| `tsc` | limpo |
| cópias do normalizador de texto | de **16** para **6**, e nenhuma no fluxo da conversa |
| arquivos lendo o `catalogo.json` cru | de **17** para **9**, e nenhum do fluxo |

---

## O QUE FALTA LER

**O cérebro da conversa está lido inteiro.** Sobra a camada de banco e infra,
2.281 linhas em nove arquivos, que gravam e leem o que a conversa já decidiu:

    pedidos 575, conversas 512, negocios 335, atendimentos 212,
    tipos 176, db 122, alertas 84, uso 74, tipos-da-conversa 51

E quatro órfãos já achados nesses arquivos, anotados no
`nada-de-codigo-fantasma` numa lista que só pode encolher:
`RECADO_DA_EQUIPE`, `anexarFotoAoPedido`, `dispensarOrcamento`,
`reativarOrcamento`.

**A decisão combinada:** o cérebro fecha, mede-se uma conversa de verdade, e só
depois a infra. A infra não muda o que o cliente ouve.

--- | --- | --- |
| `lib/ia/persona.ts` | 223 | o jeito de falar |
| `lib/ia/texto.ts` | 178 | **eu escrevi nesta sessão e nunca reli.** Foi lá que eu introduzi o diminutivo que comia "docinho" |
| `lib/ia/dados/apelidos.ts` | 112 | como o cliente escreve o nome |
| banco e infra | 2.281 | `pedidos`, `conversas`, `negocios`, `atendimentos`, `db`, `tipos` |

---

## O QUE EU RECOMENDO QUANDO VOCÊ ACORDAR

**Medir uma conversa de verdade contra o banco.** Os 59 testes provam que 111
defeitos velhos não voltam. **Nenhum prova que a conversa melhorou.** Isso só
aparece rodando.

Os casos que os consertos tocaram e que só uma conversa inteira mostra:

- `dois bolos` — a regex que nunca casava
- `quanto é o cento de coxinha? quero 200` — perguntar apagava o pedido
- escrever na etapa da oferta em vez de apertar o botão — a etapa não tinha
  instrução nenhuma
- `bolo brigadeiro com 4 leites` — o segundo sabor que a regex barrava
- `não quero salgadinho` — a recusa que não era lida
- `50 xilofone` na primeira mensagem — não havia portão ali

---

## AS COISAS QUE EU ERREI NESTA SESSÃO, PRA VOCÊ SABER

Escrevo porque você pediu trabalho minucioso, e minucioso inclui isto.

- **Introduzi um defeito no arquivo 4 que só apareceu no 8.** A redução de
  diminutivo comia palavra de verdade: "docinho" virava "doco", "coxinha" virava
  "coxa". Funcionava enquanto os dois lados passassem pela mesma redução, e foi
  isso que escondeu.
- **Consertei um lado e criei um beco no outro.** Trocar o genérico do bolo na
  etapa sem trocar na fala fez a padaria perguntar o prato pra sempre.
- **Declarei dois arquivos lidos e escapou um import morto e uma leitura crua**
  do catálogo. Só apareceram quando eu medi quem ainda lê o JSON.
- **Escrevi três testes que reprovaram por defeito meu, não do código**: um
  pegava a linha do cabeçalho da comanda, outro deixava resto de byte ESC/POS na
  linha, e o terceiro extraía a função da fonte com `new Function` e quebrava no
  primeiro tipo de TypeScript.
- **Fiz uma arrumação que quebrou dois testes de verdade** e desfiz: não vale
  trocar duas guardas por uma chamada a menos numa função pura.
- **A barra invertida foi comida pelo shell quatro vezes.** Os detectores
  pegaram todas.

---

## COMANDOS

```
node testes/todos.cjs              o portão inteiro
npx tsc --noEmit -p tsconfig.json  o compilador
git log --oneline -20              o que eu fiz, um commit por arquivo
```


---

## 28/08/2026 — A CAMADA DE BANCO

Lidos inteiros: `lib/banco/conversas.ts` e `lib/banco/pedidos.ts` (a maior
parte). O padrão que apareceu é sempre o mesmo, e é o mesmo do cérebro: **a
mesma pergunta respondida em muitos lugares, e a maioria das respostas errada.**

### A unidade do item estava decidida em TREZE lugares

Seis no código do servidor, seis nas telas, e mais três escondidas dentro de
`coalesce(unidade, 'un')` em strings de SQL — onde nenhuma regra que olha
TypeScript enxerga, e onde `coalesce` só pega `NULL`, nunca o texto vazio.

Agora é `unidadeDoItem`, em `lib/tipos.ts`. E a que já existia em
`departamentos.ts` com o MESMO NOME virou `unidadeDoTicket`: são trabalhos
diferentes (uma responde sobre o valor, a outra sobre a linha do papel) e ter
duas funções de mesmo nome sobre o mesmo assunto é convite pra importar a
errada.

### A hora estava decidida em CINCO, e errava por doze horas

```
"as 16h30"           ->  null      pedido gravado SEM HORA
"1630"               ->  "16:00"   trinta minutos jogados fora, calado
"as 8h da noite"     ->  "08:00"   bolo pronto doze horas antes
"as 3h da tarde"     ->  "03:00"   tres da manha
"as 12h da noite"    ->  "12:00"   meio-dia em vez de meia-noite
"quero as 9 da manha" -> null      a padaria pergunta de novo
"99h"  (tela)        ->  "99:00"   hora que nao existe
```

O período do dia não entrava na conta em lugar nenhum do sistema.

### A data tinha um segundo interpretador, mais fraco

`parseDataRetirada("05/01")` devolvia `2026-01-05` — oito meses no passado.
Carimbava o ano corrente e pronto. Pedido feito em dezembro pro dia 5 de janeiro
nascia com a data do janeiro que já passou, e dezembro é justamente quando se
encomenda bolo de ano novo. O `dataDeRetirada` já resolvia isso desde o seu
teste de 23/08; ter um segundo parser na gravação desfazia aquele conserto na
última linha do caminho.

### A mensagem citada não fazia nada

Quando o cliente responde CITANDO uma mensagem antiga, o webhook montava o aviso
`[o cliente respondeu MARCANDO esta mensagem...]` e escrevia dentro do
`historico` — um array que, depois que o cérebro novo entrou, só era perguntado
se tinha alguma fala da padaria. **O texto que o modelo recebe é o `textoJunto`,
e nele nunca entrou nada disso.** O comentário prometia exatamente o defeito que
continuava acontecendo. Agora o aviso é grudado no texto que o cérebro lê.

Junto: o `carregarHistorico` carregava as 40 últimas mensagens INTEIRAS pra
responder um sim ou não, e o webhook fazia uma consulta a mais só pra preencher
um parâmetro que a função jogava fora com um `void` — parâmetro que não faz nada
é pior que código morto, porque quem lê a assinatura acredita nele.

### O `` do Windows desligava CINCO detectores

`linha.replace(/\/\/.*$/, "")` não tira nada quando a linha termina em `



## MAIS DUAS COISAS QUE EU ERREI HOJE

**Inventei uma janela de 12 horas.** Ao trocar o `carregarHistorico`, escrevi
"o corte de 12 horas é o mesmo que separa uma conversa da seguinte no resto do
sistema". Fui conferir: não existe corte nenhum desses no sistema. Era número
meu. Voltei pra janela que já existia (as últimas 40 mensagens) e deixei a
pergunta anotada em vez de decidida.

**Truncei o `departamentos.ts` até zero byte.** Um script meu abria o arquivo
pra escrita ANTES de terminar de montar o texto novo; o texto deu erro no meio e
o arquivo ficou vazio. Recuperado do git na hora, e o jeito de escrever
corrigido: monta tudo primeiro, abre depois. Vale a pena saber que aconteceu.

### Uma funcionalidade escrita pela metade, na tela de Recuperar

`carregarDispensados` roda em TODA carga da tela e filtra a lista por uma
relação que **nada no sistema consegue escrever**: `dispensarOrcamento` e
`reativarOrcamento` existem, estão corretas, e não têm nenhum chamador. Não há
tela, rota nem ação que dispense um orçamento.

Apagar as duas seria apagar código certo e deixar o `carregarDispensados` lendo
uma lista que nunca enche. Botar o botão é trabalho de tela.

**É decisão sua:** o botão "não cobrar mais este" entra na tela de Recuperar, ou
saem as três funções juntas. Enquanto isso elas ficam anotadas no
`nada-de-codigo-fantasma`, com o motivo escrito.

### Um pedido SEM DIA DE RETIRADA ainda entra na fila de aprovação

`registrarPedido` segura o pedido sem data, com o motivo escrito na tela. Mas
`resolverPendencia` recebe **só um item extra opcional, nunca uma data**: a
equipe lê "o cliente não disse o dia", clica pra resolver, e o pedido segue pra
aprovação com um tracinho no lugar do dia.

O conserto certo é um campo de data na ação de resolver pendência, obrigatório
quando falta. Travar o botão sem dar onde preencher seria trocar um defeito por
outro. Também é trabalho de tela.


### O pior achado do dia: a tela de Resultados contava os meus testes como venda

Medir contra a produção é regra desta casa. O preço disso é o painel saber
separar o instrumento do cliente, e ele não sabia:

- o **CRM** escondia cliente de teste, com a regra escrita dentro da própria
  query, e conhecendo só metade das faixas (o `55000000` da tela "Testar IA",
  não o `55119777700` das medições por linha de comando);
- a tela de **Resultados** (faturado, pedidos, atendimentos, respostas, horário
  de pico, produtos) **não filtrava nada**.

Cada conversa medida deixava um cliente na ficha com o nome que a conversa deu
("Marcos Alves", "Ana") e o pedido dela entrava no faturamento.

Agora a resposta mora em `lib/banco/so-cliente-de-verdade.ts` e as duas telas
usam a mesma. **Vale você abrir a tela de Resultados e conferir os números:** o
filtro age na leitura, então o histórico já deve aparecer limpo.


### O aviso do dia não chega na IA (e a tela promete que chega)

A dona escreve "sem pão após as 18h" em Configurações. O webhook não carrega
mais o `carregarTenant`, então **numa conversa de verdade esse aviso não
existe**. Pior: no cérebro novo a fala é escrita em código, então não há prompt
onde enfiar o aviso e esperar obediência.

**É decisão sua:** tirar o campo da tela, ou dar mecanismo de verdade pro aviso
(um fato que o código anexa, ou um produto marcado como indisponível hoje). O
raciocínio inteiro está no `LEITURA-DA-CADEIA.md`, item 39.


### O que já foi lido da camada de banco

`conversas.ts`, `pedidos.ts`, `parados.ts`, `clientes.ts`, `atendimentos.ts`,
`negocios.ts`, `db.ts`, `tipos-da-conversa.ts` — mais os arquivos que eles
puxaram junto (`departamentos.ts`, `cupom-escpos.ts`, `mock.ts`, `fila.ts`,
`resultados.ts`).

**Falta:** `montagem.ts` (522 linhas), e o restinho de `resultados.ts` e
`fila.ts` que eu li por cima ao seguir a unidade e a hora.


---

## 28/08/2026, FIM DA TARDE — O PIOR DEFEITO DA SESSÃO

**Dezesseis rotas do painel rodavam sem login.** Não é exagero e não é teoria:
medi contra a produção, sem escrever nada.

```
POST /api/cliente/nota   (sem cookie, corpo invalido)  ->  400
GET  /api/conversas      (sem cookie)                  ->  401
```

O 400 quer dizer "corpo invalido": a requisição **passou** da checagem de sessão.
Com um corpo válido teria escrito na ficha do cliente da padaria.

A causa é uma linha só, repetida em dezesseis arquivos:

```ts
const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
if (!negocioId) return 401;
```

Parece guarda e não é: com o `NEGOCIO_PADRAO_ID` no ambiente (e ele está, o
`.env.example` manda pôr), a variável nunca é vazia, o 401 nunca acontece, e a
rota roda no tenant da padaria sem sessão nenhuma. Este projeto não tem
`middleware.ts`, então essa linha era a defesa inteira.

**Estava aberto:** desconectar o WhatsApp da padaria, ligar e desligar a Dora,
mandar mensagem em nome dela, disparar a cobrança automática, trocar a logo, ler
a mídia de qualquer mensagem, escrever na ficha de qualquer cliente, e gravar o
token do WhatsApp no tenant.

**Consertado e no ar.** Quatro rotas continuam podendo dispensar sessão, cada uma
com o segredo que a protege (a ponte da impressora, o webhook da Meta, o repasse
do hub, e o relógio da cobrança), e um teste guarda essa lista.

### O que eu recomendo que você faça

1. **Troque o `SESSION_SECRET` e o `PONTE_TOKEN`** se eles alguma vez foram
   commitados ou compartilhados. Não achei nenhum vazado, mas rodar isso agora é
   barato e fecha o assunto.
2. **Olhe a tela de Resultados.** Os números mudaram hoje: as conversas de teste
   saíram do faturamento e da contagem de atendimento.
3. Nada mais precisa de você pra isso funcionar: a correção já está no ar e o
   painel logado continua igual.


### Conferido depois do deploy, contra a produção

Container rodando a imagem `3aef05f` (confirmado pelo SHA, não pelo status), e a
mesma sonda de antes:

```
api/cliente/nota      POST sem cookie  ->  401   (era 400: passava)
api/whatsapp/ia       POST sem cookie  ->  401
api/cobranca/ativa    POST sem cookie  ->  401
api/aviso             POST sem cookie  ->  401
api/marca/logo        POST sem cookie  ->  401
api/midia/[id]        GET  sem cookie  ->  401
```

Nenhuma dessas sondas escreveu nada: o corpo era inválido de propósito, então a
resposta só diz até onde a requisição chegou.

E nos outros dois repositórios: o `enderecodigital-hub` tem `middleware.ts` e não
usa esse padrão; o `site-enderecodigital` não usa `NEGOCIO_PADRAO_ID` em rota
nenhuma. O buraco era só do painel, que é justamente o repositório **sem
middleware**.


---

## A MEDIÇÃO DEPOIS DE TUDO

Duas conversas de verdade contra a produção, com o cérebro e o banco já lidos.

**Os consertos do dia passaram:** `dia 05/01` virou 05/01/**2027** (era 2026, no
passado), `as 3h da tarde` virou **15:00** (era 03:00), e as duas cores da
forminha sobreviveram ao "não esquece da rosa". Total batendo com o banco.

**E ela achou o que a leitura não achou.** Na segunda conversa eu não falei do
topo, do papel de arroz nem do prato — e a padaria fechou o pedido sem perguntar
nenhum dos três. Bolo de festa de 2 kg indo pra cozinha sem ninguém saber se
leva topo (que a equipe orça e tem prazo de dois dias) e sem saber o prato.

Consertado, com teste e isca. E o teste que existia pra proteger justamente isso
estava **verde com o defeito no ar**: ele cobria o formato da anotação, não o
comportamento.

### O que isso ensina

Em um dia, os dois piores defeitos vieram de fora da leitura linha a linha:

- o **login aberto** apareceu numa varredura de linhas idênticas;
- o **bolo sem as peças** apareceu numa conversa medida.

Ler acha o que está errado dentro de um arquivo. Varrer acha o que está errado
por existir em muitos. Medir acha o que está errado **entre** os arquivos, que é
onde o cliente vive.

**Recomendação pra continuar:** alternar os três. A metade que falta ler
(telas e rotas, ~12.000 linhas) merece a leitura, mas depois de cada bloco vale
uma varredura e uma conversa medida.


---

## A DECISÃO DO PRATO, E O QUE MUDOU NA CONVERSA

Você decidiu **tirar a pergunta do prato**. O que motivou foi a medição: com o
conserto no ar, a padaria passou a perguntar as três coisas do bolo, e o cliente
ignorou as três e mandou "pode confirmar". O pedido foi pra fila assim:

```
status|data|hora|pendencia|motivo|esperando_cliente
confirmado|12/09/2026|10:00|f|-|f
```

Sem prato, sem topo, sem papel, e **sem nenhuma marca de que falta algo**. Pra
topo e papel tudo bem, são opcionais. Pro prato não, porque todo bolo vai em
algum prato.

**Como ficou a conversa:** ela pergunta o topo e o papel de arroz, e não pergunta
o prato. Se o cliente falar do prato por conta ("prato aberto", "manda com
tampa"), continua sendo anotado e sai na comanda igual.

**O que sobra da sua parte:** nada. Está no ar e testado.

### Uma coisa que eu melhorei na ferramenta, e vale saber

O medidor não mostrava o **cabeçalho** do pedido, só os itens. Foi por isso que
o "fechou sem nada e sem aviso" quase passou: os itens ficam bonitos, e a
pergunta que importa (foi pra fila ou pra pendência? com data? com hora?) não
tinha como ser respondida sem abrir o banco na mão. Agora ele mostra, e isso
paga em toda medição daqui pra frente.


---

## EU DISSE QUE ESTAVA RESOLVIDO E NÃO ESTAVA

Preciso registrar isso porque é o tipo de coisa que some da memória e não devia.

Consertei a etapa do bolo, medi, e **te disse que estava resolvido**. Rodei a
mesma conversa uma terceira vez e o **topo continuava sem ser perguntado**: a
etapa vizinha (a das peças) tinha o defeito idêntico, e eu não olhei.

É a nona pergunta da minha própria lista, *"eu consertei um lado dessa regra em
outro arquivo?"*, que eu escrevi ser a mais cara de ignorar. Ignorei no mesmo dia.

E ao consertar quase criei um terceiro defeito: a fala ficou presa repetindo o
papel de arroz. Peguei antes de subir porque medi de novo em vez de confiar.

### O que eu mudo daqui pra frente

**Conserto medido uma vez não é conserto verificado.** As três medições da mesma
conversa acharam três coisas diferentes:

| medição | o que ela achou |
| --- | --- |
| 1ª | o bolo fechava sem prato, topo e papel |
| 2ª | consertado o bolo, o pedido fechava sem aviso nenhum pra equipe |
| 3ª | consertado o bolo, a etapa vizinha tinha o mesmo defeito |

**E defeito de forma quase nunca está num lugar só.** Depois de achar, a pergunta
não é "consertei?", é **"onde mais isso está escrito assim?"**. Foi o que achou
as treze cópias da unidade e as cinco da hora, e teria achado essa etapa vizinha
na hora.


---

## O CICLO DO BOLO, FECHADO (28/08/2026)

Quinta medição, e agora está certo:

```
padaria >> E papel de arroz, com a foto impressa no bolo? Fica R$ 12,00.
cliente >> dia 12/09 as 10h, nome Ana Paula, pix          (ignorou)
padaria >> Só faltam os detalhes do bolo: quer papel de arroz (R$ 12,00),
           e quer topo de bolo?
cliente >> pode confirmar                                  (ignorou de novo)
padaria >> Pronto, seu pedido foi pra fila da equipe da padaria.

status=confirmado  data=12/09/2026  hora=10:00  total=R$ 218.80  pendencia=nao
```

Os dois foram **oferecidos**, e o cliente escolheu ignorar. Aí o pedido fecha,
que é a regra de 25/08 pra conversa não morrer num detalhe. Antes de hoje o topo
e o papel nunca eram perguntados.

### O ciclo inteiro, sem enfeitar

| medição | o que ela achou |
| --- | --- |
| 1ª | o bolo fechava sem prato, topo e papel |
| 2ª | consertei o bolo; o pedido fechava sem aviso nenhum pra equipe |
| 3ª | consertei um lado só; a etapa vizinha tinha o mesmo defeito |
| 4ª | **meu conserto quebrou o fechamento**: o pedido parou de ser registrado |
| 5ª | oferece os dois, e fecha |

**Cinco medições, três defeitos meus no meio.** O que me tirou do buraco não foi
cuidado: foi medir de novo toda vez em vez de acreditar no conserto, e escrever
um teste que pergunta ao código qual é a marca em vez de eu escrever à mão.
