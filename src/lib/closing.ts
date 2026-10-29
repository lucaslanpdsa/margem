// Fechamento do dia: fotografia das contas de cada dia que passou (pura e testada).
// Feita na primeira abertura depois do dia, porque estimativas e datas mudam depois e o histórico mentiria.

import { shiftDay } from "./dates";
import type { DayMetrics } from "./metrics";
import { windowFor } from "./schedule";
import type { DayDoc, Settings } from "./types";

/** Quantos dias para trás fotografar (app sem abrir num fim de semana prolongado). */
export const CLOSE_LOOKBACK = 3;

/** Dias passados, com horário, ainda sem fotografia. */
export function daysToClose(today: string, days: Record<string, DayDoc>, settings: Settings, lookback = CLOSE_LOOKBACK): string[] {
  const out: string[] = [];
  for (let i = lookback; i >= 1; i--) {
    const d = shiftDay(today, -i);
    if (days[d]?.closedAt || !windowFor(settings, d)) continue;
    out.push(d);
  }
  return out;
}

/** O que guardar do dia: planejado e feito (dentro do horário). */
export const daySnapshot = (m: DayMetrics): Required<Pick<DayDoc, "plannedMin" | "doneMin">> => ({ plannedMin: m.plannedMin, doneMin: m.doneMin });

/** O plano coube: fez pelo menos 90% do planejado (dia sem plano não conta). */
export const planFit = (d: Pick<DayDoc, "plannedMin" | "doneMin">) => (d.plannedMin ?? 0) > 0 && (d.doneMin ?? 0) >= 0.9 * (d.plannedMin ?? 0);
