# A noite de 21 para 22/08/2026 — de 5 de 8 para 9 de 9

Leia depois do `O-QUE-FIZ-ENQUANTO-VOCE-DORMIA.md`. Este continua de onde aquele
parou.

## O método mudou, e essa é a parte que importa

Os defeitos de 20/08 foram achados **lendo conversa**. Os desta noite foram
achados **comprando**: cinco agentes conversaram com a Dora como clientes de
verdade, um por família de produto, do "boa tarde" até o pedido fechado, e
conferiram o resultado no banco contra o `catalogo.json`.

Isso mudou a conta. Das 14 famílias da loja, o medidor cobria **quatro**. As
outras dez nunca tinham sido compradas por ninguém — e foi nelas que estavam os
defeitos mais caros.

**Nenhum dos DEZESSETE defeitos consertados aparecia nos 45 testes que existiam.**

## A NOTA, no fim: 9 de 9 em pass^5

45 conversas seguidas sem um erro, julgadas pelo estado do banco.

| | antes | depois |
|---|---|---|
| medidor | 5 de 8 | **9 de 9** |
| ...mas | ele **não exigia** que o pedido fechasse em 5 dos 8 cenários | exige em todos |
| testes | 43 | **50** |
| famílias da loja testadas | 4 de 14 | **14 de 14** |

A nota de 5 de 8 era inflada. Tornar o medidor honesto derrubou ela para 6, e é
dessa base real que ela subiu até 9. Foram quatro rodadas: 6, 6, 7, 9 — cada uma
apontando o defeito seguinte pelo rastro, nenhuma por adivinhação.

Para calibrar o que 9 de 9 significa: o medidor é construído em cima do
`tau-bench`, e o comentário do próprio arquivo lembra que agentes de ponta
acertam uma vez em ~60% dos casos, mas **oito seguidas em menos de 25%**.

## Os doze, com o estrago medido

### Dinheiro

1. **50 brigadeiros gravados como 50 pizzas inteiras — R$ 62,50 viraram
   R$ 6.000,00.** "brigadeiro" é docinho, é sabor de bolo recheado E é sabor de
   pizza doce. A lista de sabores de pizza era consultada chapada, e bastava a
   palavra "pizza" ter aparecido UMA vez em qualquer ponto da conversa para toda
   dupla `numero + palavra` da mensagem virar pizza. Agora o sabor ambíguo segue
   a **cláusula**, não a conversa, e a lista de ambíguos se refaz sozinha do
   catálogo.

2. **A pizza de calabresa sumia da mesma mensagem.** A janela de três palavras
   engolia "pizza inteira de" e nunca chegava no sabor. O cliente só descobriu
   porque perguntou "e a pizza que eu pedi, entrou?".

3. **"não quero topo NEM papel de arroz" cobrava o papel de arroz.** Duas causas
   somadas: "nem" não era negação, e o "quero" de "não quero" satisfazia o portão
   do aceite. Quebrava nos dois sentidos da frase. R$ 12,00 que o cliente tinha
   acabado de recusar.

4. **Cupcake grande recheado (R$ 7,00) cotado como cupcake grande (R$ 5,00).**
   O motor jogava " recheado" fora ANTES de buscar — uma normalização feita para
   o bolo, aplicada a todo produto. 30 unidades saíram por R$ 150,00 em vez de
   R$ 210,00, e a cozinha recebeu ordem de fazer sem recheio. A "cuca recheada"
   só escapou por acaso: o regex era "recheado", no masculino.

5. **Bolo de banana caramelizada cotado como bolo de LARANJA caramelizada.**
   O motor aceitava candidato que compartilha só a ÚLTIMA palavra e depois
   escolhia o nome mais COMPRIDO. Agora ganha quem casa mais palavra.

6. **Pedido gravado em 22/08 com o cliente dizendo 06/09.** Ela confirmou 06/09
   no texto e gravou a data de hoje. A guarda que existia só conferia quando o
   cliente dizia DIA DA SEMANA; data escrita em número — que é como quase todo
   mundo escreve — não tinha conferência nenhuma.

### Venda perdida

7. **Bolo salgado recusado cinco vezes seguidas**, com o pedido terminando VAZIO
   e ela ainda perguntando a forma de pagamento. O produto existe, R$ 29,90/kg.
   A guarda de sabor de bolo de festa estava **certa no fato** e **catastrófica
   na mensagem**: ensinava a IA a dizer que a padaria não faz. Agora ela
   distingue categoria errada de produto inexistente, e isso vale para qualquer
   produto que chegue na categoria errada.

8. **Bolo caseiro travava 100%.** O cliente pediu dois bolos "simples de café da
   tarde" para receber visita, e ouviu cinco vezes "qual o nome do aniversariante,
   a idade e o tema da festa?". A pendência de decoração pegava QUALQUER
   categoria começando com "bolo". Só bolo de festa tem topo.

9. **"quanto custa o quilo?" respondido sem número.** A guarda que injeta o preço
   filtrava o catálogo por "o nome do produto aparece NESTA fala", e ninguém
   repete o nome do que acabou de dizer. Essa é a forma MAIS COMUM da pergunta de
   preço, e era justamente a que ficava sem resposta. Ela sabia o preço: usou o
   valor certo no fechamento.

10. **Franciscano, empadinha e bolo salgado recebendo a imagem errada.**
    NÃO EXISTIA MAPA PRODUTO→PEÇA. Não estava errado: não existia. A peça era
    escolhida pelo modelo, no enum da ferramenta, e nenhuma linha conferia se ela
    tem o produto perguntado. No lugar do mapa havia QUATRO tabelas de família,
    divergentes entre si.

### Raiva

11. **A pergunta do topo repetida três vezes palavra por palavra**, a terceira
    respondendo a um cliente que tinha perguntado "quanto fica tudo?". A instrução
    dizia literalmente "senão eu pergunto de novo".

12. **"Anotei" abrindo 3 de 5 respostas.** Ensinado por ~19 injeções mandando
    "confirme numa frase curta" e pela própria persona, que dava "Anotei,
    cartão." como exemplo. A persona não tinha UM exemplo de resposta boa inteira
    para copiar; agora tem seis.

## O padrão que se repete nos doze

**O código sabia a resposta certa e não usava.** O preço estava na mão dele. A
família do salgado estava na mão dele. O nome completo do cupcake estava na mão
dele. Em todos, uma normalização ou um filtro jogava fora a informação certa
ANTES de decidir.

Não é falta de regra. É regra atropelando dado.

## Por que o portão não pegava nada disso

`todo-produto-funciona.cjs` conferia se o preço era **maior que zero**. R$ 5,00 é
maior que zero, então o cupcake errado passava. Agora ele confere **identidade e
preço** dos 84 produtos — e foi assim que o banana/laranja apareceu sozinho, sem
ninguém procurar.

Outros dois buracos, os dois fechados:

- **Nenhum teste mandava duas famílias na mesma mensagem.** Todos os casos de
  pizza eram mensagens só de pizza. O cliente real escreve tudo de uma vez.
- **A palavra "nem" nunca tinha sido testada em lugar nenhum do repositório.**
  Só "sem X e sem Y". Em português, "nem" é a forma mais natural.

## O que NÃO pode ser mexido

Os seis fluxos da equipe foram verificados um a um na produção, com prova no
banco e print da tela. **Todos funcionam.** O coração deles é
`lib/banco/pedidos.ts:127-166` (`limparPendencia`, `registrarAceiteCliente`,
`devolverPedidoParaEquipe`) mais os campos `precisa_confirmacao` e
`aguardando_cliente`.

Duas frases são escritas por CÓDIGO e fazem parte do fluxo — reescrevê-las como
prompt é a regressão mais fácil de cometer:

- `lib/ia/cerebro.ts:822` ("Boa! Ja passei pro pessoal da padaria.")
- `app/(painel)/acoes.ts:185-187` (o aviso do valor do topo)

E `lib/whatsapp/transcrever.ts:36-39`: o `language: "pt"` na chamada do Whisper é
o que dá a pontuação boa na transcrição de áudio. Tirar degrada.

## O que ficou aberto

- **`guardar-conversas.cjs` saiu do portão.** Ele gravou 0 byte por cima de 37 KB
  de conversa real, e o arquivo é ignorado pelo git: não havia de onde recuperar.
  Agora ele se recusa a gravar vazio, e só roda na mão.
- **"pode fechar" nem sempre fecha**: o upsell atropela a intenção de compra em
  duas das cinco famílias medidas. `mandouFechar` reconhece a frase; o que
  atropela é o modelo repetindo instruções de turnos anteriores.
- **As outras ~18 guardas de tesoura** continuam reescrevendo a fala dela. Estão
  contidas pelo portão `corteEhSeguro` (não conseguem mais mandar frase
  quebrada), mas o caminho certo é convertê-las para o padrão "refazer" de
  `cerebro.ts:5775`: −810 linhas, repostas por ~105, sem perder detecção.
- **O modelo continua `gpt-4o-mini`.** Custo medido: R$ 0,13 numa conversa de 17
  mensagens. O degrau seguinte, `gpt-4.1-mini`, já tem preço em
  `lib/ia/precos.ts` e custaria ~2,7x. É config no banco
  (`negocios.config.modelo`), não código. Trocar DENTRO da OpenAI mantém o
  `strict: true` das ferramentas, que é a defesa contra produto inventado —
  claude e gemini entram por camada compatível e costumam ignorar `strict`.

## Como conferir tudo isso

```
npx tsc --noEmit                 # limpo
node testes/todos.cjs            # SOZINHO — 48 testes
node testes/medidor.cjs          # SOZINHO — a nota
```

**Rode sozinho de verdade.** Nesta noite eu apaguei linhas do banco enquanto o
portão rodava e `pausa-nao-vaza` deu falha falsa: ele precisa dos clientes de
teste que eu tinha acabado de remover.

E o passo que nenhum teste substitui: **ler três conversas novas como cliente.**
Pedido certo no banco não prova que alguém compraria.
