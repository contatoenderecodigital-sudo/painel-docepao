# Diário da Dora, a IA da Doce Pão

Este arquivo existe porque conversa some e código fica. Cada defeito aqui foi
achado lendo conversa de verdade ou olhando a tela, nunca por suposição, e cada
um custava dinheiro, pedido ou confiança da cozinha.

Quem for mexer nessa IA depois: leia a seção "Regras que não se quebram" antes
de cortar qualquer linha do prompt.

---

## 18 e 19 de agosto de 2026

Dia inteiro de leitura de conversa e correção. Foram 40 correções, todas com o
caso real no commit.

### O que custava dinheiro

| Defeito | O que acontecia | Correção |
|---|---|---|
| Pizza cobrada três vezes | "uma inteira de calabresa e frango com catupiry" virava 3 linhas de R$ 120. Fechamento de R$ 401,90 num pedido de R$ 161,90 | Pizza é uma linha, o sabor soma na observação |
| Pizza por R$ 0 | Gravada como "pizza inteira calabresa", nome que não existe na tabela | O nome é o tamanho, o sabor é observação |
| Torta com palmito pelo preço da comum | R$ 36,90 no lugar de R$ 39,90 o quilo | Nome completo do cardápio vale; entre parecidos, ganha o mais longo |
| Cuca cobrada por unidade | A dona já tinha dito em áudio que é por quilo | Catálogo corrigido e a IA explica o quilo quando pedem por peça |
| Cachorro-quente como unidade | 1 un no lugar de 1,5 kg | Unidade vem do cardápio, mesma fonte do preço |
| Item duplicado | "cuca recheada banana" e "cuca recheada" viravam duas linhas | Nome do produto é o do cardápio, o resto desce pra observação |
| Preço do cento sem resposta | "quanto custa o cento?" ficava sem número | R$ 100,00 frito e R$ 125,00 assado, do cardápio |
| Preço do bolo sem resposta | "quanto o quilo do bolo?" virava "vou confirmar" | De R$ 46,90 a R$ 55,90, das faixas |
| Mínimo de 100 salgados inventado | Festa de 5 pessoas cotava um cento inteiro | Não existe mínimo por encomenda, só 20 por sabor |

### O que fazia a cozinha produzir errado

| Defeito | O que acontecia | Correção |
|---|---|---|
| Pedido fechado sem sabor | "cuca recheada: 3 un" foi pra cozinha sem recheio | Produto com lista fechada não fecha sem sabor escolhido pelo cliente |
| Lista de opções virando escolha | A pergunta ("chocolate, doce de leite, abacaxi...") era gravada como se fosse o sabor | Observação que é a lista inteira é descartada |
| Sabor inventado | Ela escolhia o sabor pelo cliente | Sabor só entra se o cliente escreveu |
| Item sumindo | Recusar o sabor apagava o item; "metade de cada" perdia a esfirra | O item entra sem o sabor e trava o fechamento até escolherem |
| Produto inventado | Esfirra que ninguém pediu, e o croquete pedido sumia. 567 salgados no lugar de 300 | Produto que o cliente nunca citou não entra |
| Salgado na bancada do doce | Torta fria com palmito saía na comanda da confeitaria | Salgado é avaliado primeiro, por categoria e por nome |
| 3 kg virando 3 bolos | Item sem unidade imprimia "3x BOLO BRIGADEIRO" | A fila entrega a unidade do cardápio pra ponte |
| Recado interno no ticket | "nome do aniversariante e idade faltando" saía impresso | Observação entra limpa, sem repetição e sem recado interno |
| Empadão com a lista da empadinha | Ela oferecia palmito, carne e brócolis pro empadão | O prompt não tinha os sabores do empadão; agora tem |

### O que quebrava a conversa

| Defeito | O que acontecia | Correção |
|---|---|---|
| Recusa inventada | "ofereci duas vezes e ele não pediu, então não quer" apagava salgado e docinho do pedido enquanto o cliente pedia o cardápio | Família que o cliente citou nunca é marcada como recusada |
| Mensagem colando na outra | "dia 15/11" + "salgado" virava "11 salgados" e o teto do pedido virava onze | Mensagens juntadas com quebra de linha |
| Resumo destruído | O fechamento chegava como "Te mandei o cardápio de salgados.070,65*" | Resumo de fechamento nunca vira cardápio |
| Idade virando convidado | "aniversário da minha filha, 8 anos" virava festa pra 8 pessoas | Número com unidade colada não é convidado |
| Tema do topo virando sabor | "topo de unicórnio" virava "não fazemos bolo de unicórnio" | Tema é do topo, sabor é outra pergunta |
| Perguntar o que já foi respondido | O sabor dito na mesma frase de outro item se perdia | O código completa o sabor que está na fala do cliente |
| Pergunta ignorada | Preço, peso e "como se vende" ficavam sem resposta | A pergunta do cliente vem antes da etapa |
| Falar por cima | Três caminhos enviavam sem conferir se o cliente escreveu de novo | Espera de 12s mais segunda conferida depois de pensar |
| Dia da semana errado | "sábado 20/09" num domingo | Dia da semana é calculado da data |

### O que a tela mostrava errado

- Pedido de hoje aparecendo como amanhã depois das 21h (servidor em UTC, padaria em Brasília)
- Conversa dizendo "IA atendendo" com a IA parada esperando a equipe
- 4 pedidos na fila contados como 0 em Resultados
- Busca que dava match em tudo (`includes("")` sempre verdadeiro)
- Resumo do pedido sem unidade e sem sabor
- Bolo caseiro mostrando campos de bolo de festa
- Asteriscos crus do WhatsApp no painel

---

### Achados da manhã caótica e do teste brutal (19/08, madrugada)

Oito clientes escalonados, depois três com mensagem em rajada e erro de
digitação. Zero "tive um probleminha" e zero contaminação entre pedidos nas
duas rodadas. O que quebrou:

| Defeito | O que acontecia | Correção |
|---|---|---|
| Mensagem colando na outra | "dia 15/11" mais "salgado" virava "11 salgados": o teto do pedido virava onze e a festa inteira era recusada | Mensagens juntadas com quebra de linha |
| "hoje" não virava data | Pedido gravado com a hora e sem dia. Amanhã esse "hoje" já é ontem | hoje, amanhã e depois de amanhã viram data no fuso da padaria |
| Sabor sugerido e aceito | Ela indicou "mini bolha de carne", o cliente disse "pode ser", e entrou sem sabor | Aceitar indicação é escolher |
| "meio quilo" | Não era entendido como peso e o item se perdia | Peso por extenso conta |
| Erro de digitação no sabor | "calabreza" travou um pedido inteiro por um Z | Comparação tolerante: palavra curta aceita um erro, longa aceita dois |
| Ela nunca dizia que não entendeu | Repetia a mesma pergunta até o cliente desistir | Na terceira, admite e pede pra repetir de outro jeito |
| Pedido sumia da tela | Pedido não impresso desaparecia da conversa quando a data passava | Só sai da tela depois de aprovado e impresso |
| IA não mexia no próprio pedido | Mandava pra equipe mudança de pedido que ainda nem foi aprovado | Ela altera até imprimir; depois disso chama gente |

---

## Regras que não se quebram

Cortar qualquer uma destas traz de volta um defeito que já custou pedido:

1. **Unidade e preço saem do cardápio**, nunca da categoria nem do que a IA acha.
2. **Sabor de produto com lista fechada é obrigatório** e só entra se o cliente
   escreveu. Depois de três perguntas sem resposta, chama a equipe e o item
   continua no pedido.
3. **Produto que o cliente não citou não entra**, a menos que ele peça indicação.
4. **Total dito é pra dividir entre os tipos**, nunca repetir em cada um.
5. **Dia e hora da retirada** existem no sistema, no resumo do cliente e no
   ticket.
6. **Não existe prazo mínimo** pra salgado, docinho e torta: dependendo do dia
   sai pro mesmo dia, e a equipe confirma. Recusar data é venda perdida.
7. **Mudança ou cancelamento de pedido fechado chama gente.**
8. **Nada de dinheiro é estimado**: vem da tabela ou não vem.
9. **"Hoje" é o hoje da padaria**, fuso America/Sao_Paulo, nunca o do servidor.

---

## Como testar

Os roteiros ficam em `/root/` no servidor (cli-A.sh até cli-e.sh, manha.sh,
brutal.sh) e rodam contra produção pelo webhook de verdade.

- `node testes/qa-conversa.cjs` roda 159 checagens; cada uma nasceu de um erro
  que o dono encontrou. Referência atual: 157 a 158 de 159.
- `sh /root/manha.sh` simula oito clientes chegando escalonados, como das 7h às
  9h. Prova: nenhum "tive um probleminha", nenhum pedido com item de outro,
  quem só pergunta não vira pedido, quem pede pra hoje é atendido.
- `sh /root/brutal.sh` manda mensagem em rajada, com erro de digitação, e dois
  pedidos quase iguais ao mesmo tempo.

Ler conversa é obrigatório: número verde de bateria não prova nada sozinho. O
defeito do "11 salgados" só apareceu lendo a conversa inteira.

---

## Capacidade

Medido em produção, com 12 horas de teste:

- 16.208 tokens de entrada por turno (era 18.708 antes do corte do prompt)
- Teto da conta: 200.000 tokens por minuto, ou seja cerca de 12 turnos por
  minuto
- Custo: 1,5 centavo por turno
- Oito clientes ao mesmo tempo passaram sem uma falha

Para dobrar o teto, `OPENAI_API_KEY_2` precisa ser de **outra conta**: chave
nova na mesma conta não muda nada, porque o limite é da organização.

---

## Pendente

- `ADMIN_WHATSAPP` nas variáveis, pra o dono receber aviso quando a IA cair ou
  quando uma mensagem não chegar no cliente
- Levar a ponte atualizada pra máquina da padaria (o papel do caixa passou a
  mostrar a forma de pagamento)
- A dona usar a tela de aprovação com pedido real

## 19/08: o painel no celular, que é onde ela vai atender

Todo o teste até aqui foi em monitor de 1440px. Uma passagem num aparelho de
390px achou sete defeitos, e o primeiro deles sozinho invalidava a entrega.

**Pelo celular ninguém aprovava pedido.** O botão "Aprovar e imprimir" ficava
das 382px às 533px, fora de uma tela de 390px, dentro de um cartão com
`overflow-hidden`. Não dava nem pra arrastar de lado pra alcançar: era
inatingível. A causa era um `shrink-0` no grupo dos botões, que travava a
largura no tamanho do conteúdo e impedia o `flex-wrap` que já estava ali de
disparar. Hoje o rodapé empilha no celular e o aprovar termina em 347px, com
43px de sobra.

Os outros seis:

- Voltar pra lista não limpava o `?cliente=` do endereço, então recarregar a
  página jogava de volta pra dentro do chat que ela acabou de fechar, e o
  botão de voltar do aparelho pulava pra conversa anterior em vez de sair.
- Com o teclado aberto sobravam 188px de conversa contra 180px de enfeite
  fixo, ou seja, um balão e meio na tela. Cabeçalho e barra de estado passaram
  a recolher enquanto a altura aperta.
- O telefone e o estado brigavam por 196px no cabeçalho e saíam cortados. No
  celular o número sai do cabeçalho e fica no painel do contato; no monitor
  ele aparece inteiro.
- Filtros de 28px de altura num aparelho de toque, onde o mínimo aceitável é
  44px. Agora 40px no dedo e 28px no mouse.
- A tela de Clientes tinha três rolagens uma dentro da outra, e a lista era
  uma janelinha de 170px mostrando 3 de 15 clientes. Hoje mostra 7 sem rolar.
- "Qua é o seu dia mais forte" nos Destaques: a sigla serve pro eixo do
  gráfico, não pro meio de uma frase.

A lição que fica pro resto do projeto: **defeito de tela só aparece no
aparelho em que a pessoa trabalha**. Nenhum desses sete era visível no
monitor, e três deles impediam trabalho de verdade.

Junto vieram três da própria dona usando o painel, que teste automatizado não
pega porque teste não se distrai: responder o cliente devolvia pra lista de
atendimentos (a tela recarrega ao enviar e a conversa aberta só vivia na
memória), subir pra reler puxava de volta pro fim a cada mensagem nova, e
conversa esperando a equipe não chamava atenção de longe. As duas primeiras
estão corrigidas; a terceira virou uma pulsação lenta de 2,4s, lenta de
propósito, porque alarme rápido a pessoa aprende a ignorar em dois dias.

## 19/08: a tela que prometia cobrar e não cobrava

A tela de Recuperar orçamento abria dizendo, com todas as letras, que "o
sistema cobra sozinho na hora certa", e mostrava um selo verde escrito
Ativada. As duas coisas eram mentira, e a mentira tinha três camadas:

1. Nenhum caminho do código jamais marcou um pedido como `orcado`, que era
   exatamente o status que a consulta da tela procurava. No banco real: zero.
   A tela ficava vazia pra sempre, e cheia de exemplos quando não havia banco,
   que é o pior dos mundos porque em demonstração ela parecia funcionar.
2. Nada no sistema mandava a mensagem de cobrança. A coluna `cobrancas` nunca
   foi incrementada e `cobrado_em` nunca foi escrita, então o card de
   "recuperado este mês" também ficava em R$ 0,00 pra sempre.
3. O interruptor de ligar e desligar era estado da própria tela. Nascia
   ligado, e desligar não desligava nada porque não havia nada rodando.

O erro de origem foi procurar o orçamento parado no lugar errado. Ele não
mora na tabela de pedidos: mora em `pedido_montagem`, onde a Dora anota item
por item enquanto conversa. Cliente que montou e sumiu tem itens ali e nenhuma
linha em pedidos. Confirmado no banco: 11 conversas nessa situação, contra 14
que fecharam, e nenhuma das 14 aparece na lista.

O preço vem do mesmo motor de orçamento que a Dora usa na conversa. Não é
elegância: é pra o valor da tela bater com o que ela falou pro cliente, até
no arredondamento do centavo.

A cobrança enviada fica guardada como mensagem da conversa, com autor próprio
e rótulo "Cobrança automática" no chat. A dona precisa ver o que saiu em nome
dela, e um histórico que vive na conversa não se perde quando a montagem é
reescrita pela mensagem seguinte.

**Dois relógios.** A lista mostra quem parou faz 1 hora; a cobrança automática
só entra depois de 6. Quem age na lista é gente, e gente escolhe a hora de dar
um alô. Quem escreve na cobrança é um robô, e robô não lê a situação.

**Duas travas, e as duas precisam estar abertas** pra qualquer mensagem sair:
a do ambiente (`COBRANCA_AUTOMATICA=1`), que é nossa enquanto testamos, e a do
negócio, que é da dona. A rodada simula por padrão: mostra quem seria cobrado,
com que texto e por quê, sem escrever pra ninguém.

**A janela de 24 horas da Meta.** Texto livre só é aceito até 24h depois da
última mensagem do cliente. Passou disso, só template aprovado, e não temos um
configurado. Então a cobrança não tenta e diz que precisaria de template, em
vez de falhar calada. Isso limita bastante o alcance: quem sumiu ontem à noite
só pode ser alcançado com template. É a pendência real dessa funcionalidade.

**O que falta pra ela rodar sozinha:** um relógio no servidor chamando
`/api/cobranca/rodar` com o segredo no cabeçalho. Enquanto isso não existe, a
tela serve pra dona ver quem cobrar e cobrar na mão, que já é a maior parte do
valor.

## 19/08, madrugada: a varredura das oito telas

Cada tela foi medida no monitor e no aparelho, com número, não com olhada.
Vinte e cinco defeitos, e os que valem lembrar são os que não pareciam
defeito.

### Dinheiro

**Três pedidos sumiam da conta, e junto R$ 1.662,50.** Resultados dizia "11
pedidos que entraram", Clientes contava 14, e Aguardando confirmação mostrava
3 cartões que não apareciam em número nenhum. "Entrou" somava só o que já
estava na fila de aprovação; o pedido parado esperando valor de topo de bolo
não entrava em lugar nenhum, embora tenha entrado de verdade. Duas telas se
contradizendo fazem a dona parar de acreditar nas duas, e esse é o dano maior
que o número errado.

**Pedido sem data de retirada ia pra fila.** Existia no banco um pedido com
hora 17:00 e nenhuma data, mostrado como "- · 17:00": um tracinho discreto do
lado de uma hora que parece certa. A dona aprova, o papel sai, e a cozinha não
sabe pra que dia produzir. Agora para na mesa da equipe com o motivo escrito, e
onde falta data a tela grita SEM DATA em vermelho.

### A tela mentindo

**"Cliente visualizou a cobrança" em dez dos onze orçamentos parados**, sem
nenhuma cobrança ter sido enviada por ninguém. A consulta comparava a última
mensagem do cliente com a data da última cobrança e, não havendo cobrança,
usava o começo dos tempos como referência. O efeito prático era pior que o
bug: a dona olharia dez clientes marcados como já avisados e não ligaria pra
nenhum. A tela que existe pra recuperar dinheiro estaria impedindo a
recuperação.

**"Já compraram: R$ 0,00"**, onde o rótulo pede gente e o valor entrega
dinheiro. Lia-se como "ninguém comprou nada".

### O celular

Sete defeitos que não existiam em 1440px, e três impediam trabalho. O pior:
**pelo celular ninguém aprovava pedido**, porque o botão ficava das 382px às
533px numa tela de 390, dentro de um cartão sem rolagem lateral. A causa era um
`shrink-0` que travava a largura no conteúdo e impedia o `flex-wrap` que já
estava ali de disparar.

Depois: o balão de ajuda saindo 39px pela borda e cortando palavra no meio, o
ícone de imprimir ticket com 15px (o menor alvo do painel), o telefone do
cliente com 19,5px em onze cartões.

### A conversa

**A Dora nunca perguntava o dia.** A cliente pediu 50 coxinhas, disse "pode ser
as 17h", disse o nome e o pix. Três respostas oferecendo mais salgados, nenhuma
perguntando a data. A trava de não registrar sem data funcionou (nenhum pedido
furado foi criado), mas a venda evaporava igual: a cliente saía achando que
tinha encomenda marcada.

Escrevi a regra no prompt e testei: **não adiantou**, ofereceu mais salgados de
novo. Passei pro código, e aí funcionou. É a regra da casa mais uma vez:
decisão que custa dinheiro mora no código, não no prompt.

**E "sexta" não valia como data.** A cliente disse "sexta", a Dora confirmou
"você quis dizer sexta-feira, dia 21/08/2026?", a cliente disse "isso", e o
sistema pediu a data "no formato dia/mês, tipo 21/08". A trava do dd/mm existe
por bom motivo, mas tratava dia da semana como lixo, e dia da semana é como se
marca encomenda de padaria. O teste está em `testes/dia-da-semana.cjs` e roda
contra o código real extraído do arquivo: na primeira tentativa a função
devolvia nulo pra tudo porque uma barra de escape saiu dobrada, e só rodando
isso apareceu.

### O que essa noite ensinou

1. **Defeito de tela só aparece no aparelho em que a pessoa trabalha.** Nenhum
   dos sete do celular era visível no monitor.
2. **Tela escondida por CSS continua montada, e continua buscando.** O painel
   batia duas vezes em cada rota por isso, justamente nas que mais dão 502.
3. **Testar a trava acha mais que testar o caminho feliz.** Todos os meus
   testes anteriores davam a data, porque eu escrevia clientes que colaboram.
4. **Regra no prompt não é regra.** Duas vezes nesta noite o modelo ignorou uma
   instrução explícita e só o código resolveu.

## EM ABERTO: a conversa de festa não é consistente

Este é o item honesto que fica para a próxima sessão, com prova.

Rodei a MESMA conversa de festa três vezes, palavra por palavra igual:

```
festa de 25 pessoas dia 12/09
salgado e docinho, o que voce indicar
pode ser
e um bolo de 2 kg de ninho
pao de lo branco, com topo tema princesa
a menina eh a Alice, faz 5 anos
as 16h, nome Fernanda, cartao
```

Três resultados diferentes:

1. **Primeira vez:** sugeriu salgados, docinhos e bolo. Travou pedindo a cor da
   forminha e terminou com uma desculpa falsa de não ter entendido.
2. **Segunda vez:** mesma trava na forminha, e a desculpa falsa saiu DUAS vezes
   seguidas, palavra por palavra igual.
3. **Terceira vez:** sugeriu só os salgados, esqueceu de sugerir os docinhos, e
   ficou pedindo os docinhos até o fim. Guardou o bolo certo (pão de ló branco,
   topo tema princesa, Alice 5 anos), o que as outras duas não fizeram.

Nenhuma das três fechou o pedido. As duas desculpas falsas já estão
corrigidas, e a segunda vez virou chamada pra equipe em vez de parede. Mas a
instabilidade em si continua: a festa é o pedido mais caro da padaria
(R$ 523,50 neste roteiro) e é justamente o caminho mais longo, com mais coisas
pra ela lembrar de perguntar.

Os outros caminhos fecham de forma consistente, conferidos no banco na mesma
bateria: dia da semana (sábado virou 22/08 às 10:00, R$ 162,50), por quilo
(2 kg de cuca de chocolate, R$ 53,80, unidade kg correta), salgado simples
(30 esfirras de carne, R$ 37,50) e o cliente que só pergunta, que corretamente
não virou pedido.

**A hipótese pra investigar:** a sugestão de festa entrega salgado, docinho e
bolo numa tacada só, e depois disso a Dora precisa segurar muita coisa em
aberto ao mesmo tempo (sabor de três salgados, cor de forminha, sabor e
detalhes do bolo, tema, aniversariante, nome, hora, pagamento). Quando ela
perde um desses, entra em laço pedindo o mesmo item. Vale testar quebrar o
fechamento da festa em etapas com estado explícito, do jeito que o dia da
retirada foi resolvido: no código, não no prompt.

---

## 20 de agosto de 2026, madrugada

O método mudou, e essa foi a mudança que mais rendeu. Até aqui eu consertava o
CASO: "cuca de goiaba" recusada virava um conserto pra cuca de goiaba, e uma
semana depois o mesmo defeito voltava chamado "pizza de forma". Agora cada
defeito achado vira uma varredura da CLASSE, com teste que percorre o catálogo
inteiro, e produto novo já nasce coberto.

A ideia que destravou foi do dono: **ler o rastro em vez de adivinhar**. Com o
log de chamada de ferramenta ligado, oito defeitos caíram em uma hora, e sete
deles eram guarda MINHA bloqueando a Dora fazendo a coisa certa.

### O que estava fazendo o cliente desistir

| Defeito | O que acontecia | Correção |
|---|---|---|
| Assado virava frito | A secretária pediu 200 salgados ASSADOS e recebeu "40 mini bolha, que é o pastel frito da casa" | A família é escolha da conversa inteira, não da última frase, e vale o último que ele falou. Além disso `anotar_item` recusa frito pra quem pediu assado por qualquer caminho |
| Reclamação virava pedido | O cliente irritado escreveu "já te falei 3 vezes" e ela respondeu "A gente não tem vez também" e "Não temos docinho vezes" | Só acusa produto inexistente se a frase for mesmo pedido: verbo de comprar ou palavra do cardápio junto do número |
| Mudar o total virava negociação | 200 salgados pra 150: ela pediu licença três vezes e gastou seis mensagens numa divisão | O código refaz a conta sozinho, mantendo os sabores que ele escolheu, com a soma exata |
| Pergunta virava item | "e bolo 0% lactose vocês fazem?" criava um item, porque o "0%" era lido como quantidade | Porcentagem, data e hora saem antes de procurar quantidade, e o nome do produto casa por qualquer palavra significativa |
| Item entrado por engano nunca saía | Ela dizia "não anotei nada" com o item ainda na tela | Guarda nova: quando ele diz que não vai comprar, o código limpa a montagem |
| Sabor arrastava o vizinho | Pediu "bacon com brócolis" e entrou "bacon com milho" | Sabor de uma palavra só casa com sabor de uma palavra; sabor composto exige a frase inteira |
| Data brigava com o dia | "quarta-feira, dia 27/08" numa semana em que a quarta era 26 | A palavra do cliente vence a aritmética dela |
| Transferência não existia | Pagamento por TED ou depósito não era reconhecido | Transferência e boleto entraram, e vale sempre o último que ele falou |

### O ponto cego do medidor

O medidor dava nota cheia enquanto TODA venda de pizza estava morta: o rastro
mostrou a Dora chamando `anotar_item` de pizza oito vezes numa conversa e a
guarda recusando as oito, porque o cliente escreve "pizza de forma" e o
catálogo diz "pizza inteira". O medidor não tinha cenário de pizza.

Medir só o que já funciona é o jeito mais fácil de passar. Agora ele tem oito
cenários, com pizza, assado que não pode virar frito, e mudança de total
julgada pela SOMA das quantidades no banco: se ainda mostra 200, ela conversou
e não fez.

### Regra que ficou

Guarda que trava venda é pior que o bug que ela evita. Toda guarda nasce com
teste dos dois lados, e o lado "deixa passar o legítimo" varre os 86 produtos
do catálogo, não um exemplo.

### Segunda leitura, agora das conversas inteiras no banco

Depois de consertar as classes acima, li as duas conversas longas de ponta a
ponta em vez de olhar o pedido final. As duas fecharam com o pedido CERTO
(R$ 612,30 e R$ 320,00), e as duas foram atendimentos ruins. Olhar so o
resultado teria dado alta nas duas.

| Defeito | O que acontecia | Correção |
|---|---|---|
| Aceite ignorado | "pode ser assim" e ela devolvia "quais salgados você quer e quantos de cada?". O cliente repetia item por item e escrevia "já falei 1 vez" | Aceitar oferta virou trabalho do código: ele lê a lista da própria mensagem dela e anota |
| A conta dela entrando no pedido | Ela ofereceu 100 salgados pra quem pediu 200, e comeu o nome do quarto docinho | Quando a soma da família não bate com o pedido, o sortido do código entra no lugar |
| Sortido com metade | O total era lido só da última frase; o "200 salgados" tinha sido dito três mensagens antes | O total sai da conversa inteira, e cada família tem o seu |
| Orçamento de R$ 2,25 | Ela pediu orçamento de festa antes de perguntar quantas pessoas; com zero pessoas o motor cota uma unidade de cada | Sem número de convidados a ferramenta recusa e manda perguntar |
| Conferência negada | "me manda o pedido final pra eu conferir, item por item" foi ignorado duas vezes | O código monta a lista e manda ela enviar exatamente aquilo |
| Cardápio recomeçando a conversa | Com tudo anotado, ela despejou as duas peças de cardápio logo depois de "não apaga os docinhos" | Cardápio não vai pra quem já escolheu aquela família, nem pra quem recusou |
| Recusa gravada que nunca valeu | O campo `nao_quer` guarda "docinho", uma lista, e a guarda exigia frase de negação: a recusa gravada nunca bloqueou nada | Lista é lista, e agora bloqueia. Achado pelo teste, não pela conversa |

O ganho maior não foi nenhum desses sozinho. Foi descobrir que **quatro
respostas absurdas da mesma conversa tinham uma causa só**: a função que
detectava produto inexistente lendo qualquer número seguido de palavra. Ela
produziu "A gente não tem vez também", "A cor azul a gente não tem", "O topo
tema dinossauro a gente não tem" e uma acusação inventada de que o pedido tinha
150 docinhos de cada sabor, que quase fez a cliente mandar apagar itens certos.

### O mesmo erro de leitura, em quatro lugares diferentes

Lendo as conversas apareceu um padrão que vale mais que os defeitos em si:
**quatro guardas diferentes liam só a última mensagem do cliente**, e todas
falhavam pelo mesmo motivo, cada uma de um jeito.

| Guarda | O que o cliente falou e quando | O estrago |
|---|---|---|
| Família do sortido | "200 salgados ASSADOS", três mensagens antes | Ofereceu fritos |
| Total do sortido | "200 salgados", três mensagens antes | Ofereceu 100 |
| Data x dia da semana | "sábado às 10h", na primeira mensagem | Pedido saiu com quinta-feira |
| Preço por família | "e o docinho, quanto fica" | Resposta sem número nenhum, essa por ordem das palavras |

Conversa não é a última mensagem. Tudo que o cliente disse continua valendo até
ele mudar, e é o último que ele falou que manda. As quatro passaram a ler a
conversa inteira, e as quatro ganharam teste com a frase real.

A do preço tinha ainda outro vício: o gatilho exigia "quanto custa o docinho"
nessa ordem exata. A cliente escreveu "e o docinho, quanto fica" e recebeu de
volta "Te mandei o cardápio de docinhos aqui", sem número, depois de ter
recebido o preço dos salgados na mensagem anterior. Ela parou de responder ali.

### A medição que reprovou meus próprios consertos

Primeira medição com os oito cenários, 40 conversas reais contra o container
já com todas as correções da madrugada. Resultado: **4 de 8 cenários passaram
as cinco execuções**.

```
pass^5  pergunta de preco nao vira item          5/5
pass^5  produto que a padaria nao faz nao entra  5/5
pass^5  festa com quatro familias fecha          5/5
pass^5  cor da forminha nao volta a ser perguntada 5/5
FALHOU  troca de bolo nao duplica                3/5
FALHOU  quem pede assado nao recebe frito        2/5
FALHOU  pizza fecha e nao e recusada             1/5
FALHOU  mudar o total nao vira negociacao        0/5
```

Os três piores eram defeitos MEUS, e dois deles eu tinha acabado de escrever.

**Pizza 1/5: a observação virou bilhete.** A Dora chamava `anotar_item` com
`obs: "para sexta as 19h, sabor calabresa nao existe, ofereco calabresa
acebolada ou calabresa?"`. Ela escrevia o raciocínio dentro do campo que vai
pra comanda da cozinha. A guarda de observação inventada achava "calabresa
acebolada", que o cliente nunca disse, e recusava o item INTEIRO. Oito recusas
numa conversa, com o cliente tendo pedido calabresa, que existe no cardápio.
Correção: limpar em vez de recusar. A deliberação sai, a ficha fica.

**Mudar o total 0/5: banco vazio, nada escrito.** O sistema mandava "OFEREÇA
EXATAMENTE ISTO: 40 esfirra, 40 empadinha..." e, quando ela obedecia, a guarda
de produto fantasma recusava com "ninguém falou nesse produto nesta conversa,
nem o cliente nem você". Era verdade e era irrelevante: quem falou foi o
SISTEMA. Ela ficava presa entre uma ordem e uma proibição, as duas minhas.
A ferramenta de sortido já registrava o que sugeria; a sugestão feita pelo
código não registrava. Mesma sugestão, dois caminhos, só um reconhecido.

**Assado 2/5: meu atalho pulou minha guarda.** O banco terminou com 67 coxinha,
67 mini bolha e 66 esfirra num pedido de assados. O rastro mostrava
`anotar_item` recusando a coxinha certinho, e a coxinha estava lá assim mesmo:
a via de aceite que eu criei escreve direto na montagem, sem passar por
`anotar_item`, e passou por fora da guarda que eu tinha escrito horas antes.

Atalho de código que ignora guarda é pior que não ter guarda, porque o teste da
guarda passa verde e o defeito continua chegando no cliente. Foi só a medição
com conversa de verdade que pegou.

### Segunda medição: 5 de 8, e o que ela cobrou

Mesmos oito cenários, container `119e79b`, rastro salvo em arquivo ANTES de
qualquer commit (a lição da rodada anterior).

```
                                            1a rodada   2a rodada
troca de bolo nao duplica                      3/5         5/5
pergunta de preco nao vira item                5/5         5/5
produto que a padaria nao faz nao entra        5/5         4/5
festa com quatro familias fecha                5/5         5/5
cor da forminha nao volta a ser perguntada     5/5         5/5
pizza fecha e nao e recusada                   1/5         5/5
quem pede assado nao recebe frito              2/5         2/5
mudar o total nao vira negociacao              0/5         2/5
```

**Existiam DUAS guardas de produto fantasma.** Com textos diferentes, no mesmo
arquivo. Consertei uma e não sabia da outra. O rastro mostrou a segunda
recusando coxinha, croquete, bolinha de queijo, quiche, pastel assado e
croissant, cinco vezes cada, todos itens que o próprio sistema tinha mandado
ela oferecer. Ela ficava presa entre uma ordem e uma proibição, as duas minhas.
E a segunda tinha os dois mesmos buracos da primeira: lia só a última fala e
não conhecia o sortido do código.

**Meu conserto do assado criou outro defeito.** O filtro de família tirou os
fritos e deixou o pedido com uma linha de 66 esfirras onde a cliente pediu 200
salgados assados. Antes ela recebia 200 com frito no meio; depois do meu
filtro, 66 e mais nada. Nenhum dos dois é atender. Tirar o errado sem repor o
certo é outro erro, e agora a conta é refeita na família certa com soma exata.

**O achado que passa de prejuízo.** O pedido fechou com
`30 brigadeiro (sem lactose, forminha rosa)`. A cliente PERGUNTOU se tem
docinho sem lactose, a Dora respondeu certo que a padaria não faz, e a
restrição foi parar na observação assim mesmo. A observação vai pra comanda da
cozinha e pro resumo que o cliente recebe: a padaria produziria brigadeiro
normal e entregaria pra alguém que leu "sem lactose" na confirmação. Com
intolerância de verdade isso deixa de ser prejuízo e vira problema de saúde.

O arquivo de fatos já impedia ela de AFIRMAR isso na conversa. O campo de
observação era a outra porta, e estava aberta. A guarda limpa em vez de
recusar, porque o brigadeiro é uma venda de verdade: sai só a promessa que a
cozinha não cumpre.

**O padrão que se repete:** três das quatro correções desta rodada foram em
código que eu tinha escrito nas horas anteriores. Não é falta de cuidado com o
código novo, é o custo de mexer num sistema com muitos caminhos para o mesmo
lugar. Por isso a medição vale mais que o teste, e por isso ela roda inteira
depois de cada leva de correção, nunca antes de dormir achando que acabou.

### A terceira guarda, e por que conserto pontual não acha as outras

Terceira medição: **6 de 8**. Os dois que sobraram tinham o mesmo sintoma dos
piores da noite, banco **vazio**, e os dois eram o mesmo cenário de fundo: o
cliente pede pra ela escolher os tipos.

O rastro mostrou o que eu vinha errando há três rodadas. O sistema escreve
"OFEREÇA EXATAMENTE ISTO: 40 esfirra, 40 empadinha, 40 pastel assado, 40 quiche,
40 croissant". A Dora obedece e chama `anotar_item` cinco vezes. E cinco vezes
o código recusa, por **três guardas diferentes**:

| Guarda | O que ela dizia |
|---|---|
| produto fantasma 1 | "ninguém falou nesse produto, nem o cliente nem você" |
| produto fantasma 2 | "ninguém falou em esfirra nesta conversa" |
| quantidade | "o cliente nunca falou em 40 de esfirra" |

Cada uma dizia a verdade e cada uma era irrelevante: quem falou foi o SISTEMA,
na mesma resposta. Ela ficava presa entre uma ordem e uma proibição, as duas
minhas, e o pedido terminava vazio.

Consertei a primeira e medi: 0/5 continuou 0/5. Consertei a segunda e medi:
subiu pra 2/5. Só na terceira rodada o rastro mostrou a de quantidade.

**A lição não é "faltou atenção".** É que existem vários caminhos pro mesmo
lugar, e conserto pontual não acha os outros. Duas guardas com o mesmo
propósito e textos diferentes moravam no mesmo arquivo, e eu consertei uma sem
saber da outra. O que achou as três foi o rastro, nunca a leitura do código.

Por isso o teste novo (`sugestao-do-codigo-nao-e-recusada.cjs`) cobra as três
de uma vez, com a sugestão REAL que o código produz, não com um exemplo
inventado. Se aparecer uma quarta guarda com o mesmo buraco, ela quebra o teste
antes de chegar no cliente.

De quebra, "salgado assado sortido, conforme cardápio" era recusado como sabor
inventado, cinco vezes por rodada. É descrição dela, mesma classe do "forminha
rosa": rótulo dela nunca pode recusar venda.

### 8 de 8

Quarta medição, container `dae2da6`: **os oito cenários acertaram as cinco
execuções**. Quarenta conversas reais, nenhuma falha, julgadas pelo estado do
banco e não pelo texto.

```
              1a rodada   2a rodada   3a rodada   4a rodada
cenarios 5/5     4 de 8      5 de 8      6 de 8      8 de 8
```

O que fez a diferença, em ordem de valor:

1. **Ler o rastro.** Todos os defeitos que resistiram foram achados lendo a
   chamada de ferramenta de verdade, nunca lendo o código nem perguntando ao
   modelo. Nas três rodadas em que um cenário não saiu do lugar, o motivo era
   sempre uma guarda minha que eu não sabia que existia.

2. **Medir depois de cada leva.** Consertar e medir, consertar e medir. Se eu
   tivesse consertado as três guardas de uma vez sem medir entre elas, teria
   dito "está pronto" na primeira e o cliente descobriria o resto.

3. **Consertar a classe.** Os testes que sobraram varrem o catálogo inteiro e a
   sugestão real do código, não um exemplo. Produto novo no cardápio já nasce
   coberto.

**O que isso NÃO significa.** pass^5 em oito cenários não é "a IA está pronta".
Significa que estes oito caminhos, que cobrem os defeitos que já custaram
dinheiro, ficaram estáveis em cinco execuções cada. Cliente real inventa
caminho que nenhum cenário tem, e é pra isso que existe o botão Reportar na
tela de atendimento.

---

## 20 de agosto de 2026, tarde e noite: o dia da entrega

O dono testou na tela junto comigo. Apareceram 14 defeitos que NENHUMA das
quatro medições e nenhum dos 37 testes tinha pego. Todos apareceram porque um
cliente andou por um caminho que os cenários não cobriam, quase sempre um bolo
com topo.

### Os que só apareceriam no dia da retirada

| Defeito | O que acontecia |
|---|---|
| Pedido nunca registrado | Cliente dizia "pode fechar", ouvia "posso passar pra equipe?", ia embora achando que encomendou. Não existia pedido |
| Peça do topo impossível de fabricar | Nunca perguntava nome e idade do aniversariante |
| 37 docinhos sumindo | O teto de tokens cortava o JSON: `{"produto":"leite"}` no lugar de "leite ninho, 37" |
| 60 salgados sumindo | Recheio inventado fazia a guarda apagar o item inteiro |
| Bolo e topo recusados | Ela dizia "anotei" com o pedido vazio no banco |

### As três camadas do pedido que não fechava

Esse levou três tentativas, e nas duas primeiras eu **adivinhei** a causa e
errei. Só resolveu quando parei e coloquei uma linha de rastro dizendo qual
condição barrava. A resposta veio de primeira e não era nenhuma das minhas duas
hipóteses:

1. A decisão de fechar usava a foto do pedido de **antes** da mensagem
2. A montagem nunca era atualizada depois das ferramentas do turno
3. Quem decide se dá pra fechar **não recebia a conversa do cliente**

O rastro mostrou a evolução em duas linhas do mesmo turno, com a resposta na
tela: `falta o NOME e a IDADE` na primeira volta, `falta a IDADE` na segunda,
com "nome do aniversariante Theo, 7 anos" escrito na própria observação.

### O que eu quebrei e tive que consertar

**A guarda do valor do topo mutilou o resumo do pedido.** O cliente pediu "sem
topo" e a linha do bolo tinha a palavra "topo" e um valor: a guarda apagou a
linha inteira. O cliente recebeu `Seu pedido ......... Total R$ 628,20`. A
guarda ficou pior que o defeito que ela evitava.

**A bateria do painel mexia no pedido de outra pessoa.** Ela clicava no
`.first()` card da tela. O dono deixou um pedido de demonstração na fila e saiu
de casa; quando voltou, o pedido estava com R$ 25 de topo lançados e liberado
pra aprovação, com a Dora perguntando e respondendo sozinha. E isso rodava
contra o painel de PRODUÇÃO: num dia com pedido real na fila, teria lançado
R$ 25 no pedido de um cliente e mandado mensagem pra ele.

**Eu culpei o cache do navegador dele por um erro meu.** A linha do papel de
arroz continuava aparecendo e eu mandei limpar cache e abrir janela anônima. O
componente tem duas listas de item, e eu tinha filtrado a somente-leitura em
vez da editável. O que resolveu foi ler o código, não insistir na hipótese.

### A regra que atravessa quase tudo

O código sabia a informação e quem decide não recebia: ou lia só a última
mensagem, ou lia um estado velho, ou não repassava a conversa adiante.

E a segunda: **prompt é sugestão**. A persona mandava não chutar valor de topo,
com todas as letras, e ela chutou. Mandava registrar o pedido AGORA, e ela
perguntou "posso passar pra equipe?". As duas viraram código: guarda que apaga
o valor, e `tool_choice` obrigando a chamada quando não falta nada.


---

## 31 de agosto de 2026: o dia em que conversar achou o que 130 testes não achavam

O dono fechou o primeiro pedido de festa ponta a ponta pelo WhatsApp, mandou os
prints e a foto dos cupons impressos, e apontou catorze defeitos. Todos foram
fechados. Depois disso ele mandou refazer o pedido dele conversando de verdade,
mensagem por mensagem, e a conversa achou mais sete que nenhum teste pegava.

### O que os catorze eram, e o que ficou de lição

**Cinco custavam dinheiro na hora:**

1. `sem lactose` não entrava no pedido. A IA prometia confirmar com a equipe e o
   item sumia, e a equipe também nunca era avisada: o cliente esperava um
   retorno que ninguém sabia que devia. A dona já tinha respondido isso em áudio
   (`docepao1608 (3).txt`): dá pra misturar, vale o valor mais caro. Hoje vira
   `bolo brigadeiro com 0% lactose`, R$ 55,90 o quilo.

2. O papel de arroz sumia ao salvar. A caixa de marcar lia a observação do bolo,
   e o painel jogava a linha fora antes de salvar apostando que o servidor
   recriava. **Esse código do servidor nunca existiu**: procurado nos dois
   arquivos em 31/08. Todo pedido com bolo que a dona salvasse perdia R$ 12,00.

3. A cor da forminha era invenção do modelo. O cliente nunca falou de cor e o
   pedido saiu com "forminha rosa" em 100 docinhos.

4. A frase crua virava recheio na comanda: `> frito | quero carne`, impresso.

5. O nome do aniversariante não chegava no campo da equipe.

**A raiz de três deles era a mesma:** a observação do item não tinha formato. O
fluxo juntava com `" | "`, o cupom corta na vírgula e o painel procura `nome X`
até a vírgula. Três leituras, nenhum acordo. Virou `lib/banco/obs-do-bolo.ts`,
com as duas pontas no mesmo arquivo e um teste de ida e volta.

### Os sete que só a conversa achou

O portão tinha 130 testes verdes quando esses aconteceram:

1. **A guarda anti-invenção inventava.** O modelo devolveu `mini sanduíche de
   patê de frango` pra quem respondeu "frango". A guarda arrancou as palavras
   não ditas e produziu `mini frango`, que não existe em cardápio nenhum. E o
   motor casa nome por pedaço: cotava a linha fantasma como pizza inteira de
   strogonoff, **R$ 120,00**.

2. **Item descartado segurava o sabor.** `donoNaFrase` era montado da leitura
   crua, incluindo item que o fluxo tinha jogado fora: o risóles nunca recebia o
   frango e a padaria repetia a pergunta pra sempre.

3. **"Sim" digitado se perdia.** Texto livre vai pro modelo, e pra "Sim" seco
   ele devolveu leitura vazia. Sumiam o papel de arroz (R$ 12,00), o topo, o
   tema e o nome do aniversariante. No teste do dono isso não apareceu porque
   ele **tocou nos botões**.

4. **A etapa se dá por cumprida quando a pergunta foi FEITA, não respondida.**
   Por isso o "Sim" do topo continuava se perdendo mesmo depois de o do papel
   funcionar: no turno da resposta, a etapa da vez já era outra. O sinal certo é
   a última pergunta que saiu, não a etapa.

5. **O recheio fixo dependia da memória do modelo.** "coxinha é de frango" está
   no catálogo com `saborFixo`, e mesmo assim a comanda só trazia o recheio
   quando o modelo lembrava. Medido: mesma fala, duas conversas seguidas, uma
   com frango e outra sem.

6. **"frango" foi lido como delegação.** O modelo entendeu a resposta do recheio
   como "escolhe você", e a delegação monta sortido sozinha.

7. **O custo da IA virou zero em 27/08.** 2.400 chamadas com R$ 0,00 nas duas
   colunas e 1,2 milhão de tokens gastos. `estimarCustoCentBRL` arredondava pra
   centavo inteiro, e `uso.ts` tinha consertado a precisão do lado dele, com
   comentário e tudo, uma função acima.

### As travas que nasceram disso

Ordem do dono, e ela vale pro sistema inteiro: *"o que tem no cardápio não mexe;
não tem como colocar um produto que não existe o nome, pra isso que separei tudo
bonitinho"*.

- **Nenhuma linha do pedido carrega nome que o cardápio não tem.** Roda no fim do
  fluxo, em todo caminho. Nome de família ("pizza" esperando o tipo) continua
  valendo.
- **Produto de sabor único já sai com o sabor dele**, do catálogo, antes da
  disputa de sabor.

### O que este dia ensinou, e vale mais que os consertos

**Guarda minha errou mais que o modelo.** Dos sete achados conversando, quatro
eram código meu decidindo errado, e o mais caro (R$ 120) era a guarda que existe
justamente pra impedir invenção.

**Ler o código não achou a causa; o log achou.** Chutei a causa do `mini frango`
duas vezes antes de ir ler o log do container. As duas estavam erradas, e a
segunda me fez consertar uma coisa que não era o defeito.

**Sonda com resposta de modelo inventada por mim mente.** Duas vezes eu montei a
leitura do modelo à mão, o caso passou, e a produção continuou quebrada. A
terceira vez eu peguei do log a resposta REAL e reproduzi de primeira.

**Duas regras certas fazem o errado juntas.** O carimbo do recheio fixo tirou a
coxinha da disputa pela palavra "frango", e a frase caiu na pizza, que nem tem
frango na lista. Um teste que já existia pegou antes de subir.

**Teste verde não é sistema certo.** 130 verdes e sete defeitos numa conversa de
quinze mensagens.

## 31/08 de madrugada, o pão por quilo

Ele mandou a regra: "se a categoria eh KG nao UNID tu fala pra ele, q eh em kg,
ai tem escolher em kg nao em quantidade". Fiz, subiu, e fui conversar com a
produção fingindo ser cliente. Dois defeitos apareceram na mesma conversa curta.

**O beco.** A padaria perguntava "quantos quilos você quer?", eu respondia
"2 kg", e ela perguntava de novo. E de novo. O peso só era lido dentro do laço
dos itens que o modelo devolve, e quem responde só o peso não cita produto
nenhum: o modelo devolvia lista vazia, o laço não rodava uma vez sequer e a
resposta sumia. Os dois testes que existiam passavam verdes porque a sonda
mandava o item na leitura. A sonda estava respondendo no lugar da produção.

**A linha que engana.** O resumo fechou "- 2 pao frances R$ 11,99/kg =
R$ 23,98". A conta está certa e a leitura não: parece dois pães. O "kg de"
estava preso à categoria bolo, e por quilo a casa vende 31 produtos.

**A pergunta sem motivo.** Pedi o pix, a IA chamou a equipe, e o painel recebeu
`handoff` com o motivo vazio. Era o mesmo buraco da reclamação, que eu já tinha
fechado, num caminho diferente.

### O que este dia ensinou

**Sonda que entrega o item pronto testa a si mesma.** Os dois casos de peso que
já existiam continuavam verdes com o defeito no ar, porque nenhum deles perguntou
o que acontece quando o modelo não lê nada. Resposta a pergunta fechada se testa
com `itens: []`.

**Buraco fechado num caminho não fecha nos outros.** O motivo do handoff eu já
tinha consertado na reclamação. A resposta de informação era outra porta, e
estava aberta.

**Conta certa e tela errada é defeito.** O cliente não confere a multiplicação,
ele lê a linha.

## 31/08, madrugada adentro: conversando como cliente

Depois do pão, continuei conversando com a produção fingindo ser cliente, uma
mensagem por vez, lendo cada resposta. Sete defeitos, todos medidos, nenhum
achado lendo código.

**O pedido fechou COM a peça que eu recusei por escrito.** Escrevi "nao quero
topo nem papel de arroz". O atalho do botão digitado pegou só a peça que estava
sendo perguntada, aplicou o não nela, e não chamou a IA: o "topo" da mesma frase
foi pro lixo, ela perguntou de novo, e a comanda saiu com topo. Isso é "nada some
do pedido" ao contrário: não sumiu, entrou o oposto. E o topo é o único item da
casa sem preço de tabela.

**Quatro vezes a mesma pergunta.** A cor da forminha foi perguntada quatro vezes
seguidas, comendo minhas respostas. A pergunta só saía da frente quando o cliente
mudava alguma coisa no pedido; quem responde coisa que ela não entende ficava
preso pra sempre. Agora a quarta vez chama a equipe, com o motivo.

**Pedi um bolo e saí com um docinho.** "queria encomendar um bolo de aniversário"
não vira item nenhum: não há produto na frase, só a família. Sem item, a abertura
nunca fica cumprida, a padaria pergunta "o que você vai querer?" pra sempre, e
"brigadeiro" cai no docinho de R$ 1,25 em vez do bolo de R$ 46,90 o quilo.

**O plural não era família.** "quero salgado" achava; "queria uns salgados pra
amanhã" não achava nada. Valia pra salgados, docinhos, doces, salgadinhos, que é
o jeito normal de escrever.

**A pergunta que mais importa não tinha resposta.** "vocês fazem bolo sem
lactose?" ouvia a tabela de preço do bolo. A casa FAZ: 0% lactose é sabor de
festa da faixa C. Quem pergunta por restrição pergunta antes de tudo e vai embora
com o silêncio.

**E depois de responder, o pedido não entendia.** "quero um sem lactose de 1 kg"
virava a família bolo com "sem lactose" na observação, e ela perguntava o sabor
que eu tinha acabado de escolher.

**A conta certa com a linha errada.** "- 2 pao frances R$ 11,99/kg = R$ 23,98"
são dois quilos, e qualquer um lê dois pães.

### O que este dia ensinou

**Sonda que entrega o item pronto testa a si mesma.** Os dois testes de peso que
já existiam continuavam verdes com a produção quebrada, porque nenhum perguntava
o que acontece quando o modelo não lê nada. Resposta a pergunta fechada se testa
com o modelo devolvendo vazio.

**Um defeito escondia o outro.** O "sem lactose" no pedido só apareceu depois que
ela aprendeu a responder que faz. Consertar abre a porta pro próximo, e por isso
conversar de novo depois de cada deploy é parte do conserto.

**Conta certa e tela errada é defeito.** O cliente não confere a multiplicação,
ele lê a linha.
