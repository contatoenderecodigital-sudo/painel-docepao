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
  return Math.round(usd * USD_BRL * 100);
}
