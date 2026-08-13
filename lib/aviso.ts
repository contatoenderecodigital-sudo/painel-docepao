// ============================================================================
//  AVISO DO DIA — helpers puros (sem banco), usados no servidor E no client.
//  O aviso vale só pro dia em que foi escrito; a virada do dia expira sozinha.
//  "Dia" é no fuso do Brasil (senão o aviso morreria às 21h no horário local).
// ============================================================================

const TZ = "America/Sao_Paulo";

function diaBR(d: Date): string {
  // en-CA -> "AAAA-MM-DD", fácil de comparar.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// O aviso ainda é de hoje? (base do auto-reset)
export function ehHojeBR(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return diaBR(d) === diaBR(new Date());
}

// "08:12" no fuso do Brasil.
export function horaBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

// "28/07" no fuso do Brasil.
export function dataCurtaBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(
    new Date(iso),
  );
}
