// ============================================================================
//  RELÓGIO DA PADARIA
//
//  Toda hora que a tela mostra (lista de conversa, "hoje", aviso do dia) é
//  America/Sao_Paulo em relógio de 24 horas. O container nasce em UTC; o
//  navegador de quem abre o painel pode estar em qualquer fuso. Sem o fuso
//  fixo, 03:00 em Chapecó vira 06:00 no servidor ou 15:00 num relógio de
//  12 horas que trata madrugada como tarde.
// ============================================================================

export const TZ_PADARIA = "America/Sao_Paulo";

/**
 * HH:MM no fuso da padaria, sempre 00-23. Nunca AM/PM.
 *
 * O `Intl` ENTREGA A STRING PRONTA, e por isso aqui nao se monta "HH" + ":" +
 * "MM" na mao.
 *
 * A primeira versao pegava a hora e o minuto em duas chamadas e concatenava. O
 * `testes/a-hora-da-retirada-e-uma-decisao-so.cjs` reprovou na hora, e ele
 * estava certo: montar hora na mao e a terceira dona da mesma decisao, e este
 * projeto ja pagou por hora errada em doze horas ("as 3h da tarde" virando
 * 03:00). Uma chamada so, e o formatador decide.
 */
export function horaNaPadaria(quando: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ_PADARIA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(quando);
}

/** AAAA-MM-DD no fuso da padaria. */
export function dataNaPadaria(quando: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_PADARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(quando);
}

function somarDiasIso(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** "Hoje" / "Ontem" / DD/MM/AAAA contra o calendário da padaria, não do browser. */
export function rotuloDiaNaPadaria(data?: string, agora: Date = new Date()): string {
  if (!data) return "";
  const hoje = dataNaPadaria(agora);
  if (data === hoje) return "Hoje";
  if (data === somarDiasIso(hoje, -1)) return "Ontem";
  const [Y, M, D] = data.split("-");
  return D + "/" + M + "/" + Y;
}
