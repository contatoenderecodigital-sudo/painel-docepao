# O que o cérebro velho protegia, e o que fazer com cada regra

Levantamento feito em 26/08/2026, **antes** de apagar `lib/ia/cerebro.ts`
(7.397 linhas) e `lib/ia/guardas.ts` (1.944 linhas).

O dono mandou apagar o antigo e pediu a garantia junto: *"sem esquecer de
nada"*. E foi explícito sobre não confiar no que estava lá: *"coisas bem feitas
eu nao confio pq ta tudo podre desse antigo, nos tem q fzr tudo na nossa
estrutura atual atualizada perfeita"*.

Então **nenhuma regra aqui foi aceita por estar escrita no velho.** Cada uma foi
conferida contra o fluxo de hoje, e o veredito diz como foi conferida.

---

## Como ler o veredito

| marca | quer dizer |
| --- | --- |
| **TEM, medido** | rodei e vi funcionar no fluxo |
| **TEM, por construção** | o desenho do fluxo torna o defeito impossível, não é guarda |
| **TRAZIDO** | o fluxo não tinha, foi implementado agora, com teste |
| **PRECISA DE CONVERSA** | só se prova falando com a IA de verdade (`medidor.cjs`) |
| **MORRE** | era regra do desenho antigo e não existe mais no novo |

---

## As 34 regras

### Já estavam no fluxo, e eu vi funcionando

**1. Reclamação não é pedido** — `situacao.ts` tem a rota C inteira: reclamação,
cancelar e status. Reclamação e cancelamento são **sempre** da equipe.
**TEM, medido.**

**2. Perguntar não é pedir** — `informacao.ts` responde preço, horário,
endereço, pagamento, prazo e entrega **sem anotar nada**. O caso que gerou a
regra (a cliente perguntou "0% lactose não é sem açúcar né?" e ganhou um bolo no
pedido) está citado no topo do arquivo. **TEM, medido.**

**3. Pergunta de preço se responde com número** — `informacao.ts` caso `preco`,
e o número sai do motor, mesma fonte do preço do pedido. **TEM, medido.**

**4. Quem manda recomeçar, recomeça** — `falas-do-cliente.ts:38` reconhece doze
jeitos de pedir (reiniciar, do zero, apaga tudo, esquece tudo...) e ainda trata
a negação: "não quero recomeçar" **não** apaga. Aplicado em `atender.ts:126` e
`gravar.ts:191`. **TEM, medido.**

**5. Entrega é sempre da equipe** — `informacao.ts` caso `entrega`, com o áudio
da dona citado. **TEM, medido.**

### Estavam no fluxo por construção, e é melhor assim

Estas eram **guardas** no velho: código correndo atrás para consertar o que a IA
tinha feito. No fluxo elas não existem porque o defeito não pode acontecer.

**6. O docinho pedido à parte não vira recheio do bolo** — na etapa do bolo só
entra bolo. A etapa é quem decide, não a IA.

**7. Uma palavra dita sobre um item não vira o recheio de todos** —
`identificarProduto` roda por item, e o recheio sai do nome daquele item.

**8. O cardápio não recomeça a conversa** — o cardápio que vai é o **da etapa**,
não o que a IA escreveu.

**9. Botão só onde a resposta é fechada** — `espera.tipo` é dado da etapa. Não há
como a IA inventar um botão.

**10. Nenhuma guarda pode travar a venda** — **não há guardas no fluxo.** Esta
regra existia porque quarenta guardas recusavam anotação. A regra morre junto com
o problema dela.

**11. O que o código manda oferecer, o código aceita de volta** — mesma coisa:
não há guarda que recuse a sugestão do próprio código.

**12. Tema do topo não é sabor** — o tema tem campo próprio (`tema`), e o sabor
tem outro. Não competem.

**13. O resumo que ela fala é o pedido gravado** — o resumo é montado do estado
pelo código, em `pergunta.ts`. Não há recitação livre.

**14. Pizza doce e pizza salgada são duas pizzas** — cada sabor de pizza tem nome
próprio no motor desde 25/08. Consertado e com foto de preço travando.

**15. O fluxo novo grava onde a dona edita** — `gravar.ts`, e o teste
`o-fluxo-novo-grava-onde-a-dona-edita.cjs` já cobre.

**16. Não pergunte o que ele já respondeu** — é o `cumprida` de cada etapa, e
agora também a regra de `PERGUNTA-E-BOTAO.md`.

**17. Resposta dada não pode ser perguntada de novo** — a mesma coisa que a 16.

**18. Uma camada não desmente a outra** — o defeito era guarda mandando fazer o
que outra guarda apagava. **MORRE com as guardas.** O teste atual lê
`cerebro.ts` como texto e não sobrevive.

**19. O bolo é um só** — `fluxo.ts:927` separa o bolo dos outros itens, e por isso
a troca de sabor substitui em vez de duplicar.

**20. Trocar um item por outro não deixa os dois** — mesmo mecanismo da 19.

**21. A troca de bolo vale mesmo quando ela só grava depois** — mesmo mecanismo.

### O fluxo NÃO tinha. Trazidas em 26/08/2026

**22. O nome do dia da semana vira data.** O velho convertia "quarta" na próxima
quarta. O fluxo devolvia `null` e a padaria **perguntava a data de novo para
quem já tinha respondido**.

Trazido para `falas-do-cliente.ts`, resolvendo sempre para frente: quarta dita
numa quarta é a quarta que vem. Provado em
`testes/o-que-o-velho-sabia-o-novo-sabe.cjs`. **TRAZIDO.**

**23. A forma de pagamento é a última que o cliente falou.** Este já foi para
produção em 19/08/2026: o cliente nunca falou pix, a padaria anotou pix, ele
corrigiu para cartão, ouviu *"anotei que o pagamento será no cartão"* e o pedido
fechou com **pix**.

A causa no fluxo era um `break` no primeiro que casasse, e o primeiro da lista é
o pix. Trazido, e com uma parte que o velho não tinha: **forma negada não conta**.
"no cartão mesmo, esquece o pix" termina em pix e mesmo assim o cliente quer
cartão. **TRAZIDO.**

### Só se provam falando com a IA de verdade

Estas dependem do que o modelo faz, não do código determinístico. Ficam para o
`medidor.cjs`, e cada uma vira um cenário.

**24. Aceitar a sugestão anota o pedido** — o botão `base_sim` existe e grava.
Falta medir o caso em que ele aceita **escrevendo**.

**25. Quem pede indicação não recebe a pergunta de volta** — `delegaEscolha` na
leitura. O modelo marca a intenção; o código monta o sortido pelo catálogo e
pelo `_minimo_por_sabor` da dona (20 por sabor, 5 no cento). Aceitar a proposta
não dispara isso. **TRAZIDO.**

**26. Toda guarda que recusa por "o cliente não falou" aceita a delegação** —
não há guarda. A etapa fecha porque o sortido já escolheu os tipos. **TRAZIDO.**

**27. Mudar o total é uma conta, não uma negociação** — "vamos fazer 150
salgados então" atualiza `base.salgados` (e o equivalente em docinho e bolo).
Não recalcula pelas pessoas. **TRAZIDO.**

**28. "Pode fechar" vence qualquer oferta** — existe `confirmouEscrevendo`, mas
o caso de o cliente atropelar a oferta precisa de conversa. **PRECISA DE CONVERSA.**

**29. O resumo do pedido chega inteiro no cliente** — o resumo é montado pelo
código, mas o corte por tamanho de mensagem precisa de conversa.

**30. Ela não fala preço que a padaria não cobra** — o preço vem do motor em
todo lugar, mas a IA ainda escreve texto livre. **PRECISA DE CONVERSA.**

**31. O valor do topo não sai da boca dela** — o topo não tem preço no catálogo,
então o motor não tem o que dizer. Mas a IA já chutou "em torno de R$ 30" uma
vez. **PRECISA DE CONVERSA.**

**32. A data cai no dia da semana que ele falou** — a conversão agora existe
(regra 22), mas conferir que a IA **diz** o dia certo precisa de conversa.

### Buracos que continuam abertos

**33. Restrição que a casa não faz não pode entrar no pedido.**

Medido: `"30 brigadeiro sem lactose"` devolve o produto `brigadeiro` e o "sem
lactose" não é barrado em lugar nenhum. Ele vai parar na observação e a cozinha
recebe um pedido que não consegue produzir.

O velho tinha guarda. O fluxo **não tem**. Fica em `O-QUE-FALTA.md`.

**34. Genérico não some do pedido.**

Já estava anotado: `paraOMotor` em `fluxo/cotar.ts` não abre genérico nenhum, e
o motor cota `bolo` como um bolo caseiro de chocolate a R$ 30,90. A proteção
existe só no `cerebro.ts`, que vai ser apagado.

**Este tem que ser resolvido ANTES de apagar**, senão a proteção some junto.

---

## O que fazer com os 35 testes

| destino | quantos | quais |
| --- | --- | --- |
| **apagar junto** | 19 | os que testam guarda que não existe mais (regras 6 a 21) |
| **reapontar pro fluxo** | 6 | os que testam regra viva com código morto |
| **virar cenário do medidor** | 9 | os que precisam de conversa (regras 24 a 32) |
| **já apontam pro fluxo** | 2 | `o-fluxo-sabe-onde-esta`, `o-docinho-so-e-docinho-na-etapa-dele` |

---

## A ordem da demolição

1. resolver o **genérico** (regra 34), que é a única proteção que some junto
2. levar `unidadeDoProduto` e `categoriaDoProduto` para `lib/ia/dados/produtos.ts`,
   que é a fonte única, e os tipos `Mensagem`/`RespostaIA`/`Tenant` para onde
   pertencem
3. tirar o galho do cérebro velho de `app/api/whatsapp/route.ts` e a queda
   automática para ele quando o fluxo falha
4. apagar `cerebro.ts`, `guardas.ts`, `lib/ia/produtos.ts` (o enum que só o velho
   usava) e a chave `FLUXO_NOVO_PARA`
5. tratar os 35 testes conforme a tabela acima
6. portão verde, e a bateria dos cinco jeitos medida de novo
