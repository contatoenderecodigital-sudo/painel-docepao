// ============================================================================
//  COMO O CLIENTE ESCREVE O NOME DO PRODUTO.
//
//  Sinônimo de verdade se resolve aqui, numa lista, e NÃO afrouxando a
//  comparação por distância de letra. Afrouxar casa produto errado: "esfirra" e
//  "esfiha" estão a três letras, e três letras de folga também transformaria
//  "coxinha" em outra coisa.
//
//  Estava dentro de uma função em guardas.ts e servia só a ela. Virou arquivo
//  próprio quando o leitor da frase passou a precisar da mesma lista: se as
//  duas camadas usassem listas diferentes, uma aceitaria o que a outra recusa,
//  e isso já aconteceu neste projeto.
// ============================================================================

// AQUI SO ENTRA SINONIMO DE VERDADE. NUNCA UM PRODUTO MAIS CARO.
//
// Esta lista e usada por uma guarda cujo trabalho e perguntar "o cliente
// realmente pediu isso, ou a IA inventou?". Quem esta aqui e LIBERADO por essa
// guarda, sem ninguem perguntar nada.
//
// Ate 26/08/2026 tinham entrado tres que nao sao jeito diferente de falar a
// mesma coisa, sao OUTRO PRODUTO:
//
//     "cuca recheada"           liberado quando ele escreve "cuca"        +R$ 4,00
//     "empadao com palmito"     liberado quando ele escreve "empadao"     +R$ 5,00
//     "torta fria com palmito"  liberado quando ele escreve "torta fria"  +R$ 3,00
//
// A IA anotava o mais caro, a guarda via a excecao e liberava. Pior: o motor de
// preco IGNORA esta lista e cobrava o simples, entao as duas metades do sistema
// discordavam entre si e nada media isso.
//
// Decisao do dono: nesses casos a IA PERGUNTA qual dos dois. Saiu daqui.
//
// O criterio pra entrar: mesmo produto, mesmo preco, so escrito de outro jeito.
import { semAcento } from "../texto";

export const APELIDOS: Record<string, string[]> = {
  "pizza inteira": [
    "pizza de forma",
    "de forma",
    "pizza de metro",
    "de metro",
    "retangular",
    "pizza grande",
    "pizza inteira",
    "uma pizza",
  ],
  "pizza meia": ["meia pizza", "metade da pizza", "meia de forma", "meia"],
  "pizza redonda": ["redonda", "pizza redonda", "de 30", "30 cm"],
  // O PASTEL DOCE É OUTRO PRODUTO, E TEM QUE VIR ANTES DO SALGADO.
  //
  // A nota do próprio catálogo já avisava: *"o cliente chama de 'pastel bolha
  // doce' ou 'pastel doce'; o nome fica 'mini bolha doce' de propósito, pra
  // casar com a família da 'mini bolha' e não roubar o pedido salgado"*.
  //
  // Só que esses dois nomes nunca tinham entrado aqui. Medido em 26/08/2026:
  //
  //     "pastel doce de banana"  ->  mini bolha (o SALGADO), R$ 1,00
  //
  // O apelido "pastel" pegava a frase inteira antes de qualquer coisa. Além dos
  // R$ 0,25 por unidade, a cozinha recebia pedido de pastel SALGADO para quem
  // pediu doce, e num cento isso é a bandeja errada inteira.
  //
  // Isto é sinônimo de verdade, que é o critério deste arquivo: mesmo produto,
  // mesmo preço, escrito do jeito que o cliente fala. Áudio da dona,
  // 16/08/2026: *"se o cliente pedir, você consegue fazer, por exemplo, pastel
  // doce de banana. É uma coisa que a gente faz, só que a gente cobra 1,25"*.
  "mini bolha doce": ["pastel bolha doce", "pastel doce", "bolha doce", "pastelzinho doce"],
  "mini bolha": ["pastel frito", "pastel", "bolha"],

  // Esfiha e esfirra sao a mesma coisa e estao a tres letras de distancia, que
  // e mais do que a tolerancia de digitacao aceita.
  esfirra: ["esfiha", "esfihas", "esfia", "esfias"],
  "risólis": ["risoles", "risole", "rissoles", "rissole"],
  // O CORRETOR DO CELULAR TROCA QUICHE POR CHIQUE.
  //
  // Na conversa de 25/08/2026 o cliente escreveu "chique e coxinha", depois
  // "quiche e coxinha", e nas duas vezes so a coxinha entrou no pedido. As duas
  // palavras estao a QUATRO letras de distancia, entao nenhuma tolerancia
  // segura de digitacao pega isso: "chique" e palavra comum do portugues e o
  // teclado sugere ela sozinho. Caso de lista, nao de distancia.
  quiche: ["chique", "chiques", "quiches", "kiche", "kishe"],
};

// AQUI FICAVA `nomePeloApelido`, IMPORTADA PELO `fluxo.ts` E NUNCA CHAMADA.
//
// Era o resolvedor canônico de apelido, e o fluxo importava sem usar. Quem
// resolve apelido de verdade hoje são dois: `identificarProduto`, que monta os
// candidatos com os apelidos junto, e o leitor da frase, que procura o apelido
// dentro do texto. Os dois já fazem o nome mais longo ganhar, e isso foi
// conferido nos cinco casos que importam antes de apagar:
//
//     "pastel doce de banana"  ->  mini bolha doce   nos dois
//     "pastel de carne"        ->  mini bolha        nos dois
//     "meia pizza"             ->  pizza meia        nos dois
//
// E VALE REGISTRAR O ERRO DE METODO: eu melhorei esta função (troquei "o
// primeiro da lista" por "o mais longo") ANTES de conferir quem a chamava, e ela
// não era chamada por ninguém. Conferir o chamador vem primeiro.
//
// A lista `APELIDOS` acima continua viva e é usada pelos dois resolvedores.
