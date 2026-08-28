// ============================================================================
//  UM NOME SÓ POR PRODUTO.
//
//  POR QUE ISTO EXISTE
//
//  Até 26/08/2026 o nome de um produto era decidido em quatro lugares
//  diferentes: o modelo escrevia do jeito dele, `separarProdutoERecheio`
//  resolvia de um jeito, o motor de preço de outro, e o item guardado de outro.
//  Quatro caminhos escrevendo o nome da mesma coisa.
//
//  O preço disso foi medido: na bateria dos cinco jeitos, as execuções que
//  passavam gravavam `bolo 4 leites` e as que falhavam gravavam `4 leites`, o
//  mesmo bolo com dois nomes. A comparação falhava, o item entrava duas vezes,
//  e o cupom da cozinha saiu com "misto: bolo 4 leites e 4 leites".
//
//  O PREFIXO "bolo" NÃO É ENFEITE. É ELE QUE SEPARA DOCINHO DE BOLO:
//
//      brigadeiro        -> docinho,  R$ 1,25   a unidade
//      bolo brigadeiro   -> bolo,     R$ 46,90  o quilo
//
//  Um sabor sem o prefixo vira o docinho de mesmo nome, e o pedido sai com
//  R$ 2,50 no lugar de R$ 93,80. Por isso o nome canônico do bolo carrega o
//  "bolo" na frente, que é como a tabela de preço guarda.
//
//  Todo mundo que precisa saber o que é um item passa por aqui.
// ============================================================================

import { APELIDOS } from "../dados/apelidos";
import {
  produtosDaCasa,
  ehCategoriaDeBolo,
  unidadeDoPedido as unidadeDoProduto,
} from "../dados/produtos";
// O MESMO normalizador de todo mundo. Aqui era a quinta copia dele, e esta
// trocava a ordem do toLowerCase com o normalize.
import { semAcento as semAcMin } from "../texto";

export type Identidade = {
  /** O nome como o resto do sistema tem que escrever, sempre igual. */
  produto: string;
  /** O que veio grudado no nome e não é o produto: "frango" em "quiche de frango". */
  recheio: string | null;
  /** kg ou un, tirado do cardápio. */
  unidade: "kg" | "un";
  /** true quando o nome só existe num lugar do cardápio. */
  unico: boolean;
};

/**
 * O QUE É ESTE ITEM, RESOLVIDO CONTRA O CARDÁPIO.
 *
 * `categoria` é a dica de onde a conversa está. Ela decide o desempate quando o
 * nome existe em mais de um lugar: "brigadeiro" na etapa do bolo é bolo, na
 * etapa do docinho é docinho. Sem ela, um nome ambíguo fica como veio, e quem
 * resolve é a pergunta ao cliente.
 */
export function identificarProduto(nomeBruto: string, categoria?: string): Identidade {
  const bruto = String(nomeBruto || "").trim();
  // "bolo DE cenoura" e "bolo cenoura" são o mesmo bolo, e antes viravam dois
  // nomes diferentes no pedido: o "de" fazia o nome não casar com candidato
  // nenhum, e o fluxo devolvia o texto cru. Era exatamente a doença que este
  // arquivo foi criado pra curar, sobrevivendo numa preposição.
  const t = semAcMin(bruto).replace(/^bolo (de |do |da ) */, "bolo ");
  if (!t) return { produto: bruto, recheio: null, unidade: "un", unico: false };

  const ehEtapaDeBolo = String(categoria || "").startsWith("bolo");

  // ------------------------------------------------------------ candidatos
  // Cada candidato sabe o nome que o sistema deve escrever (o canônico) e a
  // forma pela qual o cliente pode ter escrito.
  // `apelido` marca o candidato que veio da lista de sinonimos. Ele so vale
  // quando o que o cliente escreveu NAO e um produto do cardapio: ver o porque
  // logo abaixo, na escolha.
  const cand: { canonico: string; casa: string; deBolo: boolean; apelido: boolean }[] = [];

  // O CANDIDATO SAI DA LISTA UNICA, E NAO DO catalogo.json.
  //
  // Este arquivo lia o JSON cru e remontava os grupos do jeito dele, com uma
  // lista escrita a mao de QUATRO baldes: salgados.frito, salgados.assado,
  // doces e outros_produtos. O catalogo tem quinze chaves.
  //
  // O que ficou de fora foi a chave `pizza`. Medido em 28/08/2026:
  //
  //   "pizza meia de frango"        -> produto "pizza meia de frango", sem recheio
  //   "pizza redonda de calabresa"  -> produto "pizza redonda", recheio calabresa
  //
  // A redonda mora em `outros_produtos` e por isso funcionava; a meia e a
  // inteira moram em `pizza` e sairam com o sabor colado no nome. Comanda com
  // nome que nao existe na tabela, e a cozinha lendo "pizza meia de frango"
  // como se fosse um produto.
  //
  // E o defeito que o `nomeCurto` do `produtos.ts` diz, no comentario dele, ter
  // acabado: "cada arquivo que precisava do nome curto o derivava sozinho,
  // lendo o catalogo cru e remontando os grupos do seu jeito". Este arquivo
  // continuava fazendo isso, e ele e justamente o que se chama "um nome so por
  // produto".
  for (const p of produtosDaCasa()) {
    const deBolo = ehCategoriaDeBolo(p.categoria);
    // Os jeitos pelos quais o cliente pode ter escrito ESTE produto.
    const casas = new Set<string>([p.nome, p.nomeCurto]);
    // "bolo cenoura" tem que alcancar "bolo caseiro cenoura": o cliente nao
    // diz "caseiro", isso e classificacao da casa.
    if (deBolo) casas.add("bolo " + p.nomeCurto);
    // O NOME QUE CARREGA A FAMILIA TAMBEM ATENDE PELO NOME CURTO.
    //
    // Onze dos doze docinhos se chamam pelo sabor puro ("brigadeiro", "cafe").
    // UM se chama "docinho de churros". Essa diferenca de uma palavra tinha
    // preco: a palavra "churros" sozinha nao alcancava o docinho, e o unico
    // candidato que sobrava era `bolo caseiro churros`.
    //
    //     "churros" na etapa do docinho  ->  bolo caseiro churros, R$ 34,90
    //     o certo                        ->  docinho de churros,   R$  1,75
    //
    // Vinte vezes o preco, num item que a festa pede em dezenas. O "cafe" nao
    // sofria disso porque o docinho dele se chama so "cafe": os dois candidatos
    // existem, a escolha fica ambigua e a ETAPA desempata. Era esse desempate
    // que o nome comprido impedia de acontecer.
    const semFamilia = semAcMin(p.nome).replace(/^(docinho|salgado|doce|bolo|torta|mini) (de|da|do) +/, "");
    if (semFamilia) casas.add(semFamilia);
    for (const casa of casas) {
      const c = semAcMin(casa);
      if (c) cand.push({ canonico: p.nome, casa: c, deBolo, apelido: false });
    }
  }
  for (const [canonico, lista] of Object.entries(APELIDOS)) {
    for (const a of lista) cand.push({ canonico, casa: semAcMin(a), deBolo: false, apelido: true });
  }

  const servem = cand
    .filter((c) => c.casa && (t === c.casa || t.startsWith(c.casa + " ")))
    // Nome mais longo primeiro: "mini bolha de carne" é "mini bolha" + "carne",
    // nunca "mini" + "bolha de carne".
    .sort((a, b) => b.casa.length - a.casa.length);

  if (!servem.length) {
    return {
      produto: bruto,
      recheio: null,
      unidade: unidadeDoProduto(bruto, categoria),
      unico: false,
    };
  }

  // O nome existe em mais de um lugar? Só é ambíguo de verdade quando os
  // candidatos discordam sobre SER BOLO OU NÃO: "brigadeiro" é docinho e é
  // sabor de bolo, e isso muda o preço em quarenta vezes.
  // O NOME DO CARDAPIO GANHA DO APELIDO. SEMPRE.
  //
  // A lista de apelidos mistura duas coisas. Sinonimo de verdade ("esfiha" e
  // "esfirra", "chique" e "quiche") tem o mesmo preco e pode virar nome
  // canonico. Mas ela tambem tem "cuca" apontando pra "cuca recheada", que a
  // casa usa pra NAO RECUSAR o pedido, e essas mudam o preco:
  //
  //     cuca        R$ 22,90  ->  cuca recheada           +R$ 4,00
  //     empadao     R$ 34,90  ->  empadao com palmito     +R$ 5,00
  //     torta fria  R$ 36,90  ->  torta fria com palmito  +R$ 3,00
  //
  // Usar a lista inteira pra renomear cobraria a mais de quem pediu o simples.
  // Entao: se o que ele escreveu JA E um produto do cardapio, e ele mesmo.
  const tamanhoDoMelhor = servem[0].casa.length;
  const noTamanho = servem.filter((c) => c.casa.length === tamanhoDoMelhor);
  const proprios = noTamanho.filter((c) => !c.apelido);
  const empatados = proprios.length ? proprios : noTamanho;
  const ambiguo = new Set(empatados.map((c) => c.deBolo)).size > 1;

  // A etapa desempata. Sem ela, fica o primeiro e quem resolve é a pergunta.
  const escolhido = ambiguo
    ? (empatados.find((c) => c.deBolo === ehEtapaDeBolo) ?? empatados[0])
    : empatados[0];

  const resto = t
    .slice(escolhido.casa.length)
    .replace(/^ *(de|da|do|com) +/, "")
    .trim();

  return {
    produto: escolhido.canonico,
    recheio: resto || null,
    unidade: unidadeDoProduto(escolhido.canonico, categoria),
    unico: !ambiguo,
  };
}
