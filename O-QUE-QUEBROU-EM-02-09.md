# O que quebrou no teste dele de 02/09/2026, e o que estou fazendo

Ele testou a producao conversando, e a conversa levantou **sete defeitos**. Este
arquivo e o registro do que foi achado, do que ja esta consertado e do que
falta. Escrito porque ele pediu: *"anota e me diz tudo q tu ta fazendo"*.

Nao ha "falta pouco" aqui. Cada item diz o estado de verdade.

---

## A CONVERSA QUE ACHOU TUDO

```
16:12  cliente >> quero bolo, salgados, docinhos e cupcakes
16:12  padaria >> De que cor voce quer a forminha dos docinhos?
16:12  cliente >> lilas
16:12  padaria >> Agora os docinhos: quais voce quer?
...
16:19  cliente >> dia 02/05
16:20  cliente >> 7hs
16:20  cliente >> Camila
16:21  cliente >> Cartao
16:22  padaria >> Qual salgado voce quer?          <- depois do pagamento
16:24  cliente >> quais tem?
16:24  padaria >> Do jeito que esta, seu pedido fica em R$ 77,65.
```

O rascunho gravado no banco, no fim disso:

```json
[{"produto":"salgado","categoria":"outro","qtd":1},
 {"produto":"brigadeiro","qtd":1},
 {"produto":"beijinho","qtd":1},
 {"produto":"bolo bombom","qtd":1,"unidade":"kg"},
 {"produto":"papel de arroz","qtd":2}]
retirada_data: 02/05/2027
```

Ele nao disse quantidade de coisa nenhuma, e o pedido fechou com um de cada.

---

## OS SETE, E O ESTADO DE CADA UM

### 1. Quantidade chutada em todo produto  [FEITO]

O rastro da producao:

```
modelo leu: 1x bolo ;; 1x salgado ;; 1x docinho ;; 1x cupcake
```

O modelo devolvia `qtd 1` quando o cliente nao dizia numero, e `1` e
indistinguivel de "ele disse um". A instrucao que manda devolver `0` quando nao
foi dito **so existia dentro da festa**. E a guarda que cobra a quantidade que
falta **so olhava produto vendido por quilo**: quem e por unidade (coxinha,
brigadeiro, cupcake) passava com o chute.

Regra dele: *"sempre que pedir coisa de KG ou UNID de qualquer produto tem q
pedir pra pessoa qual a quantidade... PRA TODOS OS PRODUTOS"*.

**As duas metades, e nenhuma serve sozinha:**

- `lib/ia/fluxo/leitura.ts`: a instrucao "quantidade nao dita = qtd 0, nunca 1"
  vale em TODA etapa, inclusive na **abertura**, que e por onde todo pedido
  entra e onde ela nao existia.
- `lib/ia/fluxo/etapas.ts`: `faltaPeso` virou `faltaQuantidade` e cobra item em
  zero em **qualquer unidade**. Ligada tambem no salgado e no docinho, que nao
  olhavam quantidade nenhuma.

**O "ou concordado" dele e a festa.** Ali o total saiu da proposta que ele
aceitou e o codigo reparte; perguntar de novo seria pedir duas vezes.

Teste: `testes/nenhum-item-fecha-sem-quantidade.cjs`, 7 casos, isca medida
(3 ficam vermelhos com a guarda antiga).

### 2. O cupcake foi apagado do pedido  [FEITO]

```
TIREI DO PEDIDO, nao existe no cardapio: 1x cupcake
```

Existem quatro cupcakes no cardapio. O que derrubou foi a guarda que impede
produto inventado, e ela estava certa em desconfiar: "cupcake" nao e nome de
produto (os produtos sao "cupcake pequeno", "cupcake grande"). E **nome de
familia**, e a lista de nomes de familia esta escrita a mao em
`lib/ia/fluxo/generico.ts`, com cinco nomes.

O cardapio tem **quinze grupos**. O relatorio `CARDAPIO.md`, gerado pelo mesmo
leitor que a IA usa, mostra o tamanho do buraco:

```
86 produtos, 15 categorias, 4 familias reconhecidas.
```

Nove categorias sem familia: cupcake, torta_fria, torta_recheada, empadao,
bolo_salgado, franciscano, calzone, padaria, adicional_bolo.

**O conserto e a lista sair do catalogo**, e nao eu digitar ela. O dia em que a
dona cadastrar um grupo novo, ele entra sozinho. A maquina ja tem onde receber
esses produtos: a etapa `resto_do_cardapio` foi feita pra isso.

### 3. Nunca perguntou quantas pessoas  [FEITO]

Pedir bolo + salgados + docinhos + cupcakes e um pedido de festa em qualquer
padaria. Mas o codigo so liga o modo festa se o cliente **disser a palavra**
("festa", "aniversario") ou **der um numero de gente**.

Como nao virou festa, **a proposta inteira nao aconteceu**, e e ela que resolve
o peso do bolo, as quantidades e a ordem das perguntas.

**Decisao dele, 02/09/2026: perguntar, sem chutar.** Quando o cliente cita dois
ou mais grupos sem quantidade nenhuma, a padaria pergunta:

> E pra alguma festa ou evento? Se for, me diz pra quantas pessoas que eu ja
> monto uma sugestao com tudo e o valor.

Se ele disser que sim, abre a proposta. Se disser que nao, vai item a item. O
codigo nao decide que e festa: ele pergunta o que nao tem como saber sozinho.

### 4. Perguntou o salgado depois do pagamento  [FEITO]

Consequencia do 3. Sem a proposta, cada familia virou uma pergunta solta e o
salgado ficou por ultimo, saindo depois da confirmacao. Com a festa detectada, a
ordem volta a ser a do roteiro.

### 5. Forminha perguntada antes de "quais docinhos"  [FEITO]

A cor da forminha saiu antes de o cliente escolher os docinhos. Ordem invertida:
escolhe o doce, depois a cor.

### 6. "dia 02/05" virou 02/05/2027  [FEITO]

O modelo leu `02/05/2026`, maio ja passou, e a guarda que impede data no passado
rolou pra 2027. Nao esta no passado, mas o pedido ficou agendado pra **daqui a
oito meses**. Padaria nao agenda com oito meses: ela tem que perguntar, e nao
adivinhar o ano.

### 7. "quais tem?" respondido com o preco  [FEITO]

Ele perguntou quais salgados existem e ouviu "seu pedido fica em R$ 77,65".

---

## O MINIMO DA DONA, que ele cobrou junto

Os audios tem, e o catalogo tambem (`_minimo_por_sabor`): **20 por sabor**, 5
sabores no cento, **sugerir e nunca recusar**. Tambem estao nos audios: bolo a
100 g por pessoa, empadao de 1 kg serve 8 a 10 pessoas, pizza sem peso minimo,
cartao em ate 3 vezes.

O que esta errado nao e o dado: e **quando** ele e usado. Hoje a sugestao dos 20
so sai quando FOMOS NOS que dividimos a festa. Quando o cliente diz as
quantidades, ninguem sugere nada. E a mesma doenca das outras: regra que vale
pra um caminho e nao pra todos.

---

## COMO CONFERIR O CARDAPIO A QUALQUER MOMENTO

```
node scripts/ver-cardapio.mjs            na tela
node scripts/ver-cardapio.mjs --md       vira CARDAPIO.md
```

Ele le pelo MESMO caminho que a IA (`produtosDaCasa()`), e nao pelo JSON cru. Se
o relatorio mostrar uma coisa e a padaria fizer outra, o defeito esta no leitor,
que e exatamente o que se quer de uma conferida.

---

## O PADRAO DA LOJA, escrito por ele e cobrado nos 86 produtos

Ele fechou a regra em 02/09/2026, e ela vale pro cardapio inteiro:

1. Produto **sem sabor, ou com um so**: nao pergunta sabor.
2. Produto com **mais de um sabor**: e obrigatorio perguntar qual.
3. **Sempre** perguntar a quantidade, na unidade do produto (kg ou unidade).
   Quantidade ficticia nao passa.
4. A ordem e essa: primeiro o sabor, quando for necessario, depois a quantidade.
5. **Bolo de festa** passa por topo e papel de arroz. **Bolo caseiro nao**: a
   dona chama isso de "bolo decorado" no audio DOCEPAORESPOSTASDONA (1), e
   caseiro nao e decorado.
6. **Bolo de festa aceita 2 sabores no maximo**, e o preco e o do mais caro.
7. A pizza tem a regra dela: **de forma (inteira) ate 4 sabores**, R$ 120,00,
   serve 6 a 8; **meia** ate 2, R$ 60,00; **redonda** ate 2, R$ 41,90 o quilo.
   Sao 31 sabores, 21 salgados e 10 doces.

**A prova nao e a minha palavra.** `testes/o-padrao-da-loja-vale-pro-cardapio-inteiro.cjs`
varre os 86 produtos, um a um, e cobra os seis pontos. Com o conserto da
quantidade desligado, **54 produtos** fecham sem quantidade; com o do bolo
desligado, **15 bolos caseiros** voltam a ser perguntados de topo. Foi medido
nos dois sentidos.

Nao e teste de exemplo: regra que vale "em quase todos" e a que produz o pedido
errado justo no produto que ninguem lembrou de testar. Foi assim que o cupcake e
a mini bolha doce passaram.


---

## FECHAMENTO, 02/09/2026 A NOITE

**Os sete estao fechados**, mais os seis da auditoria dos arquivos e mais dois
que apareceram no caminho (o sabor disputado entre grupos e o sabor dito dentro
de uma etapa). Portao em **165 verdes**, build limpo, cada conserto commitado
sozinho e com isca medida.

### O QUE ESTA COBERTO POR VARREDURA HOJE

| onde | o que e cobrado | produtos |
| --- | --- | --- |
| conversa | sabor, quantidade, ordem, pecas do bolo | 86 |
| fechamento | nao registra sem sabor nem sem quantidade | 86 |
| painel | concorda com a conversa em sabor e unidade | 86 |
| salvar do painel | nada sai calado | 6 casos |
| papel da cozinha | chega inteiro, com unidade certa | 86 |
| sabor por etapa | o sabor dito cai na familia da etapa | 47 combinacoes |
| familias | nenhuma categoria fica inalcancavel | 15 categorias |

Antes de 02/09/2026 so a primeira linha existia.

### DUAS FALHAS MINHAS NO CAMINHO, registradas porque se repetem

**O shell comeu a barra invertida pela terceira vez.** O `` de uma regex virou
byte de backspace (0x08) e ela nunca casaria. Achado olhando os bytes com
`cat -A`; lendo o codigo parecia perfeito.

**Uma isca nao mediu nada.** Na guarda da data, troquei um texto que nao existia
no arquivo: o teste ficou verde com o conserto desligado e eu quase dei por bom.
So peguei porque desconfiei do verde. Isca que nao acende nao e prova.

### O QUE FALTA, e nao e codigo

- **testar conversando com a producao.** 165 testes verdes nao sao uma conversa.
- **o numero da padaria na Meta**, que so ele pode fazer.
- **as perguntas da dona** em `PERGUNTAR-PRA-DONA.md`, sendo o nome da conta do
  pix a unica que muda o que o cliente le hoje.
- **a conversa 7 da matriz** (audio e foto), que depende de um audio de verdade.
