# Tirar as guardas: o que fazer, na ordem, e o que NUNCA tocar

Escrito em 03/09/2026 para quem for continuar este trabalho.

O dono pediu isto com todas as letras, depois de um mes de conserto em circulo:

> *"Preciso deixar os guardas so nos lugares q realmente precisam. Ja te pedi pra
> ler todos os codigos exatamente pra isso, pra achar esses guardas de merda. A
> I.A tem q pensar, to gastando token do openai pra isso, se nao eu montava um
> chatbot."*

E antes disso, gritando, sobre o defeito que motivou tudo:

> *"Como que a porra de uma inteligencia artificial pede quantas pessoas vao, a
> pessoa responde, e ela entende a porra de um bolo? Cade o contexto dela?"*

Ele estava certo. Este documento explica por que, e o que fazer.

---

## 1. A CAUSA RAIZ, e ela e uma linha

O modelo **nunca recebia a conversa**. Ate 03/09/2026, `lib/ia/fluxo/pensar-openai.ts`
mandava exatamente isto:

```js
messages: [
  { role: "system", content: instrucao },   // a instrucao da etapa
  { role: "user", content: mensagem },      // a frase do cliente, sozinha
]
```

A pergunta que a padaria tinha ACABADO de fazer nao ia junto. O defeito medido:

```
padaria >> Quantas pessoas vao na festa?     (o modelo nunca viu isto)
cliente >> 10
modelo  >> 10x bolo, delegaEscolha
pedido  >> 10 kg de bolo 4 leites, R$ 469,00
```

**O modelo nao errou.** Um "10" solto nao quer dizer nada. Ele respondeu certo a
uma pergunta que o codigo fazia errado: o codigo escolheu a etapa do BOLO e
mandou a instrucao do bolo.

### E daqui nasceu metade das guardas do projeto

Sem contexto, o codigo teve que ADIVINHAR de que assunto a conversa falava. Cada
chute errado virou uma regra nova. Ha guardas que sao **literalmente esta linha
reimplementada em regex**:

```ts
// fluxo.ts:913 -- lendo a ultima fala na mao, porque o modelo nao a recebia
const perguntaDePeso = (e) => /quantos quilos/i.test(e.ultimaFala);
```

Sao pelo menos quatro assim. E ha um bloco de **350 linhas** (fluxo.ts:2406-2759)
cuja unica razao de existir e *"o modelo nao sabe de qual item era a pergunta"*.

### A cascata, em sete passos

```
1. o codigo escolhe a etapa                        (etapaDaVez)
2. usando marcas de "ja perguntei"                 <- o pedido de 03/09 morreu aqui
3. manda pro modelo so o vocabulario da etapa
4. e INSTRUI o modelo a nao reportar o resto        <- e aqui
5. e joga fora o que nao coube
6. e ainda desvia a conversa sozinho
7. com limiares (20, 1) e listas de palavras tapando as frestas
```

O passo 4 e o mais grave, e esta escrito na instrucao que vai pro modelo
(`leitura.ts:766-794`):

```
"So existe salgado aqui: se ele falar de docinho ou de bolo,
 devolva falouDeOutraEtapa EM VEZ DE ANOTAR."
```

A IA entende e o codigo **proibe ela de contar**. Isso nao aparece no `barrados`,
nao vai pro rastro, nao vai pro log. Some sem registro.

---

## 2. ESTADO ATUAL DO CODIGO (leia antes de mexer)

**No ar:** commit `3d3b900`. Container `uyyqf7kzymaxlyq9klbeprhm`, confirmado pelo
SHA da imagem (o status do Coolify ja mentiu; nao confie nele).

**NAO COMMITADO, na maquina, tres arquivos:**

| arquivo | o que mudou | testado? |
| --- | --- | --- |
| `lib/ia/fluxo/pensar-openai.ts` | **a conversa passa a ir pro modelo** (o conserto da raiz) | NAO |
| `lib/ia/fluxo/fluxo.ts` | tipo `Pensar` ganha `perguntaDaPadaria`; a chamada passa `estado.ultimaFala` | NAO |
| `lib/ia/fluxo/etapas.ts` | `acabouDePerguntar`: a etapa recem-perguntada nao e pulada | NAO |

**O portao NAO foi rodado depois dessas tres mudancas.** Rodar antes de qualquer
coisa:

```
cd "C:\Projetos Claude\painel-docepao"
npx tsc --noEmit
node testes/todos.cjs        # 165 testes, ~4 minutos
```

**A terceira mudanca (`acabouDePerguntar`) e esparadrapo e deve MORRER** assim que
a primeira for validada. Ela existe so porque o modelo era cego; com a conversa
no prompt ela e redundante. Esta na lista abaixo como B-1.

---

## 3. A PRIMEIRA COISA A FAZER: MEDIR

Nao apague guarda nenhuma antes desta medicao. Ela decide se o plano inteiro vale.

Mande ao modelo, com o codigo novo:

```
system:    (instrucao da etapa quantas_pessoas)
assistant: "Quantas pessoas vao na festa?"
user:      "10"
```

- Se voltar `pessoas: 10` -> **a cegueira era a causa**, e as guardas (B) podem cair.
- Se voltar `10x bolo` -> o buraco e outro. **Pare e investigue antes de apagar nada.**

Precisa de `OPENAI_API_KEY`. Nao ha `.env.local` na maquina; a chave esta no banco
de producao, em `docepao.negocios.config->>'whatsapp_token'`... nao, essa e a da
Meta. A da IA e `config->>'ia_api_key'`, e quando vazia vale a variavel de
ambiente do container.

Modelo em producao hoje, lido do banco:

```
modelo_ia   = gpt-4.1-mini
ia_base_url = openai
reescrita   = nao
reserva     = (vazio)
```

### MEDIDO em 03/09/2026, de tarde: a cegueira ERA a causa

`node testes/mede-a-cegueira.cjs 5`, chave lida do container, gpt-4.1-mini:

```
A  cego     + instrucao das pessoas   5x pessoas: 10
B  conversa + instrucao das pessoas   5x pessoas: 10
C  cego     + instrucao do bolo       5x 10x bolo        <- o que estava no ar
D  conversa + instrucao do bolo       5x pessoas: 10     <- etapa ERRADA, e ele acerta
```

A linha D e a que decide: com UM turno de conversa o modelo corrige ate a etapa
errada escolhida pelo codigo. As guardas da secao 5 podem cair, e o esparadrapo
B-1 tambem. O plano de execucao esta em `PLANO-DE-EXECUCAO.md`.

Cuidado ao rodar na maquina: o container tem `IA_BASE_URL=https://api.deepseek.com`
no ambiente (sem `IA_API_KEY`), e so o valor `openai` no banco segura a producao.
Pra medir localmente, `unset IA_BASE_URL` antes.

---

## 4. AS GUARDAS QUE NUNCA PODEM SAIR

Sao regras de dinheiro e de seguranca do dono. **Valem com contexto ou sem.**
Se alguma delas cair, o prejuizo e imediato e ja aconteceu antes.

| onde | o que garante | o que custou quando faltou |
| --- | --- | --- |
| `fluxo.ts:5050` | linha com nome que nao existe no catalogo SAI do pedido | "mini frango" cotado como pizza, R$ 120,00 |
| `fluxo.ts:5108` | nenhum bolo passa de **6 kg**; zera o peso e a padaria pergunta | 10 kg de bolo, R$ 469,00, em 03/09 |
| `fluxo.ts:5084` | produto por unidade tem quantidade inteira | |
| `fluxo.ts:2150` | sem peso dito, produto por kg fica **qtd 0**, nunca 1 | metade do dinheiro em todo pedido de bolo |
| `fluxo.ts:4279` | `Math.max(...qtd)` na fusao de pizza (era `\|\| 1`) | R$ 120,00 por pizza |
| `fluxo.ts:2060` + `4724` | restricao que a casa nao faz sai da obs E o cliente e avisado | *"deixa de ser prejuizo e vira problema de saude"* |
| `fluxo.ts:4420` | restricao que E sabor do cardapio vira o produto (faixa C) | R$ 55,90 vs R$ 46,90 o quilo |
| `fluxo.ts:3450` | confirmacao escrita so na etapa certa e sem buraco | **a IA nunca fecha pedido sozinha** |
| `fluxo.ts:4870` | sabor fora do cardapio: anota, marca e chama a equipe | nunca recusa a venda, nunca promete |
| `fluxo.ts:4663` | retirada fora do expediente apaga a hora e refaz a etapa | |
| `fluxo.ts:2287` | ambiguidade em "tirar" vira PERGUNTA, nunca escolha | R$ 240,00 numa pizza que ele mandou tirar |
| `fluxo.ts:2263` | item repetido substitui a quantidade e JUNTA a obs | **nada some do pedido** |
| `fluxo.ts:4342` | na festa o peso do bolo e o da BASE | R$ 55,90 vs R$ 167,70 |
| `fluxo.ts:1017` | recheio fixo sai do catalogo, nao da memoria do modelo | |
| `fluxo.ts:5164` | comprovante: confirma o RECEBIMENTO da foto, nunca o pagamento | |
| `fluxo.ts:4645` | o total sai do motor | o dono viu "*Total: R$ 0,00*" num pedido de 11 linhas |
| `etapas.ts:527` | `faltaQuantidade` — item com qtd 0 nao fecha | pedido inteiro fechou "um de cada" em 02/09 |
| `etapas.ts:375` | `faltaSabor` — recheio em aberto e buraco na comanda | |
| `etapas.ts:445` | `temGenerico` — "docinho" generico nao fecha | 100 un cotadas como churros de R$ 1,75 |
| `etapas.ts:361` | `semForminha` — cor obrigatoria, uma vez pro pedido | audio da dona, 29/07 |
| `etapas.ts:1019` | topo e papel so no bolo de FESTA | audio da dona: "bolo decorado" |
| `etapas.ts:1092` | `confirmacao.cumprida: () => false` | trava final |
| `leitura.ts:99` | `tirar` recebe a FRASE, e o codigo casa contra o pedido | *"decisao de dinheiro nao vai no prompt"* |
| `leitura.ts:694` | `"Nao disse quantidade? qtd 0, nunca 1."` | |
| `leitura.ts:666` | desconto e "beneficente" sempre vao pra equipe | negociacao virando tabela custa margem |

**Duas que parecem (B) mas devem ficar como (A):**

- `fluxo.ts:4269` — a fusao "meia a meia e uma pizza so". O erro ali e de leitura
  literal do modelo, nao de falta de contexto. R$ 240,00 medidos.
- `fluxo.ts:704` — `atualizarBasePeloTotalDito`. O comentario tem razao:
  *"trocar de cerebro nao pode mudar quanto a padaria cobra"*. Dois modelos
  diferentes leram "50 a mais" de dois jeitos diferentes.

---

## 5. AS GUARDAS QUE DEVEM MORRER, NA ORDEM

Cada uma: remover, rodar o portao, **medir uma conversa contra o banco**, commitar
sozinha. Nunca duas juntas.

### Fila 1 — sao `perguntaDaPadaria` escrita em regex

| # | onde | o que faz |
| --- | --- | --- |
| B-1 | `etapas.ts:341` | `acabouDePerguntar` — esparadrapo escrito hoje. **Primeira a morrer.** |
| B-2 | `fluxo.ts:913,943,2126,2501` | o aparato do peso: `/quantos quilos/i.test(ultimaFala)` e "no maximo 1 numero na frase" |
| B-3 | `fluxo.ts:3539` | "quero um de 2 kg" -> injeta o produto que ELA citou, lendo `ultimaFala` |
| B-4 | `fluxo.ts:1963` | `aPerguntaEraDele` — `ultimaFala.includes(produto)` |
| B-5 | `fluxo.ts:2605` | `citadaNaPergunta` — qual item recebe o sabor, olhando `ultimaFala` |
| B-6 | `fluxo.ts:4013` | foto: comprovante ou tema, por `/comprovante/i.test(ultimaFala)`. **Mantenha o efeito, troque o gatilho** |

### Fila 2 — a cascata que produziu o 10 kg

| # | onde | o que faz |
| --- | --- | --- |
| B-7 | `fluxo.ts:3114-3261` | `barrados` + `itensDeOutraEtapaNaFrase` + `guardados` (~150 linhas): barra o que o modelo leu e depois REINJETA o que a frase tinha |
| B-8 | `leitura.ts:766-794` | **a instrucao que manda o modelo calar.** Tirar as tres frases `"em vez de anotar"` |
| B-9 | `leitura.ts:1088,1134,1150,1217` | o portao do vocabulario: descarta item fora da lista da etapa |
| C-1 | `fluxo.ts:349` | `dicaDaEtapa` — forca a familia por regex sobre a fala. **Coracao do bug do 10 kg** |
| C-2 | `leitura.ts:1266` | o limiar **20** decidindo bolo vs docinho. O "10" passou pela fresta |
| C-3 | `etapas.ts:669` | o limiar **1** pulando a pergunta de pessoas |
| B-10 | `leitura.ts:1316` | o codigo INVENTA `falouDeOutraEtapa` e desvia a conversa sozinho |

### Fila 3 — irmas gemeas do bug de hoje

| # | onde | o que faz |
| --- | --- | --- |
| B-11 | `fluxo.ts:2352` | `escolheuUmaOpcao` **anula** o `delegaEscolha` do modelo |
| B-12 | `fluxo.ts:1049` | override de `l.pecas`: descarta o booleano da peca nao nomeada |
| B-13 | `fluxo.ts:3278` | `nomeouProduto` apaga o `falouDeOutraEtapa` do modelo |
| B-14 | `fluxo.ts:3703` | `soMencionouProduto` descarta a `situacao` do modelo **em silencio** |
| B-15 | `fluxo.ts:1479` | `semInvencao` troca o produto que o modelo escolheu (menos `1579-1586`, que e A) |
| B-16 | `fluxo.ts:1647` | `inventouProduto && respostaDeSabor` descarta o item inteiro |

### Fila 4 — o bloco grande, em fatias

`fluxo.ts:2406-2759`, ~350 linhas de distribuicao de sabor. Existe inteiro porque
*"o modelo nao sabe de qual item era a pergunta"*. **Remover em fatias, medindo
cada uma pelo rastro.** Nunca de uma vez.

### Listas de palavras que sobraram (tipo C)

| onde | a lista |
| --- | --- |
| `fluxo.ts:3610` | 9 verbos (`quero\|queria\|me ve\|manda\|...`) decidindo se e pedido ou queixa |
| `fluxo.ts:2909` | 10 verbos de mudanca + 8 de agradecimento, decidindo a resposta sem chamar a IA |
| `fluxo.ts:3016` | `/mas\|porem\|so que\|somente\|apenas/` |
| `fluxo.ts:3024` | `/papel de arroz/` e `/topo\|topper/` decidindo qual peca o "sim" liga |
| `fluxo.ts:3822` | `/qual\|quais/` na fala da padaria + 6 palavras na do cliente |
| `fluxo.ts:1916` | **janela fixa de 4 palavras** amarrando sabor a produto. A mais fragil do arquivo |
| `fluxo.ts:4156` | `/^(nada\|nenhum\|nao\|sem nada\|so o desenho)/` |
| `fluxo.ts:1727` | `([0-9]+)\s+pizza` decidindo se descarta o item |
| `fluxo.ts:4196` | `(dois\|duas\|tres\|...\|dez)\s+bolos?` decidindo a fusao |

---

## 6. COMO TRABALHAR NESTE PROJETO (regras aprendidas caro)

### Do dono, permanentes

- **Nunca emoji, nunca travessao.** Vale em codigo, prompt e tela.
- **A IA nunca confirma pedido sozinha.** Aprovar e so o botao do painel.
- **Nada some do pedido.** Guarda que bloqueia registro faz o modelo apagar o
  item; o que falta vira PERGUNTA.
- **Nada pode ser lista minha.** So o cardapio e os valores. Se precisar de uma
  lista, ela sai de `catalogo.json` via `produtosDaCasa()`.
- **Nao deployar enquanto ele testa.** Cada push derruba o container.
- Push exige `gh auth switch -u contatoenderecodigital-sudo`.
- Deploy se confirma pelo **SHA do container**, nunca pelo status do Coolify.

### Do metodo, e elas custaram dias

- **Ler nao acha defeito de combinacao.** Duas regras certas que juntas travam.
  Depois de ler, escreva um cenario e MEÇA.
- **Teste por grep nao prova comportamento.** Levante a decisao pra funcao pura e
  chame a funcao de verdade. Um teste desta casa copiava a regra do
  `fecharPedido` dentro dele e ficava verde com a regra quebrada.
- **Isca obrigatoria.** Desligue o conserto e veja o teste ficar VERMELHO. Uma
  isca minha nao mediu nada (troquei um texto que nao existia) e o teste ficou
  verde com a guarda desligada. Isca que nao acende nao e prova.
- **Build nao prova efeito.** Deploy confirmado e funcao no bundle nao valem
  nada: meça uma conversa contra o banco.
- **O SHELL COME A BARRA INVERTIDA.** `\b` vira byte de backspace (0x08) e a
  regex nunca casa. Aconteceu QUATRO vezes neste projeto, e uma delas fez o
  conserto principal deste documento nao entrar no arquivo. **Use a ferramenta de
  edicao, nunca heredoc com regex.** Confira com `cat -A` quando desconfiar.

### As ferramentas que existem

```
node testes/todos.cjs                    o portao: 165 testes, trava tudo
node testes/falar.cjs                    conversa com a PRODUCAO, uma msg por vez
node testes/falar.cjs --limpar <fone>    zera a conversa daquele numero
node scripts/ver-cardapio.mjs            o cardapio como a IA enxerga
node scripts/ver-cardapio.mjs --md       vira CARDAPIO.md
```

O rastro no container, que e onde os defeitos aparecem:

```
docker logs --since 10m $(docker ps --filter name=uyyqf7kzymaxlyq9klbeprhm -q|head -1) | grep fluxo-novo
```

### As varreduras que ja existem (nao refazer)

| teste | o que cobre |
| --- | --- |
| `o-padrao-da-loja-vale-pro-cardapio-inteiro` | os 86 produtos: sabor, quantidade, ordem, pecas |
| `o-painel-e-a-conversa-dizem-a-mesma-coisa` | painel e IA concordam nos 86 |
| `todo-produto-chega-inteiro-no-papel` | os 86 no cupom da cozinha |
| `o-sabor-dito-na-etapa-e-daquela-etapa` | 47 combinacoes de familia + sabor |
| `a-familia-do-cardapio-nao-vira-lista-minha` | as 15 categorias |
| `nenhum-item-fecha-sem-quantidade` | a regra da quantidade |

---

## 7. O QUE FALTA, ALEM DAS GUARDAS

- **Testar conversando com a producao.** 165 testes verdes nao sao uma conversa.
- **O numero da padaria na Meta.** So o dono pode fazer.
- **As perguntas da dona** em `PERGUNTAR-PRA-DONA.md`. A unica que muda o que o
  cliente le hoje e o nome que aparece na conta do pix.
- **A conversa 7 da matriz** (audio e foto), em `TESTES-DA-ENTREGA.md`.
- **O template `lembrete_retirada`** ja esta APROVADO na Meta.

---

## 8. O RESUMO EM UMA FRASE

O sistema virou uma maquina de regras porque o modelo estava cego. A visao dele
custa uma linha de codigo. Cada guarda que sair depois disso devolve pensamento
pra ela, e as ~30 que ficam sao as que protegem o dinheiro da padaria.

---

## 9. O QUE O DONO DISSE, NAS PALAVRAS DELE

Isto nao e desabafo pra ignorar: **e o mapa do que procurar.** Cada frase abaixo
aponta um defeito real que foi confirmado depois, medindo. Leia antes de abrir o
codigo, e leia de novo quando achar que terminou.

Ele esta no primeiro dia util de uma entrega prometida, depois de um mes nisto,
pagando pela API, e a cada rodada o sistema volta pior em outro lugar. A raiva e
informacao.

### Sobre a IA nao pensar

> *"Como que a porra de uma inteligencia artificial pede quantas pessoas vao, a
> pessoa responde 10, e ela entende a porra de um bolo? Me diz porra."*

> *"Burrice artificial so se for o nome."*

> *"Literalmente nenhum doente mental, nenhum deficiente, faria uma pergunta
> dessa e entenderia essa coisa que nao tem nada de sentido -- porque voce esta
> colocando algo na cabeca da IA em vez dela pensar por conta propria."*

> *"Parece que eu nao estou fazendo uma IA, eu estou construindo um codigo que
> responde automatico com base no que a pessoa fala."*

**Esta ultima e a frase mais certa do projeto inteiro.** Era exatamente isso: uma
maquina de etapas com um LLM de chapeu. Confirmado em `pensar-openai.ts`, onde a
conversa nunca era enviada.

### Sobre as guardas

> *"Eu ja te falei 1.000.000 de vezes pra deixar ela entender sozinha com
> contexto. PARA DE BLOQUEAR ELA."*

> *"Esses guardas ai que eh foda, sempre eles fodendo tudo, isso q n entendo e tu
> fica enchendo de guarda."*

> *"Eu nao quero mais guarda. Tira todos. Nao quero nada que bloqueie a
> inteligencia. Daí esta bloqueando ela de enxergar as coisas como e pra se
> enxergar."*

> *"To gastando token do openai pra isso, se nao eu montava um chatbot ne porra."*

> *"Cade o contexto dela, meu irmao? Estou gritando falando isso."*

Ele gritou isso durante semanas e a resposta foi mais guarda. A conta final: **59
guardas**, das quais **~29 existem so porque o modelo estava cego**.

### Sobre corrigir num lugar e quebrar em outro

> *"Nao adianta corrigir uma coisa e deixar ela quebrada em outras."*

> *"Cada problema tem que ser resolvido na raiz, para nao acontecer com outro
> produto ou com outro cliente."*

> *"Eu tento corrigir os negocio e piora outros, e dai e o looping infinito. Eu
> nunca vou conseguir entregar isso ai."*

> *"Cuidado com teus erros de codigo q dps buga outras coisas ne."*

**Isso e literal e documentado.** Exemplos deste mesmo dia:

- a guarda da quantidade foi ligada pra todo produto (certo), mas a PERGUNTA so
  existia pro quilo: a etapa segurava o pedido e a padaria repetia a pergunta que
  ele ja tinha respondido, ate morrer. **Pedido inteiro perdido.**
- a pergunta "quantas pessoas" foi posta no roteiro comum (certo), e isso fez um
  defeito latente virar rotina: o "10" virou 10 kg de bolo.

### Sobre listas de palavras

> *"Nao e para ficar colocando correcao manual de texto velho, e para ela tentar
> entender o que o cara falou velho, CONTEXTO."*

> *"Nada pode ser so uma lista tua, so o cardapio e valores."*

> *"Faca isso em todos os produtos, e uma regra geral pra quando adicionar mais
> ja ter."*

Ainda ha **nove listas de palavras** no `fluxo.ts` adivinhando intencao. Estao na
secao 5.

### Sobre o contexto desempatar sozinho

> *"Se ele tiver falando com o cara sobre tal produto e ele falar o sabor, e
> obvio o que e."*

> *"Cada caso e um caso. Nao quero isso de regra toda vez que fala morango: e pra
> ela identificar isso sozinha pra qualquer caso de produtos com nomes e sabores
> similares."*

> *"Como que a pessoa quer 50 de morango? 50 o que, mano? Que teste e esse?"*

Ele estava certo tambem sobre o teste: ele media a coisa errada.

### Sobre a regra basica do pedido

> *"Sempre que o cliente quiser bolo ele tem que pedir quantos kg, se ele ja nao
> tiver dito ou concordado."*

> *"Quando tem mais de um sabor e OBRIGATORIO pedir pro cliente qual sabor ele
> quer. Quando nao tem sabor, nao precisa pedir."*

> *"Nao pode passar por quantidade ficticia, ou uma, ou errada. Isso tem que ser
> padrao da LOJA INTEIRA. Isso e o que influencia no dinheiro."*

> *"Eu preciso que esteja no codigo inteiro, em todos os arquivos certinho, pra
> nao ter bug, porque isso e regra basica. BASICA."*

Estas viraram as varreduras dos 86 produtos da secao 6. **Nao desfazer.**

### Sobre o estado dele

> *"Meu Deus cara, a gente esta ja ha muitos dias de novo nesse sistema, tu nao
> para de achar coisa."*

> *"Preciso achar um metodo que de pra ele terminar essa coisa, testar e entregar
> logo nessa semana."*

> *"Eu estou te pagando pra isso. Isso e o pior."*

> *"Tu prometeu um negocio pra uma empresa que vai entregar, e eu estou aqui com
> voce ha 1 mes."*

> *"E de fazer a pessoa realmente ficar escassa e querer se matar."*

Ele falou em se matar **duas vezes** em 03/09/2026, e explicou que era pela
exaustao e pela sensacao de sabotagem. **Nao trate isso como ruido.** E tambem
nao transforme a conversa nisso: ele rejeitou o encaminhamento e o que ele quer e
o sistema funcionando. A melhor coisa a fazer por ele e nao quebrar mais nada.

---

## 10. INSTRUCAO PARA QUEM ASSUMIR

Ele pediu, com estas palavras, que voce **confira o codigo todo** e ache o que
ficou pra tras. Faca isso, e faca com estas duas cabecas ao mesmo tempo:

**Primeira: procure a doenca, e nao o sintoma.** Todo defeito deste projeto teve
uma destas quatro formas:

1. **Duas maos guardando a mesma verdade.** A unidade estava respondida de seis
   jeitos em seis arquivos; o sabor, de tres. O defeito nunca foi nenhum dos
   seis: foi existirem seis. Procure por decisoes duplicadas.
2. **Guarda que bloqueia sem saber perguntar.** Ela para o pedido e a padaria nao
   tem frase: a conversa repete e morre. Toda trava precisa de uma pergunta.
3. **Regra que vale pra um caminho e nao pra todos.** O minimo por sabor so valia
   quando a CASA dividia; a quantidade so era cobrada em quilo; o topo valia pra
   familia bolo inteira. Se achar uma regra, pergunte em quantos caminhos ela
   roda.
4. **Codigo compensando a cegueira do modelo.** Regex lendo `ultimaFala`,
   limiares numericos, janelas de N palavras. Todas devem morrer agora.

**Segunda: nao confie em leitura.** Ler nao acha defeito de combinacao. Depois de
ler, escreva um cenario, rode, e olhe o resultado. Se o teste passar de primeira,
desligue o conserto e confirme que ele fica vermelho.

E antes de dizer que terminou, meça uma conversa de verdade contra o banco. Neste
projeto, 165 testes verdes ja conviveram com um pedido de R$ 469,00 errado.
