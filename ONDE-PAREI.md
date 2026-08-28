# ONDE PAREI

Escrito pra você ler de manhã, e pra sobreviver se a conversa compactar sozinha.
**Atualizado a cada arquivo terminado.** O registro técnico completo, defeito por
defeito, está no `LEITURA-DA-CADEIA.md`; aqui fica só o estado e o rumo.

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
| defeitos consertados | **186** |
| testes no portão | **66**, todos verdes |
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
`:
sem a flag `m`, o `$` quer dizer fim da string, e o `.` do JavaScript não casa
com ``. **O comentário segue inteiro e o detector lê comentário como código.**
Estava assim até no `barra-comida-dentro-de-aspas`, o detector que pegou o
"shell come a barra" cinco vezes nesta sessão. Mesma família: caractere
invisível que desliga a regra sem dar erro.

---

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
