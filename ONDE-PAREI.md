# ONDE PAREI

Escrito pra você ler de manhã, e pra sobreviver se a conversa compactar sozinha.
**Atualizado a cada arquivo terminado.** O registro técnico completo, defeito por
defeito, está no `LEITURA-DA-CADEIA.md`; aqui fica só o estado e o rumo.

---

## O QUE ESTÁ NO AR AGORA

Produção roda o commit **`a7cc1d1`**, confirmado pela imagem do container (nunca
pelo status do Coolify, que trava em `running:unknown`):

```
ssh -i ~/.ssh/id_ed25519_hub root@179.198.126.197 \
  "docker ps --format '{{.Image}}' | grep uyyqf7"
```

No ar estão **os dezoito primeiros arquivos, 105 defeitos**. O `informacao.ts`
(mais 6) está commitado aqui e ainda não subiu.

---

## A REGRA QUE EU ESTOU SEGUINDO

Ler cada arquivo do primeiro byte ao último, com estas cinco perguntas em cada
linha:

```
isso e uma lista e eu peguei so o primeiro?
esse import e usado mesmo?
esse comentario ainda descreve o que esta embaixo dele?
esse valor esta decidido em outro lugar tambem?
esse return larga alguma coisa pra tras?
```

A lista completa das perguntas que ACHARAM defeito, com quantas vezes cada uma
achou e o pior caso que pegou, está no `LEITURA-DA-CADEIA.md`, na seção **AS
PERGUNTAS QUE ACHARAM DEFEITO**. É por onde eu começaria uma releitura.

E três regras que a própria leitura ensinou, e que valem mais que as cinco:

1. **Lista minha, nunca.** Só o cardápio e os preços são fixos. Toda vez que
   apareceu uma lista de nomes escrita à mão, ela acertava o hoje e errava o
   amanhã.
2. **Medir antes de afirmar.** Nada entra no registro sem eu ter rodado.
3. **Isca em todo conserto.** Removo o conserto e confirmo que o teste fica
   vermelho. Teste que passa dos dois jeitos não prova nada.

---

## O PLACAR

| | |
| --- | --- |
| arquivos lidos inteiros | **28** — o cérebro inteiro |
| defeitos consertados | **125** |
| testes no portão | **59**, todos verdes |
| `tsc` | limpo |
| cópias do normalizador de texto | de **16** para **6**, e nenhuma no fluxo da conversa |
| arquivos lendo o `catalogo.json` cru | de **17** para **9**, e nenhum do fluxo |

---

## O QUE FALTA LER

**O cérebro da conversa está lido inteiro.** Sobra a camada de banco e infra,
2.281 linhas em nove arquivos, que gravam e leem o que a conversa já decidiu:

    pedidos 575, conversas 512, negocios 335, atendimentos 212,
    tipos 176, db 122, alertas 84, uso 74, tipos-da-conversa 51

E quatro órfãos já achados nesses arquivos, anotados no
`nada-de-codigo-fantasma` numa lista que só pode encolher:
`RECADO_DA_EQUIPE`, `anexarFotoAoPedido`, `dispensarOrcamento`,
`reativarOrcamento`.

**A decisão combinada:** o cérebro fecha, mede-se uma conversa de verdade, e só
depois a infra. A infra não muda o que o cliente ouve.

--- | --- | --- |
| `lib/ia/persona.ts` | 223 | o jeito de falar |
| `lib/ia/texto.ts` | 178 | **eu escrevi nesta sessão e nunca reli.** Foi lá que eu introduzi o diminutivo que comia "docinho" |
| `lib/ia/dados/apelidos.ts` | 112 | como o cliente escreve o nome |
| banco e infra | 2.281 | `pedidos`, `conversas`, `negocios`, `atendimentos`, `db`, `tipos` |

---

## O QUE EU RECOMENDO QUANDO VOCÊ ACORDAR

**Medir uma conversa de verdade contra o banco.** Os 59 testes provam que 111
defeitos velhos não voltam. **Nenhum prova que a conversa melhorou.** Isso só
aparece rodando.

Os casos que os consertos tocaram e que só uma conversa inteira mostra:

- `dois bolos` — a regex que nunca casava
- `quanto é o cento de coxinha? quero 200` — perguntar apagava o pedido
- escrever na etapa da oferta em vez de apertar o botão — a etapa não tinha
  instrução nenhuma
- `bolo brigadeiro com 4 leites` — o segundo sabor que a regex barrava
- `não quero salgadinho` — a recusa que não era lida
- `50 xilofone` na primeira mensagem — não havia portão ali

---

## AS COISAS QUE EU ERREI NESTA SESSÃO, PRA VOCÊ SABER

Escrevo porque você pediu trabalho minucioso, e minucioso inclui isto.

- **Introduzi um defeito no arquivo 4 que só apareceu no 8.** A redução de
  diminutivo comia palavra de verdade: "docinho" virava "doco", "coxinha" virava
  "coxa". Funcionava enquanto os dois lados passassem pela mesma redução, e foi
  isso que escondeu.
- **Consertei um lado e criei um beco no outro.** Trocar o genérico do bolo na
  etapa sem trocar na fala fez a padaria perguntar o prato pra sempre.
- **Declarei dois arquivos lidos e escapou um import morto e uma leitura crua**
  do catálogo. Só apareceram quando eu medi quem ainda lê o JSON.
- **Escrevi três testes que reprovaram por defeito meu, não do código**: um
  pegava a linha do cabeçalho da comanda, outro deixava resto de byte ESC/POS na
  linha, e o terceiro extraía a função da fonte com `new Function` e quebrava no
  primeiro tipo de TypeScript.
- **Fiz uma arrumação que quebrou dois testes de verdade** e desfiz: não vale
  trocar duas guardas por uma chamada a menos numa função pura.
- **A barra invertida foi comida pelo shell quatro vezes.** Os detectores
  pegaram todas.

---

## COMANDOS

```
node testes/todos.cjs              o portão inteiro
npx tsc --noEmit -p tsconfig.json  o compilador
git log --oneline -20              o que eu fiz, um commit por arquivo
```
