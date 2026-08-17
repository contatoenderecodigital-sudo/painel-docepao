# Casos reais: cada bug que apareceu no WhatsApp de verdade

Este arquivo é a memória dos erros. Cada linha aqui saiu de uma conversa real do
dono com a Dora, não de teste inventado. Serve pra três coisas: não repetir a
mesma correção, não "consertar" de um jeito que reabre outro, e ter roteiro
pronto quando alguém mexer na persona.

Quem tem verificação automática está marcado. O resto é teste manual até virar
checagem em `qa-conversa.cjs` ou `qa-painel.cjs`.

---

## Dinheiro e produção (os que doem)

**Bolo virando docinho.** Cliente pediu bolo de brigadeiro 2 kg; foi registrado
"brigadeiro: 1 un x R$ 1,25". A festa iria pra cozinha sem bolo, cobrando R$ 90
a menos. Aconteceu duas vezes, com prompts diferentes.
Correção: nome canônico no motor ("bolo de brigadeiro" vira "bolo brigadeiro"),
guarda que sinaliza quando a conversa fala de bolo e nenhuma linha é de bolo, e
campo `categoria` na ferramenta. Verificado em `qa-painel.cjs`.

**Sabor do bolo herdado do docinho.** Ela pulou a pergunta do sabor e registrou
"bolo brigadeiro" porque brigadeiro era o DOCINHO escolhido dois passos antes.
O cliente receberia um bolo que não pediu, sem nunca ter sido perguntado.
Correção: guarda que exige o sabor do bolo aparecer na fala do cliente.

**Pedido inteiro apagado.** O cliente respondeu "Ok" pra aceitar o orçamento e a
IA chamou registrar_pedido de novo sem item nenhum. Como é um pedido por
conversa, isso ATUALIZOU o real: onze linhas apagadas, total zerado, e o cliente
recebeu "Total: R$ 0,00" por cima de uma encomenda de R$ 752,70.
Correção: lista vazia não registra, nem no cérebro nem no banco.

**Papel de arroz não cobrado.** Ficava só na observação do bolo e os R$ 12
sumiam do total.
Correção: o motor lança como item quando a observação pede. Verificado.

**Recheio inventado.** Cliente pediu "empadinha e croissant"; foi registrado
"croissant de carne, empadinha de queijo". Ninguém falou carne nem queijo.
Correção: proibição explícita na persona, e guarda que manda pra confirmação
quando assado com opção de recheio vem sem observação.

**Assado fechando sem recheio.** Ela anotou esfirra e pastel assado e passou
pros docinhos sem perguntar o recheio de nenhum. Reincidência da regra acima.
Correção: virou guarda de código, não só texto.

**Detalhe do item perdido.** "Croquete de creme com catupiry" virou só
"croquete". O recheio pedido sumiu e a cozinha faria o padrão.
Correção: tudo que o cliente fala vai na observação daquele item, mesmo fora da
tabela, com precisa_confirmacao.

**Mini bolha classificada como sabor fixo.** O cardápio diz "nos sabores carne,
queijo, presunto ou frango" e a persona dizia pra não perguntar.
Correção: entrou na lista dos que pedem recheio.

**Data virando hoje.** A data de hoje está no prompt (pra completar o ano) e ela
usava como data de retirada quando não tinha certeza.
Correção: guarda que compara com a fala do cliente.

**Forma de pagamento inventada.** Escreveu "pix" numa conversa em que pagamento
nunca foi mencionado. Em outra, escreveu pix no texto e não preencheu o campo.
Correção: o valor é LIDO da fala do cliente. Verificado.

**Pedido no nome do aniversariante.** O resumo saiu "Nome: Vinicius", a criança
de 10 anos, em vez de quem retira e paga.
Correção: guarda comparando o nome com as observações dos itens, sem acento.

**Total caindo sozinho.** Ela refez a sugestão com uma lista menor, sem o bolo, e
o total desceu de R$ 418,80 pra R$ 325,00 na frente do cliente.
Correção: regra de sempre remontar com todos os itens.

---

## Conversa (os que irritam)

**Cardápio prometido e não enviado.** "Te mandei o cardápio de docinhos aqui" sem
ter chamado a ferramenta, três vezes seguidas, virando loop de desculpa.
Correção: o código cumpre a promessa, enfileirando a peça citada. Verificado.

**Peça de cardápio invisível no painel.** A dona via "te mandei o cardápio" e
nenhum cardápio, sem saber o que o cliente recebeu.
Correção: a peça entra no histórico como imagem, gravada ANTES do envio.

**Duas e três perguntas na mesma mensagem.** Furou em 8 de 8 turnos mesmo com a
regra escrita e exemplo.
Correção: o código corta, mantendo a pergunta que carrega a informação.
Verificado.

**Mensagem duplicada.** Cliente manda a ideia em pedaços e cada pedaço gerava uma
resposta, as duas explicando a mesma coisa.
Correção: espera de 7s pra ver se ele ainda está escrevendo.

**Boa tarde às 9 da manhã.** O prompt tinha a data e não a hora.
Correção: hora de São Paulo no prompt, com a regra de cada período.

**Forminha antes do sabor.** Perguntou a cor da forminha antes de saber quais
docinhos, que é a cor de uma coisa que ainda não existe.

**Sugestão citando tipo não escolhido.** "300 salgados fritos e 150 brigadeiros"
antes de o cliente escolher, fazendo parecer decidido.

**Perguntar se pode mandar o cardápio.** Mandava a imagem e perguntava "quer que
eu mande?" na mesma mensagem.

**Narrar o interno.** "Anotei tem foto de referência na observação do bolo" e "o
bolo brigadeiro é faixa B". O cliente não sabe que existe campo de observação
nem faixa de preço. Correção: proibido, com limpeza no código. Verificado.

**Travessão.** Em três camadas: no prompt, nos recados e dentro da imagem do
cardápio. Verificado em toda resposta.

**Nome do cardápio que o cliente não usa.** Ele pediu "pastel frito" e ouviu que
não existe. Existe: é a mini bolha.
Correção: apelidos na persona, com ordem de oferecer o equivalente.

---

## Painel

**Dois botões iguais.** O dono digitou R$ 25 no topo, clicou no cinza ao lado do
verde, e o pedido foi liberado SEM o item.
Correção: uma ação principal com o valor no rótulo; sair sem cobrar virou link.

**Pedido indo pra aprovação sem o cliente aceitar.** A dona podia imprimir um
orçamento que o cliente nunca viu.
Correção: estado "esperando o cliente". Verificado.

**Foto de referência só como texto.** O card dizia "tem foto na conversa" sem
mostrar, justamente na tela onde se precifica o topo.
Correção: miniatura com ampliar e baixar.

**Visualizador abrindo gigante.** Só dava pra ver o cabeçalho do cardápio.

---

## Infraestrutura (os invisíveis)

**Regex com byte de backspace.** Editar código por heredoc do shell fez `\b`
virar 0x08. Compila, roda, e a regex nunca casa. Matou a leitura da forma de
pagamento e a guarda do bolo, em dias diferentes.
Como achar: `sed -n 'Np' arquivo | cat -A` e procurar `^H`.

**Falha de envio desconectando o cliente.** A verificação tratava o código 100 da
Meta como token morto e apagava a credencial. Uma instabilidade derrubava a
padaria inteira.
Correção: só 190, 102 e OAuthException desconectam.

**Atalho de roteamento pro número velho.** Número não mapeado que batesse com o
do env caía no tenant padrão, e a Meta recicla id de número de teste.
Correção: o atalho só vale enquanto o tenant não tem número próprio.

**Coolify perdendo o webhook.** O deploy não saiu e eu testei código que não
estava no ar. Conferir a imagem do container antes de duvidar do código.

---

## Pedido em montagem (17/08/2026)

Depois que a IA passou a anotar item por item em vez de remontar o pedido a
cada mensagem, os testes acharam estes. Todos rodaram no webhook de verdade,
com conversa inteira, e todos foram corrigidos.

**Ela não anotava nada.** A ordem de anotar estava só na persona, no começo do
prompt. Correção: o que está anotado (ou o aviso de que não tem nada) entra
como mensagem de sistema DEPOIS do histórico, que é a última coisa que ela lê.
Não pode ir dentro do system: é o prefixo que a OpenAI guarda em cache.

**Metade frango, metade calabresa virou uma linha só.** O segundo recheio
entrava por cima do primeiro e sumiam 150 salgados.
Correção: a observação faz parte da identidade da linha. Quando existe uma
linha só daquele produto, continua sendo correção dela.

**300 assados + 150 pastéis = 450 salgados.** Quem pede genérico e detalha
depois ficava com os dois.
Correção: item específico decrementa o genérico da mesma categoria.

**Bolo de dois sabores pelo preço do mais barato.** Brigadeiro com morango saía
a R$ 46,90 o quilo. A regra "vale o mais caro" está na peça do cardápio e o
motor não aplicava.
Correção: no motor, com o nome guardando os dois sabores.

**"1 kg de pão doce" virou um pão doce.** Ela converteu calada o que é vendido
inteiro. Correção: perguntar quantos, nunca converter.

**Sabor emprestado do produto vizinho.** Perguntaram o sabor do pão doce e ela
ofereceu a lista da cuca recheada. Correção: sabor que não está na lista DELE
ela não tem; confirma com a equipe.

**"Pode fechar" não registrava pedido nenhum.** Ela usava a ferramenta de
aceite de orçamento (que é pro cliente concordar com o valor que a EQUIPE
ajustou depois) e respondia "já passei pra equipe". A fila ficava vazia com o
cliente achando que tinha encomendado.
Correção: o aceite só vale quando existe pedido esperando esse cliente.

**"Já vou passar pra equipe, pode ser?"** com o pedido inteiro anotado e o
cliente já tendo mandado fechar. Correção: quando não falta item nem nome,
data, hora ou pagamento, a ordem de registrar aparece no fim do prompt.

**Empadinha entrando como "por unidade".** A categoria é o que a cozinha lê.
Correção: a ferramenta agora diz quais produtos são de cada família.

**Campo de quantidade esticando por cima da linha.** `w-full` na classe base
anulava a largura fixa de cada campo.

## Conversa de festa inteira, ponta a ponta (17/08/2026, noite)

Rodei a conversa como cliente de verdade: chegando pelo aniversário, pedindo os
cardápios, escolhendo em cima deles. O que quebrou:

**O pedido antigo vazava pro novo.** Cliente que já encomendou volta pra
encomendar de novo e recebia de volta os salgados, o bolo e a forminha da
encomenda anterior. Correção: o pedido fechado vira só o resumo no histórico. O
resumo também vai pro fim do prompt, senão ela responde "o que você fechou" com
o pedido que está sendo montado agora.

**Sabor em aberto passava batido.** Ela pulava pros docinhos com o pastel frito,
o risólis e o tipo dos assados sem definir. Correção: a pendência é calculada
cruzando o anotado com o cardápio, e a própria ferramenta de anotar avisa no
mesmo turno (a lista do fim do prompt chega uma mensagem atrasada, e foi assim
que ela perguntou a cor da forminha antes do sabor da trufa).

**200 fritos viraram 600.** Ela repetiu o total em cada tipo escolhido.
Correção: o lembrete soma por família e avisa que total falado é pra dividir.

**Topo de bolo sem preço fazia ela chamar a equipe** em vez de registrar, e a
festa ficava fora da fila. Valor desconhecido é caso de precisa_confirmacao.

**Bolo cobrado duas vezes.** Uma linha certa de 4 kg a R$ 49,90 e outra como
docinho brigadeiro de R$ 1,25, porque a lista que ela reescreve no fechamento
ainda podia acrescentar item. Correção: pedido anotado manda sozinho.

**Cliente sem saber que encomendou.** Ela registrou R$ 904 e respondeu só
"deixa eu chamar alguém da equipe".

**"pastel frito" na comanda.** Não diz que peça fazer: é a mini bolha.

**O morango sumia do nome do bolo** e o misto saía a R$ 46,90 o quilo em vez de
R$ 49,90.

Passou: cardápios enviados e escolhidos em cima deles, 200 fritos divididos em
67/67/66, recheios de todos os itens, trufa com sabor, papel de arroz cobrado,
topo sinalizado pra dona, e a correção da equipe pela tela (150 coxinhas no
lugar das 100 que o cliente pediu) valendo na hora de fechar.

## Alucinacoes que so aparecem na conversa longa (17/08/2026, madrugada)

Conversa inteira de festa, do "boa noite" ao pedido fechado, uma mensagem por
vez. O que apareceu, e que teste curto nao pega:

**Recheio inventado.** Cliente pediu 100 esfirras e 100 empadinhas sem falar
recheio nenhum, e ela anotou "esfirra de carne" e "empadinha de palmito".
Correcao: sabor que e opcao do cardapio tem que ter aparecido na fala do
cliente, senao a ferramenta recusa e manda perguntar.

**Bolo inventado.** Anotou um "bolo brigadeiro 4 kg" tirado da SUGESTAO de
tamanho da festa, com o cliente nem tendo visto o cardapio de bolos. No bolo o
sabor esta no nome, entao a guarda de recheio nao pegava.

**Segundo bolo do nada.** Um "bolo 4 leites" copiado do primeiro item da peca
do cardapio, do lado do bolo que o cliente escolheu. Correcao: segundo bolo so
depois de confirmar com o cliente (dois_bolos=true), porque festa grande
realmente pede dois as vezes.

**Nome de categoria como produto.** Mandou "salgado_frito" no lugar do nome do
produto: nao casa com a tabela de preco nem e absorvido pelo generico.

**Duas perguntas viraram uma so confusa.** "Me diz os recheios dos assados:
pastel assado, esfirra, croissant..." — pediu recheio listando tipo, e dai saiu
a invencao. A cobranca agora diz que falta o TIPO, traz a lista e avisa que o
recheio vem depois.

**Trufa sem sabor passando batido** porque a observacao tinha "forminha azul
royal" e o teste so olhava se estava vazia.

**Pergunta pendurada chegando sozinha.** "Se sim, quer que eu divida igual?" e
"Qual voce prefere?" sem a pergunta que vinha antes.

**Prometeu e nao fez, duas vezes.** Recebeu o pagamento e disse "ja passei pra
equipe" sem registrar; e no "pode fechar" respondeu "deixa eu chamar alguem da
equipe", so porque o topo de bolo nao tem preco. As duas viraram guarda de
codigo: a ferramenta de anotar dados manda registrar quando nao falta mais
nada, e a de chamar a equipe recusa com o pedido pronto.

Licao que se repetiu a noite toda: **aviso que chega um turno depois nao vale**.
A lista de pendencias e montada antes da resposta, entao tudo que precisa ser
cobrado na hora tem que sair no RESULTADO DA FERRAMENTA, nao no lembrete.

---

## Ainda aberto

- **Foto de referência do bolo** ainda não testada ponta a ponta: o simulador
  de webhook manda só texto, e a tela do Testar IA aceita imagem mas não grava o
  pedido em montagem.
- **Sino**: falta decidir se leva "marcar como lido" (hoje o contador é o estado
  real do trabalho, e sair da lista exige resolver).
- **Gemini como reserva**: o modelo foi corrigido (2.5-flash saiu do ar pra
  conta nova), mas a conta do AI Studio está sem crédito e devolve 429.
