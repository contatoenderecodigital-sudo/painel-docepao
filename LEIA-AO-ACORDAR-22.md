# Leia isto antes de instalar — 22/08/2026

Sandro, resumo do que aconteceu na noite. Sem enfeite: o que está provado, o
que não está, e como voltar atrás se der ruim.

---

## 1. O que você pediu, e o que eu tinha feito de errado

Você disse, e estava certo:

> *"parece q tu só analisa oq tu tá testando memo, não antes de testar"*

Era exatamente isso. Eu testava, achava um defeito, seguia o fio dele, e
consertava. Cada teste só revela o que aquele teste toca — por isso **sempre
faltava algo**. Nunca varri o sistema inteiro procurando o mesmo padrão em
todos os pontos de uma vez.

Fiz a varredura. **91 pontos de decisão**, quatro eixos, todos lidos:

| | |
|---|---|
| guardas que recusam ferramenta | **49** (a contagem antiga dizia 43) |
| injeções — o código falando com a IA | **30** |
| pontos que reescrevem o texto dela | **33** (a contagem antiga dizia 18) |
| **total examinado** | **~200 pontos de decisão** |

---

## 2. O que a varredura achou

### 2.1 — Nove armadilhas permanentes

"Permanente" quer dizer: **uma vez disparada, não sai mais**. O cliente fica
preso até desistir. As sete piores eram o **mesmo defeito**:

> o código lia a conversa inteira como se fosse intenção, quando o que estava
> lá era uma **pergunta**.

O caso que você viu no print:

```
cliente: quanto tá o cento de coxinha?
cliente: calma aí. e o bolo de cenoura, quanto?     <- só PERGUNTOU
cliente: deixa pra lá. me vê 50 coxinha pra domingo
cliente: só isso mesmo. quanto dá? nome carla, dinheiro, 11h
Dora:    Deixa eu chamar alguém da equipe pra te ajudar com isso.
cliente: como assim? só quero saber o total dos salgados
Dora:    Deixa eu chamar alguém da equipe pra te ajudar com isso.
cliente: pode fechar então. 30 bolinha, 20 croquete, domingo 11h, carla
Dora:    Deixa eu chamar alguém da equipe pra te ajudar com isso.
```

A palavra "bolo" da pergunta do turno 2 ficava no histórico **pra sempre**. O
carrinho não tinha bolo, então `registrar_pedido` era recusado em todas as
voltas, em todos os turnos seguintes.

**A função que separa pergunta de pedido já existia, com teste dos dois lados.
Estava aplicada em 1 lugar de 6.**

### 2.2 — Cinco consertos que registravam sucesso sem consertar nada

Este é o que explica os dez dias.

| o que o log dizia | o que acontecia |
|---|---|
| `[ia] segunda vez sem entender; chamando a equipe` | **não chamava ninguém.** `false ?? "x"` é `false` |
| `[ia] ela anunciou recusa que o cliente não fez; frase cortada` | **não cortava** — o gatilho e o corte usavam padrões diferentes |
| `// agora as duas usam a MESMA regra` | comparava `"40 esfirra" === "esfirra"`. **Sempre falso** |
| proteção "resumo furado não vai pro cliente" | sobrescrita 20 linhas abaixo, **sem condição**. Nunca rodou |
| remendo do `"Pode ser assim?"` órfão | roda **antes** do passo que fabrica o problema |

Quem lia o rastro **via o conserto acontecendo**. Não estava acontecendo.

### 2.3 — Doze regras morando em dois lugares, divergentes

Você perguntou por isso. Cada uma foi rodada lado a lado, com a frase do
cliente, pra provar a divergência:

```
"nao quero papel de arroz"   copia A: CITADO (errado)   copia B: negado
"ta bom de salgado"          copia A: aceite (errado)   copia B: nao e aceite
"nao tenho foto"  (acento)   copia A: "vai mandar"      copia B: "sem foto"
"pao de lo branco,           copia A: "forminha branc"  copia B: [branco, rosa]
 forminha rosa"                       (errado)
```

**O padrão:** toda vez que um aprendizado foi aplicado **à mão** em vez de
virar **função**, ele chegou a uma parte dos lugares. Não é falta de atenção —
é a arquitetura pedindo isso.

---

## 3. O que eu consertei nesta noite

Sete blocos, cada um com o portão rodado antes de commitar. **Nenhum commit
entrou com teste vermelho.**

### Dinheiro que o cliente pagava sem pedir
- **R$ 12,00 de papel de arroz recusado** entrava na conta, e a festa travava
  pedindo o tema de um topo que ele tinha dispensado
- **bolo de R$ 152,70** gravado por causa de uma pergunta de preço
- **50 pizzas de calabresa + 50 de bacon (R$ 12.000)** a partir de um pedido de
  esfirra
- **teto do pedido congelado no primeiro número da conversa** — quem perguntava
  "quanto sai 100?" e comprava 200 tinha metade do pedido recusada
- **"não quero frito, 200 assados, metade de cada"** virava teto de 100

### Cliente preso
- pergunta de preço de bolo travando o registro **pra sempre** (2 pontos)
- `tool_choice` forçado nas 6 voltas: com os quatro dados na mesa ela era
  **proibida de escrever texto** — qualquer recusa virava impasse garantido
- "pode escolher" dito uma vez **bloqueava o cardápio** pelo resto do
  atendimento
- "queria falar com vocês" na saudação **desligava** a guarda que impede
  handoff de pedido pronto
- **`nao_quer` nunca era desfeito** — e às vezes era gravado pelo próprio
  sistema. Agora pedir de volta desfaz

### Trabalho jogado fora
- os dois returns de emergência **não devolviam a montagem**: tudo que a IA
  anotou no turno era descartado em silêncio. Cada volta do impasse apagava a
  anterior
- a válvula de escape entendia **1 das 49 recusas**. Agora entende também a
  mais comum ("falta data, hora")

### Cliente irritado
- "quer salgado também?" pra quem acabou de pedir **100 croquete e 100 quiche**
- a mesma frase de robô **três vezes seguidas**
- `"Anotei tudo aqui.?"` — interrogação solta chegando no WhatsApp
- a pergunta de data sumindo por "já perguntei", deixando a mensagem **sem
  saída nenhuma**
- 130 docinhos na **cor errada** de forminha
- "não tenho foto" gravado como "cliente vai mandar a foto"

---

## 4. O que ainda está aberto — de propósito

Não fiz, e explico por quê:

1. **Converter as ~18 tesouras para o padrão "refazer"** (−810 linhas). É a
   mudança certa e a mais arriscada de todas. Não faço isso nas horas antes de
   você entregar. Fica na branch `tesouras` se você quiser depois.
2. **Trocar o modelo** (`gpt-4o-mini` → um degrau acima). É decisão sua: sai de
   ~R$ 0,13 pra ~R$ 0,35 por conversa. É SQL, sem código. Medido nas 40
   conversas: o modelo compra ~32% do estrago; os 68% eram código.
3. **Os passos da cadeia de texto que ainda podem apagar informação** —
   mapeados, com ordem de dano, no fim deste documento.

---

## 5. Como voltar atrás se der ruim

```bash
cd painel-docepao
git reset --hard entrega-segura   # volta pro commit c791dba
git push -f origin main            # redeploy do estado antigo
```

O banco tem backup: `backup-docepao-20260822-0236.sql` (237 KB), na pasta
`hub e docepao`. Restaura com:

```bash
psql -U hub -d enderecodigital_hub < backup-docepao-20260822-0236.sql
```

---

## 6. Antes de mostrar pra dona

**O painel está limpo.** Apaguei 25 clientes de teste (`QA Automatizado`,
`Marcia Fontana`, `Juliana Reis`, etc.) das faixas 5511977/5511955/5511922/
5511933/5511911/5500000.

**Deixei uma conversa de propósito:** `554998284354` — **é o seu próprio
número**, com 23 mensagens de 21/08. Não apaguei porque é seu. Se quiser
limpar:

```sql
delete from docepao.mensagens where cliente_id in
  (select id from docepao.clientes where telefone = '554998284354');
delete from docepao.clientes where telefone = '554998284354';
```

---

## 7. O que eu pediria pra você fazer

Uma coisa só: **peça pra dona te avisar da primeira conversa que der errado.**

Com o rastro ligado (`docker logs | grep rastro`), uma conversa ruim vira
conserto no mesmo dia. Sem isso, vira mais uma semana de adivinhação — que é
exatamente o que a gente acabou de sair.
