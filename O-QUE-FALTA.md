# O que falta fazer

Arquivo vivo do painel da Doce Pao. Atualizado em 02/09/2026.

Regra dele: **nao dizer "falta pouco".** Dizer o que esta feito e o que esta
aberto, com nome, e com a prova ao lado quando houver.

---

## 02/09/2026, DEPOIS DO TESTE DELE: O PEDIDO APROVADO PASSA A EXISTIR

Ele testou a conversa inteira na producao e apontou tres coisas. As tres estao
feitas, com teste e isca medida. Portao em **155 verdes**.

### 1. Ela sabe que o pedido foi aprovado

Ele agradeceu depois da equipe confirmar, e ela respondeu a fala de FECHAMENTO
("seu pedido foi pra fila da equipe"), como se o pedido tivesse voltado.

Agora o pedido aprovado chega no fluxo a cada mensagem. O obrigado recebe
"Imagina! Seu pedido esta confirmado pra 10/09/2026 as 18:30", e quem quer mudar
vai pra equipe com o motivo, porque a cozinha ja esta com aquilo na mao.

### 2. Quem volta perto da data ouve do pedido

*"Ela vai ver que aquele cliente ja fez algum pedido, ela olha a base dele e ve
que ele tem aquele pedido para tal dia, dai ela pergunta se e sobre o pedido ou
se e outra coisa."*

A abertura mudou: quem chama com um pedido confirmado em aberto ouve

    Boa tarde, tudo bem? Vi aqui que voce tem um pedido confirmado com a gente
    pra 10/09/2026 as 18:30. E sobre ele que voce quer falar ou e outra coisa?

Sem lista de palavras: quem manda e o pedido no banco, e nao o jeito que ele
escreveu. Medido: com o rascunho vazio, TODA primeira mensagem de quem volta cai
nessa etapa.

### 3. O lembrete de 24 horas antes, no horario da padaria

Comecou em 10 horas, que foi o primeiro numero dele, e virou 24 na mesma tarde,
quando ele perguntou: *"nao e melhor entao 24 horas antes? nos horarios de
funcionamento da padaria?"*. E melhor, por duas razoes:

- **Dez horas antes e o mesmo dia.** Retirada as 18:30 avisava as 08:30 daquela
  manha, e quem quer mudar a hora descobre com o bolo ja na producao.
- **Vinte e quatro horas caem na mesma hora do dia**, que e horario de padaria
  por construcao. O de dez caia na madrugada sozinho (retirada as 13:00 avisava
  as 03:00) e precisava de uma regra de silencio so pra consertar isso.

O horario sai de `padaria-aberta.ts`, que ja era a fonte unica: o mesmo que a
Dora fala pro cliente e o mesmo que barra retirada fora do expediente.

Decisao pura em `lib/ia/lembrete.ts`, com o relogio na mao no teste: uma vez so
(marca gravada no pedido), so com a padaria ABERTA (inclusive o intervalo de
domingo, das 12h as 16h), nunca depois da retirada, e nao nas tres primeiras
horas depois de a equipe aprovar. Essa folga de tres horas e o que deixa a
encomenda da tarde pra manha seguinte receber o aviso da noite, em vez de ficar
sem nenhum.

O relogio pega carona na batida da ponte da impressora, entao funciona sem cron
nenhum. A rota `POST /api/lembretes` (Bearer PONTE_TOKEN) existe pra quem quiser
um cron de verdade.

**FALTA UMA COISA, E E DA META.** Fora da janela de 24 horas so entra template
aprovado, e o lembrete quase sempre cai fora dela (o cliente fechou na semana
passada). Precisa cadastrar na conta da Doce Pao:

    nome:       lembrete_retirada
    categoria:  UTILITY
    idioma:     pt_BR
    corpo:      Oi, {{1}}! Passando pra lembrar do seu pedido na Doce Pao que
                fica pronto {{2}}. Qualquer coisa e so me chamar por aqui.

Enquanto ele nao existir, o lembrete so sai pra quem escreveu nas ultimas 24
horas, e o log diz com todas as letras o que falta cadastrar.

### E o "frita" da comanda

*"Falou frito ali no pastel."* A mini bolha so existe frita, entao "frita" na
comanda e ruido. Quem decide e o catalogo: bate com a categoria do produto, sai;
contraria ("mini bolha assada"), fica, porque ai e pedido de verdade.

---

## 31/08/2026, SEGUNDA NOITE: QUATRO CONVERSAS FECHAM CERTO

Testei conversando com a produção, uma mensagem por vez. Nove defeitos novos,
todos medidos, todos com regra e teste. O portão foi de 138 para 156.

Fecham hoje, do "oi" ao pedido registrado: o pedido do Alessandro (R$ 299,80),
uma festa de 30 pessoas (R$ 628,20, batendo a proposta), um bolo com todas as
peças (R$ 105,80 mais o topo à parte) e o bolo sem lactose (R$ 55,90).

### O QUE VIROU REGRA NESTA NOITE

- **Quem cita a peça respondeu sobre ela.** "nao quero topo nem papel de arroz"
  fechava COM topo, porque o atalho do botão pegava só a peça perguntada e jogava
  fora o resto da frase.
- **A quarta pergunta igual não é pergunta, é gente.** Sem entender nada do que a
  pessoa respondeu, ela chama a equipe com o motivo, em vez de repetir pra sempre.
- **A família que ele pede entra no pedido na hora.** Sem isso, "queria encomendar
  um bolo" não virava item, e o "brigadeiro" seguinte caía no docinho.
- **Plural e diminutivo são o jeito normal de escrever.** Salgados, docinhos,
  doces e salgadinhos agora são família. A redução mora num lugar só.
- **Restrição que está no cardápio fecha a venda sozinha.** Decisão dele: o 0%
  lactose responde e vende; o resto vai pra equipe.
- **A resposta vale com o modelo devolvendo NADA.** Quem responde só o peso não
  cita produto, e a resposta se perdia.
- **A unidade da tela é a unidade em que a casa cobra**, e quem manda é o motor.
- **Pergunta que chama a equipe vai com o motivo.**

### O QUE FICOU ABERTO

- **A chave pix**, que é da dona. Sem ela, quem pede a chave cai pra equipe.
- **As 8 perguntas de `PERGUNTAR-PRA-DONA.md`**, sendo a 7 o cardápio sem acento.
- **Aprovar um pedido de teste e ver o cupom sair**, que é dele: a ponte está
  online e imprimiria papel na padaria.

---

## 31/08/2026: O PRIMEIRO PEDIDO DE FESTA FECHOU PONTA A PONTA

Ele fechou um pedido inteiro pelo WhatsApp, com 200 salgados, 100 docinhos, bolo
de 2 kg, topo e papel de arroz. Total R$ 465,80, quatro cupons impressos na
padaria. A conta bateu, cada item foi pra comanda certa, e a aprovação
funcionou.

Apontou catorze defeitos nos prints. **Os catorze estão fechados.** Depois disso
mandou refazer a conversa dele mensagem por mensagem contra o servidor, e a
conversa achou **mais sete** que os 130 testes não pegavam.

O detalhe dos vinte e um está no `DIARIO-DA-IA.md`, com o que cada um custava.

### O QUE VIROU TRAVA (regra do sistema, não remendo)

1. **Nome fora do cardápio não vira linha do pedido.** Roda no fim do fluxo, em
   todo caminho. Nome de família ("pizza" esperando o tipo) continua valendo.
   Nasceu de `mini frango`, que o motor cotava como pizza de R$ 120,00.
2. **Produto de sabor único sai com o sabor do catálogo**, antes da disputa de
   sabor. Coxinha é frango, bolinha é queijo, e pedir outro sabor ouve
   "a gente faz coxinha de frango".
3. **A observação do bolo tem um formato só**, escrito e lido pelas mesmas duas
   funções (`lib/banco/obs-do-bolo.ts`), com teste de ida e volta.
4. **"Sim" digitado vale como botão** nas perguntas de peça.
5. **Responder uma opção da lista não é delegar.**

### ERA REMENDO, E FECHOU DEPOIS (conferido em 02/09/2026)

Os dois que ele cobrou aqui viraram trava com teste, e este parágrafo fica pra
não mandar ninguém consertar o que já está consertado:

- **quantidade e unidade**: `unidadeDoItem`, em `lib/tipos.ts`, é a decisão
  única, e `a-unidade-do-item-e-uma-decisao-so.cjs` cobra os seis lugares que
  respondiam por conta própria.
- **o texto do cliente e o texto da comanda**:
  `o-que-o-cliente-leu-e-o-que-a-cozinha-recebe.cjs` compara produto, quantidade
  e total dos dois lados.

A conferência antes de fechar (`oQueFaltaPraFechar`) JÁ existe e já cobre item,
quantidade, dia, hora, nome, pagamento, sabor faltando, sabor além do limite e
cor da forminha. Os dois acima são o que falta entrar nela.

### MEDIDO E CORRIGIDO NO CUSTO DA IA

Ele levou um susto com R$ 392 na OpenAI. Puxado do banco, e não estimado:

| dia | chamadas | tokens por chamada | custo |
| --- | --- | --- | --- |
| 20 a 23/08 | 21.000 | 22.000 a 26.000 | R$ 321 |
| 27/08 em diante | 2.400 | 778 | não era gravado |

O caro foi o tamanho do prompt do cérebro antigo, apagado em 26/08. Hoje uma
conversa de festa inteira custa uns R$ 0,07. O custo tinha parado de ser
gravado: `estimarCustoCentBRL` arredondava pra centavo inteiro e zerava tudo.
Consertado. **Isso é estimativa por tabela de preço; a verdade é a fatura.**

---

## O QUE E SO DELE AGORA (codigo nao fecha)

- **impressora fisica**: a ponte e o papel da cozinha. Conferir na padaria.
- **perguntas da dona**: `PERGUNTAR-PRA-DONA.md`. Sem as respostas, sabor
  aberto continua no recado + equipe na insistencia, sem inventar produto.
- **medir conversa ao vivo**: `uma-conversa-contra-o-banco.cjs` e o medidor de
  25 minutos. Recibo de entrega no banco so se prova numa conversa real.
- **JPG das pecas do cardapio**: o HTML sai de `scripts/gerar-cardapio.mjs`.
  PNG/JPG pede Chrome da casa, captura full size.

---

## FECHADO NO CODIGO ATE 30/08/2026 (nao refazer)

- lista unica: so `lib/ia/dados/produtos.ts` le o `catalogo.json`
- categoria uma lingua so: motor e pedido falam `salgado_frito` / `docinho` /
  `bolo_festa`. Papel da cozinha continua `== SALGADOS ==` pra frito e assado
- `nomeNoTicket`, forminha do catalogo, tipo da pizza (forma/redonda/meia)
- hedge: a frase anota mesmo quando o modelo so manda `confirmou` ou `certo?`
- sabor fora da lista: item fica, recado na obs, equipe so na insistencia
- regras 25 a 27 da demolicao: `delegaEscolha` monta o sortido; mudar o total
  da festa atualiza a base sem recalcular pelas pessoas
- `FLUXO_NOVO_PARA=off` cala a IA; a IA nunca confirma pedido sozinha

### O portao

```
node testes/todos.cjs
```

Testes locais, nenhum fala com a rede. Os que falam com o VPS saem para
instrumento.

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

**101 testes locais no portao, nenhum fala com a rede.** `qa-painel` saiu do
portao: ele fala com producao e no Windows procura Chromium em AppData.

Os que falam com o VPS ou com produção saíram para instrumento, e rodam na mão:

```
node testes/pausa-nao-vaza.cjs
node testes/qa-conversa.cjs
node testes/qa-concorrencia.cjs
node testes/guardar-conversas.cjs
node testes/qa-pedido-completo.cjs     (abre navegador, cria pedido de verdade)
node testes/qa-painel.cjs              (Chrome no painel no ar; Windows)
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

### 1. Sete arquivos ainda remontam o catalogo cru — FEITO

So `lib/ia/dados/produtos.ts` le o JSON. O gerador de pecas tambem le, de
proposito, pra imprimir o cardapio.

### 2. Dois vocabularos de categoria — FEITO

Uma lingua do motor ate a comanda. Papel `SALGADOS` unico.

### 3. O sabor que ela não achou some — FEITO no codigo

A frase guarda o sabor no recado do item. Na primeira vez a padaria mostra o
cardapio. Se ele insiste, anota "sabor a confirmar" e chama a equipe. Nao vira
produto com preco. Completar a lista aberta e pergunta pra dona.

### 4. O leitor da frase lê quantidade depois do nome — FEITO, e medido em 30/08

`"muda a coxinha pra 100"` atualiza a quantidade mesmo quando o modelo está em
outra pergunta e devolve o item velho, ou não devolve item nenhum.

**Conferido rodando o `responder` de verdade**, com a coxinha em 200 no estado e
cinco formas de o modelo responder:

```
modelo devolve NADA          ->  100 ~ coxinha
modelo devolve o item VELHO  ->  100 ~ coxinha
modelo acerta                ->  100 ~ coxinha
"aumenta a coxinha pra 300"  ->  300 ~ coxinha
"coxinha 150"                ->  150 ~ coxinha
```

Travado por `testes/o-leitor-da-frase-acha-e-nao-inventa.cjs`, que cobre as tres
formas e tambem o caso da frase sozinha, sem item nenhum do modelo.

### 4a. A TERCEIRA CAMADA DA PIZZA — FECHADA EM 30/08/2026

O defeito de "2 inteiras, uma de calabresa e uma de frango" tinha **tres**
camadas, e as duas primeiras nao bastavam:

```
antes             1 ~ pizza inteira ~ calabresa | frango   R$ 120,00
so a instrucao    2 ~ pizza inteira ~ frango com catupiry  R$ 240,00  (perdeu a calabresa)
fluxo consertado  1 ~ pizza inteira ~ calabresa
                  1 ~ pizza inteira ~ frango com catupiry  (medido LOCAL, correto)
producao          1 ~ pizza inteira ~ frango com catupiry | calabresa  R$ 120,00
```

A terceira e a GRAVACAO. `pizza` esta em `UMA_LINHA_SO`, entao a montagem
casava as duas linhas pelo nome e juntava de volta o que a leitura tinha acabado
de separar, somando o sabor. Somar sabor continua certo (sao ate 4 na mesma
pizza); o que faltava era distinguir **somar sabor na mesma pizza** de
**empilhar duas pizzas diferentes**. Quem soma escreve um sabor que CONTEM o que
ja estava; quem pediu outra pizza escreve um sabor sem nada em comum.

A guarda de doce contra salgada NAO saiu, e nao e repeticao da regra nova:
quando a Dora reescreve a observacao inteira como `"calabresa, brigadeiro"`, o
texto novo contem o antigo e passaria pela regra do sabor. Quem barra e o tipo.

**A decisao virou funcao pura, e isso e metade do conserto.** Ela morava dentro
do `anotarItem`, que so roda com banco, e por isso o `linha-nao-multiplica.cjs`
conferia a regra por GREP no texto do arquivo: procurava a condicao antiga ter
sumido, e nao o comportamento estar certo. **Grep passa verde com a regra
escrita e quebrada.** Agora e `linhaQueRecebe(itens, item)`, e o teste novo
monta o pedido, chama, e olha o numero que voltou:
`testes/a-pizza-de-outro-sabor-e-outra-linha.cjs`, sete casos, isca provada
(so o caso do dinheiro vermelho, as seis licoes em volta verdes).

### 4b. O LIXO — FECHADO EM 30/08/2026, e o detector deixou de ter ponto cego

**A lista de pastas saiu do `nada-de-codigo-fantasma.cjs`.** Ele varria quatro
pastas escritas a mao (`lib/ia/fluxo`, `lib/ia`, `lib/ia/dados`, `lib/banco`) e
nao enxergava `lib/` na raiz, `lib/whatsapp/` nem `components/`. Agora desce
sozinho por `lib` e `components`: pasta nova ja nasce coberta.

Ele achou seis funcoes mortas nessas tres pastas, e DUAS eram promessa quebrada
com o cliente, nao lixo:

| o que estava morto | o que aconteceu |
| --- | --- |
| `avisoDeEspera` | **ligado.** A frase do repasse estava chumbada no `fluxo.ts` e prometia atendimento agora a QUALQUER hora. As 23h o cliente lia "vou chamar alguem da equipe" e ninguem vinha ate de manha |
| `avisoDeProblema` | **ligado.** Mesma coisa quando a IA cai: `app/api/whatsapp/route.ts` prometia "daqui a pouco" de madrugada |
| `normalizarTelefone` | **ligado.** O helper e o componente que o exporta faziam a MESMA conta, no mesmo arquivo, e o componente nao chamava o helper |
| `CLUBE_MOCK` | **apagado**, com o tipo `MembroClube` que so existia pra ele. Clube de fidelidade nao existe no sistema |
| `lerPerfil`, `salvarPerfil` | **decisao dele**, na lista `PENDENTES` com o motivo: metade escrita de uma funcionalidade sem tela |

**O que continua e e decisao dele:** ligar ou apagar o `perfil.ts` (editar o
perfil comercial do WhatsApp sem entrar no painel da Meta) e o
`informacoes.ts` (a tabela de todas as perguntas do atendimento, pedida em
24/08). Os dois sao trabalho certo que nunca ganhou tela.

---

### 4c. O LEVANTAMENTO QUE GEROU ISTO, medido em 30/08/2026

Levantado varrendo o repositorio inteiro, e nao por amostra: 145 arquivos
`.ts`/`.tsx`, 32 rotas de API, 101 testes, 22 dependencias, `.mjs`, `.sql`,
`.html` e `.css`.

**O que NAO tem lixo, medido:** zero rota de API morta (as 32 sao chamadas;
duas de fora do repositorio, pelo hub e por um relogio que ainda nao existe),
zero teste morto (os 16 fora do portao tem motivo escrito), zero dependencia
sem uso.

**O que tem:**

| o que | quanto | onde |
| --- | --- | --- |
| normalizador de texto definido de novo | **5 vezes** | `texto.ts` (canonico), `departamentos.ts`, `Atendimentos.tsx`, `PedidoMontado.tsx`, `fatos.ts` |
| arquivo orfao, ninguem importa | **4**, 649 linhas | abaixo |
| funcao morta, ninguem chama nem o proprio arquivo | **6** | `CampoTelefone.normalizarTelefone`, `mock.CLUBE_MOCK`, `padaria-aberta.avisoDeEspera` e `.avisoDeProblema`, `perfil.lerPerfil` e `.salvarPerfil` |
| export a toa, vive por dentro | **12** | `carregarNotasClientes`, `HORAS_PARA_LISTAR`, `carregarDispensados`, `janelaDe`, `clienteBateNaBusca`, `itensNaFrase`, `categoriasDaEtapa`, `daFamiliaDaCasa`, `passouDoLimiteDeSabores`, `MODELOS_IA`, `USD_BRL`, `padariaAberta` |

**Os quatro orfaos NAO sao a mesma coisa, e a diferenca decide o que fazer:**

| arquivo | linhas | o que e |
| --- | --- | --- |
| ~~`lib/ia/fatos.ts`~~ | 135 | **NAO E ORFAO.** O teste `politica-nao-se-inventa.cjs` exercita ele |
| `components/AjustarPedido.tsx` | 98 | resto: o `AguardandoConfirmacao` ja lanca o valor do topo |
| ~~`lib/ia/fluxo/informacoes.ts`~~ | 279 | **NAO E ORFAO, e eu quase apaguei.** O teste `nada-fica-sem-ser-perguntado.cjs` usa a tabela como GABARITO: cobra que toda informacao obrigatoria tenha quem pergunte no fluxo, que o tipo declarado bata com o tratamento, e que nenhum dos dois lados tenha coisa que o outro nao tem. E o mecanismo que impede a tabela e o fluxo de divergirem |
| `lib/whatsapp/perfil.ts` | 137 | **construido e nunca ligado**: deixa a dona editar o perfil comercial do WhatsApp sem entrar no painel da Meta |

Os dois primeiros se apagam. Os dois ultimos sao **decisao dele**: apagar joga
trabalho fora, ligar pede uma tela.

**TRES ERROS DO MEU DETECTOR NESTA VARREDURA, e o terceiro e o pior:**

**Ele so olhava `.ts` e `.tsx`, entao TESTE NAO CONTAVA COMO USO.** Dois dos
quatro "orfaos" tem teste que os exercita: o `informacoes.ts` e usado como
GABARITO pelo `nada-fica-sem-ser-perguntado.cjs`, e o `fatos.ts` pelo
`politica-nao-se-inventa.cjs`. Eu cheguei a apagar o primeiro e o portao pegou:
dois testes vermelhos, um deles justamente o que segura o build.

Arquivo com teste nao e codigo morto: e codigo cuja unica porta e a prova.

O primeiro acusou **cinco rotas mortas** e tres estavam vivas: o regex para
`[id]` estava quebrado, e `midia`, `pedido` e `pedido/foto` sao usadas pelas
telas. O segundo acusou `passouDoLimiteDeSabores` como morta, e ela e chamada
DENTRO do proprio arquivo pelo `saboresAlemDoLimite`: o limite de sabor da
pizza esta valendo. Por isso a tabela acima separa "morta" de "export a toa".

Falso positivo em detector e pior que buraco: quem ve tres acusacoes erradas
para de acreditar na quarta, que e verdadeira.

**Como refazer a conta** (nao confie neste numero, refaca):

```
grep -rn "normalize(\"NFD\")" --include=*.ts --include=*.tsx lib/ components/ app/
grep -rn "^import .*catalogo.json" --include=*.ts . | grep -v node_modules
```

O `detector de codigo fantasma` (`testes/nada-de-codigo-fantasma.cjs`) tem o
mesmo vicio que a gente esta cacando: ele varre **quatro pastas escritas a
mao** e confere export, nao arquivo. Fora dele ficam `lib/` na raiz,
`components/` e `app/`.

---

### 5. As duas pequenas — FEITO, conferido em 30/08

`obs: metade` indo como lixo pra comanda. O `valor_tipico` da pizza redonda
passa na pergunta de preço: costuma sair entre R$ 35 e R$ 45.

Conferido lendo quem chama:

- `obsPraComanda`, em `lib/ia/fluxo/restricao.ts`, tira `metade`, `metade de
  cada` e `meio a meio` da observacao, e e chamada no `fluxo.ts` antes de o item
  virar linha. Recado de verdade ("sem cebola", "forminha rosa") passa.
- `valorTipico` sai do catalogo em `produtos.ts` e e consumido em
  `informacao.ts`, que escreve "Costuma sair entre R$ 35,00 e R$ 45,00" na
  resposta de preco, sem repetir a faixa quando dois produtos tem a mesma.

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

**Ja ligados na lista unica** (`lib/ia/dados/produtos.ts`): o motor, o fluxo,
fatos, rotas de cardapio, montagem, sabor, forminha. O JSON cru so e lido em
`produtos.ts` (e no gerador de pecas).

Os dois vocabularos de categoria **sairam**: o motor grava o nome do catalogo.
O papel `== SALGADOS ==` nao foi fatiado. Foto de preco trava regressao:

```
node testes/o-catalogo-nao-mudou-preco.cjs
```

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

**E os dois vocabulários de categoria unificaram.** O orçamento fala a lingua
do pedido. Unificar o titulo do papel da cozinha **nao**: frito e assado
continuam no mesmo `== SALGADOS ==`.

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

**Falta (nao e codigo desta rodada):**

- **Lista de sabor e ABERTA, e a dona confirma o que entra no cardapio.** No
  codigo o item nao some: o sabor pedido vai no recado, a padaria mostra o
  cardapio, e na insistencia anota "sabor a confirmar" e chama a equipe. Nao
  vira produto com preco. Completar a lista e resposta dela em
  `PERGUNTAR-PRA-DONA.md`.
- **Pizza forma ou redonda:** a pergunta de tipo ja existe no fluxo. Medir
  uma conversa real ainda e dele.

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

### 6. A IA confirma em vez de anotar — FEITO no codigo

A frase aplica os itens mesmo quando o modelo devolve `{}`, `confirmou` ou
`perguntou`. `confirmou` so fecha na etapa da confirmacao (ou no atalho da
oferta ja recusada). "quanto e a coxinha?" nao inventa linha.

Prova: `testes/a-frase-anota-mesmo-quando-o-modelo-hedgeia.cjs`.

### 7. Regerar as oito pecas de cardapio

O HTML nasce de `scripts/gerar-cardapio.mjs` em `.cardapios/` (gitignored).
`scripts/gerar-cardapio-imagens.mjs` acha o Chrome do Linux (`/usr/bin`) ou o
do Playwright no Windows. Conferir na padaria se a peca que o WhatsApp manda e
esta captura.

Dois agrupamentos que o dono mandou separar:

- **`cupcakes-franciscano`**: cupcake é doce, franciscano é salgado de R$ 12,00
- **`cucas-paes`**: cuca é confeitaria, pão é padaria, salas diferentes

---

## DEPOIS — o atendimento no painel ("WhatsApp 2")

### 8. Recibo de entrega e leitura

O evento de status e lido mesmo quando vem no mesmo pacote da mensagem.
O UPDATE loga quando o `wamid` nao casa. Recibo **nao se inventa**.

### 9. Marcar lida e "digitando" da 400 (#131009)

E recusa da Meta neste `message_id` (id de teste, mensagem ja marcada, ou
recurso nao liberado na conta). O log nomeia o 131009. Nao invento tique azul.

### 10. A tela do WhatsApp mostra o recibo do banco

Balão da equipe/IA escreve `entregue` ou `lida` a partir de `entregue_em` /
`lida_em`. Sem campo, nao escreve. Sem tique azul. Prova: conversa real ainda e
dele (chave SSH desta maquina nao existe).

### 11. Erro engolido em silencio — FEITO no caminho do WhatsApp

`.catch(() => {})` saiu de `app/api/whatsapp/route.ts`, `lib/whatsapp/api.ts`,
`lib/whatsapp/transcrever.ts` e `lib/banco/conversas.ts`. Falha vai pro log.

### 12. O que a Meta da e nao usamos

Levantamento em `WHATSAPP-O-QUE-A-META-DA.md`. Decisao dele, nao pendencia
de codigo.

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
- ~~varios clientes conversando ao mesmo tempo~~ **MEDIDO em 30/08/2026.**
  O `qa-concorrencia` cobria clientes DIFERENTES em paralelo. O que ninguem
  tinha medido era o MESMO cliente mandando duas mensagens na mesma
  respiracao, que no WhatsApp e comum. A suspeita vinha da leitura do
  codigo: `anotarItem` faz lerMontagem, muda e grava, e o gravar reescreve
  a linha inteira. Duas chamadas juntas leriam o mesmo estado e a segunda
  escreveria por cima.

  **Nao se reproduz.** Tres rodadas, container `e914492`, os dois itens
  sobreviveram nas tres. Nao virou trava nenhuma, e nao devia: por o pedido
  inteiro atras de um cadeado por causa de defeito que ninguem viu e trocar
  risco medido por risco novo. Ficou `testes/qa-concorrencia-mesmo-cliente.cjs`
  pra quem desconfiar de novo poder OLHAR em vez de deduzir.
- **a tela `/testar` no navegador logado.** O codigo mostra os botoes da fala
  e manda `botaoId`. Abrir a pagina em producao ainda e dele.

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

## "TIRA A DE CALABRESA" — FECHADO E MEDIDO EM 30/08/2026

**A prova, contra o banco, container `d71f976`:**

```
antes (f8df73f)  1 pizza (calabresa) + 1 pizza (frango)   Total: R$ 240,00
agora (d71f976)  1 pizza inteira (frango com catupiry)    Total: R$ 120,00

rastro     etapa: dados / tirou do pedido: pizza inteira [calabresa]
montagem   1 ~ pizza inteira ~ frango com catupiry
```

Saiu a linha certa, identificada pelo SABOR, e a outra ficou intacta.


**Medido em producao em 30/08/2026**, container `f8df73f`, conversa inteira
contra o banco:

```
cliente >> queria 2 pizzas inteiras, uma de calabresa e uma de frango com catupiry
cliente >> na verdade tira a de calabresa, quero so a de frango com catupiry
padaria >> Fechando: 1 pizza (calabresa) R$ 120,00 + 1 pizza (frango) R$ 120,00
           *Total: R$ 240,00*
```

Ele tirou uma e pagou pelas duas.

**O rastro diz de quem e a culpa, e nao e da IA:**

```
etapa: abertura / modelo leu: 1x pizza [calabresa] ;; 1x pizza [frango com catupiry]
etapa: dados    / modelo leu: 1x pizza inteira [frango com catupiry]
```

Na mensagem do cancelamento o modelo devolveu **o que sobra**, que e a unica
coisa que ele consegue dizer. O fluxo tratou isso como atualizacao da linha do
frango, e a linha da calabresa ficou intacta.

**E o fluxo esta certo em fazer isso.** Item que some da leitura NAO pode virar
remocao: e a regra "nada some do pedido", e ela existe porque o modelo omite
item o tempo todo.

O que falta e o caminho explicito. Hoje nao existe:

- a `Leitura` nao tem campo de remocao. O `naoQuer` e sobre FAMILIA ("nao quero
  docinho") e sobre peca do bolo (topo, papel), nao sobre tirar uma linha.
- `situacao: "cancelar"` e cancelar o PEDIDO INTEIRO, e vai pra equipe.
- o leitor de frases (`falas-do-cliente.ts`) le "muda pra 100", recomecar, falar
  com gente e resposta ao valor. Nao le "tira".

**O desenho que respeita as duas regras da casa:** o modelo devolve a INTENCAO
(o que o cliente pediu pra tirar, nas palavras dele) e o CODIGO decide qual
linha sai, casando contra o pedido real. Casou em exatamente uma linha, sai.
Ambiguo ou sem casar, **nao sai nada e vira pergunta** — porque decisao que
custa dinheiro nao mora no prompt, e o que falta vira pergunta.

Os dois lados da gravacao ja estavam prontos pra isso desde hoje: o
`itensQueSairam` sabe dizer QUAL linha saiu, e o `removerItem` sabe tirar so
ela. Faltava o comeco da corrente.

### O que entrou

- `Leitura.tirar?: string[]`, com as palavras do cliente.
- Uma linha no bloco comum da instrucao, valida em qualquer etapa como a
  correcao de quantidade ja era.
- `linhaQueOClientePediuPraTirar(itens, frase)` no `fluxo.ts`, exportada e pura.
  **O sabor vale mais que o nome**, e essa e a regra toda: quando existem duas
  linhas do mesmo produto, o sabor e a unica coisa que as separa e e por ele que
  o cliente chama ("a de calabresa" nem cita a pizza). So quando nenhum sabor
  casa e que o nome responde.
- **-1 quando duas linhas casam.** Ambiguidade nao e permissao pra escolher:
  tirar a errada custa o mesmo que nao tirar nenhuma. Fica no rastro pra nao
  virar silencio.
- O `rastro` passou a entrar no `aplicar`. Foi ele que achou este defeito.

Travado por `testes/tirar-item-tira-a-linha-certa.cjs`, seis casos.

### As duas coisas que o portao pegou e o meu teste nao

Vale mais que o conserto, porque e o retrato de um teste que mede a camada
errada. O meu injeta a leitura direto no fluxo, entao ele pula tudo o que vem
antes:

1. **`o-cliente-sempre-tem-saida.cjs`:** o limpador do `pensar-openai.ts` e
   lista fechada, e campo que nao esta escrito la e jogado fora. O `tirar`
   morreria no caminho **com o modelo tendo acertado**, que e o defeito mais
   caro de achar que existe.
2. **`o-docinho-so-e-docinho-na-etapa-dele.cjs`:** a instrucao que eu escrevi
   estourou o teto de 1400 em tres etapas. A mais apertada tinha 35 caracteres
   de folga, e o proprio teto avisa que cortar ali e reintroduzir defeito
   conhecido. A linha encolheu pra `"- Vai tirar item? use tirar."` e o ensino
   do formato foi pro exemplo do JSON, que nao conta no teto.

### O ambiguo virou PERGUNTA (30/08/2026, pedido do dono) — MEDIDO

**A prova, contra o banco, container `ebc8c2e`:**

```
cliente >> queria 2 pizzas inteiras, uma de calabresa e uma de frango com catupiry
cliente >> pensando bem tira a pizza
padaria >> No seu pedido tem pizza calabresa inteira e pizza frango com catupiry
           inteira. Qual voce quer tirar?
cliente >> a de calabresa
padaria >> Fechando: 1 pizza inteira (frango com catupiry)  *Total: R$ 120,00*

rastro    mandou tirar e serve pra 2 linhas; vou perguntar qual
          ele respondeu qual tirar, e saiu: pizza inteira [calabresa]
montagem  1 ~ pizza inteira ~ frango com catupiry
```

A reescrita deixou a frase mais natural que a do codigo ("pizza calabresa
inteira" no lugar de "pizza inteira (calabresa)") sem trocar produto nem
inventar, que e exatamente o que ela pode e o que ela nao pode.



Palavra dele: *"a IA tem que tratar igual um humano ne, qual item voce quer
tirar? etc... pq pode ter pego 2 pizzas e dps querer 1"*.

```
cliente >> queria 2 pizzas inteiras, uma de calabresa e uma de frango com catupiry
cliente >> tira a pizza
padaria >> No seu pedido tem pizza inteira (calabresa) e pizza inteira
           (frango com catupiry). Qual voce quer tirar?
cliente >> a de calabresa
pedido  >> pizza inteira [frango com catupiry]
padaria >> Pra que dia voce quer retirar?
```

Quatro decisoes que valem mais que o codigo:

1. **Vale pra qualquer produto, nao so pizza.** Medido tambem com duas trufas
   (morango e uva). A regra e "duas linhas do mesmo nome".
2. **A pergunta SUBSTITUI a da etapa**, e nao entra na frente dela como os
   avisos. Perguntar "qual voce quer tirar?" e "pra que dia?" na mesma mensagem
   faz o cliente responder uma e a outra se perder. E por substituir, a etapa
   nao e marcada como perguntada: ela volta na mensagem seguinte, como no
   exemplo acima.
3. **Pergunta UMA vez.** Resolvendo ou nao, o campo sai. A Dora ja prendeu
   cliente em laco perguntando o sabor pra sempre, e conversa que nao anda perde
   pedido igual conversa errada.
4. **A resposta e resolvida pelo CODIGO, nao pelo modelo.** "a de calabresa" nao
   parece pedido de remocao pro modelo, parece escolha, entao a frase crua
   tambem vale. As duas formas estao no teste.

O campo `tirandoQual` e gravado (`fluxo_tirando`), porque no WhatsApp cada
mensagem e uma chamada nova: pergunta que nao sobrevive ao banco nao existe.

**O achado do caminho:** `"tira a pizza"` nao casava com `pizza inteira`, porque
o nome do cliente e mais curto que o do catalogo, e isso fazia o caso DO PROPRIO
EXEMPLO DO DONO virar silencio. Quem responde e a familia, que ja existia no
fluxo (`familiaDoProduto`), em vez de uma regra nova de primeira palavra.

Travado por `testes/tirar-item-tira-a-linha-certa.cjs`, que subiu de 6 pra 14
casos. Isca provada: 4 vermelhos, e os de seguranca ja verdes antes.

**Uma armadilha que o teste caiu e vale registrar:** o caso do "qualquer
produto" nasceu com COXINHA, e a coxinha nao tem lista de sabor no catalogo.
O teste cobrava uma venda que a padaria nao faz, que e a mesma armadilha da
cuca de banana no `qa-concorrencia`. Trocado por trufa, que tem morango, uva,
cereja e cafe.

---

## O sabor de um item grudava no outro da MESMA frase — FECHADO EM 30/08/2026

**Medido em 30/08/2026**, aparecendo enquanto eu media outra coisa:

```
cliente >> quero uma pizza inteira de calabresa e uma pizza redonda de 1 kg
rastro  >> modelo leu: 1x pizza inteira [calabresa] ;; 1x pizza redonda
pedido  >> pizza inteira [calabresa] ;; pizza redonda [CALABRESA]
```

O modelo leu certo: a redonda veio **sem sabor**. Quem carimbou foi o codigo.

A regra que faz isso e a do "sabor solto gruda no item que esta esperando", e ela
existe por um motivo bom: `"de calabresa"` sozinho nao nomeia produto, e sem ela
a resposta a uma pergunta de sabor caia no vazio (medido em 26/08, numa pizza que
precisou de seis voltas pra fechar). As guardas dela tambem estao certas: so
gruda se o sabor for daquele produto, e so se o item ainda nao tem sabor.

**O que falta e a mesma distincao que consertou a pizza:** a palavra `calabresa`
NAO estava solta, ela ja tinha dono na propria frase. Sobra de palavra de um item
nao e sabor do outro.

Dano: a cozinha monta uma redonda de calabresa que o cliente nao pediu, e ele le
"calabresa" na confirmacao. E a padaria deixa de PERGUNTAR o sabor, que era o
certo. Nao muda preco (a redonda e por quilo), entao nao e defeito de dinheiro
direto, mas e produto errado saindo do forno.

**Consertado, e VALE PRA LOJA INTEIRA**, que foi o pedido do dono: *"tem q usar
nisso pra tudo ne, nao so pra pizzas, todos produtos da loja categorias etc"*.

A regra e uma so: **o modelo diz a quem a palavra pertence quando devolve
`sabor` naquele item; palavra com dono nao esta solta.** O bloco que escolhe o
item "esperando" passou a ignora-la.

Onde duas listas do catalogo se encostam, este defeito existia calado:
`torta fria` e `empadao` dividem `frango`; `pizza inteira` e `pizza redonda`
dividem os 31 sabores; bolo e cupcake dividem `brigadeiro`.

E o que NAO mudou, porque e a razao de o bloco existir: quando o modelo nao da
dono a ninguem, a palavra continua solta e continua grudando. E assim que
`"de frango"` responde a pergunta da padaria, licao de 26/08 que custou seis
voltas numa conversa so.

Travado por `testes/sabor-de-um-item-nao-gruda-no-outro.cjs`, seis casos, e **o
mais duro deles nem tem pizza**. Isca provada: tres vermelhos (os de vazamento),
tres verdes desde antes (os que nao podiam quebrar).

---

## DÍVIDA TÉCNICA

- merge de `coolify-postgres` para `servidor`, e aposentar o pm2 do aaPanel
- revogar o token da API do Coolify quando terminar

### Cancelar UMA de duas linhas do mesmo produto — FECHADO EM 30/08/2026

Defeito de dinheiro, na direcao contraria a da pizza: o cliente **paga por um
item que cancelou**. Nao e regressao do conserto da pizza, e mais velho que ele
(medido: duas coxinhas de recheios diferentes ja eram duas linhas antes).

O pedido ja aceita duas linhas do mesmo nome com recheios diferentes:

```
100 ~ coxinha ~ frango
 50 ~ coxinha ~ calabresa
```

Mas tudo o que tira item do pedido enxerga so o NOME:

- `itensQueSairam` em `gravar.ts` chaveia por `produto|categoria`, sem a
  observacao. Se o cliente cancela a de calabresa, a chave continua no `depois`
  e **nada e removido**: a linha cancelada fica no banco e entra na conta.
- `removerItem` em `montagem.ts` filtra por `mesmaLinha`, que tambem so olha o
  nome. Quando ele e chamado, leva **as duas**, e ai o dano e o oposto: some
  do pedido o que o cliente nao mandou tirar. Isso fere "nada some do pedido".

Os dois lados erravam, e da mesma causa: enxergar so o nome.

**O conserto nao foi incluir a observacao crua na chave.** Ela CRESCE
("calabresa" virando "calabresa | frango com catupiry" quando o cliente
acrescenta o sabor), e comparando texto a linha que so ficou mais completa
contaria como linha que saiu, indo direto pro `removerItem`. Isso feriria a
regra mais antiga do projeto, nada some do pedido.

Quem responde e o `umaDescreveAOutra`, exportado do `montagem.ts`: compara por
PEDACO, separando por virgula e por barra, e aceita pedaco que cresceu. A linha
continua no pedido enquanto alguma linha do mesmo nome ainda descrever o que ela
dizia. E a mesma conta que ja existia dentro do `linhaQueRecebe` e que faltava
nos outros dois lugares, entao agora e **uma so**, usada em tres.

Travado em `testes/o-que-sai-do-pedido-sai-do-banco.cjs`, que subiu de 9 para 13
casos. Isca provada: com a regra velha, os dois casos de cancelamento davam
`saiu []` (a linha cancelada ficava no banco) e as duas armadilhas ja passavam.

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
