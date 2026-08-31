# O que perguntar pra dona

Este é o arquivo VIVO das perguntas. Toda vez que eu achar algo que o sistema
precisa saber e os áudios não respondem, cai aqui, com o motivo e o que muda no
atendimento dependendo da resposta.

Aberto em 26/08/2026, a pedido dele: *"anota tudo q precisa q eu peca num .md q
tu for achando"*.

Regra: pergunta que já foi respondida sai daqui e vira fato no catálogo ou em
`lib/ia/fatos.ts`, com a data e a origem da resposta.

**Regra nova, 30/08/2026, e a razão dela.** Antes de escrever pergunta aqui, ir
nas 55 transcrições cruas em
`Desktop/EnderecoDigital/clientes/padariadocepao/audios/`, e não só no resumo
`O-QUE-A-DONA-FALOU.md`. Nesta data a lista tinha doze perguntas e **seis já
estavam respondidas**: quatro no próprio resumo, que eu não reli, e duas só nas
transcrições cruas, que o resumo não tinha pego. Palavra dele: *"TEM NA PORRA DOS
AUDIOS TUDO MERMAO, ouve os audios antes de fzr tudo as perguntas pra dona"*.
Ele estava certo. Perguntar de novo o que ela já respondeu queima a paciência da
cliente e o tempo dele.

---

## A LISTA, na ordem em que ele deve perguntar

Numeradas pra ele poder mandar por áudio e ela responder pelo número. Seis, e
nenhuma delas tem resposta nos 55 áudios.

### Produto e preço

**1. O que muda no cupcake recheado?**

Ela citou o preço duas vezes e o tamanho em centímetros, e nunca disse o que é o
recheio. A IA vai precisar explicar isso pro cliente que perguntar "recheado de
quê?".

Achado no caminho, e que torna a pergunta urgente: o sistema estava cobrando o
cupcake recheado pelo preço do sem recheio (R$ 2,00 no lugar de R$ 3,00, e
R$ 5,00 no lugar de R$ 7,00). Já corrigido. Mas se o recheio tiver sabores
diferentes, a IA vai ter que perguntar qual, e hoje ela não pergunta.

**2. `bolo prestígio com ganache` e `bolo prestígio` são a mesma coisa?**

Existem os dois no catálogo, e são produtos diferentes:

| nome | o que é | preço |
| --- | --- | --- |
| bolo prestígio | bolo de festa, por quilo | R$ 46,90/kg |
| bolo prestígio com ganache | bolo caseiro, por unidade | R$ 33,90 |

O sistema já sabe diferenciar os dois pelo nome completo (consertado em
26/08/2026: antes o caseiro saía cotado como o de festa, R$ 46,90 no lugar de
R$ 33,90, e ainda por quilo em vez de por unidade).

O que falta saber: quando o cliente diz **só "bolo de prestígio"**, a IA
pergunta qual dos dois, ou tem um que é o óbvio? Hoje ela entende como o de
festa, calada.

**3. Tem `banana caramelizada` e `laranja caramelizada` nos bolos caseiros?**

Os dois estão no catálogo, e o sistema agora trata como dois bolos diferentes
(antes a banana era cotada com o preço da laranja, R$ 34,90 no lugar de
R$ 30,90). Só quero confirmar com ela que são dois mesmo, e não um cadastrado
duas vezes com o nome trocado.

**4. `café` é bolo caseiro E docinho ao mesmo tempo?**

O catálogo tem os dois: docinho de café R$ 1,25 e bolo caseiro de café R$ 35,90.
Hoje a IA já decide pela etapa da conversa (na hora do bolo é o bolo, na hora do
docinho é o docinho), mas se a dona confirmar que um dos dois não existe mais, a
ambiguidade some.

**5. Fora a lactose, a casa faz alguma restrição?**

Glúten, vegano, diet e integral **não aparecem em lugar nenhum** do catálogo, e
não aparecem em nenhuma das 55 transcrições (procurados um por um em
30/08/2026: zero ocorrência de glúten, vegano e diabético). Preciso confirmar
que é porque a padaria não faz mesmo, e não porque ninguém cadastrou.

A lactose saiu desta pergunta porque ela já respondeu. Está lá embaixo.

### Regra de atendimento

**6. Sabor fora do catálogo: a IA anota e a equipe confirma, ou ela pergunta antes?**

Ela disse que a lista é aberta:

> *"coloca só esses dois sabores, quatro leites e brigadeiro, a princípio. Aí, se
> o cliente pedir outro sabor, a gente vai colocando"*

Hoje o sistema RECUSA o que não está no catálogo. Isso está errado, e o conserto
depende de saber se a IA aceita na hora ou passa pra equipe.

---

## O QUE OS ÁUDIOS JÁ RESPONDERAM

Seis perguntas saíram da lista em 30/08/2026. Cada uma com a fala dela e onde a
resposta vive hoje.

**Bolo sem lactose: dá pra fazer, e o preço é o do mais caro.**
Estava como pergunta 4c, e era a mais cara das cinco. A resposta não estava no
resumo, só na transcrição crua `docepao1608 (3).txt`:

> *"Sim, Emily, dá pra misturar. Sim, com certeza. A gente sempre vai cobrar o
> valor mais caro. Por exemplo, laca com morango vai ficar R$ 49,90. Se a pessoa
> quiser morango com nozes, vai ficar R$ 55,90. Se ela quiser o bolo zero
> lactose, que contenha, por exemplo, coco, que é o valor de frutas ali, ele vai
> ficar também R$ 55,90. Então, sempre vai prevalecer o valor mais caro."*

Ou seja: `0% lactose` não é sabor fechado. Mistura com outro sabor, e vale a
faixa mais cara, que é a mesma regra do bolo misto que o sistema já cobra certo
(`lib/ia/fluxo/fluxo.ts`, o bloco do bolo misto, e o convite em
`lib/ia/fluxo/pergunta.ts`).

**Fica uma decisão pra ele, não pra ela.** Hoje a IA não cota bolo com
restrição: ela tira a promessa da observação e chama a equipe, e isso foi
decisão dele em 26/08/2026. Com esta fala, a IA poderia cotar R$ 55,90 o quilo
na hora. Eu não virei essa chave sozinho, porque quem decidiu chamar a equipe
foi ele.

**O cupcake grande tem os mesmos sabores do pequeno, e o sabor não mexe no preço.**
Estava como pergunta 2. A fala está na transcrição crua `docepaonew.txt`:

> *"Os cupcake, os pequenininhos, a gente faz a R$2,00 o sem recheio e R$3,00 o
> recheado, independente do sabor. Tem quatro leites, brigadeiro, acho que
> coloca só esses dois sabores, quatro leites e brigadeiro, a princípio. Aí, se
> o cliente pedir outro sabor, a gente vai colocando."*

`independente do sabor` é o que fecha a questão: quem manda no preço é o tamanho
e o recheio, nunca o sabor. E a lista de sabores é do cupcake, não de cada
tamanho, então o que o sistema já assume está certo.

Fica anotado o que essa mesma fala NÃO resolve, e por isso não virou catálogo:
logo depois ela emenda *"tem chocolate, doce de leite, abacaxi, vinho, goiaba,
frutas vermelhas, tem a de limão também"*, e não dá pra afirmar pela transcrição
se essa lista é de cupcake ou de outro produto. Cadastrar isso como sabor de
cupcake seria eu inventando, então não cadastrei.

**Cachorro-quente: mini é um preço, médio e grande é outro.**
Estava como pergunta 5, e a pergunta era se o cliente pode pedir médio ou grande
pelo nome. Pode, e entre esses dois a conta é a mesma. A fala completa está em
`docepaonew.txt`:

> *"O pão de cachorro-quente, a gente tem o pequenininho, que é o de mini
> bisnaguinha, que a gente chama o mini cachorro-quente. A gente faz o médio e
> faz o grande, só que agora eu tô em casa e eu não lembro o valor."*

Ela não lembrava o valor no áudio, mas o catálogo já está de acordo com o que
ela descreveu: `cachorro-quente mini` R$ 20,90/kg e `cachorro-quente` R$ 19,90/kg
com a nota `medio e grande`. Dois preços, como ela disse. Conferido no
`lib/ia/dados/catalogo.json` em 30/08/2026.

**Desconto e beneficente: a IA nunca dá o preço por unidade.**
Estava como pergunta 6. Ela já ditou a frase:

> *"aí ela pode sempre falar assim, ah, então deixa eu ver a possibilidade de um
> desconto, eu já te retorno."*

Já implementado: a IA responde isso e chama a equipe, sem citar R$ 1,20 nem
R$ 1,40.

**Bolo com foto: não é pergunta pra ela, é pergunta DELA pra nós.**
Estava como pergunta 8. Ela contou o fato e devolveu a dúvida:

> *"nós temos um grupo da confeitaria que a gente encaminha todas as fotos dos
> bolos que o cliente escolhe... será que a nossa Dorinha vai conseguir
> encaminhar para a turma da confeitaria? Se não conseguir, não tem problema."*

Perguntar isso de volta pra ela seria devolver a pergunta que ela fez. É decisão
de sistema, e entra no que falta construir, não no que falta perguntar.

**Bolo redondo acima de 2,5 kg: o fato está dito.**
Estava como pergunta 9.

> *"acima de 2 quilos e meio até 4 quilos a gente precisa fazer mais alto. E se
> for acima de 4 quilos, 3,5 até 5 quilos, vai ser um pão de ló redondo mais
> baixinho."*

O que sobrava não era o fato, era se a IA explica isso ou deixa pra equipe, e
ela mesma já liberou os dois caminhos: *"Não sei se ela vai conseguir explicar
isso para o cliente, mas aí qualquer coisa ela pode estar perguntando."*
Decisão nossa.

---

## De onde vem cada uma

As perguntas 1, 5 e 6 saíram da varredura das 55 transcrições, em
`O-QUE-A-DONA-FALOU.md`, com a citação de origem.

As perguntas 2, 3 e 4 saíram da padronização do catálogo, em 26/08/2026, medindo
o nome que a IA escreve contra o nome que o motor de preço entende.
