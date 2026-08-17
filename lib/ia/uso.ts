// ============================================================================
//  MEDIÇÃO DE USO/CUSTO DE IA — grava cada resposta do cérebro em public.uso_ia.
//
//  O console "Tokens & IA" do HUB lê dessa tabela (enderecodigital-hub/lib/
//  tokens-ia.ts). A uso_ia mora no schema `public` do MESMO Postgres; o painel
//  conecta com search_path=docepao, então referenciamos `public.uso_ia`
//  EXPLICITAMENTE (senão o insert cairia no schema errado / tabela inexistente).
//
//  Colunas usadas (ver DDL do hub em db/schema.sql):
//    negocio_id UUID, origem TEXT NOT NULL, modelo TEXT,
//    tokens_in BIGINT, tokens_out BIGINT, custo_cent INTEGER, criado_em (default).
//  NÃO existe coluna hub_id em uso_ia — o hub escopa por negocios.hub_id (join).
//
//  IMPORTANTE: é SECUNDÁRIO ao atendimento. Nunca lança — se o insert falhar
//  (ex: role docepao_app sem GRANT de INSERT em public.uso_ia), só loga e segue.
// ============================================================================

import { query } from "../banco/db";
import { estimarCustoCentBRL } from "./precos";

// Acumulador de tokens de UM turno do cérebro (pode ter várias chamadas ao
// provedor num round de tool-call — os totais são somados antes de gravar).
// cacheRead: pedaço da entrada que veio do cache do provedor. A OpenAI cobra
// 25% do preço normal por esse pedaço — sem separar, a conta sai inflada.
export type UsoTurno = { tokensIn: number; tokensOut: number; cacheRead?: number };

// Registra o consumo de UMA resposta do cérebro. Fire-and-forget: chame sem
// await (ou com await dentro de try/catch) — esta função NUNCA propaga erro.
//
// clienteId: amarra o consumo à CONVERSA (custo por atendimento). Opcional —
// quando vazio grava NULL (não quebra: o total por negócio continua íntegro).
export async function registrarUsoIA(
  negocioId: string | null | undefined,
  modelo: string,
  uso: UsoTurno,
  origem = "whatsapp",
  clienteId?: string | null,
  contato?: string | null,
): Promise<void> {
  try {
    // Sem negócio escopado (ex: tenant padrão de demo) não há como creditar.
    if (!negocioId) return;
    const tokensIn = Math.max(0, Math.round(uso.tokensIn || 0));
    const tokensOut = Math.max(0, Math.round(uso.tokensOut || 0));
    if (tokensIn === 0 && tokensOut === 0) return; // nada consumido, nada a gravar
    // O que veio do cache sai da entrada cheia e entra com desconto.
    const lido = Math.min(Number(uso.cacheRead ?? 0), tokensIn);
    // Fracionário de propósito: o desconto de 25% do cache quase nunca cai num
    // centavo redondo. custo_cent é INTEIRO no banco e rejeitava o valor com
    // vírgula, derrubando o registro justamente nas chamadas em que o cache
    // pegou. O preciso vai pro custo_brl (NUMERIC); o inteiro só arredonda.
    const custoPreciso =
      estimarCustoCentBRL(modelo, tokensIn - lido, tokensOut) +
      estimarCustoCentBRL(modelo, lido, 0) * 0.25;
    const custoCent = Math.round(custoPreciso);
    // custo_brl é a coluna nova do hub (NUMERIC com 6 casas). custo_cent, em
    // centavos inteiros, zerava toda conversa barata — uma resposta no
    // gpt-4o-mini custa fração de centavo. As duas são gravadas: a antiga pra
    // não quebrar leitura velha, a nova pra a tela de custo mostrar a verdade.
    const custoBrl = custoPreciso / 100;
    const provedor = modelo.startsWith("claude") ? "claude" : modelo.startsWith("gemini") ? "gemini" : "openai";
    await query(
      `INSERT INTO public.uso_ia
         (negocio_id, origem, modelo, provedor, tokens_in, tokens_out, cache_read, custo_cent, custo_brl, custo_fonte, cliente_id, contato)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'tabela', $10, $11)`,
      [negocioId, origem, modelo, provedor, tokensIn, tokensOut, lido, custoCent, custoBrl, clienteId ?? null, contato ?? null],
    );
  } catch (e) {
    // Erro mais provável: role docepao_app sem GRANT INSERT em public.uso_ia.
    // Loga e segue — o atendimento não pode cair por causa da medição.
    console.error("[uso_ia] falha ao registrar uso de IA (segue sem travar):", (e as Error)?.message ?? e);
  }
}
