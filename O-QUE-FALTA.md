# O que falta fazer

Aberto em 26/08/2026. **Regra deste arquivo: nada sai daqui sem estar medido.**
Não basta commitar e deployar; só sai quando o estado do banco provar.

Ordem combinada com o dono: **primeiro o cérebro e o atendimento da IA, depois o
painel.**

---

## AGORA — o cérebro da IA

### 1. Ambiguidade de sabor  ⟵ o dono está montando o desenho

A varredura está em `SABORES-E-AMBIGUIDADES.md`: 117 nomes, 9 ambíguos, 108
únicos, e 31 que são pedaço de outro nome.

Regras já combinadas, em ordem de precedência:

1. cliente **citou** uma mensagem → o assunto dela manda (hoje é só dica de
   prompt, precisa virar regra de código)
2. a **etapa** da conversa manda (já existe em parte)
3. **nome único** no cardápio → conclui sozinha, são 108 dos 117
4. **quantidade acima de 6** não é bolo. O número vem do cardápio: o maior bolo
   da casa tem 6 kg (redondo até 5,5, quadrado até 6). "50 brigadeiro" é docinho
5. só depois de tudo isso, **pergunta mostrando preço e unidade**:
   "brigadeiro docinho, R$ 1,25 cada, ou bolo de brigadeiro por quilo?"

Casos que sobram de verdade: **brigadeiro** (docinho, bolo de festa, pizza doce),
**café** (docinho e bolo caseiro) e **prestígio** (bolo de festa e pizza doce).
Os outros 6 são recheio de salgado e o produto já desempata.

### 2. Os dois jeitos de falar que ainda falham

`pass^5` do medidor deu **3 de 5**. Os instáveis:

| jeito | resultado |
| --- | --- |
| tudo numa mensagem só | 3/5 |
| três respostas na mesma frase | 1/5 |

Nos dois o pedido monta quase certo e **não fecha**. Nenhum fechou com valor
errado.

**Pista concreta, não palpite:** nas execuções que passam o bolo entra como
`bolo 4 leites` com obs `2 kg`. Nas que falham entra como `4 leites`, sem
prefixo e sem observação. São dois caminhos escrevendo nomes diferentes para o
mesmo bolo: o do modelo e o do "guardado".

### 3. A IA confirma em vez de anotar

Quando o cliente diz tudo numa mensagem, às vezes ela responde "você quer X,
certo?" e **não anota nada**. Se a conversa cair ali, não sobra registro. É o
`qa-concorrencia` vermelho, e é da mesma família do quiche que sumia.

### 4. Duas decisões do dono, ainda sem resposta

- manter ou tirar a pergunta do **prato** (MDF aberto ou embalagem com tampa).
  Não existe no fluxograma da Kemilly, mas o código pergunta.
- **papel de arroz antes do topo**, como no fluxograma? Hoje pergunta topo antes.

---

## DEPOIS — o atendimento no painel ("WhatsApp 2")

Combinado com o dono: só entra depois que o cérebro estiver fechado.

### 5. Recibo de entrega e leitura nunca gravou

As colunas `entregue_em` e `lida_em` existem e estão **vazias**. Na única
conversa real: 25 mensagens da IA, 21 com id do WhatsApp, 0 com recibo.

Já descartado com evidência: o app está inscrito na conta, o campo `messages`
está assinado, o formato do id bate, e a deduplicação não engole o evento.

Sobra saber se o evento chega e o UPDATE não casa, ou se não chega. **Não dá
para saber sem instrumentar**, porque o erro hoje é engolido por um `catch`
vazio. Primeiro passo, barato: registrar todo evento de status com o id e se o
UPDATE pegou. Uma conversa real depois disso responde.

### 6. Marcar lida e "digitando" dá 400

`#131009 Parameter value is not valid` no log. Pode ser efeito dos testes (o
script inventa id falso e a Meta recusa) ou defeito de verdade. **Só uma
conversa real separa os dois.**

### 7. Nenhuma tela mostra recibo

Mesmo que os dados passem a gravar, ninguém vê. O tique cinza, o tique azul e a
mensagem citada aparecendo acima da resposta são a metade visível do trabalho.

### 8. Erro engolido em silêncio

O `.catch(() => {})` do recibo é o motivo de isso passar meses sem aparecer.
Vale varrer o resto do código atrás do mesmo padrão.

### 9. O que a Meta dá e não usamos

Detalhado em `WHATSAPP-O-QUE-A-META-DA.md`. Decisão de negócio, não pendência:
lista de até 10 opções (hoje só botão, limite 3), botão de link, catálogo e
carrinho, WhatsApp Flows, perfil do negócio pela API, métricas de conversa.

---

## SEM MEDIÇÃO NENHUMA

Aqui eu não sei responder pelo estado, e é honesto dizer que não sei.

- o painel da dona fora do que o `qa-painel` cobre
- a ponte da impressora
- vários clientes conversando ao mesmo tempo (o `qa-concorrencia` está vermelho)

O caminho é o mesmo que funcionou: mesmo caso dito de vários jeitos, gabarito no
banco, `pass^k`.

---

## OUTRO PROJETO — hub, painel do parceiro

Ficou pronto e não voltamos: kanban, ligação dentro do card, gravação no volume,
comissão, atribuição pelo link (testada no navegador).

- **`WHATSAPP_NUMERO_PUBLICO` não configurado**: o botão de WhatsApp não aparece
  na landing do parceiro e o painel dele mostra o aviso laranja
- não existe tela de trocar senha no painel do parceiro
- prospecção mandando as empresas garimpadas direto para a fila do parceiro
- relatório de melhor horário para ligar
- placar do vendedor (ligações por dia, taxa de atendimento, de opt-in, de fechamento)
- itens do relatório de QA: abrir negócio pelo kanban, visão de lista só leitura,
  linhas de Leads que parecem clicáveis
- `/api/admin/prospeccao/previa` não existe (404), é o gerador de prévia de site
- telas duplicadas: as 5 em `/operacao/hub/*` repetem `/owner/*`

---

## DÍVIDA TÉCNICA

- **dois cérebros no repositório**: `cerebro.ts` (antigo, com ferramentas) e
  `lib/ia/fluxo` (novo, que é o que roda). Mexer no antigo não muda nada em
  produção, e isso já me custou duas correções entregues como prontas
- merge de `coolify-postgres` para `servidor`, e aposentar o pm2 do aaPanel
- revogar o token da API do Coolify quando terminar
