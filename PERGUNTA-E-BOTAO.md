# A regra da pergunta com botão

Escrito em 26/08/2026, depois de o dono achar o mesmo defeito duas vezes, em
lugares diferentes.

**Leia isto ANTES de criar qualquer etapa nova com botão**, para este cliente ou
para qualquer outro. O erro é fácil de cometer e não dá erro nenhum: o pedido
fecha bonito e a padaria só não vendeu.

---

## A regra, em três partes

Toda pergunta de detalhe opcional obedece às três. Faltar uma já é defeito.

**1. Se o cliente não falou, PERGUNTA.**

Detalhe que a casa vende não pode deixar de ser oferecido porque o resto do
pedido já está pronto. Quem manda tudo numa mensagem só continua sendo
perguntado.

**2. Se ele já respondeu, NÃO PERGUNTA DE NOVO.**

E resposta escrita vale igual a tocar no botão. Quem escreve "sem topo e sem
papel de arroz" respondeu as duas; quem escreve "com papel de arroz" respondeu
uma e continua sendo perguntado só da outra.

**3. Se ele ignorou duas vezes, SEGUE.**

Insistir uma terceira vez faz o fluxo chamar a equipe por causa de um detalhe
opcional, e isso é pior do que perder o detalhe. Quem ignorou duas vezes já
respondeu: ele não quer.

---

## O defeito que gerou a regra

Ele tem duas caras, e as duas já foram entregues neste projeto.

### Cara 1: a pergunta que se repete

Bateria dos cinco jeitos, 25/08/2026. O cliente mandou o pedido inteiro numa
mensagem, com data, hora, nome e pagamento, e ouviu:

> o bolo vai no prato de MDF aberto ou na embalagem com tampa?

Respondeu *"isso mesmo, pode confirmar"* e ouviu **a mesma pergunta**. O pedido
nunca fechou, nos cinco jeitos de falar.

O conserto da época foi deixar passar quem já informou tudo. Resolveu o
travamento e criou a cara 2.

### Cara 2: a pergunta que nunca acontece

Achado pelo dono em 26/08/2026:

> ELE PRECISA PEDIR SE A PESSOA NÃO FALAR QUE QUER NE (...) nao pode refazer a
> mema pergunta se ela ja falou

Com o atalho, quem mandava tudo de uma vez **nunca era perguntado**, e o papel
de arroz, que custa R$ 12 e a padaria vende, simplesmente não era oferecido. Não
é item sumindo do pedido: é oferta que não acontece. Mas é dinheiro.

**As duas caras são a mesma doença: confundir "o dado que falta" com "a pergunta
que não foi feita".** O que segura a etapa é a pergunta não feita.

---

## Como se escreve isso no código

Em `lib/ia/fluxo/etapas.ts`, dentro do `cumprida` da etapa:

```ts
cumprida: (p) => {
  // 1 e 2: sem resposta, a etapa segura. Com resposta, passa.
  // 3: quem ignorou duas vezes ja respondeu, e ela segue.
  if (p.pecas?.topo == null || p.pecas?.papelDeArroz == null) {
    return jaPerguntouEEleNaoRespondeu(p);
  }
  ...
}
```

`jaPerguntouEEleNaoRespondeu` é `(p.insistiu ?? 0) >= 1`. O `insistiu` é contado
em `lib/ia/fluxo/fluxo.ts`, comparando a fala da vez com a anterior, e já existia
para outra coisa (a escalada para a equipe na terceira repetição).

**O que NÃO se escreve:**

```ts
// ERRADO: pula a pergunta em vez de aceitar que ela ja foi feita.
if (jaTemOsDados(p) && algoFalta) return true;
```

Essa linha existiu, no `pecas_do_bolo` e no `bolo`, e é exatamente a cara 2.

---

## Onde a resposta escrita é lida

`lib/ia/fluxo/leitor-da-frase.ts`, na função `lerAFrase`. Ela devolve `pecas`
com o que a frase afirmou ou negou, cada um com a sua negação própria. Conferido
em 26/08/2026:

| o cliente escreve | o que ela marca |
| --- | --- |
| sem topo e sem papel de arroz | topo `false`, papel `false` |
| com papel de arroz e com topo | topo `true`, papel `true` |
| sem papel de arroz | papel `false`, topo continua em aberto |
| pode ser com papel de arroz de foto | papel `true`, topo continua em aberto |
| nao quero topo | topo `false` |

**Botão novo precisa de leitura escrita junto.** Se a única forma de responder
for tocar no botão, quem responde por texto nunca é ouvido e a pergunta se
repete até a conversa morrer. Foi assim que a cara 1 nasceu.

---

## A varredura de 26/08/2026

Todas as etapas que esperam botão, e como cada uma se comporta.

| etapa | botões | como fecha | tem o defeito? |
| --- | --- | --- | --- |
| `base_da_festa` | Pode ser / Quero ajustar | `baseAceita` | não. Sem base não há proposta, e não existe nada a perder por não perguntar |
| `pecas_do_bolo` | Sim / Não, duas vezes | os dois respondidos, ou ignorados duas vezes | **tinha, consertado em 26/08** |
| `oferta` | Quero docinho / Quero bolo / Só isso | `ofereceu` | não. Ela se marca como oferecida nos três caminhos, inclusive no "só isso" |
| `confirmacao` | Confirmar / Mudar algo | `() => false` | não, e é de propósito: só o botão fecha o pedido, nunca o código |

E o que responde por botão sem ser etapa própria:

| detalhe | botões | onde mora | tem o defeito? |
| --- | --- | --- | --- |
| prato do bolo | prato_aberto / prato_tampa | dentro do `cumprida` da etapa `bolo` | **tinha, consertado em 26/08** |
| pagamento | pag_pix / pag_cartao / pag_dinheiro | etapa `dados` | não. Pagamento é obrigatório, não opcional: sem ele o pedido não fecha e é certo que não feche |

---

## Antes de criar uma etapa com botão nova

Quatro perguntas. Se qualquer uma ficar sem resposta, a etapa ainda não está
pronta.

1. **O que se perde se ela nunca for perguntada?** Se for dinheiro, ela tem que
   ser perguntada mesmo com o pedido completo.
2. **O cliente consegue responder escrevendo?** Se só o botão responde, a
   pergunta vai se repetir. Ver `lerAFrase`.
3. **O que acontece se ele ignorar?** Detalhe opcional segue depois de duas
   tentativas. Dado obrigatório (pagamento, data) não segue nunca.
4. **A resposta "não" fecha a etapa?** Tem que fechar. Responder "não" é
   responder; o que não pode é ficar sem resposta.

E o teste nasce junto, cobrando os dois lados: o caso que tem que perguntar e o
caso que não pode perguntar de novo. O modelo é
`testes/topo-e-papel-tem-todas-as-opcoes.cjs`.
