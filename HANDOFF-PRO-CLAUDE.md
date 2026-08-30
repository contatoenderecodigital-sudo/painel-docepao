# Passagem de bastao, 30/08/2026

Escrito no fim de uma sessao que rodou de fora desta pasta. Tudo que esta
aqui foi medido, e o que nao foi esta marcado como nao medido.

---

## A COISA MAIS IMPORTANTE QUE APARECEU HOJE

**O deploy estava quebrado ha quatro horas e ninguem sabia.**

O container rodava `b034101`, com **trinta commits** da main em cima dele. A
campanha inteira (pizza que nao vira salgado, pedido misturado, colisao de
nome curto, sabor obrigatorio) estava escrita, testada e **fora do ar**.

A fila do Coolify contava: oito construcoes seguidas, todas `failed`, desde
as 05:20. O motivo era uma linha em `app/(painel)/testar/page.tsx`:

    onClick={enviar}

O `next build` reprova o tipo, o Docker para no `npm run build`, e o Coolify
MANTEM o container antigo no ar (que e o certo). Nada grita na tela.

E nao era so erro de tipo: `onClick={enviar}` entrega o MouseEvent no lugar
do `toque`, e evento e truthy, entao `String(toque.titulo || toque.id)` dava
a string **"undefined"**. Quem clicava no botao de enviar da tela `/testar`
mandava a palavra "undefined" pro cerebro. So o Enter funcionava.

**Isso explica semanas de "consertaram e continua igual":** durante um bom
tempo, o dono testava um container velho, com uma ferramenta de teste
quebrada. Nada do que ele via na tela refletia o trabalho.

Fechado por `testes/o-deploy-nao-quebra-no-tipo.cjs`, que roda a mesma
checagem de tipo do build em seis segundos. Isca provada a mao nos dois
sentidos.

**Confira o SHA do container SEMPRE, antes de qualquer conclusao:**

```
ssh -i ~/.ssh/id_ed25519_hub root@179.198.126.197 \
  "docker ps --format '{{.Image}}' | grep uyyqf7"
```

Tem que bater com `git rev-parse HEAD`. A chave SSH existe nesta maquina, em
`~/.ssh/id_ed25519_hub`. E da pra ler por que uma construcao falhou:

```
ssh -i ~/.ssh/id_ed25519_hub root@179.198.126.197 \
  "docker exec coolify-db psql -U coolify -d coolify -t -A -F'|' \
   -c \"select id,status,commit from application_deployment_queues \
        order by created_at desc limit 5;\""
```

---

## A RAIZ QUE FAZIA AS CORRECOES NAO TEREM FIM

As etapas de produto eram **tres** (salgado, docinho, bolo), escritas a mao
num objeto de tres linhas. Medido: **24 dos 86 produtos** nao pertenciam a
etapa nenhuma. Nove familias: pizza, torta, empadao, cupcake, pao, cuca,
calzone, franciscano, bolo salgado.

O estrago nao era "a padaria nao pergunta". A pergunta saia; a **RESPOSTA**
chegava numa etapa que nao conhece aquele produto e era descartada. A
conversa repetia a mesma pergunta ate o cliente desistir. Cada familia caia
nisso por uma porta propria, e cada porta virava um remendo.

Agora existe a etapa `resto_do_cardapio`, e as categorias dela saem do
**catalogo**: familia nova da dona ja nasce com dono, sem editar codigo.
`testes/toda-categoria-tem-etapa.cjs` reprova se alguem voltar a escrever a
lista a mao.

---

## O QUE ENTROU NA MAIN HOJE

| commit | o que | prova |
| --- | --- | --- |
| `d00b2bb` | pergunta de outra familia nao gruda na etapa (o print do Rodrigo) | conversa ao vivo |
| `61d2275` | o deploy voltou a funcionar, e o portao passa a pegar isso | container saiu de 30 commits atras para o HEAD |
| `3da3630` | 24 produtos ganharam etapa, tirada do catalogo | teste com isca provada |
| `3c60e47` | a resposta do tipo e casada com as opcoes do catalogo | conversa ao vivo, pedido fechou |
| `c06e8cb` | regra "uma linha por sabor" nas 4 etapas de produto | portao |
| `8654e30` | **revert** de uma tentativa que piorou | conversa ao vivo |

Portao local: **111 de 111**. Build limpo. Container em `8654e30`.

---

## A PRIMEIRA TAREFA: A QUANTIDADE

> **FECHADA NO CODIGO EM 30/08/2026, e ela tinha TRES camadas, nao uma.**
> A leitura (instrucao da etapa), a reparticao (`fluxo.ts`) e a **gravacao**
> (`montagem.ts`). Depois das duas primeiras o fluxo ja entregava as duas
> linhas certas, medido local, e a producao continuava cobrando R$ 120,00:
> `pizza` esta em `UMA_LINHA_SO` e a gravacao juntava de volta o que a leitura
> tinha acabado de separar. Detalhe completo no item 77 do
> `LEITURA-DA-CADEIA.md` e no item 4a do `O-QUE-FALTA.md`.
>
> Travado por `testes/a-pizza-de-outro-sabor-e-outra-linha.cjs`, oito casos, e
> **MEDIDO CONTRA O BANCO** no container `d1c2290`: as duas linhas certas e
> `*Total: R$ 240,00*`.
>
> Medir esta conversa abriu outros dois defeitos de dinheiro, os dois ja
> fechados e medidos no mesmo dia: cancelar UMA de duas linhas do mesmo nome
> (`f8df73f`) e `"tira a de calabresa"` nao ser entendido por ninguem
> (`d71f976`). Estao no `O-QUE-FALTA.md` e nos itens 77 a 79 do
> `LEITURA-DA-CADEIA.md`.
>
> O texto abaixo fica como estava, porque e o enunciado do defeito.

**Este e o defeito de dinheiro que sobrou, e ele esta ao vivo.**

```
cliente >> boa tarde, voces fazem pizza de forma?
padaria >> Sim, a gente faz. Pizza inteira R$ 120,00, meia R$ 60,00.  [cardapio]
cliente >> quero 2 inteiras, uma de calabresa e uma de frango com catupiry
padaria >> Quer levar docinho ou bolo junto?
cliente >> dia 05/09 as 19h, nome Rodrigo Zanella, pix
padaria >> Fechando: 1 pizza inteira (calabresa | frango com catupiry) = R$ 120,00

no banco: 1 ~ pizza inteira ~ calabresa | frango com catupiry ~ R$ 120,00
```

Ele pediu **duas** e a padaria cobra **uma**. R$ 120,00 no lugar de
R$ 240,00, e a cozinha recebe UMA pizza com dois sabores escritos no recado,
sem saber o que montar.

### O que ja se sabe, medido, pra nao refazer

1. ~~**O codigo grava certo.** Alimentando a leitura com `qtd: 2` ele monta
   duas linhas. O problema esta na LEITURA do modelo, nao no fluxo.~~

   **ISTO ESTAVA ERRADO, e custou a tentativa revertida.** Medido em
   30/08/2026, alimentando o `responder` com cada forma possivel de resposta
   do modelo:

   ```
   modelo devolve qtd 2         ->  2 ~ pizza inteira ~ frango  (perdeu a calabresa)
   modelo devolve DUAS linhas   ->  1 ~ pizza inteira ~ calabresa | frango
   ```

   **Nenhuma forma conseguia produzir duas pizzas.** A juncao de itens casa
   pelo NOME do produto (`fluxo.ts`, `itens.findIndex`), e o laco acumula no
   mesmo array: dois itens ditos na mesma respiracao caiam um em cima do
   outro. Por isso mexer so na instrucao nunca movia o dinheiro, e por isso a
   tentativa de `cabcdac` pareceu nao ter efeito nenhum alem de estragar a
   comanda.

   O conserto e no `fluxo.ts`: a juncao passa a valer contra o que ja estava
   anotado ANTES desta leitura, e dentro do mesmo turno so junta quando o
   SABOR tambem e o mesmo (senao a festa quebra: ao repartir a base, o mesmo
   produto volta duas vezes e aquilo e duplicata de verdade).

   **Separar por sabor seria pior:** a pizza inteira aceita ate quatro
   sabores, entao "uma de calabresa e uma de frango" tambem pode ser UMA
   pizza. Quem desempata e o modelo: dois itens sao dois.

2. **A etapa e a ABERTURA**, e nao a do produto. Ele pergunta o preco na
   primeira mensagem e nada e anotado (isso esta certo: perguntar nao e
   pedir). Entao, quando ele finalmente pede, o pedido ainda esta vazio.

3. **Pedir "uma linha por sabor" na instrucao da abertura NAO funciona, e
   piora.** Foi tentado em `cabcdac` e revertido em `8654e30`:

   ```
   antes  >> pizza inteira ~ calabresa | frango com catupiry
   depois >> pizza inteira ~ calabresa | inteira | frango com catupiry
   ```

   O modelo passou a tratar "inteiras" como se fosse sabor, e a comanda ia
   dizer pra cozinha montar uma pizza sabor "inteira". A quantidade continuou
   1. **A frase da regra precisa separar TIPO de SABOR**, e nao so falar de
   sabor.

4. O teto da instrucao e **1400 caracteres por etapa**, cobrado por
   `testes/o-docinho-so-e-docinho-na-etapa-dele.cjs`. Ja reprovou
   `pecas_do_bolo` com 1437 quando a regra foi pro bloco comum. O teste esta
   certo: papel de arroz e topo nao tem sabor nenhum.

### Como medir (a ordem importa, e ignorar custou caro)

```
node testes/todos.cjs                                   # portao local, 111
npm run build                                           # o que derruba deploy
git push                                                # dispara o Coolify
# ESPERAR o container mostrar o SHA novo, e so entao:
node testes/mede-uma-conversa.cjs testes/falas-pizza-rodrigo.json
```

O arquivo de falas ja esta no repositorio. **Nunca medir com deploy no
meio**, e **nunca rodar isto junto com o `medidor.cjs`**: os dois usam a
faixa `55119777700%` e o medidor apaga a conversa no meio da medicao.

---

## O QUE VEM DEPOIS, DA LISTA DO DONO

Nao medi nenhum destes hoje.

1. **A IA chama a equipe a toa.** Tres commits do Cursor entraram na main
   (`678ec81`, `088732f`, `4161fb9`) e nao foram medidos ao vivo. O inbox
   "QA Automatizado / nao entendi / Precisa de voce" e o proprio
   `/api/testar-ia` entregando conversa, nao cliente real.

2. **Relogio 3h contra 15h na lista do painel.** America/Sao_Paulo. Pode ser
   resto de QA da tarde ou fuso mesmo. Nao investiguei.

3. **Dezoito ramos `cursor/*` ainda abertos**, alguns com trabalho que a main
   nao tem. `git log --oneline origin/main..origin/cursor/<ramo>` em cada um.
   Ja houve fast-forward que dropou commit neste repositorio, entao nao
   confie em "ja mergeou".

4. **Regras 25, 26 e 27** da demolicao do cerebro velho: o `O-QUE-FALTA.md`
   diz que fecharam, e a bateria de 28/08 falhou. So medindo pra saber qual
   dos dois esta velho.

---

## COMO EU DEVIA TER TRABALHADO, E O QUE ME CUSTOU HOJE

Errei tres vezes nesta sessao, e as tres do mesmo jeito: **escrevi o conserto
antes de medir**.

- Na primeira, o conserto do plural nao rodava, porque o item ja tinha sido
  descartado antes. Revertido, sem deixar codigo morto.
- Na segunda, dar dona as 24 orfas fez elas serem BARRADAS fora da etapa
  delas, quando antes passavam. A etapa nova tem que ACRESCENTAR um lugar
  onde a resposta cabe, e nao TIRAR o direito de ser citado fora da hora.
- Na terceira, a regra na abertura piorou a comanda e foi revertida.

As tres foram pegas pela MEDICAO, nunca pelo portao verde. O `CLAUDE.md`
deste projeto ja avisa: bateria verde prova os caminhos dela e nada alem, e
build e deploy nao provam efeito.
