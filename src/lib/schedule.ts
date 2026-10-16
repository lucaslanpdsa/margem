import { dayKey, weekdayOf } from "./dates";
import type { Block, BreakTime, DayWindow, Settings, Task, TimeSlot } from "./types";

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

const toHHmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Horários da tarefa (aceita o formato antigo de um horário só, com a duração da estimativa). */
export function slotsOf(t: Task): TimeSlot[] {
  if (t.slots?.length) return t.slots;
  if (t.time) return [{ start: t.time, end: toHHmm(toMin(t.time) + Math.max(15, t.estimateMin)) }];
  return [];
}

/** Soma dos horários, em minutos. */
export const slotsMinutes = (slots: TimeSlot[]) => slots.reduce((a, s) => a + Math.max(0, toMin(s.end) - toMin(s.start)), 0);

/**
 * Blocos "virtuais" para os horários das tarefas, nos dias em que elas acontecem.
 * Se a tarefa já tem um bloco de verdade naquele dia, os virtuais não são criados.
 */
export function taskTimeBlocks(tasks: Task[], realBlocks: Block[], dates: string[]): Block[] {
  const out: Block[] = [];
  for (const t of tasks) {
    const slots = slotsOf(t);
    if (!slots.length || t.archived || t.repeat === "weeklyGoal") continue;
    const days =
      t.repeat === "once"
        ? (t.date ?? "") && dates.includes(t.date!)
          ? [t.date!]
          : []
        : dates.filter((d) => t.weekdays?.includes(weekdayOf(d)) && t.createdAt.slice(0, 10) <= d && !t.skipped?.[d]);
    for (const d of days) {
      if (realBlocks.some((b) => b.taskId === t.id && b.date === d)) continue;
      slots.forEach((slot, i) => {
        const start = new Date(`${d}T${slot.start}:00`);
        const end = new Date(`${d}T${slot.end}:00`);
        if (end <= start) return;
        out.push({ id: `t-${t.id}-${d}-${i}`, taskId: t.id, date: d, start: start.toISOString(), end: end.toISOString(), virtual: true, slot: i });
      });
    }
  }
  return out;
}

export interface Conflict {
  taskId: string;
  otherId: string;
  date: string;
  start: string; // ISO do trecho em comum
  end: string;
}

/** Pares de tarefas diferentes cujos blocos se sobrepõem no mesmo dia. */
export function findConflicts(blocks: Block[]): Conflict[] {
  const out: Conflict[] = [];
  const byDay = new Map<string, Block[]>();
  blocks.forEach((b) => byDay.set(b.date, [...(byDay.get(b.date) ?? []), b]));
  for (const [date, list] of byDay) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.taskId === b.taskId) continue;
        const start = a.start > b.start ? a.start : b.start;
        const end = a.end < b.end ? a.end : b.end;
        if (start < end) {
          out.push({ taskId: a.taskId, otherId: b.taskId, date, start, end });
          out.push({ taskId: b.taskId, otherId: a.taskId, date, start, end });
        }
      }
    }
  }
  return out;
}
