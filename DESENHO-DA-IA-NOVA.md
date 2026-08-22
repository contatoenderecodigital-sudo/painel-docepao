# O desenho da IA nova

Rascunho para você revisar. Nada disso virou código ainda.

## Por que refazer

Números do que existe hoje:

| parte | linhas | deu problema? |
|---|---|---|
| `cerebro.ts` | 7.315 | **é aqui** |
| `guardas.ts` | 1.956 | **é aqui** |
| catálogo e preços | 625 | não |
| motor de preço | 410 | não |
| WhatsApp (áudio, imagem, envio) | 533 | não |
| webhook | 988 | não |
| cupom da impressora | 264 | não |
| painel | 14 telas | não |

**9.271 linhas decidindo** contra 625 de cardápio. Todos os defeitos das últimas
duas semanas nasceram naquelas 9.271.

E o padrão dos defeitos é sempre o mesmo. Três exemplos reais:

- A guarda de bolo misto recusou o bolo da kemilly porque "brigadeiro" também é
  sabor de bolo. O cliente pediu bolo **e** 100 brigadeiros; ela entendeu bolo de
  brigadeiro e não anotou nada.
- Uma instrução mandava pedir nome e pagamento; outra guarda apagava a pergunta
  depois de escrita. Sobrou "Pode ser assim?" sobre uma data.
- Ela perguntou "quer escolher os tipos de **salgados**?", você disse "Sim", e
  o código mandou o cardápio de **docinhos**, porque uma guarda faz a imagem
  seguir o texto que a IA escreveu em vez do que foi combinado.

Não é a IA sendo burra. É **camada minha decidindo por cima de camada minha**.

## O princípio

As duas referências que você trouxe dizem a mesma coisa:

> Bons agentes de produção são quase só software, com pontos de decisão de IA
> nos lugares certos — não um laço contínuo dirigido pelo modelo.
> — 12-factor agents

O que muda na prática:

**Hoje:** a IA decide tudo e 40 guardas correm atrás corrigindo.
**Novo:** o código sabe em que passo está. A IA só entende o que o cliente
escreveu, dentro daquele passo.

A diferença que isso faz: no passo "escolher salgado", um "Sim" **só pode
significar salgado**. Não existe o que adivinhar, nem guarda para brigar com
outra guarda.

## As etapas

O pedido tem etapas, e o código sabe em qual está. Cada uma tem uma pergunta,
os botões dela, e o que a IA pode fazer ali.

```
    ABERTURA
       |
   [é festa?] --não--> PEDIDO SIMPLES ("100 coxinhas pra sábado")
       |sim
    QUANTAS PESSOAS  ->  o motor calcula a base
       |
    BASE DA FESTA        botões: [Pode ser] [Quero ajustar]
       |aceita
    SALGADO   -> tipo (lista) -> sabor (botão) -> quantidade (texto)
       |
    DOCINHO   -> tipo (lista) -> forminha (botão)
       |
    BOLO      -> sabor (lista) -> peso (do cálculo) -> pão de ló (botão)
       |
    PEÇAS DO BOLO        botões: [Topo e papel] [Só topo] [Nenhum]
       |
    DADOS                nome, data, hora (texto) + pagamento (botão)
       |
    CONFIRMAÇÃO          botões: [Confirmar] [Mudar algo]
       |
    PEDIDO REGISTRADO -> painel -> aprovação -> impressora
```

Em qualquer etapa o cliente pode escrever livre ("na verdade quero 200"), e é
aí que a IA trabalha: ela lê a frase **sabendo em que etapa está** e devolve o
que mudou. Não decide o rumo da conversa — o rumo é do código.

## Quem faz o quê

| decisão | quem faz hoje | quem faz no novo |
|---|---|---|
| qual a próxima pergunta | a IA | **o código** (etapa atual) |
| qual cardápio mandar | a IA (e uma guarda corrige) | **o código** (etapa atual) |
| quanto custa | o motor | o motor (igual) |
| o que o cliente quis dizer | a IA + 40 guardas | **a IA**, dentro da etapa |
| quanto de cada item | a IA + guardas | o motor calcula, a IA lê ajuste |
| quando fechar | a IA + guarda que força | **o código** (etapas cumpridas) |

## Como os defeitos conhecidos morrem

Os que você viu com seus olhos:

| defeito | por que não acontece mais |
|---|---|
| "4 leites 1kg e 100 brigadeiros" virou bolo de brigadeiro | na etapa BOLO só entra sabor de bolo; docinho é outra etapa |
| "Sim" para salgado trouxe cardápio de docinho | a peça vem da etapa, não do texto |
| "Pode ser" na base não virou pedido | é botão com id, não frase para interpretar |
| topo sumia do pedido | é botão de três opções na etapa PEÇAS |
| pediu nome com pedido vazio | a etapa DADOS só vem depois dos itens |
| "dia 02" virou 02/08 | continua sendo a mesma correção de data, que já funciona |
| perguntou o que já foi respondido | a etapa cumprida não volta |

## O que se mantém, inteiro

Nada disso deu problema e nada disso se toca:

- **catálogo e preços** — conferidos com a dona, áudio por áudio
- **motor de preço** — `orcamento.ts`, testado
- **WhatsApp** — envio, imagem, áudio com transcrição, botões
- **webhook** — recebe tudo que chega
- **painel** — 14 telas, aprovação, edição, valor do topo
- **impressão** — cupom por setor, ponte, papel acabando
- **os 54 testes** — viram a especificação: o que já quebrou não pode voltar

## Como migrar sem quebrar

O novo nasce ao lado, não por cima:

1. O fluxo novo roda **desligado**, só gravando o que faria
2. Comparo com o que o atual fez, nas mesmas conversas
3. Quando o novo ganhar em conversas reais, ele assume
4. O antigo fica no git, e volta com um comando se precisar

## Decidido com o dono em 23/08/2026

**Confirmação por bloco.** Quem manda tudo de uma vez não repete nada: a IA lê
a mensagem inteira, mas confirma em partes (salgados, depois docinhos, depois
bolo, depois fechamento). São três ou quatro mensagens em vez de uma, e o
motivo é o histórico: os erros que mais custaram foram item trocado no meio de
um monte de coisa (o brigadeiro que virou recheio de bolo, os 200 docinhos que
sumiram). Confirmando por bloco, o erro aparece isolado e o cliente corrige só
aquele pedaço.

**Cardápio continua imagem.** A imagem mostra tudo de uma vez e já funciona.
Lista tocável cabe 10 linhas, e só salgado frito (9) e forminha caberiam;
docinho (12), bolo (15) e pizza (31) ficariam de fora. Botão continua sendo
usado nas perguntas de sim ou não.

## O que ainda falta decidir

Antes de escrever qualquer linha:

1. **Pedido simples tem caminho curto?** "Quero 100 coxinhas pra sábado às 9h"
   não é festa: não tem base pra calcular, não tem etapa de bolo, não tem peça.
   Minha recomendação: caminho próprio, curto, que só confirma o item e pede
   dia, hora, nome e pagamento. Passar isso pelas etapas da festa seria
   burocracia inútil.

2. **A dona vê a etapa no painel?** Dá pra mostrar "está escolhendo o docinho"
   na tela dela. Minha recomendação: mostrar discreto, ao lado do pedido em
   montagem, porque quando ela assume a conversa no meio, saber onde parou
   evita repetir pergunta.
