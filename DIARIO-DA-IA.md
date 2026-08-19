# Diário da Dora, a IA da Doce Pão

Este arquivo existe porque conversa some e código fica. Cada defeito aqui foi
achado lendo conversa de verdade ou olhando a tela, nunca por suposição, e cada
um custava dinheiro, pedido ou confiança da cozinha.

Quem for mexer nessa IA depois: leia a seção "Regras que não se quebram" antes
de cortar qualquer linha do prompt.

---

## 18 e 19 de agosto de 2026

Dia inteiro de leitura de conversa e correção. Foram 40 correções, todas com o
caso real no commit.

### O que custava dinheiro

| Defeito | O que acontecia | Correção |
|---|---|---|
| Pizza cobrada três vezes | "uma inteira de calabresa e frango com catupiry" virava 3 linhas de R$ 120. Fechamento de R$ 401,90 num pedido de R$ 161,90 | Pizza é uma linha, o sabor soma na observação |
| Pizza por R$ 0 | Gravada como "pizza inteira calabresa", nome que não existe na tabela | O nome é o tamanho, o sabor é observação |
| Torta com palmito pelo preço da comum | R$ 36,90 no lugar de R$ 39,90 o quilo | Nome completo do cardápio vale; entre parecidos, ganha o mais longo |
| Cuca cobrada por unidade | A dona já tinha dito em áudio que é por quilo | Catálogo corrigido e a IA explica o quilo quando pedem por peça |
| Cachorro-quente como unidade | 1 un no lugar de 1,5 kg | Unidade vem do cardápio, mesma fonte do preço |
| Item duplicado | "cuca recheada banana" e "cuca recheada" viravam duas linhas | Nome do produto é o do cardápio, o resto desce pra observação |
| Preço do cento sem resposta | "quanto custa o cento?" ficava sem número | R$ 100,00 frito e R$ 125,00 assado, do cardápio |
| Preço do bolo sem resposta | "quanto o quilo do bolo?" virava "vou confirmar" | De R$ 46,90 a R$ 55,90, das faixas |
| Mínimo de 100 salgados inventado | Festa de 5 pessoas cotava um cento inteiro | Não existe mínimo por encomenda, só 20 por sabor |

### O que fazia a cozinha produzir errado

| Defeito | O que acontecia | Correção |
|---|---|---|
| Pedido fechado sem sabor | "cuca recheada: 3 un" foi pra cozinha sem recheio | Produto com lista fechada não fecha sem sabor escolhido pelo cliente |
| Lista de opções virando escolha | A pergunta ("chocolate, doce de leite, abacaxi...") era gravada como se fosse o sabor | Observação que é a lista inteira é descartada |
| Sabor inventado | Ela escolhia o sabor pelo cliente | Sabor só entra se o cliente escreveu |
| Item sumindo | Recusar o sabor apagava o item; "metade de cada" perdia a esfirra | O item entra sem o sabor e trava o fechamento até escolherem |
| Produto inventado | Esfirra que ninguém pediu, e o croquete pedido sumia. 567 salgados no lugar de 300 | Produto que o cliente nunca citou não entra |
| Salgado na bancada do doce | Torta fria com palmito saía na comanda da confeitaria | Salgado é avaliado primeiro, por categoria e por nome |
| 3 kg virando 3 bolos | Item sem unidade imprimia "3x BOLO BRIGADEIRO" | A fila entrega a unidade do cardápio pra ponte |
| Recado interno no ticket | "nome do aniversariante e idade faltando" saía impresso | Observação entra limpa, sem repetição e sem recado interno |
| Empadão com a lista da empadinha | Ela oferecia palmito, carne e brócolis pro empadão | O prompt não tinha os sabores do empadão; agora tem |

### O que quebrava a conversa

| Defeito | O que acontecia | Correção |
|---|---|---|
| Recusa inventada | "ofereci duas vezes e ele não pediu, então não quer" apagava salgado e docinho do pedido enquanto o cliente pedia o cardápio | Família que o cliente citou nunca é marcada como recusada |
| Mensagem colando na outra | "dia 15/11" + "salgado" virava "11 salgados" e o teto do pedido virava onze | Mensagens juntadas com quebra de linha |
| Resumo destruído | O fechamento chegava como "Te mandei o cardápio de salgados.070,65*" | Resumo de fechamento nunca vira cardápio |
| Idade virando convidado | "aniversário da minha filha, 8 anos" virava festa pra 8 pessoas | Número com unidade colada não é convidado |
| Tema do topo virando sabor | "topo de unicórnio" virava "não fazemos bolo de unicórnio" | Tema é do topo, sabor é outra pergunta |
| Perguntar o que já foi respondido | O sabor dito na mesma frase de outro item se perdia | O código completa o sabor que está na fala do cliente |
| Pergunta ignorada | Preço, peso e "como se vende" ficavam sem resposta | A pergunta do cliente vem antes da etapa |
| Falar por cima | Três caminhos enviavam sem conferir se o cliente escreveu de novo | Espera de 12s mais segunda conferida depois de pensar |
| Dia da semana errado | "sábado 20/09" num domingo | Dia da semana é calculado da data |

### O que a tela mostrava errado

- Pedido de hoje aparecendo como amanhã depois das 21h (servidor em UTC, padaria em Brasília)
- Conversa dizendo "IA atendendo" com a IA parada esperando a equipe
- 4 pedidos na fila contados como 0 em Resultados
- Busca que dava match em tudo (`includes("")` sempre verdadeiro)
- Resumo do pedido sem unidade e sem sabor
- Bolo caseiro mostrando campos de bolo de festa
- Asteriscos crus do WhatsApp no painel

---

## Regras que não se quebram

Cortar qualquer uma destas traz de volta um defeito que já custou pedido:

1. **Unidade e preço saem do cardápio**, nunca da categoria nem do que a IA acha.
2. **Sabor de produto com lista fechada é obrigatório** e só entra se o cliente
   escreveu. Depois de três perguntas sem resposta, chama a equipe e o item
   continua no pedido.
3. **Produto que o cliente não citou não entra**, a menos que ele peça indicação.
4. **Total dito é pra dividir entre os tipos**, nunca repetir em cada um.
5. **Dia e hora da retirada** existem no sistema, no resumo do cliente e no
   ticket.
6. **Não existe prazo mínimo** pra salgado, docinho e torta: dependendo do dia
   sai pro mesmo dia, e a equipe confirma. Recusar data é venda perdida.
7. **Mudança ou cancelamento de pedido fechado chama gente.**
8. **Nada de dinheiro é estimado**: vem da tabela ou não vem.
9. **"Hoje" é o hoje da padaria**, fuso America/Sao_Paulo, nunca o do servidor.

---

## Como testar

Os roteiros ficam em `/root/` no servidor (cli-A.sh até cli-e.sh, manha.sh,
brutal.sh) e rodam contra produção pelo webhook de verdade.

- `node testes/qa-conversa.cjs` roda 159 checagens; cada uma nasceu de um erro
  que o dono encontrou. Referência atual: 157 a 158 de 159.
- `sh /root/manha.sh` simula oito clientes chegando escalonados, como das 7h às
  9h. Prova: nenhum "tive um probleminha", nenhum pedido com item de outro,
  quem só pergunta não vira pedido, quem pede pra hoje é atendido.
- `sh /root/brutal.sh` manda mensagem em rajada, com erro de digitação, e dois
  pedidos quase iguais ao mesmo tempo.

Ler conversa é obrigatório: número verde de bateria não prova nada sozinho. O
defeito do "11 salgados" só apareceu lendo a conversa inteira.

---

## Capacidade

Medido em produção, com 12 horas de teste:

- 16.208 tokens de entrada por turno (era 18.708 antes do corte do prompt)
- Teto da conta: 200.000 tokens por minuto, ou seja cerca de 12 turnos por
  minuto
- Custo: 1,5 centavo por turno
- Oito clientes ao mesmo tempo passaram sem uma falha

Para dobrar o teto, `OPENAI_API_KEY_2` precisa ser de **outra conta**: chave
nova na mesma conta não muda nada, porque o limite é da organização.

---

## Pendente

- `ADMIN_WHATSAPP` nas variáveis, pra o dono receber aviso quando a IA cair ou
  quando uma mensagem não chegar no cliente
- Levar a ponte atualizada pra máquina da padaria (o papel do caixa passou a
  mostrar a forma de pagamento)
- A dona usar a tela de aprovação com pedido real
