# O que falta fazer

Atualizado em 26/08/2026, ao fim da sessão. **Regra deste arquivo: nada sai
daqui sem estar medido.** Commitar e deployar não conta; só o estado do banco
prova.

Ordem combinada com o dono: **primeiro o cérebro e o atendimento da IA, depois o
painel**.

---

## ONDE PARAMOS

**No ar e medido** (container e HEAD conferidos iguais):

| feito | prova |
| --- | --- |
| nome canônico do produto (`fluxo/produto.ts`) | pass^5 subiu de 3/5 para 4/5 |
| papel de arroz perguntado antes do topo | conferido em produção |
| 3 exceções tiradas da guarda de apelidos | 7 casos testados |
| leitor da frase (`fluxo/leitor-da-frase.ts`) | 7/7 nas frases reais |
| item guardado quando citado fora da hora | verificado no banco |
| detector de barra comida (`testes/regex-com-barra-comida.cjs`) | 8/8 na isca |

**Bateria dos cinco jeitos: `pass^5` = 4 de 5.** Rodar com
`node testes/medidor.cjs 5 "cinco jeitos"`.

```
tudo numa mensagem só          5/5
uma coisa por mensagem         5/5
com erro de digitação          5/5
mudando de ideia no meio       5/5
três respostas na mesma frase  0/5   <- o único vermelho
```

---

## 1. O CENÁRIO 3, único vermelho da bateria

Frase: `"50 brigadeiro, forminha rosa, e um bolo de 2 kg de 4 leites"`.
Falha nas cinco execuções, de dois jeitos alternados:

```
3 de 5:  100 coxinha | 100 quiche | 50 brigadeiro (rosa)     <- faltou o bolo
2 de 5:  100 coxinha | 100 quiche | 2 bolo 4 leites (2 kg)   <- faltou o brigadeiro
```

**Um ou o outro, nunca os dois.** A mensagem tem um docinho e um bolo, e só um
sobrevive. É disputa entre o caminho normal e o do "guardado": os dois escrevem
em `limpa.itens` e um substitui a lista em vez de somar. Olhar em
`lib/ia/fluxo/fluxo.ts`, no bloco que aplica `estado.guardados`.

Piorou de 1/5 para 0/5 com o nome canônico, e faz sentido: agora o bolo é sempre
reconhecido, então a disputa acontece sempre.

## 2. Padronizar o catálogo  ⟵ COMEÇADO, NÃO TERMINADO

Pedido explícito do dono: padronizar tudo (comanda, cérebro, código, IA, a tela
onde a dona edita). É a raiz das exceções no código.

**Já feito:** foto de segurança da cotação de **83 produtos** em
`.tmp-pad/ANTES.json` (pasta temporária, refazer se sumir). A regra da mudança é
que **nenhum preço pode mudar**, e isso se prova comparando a cotação de cada
produto antes e depois.

**Bug que a foto achou:** `café` não tem cotação nenhuma. Existe como docinho
(R$ 1,25) e como bolo caseiro (R$ 35,90), e o motor não escolhe: a linha sai sem
preço.

**O que está errado hoje no `lib/ia/dados/catalogo.json`:**

- **dois nomes de campo para a mesma ideia**: `recheio` (singular, já vem pronto,
  não pergunta) e `recheios` (plural, pergunta qual). Um "s" muda o
  comportamento e isso não está escrito em lugar nenhum
- **preço em dois níveis**: salgado não tem preço no item, tem no grupo (frito
  R$ 1,00, assado R$ 1,25). Todo o resto tem no item
- **campo ausente com dois significados**: `sabores` faltando quer dizer "não tem
  sabor" na maioria e "ninguém cadastrou" em outros
- **quatro campos usados uma vez só**, na pizza redonda: `sabores_ate`,
  `peso_minimo`, `peso_tipico_kg`, `valor_tipico`

**Formato proposto:** `nome · preco · unidade · categoria · grupo · bancada ·
sabores[] · sabor_fixo`. O código passa a ter UMA regra: se `sabores` tem itens
e `sabor_fixo` é falso, pergunta.

**Atenção antes de mexer:** quem transforma o catálogo em lista de produtos é
`produtosDoCatalogo()`, usado em `lib/ia/orcamento.ts:431`. Mudar a estrutura do
JSON exige mudar esse builder junto, senão o preço quebra.

## 3. As regras que a dona falou e a IA não sabe

Citação de origem em `O-QUE-A-DONA-FALOU.md`. Decisões do dono em 26/08:

- **Prazo do topo** (FAZER): 2 dias e no máximo até sexta, porque a casa não faz,
  encomenda. Hoje o prazo é um número só para tudo.
- **Desconto e beneficente** (FAZER): a IA nunca dá o preço por unidade, responde
  *"deixa eu ver a possibilidade de um desconto, eu já te retorno"* e chama a
  equipe. Os valores (cachorro-quente R$ 1,20, pão de X R$ 1,40) hoje são
  anotação morta no catálogo.
- **Entrega é sempre caso de humano** (FAZER). Os horários já estão no sistema, a
  regra de chamar gente não.
- **Comanda separada por segmento** (FAZER): a regra mais repetida dos 55 áudios.
  Docinho de festa numa, salgadinho de festa noutra, cupcake noutra, bolo salgado
  noutra, empadão, torta doce e torta recheada cada uma na sua. E **cada comanda
  tem que avisar que existem as outras**. Motivo real dado por ela: um item foi
  esquecido no mural porque veio tudo junto.
- **Lista de sabor é ABERTA** (FAZER): hoje o sistema recusa o que não está no
  catálogo, e a resposta da casa é *"se o cliente pedir outro sabor, a gente vai
  colocando"*. É venda perdida por regra nossa.
- **Pizza: perguntar de forma ou redonda** quando ele não disser. São produtos
  bem diferentes: de forma 60x40 cm, R$ 120 inteira e R$ 60 meia, até 4 sabores;
  redonda 30 cm, R$ 41,90 o quilo, até 2 sabores, sai R$ 35 a R$ 45.
- **Parcelamento** (decisão do dono): só responder se o cliente perguntar, não
  oferecer. Até 3x e só no cartão. O pagamento é presencial, não passa pela IA.

## 4. Desambiguação: os casos que viram pergunta

Levantamento completo em `SABORES-E-AMBIGUIDADES.md`. Regras combinadas, em
ordem de precedência:

1. cliente **citou** uma mensagem → o assunto dela manda (hoje é só dica de
   prompt, precisa virar regra de código)
2. a **etapa** da conversa manda
3. **nome único** no cardápio → conclui sozinha (108 dos 117 nomes)
4. **quantidade acima de 6 não é bolo** (o maior bolo da casa tem 6 kg, sai do
   cardápio). "50 brigadeiro" é docinho
5. só então **pergunta mostrando preço e unidade**

**Ambíguos de verdade, três:** `brigadeiro` (docinho, bolo de festa, pizza doce),
`café` (docinho, bolo caseiro), `prestígio` (bolo de festa, pizza doce).

**Não precisa perguntar, o sabor resolve:** empadão, torta fria, cuca e mini
bolha têm sabores exclusivos entre a versão simples e a mais cara. "empadão de
palmito" só pode ser o de R$ 39,90.

**Precisa perguntar qual dos dois:** cupcake pequeno / recheado (dividem os dois
sabores), cupcake grande / recheado, cachorro-quente / mini. E o caso do produto
citado **sem sabor nenhum** ("quero 2 kg de cuca").

## 5. A IA confirma em vez de anotar

Quando o cliente diz tudo numa mensagem, às vezes ela responde "você quer X,
certo?" e **não anota nada**. Se a conversa cair ali, não sobra registro. É o
`qa-concorrencia` vermelho, e é a última da família do quiche que sumia.

## 6. Regerar as oito peças de cardápio

Nascem do catálogo por `scripts/gerar-cardapio.mjs` (HTML em `.cardapios/`,
imagem em `public/cardapios/*.jpg`). Arrumar o catálogo e regerar conserta as
duas pontas de uma vez.

Dois agrupamentos que o dono mandou separar:

- **`cupcakes-franciscano`**: cupcake é doce, franciscano é salgado de R$ 12,00,
  e ela trata os dois como comandas diferentes
- **`cucas-paes`**: cuca é confeitaria, pão é padaria, salas diferentes

---

## DEPOIS — o atendimento no painel ("WhatsApp 2")

Só entra depois que o cérebro estiver fechado. O dono pediu para ser lembrado.

### 7. Recibo de entrega e leitura nunca gravou

`entregue_em` e `lida_em` existem e estão **vazias**. Na única conversa real: 25
mensagens da IA, 21 com id do WhatsApp, 0 com recibo.

Já descartado com evidência: o app está inscrito na conta, o campo `messages`
está assinado, o formato do id bate, e a deduplicação não engole o evento.

Falta saber se o evento chega e o UPDATE não casa, ou se não chega. **Não dá para
saber sem instrumentar**, porque o erro é engolido por um `.catch(() => {})`
vazio. Primeiro passo, barato: registrar todo evento de status com o id e se o
UPDATE pegou.

### 8. Marcar lida e "digitando" dá 400

`#131009 Parameter value is not valid`. Pode ser efeito dos testes (o script
inventa id falso e a Meta recusa) ou defeito real. Só uma conversa real separa.

### 9. Nenhuma tela mostra recibo

Mesmo gravando, ninguém vê. Tique cinza, tique azul e a mensagem citada
aparecendo acima da resposta são a metade visível.

### 10. Erro engolido em silêncio

O `.catch(() => {})` é o motivo de isso passar meses sem aparecer. Vale varrer o
código atrás do mesmo padrão.

### 11. O que a Meta dá e não usamos

Detalhado em `WHATSAPP-O-QUE-A-META-DA.md`: lista de até 10 opções (hoje só
botão, limite 3), botão de link, catálogo e carrinho, Flows, perfil do negócio
pela API, métricas de conversa.

---

## PERGUNTAS PARA A DONA

Sete, com citação de origem, em `O-QUE-A-DONA-FALOU.md` seção 3. As duas mais
importantes:

1. **O que muda no cupcake recheado?** Ela citou duas vezes só o preço e o
   tamanho em centímetros, nunca o que é o recheio. A IA vai precisar explicar.
2. **O bolo com foto: a IA encaminha pro grupo da confeitaria?** É pergunta dela
   e continua aberta.

---

## SEM MEDIÇÃO NENHUMA

Aqui não dá para responder pelo estado, e é honesto dizer que não sei.

- o painel da dona fora do que o `qa-painel` cobre
- a ponte da impressora
- vários clientes conversando ao mesmo tempo (`qa-concorrencia` vermelho)

O caminho é o que funcionou: mesmo caso dito de vários jeitos, gabarito no banco,
`pass^k`.

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

- **dois cérebros no repositório**: `cerebro.ts` (antigo, com ferramentas) e
  `lib/ia/fluxo` (novo, que é o que roda). Mexer no antigo não muda nada em
  produção, e isso já custou duas correções entregues como prontas
- merge de `coolify-postgres` para `servidor`, e aposentar o pm2 do aaPanel
- revogar o token da API do Coolify quando terminar

---

## COMO EU DEVO TRABALHAR NISTO

Aprendido nesta sessão, e cada linha custou caro:

1. **Uma coisa por vez, medindo entre uma e outra.** Fazer três e medir no fim
   foi como passei a tarde consertando o arquivo errado.
2. **Antes da bateria, mandar UMA conversa e ler o item no banco.** Pegou três
   defeitos que o build, o deploy confirmado e a função no bundle não pegavam.
3. **Bateria idêntica à anterior é suspeita, não resultado.** Significa que a
   correção não está no caminho que executa.
4. **Detector que nunca provou pegar nada não vale.** A primeira versão do
   detector de regex não pegava nem a isca plantada.
5. **Toda guarda nova: qual é o jeito mais barato de o modelo satisfazer isso?**
   Se a resposta for "apagando o item", a guarda está errada.
6. **Nunca escrever `\b`, `\s`, `\d` em regex por heredoc.** A barra é comida no
   caminho até o arquivo. Usar espaço literal, `[0-9]`, `(^|[^a-z])`.
