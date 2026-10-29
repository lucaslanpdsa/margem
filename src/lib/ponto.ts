// Ponto do trabalho: entrada, pausas e saída. Pura e testada.
// O trabalho deixa de ser tarefa: as marcações dizem quanto foi trabalhado (são registro, então contam de verdade)
// e a jornada prevê o que falta. Não é o ponto oficial da empresa: é o seu, para planejar o resto do dia.

import { dayKey, weekdayOf } from "./dates";
import { mergeBreaks, toMin } from "./schedule";
import type { BreakTime, DayDoc, Session, Task, WorkConfig } from "./types";

export type PontoState = "fora" | "trabalhando" | "pausa" | "encerrado";

/** Minuto do dia (local) de um ISO. */
const minOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

/** "HH:mm" (24:00 no fim do dia). */
export const hhmm = (min: number) => `${String(Math.floor(Math.min(min, 1440) / 60)).padStart(2, "0")}:${String(Math.min(min, 1440) % 60).padStart(2, "0")}`;

/** Sem marcação: fora. Número ímpar: trabalhando. Par: em pausa, ou encerrado se tocou em "Sair". */
export function pontoState(punches: string[] = [], ended = false): PontoState {
  if (!punches.length) return "fora";
  if (punches.length % 2) return "trabalhando";
  return ended ? "encerrado" : "pausa";
}

/** Pares [entrada, saída] em minutos do dia; a última aberta vai até agora (hoje) ou não conta (dia passado: esqueceu de sair). */
export function punchIntervals(punches: string[], date: string, now: Date): [number, number][] {
  const out: [number, number][] = [];
  const sorted = [...punches].sort();
  for (let i = 0; i < sorted.length; i += 2) {
    const a = minOf(sorted[i]);
    const close = sorted[i + 1];
    const b = close ? minOf(close) : date === dayKey(now) ? now.getHours() * 60 + now.getMinutes() : a;
    if (b > a) out.push([a, b]);
  }
  return out;
}

export interface WorkDay {
  state: PontoState;
  /** Jornada do dia (0 se não é dia de trabalho). */
  plannedMin: number;
  /** Trabalhado pelas marcações (a aberta conta até agora). */
  workedMin: number;
  /** O que falta da jornada (0 se encerrou). */
  leftMin: number;
  /** Minuto previsto da saída; null sem jornada a cumprir. */
  exitAt: number | null;
  /** Horário da primeira entrada, se houver. */
  firstIn: number | null;
  /** Trabalho no dia, em minutos: o que já foi (marcações) + o que falta (previsto, pulando as pausas fixas). */
  intervals: [number, number][];
  /** Só a parte prevista (para mostrar como previsão, nunca como feito). */
  predicted: [number, number][];
}

/** Ocupa `left` minutos a partir de `from`, pulando as pausas fixas. */
function fill(from: number, left: number, breaks: BreakTime[]): [number, number][] {
  const merged = mergeBreaks(breaks).map((b) => [toMin(b.start), toMin(b.end)] as const);
  const out: [number, number][] = [];
  let m = from;
  while (left > 0 && m < 24 * 60) {
    const inBreak = merged.find(([a, b]) => m >= a && m < b);
    if (inBreak) {
      m = inBreak[1];
      continue;
    }
    const next = merged.filter(([a]) => a > m).map(([a]) => a)[0] ?? 24 * 60;
    const take = Math.min(left, next - m);
    out.push([m, m + take]);
    left -= take;
    m += take;
  }
  return out;
}

/**
 * O trabalho de um dia: o que as marcações dizem e o que a jornada prevê.
 * - Sem ponto configurado: null. Dia que não é de trabalho e sem marcações: null.
 * - Dia passado: só as marcações (nada previsto).
 * - Hoje ou futuro: o que falta da jornada é previsto a partir de agora (ou da entrada habitual), pulando as pausas fixas.
 */
export function workDay(work: WorkConfig | null | undefined, date: string, day: Pick<DayDoc, "punches" | "workEnded"> | undefined, breaks: BreakTime[], now: Date): WorkDay | null {
  if (!work) return null;
  const punches = day?.punches ?? [];
  const isWorkday = work.days.includes(weekdayOf(date));
  if (!punches.length && !isWorkday) return null;
  const today = dayKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const plannedMin = isWorkday ? work.dailyMin : 0;
  const state = pontoState(punches, !!day?.workEnded);
  const actual = punchIntervals(punches, date, now);
  const workedMin = actual.reduce((a, [x, y]) => a + y - x, 0);
  const leftMin = state === "encerrado" || date < today ? 0 : Math.max(0, plannedMin - workedMin);
  // Antes da entrada, a previsão começa na entrada habitual (ou agora, se já passou dela).
  const from = date > today ? toMin(work.start) : state === "fora" ? Math.max(toMin(work.start), nowMin) : nowMin;
  const predicted = leftMin > 0 ? fill(from, leftMin, breaks) : [];
  const lastOut = punches.length && !(punches.length % 2) ? minOf([...punches].sort().at(-1)!) : null;
  return {
    state,
    plannedMin,
    workedMin,
    leftMin,
    exitAt: predicted.length ? predicted.at(-1)![1] : state === "encerrado" ? lastOut : null,
    firstIn: punches.length ? minOf([...punches].sort()[0]) : null,
    intervals: [...actual, ...predicted],
    predicted,
  };
}

/** A semana até hoje: trabalhado, jornada da semana inteira e o saldo dos dias já fechados. */
export function weekWork(work: WorkConfig, week: string[], days: Record<string, Pick<DayDoc, "punches" | "workEnded">>, now: Date) {
  const today = dayKey(now);
  let workedMin = 0;
  let balanceMin = 0;
  let plannedMin = 0;
  for (const d of week) {
    const isWorkday = work.days.includes(weekdayOf(d));
    if (isWorkday) plannedMin += work.dailyMin;
    if (d > today) continue;
    const punches = days[d]?.punches ?? [];
    const worked = punchIntervals(punches, d, now).reduce((a, [x, y]) => a + y - x, 0);
    workedMin += worked;
    // Antes de o ponto começar, dia sem marcação não é falta (só não havia ponto).
    if (work.since && d < work.since && !punches.length) continue;
    // Saldo só de dia fechado: os que passaram e hoje, se você já saiu.
    if (d < today || days[d]?.workEnded) balanceMin += worked - (isWorkday ? work.dailyMin : 0);
  }
  return { workedMin, plannedMin, balanceMin };
}

// ---------- Transformar a tarefa "Trabalho" em ponto ----------

/** Jornada a partir da tarefa: as horas dela, os dias e o início do primeiro horário. */
export function workFromTask(task: Task): WorkConfig {
  const first = [...(task.slots ?? [])].sort((a, b) => toMin(a.start) - toMin(b.start))[0];
  return { days: task.weekdays?.length ? [...task.weekdays].sort() : [1, 2, 3, 4, 5], dailyMin: task.estimateMin || 480, start: first?.start ?? task.time ?? "08:00", taskId: task.id };
}

/**
 * Registros com horário da tarefa viram marcações, por dia (para o saldo ter histórico).
 * Registros sem horário (só duração) não dá para converter e ficam de fora. Trechos que se encostam viram um só.
 */
export function punchesFromSessions(sessions: Session[], taskId: string): Record<string, string[]> {
  const byDay: Record<string, [string, string][]> = {};
  for (const s of sessions) {
    if (s.taskId !== taskId || !s.startedAt || !s.endedAt || s.startedAt >= s.endedAt) continue;
    (byDay[s.date] ??= []).push([s.startedAt, s.endedAt]);
  }
  const out: Record<string, string[]> = {};
  for (const [date, list] of Object.entries(byDay)) {
    const merged: [string, string][] = [];
    for (const [a, b] of list.sort((x, y) => x[0].localeCompare(y[0]))) {
      const last = merged.at(-1);
      if (last && a <= last[1]) {
        if (b > last[1]) last[1] = b;
      } else merged.push([a, b]);
    }
    out[date] = merged.flat();
  }
  return out;
}
