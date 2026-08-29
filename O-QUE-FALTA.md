# O que falta fazer

Arquivo vivo do painel da Doce Pão. Atualizado em 26/08/2026.

Regra dele: **não dizer "falta pouco".** Dizer o que está feito e o que está
aberto, com nome, e com a prova ao lado quando houver.

---

## ONDE PARAMOS

### O cérebro antigo acabou

**13.950 linhas apagadas em 26/08/2026.** Não existe mais `cerebro.ts`, nem
`guardas.ts`, nem a queda automática para o cérebro velho quando o fluxo falha,
nem a chave que ligava um ou outro.

| apagado | linhas |
| --- | --- |
| `lib/ia/cerebro.ts` | 7.397 |
| `lib/ia/guardas.ts` | 1.944 |
| `lib/ia/produtos.ts` (o enum que só ele usava) | 87 |
| o galho velho de `app/api/whatsapp/route.ts` | 284 |
| 32 testes que olhavam código morto | 4.238 |

Sobraram **6.667 linhas de IA, todas vivas.** O levantamento das 34 regras que o
velho protegia, com o veredito de cada uma, está em `O-QUE-O-VELHO-PROTEGIA.md`.

### O portão

```
node testes/todos.cjs
```

**83 testes, 83 verdes, em dois minutos, e nenhum fala com a rede.** (Eram 33 em 26/08.) Antes ele
travava mais de meia hora num teste de SSH e as trinta provas seguintes nunca
rodavam.

Os que falam com o VPS ou com produção saíram para instrumento, e rodam na mão:

```
node testes/pausa-nao-vaza.cjs
node testes/qa-conversa.cjs
node testes/qa-concorrencia.cjs
node testes/guardar-conversas.cjs
node testes/qa-pedido-completo.cjs     (abre navegador, cria pedido de verdade)
```

### Os quinze defeitos de dinheiro consertados em 26/08/2026

Todos medidos, nenhum deduzido.

| o cliente pede | a padaria cobra | o sistema cobrava |
| --- | --- | --- |
| bolo de café | R$ 35,90 | R$ 1,25, cotava o **docinho** |
| bolo prestígio com ganache | R$ 33,90 a un | R$ 46,90 o **quilo** |
| bolo banana caramelizada | R$ 30,90 | R$ 34,90, cotava a **laranja** |
| cupcake pequeno recheado | R$ 3,00 | R$ 2,00 |
| cupcake grande recheado | R$ 7,00 | R$ 5,00 |
| bolo misto com **biz** | R$ 49,90/kg | R$ 46,90/kg |
| `docinho` sem escolher qual | precisa perguntar | churros a R$ 1,75 |
| `salgado` sem escolher qual | precisa perguntar | assado a R$ 1,25 |
| papel de arroz, quem manda tudo de uma vez | R$ 12,00 | nunca era oferecido |
| pastel doce de banana | R$ 1,25 | R$ 1,00, e ia pra bancada do **salgado** |
| `"papel não"` na resposta juntada | não cobra | **cobrava** os R$ 12 |

E quatro que a padaria perdia sem ser direto em dinheiro:

- **o dia da semana não virava data**: quem escrevia "pra quarta-feira" era
  perguntado da data de novo, depois de já ter respondido
- **a forma de pagamento pegava a primeira da lista**, não a última que o cliente
  falou. Já tinha ido para produção em 19/08 com o pedido fechando em pix para
  quem corrigiu para cartão
- **restrição de dieta virava promessa na comanda**: "30 brigadeiro (sem
  lactose)" fazia a cozinha produzir brigadeiro comum e o cliente ler "sem
  lactose" na confirmação. Isso deixa de ser prejuízo e vira saúde
- **o item citado na frase perdia um turno**, e nos pedidos de duas mensagens
  isso quer dizer que o pedido **nunca era registrado**

### A bateria dos cinco jeitos

**`pass^5` = 5 de 5**, medido em 26/08/2026 no commit `1931c05`, que é o que
está no ar. Vinte e cinco execuções, vinte e cinco acertos.

O cenário 3 ("três respostas na mesma frase") era o único vermelho desde antes
desta sessão, e fechou.

O caminho do dia: começou em 4/5 com dois cérebros no repositório, foi a **0/5
em tudo** quando a demolição expôs os buracos que o cérebro velho escondia, e
terminou em 5/5. O mergulho não foi acidente: apagar o velho tirou as proteções
que mascaravam defeitos do fluxo, e cada um apareceu, foi medido e consertado.

```
node testes/uma-conversa-contra-o-banco.cjs    <- SEMPRE antes
node testes/medidor.cjs 5 "cinco jeitos"
```

---

## FECHADO EM 27/08/2026

**A festa foi medida contra o banco e fecha certa.** Sete linhas, R$ 592,75,
status confirmado. A base bateu (250 salgados e 125 docinhos para 25 pessoas) e
a regra do bolo misto cobrou o mais caro dos dois sabores, R$ 55,90 e não
R$ 46,90. Falas em `mede-uma-conversa.cjs`, que agora recebe o roteiro de um
`.json` em vez de ter as falas chumbadas.

**O limite de sabor da pizza passou a existir.** `sabores_ate` estava no
catálogo desde sempre e ninguém lia: a redonda fechava com cinco sabores e a de
forma com seis. A trava vai com a pergunta junto, devolvendo os sabores que o
cliente falou para ele marcar os que cabem.

**O churros parou de custar vinte vezes.** `docinho de churros` é o único dos
doze docinhos com prefixo no nome, e a palavra sozinha não o alcançava:
resolvia para `bolo caseiro churros`, R$ 34,90 no lugar de R$ 1,75. O conserto é
de classe, então vale para qualquer nome comprido que a dona cadastrar.

### A AUDITORIA DO CATÁLOGO, CAMPO POR CAMPO

Dos 35 campos do catálogo, **30 têm o nome citado em algum lugar do código e 5
não têm nenhum**. A ressalva importa: nome citado não prova uso correto, que é
exatamente como o `sabores_ate` passou despercebido por semanas.

Os cinco mortos:

| campo | o que guarda | vale mexer? |
| --- | --- | --- |
| `valor_tipico` | pizza redonda sai **entre R$ 35 e R$ 45** | **sim** |
| `sabores_por_cento_sugeridos` | 5 sabores no cento | a conferir |
| `sempre_pedir_humano` | entrega é da equipe | o comportamento existe, mas chumbado no código |
| `tem_aplicativo` | não tem aplicativo de entrega | informativo |
| `peso_minimo` | `null` | não guarda nada |

O `valor_tipico` é buraco de verdade: a redonda é vendida **por peso**, então o
cliente não tem como saber quanto vai pagar, e o catálogo sabe a faixa.

---

## PRIORIDADE MÁXIMA: CORTAR PELA RAIZ

Decisão do dono, 27/08/2026, depois de me pedir a lista do que eu tinha
declarado e não aplicado: *"vamo começar a corrigir da raiz, cortar o mal pela
raiz"*.

O padrão que gerou quase todo defeito de dinheiro deste projeto é sempre o
mesmo: **o mesmo assunto decidido em dois lugares.** Duas listas de produto,
dois vocabulários de categoria, duas implementações de cor. Elas nunca nascem
divergentes; elas divergem depois, caladas, e o defeito aparece meses adiante.

A ordem abaixo é por raiz, e não por sintoma.

### 1. Sete arquivos ainda remontam o catálogo cru  ⟵ A RAIZ

```
app/api/cardapio/opcoes/route.ts    salgados, doces, bolos, pizza
lib/ia/orcamento.ts                 salgados, bolos_recheados, pizza
lib/ia/fluxo/leitura.ts             salgados, doces, bolos_recheados
lib/ia/fluxo/informacao.ts          salgados, doces, bolos_recheados
lib/ia/fluxo/fluxo.ts               salgados, bolos_recheados
lib/ia/fatos.ts                     pizza, outros_produtos
lib/banco/montagem.ts               pizza
```

É a doença que fez o bolo de café custar R$ 1,25 e o churros R$ 34,90. **Cada
migração feita até aqui achou defeito que ninguém sabia que existia**, então a
migração não é arrumação: é o método que acha os defeitos.

**Medir a divergência ANTES de trocar**, sempre: o que o arquivo decide hoje
contra o que a lista única diz. O que divergir é defeito vivo.

### 2. Dois vocabulários de categoria

A lista única diz `docinho`, o banco grava `doce`, e `departamentos.ts` mantém
uma tabela de tradução de vinte linhas costurando os dois. Enquanto existirem
dois, toda regra nova precisa saber os dois.

### 3. O sabor que ela não achou some

A frase já foi consertada ("não achei chocolate no cardápio" em vez de "a gente
não faz"), mas o sabor pedido não fica registrado em lugar nenhum. A dona disse
*"se o cliente pedir outro sabor, a gente vai colocando"*, e pra ir colocando
ela precisa VER o que pediram.

### 4. O leitor da frase lê quantidade depois do nome

`"muda a coxinha pra 100"` atualiza a quantidade mesmo quando o modelo está em
outra pergunta e devolve o item velho, ou não devolve item nenhum.

### 5. As duas pequenas, já nomeadas

`obs: metade` indo como lixo pra comanda. O `valor_tipico` da pizza redonda
passa na pergunta de preço: costuma sair entre R$ 35 e R$ 45.

---

## O QUE FAZER AGORA, em ordem

### 1. Migrar o `sabor.ts` para a lista única

**Feito.** Quem pede escolha sai de `saborFixo` e `sabores[]`. As cores da
forminha tambem: `coresDoCardapio()` mora na lista unica. O JSON cru saiu do
`sabor.ts`.

As quatro divergencias medidas (empadão com palmito, torta fria com palmito,
pizza inteira, pizza meia) perguntam.

A bateria está em **5 de 5** e não há vermelho conhecido. O próximo passo é o
item de padronização de maior valor, e as quatro divergências já estão medidas
logo abaixo.

**Medir sempre nesta ordem, antes e depois:**

```
node testes/uma-conversa-contra-o-banco.cjs
node testes/medidor.cjs 5 "cinco jeitos"
```

**A ORDEM IMPORTA, e ignorá-la custou caro em 26/08.** Rodei duas baterias de 25
minutos antes de mandar uma conversa só. As duas devolveram 0/5 em tudo, sem
dizer por quê; a conversa única deu a resposta em dois minutos, **três vezes
seguidas**.

O que só a conversa única mostra: a **montagem** ficava certa, com os quatro
itens e as observações, e o `pedido_itens` ficava **vazio**. Nenhuma nota de
bateria mostra essa diferença.

**Não medir com deploy no meio:** cada mensagem pega uma versão diferente e o
resultado sai misturado.

### 2. Terminar a padronização do catálogo

O achado que define o trabalho: eram **dezessete** arquivos importando
`catalogo.json` direto, cada um remontando a estrutura do seu jeito.

**Já ligados na lista única** (`lib/ia/dados/produtos.ts`):

- o motor de preço (`lib/ia/orcamento.ts`)
- a categoria do produto no fluxo (`lib/ia/fluxo/fluxo.ts`)
- `categoriaDoPedido` e `unidadeDoPedido`, que vieram do cérebro apagado

**Faltam os leitores que ainda remontam o JSON** (orcamento monta o motor,
fatos.ts, rotas de cardapio). Um por vez, com a foto de preco no meio.

Já comparei os dois, em 26/08/2026, antes de migrar: **82 dos 86 produtos
concordam.** As quatro divergências são todas na mesma direção (a lista única
diz que tem que perguntar, o `sabor.ts` não pergunta) e **duas são defeito de
verdade**:

| produto | o que a lista única sabe | o que acontece hoje |
| --- | --- | --- |
| `empadão com palmito` | 2 sabores: `palmito` ou `frango com palmito` | não pergunta |
| `torta fria com palmito` | os mesmos 2 | não pergunta |
| `pizza inteira` | **31 sabores** | não pergunta |
| `pizza meia` | os mesmos 31 | não pergunta |

O palmito não é perguntado porque a palavra já está no **nome do produto**, e o
código acha que o sabor foi escolhido. São coisas diferentes na cozinha.

A pizza não é perguntada porque ela **não está na lista** que o `sabor.ts`
consulta (`comEscolha()` lê `outros_produtos`, e a pizza é chave de primeiro
nível no catálogo). A cozinha recebe pizza sem sabor.

Migrar o `sabor.ts` conserta os quatro de uma vez, e conecta com a pergunta da
pizza do item 3.

**Depois dele, os outros treze**, um por vez, com a foto rodando entre cada um:

```
node testes/o-catalogo-nao-mudou-preco.cjs
```

Ela fotografa preço, unidade, categoria e casamento de nome dos 83 produtos.
Refazer a foto só com `--tirar-foto`, e só depois de olhar o que mudou.

**E os dois vocabulários de categoria continuam de pé.** O orçamento diz
`salgado`, `doce`, `bolo_recheado`; o pedido e a comanda dizem `salgado_frito`,
`docinho`, `bolo_festa`. Hoje a tradução é uma tabela visível de quatro linhas
em `lib/ia/orcamento.ts` (`CATEGORIA_NO_ORCAMENTO`), em vez de estar espalhada.
Unificar de vez **muda a comanda de cozinha**, então precisa da foto verde antes
e depois.

### 3. As regras que a dona falou e a IA não sabe

Citação de origem em `O-QUE-A-DONA-FALOU.md`. Decisões do dono em 26/08:

**FEITO em 26/08:**

- **Prazo do topo.** Já estava, em `falas-do-cliente.ts` (`prazoDoTopoAperta`),
  usado por `fechar.ts` e `pergunta.ts`.
- **Desconto e beneficente.** Virou assunto próprio em `informacao.ts`. A IA
  responde *"deixa eu ver a possibilidade de um desconto e já te retorno"* e
  **chama a equipe**, sem dizer os valores. Está medido que a resposta não tem
  número nenhum: soltar o preço por unidade transforma negociação em tabela.
- **Parcelamento.** Já estava certo e não precisou de nada: ela só fala em 3x
  quando perguntam da forma de pagamento, e a etapa do pagamento oferece Pix,
  Cartão e Dinheiro sem citar parcela. É a regra do dono, *"só oferece parcelado
  se o cara pedir"*.
- **Entrega sempre chamar gente.** Em `informacao.ts`, coberto por
  `testes/as-regras-da-casa-no-fluxo.cjs`.
- **Comanda separada por segmento.** Estava listado aqui como pendente e **já
  estava pronto**, em `lib/departamentos.ts` e `lib/cupom-escpos.ts`: treze
  segmentos, um por tipo de produto, na ordem da produção. Verificado em
  27/08/2026 imprimindo a festa medida, que sai em quatro papéis:

  ```
  == DOCINHOS ==   café, docinho de churros, brigadeiro, beijinho
  == BOLO FESTA == bolo strogonoff de nozes
  == SALGADOS ==   quiche, coxinha
  == CAIXA ==      o pedido inteiro, R$ 592,75
  ```

  Cada comanda termina com `CLIENTE TAMBEM PEDIU: BOLO FESTA, SALGADOS`, que é o
  aviso cruzado que ela pediu depois do item esquecido no mural. E o resumo por
  faixa de preço que ela usa pra conferir com o caixa também está lá:
  `94 un x R$ 1,25 = R$ 117,50`.

**Falta:**

- **Lista de sabor é ABERTA**: hoje o sistema recusa o que não está no catálogo,
  e a resposta da casa é *"se o cliente pedir outro sabor, a gente vai
  colocando"*. É venda perdida por regra nossa.
- **Pizza: perguntar de forma ou redonda** quando ele não disser. São produtos
  bem diferentes: de forma 60x40 cm, R$ 120 inteira e R$ 60 meia, até 4 sabores;
  redonda 30 cm, R$ 41,90 o quilo, até 2 sabores, sai entre R$ 35 e R$ 45.

  **Medido em 26/08/2026, e é caro:**

  | o cliente escreve | o sistema cota |
  | --- | --- |
  | `pizza` | R$ 120,00 (a de forma) |
  | `uma pizza` | R$ 120,00 |
  | `pizza de calabresa` | R$ 120,00 |

  Quem quer a redonda de R$ 40 recebe uma conta de R$ 120 sem nunca ter
  escolhido, e a diferença aparece só na hora de pagar. É o mesmo defeito da
  cuca virando cuca recheada, que custava R$ 4, multiplicado por vinte.

  A causa imediata é `"uma pizza"` na lista de apelidos apontando para
  `pizza inteira`, e o próprio cabeçalho do arquivo diz que ali só entra "mesmo
  produto, mesmo preço, só escrito de outro jeito".

  **Tentei tirar o apelido e ficou PIOR:** sem ele, `uma pizza` cai no casamento
  por aproximação e cota **R$ 1,25**. Desfiz. R$ 120 errado é menos ruim que
  R$ 1,25, e o conserto não é no apelido.

  **O conserto certo é uma pergunta no fluxo**, do mesmo jeito que o genérico
  (`salgado`, `docinho`, `bolo`) hoje segura a etapa até o cliente escolher. A
  diferença é que pizza **não tem etapa própria**, então não existe hoje um
  lugar que pergunte. É isso que precisa ser construído.

  Áudio da dona, 19/08/2026: *"se a pessoa não falar em pizza de forma, tipo, eu
  quero encomendar duas pizzas, ah, então seriam as de forma ou seriam as
  redondas? Também tem isso que ela vai ter que questionar."*

### 4. Restrição que a casa não faz — FEITO em 26/08

`"30 brigadeiro sem lactose"` entrava no pedido e a cozinha recebia algo que não
consegue produzir, com o cliente lendo "sem lactose" na confirmação. Isso deixa
de ser prejuízo e vira saúde.

Está em `lib/ia/fluxo/restricao.ts`, e faz duas coisas: **tira a promessa** da
observação e **chama a equipe**.

Não recusa, e o motivo é dinheiro: a casa TEM bolo `0% lactose`, sabor de festa
da faixa C, R$ 55,90 o quilo. Decisão do dono: *"se for por exemplo bolo de
brigadeiro + o sem lactose, lá eles devem fazer no bolo né, só fica mais caro"*.

O que fica em aberto é **pergunta para a dona**, não código:
`PERGUNTAR-PRA-DONA.md` itens 4c e 4d.

### 5. Desambiguação: os casos que viram pergunta

Levantamento completo em `SABORES-E-AMBIGUIDADES.md`. Regras combinadas, em
ordem de precedência:

1. cliente **citou** uma mensagem → o assunto dela manda (hoje é só dica de
   prompt, precisa virar regra de código)
2. a **etapa** da conversa manda
3. **nome único** no cardápio → conclui sozinha (108 dos 117 nomes)
4. **quantidade acima de 6 não é bolo** (o maior bolo da casa tem 6 kg). "50
   brigadeiro" é docinho
5. só então **pergunta mostrando preço e unidade**

**Ambíguos de verdade, três:** `brigadeiro` (docinho, bolo de festa, pizza doce),
`café` (docinho, bolo caseiro), `prestígio` (bolo de festa, pizza doce).

**Não precisa perguntar, o sabor resolve:** empadão, torta fria, cuca e mini
bolha têm sabores exclusivos entre a versão simples e a mais cara.

**Precisa perguntar qual dos dois:** cupcake pequeno / recheado, cupcake grande /
recheado, cachorro-quente / mini. E o produto citado **sem sabor nenhum**.

### 6. A IA confirma em vez de anotar

Quando o cliente diz tudo numa mensagem, às vezes ela responde "você quer X,
certo?" e **não anota nada**. Se a conversa cair ali, não sobra registro.

### 7. Regerar as oito peças de cardápio

Nascem do catálogo por `scripts/gerar-cardapio.mjs` (HTML em `.cardapios/`,
imagem em `public/cardapios/*.jpg`). Arrumar o catálogo e regerar conserta as
duas pontas de uma vez.

Dois agrupamentos que o dono mandou separar:

- **`cupcakes-franciscano`**: cupcake é doce, franciscano é salgado de R$ 12,00
- **`cucas-paes`**: cuca é confeitaria, pão é padaria, salas diferentes

---

## DEPOIS — o atendimento no painel ("WhatsApp 2")

### 8. Recibo de entrega e leitura nunca gravou

Está codado e nunca registrou nada. O `wamid` volta do envio, mas o status de
entregue e visualizado não chega ao banco.

### 9. Marcar lida e "digitando" dá 400

Erro `#131009` da Meta.

### 10. Nenhuma tela mostra recibo

Mesmo quando gravar, não há onde ver.

### 11. Erro engolido em silêncio

Vários `.catch(() => {})` no caminho do WhatsApp. Falha que ninguém vê é falha
que ninguém conserta.

### 12. O que a Meta dá e não usamos

Levantamento em `WHATSAPP-O-QUE-A-META-DA.md`.

---

## PERGUNTAS PARA A DONA

**Moram todas em `PERGUNTAR-PRA-DONA.md`**, que é o arquivo vivo: numeradas, com
o motivo de cada uma e o que muda no atendimento dependendo da resposta. São dez
hoje.

A citação de origem de cada uma que veio dos áudios está em
`O-QUE-A-DONA-FALOU.md` seção 3.

---

## SEM MEDIÇÃO NENHUMA

Aqui não dá para responder pelo estado, e é honesto dizer que não sei.

- o painel da dona fora do que o `qa-painel` cobre
- a ponte da impressora
- vários clientes conversando ao mesmo tempo (`qa-concorrencia`)
- **a tela `/testar` depois da mudança de cérebro.** Ela passou a chamar o
  fluxo em 26/08/2026 e ainda não foi aberta no navegador desde então

---

## OUTRO PROJETO — hub, painel do parceiro

Pronto e não voltamos: kanban, ligação dentro do card, gravação no volume,
comissão, atribuição pelo link (testada no navegador).

- **`WHATSAPP_NUMERO_PUBLICO` não configurado**: o botão de WhatsApp não aparece
  na landing do parceiro
- não existe tela de trocar senha no painel do parceiro
- prospecção mandando as empresas garimpadas direto para a fila do parceiro
- relatório de melhor horário para ligar
- placar do vendedor
- QA: abrir negócio pelo kanban, visão de lista só leitura, linhas de Leads que
  parecem clicáveis
- `/api/admin/prospeccao/previa` não existe (404)
- telas duplicadas: as 5 em `/operacao/hub/*` repetem `/owner/*`

---

## DÍVIDA TÉCNICA

- merge de `coolify-postgres` para `servidor`, e aposentar o pm2 do aaPanel
- revogar o token da API do Coolify quando terminar

**Os dois cérebros saíram da lista em 26/08/2026.** Era a dívida mais cara do
projeto e custou duas correções entregues como prontas que não faziam nada.

---

## COMO EU DEVO TRABALHAR NISTO

Cada linha custou caro.

1. **Uma coisa por vez, medindo entre uma e outra.** Fazer três e medir no fim
   foi como passei uma tarde consertando o arquivo errado.
2. **Antes da bateria, mandar UMA conversa e ler o item no banco.** Pegou três
   defeitos que o build, o deploy confirmado e a função no bundle não pegavam.
3. **Bateria idêntica à anterior é suspeita, não resultado.** Significa que a
   correção não está no caminho que executa.
4. **Detector que nunca provou pegar nada não vale.** A primeira versão do
   detector de regex não pegava nem a isca plantada, e a foto dos preços nasceu
   com dezesseis nomes destruídos sem ninguém ver.
5. **Toda guarda nova: qual é o jeito mais barato de o modelo satisfazer isso?**
   Se a resposta for "apagando o item", a guarda está errada.
6. **Nunca escrever `\b`, `\s`, `\d` em regex por heredoc.** A barra é comida no
   caminho até o arquivo. Usar espaço literal, `[0-9]`, `(^|[^a-z])`.
7. **Teste vermelho não é sempre defeito no código.** Três vezes hoje o código
   estava certo e a expectativa do teste é que estava velha. E duas vezes foi o
   contrário, e o teste velho achou defeito de verdade. Medir o valor real antes
   de julgar quem está errado.
8. **Antes de apagar, levantar o que se perde.** Foi assim que o genérico não
   sumiu junto com o cérebro velho.
