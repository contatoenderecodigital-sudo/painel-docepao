# Onde paramos, 19/08/2026 fim do dia

Documento de retomada. Leia isto antes de mexer em qualquer coisa.

## O contexto que muda tudo

Hoje a gente testou de verdade pela primeira vez: **seis clientes simulados ao
vivo em paralelo**, cada um um agente com persona propria, lendo a resposta real
da Dora e reagindo. Nao texto pronto mandado por cima dela, que era o que eu
fazia antes e nao testa nada.

Apareceram oito defeitos. Depois disso, tres pesquisas em fontes primarias
(papers, blogs de engenharia, post-mortems publicos) apontaram todas para o
mesmo diagnostico, e uma delas leu o nosso codigo.

**O diagnostico: prompt e sugestao, nao restricao.** Decisao que custa dinheiro
tem que morar no codigo. O material completo, com links, esta em
`C:\CEREBRO OBSD\Cerebro\02 - Claude Code & Build\Agente de IA no WhatsApp - o que eu aprendi construindo.md`

Numeros que calibram a expectativa:

- tau-bench: agentes estado da arte resolvem **menos de 50%** das tarefas de
  atendimento, e acertam 8 de 8 execucoes do mesmo caso em **menos de 25%**
- McDonald's encerrou a IA do drive-thru depois de 100 lojas
- Estrutura vale mais que trocar de modelo: uma maquina de estados levou o
  Llama 405B de 47,8% para 81,9%, empatando com o GPT-4o

## O que foi consertado hoje e esta no ar

Por ordem de commit:

| Commit | O que |
|---|---|
| `39fd2dc` | Cliente recusar o valor devolve o pedido pra fila em vez de sumir num limbo |
| `1b33976` | Bobina acabada segura a fila em vez de queimar as 5 tentativas em 20 segundos |
| `9b27ecf` | Dois destinos de aviso: ADMIN_WHATSAPP (tecnico) e DONA_WHATSAPP (padaria) |
| `8659b84` | Cor de forminha e foto pararam de segurar o registro do pedido |
| `2819fe8` | Ela para de falar preco e endereco que nao existem |
| `244a391` | Pergunta de preco para de virar item, e sabor volta a ser escolha do cliente |
| `685c07d` | Produto vira enum: ela nao CONSEGUE mais pedir o que a padaria nao faz |

## Os oito testes

Rodam em segundos. Todo defeito real virou teste com a frase que o quebrou.

```
node testes/bate-com-os-pdfs.cjs        catalogo bate com os 5 PDFs oficiais
node testes/nada-pode-divergir.cjs      IA, comanda e sistema falam a mesma lingua
node testes/todo-produto-funciona.cjs   86 produtos de ponta a ponta
node testes/comandas-da-dona.cjs        45 regras de comanda tiradas dos audios
node testes/dia-da-semana.cjs           "sabado que vem" vira data certa
node testes/nao-inventa-preco.cjs       preco e endereco fora da tabela nao saem
node testes/pergunta-nao-e-pedido.cjs   portao de escrita
node testes/so-existe-o-que-tem.cjs     enum da IA bate com o motor de preco
```

## O que FALTA, em ordem

1. **Cor da forminha perguntada 4 vezes.** A pesquisa achou a causa mecanica:
   ela mora dentro de `obs`, que e texto livre, entao o codigo nao tem como
   saber que ja foi respondida. Conserto: promover a slot discreto. Mesma coisa
   vale pra recheio, sabor, pao de lo, nome e idade do aniversariante.
2. **Duplicata quando o cliente troca o sabor.** Fica o velho e o novo. Tem nome
   na literatura, chama *state momentum*. Conserto: `corrigir_item` separado de
   `anotar_item`, cada linha com id estavel, troca atomica.
3. **Resumo e total renderizados por codigo** a partir do banco. Hoje ela narra
   de memoria e ja recitou pedido que nao existia no registro.
4. **Idempotencia por `op_id`** derivado do message_id do WhatsApp.
5. **Medidor pass^5**: rodar cada conversa 5 vezes e exigir acerto nas 5,
   avaliando pelo ESTADO DO BANCO, nao pela transcricao. Sem isso nao da pra
   saber se um conserto funcionou ou teve sorte.

## Pendencias que nao sao codigo

- **Teste de impressao com papel.** A bobina acabou no meio do pedido da
  Fernanda. Pedido `Fernanda Klein, R$ 493,00, retirada 06/09 as 15:00` esta
  aprovado e impresso no banco: e so por papel e clicar em Reimprimir. Ele
  exercita 4 comandas, resumo por faixa, referencia cruzada e o ticket do caixa.
- **Segunda chave da OpenAI, de OUTRA organizacao.** O teto atual e de 26
  mensagens por minuto (TPM 200.000 dividido por ~7.800 tokens por mensagem), e
  seis conversas simultaneas estouraram. O rodizio ja esta pronto no codigo:
  basta preencher `OPENAI_API_KEY_2` no Coolify.
- **`ADMIN_WHATSAPP` e `DONA_WHATSAPP`** no Coolify. Os dois numeros precisam ter
  mandado um "oi" pro numero da padaria antes, senao a Meta recusa o envio pela
  janela de 24h.
- **Tres perguntas pra dona** sobre a pizza redonda: quantas pessoas serve,
  quantos sabores aceita, se tem peso minimo.
- **A impressora nao avisa quando o papel acaba.** Testado: driver "Generic /
  Text Only" na USB001 nao responde ESC/POS de volta, nem com bidirecional
  ligado. Se ela tiver entrada de rede, ligar por cabo resolve de vez.

## Regras que nao podem ser esquecidas

- Nunca emoji, nunca travessao. Vale pra codigo, prompt e tela.
- O shell come a barra invertida. Patch em arquivo se escreve com a ferramenta
  Write, nao com heredoc. Ja custou horas quatro vezes so hoje.
- Deploy do hub e por webhook. Confira pelo SHA do container, nunca pelo status
  do Coolify.
- Push no GitHub exige a conta `contatoenderecodigital-sudo`.
- A IA nunca confirma pedido sozinha. A equipe sempre aprova.
- Nao dizer "falta pouco". Dizer o que esta feito e o que esta aberto, com nome.
