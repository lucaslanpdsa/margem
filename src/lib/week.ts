// Semana de uma tarefa que repete: planejado x feito, atraso, histórico e dias seguidos.
// A "meta da semana" é a soma do tempo planejado em cada dia (sem campo novo): 1h30 de seg a sex = 7h30.
// O número mostrado é sempre o registrado; concluir pelo círculo só conta para atraso e constância.

import { shiftDay, weekDays, weekdayOf } from "./dates";
import { isTimeTask } from "./metrics";
import type { Session, Task } from "./types";

export interface WeekDayInfo {
  date: string;
  plannedMin: number;
  doneMin: number;
  /** Cumprido: registrou o tempo do dia ou concluiu pelo círculo. */
  met: boolean;
}

export interface TaskWeek {
  days: WeekDayInfo[];
  /** Soma do planejado nos 7 dias (a meta da semana). */
  plannedMin: number;
  /** Registrado na semana. */
  doneMin: number;
  /** O que ficou para trás nos dias que já passaram, descontando o que foi feito a mais. */
  behindMin: number;
  /** Quanto falta para fechar a semana. */
  leftMin: number;
}

/** Tempo planejado da tarefa num dia (0 se não é dia dela, foi pulada, desativada ou ainda não existia). */
export function plannedOn(task: Task, date: string): number {
  if (task.repeat !== "weekdays" || task.archived) return 0;
  if (!task.weekdays?.includes(weekdayOf(date))) return 0;
  if (task.createdAt.slice(0, 10) > date) return 0;
  if (task.skipped?.[date]) return 0;
  return task.estimateFor?.[date] ?? task.estimateMin;
}

const doneOn = (task: Task, date: string, sessions: Session[]) =>
  sessions.filter((s) => s.taskId === task.id && s.date === date).reduce((a, s) => a + s.minutes, 0);

function dayInfo(task: Task, date: string, sessions: Session[]): WeekDayInfo {
  const plannedMin = plannedOn(task, date);
  const doneMin = doneOn(task, date, sessions);
  const checked = !isTimeTask(task) && !!task.completions?.[date];
  return { date, plannedMin, doneMin, met: plannedMin > 0 && (doneMin >= plannedMin || checked) };
}

/** Feito que vale para a meta: concluída pelo círculo conta o dia inteiro. */
const credited = (d: WeekDayInfo) => (d.met ? Math.max(d.doneMin, d.plannedMin) : d.doneMin);

/** A semana (seg a dom) que contém `date`, vista a partir de `today`. */
export function taskWeek(task: Task, date: string, sessions: Session[], today: string): TaskWeek {
  const days = weekDays(date).map((d) => dayInfo(task, d, sessions));
  const plannedMin = days.reduce((a, d) => a + d.plannedMin, 0);
  const doneMin = days.reduce((a, d) => a + d.doneMin, 0);
  const past = days.filter((d) => d.date < today);
  const todayInfo = days.find((d) => d.date === today);
  // Feito a mais hoje recupera o atraso; o feito do dia em si é do dia.
  const extraToday = todayInfo ? Math.max(0, credited(todayInfo) - todayInfo.plannedMin) : 0;
  const behindMin = Math.max(0, past.reduce((a, d) => a + d.plannedMin - credited(d), 0) - extraToday);
  const leftMin = Math.max(0, plannedMin - days.reduce((a, d) => a + credited(d), 0));
  return { days, plannedMin, doneMin, behindMin, leftMin };
}

/** Planejado x registrado nas últimas `n` semanas (a mais antiga primeiro), terminando na semana de `today`. */
export function weekHistory(task: Task, sessions: Session[], today: string, n = 5) {
  return Array.from({ length: n }, (_, i) => {
    const ref = shiftDay(today, -7 * (n - 1 - i));
    const w = taskWeek(task, ref, sessions, today);
    return { start: weekDays(ref)[0], plannedMin: w.plannedMin, doneMin: w.doneMin };
  });
}

/**
 * Dias seguidos cumpridos, contando para trás só os dias planejados.
 * Hoje entra se já foi cumprido; se ainda não, não quebra a sequência.
 * `since` limita até onde há registros carregados.
 */
export function streak(task: Task, sessions: Session[], today: string, since: string): number {
  let count = 0;
  for (let d = today; d >= since; d = shiftDay(d, -1)) {
    const info = dayInfo(task, d, sessions);
    if (info.plannedMin === 0) continue;
    if (info.met) count++;
    else if (d !== today) break;
  }
  return count;
}
