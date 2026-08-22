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

---

## 8. O teste ao vivo, depois do deploy — feito

Cinco conversas novas passando pelo webhook de produção, gravadas como cliente
de verdade, com print do painel.

| conversa | fechou | data | total esperado × real | item fantasma |
|---|---|---|---|---|
| **Carla** — a que travava | ✅ | 23/08 11:00 | R$ 50,00 × **R$ 50,00** | não |
| João — pediu o bolo de volta | ✅ | 28/08 14:00 | R$ 249,70 × **R$ 249,70** | não |
| Roberto — aumentou 100 → 200 | ✅ | 29/08 10:00 | R$ 200,00 × **R$ 200,00** | não |
| Fernanda — negou o frito | ✅ | 06/09 09:00 | R$ 250,00 × **R$ 250,00** | não |
| Juliana — a cliente perdida | ✅ | 12/09 14:00 | R$ 337,25 × **R$ 337,25** | não |

**Os cinco totais foram conferidos linha a linha contra o `catalogo.json`.**

A Carla percorreu **exatamente** o mesmo caminho de antes — perguntou o preço
do bolo de cenoura no turno 2 — e desta vez fechou. **Zero ocorrências** de
"Deixa eu chamar alguém da equipe" na conversa inteira. Antes eram três
seguidas, palavra por palavra.

A Juliana é a que prova que **não quebrei o que já funcionava**: mesmo caminho
da rodada anterior, mesmo total exato, um bolo só.

### O que o teste ao vivo achou de novo — e já está consertado

**1. O preço do cento saía errado, às vezes.**

```
cliente: quanto tá o cento de coxinha?
Dora:    O cento de coxinha sai R$ 65,00.      <- é R$ 100,00
```

Duas travas deviam ter pego e falharam **pelo mesmo motivo: cobriam o
silêncio, não o erro**. Uma só entrava se ela não tivesse escrito preço nenhum;
a outra aceitava só *uma* palavra entre "cento" e o "R$", e aqui tinha três
("de coxinha sai"). É o defeito que vira briga no balcão: a cliente ouve R$ 65,
pede o cento, e o cupom sai R$ 100,00.

**2. Bolo caseiro tratado como bolo de festa.**

```
cliente: e o bolo de cenoura, quanto?
Dora:    sai por quilo, quantos quilos você quer?
```

Bolo de cenoura é caseiro: sai **inteiro, R$ 34,90**. Na repetição ela
respondeu "R$ 29,90 o quilo" — que é o preço do bolo **salgado**. Duas
respostas diferentes pra mesma pergunta, as duas erradas, porque nenhum bloco
cobria esse caso e ela respondia de cabeça. São 15 sabores caseiros no
cardápio, de R$ 30,90 a R$ 35,90.

### O que ainda incomoda, e não travou nada

Ela às vezes pergunta *"Pode ser assim?"* ou *"E quantos de cada?"* **sem ter
listado nada antes** — pergunta pendurada no vazio. Não derrubou nenhum pedido
no teste, mas é o tipo de coisa que faz o cliente responder "de quê?".

E numa observação saiu texto repetido:
`bolo morango (sem topo e sem papel de arroz, sem topo nem papel de arroz)`.
Feio na comanda; o preço está certo.

---

## 9. Placar final

| | |
|---|---|
| defeitos consertados | **~32** |
| testes no portão | **56** (eram 43) |
| conversas ao vivo | **5/5 fecharam, 5/5 totais exatos** |
| deploy no ar | `278b92f` |
| voltar atrás | `git reset --hard entrega-segura` |

**O que está provado:** os pedidos fecham, os totais batem centavo a centavo,
as datas gravam certo, nenhum item fantasma, e os defeitos que travavam cliente
morreram — cada um com a conversa que prova.

**O que não está provado:** se ela *soa* humana. Isso nenhum teste mede. Os
prints estão em `scratchpad/prints-final/` e são 2 minutos de leitura.

---

## 10. A lição que fecha o ciclo — e que eu mesmo precisei aprender duas vezes

Consertei os dois defeitos de preço e mandei conferir. Deu **8 de 10**. Mas o
que importou não foi a nota: foi o **rastro**.

```
[ia] preco por cento respondido pelo codigo         0 ocorrências em 5
[ia] ela cotou o cento errado                       0 ocorrências
[ia] preco de bolo caseiro respondido pelo codigo   1 ocorrência em 3
```

**As travas que eu escrevi quase não dispararam.** Os quatro acertos do cento
vieram por outro caminho. Eu tinha consertado **o lugar errado** — exatamente o
padrão que passei a noite documentando, cometido por mim, com as ferramentas de
diagnóstico já na mão.

As causas de verdade estavam no rastro:

| eu consertei | a causa era |
|---|---|
| a trava que responde o preço do cento | ela leu **"cento" como 1 pessoa** e chamou o orçamento de festa |
| o bloco que responde preço de bolo | a **recusa mandava usar `por_quilo`** — errado pra bolo caseiro |

O segundo é o mais instrutivo do projeto inteiro: **a guarda estava certa em
recusar e errada no que mandava fazer.** A IA obedeceu à instrução errada, e o
defeito apareceu na fala dela. Quem lesse só a conversa culparia o modelo.

### O que isso quer dizer pra você, na prática

Quando a dona reclamar de uma conversa, **não tente adivinhar pelo texto**. O
texto mostra o sintoma; o rastro mostra a causa:

```bash
ssh -i ~/.ssh/id_ed25519_hub root@179.198.126.197 \
  'docker logs --since 30m $(docker ps --filter name=uyyqf7 -q) | grep rastro'
```

Cada linha diz qual ferramenta ela chamou, com quais argumentos, e o que o
código respondeu. Nas últimas 24 horas, **toda vez que eu li o rastro achei a
causa em minutos; toda vez que eu adivinhei pelo texto, gastei uma hora e errei.**

---

## 11. A conferência final — e um conserto que eu marco como NÃO verificado

Doze telefones, cada defeito repetido três vezes (eram intermitentes) e seis
perguntas de controle. **11 de 13 turnos certos.**

### O que o rastro provou

| trava | disparos |
|---|---|
| `NAO orcei: "cento" quer dizer CEM UNIDADES` | **2** — uma delas a reprodução exata do bug (`pessoas:1`) |
| `NAO anotei NESSA CATEGORIA` (bolo caseiro) | **0** |
| `preco de bolo caseiro respondido pelo codigo` | **0** |

O bolo caseiro saiu **certo nos quatro telefones** — R$ 30,90, R$ 30,90,
R$ 33,90, R$ 34,90, todos "inteiro/a unidade", nenhum "quantos quilos". Mas
saiu certo por `montar_orcamento modo:itens`, **não pelo conserto que eu
escrevi**.

Registro isso como **conserto NÃO VERIFICADO**: está certo em produção, e não é
o meu código que está fazendo isso. Se um dia voltar a errar, o lugar de olhar
é `anotar_item` classificando bolo caseiro como `bolo_festa` — o trecho está
comentado no código com o caso real.

### A falha que sobrou, e era da minha própria guarda

```
cliente: me fala o preço do cento de salgado
ela:     "O cento de salgado frito sai R$ 110,00.
          E o cento de assado sai R$ 125,00."
guarda:  apaga a primeira (R$ 110,00 não existe na tabela)
cliente: "E o cento de assado sai R$ 125,00."
```

**A mentira morreu e a resposta morreu junto.** Ele perguntou o preço do frito
e recebeu uma frase começando com "E o", sobre outra coisa.

É o defeito exato que dominou esta noite — **cortar sem repor** — cometido pela
guarda nova, doze horas depois de eu ter passado a madrugada consertando ele em
outros dezoito lugares. Corrigido: quando há mentira, o preço de verdade entra
sempre, e o que sobra não começa pendurado.

### O controle mais arriscado passou

`quero fazer festa pra 30 pessoas` → R$ 628,20, orçamento normal. As duas
recusas que acrescentei em `montar_orcamento` **não atrapalharam** orçamento de
verdade. Era o risco maior do último conserto: recusa nova numa ferramenta que
funciona.
