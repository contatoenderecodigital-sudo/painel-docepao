# WhatsApp Cloud API: o que a Meta oferece e o que a gente usa

Levantado em 26/08/2026, contra o código de verdade, não de memória.
API em uso: **v25.0**. App **Endereço Digital** (1059891153386024), inscrito na
conta de WhatsApp da padaria.

---

## 1. O que a gente JÁ RECEBE do cliente

O webhook trata praticamente tudo que a Meta manda. Esta parte está boa.

| tipo | tratado? | o que fazemos |
| --- | --- | --- |
| texto | sim | vai pra IA |
| áudio | sim | transcreve e responde |
| imagem | sim | vira foto de referência do pedido |
| documento | sim | anexa |
| vídeo | sim | anexa |
| figurinha | sim | reconhece e não trava |
| localização | sim | lê |
| contato | sim | lê |
| botão tocado | sim | vira resposta sem chamar a IA (economia) |
| lista tocada | sim | idem |
| reação (emoji) | sim | reconhece |
| **responder marcando** | **sim** | lê a mensagem citada e responde em cima dela |

---

## 2. O que a gente JÁ MANDA pro cliente

| recurso | temos? |
| --- | --- |
| texto | sim |
| botões (até 3) | sim |
| template aprovado | sim |
| imagem, áudio, documento | sim |
| imagem por link | sim |
| listar templates aprovados | sim |
| marcar lida + "digitando" | codado, **falhando** (ver abaixo) |

---

## 3. O QUE A META DÁ E A GENTE NÃO USA

Cada um destes é uma decisão sua, não uma pendência técnica.

### Recibo de entrega e leitura  ← o que você pediu

A Meta manda um evento pra cada mensagem nossa: `sent`, `delivered`, `read`,
`failed`. **O código que trata isso existe e parece certo**, e as colunas
`entregue_em` e `lida_em` existem na tabela.

**Só que nunca gravou nada.** Na única conversa real (a da Kemilly): 25
mensagens da IA, 21 com id do WhatsApp, **0 com entregue, 0 com lida**.

O que eu já descartei, com evidência:
- o app **está** inscrito na conta (perguntei pra Meta)
- o campo `messages` **está** assinado, senão mensagem nenhuma chegaria
- o formato do id guardado (`wamid.HBg...`) é o mesmo que a Meta manda
- a deduplicação **não** engole o evento de status, ela só olha mensagem que entra

O que sobra e ainda não sei: se o evento chega e o UPDATE não casa, ou se não
chega. **Não dá pra saber sem instrumentar**, porque hoje o erro é engolido:
a chamada termina com `.catch(() => {})` e ninguém fica sabendo.

Primeiro passo, e é barato: registrar todo evento de status que chega, com o id
e o resultado do UPDATE. Uma conversa real depois disso responde a pergunta.

### Marcar lida e "digitando"

Codado, e o log de produção mostrava `400 (#131009) Parameter value is not
valid` a cada mensagem. Pode ser um efeito dos meus testes (o script de teste
inventa id falso e a Meta recusa) ou defeito de verdade. **Precisa de uma
conversa real pra separar os dois**, e eu não vou afirmar sem isso.

### Listas de opções (até 10)

Hoje só usamos botão, que é limitado a 3. Uma lista resolveria escolher entre
15 sabores de bolo sem mandar imagem de cardápio.

### Botão de link (CTA URL)

Manda um botão que abre um site. Serviria pro cardápio em PDF ou pro link de
pagamento, sem o cliente ter que copiar endereço.

### Catálogo e carrinho

A Meta deixa subir o cardápio como catálogo dentro do WhatsApp, e o cliente
monta o carrinho na interface dele. Muda a operação inteira; é decisão de
negócio, não de código.

### WhatsApp Flows

Formulário dentro do WhatsApp: escolher data, hora e itens numa tela só, sem
conversa. Bom pra retirada agendada.

### Reagir, enviar localização, enviar contato

A Meta deixa. A gente não usa e provavelmente não precisa.

### Perfil do negócio pela API

Dá pra ler e alterar endereço, descrição, horário e foto do WhatsApp da padaria
pelo próprio sistema, sem entrar no app.

### Métricas de conversa

Quantas conversas, quanto custou cada uma, por categoria. Serve pra saber o
custo real do atendimento por mês.

---

## 4. E o painel

Hoje **nenhuma tela mostra recibo**. Mesmo que os dados passassem a gravar,
ninguém veria. Se a ideia é o "WhatsApp 2", isso é a metade visível do trabalho:
o tique cinza, o tique azul, e a mensagem citada aparecendo acima da resposta.

---

## 5. Onde ver a fonte

A lista completa e sempre atualizada fica na documentação da Meta, em
Cloud API → Webhooks (o que chega) e Cloud API → Messages (o que dá pra mandar).
O que está neste arquivo é o cruzamento dela com o nosso código em 26/08/2026.
