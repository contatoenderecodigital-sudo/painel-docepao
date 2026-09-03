# Plano: a IA da Doce Pão volta a pensar

Repo: `C:\Projetos Claude\painel-docepao` (branch `main`, push dispara o Coolify, container `uyyqf7...`).
Produção hoje: commit `3d3b900`, modelo `gpt-4.1-mini`, reescrita desligada, reserva vazia.

## Contexto

Um mês de conserto em círculo: 546 commits desde 19/08, 289 deles `fix:`. O dono
diz que a IA "é um chatbot sem escolha, então erra". Ele está certo, e agora está
medido, não deduzido.

**O modelo é cego.** `lib/ia/fluxo/pensar-openai.ts` manda ao modelo só a
instrução da etapa (com o vocabulário DAQUELA etapa) e a frase solta do cliente.
Não vai o histórico, não vai o pedido montado inteiro, e até ontem não ia nem a
pergunta que a padaria acabou de fazer. A instrução ainda manda o modelo calar
sobre o que não é da etapa ("devolva falouDeOutraEtapa EM VEZ DE ANOTAR"). A
resposta ao cliente é 100% texto de template (`pergunta.ts`); o modelo devolve
só um JSON do que mudou. Para tapar a cegueira, o código ganhou cerca de 80
guardas, 9 listas de palavras, limiares numéricos (20, 1) e regex lendo
`ultimaFala` na mão. Cada guarda nova quebrou outra coisa.

**Medição feita nesta sessão (03/09, 5 rodadas cada, gpt-4.1-mini, cena real
"Quantas pessoas vão na festa?" / "10"):**

| variante | resultado |
| --- | --- |
| cego + instrução de pessoas | 5x `pessoas: 10` |
| cego + instrução do bolo (o que estava no ar) | 5x `10x bolo` (R$ 469,00) |
| conversa + instrução de pessoas | 5x `pessoas: 10` |
| conversa + instrução do bolo (etapa ERRADA de propósito) | 5x `pessoas: 10` |

Com um único turno de contexto o modelo corrige até a etapa errada escolhida
pelo código. A cegueira era a causa. As guardas que só existem por causa dela
podem morrer, e o esparadrapo `acabouDePerguntar` também.

**Confirmado no banco de produção, hoje:** o rascunho (`pedido_montagem`) da
cliente Renata continua com 9 itens dez minutos depois de o pedido ter sido
registrado e impresso, e o "Ok, obrigada!" dela gerou um SEGUNDO pedido
(`bd63732e`, R$ 481,80) na fila. Nada limpa o rascunho depois de registrar.

## O que está errado, em quatro famílias

1. **Cegueira do modelo** (raiz): sem histórico, vocabulário filtrado por
   etapa, instrução que manda calar, código adivinhando o assunto.
2. **Guardas compensando a cegueira** (~29 das ~80): as filas B e C de
   `TIRAR-AS-GUARDAS.md` seção 5, mais as 9 listas de palavras.
3. **Defeitos de código que não dependem do modelo** e custam dinheiro
   (achados nesta varredura, com linha):
   - rascunho nunca é limpo depois de `fecharPedido` (`lib/ia/fluxo/fechar.ts:324`
     registra e devolve; `limparMontagem` só é chamado no "recomeçar") -> pedido
     duplicado, visto em produção
   - `foraDoHorario` faz `return` antes da trava final (`fluxo.ts:5040-5049`
     pula o bloco `5079-5171`: catálogo, 6 kg, quantidade inteira)
   - `ultimaFala` não é atualizada em três saídas (`fluxo.ts:2918-2941`,
     `3660-3684`, `3731-3753`): o modelo recebe uma pergunta que o cliente não viu
   - "pedido aguardando valor" engole a mensagem inteira (`atender.ts:203-294`):
     "beleza, mas muda pra sexta" vira aceite e a data some
   - `fecha_sim` não está em `DO_BOTAO` (`fluxo.ts:239-275`) e custa uma chamada
     de modelo no botão mais importante
   - `fecharPedido` devolvendo `null` é silencioso (`atender.ts:385`): o cliente
     recebe o mesmo resumo e ninguém diz o que falta
   - número errado / assunto fora da padaria recebe "O que você precisa?" três
     vezes (visto em produção 02/09 14:44, o caso "Ademir")
   - aviso do dia da dona nunca chega na IA (`negocios.ts:273-287` só a tela lê)
   - `IA_BASE_URL=https://api.deepseek.com` está no ambiente do container sem
     `IA_API_KEY`; só o valor "openai" no banco segura a produção
   - cumprimento volta no meio de conversa com mais de 40 mensagens
     (`conversas.ts:16`)
4. **Comportamentos abertos nos docs** que provavelmente caem sozinhos com o
   contexto, e serão remedidos e não consertados por guarda: nome pedido 3x,
   linha fantasma do bolo trocado, assado virando frito, mudança de total,
   delegação da escolha, item citado fora da etapa jogado fora.

## Decisão de desenho

**O modelo vê a conversa e o pedido inteiros e decide o que o cliente quis
dizer. O código escolhe a próxima pergunta, escreve todo número e guarda o
dinheiro.** Não é reescrever o fluxo (isso já foi feito duas vezes e custou 14
mil linhas): é trocar o que ENTRA no modelo e tirar o que BLOQUEIA a saída dele.
`aplicar`, `etapaDaVez`, `pergunta.ts`, `orcamento.ts`, `montagem.ts`, o
fechamento e o painel ficam.

As ~30 guardas de tipo A (`TIRAR-AS-GUARDAS.md` seção 4: nome fora do catálogo
sai, teto de 6 kg, qtd 0 nunca 1, restrição de saúde, a IA nunca fecha sozinha,
total do motor, etc.) **não saem**. Toda trava que fica tem pergunta junto.

## Fases, na ordem

Cada fase fecha com: `npx tsc --noEmit`, `node testes/todos.cjs`, uma conversa
contra o banco (`testes/uma-conversa-contra-o-banco.cjs` ou `falar.cjs`), commit
sozinho. Nunca dois consertos no mesmo commit. Nunca deploy enquanto ele testa.

### Fase 0: validar e commitar o que já está na máquina

- Rodar `tsc` e o portão sobre os três arquivos modificados (`pensar-openai.ts`,
  `fluxo.ts`, `etapas.ts`) e os dois testes novos.
- Commitar o conserto da raiz (a pergunta da padaria como turno `assistant`) e o
  teto de 6 kg no fim do fluxo. Manter `acabouDePerguntar` por enquanto; morre na
  Fase 1.
- Guardar o resultado da medição desta sessão em `TIRAR-AS-GUARDAS.md` seção 3.

### Fase 1: o modelo recebe a conversa e o pedido inteiros

Arquivos: `lib/banco/conversas.ts`, `lib/ia/fluxo/atender.ts`, `fluxo.ts`
(tipo `Pensar` e a chamada em `:3058`), `pensar-openai.ts`, `leitura.ts`.

1. **Histórico de verdade.** Nova função em `conversas.ts`
   (`ultimasMensagens(negocioId, clienteId, n)`) lendo `mensagens` (`papel`,
   `conteudo`, últimas ~12, só texto). `atender.ts` passa pra `responder`, que
   passa pro `pensar` como `historico`. Em `pensar-openai.ts` os turnos entram
   como `assistant`/`user` entre o `system` e a frase atual. A `perguntaDaPadaria`
   vira redundante e sai.
2. **O pedido anotado vai depois do histórico**, como mensagem de sistema curta
   (itens com quantidade e sabor, dados, pessoas, base), nunca no system prefixo
   (cache da OpenAI; regra já aprendida em 17/08).
3. **Uma instrução só, com o cardápio inteiro.** `instrucaoDaEtapa` deixa de
   filtrar vocabulário por etapa: vai a lista de `nomeCurto` de TODAS as
   categorias (com apelidos) e as regras de catálogo que hoje estão espalhadas
   nos blocos `daEtapa` (prefixo do bolo, peso em kg vai na quantidade, mini
   pizza é salgado, recheio no campo sabor, qtd não dita = 0). A etapa da vez
   entra como uma linha de contexto ("a padaria está perguntando X"), não como
   filtro. Tirar as três frases "em vez de anotar" (`leitura.ts:766-794`).
   Subir o teto de caracteres em `o-docinho-so-e-docinho-na-etapa-dele.cjs`
   (1400/2500 nasceu do limite de 200k tokens/min do cérebro velho; a chamada
   nova fica em ~2 mil tokens).
4. **Nada é descartado por etapa.** `leituraQueCabeNaEtapa` (`leitura.ts:1065-
   1328`) para de barrar item de outra família; `aplicar` já sabe a categoria de
   cada item. Some junto: `barrados`/`guardados`/`itensDeOutraEtapaNaFrase`
   (`fluxo.ts:3114-3261`, B-7), o portão do vocabulário (B-9), `dicaDaEtapa`
   (`fluxo.ts:349`, C-1), o limiar 20 (`leitura.ts:1266`, C-2), o limiar 1
   (`etapas.ts:669`, C-3), o `falouDeOutraEtapa` inventado (`leitura.ts:1316`,
   B-10) e `acabouDePerguntar` (B-1). Item que não existe no cardápio continua
   recusado pela trava final, com a pergunta junto.
5. **Teste da fiação**: estender `o-modelo-recebe-a-pergunta-da-padaria.cjs`
   para cobrar que o histórico e o pedido chegam nos `messages` (o portão inteiro
   é cego pro conteúdo do prompt; esse é o único que olha).
6. Rodar `mede-a-cegueira.cjs` de novo e uma conversa de festa completa contra o
   banco antes de seguir.

### Fase 2: as guardas que compensavam a cegueira, uma por commit

Ordem de `TIRAR-AS-GUARDAS.md` seção 5, cada uma removida, portão, uma conversa,
commit:

- Fila 1 (regex sobre `ultimaFala`): B-2 aparato do peso (`fluxo.ts:913,943,
  2126,2501`), B-3 (`:3539`), B-4 `aPerguntaEraDele` (`:1963`), B-5
  `citadaNaPergunta` (`:2605`), B-6 foto por `/comprovante/` (`:4013`, troca o
  gatilho pelo campo `situacao`/`fotoEhComprovante` do modelo).
- Fila 3: B-11 `escolheuUmaOpcao` anula `delegaEscolha` (`:2352`), B-12 override
  de `pecas` (`:1049`), B-13 (`:3278`), B-14 `soMencionouProduto` descarta
  `situacao` em silêncio (`:3703`), B-15 `semInvencao` (`:1479`, menos
  `1579-1586` que é A), B-16 (`:1647`).
- Fila 4: o bloco de distribuição de sabor (`fluxo.ts:2406-2759`), em fatias,
  medindo pelo rastro. Com histórico o modelo sabe de qual item era a pergunta;
  o campo `sabor` por item já existe na `Leitura`.
- As 9 listas de palavras (`fluxo.ts:3610, 2909, 3016, 3024, 3822, 1916, 4156,
  1727, 4196`): cada intenção que elas adivinham vira campo da `Leitura`
  (`situacao`, `tirar`, `naoQuer`, `pecas`) que já existe.

Critério pra cada remoção: se o teste dela ficar vermelho, o caso vira teste com
`historico` no lugar da guarda, não guarda de volta.

### Fase 3: os defeitos de código que custam dinheiro (independem do modelo)

- `fecharPedido` limpa o rascunho depois de `registrarPedido` (e grava o
  `pedidoAprovado`/`registrado` que o caminho de "obrigado" já espera). Teste com
  isca: segunda mensagem depois de fechar não pode gerar pedido novo.
- `foraDoHorario` vira aviso na frente da fala, sem `return` antes da trava
  final.
- `ultimaFala` e `insistiu` atualizados nas três saídas antecipadas.
- "Pedido aguardando valor": só o botão decide o valor; texto livre segue pro
  fluxo (a mudança de data entra), e a pergunta do valor volta depois.
- `fecha_sim` entra em `DO_BOTAO`.
- `fecharPedido` `null` responde com o que falta (`oQueFaltaPraFechar` já
  devolve a lista; vira a pergunta).
- `situacao: "fora_do_assunto"` na `Leitura`: a padaria se apresenta uma vez
  ("Aqui é a Padaria Doce Pão...") e chama a equipe na segunda, sem repetir "O
  que você precisa?".
- Aviso do dia entra como uma linha no prompt (`carregarAvisoDoDia` já existe).
- `LIMITE_HISTORICO` deixa de definir se já cumprimentou (conta por existência
  de fala da padaria, não pelas últimas 40).
- Tirar `IA_BASE_URL` do ambiente do Coolify (via API, com o dono ciente) ou
  exigir `IA_API_KEY` junto; e a detecção de Anthropic em `pensar-openai.ts:99`
  passa a olhar a URL do banco, não só o env.

### Fase 4: remedir os comportamentos abertos e consertar o que sobrar

Com Fases 1 a 3 no ar, medir contra o banco, um por um, os seis da família 4
(nome pedido 3x, linha fantasma do bolo trocado, assado/frito, mudar total,
delegação da escolha, item fora da etapa). O que ainda falhar é consertado na
raiz, com a frase real como teste, e sem lista nem regex de `ultimaFala`.

### Fase 5: portão de entrega

- `node testes/medidor.cjs 5 "cinco jeitos"` (pass^5) e a matriz de 12
  conversas de `TESTES-DA-ENTREGA.md` com `falar.cjs`, lidas como cliente:
  pedido bate, comanda serve, imagem certa uma vez.
- Uma conversa de pizza e uma de família que a bateria não cobre.
- Atualizar `O-QUE-FALTA.md`, `TIRAR-AS-GUARDAS.md` e `ARQUITETURA.md` com o
  estado medido (o que fechou, o que ficou aberto, com nome).

## Verificação (como cada passo se prova)

```
cd "C:\Projetos Claude\painel-docepao"
npx tsc --noEmit
node testes/todos.cjs                      # portão, ~4 min, sem rede
node testes/o-modelo-recebe-a-pergunta-da-padaria.cjs
OPENAI_API_KEY=... node testes/mede-a-cegueira.cjs 5     # chave sai do container
node testes/uma-conversa-contra-o-banco.cjs              # contra produção, 2 min
node testes/falar.cjs                                    # manual, uma msg por vez
node testes/medidor.cjs 5 "cinco jeitos"                 # bateria, ~25 min
```

Deploy se confirma pelo SHA do container, nunca pelo status do Coolify:

```
ssh -i ~/.ssh/id_ed25519_hub root@179.198.126.197 "docker ps --format '{{.Image}}' | grep uyyqf7"
```

Rastro do modelo, que é onde o defeito aparece:

```
docker logs --since 10m $(docker ps -q --filter name=uyyqf7) | grep fluxo-novo
```

Toda guarda removida ou trava criada nasce com isca: desligar o conserto e ver o
teste ficar vermelho. Antes de dizer que algo está pronto: uma conversa contra o
banco, nunca só o portão.

## O que é do dono (não é código)

- O número da padaria na Meta; `ADMIN_WHATSAPP` e `DONA_WHATSAPP` no Coolify.
- O nome que aparece na conta do pix (única pergunta da dona que muda o que o
  cliente lê); as demais em `PERGUNTAR-PRA-DONA.md`.
- Aprovar um pedido de teste e ver o cupom sair na padaria (a ponte imprime de
  verdade).
- Conferir se o template `lembrete_retirada` está aprovado (dois docs discordam).
- Autorizar a remoção de `IA_BASE_URL` do ambiente do container.

## O que este plano NÃO faz

- Não reescreve `fluxo.ts` do zero nem troca de provedor ou modelo.
- Não deixa o modelo escrever preço, quantidade ou o resumo do pedido: número
  continua saindo do motor.
- Não liga a reescrita (decisão dele: dobrava o custo e trocava a pergunta).
- Não mexe em painel, cupom, ponte, lembrete nem cobrança, a não ser os itens
  nomeados na Fase 3.


---

## ESTADO EM 03/09/2026, de madrugada (o que ficou feito, com nome)

Commits, na ordem, todos no ar e conferidos pelo SHA do container:

| commit | o que | prova |
| --- | --- | --- |
| `0051b30` | a pergunta da padaria vai pro modelo; teto de 6 kg no fim | mede-a-cegueira 5 de 5 |
| `5e4fd0c` | Fase 1a: historico (12 falas), pedido anotado e cardapio inteiro no prompt | portao 166; conversa contra o banco |
| `9d5657e` | Fase 1b: o portao por etapa saiu (barrados, guardados, injetor da frase, dicaDaEtapa) | portao 166; "10" virou 10 pessoas em producao |
| `04cd172` | Fase 3: rascunho limpo ao registrar; foraDoHorario sem return; ultimaFala nas saidas; fecha_sim no botao; fora_do_assunto; aviso do dia; sem janela de 40 no cumprimento | portao 167 |
| `de62bf7` | pedidoNaFila: "obrigada!" depois de fechar nao repete o resumo | producao: 1 pedido, nao 2 |
| `c44ef20` | Fila 1: perguntaDePeso vira marca de estado (`etapa:peso`); B-3 saiu; comprovante pelo modelo | modelo real 15 de 15 no peso |
| `50ef6f8` | Fila 3: delegaEscolha nao e anulado; situacao ganha do item; listas do pedido aprovado sairam; bolo com nome inteiro no cardapio | modelo real 3 de 3 em cada cena |
| `53bfe74` | delegaEm: delegar salgado e docinho nao entrega o sabor do bolo | producao: bolo sem sabor chutado |
| `f3a45fc` | fora_do_assunto no formato: numero errado nao ouve "O que voce precisa?" | modelo real 3 de 3 |
| (seguinte) | sabor do bolo com docinho de mesmo nome anotado: lembrete completo (forminha, pecas, bolo sem sabor), falas seguidas da padaria viram uma, dica do bolo explicita | modelo real 3 de 3; era {} antes |

**O que ficou como REDE** (roda so quando o modelo nao devolveu; nunca desfaz o
que ele leu): desempate do sabor pela ultima fala (B-5), aviso do recheio fixo
(B-4), peca nomeada na frase (B-12), sabor solto nao e assunto novo (B-13),
produto montado sobre palavra de sabor (B-16), `semInvencao` (B-15, o modelo com
contexto nao inventou mais na medicao), `acabouDePerguntar` (B-1: nao bloqueia o
modelo, so escolhe a instrucao certa), o "Sim" digitado das pecas.

**O que NAO foi feito hoje:** Fila 4 (as 350 linhas de distribuicao de sabor,
`fluxo.ts` em torno de `esperando`/`peloFixo`) e as listas 3016 (contraste),
3822 (`ultimaFoiEscolha`), 1916 (janela de 4 palavras), 4156, 1727 e 4131 (pizza).
Ficam pra proxima sessao, uma por commit, cada uma medida antes.

**Aberto e medido em producao hoje:**
- "brigadeiro" respondendo a pergunta da cor da forminha repete a pergunta da
  cor (o cliente respondeu a pergunta errada; aceitavel, mas a padaria podia
  dizer "brigadeiro e o docinho; qual a cor?").
- "misto de brigadeiro com ninho": o modelo devolve "bolo leite ninho", que nao
  existe; a trava final tira a linha e o cliente ouve que nao achou. Melhor
  seria "bolo brigadeiro" com o ninho como sabor a confirmar pela equipe.
- `[cerebro] provedor=openai modelo=deepseek-v4-flash` no log e so o log: a
  chamada usa o modelo do banco (gpt-4.1-mini). O container tem
  `IA_BASE_URL=https://api.deepseek.com` e `OPENAI_MODEL_FLUXO=deepseek-v4-flash`
  no ambiente sem `IA_API_KEY`: so o valor "openai" no banco segura a producao.
  Tirar as duas variaveis do Coolify e decisao do dono.
