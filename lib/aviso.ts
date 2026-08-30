// ============================================================================
//  AVISO DO DIA — helpers puros (sem banco), usados no servidor E no client.
//  O aviso vale só pro dia em que foi escrito; a virada do dia expira sozinha.
//  "Dia" é no fuso da padaria (senão o aviso morreria às 21h no horário UTC).
// ============================================================================

import { TZ_PADARIA, dataNaPadaria, horaNaPadaria } from "./fuso-padaria";

function diaBR(d: Date): string {
  return dataNaPadaria(d);
}

// O aviso ainda é de hoje? (base do auto-reset)
export function ehHojeBR(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return diaBR(d) === diaBR(new Date());
}

// "08:12" no fuso da padaria, relógio de 24 horas.
export function horaBR(iso: string): string {
  return horaNaPadaria(new Date(iso));
}

// "28/07" no fuso da padaria.
export function dataCurtaBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ_PADARIA, day: "2-digit", month: "2-digit" }).format(
    new Date(iso),
  );
}
