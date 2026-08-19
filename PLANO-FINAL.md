# Plano até a entrega

Escrito em 19/08/2026, depois da bateria final ao vivo. Executado em ordem, um
item por vez, sem nada rodando em paralelo.

## Por que este documento existe

O dia foi de vaivém: criei dois bugs sozinho, quebrei âncora de teste três
vezes, commitei com teste quebrado duas vezes e apaguei o banco da minha própria
medição. A causa não foi capacidade, foi reagir a cada relatório em vez de
planejar. Este arquivo é o plano que faltava.

## Regras que eu sigo daqui até o fim

1. **Uma coisa de cada vez.** Nada de medição ao vivo rodando enquanto eu edito.
2. **`node testes/todos.cjs` antes de todo commit.** Nunca mais laço de shell:
   ele mostra FALHOU na tela e não trava o `&&` seguinte.
3. **Teste destrutivo nunca roda com medição no ar.**
4. **Antes de escrever, digo a causa e o que pode quebrar junto.** Foi pular
   isso que gerou o bug do `falaDoCliente`.
5. **Guarda nova nasce com teste dos DOIS lados**: pega o defeito e deixa passar
   o caso legítimo. Guarda que trava venda é pior que o bug.

---

## Fase 0: parar de tropeçar em mim mesmo

**Problema:** os testes leem o `cerebro.ts` e recortam trechos por comentário.
Toda função nova no meio quebra três testes. Aconteceu três vezes hoje, e cada
vez me custou tempo com coisa que não era o defeito.

**Conserto:** mover as funções de guarda pra `lib/ia/guardas.ts`, como já é o
`fatos.ts` e o `produtos.ts`. Os testes passam a importar de verdade.

**O que pode quebrar:** os imports do `cerebro.ts` e os quatro testes que hoje
recortam texto. Todos cobertos pelo portão.

**Prova:** os 18 testes continuam passando.

---

## Fase 1: forma de pagamento errada no recibo

**O caso real:** o cliente nunca falou pix. Ela anotou pix. Ele corrigiu pra
cartão, ela confirmou "Anotei que o pagamento será no cartão", e o recibo saiu
`*Forma de pagamento:* pix`. O pedido foi pra produção com o dado errado, e
quando ele reclamou ela disse que não dava mais pra mexer.

**Causa provável:** o recibo é montado com o valor que ela passou na chamada, e
não relido do estado depois de gravar. Já existe uma guarda que lê o pagamento
da fala do cliente, mas ela usa a conversa inteira, então "pix" dito no começo
ganha do "cartão" dito depois.

**Conserto:** o valor vale o ÚLTIMO que o cliente falou, não o primeiro. E o
recibo sai do que foi gravado, não do argumento dela.

**O que pode quebrar:** cliente que fala a forma uma vez só. Teste cobre.

**Prova:** teste com a sequência real (pix dela, cartão dele, recibo tem que
sair cartão) e com o caso simples.

---

## Fase 2: resumo com item faltando

**O caso real:** ele pediu conferência e o resumo veio sem os 63 brigadeiros e
62 beijinhos, que estavam anotados. Total R$ 544,50 sobre uma lista incompleta.

**Causa:** a guarda `faltandoNoResumo` existe e detecta, mas só dispara quando o
texto tem linha de total. O resumo de conferência dela não tinha.

**Conserto:** o gatilho passa a valer também quando ela lista 2+ itens com
valor, mesmo sem linha de total.

**O que pode quebrar:** resposta de preço com dois produtos ("frito R$ 1,00 e
assado R$ 1,25") não pode ser tratada como resumo. Teste cobre.

---

## Fase 3: pergunta repetida (pagamento 4 vezes)

**O caso real:** respondeu pix na mensagem 14 e ela ainda perguntava na última.

**Causa:** mesma da cor da forminha, que já consertei: quem aproveita a resposta
é ela, e quando ela não grava, o lembrete manda perguntar de novo.

**Conserto:** o código aproveita a resposta sozinho, igual à forminha. Já existe
`detectarPagamento`; falta aplicar no turno.

**O que pode quebrar:** gravar pagamento que o cliente não falou. Só dispara
quando a pergunta ANTERIOR dela foi sobre pagamento, igual à forminha.

---

## Fase 4: pedido fechado emitido duas vezes

**O caso real:** ela mandou o pedido completo duas vezes, idêntico, e o cliente
perguntou "agora são dois?".

**Causa a investigar:** pode ser `registrar_pedido` chamado duas vezes no mesmo
turno, ou o texto do resumo saindo duplicado.

**Conserto:** depende da causa. Se for chamada dupla, trava por turno.

---

## Fase 5: o qa-concorrencia que pisca

Acusou uma falha e não reproduziu na rodada seguinte. Teste que pisca é pior que
teste que falha, porque ensina a ignorar. Rodar cinco vezes e descobrir se é
instabilidade do teste ou defeito de verdade.

---

## Fase 6: medir

1. `node testes/medidor.cjs 5` limpo, sem nada em paralelo
2. Bateria de personas ao vivo, com a espera de digitação
3. Comparar com hoje

---

## Fase 7: deixar registrado

Atualizar o `ONDE-PARAMOS.md` com o resultado, o que ficou aberto e o que
depende do dono.

---

## O que NÃO está neste plano, de propósito

- **Enxugar o prompt.** Medi: o peso está em "fechar o pedido" (15%) e "bolo de
  festa" (11%), que são as duas coisas que fazem dinheiro. O Tier 2 já resolveu
  o teto de mensagens, que era a outra razão. Risco alto, ganho baixo.
- **A Dora aprender os endereços de entrega.** É funcionalidade nova e boa, mas
  é depois de entregar.
- **Segunda chave da OpenAI.** O Tier 2 substituiu.

## Depende do dono, não de mim

- Papel na impressora e reimprimir a Fernanda Klein, R$ 493,00
- `ADMIN_WHATSAPP` e `DONA_WHATSAPP` no Coolify, com um "oi" prévio de cada
- Confirmar com a dona: o "120" do áudio é 20 por sabor (a conta bate: 5 sabores
  no cento dá 20 de cada)
