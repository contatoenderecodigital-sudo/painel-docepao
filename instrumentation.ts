// ============================================================================
//  FUSO DO SERVIDOR — o container roda em UTC e todo horário renderizado no
//  servidor saía 3 horas adiantado. Corrigir em cada `toLocaleString` seria
//  caçar dezenas de lugares e esquecer o próximo; o processo tem que nascer no
//  fuso de quem usa o painel. `register()` roda uma vez, antes das requisições.
// ============================================================================

export async function register() {
  process.env.TZ = process.env.TZ || "America/Sao_Paulo";
}
