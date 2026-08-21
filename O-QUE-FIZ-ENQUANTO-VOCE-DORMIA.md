# O que consertei na noite de 20 para 21/08/2026

Método: rodei clientes de verdade contra o servidor, li cada conversa como se
fosse o cliente, e cada defeito foi consertado na REGRA, não no caso.
Depois de cada correção o ciclo recomeça: rodar, ler, corrigir.

Nenhum destes defeitos aparecia na medição (`node testes/medidor.cjs`), porque
a medição olha o BANCO e quase todos eles acontecem antes de existir pedido.
Só apareceram lendo conversa.

## Os defeitos, com a frase real do cliente

1. **"escolhe voce os tipos, to sem tempo"** e ela perguntou o sabor da esfirra
   TRÊS vezes, palavra por palavra. Coffee break de 200 salgados morrendo em
   loop. Agora o código escolhe o sabor na hora de anotar, para os 13 produtos
   com lista de sabores.

2. **"pode ser assim, escolhe os tipos"** não contava como delegação, porque a
   guarda exigia "escolhe VOCÊ". Ela mandava o cardápio de volta.

3. **A conta fechava em 300 salgados e a fala dizia 180.** O código sugeria
   cinco tipos de 60 e ela anotava três. Agora quem anota o sortido é o código.

4. **"quanto custa a torta doce?" recebeu preço; "e a salgada?" não.** Pergunta
   curta que continua a anterior agora é reconhecida, e o preço vai junto na
   instrução, porque quando mandei ela buscar o número ela chutou R$ 44,90 numa
   torta de R$ 36,90.

5. **"e a especial?" depois de "e a salgada?"** também ficava sem preço: duas
   elipses seguidas. Agora o núcleo vem da última pergunta com verbo de preço.

6. **"dia 27/09 às 16h" na primeira mensagem, "me diz que horas" na sexta.** A
   pergunta agora sai do texto. Mesma coisa com o nome: o pedido fechava e
   terminava com "só me diz: o pedido fica no nome de quem?".

7. **"sem topo e sem papel de arroz, nome Marcia, pix"** fechou com
   `bolo morango (... nome Marcia)`. Cozinha que lê "nome Marcia" num bolo
   escreve Marcia no bolo. O nome saiu da observação; quando o bolo TEM topo ou
   papel ele fica, porque aí é o nome do aniversariante.

8. **"2 calabresa e 1 de frango"** virou UMA pizza de R$ 120,00. Ele pediu três.
   Número antes do sabor é quantidade, não sabor a mais.

9. **31 sabores de pizza despejados numa mensagem de WhatsApp.** A guarda que
   troca lista por imagem do cardápio só cobria salgado e docinho; agora cobre
   pizza, bolo de festa, bolo caseiro, torta, empadão e cuca.

10. **"quero 2 kg da especial pra sexta as 18h, nome Ana, pix"** recebeu
    "deixa eu chamar alguém da equipe". Faltava só o sabor, e a pergunta estava
    escrita na recusa que ninguém leu em voz alta. Agora, quando as voltas
    acabam com uma pendência conhecida, ela pergunta em vez de desistir.

11. **"pode ser rosa e dourado"** fechou com forminha rosa nos quatro docinhos.

12. **"cor da forminha nao especificada"** ia impressa na comanda e no texto do
    cliente.

13. **"escolhe voce o sabor"** do bolo da mãe de 60 anos recebeu **"Não posso
    escolher o sabor do bolo por você"**, e o bolo nunca entrou no pedido. A
    guarda de produto fantasma recusava justamente o bolo que ela escolheu.
    Eram três guardas de delegação lendo só a última frase do cliente: quem
    delegou na terceira mensagem não repete na quinta. Hoje as dez leem a
    conversa inteira, e o teste conta isso.

14. **"calabresa e frango com catupiry não estão no nosso cardápio de pizza."**
    Os dois estão, conferidos sabor a sabor com o PDF da dona. Agora a
    instrução diz quais existem, e o log grita quando ela nega um que existe.

15. **"as 20h" virava "20 de hot dog"** na leitura de quantidade, porque "h" é
    prefixo de "hot dog".

16. **"Pode ser assim?" sozinho**, sem dizer o quê. O código montava e anotava
    o sortido inteiro e a mensagem que chegava no cliente era essa. Quando o
    texto é curto e não cita nenhum item anotado, o código escreve a lista.

17. **"do torta especial"** virou "da torta especial": a concordância segue o
    substantivo, que é a primeira palavra do nome.

## O que fica travado por teste

`testes/nao-pergunte-o-que-ele-ja-respondeu.cjs` cobra as regras, não os casos:
conta os produtos com sabor, exige que a delegação seja reconhecida em todas as
formas, que o corte de texto nunca deixe frase quebrada, e que "2 calabresa e
1 de frango" some três.

Portão inteiro: `node testes/todos.cjs`.

## O que ainda não está feito

- `ADMIN_WHATSAPP` e `DONA_WHATSAPP` no Coolify (é sua tarefa: cada número
  precisa ter mandado um "oi" pro WhatsApp da padaria antes, pela janela de 24h
  da Meta). Sem isso a IA funciona igual, só não avisa ninguém quando quebra.
- Rodar `node testes/medidor.cjs` de novo depois desta noite, pra ver a nota
  com tudo isto no ar.
