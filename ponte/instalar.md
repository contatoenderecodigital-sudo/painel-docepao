# Ponte da impressora da Doce Pão

Este programinha roda no computador da padaria, do lado da impressora. Ele
pergunta ao painel se tem pedido aprovado esperando, monta os cupons e imprime.

Ele mora dentro do repositório de propósito. A versão anterior vivia solta na
máquina da padaria e ficou para trás: o painel aprendeu a separar salgado de
docinho, a imprimir a forma de pagamento e a escrever peso como peso, e o papel
continuou saindo com tudo junto embaixo de "EXTRAS".

## O que muda em relação à versão que está lá hoje

A que está rodando na padaria imprime **tudo numa comanda só, chamada EXTRAS**.
Está provado: o último cupom impresso, de um pedido com coxinha e esfirra, saiu
com o cabeçalho `== EXTRAS ==`.

Com esta versão, o mesmo pedido sai assim:

- **uma via por bancada**, com o nome dela no alto: SALGADOS, DOCINHOS, BOLO FESTA
- cada bancada recebe **só o que ela faz**, e sem preço (quem frita não precisa
  saber quanto custou, e número a mais é número pra ler errado na correria)
- **3 kg de bolo sai como peso**, não como três bolos
- **sabor, recheio e cor da forminha** vão no papel, embaixo do item
- **data e hora da retirada em corpo grande**, que é o que a produção procura
  primeiro; pedido sem data sai gritando `SEM DATA` em vez de um espaço vazio
- o **caixa** recebe o pedido inteiro com valores e a **forma de pagamento**,
  pra ninguém precisar perguntar com o cliente na frente
- **torta fria e bolo salgado vão pros SALGADOS**, apesar do nome. Antes iam
  parar na bancada do açúcar

## Instalar

1. Instale o Node.js na máquina da padaria: <https://nodejs.org> (versão LTS).
2. Copie a pasta `ponte` para a máquina, por exemplo em `C:\docepao-ponte`.
3. Crie ali um arquivo chamado `.env` com estas três linhas:

   ```
   PAINEL_URL=https://docepao.enderecodigital.tech
   PONTE_TOKEN=cole-aqui-o-mesmo-token-que-esta-no-painel
   IMPRESSORA=Nome Exato Da Impressora No Windows
   ```

   O nome da impressora é o que aparece em Configurações, Impressoras e
   scanners. Precisa ser igual, com espaços e maiúsculas.

4. Teste **sem gastar papel**, numa janela de comando dentro da pasta:

   ```
   node ponte.mjs --simular
   ```

   Ele mostra na tela o que imprimiria. Aprove um pedido no painel e veja se o
   texto aparece certo.

5. Rodando de verdade:

   ```
   node ponte.mjs
   ```

## Deixar ligada sozinha

Para subir junto com o computador, crie um atalho na pasta de inicialização:

1. Tecla Windows + R, digite `shell:startup` e dê Enter.
2. Crie ali um atalho apontando para:

   ```
   cmd /c cd /d C:\docepao-ponte && node ponte.mjs
   ```

Se preferir sem janela aberta, use o Agendador de Tarefas do Windows com o
gatilho "Ao fazer logon" e a mesma linha.

## Quando alguém disser que não imprimiu

A pasta `registro` guarda um arquivo por dia com tudo que aconteceu. É lá que
está a resposta para as três perguntas de sempre:

- o pedido chegou aqui? (aparece "imprimi N cupons do pedido de Fulano")
- a impressora recusou? (aparece "ERRO ao imprimir")
- ou ninguém aprovou nada no painel? (não aparece nada sobre esse pedido)

O painel também mostra se a ponte está viva: ela avisa o painel a cada consulta.
Se o painel disser que a impressora está offline, é porque este programa não
está rodando ou a máquina está sem internet.

## Mudou o cardápio ou as categorias?

As regras de qual item vai para qual bancada estão em dois lugares que precisam
combinar: `lib/departamentos.ts` no painel e o topo de `ponte.mjs` aqui. A
duplicação é de propósito, para a ponte continuar imprimindo certo mesmo se
ficar um tempo sem ser atualizada. Mexeu em um, mexa no outro.

O teste `testes/ponte-cupom.cjs` confere as vinte regras do papel sem gastar
folha. Rode antes de levar qualquer versão nova para a padaria:

```
node testes/ponte-cupom.cjs
```
