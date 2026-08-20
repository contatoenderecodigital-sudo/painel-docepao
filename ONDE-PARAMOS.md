# Onde paramos, 20/08/2026 madrugada

Documento de retomada. Leia isto antes de mexer em qualquer coisa.
O plano que gerou este trabalho está em `PLANO-FINAL.md`. O histórico de cada
defeito, com a frase real do cliente, está em `DIARIO-DA-IA.md` e
`testes/casos-reais.md`.

## O que mudou hoje, em uma frase

O sistema saiu de "testado por impressão" para "testado por medida": existem 31
testes que travam o commit, um medidor que roda oito conversas cinco vezes cada
e julga pelo estado do banco, e uma bateria de clientes simulados ao vivo.

## ANTES DE CULPAR A IA, LEIA O RASTRO

Foi a coisa mais produtiva do projeto, e a ideia foi do dono.

```
ssh root@179.198.126.197 'docker logs $(docker ps --format "{{.Names}}"|grep "^uyyqf7kzymaxlyq9kl") --since 10m 2>&1 | grep "\[rastro\]"'
```

Sai toda chamada de ferramenta com os argumentos e a resposta do código. Em uma
hora isso achou três defeitos que os relatórios de teste não achavam, e **nos
três a IA estava fazendo certo**:

1. Eu bloqueava TODA venda de pizza. Ela chamou `anotar_item` com o produto e os
   sabores certos oito vezes, e a guarda recusou as oito, porque o cliente
   escreve "pizza de forma" e o catálogo chama "pizza inteira".
2. 200 salgados sumiam em silêncio: ela registrava o nome da CATEGORIA no lugar
   dos produtos, e R$ 250 evaporavam.
3. A guarda de produto fantasma matava a sugestão do próprio sistema.

**A variante ruim dessa ideia é perguntar pro modelo por que ele errou.** Não
funciona: sem fonte externa o modelo às vezes piora depois de se autocriticar, e
inventa uma explicação plausível que faz você consertar a coisa errada. O rastro
não mente; a explicação dele mente.

**Consequência prática:** guarda nova nasce com teste dos DOIS lados, e o nome
do catálogo nunca é o nome que o cliente usa.

**Puxe o rastro ANTES de deployar.** O log vive no container: o deploy troca o
container e leva o rastro junto. Em 20/08 eu perdi o rastro inteiro de uma
medição de 40 conversas porque commitei a correção antes de terminar de ler.
Salve num arquivo primeiro:

```
ssh root@179.198.126.197 'docker logs $(docker ps --format "{{.Names}}"|grep "^uyyqf7kzymaxlyq9kl") --since 60m 2>&1 | grep "\[rastro\]"' > rastro.txt
```

**A medição vale mais que o teste, e reprova o que o teste aprova.** Na primeira
rodada com os oito cenários, 4 de 8 passaram, com os 31 testes verdes. Três dos
quatro reprovados eram defeito meu, e dois tinham sido escritos naquele mesmo
dia. Um deles era um atalho de código que gravava direto na montagem e passava
por fora da guarda que eu tinha acabado de escrever: o teste da guarda passava
verde e o cliente recebia o erro igual.

Teste unitário prova que a peça funciona. Só a conversa inteira prova que as
peças não se atropelam.

## Como testar

```
node testes/todos.cjs        # 19 testes, trava o commit. RODE SEM PIPE.
node testes/medidor.cjs 5    # 5 cenarios x 5 execucoes, julga pelo banco (~25 min)
```

**Nunca rode `node testes/todos.cjs | tail`.** O pipe faz o `&&` seguinte olhar
o código do `tail`, que é sempre zero, e o commit passa com teste quebrado.
Aconteceu três vezes em 19/08.

**Nunca rode teste destrutivo com medição ao vivo no ar.** Os testes de
concorrência e de pausa apagam os telefones deles; antes apagavam o banco
inteiro e destruíram uma medição em andamento.

## O que foi consertado hoje

Por ordem de commit, do mais antigo pro mais novo:

| Commit | O que |
|---|---|
| `39fd2dc` | Cliente recusar o valor devolve o pedido pra fila em vez de sumir num limbo |
| `1b33976` | Bobina acabada segura a fila em vez de queimar as 5 tentativas em 20 segundos |
| `9b27ecf` | Dois destinos de aviso: `ADMIN_WHATSAPP` (técnico) e `DONA_WHATSAPP` (padaria) |
| `8659b84` | Cor de forminha e foto pararam de segurar o registro do pedido |
| `2819fe8` | Ela para de falar preço e endereço que não existem |
| `244a391` | Pergunta de preço para de virar item, e sabor volta a ser escolha do cliente |
| `685c07d` | Produto vira enum: ela não CONSEGUE mais pedir o que a padaria não faz |
| `f6069d5` | A cor da forminha respondida para de ser perguntada de novo |
| `5dccee7` | Trocar item vira UMA operação e para de deixar os dois no pedido |
| `8583fc2` | O resumo que ela fala passa a ser o pedido que está gravado |
| `717213e` | Um comando só roda tudo e TRAVA o commit quando quebra |
| `acaa245` | Política da casa para de ser inventada (mínimo, entrega, prazo, rendimento) |
| `4132262` | As respostas da dona de 19/08 entram no sistema |
| `bc4da1e` | Pedido alterado pela equipe volta a andar sozinho depois do ok do cliente |
| `ac8be48` | A frase do aceite sai do código, e a pausa ganha teste de vazamento |
| `c93a0d6` | Botão de reportar, o caminho do erro até quem conserta |
| `88d9884` | Três defeitos da bateria final, dois criados por mim |
| `8bbbbd5` | As guardas saem do cérebro pra arquivo próprio |
| `fbb6835` | Pagamento é a ÚLTIMA palavra dele; resumo sem total também é resumo |
| `dcb5138` | O mesmo pedido para de ser emitido duas vezes |
| `6d8e28e` | O nome do catálogo não é o nome que o cliente usa |

## O que a dona respondeu por áudio em 19/08

Transcrições em `Desktop/EnderecoDigital/clientes/padariadocepao/audios`,
arquivos `docepao1908*` e `docepao19082*`.

- **Pizza redonda:** só DOIS sabores, 30 cm, por peso a R$ 41,90/kg. Sem peso
  mínimo, é montada e pesada. Dá de 800 g a 1,2 kg, o que sai R$ 35 a R$ 45.
- **Mínimo por sabor:** é SUGESTÃO. "Se a cliente quiser 10 de cada, a gente
  abre uma exceção, é óbvio." Sugerir 20 e 5 sabores no cento, e aceitar menos.
- **Entrega:** SEMPRE chama a equipe. Não tem aplicativo, não chama Uber. O
  prompt autorizava cotar "R$ 10 a R$ 15 por aplicativo", taxa que a padaria não
  pratica, e isso saiu.

## Testado NA TELA com o dono, em 20/08/2026

Cada linha aqui foi conferida no banco, na impressora ou pela rota real. Nada
foi dado como certo por leitura de código.

| Fluxo | Como foi conferido |
|---|---|
| Conversa vira pedido | Pedido no banco com item, preço, data, hora e pagamento certos |
| Pendência de topo | `precisa_confirmacao=true`, motivo "confirmar valor do topo de bolo" |
| Equipe lança o valor | Cliente recebe o total novo e o pedido fica esperando a resposta dele |
| Cliente CONFIRMA | Sai da espera e entra na fila. Não imprime nada ainda |
| Cliente RECUSA | Volta com o motivo real: "cliente achou o valor do topo caro e não quer pagar" |
| Aprovar | Só o botão do painel aprova. Nada no banco aprova sozinho (conferido nos gatilhos) |
| Imprimir | Comanda da cozinha com os dados da peça e ticket do caixa, batendo com o WhatsApp |
| Pedido recusado | Não imprime: o gatilho só dispara quando o status vira "aprovado" |
| Papel de arroz | Marcado cobra R$ 199,60, desmarcado cobra R$ 187,60, pela rota real |

## O que FALTA

1. ~~Teste de impressão com papel.~~ **Feito em 20/08/2026 pelo dono.** Saíram
   as duas vias, conferidas na foto: a comanda BOLO FESTA com os dados da peça
   (pão de ló, tema, nome e idade do aniversariante) e o ticket do CAIXA com
   `3 kg x R$ 49,90 = R$ 149,70`, topo `1 un x R$ 25,00`, total R$ 174,70, PIX,
   batendo com o que a cliente leu no WhatsApp.

2. **`ADMIN_WHATSAPP` e `DONA_WHATSAPP`** no Coolify. Os dois números precisam
   ter mandado um "oi" pro número da padaria antes, senão a Meta recusa pela
   janela de 24h.
3. ~~Confirmar com a dona o "120" do áudio.~~ **Resolvido:** o dono confirmou
   que é 20 por sabor. O "120" era erro de transcrição do áudio, o "1" não
   existe. A conta fecha: 5 sabores no cento dá 20 de cada.

## O que a madrugada de 20/08 mudou no método

Duas mudanças, e as duas renderam mais que qualquer correção isolada.

**Consertar a classe, não o caso.** Cada defeito achado vira uma varredura do
catálogo inteiro, com teste que cobra os dois lados: pega o defeito e deixa
passar o legítimo. Produto novo no cardápio já nasce coberto. Foi assim que se
descobriu que "cuca de goiaba" recusada e "pizza de forma" recusada eram o
mesmo defeito com outra roupa, com dois dias de distância.

**Ler a conversa inteira, não o pedido final.** As duas conversas longas do
teste de aceitação fecharam com o pedido CERTO e foram atendimentos ruins:
aceite ignorado, conferência negada, cardápio no meio de uma correção, quatro
"a gente não tem" para coisas que não são produto. Conferir só o resultado
teria dado alta nas duas. Por isso o medidor agora julga também a SOMA das
quantidades, e não só se o nome do item apareceu.

Uma consequência prática: **guarda que mora dentro do cerebro.ts não tem
teste**. Toda função de decisão passou pra `lib/ia/guardas.ts`, que os testes
importam de verdade. Duas delas, movidas nessa noite, tinham defeito parado ali
havia semanas, e um deles (a recusa gravada em `nao_quer` que nunca bloqueava
nada) foi achado pelo teste no minuto seguinte à mudança.

## Decisões que ficaram registradas

- **Não enxugar o prompt.** Medido por seção: o peso está em "fechar o pedido"
  (15%) e "bolo de festa" (11%), que são as duas coisas que fazem dinheiro. O
  Tier 2 da OpenAI já resolveu o teto de mensagens, que era a outra razão.
- **Não adotar framework.** O Rasa CALM é o desenho certo mas trava em 1.000
  conversas por mês e um bot por empresa, o que mata multi-tenant de agência.
  Copiou-se o desenho, não o produto.
- **Não precisa de segunda chave da OpenAI.** O Tier 2 subiu o teto de 200.000
  pra 2.000.000 de tokens por minuto, o que dá umas 170 conversas simultâneas.

## Regras que não podem ser esquecidas

- Nunca emoji, nunca travessão. Vale pra código, prompt e tela.
- O shell come a barra invertida. Patch em arquivo se escreve com a ferramenta
  Write ou Edit, nunca com heredoc.
- Deploy é por webhook. Confira pelo SHA do container, nunca pelo status do
  Coolify. E **nunca meça com deploy no meio**: cada mensagem pega uma versão
  diferente e o número sai misturado.
- Push no GitHub exige a conta `contatoenderecodigital-sudo`.
- A IA nunca confirma pedido sozinha. Aprovar é só o botão do painel, atrás do
  login. A impressora só dispara com o pedido aprovado.
- Guarda nova nasce com teste dos DOIS lados: pega o defeito e deixa passar o
  caso legítimo. Guarda que trava venda é pior que o bug, e isso aconteceu duas
  vezes hoje.
- Não dizer "falta pouco". Dizer o que está feito e o que está aberto, com nome.

## Sobre a IA "ficar mais esperta com o tempo"

Não fica. O modelo é o mesmo hoje e daqui a um ano, e só melhora quando alguém
conserta. O que existe de memória foi escrito na mão: histórico do cliente,
pedido anterior, pedido em montagem, catálogo e regras.

Por isso existe o **botão Reportar** na tela de atendimento: a equipe vê
besteira, clica, escreve o que aconteceu, e chega no `ADMIN_WHATSAPP` mais o
banco. Sem ele, a equipe releva o erro esperando que passe, e ele fica.
