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
