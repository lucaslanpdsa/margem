import { dayKey, weekdayOf } from "./dates";
import type { BreakTime, DayWindow, Settings } from "./types";

/** "07:30" -> 450 */
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

/** Horário do dia (já considerando exceções); null = dia sem tarefas. */
export function windowFor(settings: Settings, date: string): DayWindow | null {
  if (date in settings.windowOverrides) return settings.windowOverrides[date];
  return settings.windows[weekdayOf(date)] ?? null;
}

/** Minutos do horário entre `from` e `to`, descontando as pausas. */
function availableBetween(from: number, to: number, breaks: BreakTime[]) {
  if (to <= from) return 0;
  const inBreaks = breaks.reduce((a, b) => a + overlap(from, to, toMin(b.start), toMin(b.end)), 0);
  return to - from - inBreaks;
}

export interface DayClock {
  window: DayWindow | null;
  /** Tempo do dia para tarefas (horário menos pausas). */
  capacityMin: number;
  /** Quanto desse tempo já passou no relógio. */
  elapsedMin: number;
  /** Dia que já acabou. */
  past: boolean;
}

export function dayClock(settings: Settings, date: string, now: Date = new Date()): DayClock {
  const window = windowFor(settings, date);
  if (!window) return { window, capacityMin: 0, elapsedMin: 0, past: date < dayKey(now) };
  const start = toMin(window.start);
  const end = toMin(window.end);
  const capacityMin = availableBetween(start, end, settings.breaks);

  const today = dayKey(now);
  let elapsedMin = 0;
  if (date < today) elapsedMin = capacityMin;
  else if (date === today) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    elapsedMin = availableBetween(start, Math.min(Math.max(nowMin, start), end), settings.breaks);
  }
  return { window, capacityMin, elapsedMin, past: date < today || (date === today && elapsedMin >= capacityMin) };
}
