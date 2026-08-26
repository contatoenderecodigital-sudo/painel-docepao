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

/** O nome do catálogo para o que o cliente escreveu, ou null. */
export function nomePeloApelido(escrito: string): string | null {
  const t = String(escrito || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!t) return null;
  for (const [nome, lista] of Object.entries(APELIDOS)) {
    for (const apelido of lista) {
      const a = apelido
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      if (!a) continue;
      if (t === a) return nome;
      // O APELIDO COSTUMA VIR COM O RECHEIO COLADO.
      //
      // Comparar a string inteira pegava "chique" e deixava passar "chique de
      // frango", que é como o cliente escreve de verdade. Aí o nome errado
      // chegava no motor de preço: medido em 25/08/2026, um pedido de R$ 381,30
      // fechou por R$ 12.256,30 só nesse cenário.
      //
      // Vale quando o apelido ABRE a frase. No meio não: "torta de chique" não
      // é quiche, e casar no meio inventa produto.
      if (t.startsWith(a + " ")) return nome;
    }
  }
  return null;
}
