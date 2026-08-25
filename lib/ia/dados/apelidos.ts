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
  "cuca recheada": ["cuca"],
  // Esfiha e esfirra sao a mesma coisa e estao a tres letras de distancia, que
  // e mais do que a tolerancia de digitacao aceita.
  esfirra: ["esfiha", "esfihas", "esfia", "esfias"],
  "risólis": ["risoles", "risole", "rissoles", "rissole"],
  "torta fria com palmito": ["torta fria"],
  "empadao com palmito": ["empadao", "empadão"],
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
      if (t === a) return nome;
    }
  }
  return null;
}
