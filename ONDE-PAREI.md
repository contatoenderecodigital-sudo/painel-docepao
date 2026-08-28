# ONDE PAREI

Escrito pra você ler de manhã, e pra sobreviver se a conversa compactar sozinha.
**Atualizado a cada arquivo terminado.** O registro técnico completo, defeito por
defeito, está no `LEITURA-DA-CADEIA.md`; aqui fica só o estado e o rumo.

---

## O QUE ESTÁ NO AR AGORA

Produção roda o commit **`bbac518`**, confirmado pela imagem do container (nunca
pelo status do Coolify, que trava em `running:unknown`):

```
ssh -i ~/.ssh/id_ed25519_hub root@179.198.126.197 \
  "docker ps --format '{{.Image}}' | grep uyyqf7"
```

O que está no ar são **os catorze arquivos da cadeia, 78 defeitos consertados**.
O que veio depois disso (a partir do `produtos.ts`) está commitado aqui e **não
subiu ainda**.

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
| arquivos lidos inteiros | **18** |
| defeitos consertados | **105** |
| testes no portão | **58**, todos verdes |
| `tsc` | limpo |
| cópias do normalizador de texto | de **16** para **1** |
| arquivos lendo o `catalogo.json` cru | de **17** para **9**, e nenhum do fluxo |

---

## O QUE FALTA LER

A partir do webhook a IA alcança **42 arquivos**. Li 16. A lista completa, em
ordem de importância, está na tabela do `LEITURA-DA-CADEIA.md`. Os próximos:

| arquivo | linhas | por que importa |
| --- | --- | --- |
| `lib/ia/fluxo/informacao.ts` | 253 | onde a padaria fala número pro cliente. 5 leituras cruas do catálogo |
| `lib/ia/persona.ts` | 223 | o jeito de falar |
| `lib/ia/texto.ts` | 178 | **eu escrevi nesta sessão e nunca reli.** Foi lá que eu introduzi o diminutivo que comia "docinho" |
| os menores do fluxo | ~900 | `generico`, `restricao`, `dizer`, `base`, `situacao`, `cotar`, `apelidos`, `catalogo-em-texto` |
| banco e infra | 2.281 | `pedidos`, `conversas`, `negocios`, `atendimentos`, `db`, `tipos` |

---

## O QUE EU RECOMENDO QUANDO VOCÊ ACORDAR

**Medir uma conversa de verdade contra o banco.** Os 58 testes provam que 105
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
