# Testes da entrega

A matriz que precisa passar antes de a padaria ir ao ar. Cada linha é uma
conversa INTEIRA contra a produção, lida mensagem por mensagem, com três
perguntas no fim:

1. **o pedido bate?** (item, quantidade, sabor, observação, total)
2. **a comanda serve pra cozinha?** (nada faltando, nada inventado, nada repetido)
3. **as imagens?** (mandou a peça certa, uma vez só, na hora certa)

Aberto em 02/09/2026, a pedido dele: *"é a fase final véio de entrega"*.

---

## O que cruza com o quê

Não é "testar a festa". É testar **como cada tipo de gente fala** vezes **o que
ela pede**. Os defeitos que travaram o pedido dele em 02/09 só apareceram no
cruzamento: cliente que AJUSTA a proposta, pedindo festa completa.

| # | perfil | o que pede | por que existe |
|---|---|---|---|
| 1 | decidido | só loja (pão, cuca) | tudo numa mensagem, sem festa |
| 2 | decidido | só pizza | a única família com meia e inteira |
| 3 | guiado | festa completa | aceita a proposta e escolhe item a item |
| 4 | que ajusta | festa completa | muda quantidade, tira família, volta atrás |
| 5 | que ajusta | festa + pizza | mistura família com etapa própria e sem |
| 6 | confuso | festa | responde outra coisa, repete, escreve errado |
| 7 | confuso | bolo | resposta curta, áudio, foto |
| 8 | difícil | festa | reclama, pede desconto, quer cancelar |
| 9 | difícil | qualquer | some no meio e volta com o pedido pela metade |
| 10 | decidido | tudo junto | festa + pizza + loja na mesma conversa |
| 11 | guiado | bolo com todas as peças | topo, papel de arroz, tema, prato |
| 12 | guiado | sem lactose | a restrição que a casa faz |

---

## O que conta como falha

Além do pedido errado, estas quatro, que ele levantou em 02/09:

- **frase repetida**: a mesma pergunta duas vezes seguidas
- **imagem duplicada**: a mesma peça de cardápio mandada de novo
- **imagem sem contexto**: peça que não tem a ver com a pergunta da vez
- **sumiço calado**: o cliente pediu, não entrou, e ninguém avisou

---

## Placar

Preenchido conforme roda. Sem "quase": ou passou inteira, ou está aberta.

| # | rodou | resultado |
|---|---|---|
| 1 | 02/09 | 2 defeitos, consertados (peso vazando entre produtos; "O cuca") |
| 2 | 02/09 | 2 defeitos de R$ 120, consertados (meia a meia; duas pizzas) |
| 3 | 02/09 | passou inteira: 300 salgados, 150 docinhos, 3 kg, R$ 628,20 |
| 4 | 02/09 | 3 defeitos de dinheiro, todos consertados |
| 5 | 02/09 | passou inteira: festa + pizza, R$ 538,80, conta batendo item a item |
| 6 | 02/09 | passou; sobrou uma pergunta pra dona (proposta x sortido, R$ 15) |
| 7 | falta | depende de um audio de verdade; o testador so escreve texto |
| 8 | 02/09 | 2 defeitos, consertados (reclamacao virava pedido; desconto ignorado) |
| 9 | 02/09 | passou inteira: sumiu e voltou, R$ 100,00 |
| 10 | 02/09 | 1 defeito, consertado (a reescrita trocava o assunto da pergunta) |
| 11 | 02/09 | passou inteira: bolo com topo, papel, tema e prato |
| 12 | 02/09 | 1 defeito, consertado ("quero um de 2 kg" nao virava pedido) |

---

## O cerebro, medido em 02/09/2026

Tres modelos rodados contra as MESMAS seis falas dele:

| modelo | acertos | custo por chamada | serve? |
|---|---|---|---|
| **gpt-4.1-mini** | **6 de 6** | R$ 0,0021 | e o que esta no ar |
| DeepSeek V4 Flash | 3 de 6 | R$ 0,0007 | le pior |
| DeepSeek V4 Pro | 2 de 6 | R$ 0,0021 | le pior, e devolve quantidade ZERO |
| gpt-5-mini | nao leu | R$ 0,0066 | raciocina antes: 475 tokens invisiveis e estoura o tempo |
| gpt-5.6-luna | 3 de 6 | R$ 0,0025 | mais novo, le menos |

A familia gpt-5 nao serve pra este uso: ela e feita pra pensar, e aqui o trabalho
e ler uma frase de padaria e devolver JSON em segundos.

E a REESCRITA esta desligada (`config.reescrita = nao`): era uma segunda chamada
de IA por mensagem, dobrava o custo, e trocava o assunto da pergunta.
