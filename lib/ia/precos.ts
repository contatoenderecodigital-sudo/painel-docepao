// ============================================================================
//  TABELA DE PREÇOS DE IA (para calcular o custo gravado em public.uso_ia).
//
//  Espelha os MESMOS valores do hub (enderecodigital-hub/lib/precos-ia.ts).
//  Preços por 1.000.000 (1M) de tokens, em US$. São APROXIMADOS — AJUSTAR
//  conforme o faturamento real de cada provedor. Se mudar aqui, mude no hub.
// ============================================================================

export interface ModeloIA {
  id: string; // id técnico usado na chamada e gravado em uso_ia.modelo
  inUsd: number; // US$ por 1M tokens de entrada  (AJUSTAR)
  outUsd: number; // US$ por 1M tokens de saída    (AJUSTAR)
}

// valores aproximados (jan/2026) — AJUSTAR (mesmos do hub)
export const MODELOS_IA: ModeloIA[] = [
  // OpenAI
  { id: "gpt-4o-mini", inUsd: 0.15, outUsd: 0.6 },
  { id: "gpt-4.1-mini", inUsd: 0.4, outUsd: 1.6 },
  { id: "gpt-4o", inUsd: 2.5, outUsd: 10 },
  // Gemini
  { id: "gemini-2.5-flash", inUsd: 0.3, outUsd: 2.5 },
  { id: "gemini-2.5-pro", inUsd: 1.25, outUsd: 10 },
  // Claude
  { id: "claude-haiku-4-5", inUsd: 1, outUsd: 5 },
  { id: "claude-sonnet-4-5", inUsd: 3, outUsd: 15 },
  { id: "claude-opus-4-5", inUsd: 5, outUsd: 25 },
];

// Câmbio p/ converter US$ -> R$. AJUSTAR (mesmo do hub).
export const USD_BRL = 5.4;

function acharModelo(id: string | null | undefined): ModeloIA | null {
  if (!id) return null;
  return MODELOS_IA.find((m) => m.id === id) ?? null;
}

// Custo em CENTAVOS de R$ para dados tokens de um modelo. Se o modelo for
// desconhecido, usa um fallback genérico (AJUSTAR) — nunca zera o custo à toa.
export function estimarCustoCentBRL(modeloId: string, tokensIn: number, tokensOut: number): number {
  const m = acharModelo(modeloId);
  const inUsd = m?.inUsd ?? 0.5; // fallback genérico p/ modelo desconhecido (AJUSTAR)
  const outUsd = m?.outUsd ?? 1.5;
  const usd = (tokensIn / 1e6) * inUsd + (tokensOut / 1e6) * outUsd;
  // DEVOLVE CENTAVO FRACIONARIO, E QUEM PRECISA DE INTEIRO ARREDONDA LA.
  //
  // Aqui havia um `Math.round`, e ele apagou a conta de custo inteira a partir
  // de 27/08/2026. Medido no banco em 31/08: 2.400 chamadas com custo_cent E
  // custo_brl em ZERO, e 1,2 milhao de tokens gastos.
  //
  // O motivo: ate 26/08 cada chamada mandava 22 mil tokens e custava mais de um
  // centavo, entao o arredondamento nao aparecia. Com o fluxo novo cada chamada
  // manda 778 tokens e custa fracao de centavo: arredondar aqui zera TODAS.
  //
  // `uso.ts` ate tinha consertado a precisao do lado dele, com comentario e
  // tudo ("fracionario de proposito, custo_cent e inteiro e rejeitava virgula"),
  // e o conserto morria nesta linha, uma funcao abaixo. Consertar um lado e
  // deixar o outro e o defeito mais repetido deste projeto.
  //
  // O efeito pro dono: o painel mostrava "Custo de IA: -" e ele nao tinha como
  // saber quanto estava gastando, justo quando levou um susto de 80 dolares.
  return usd * USD_BRL * 100;
}
