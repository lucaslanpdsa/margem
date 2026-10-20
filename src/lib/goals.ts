// Objetivos do dia de uma tarefa (ex: Trabalho › "fechar ticket 123", "revisar PR"). Pura e testada.
// Só uma lista para marcar: não têm tempo próprio e não entram em nenhuma conta (o tempo é o da tarefa).

import { shiftDay, weekdayOf } from "./dates";
import type { Goal, Task } from "./types";

/** Chave dos objetivos: o dia, para as que repetem; "_" (um só) para as de uma vez, que podem mudar de dia. */
export const goalsKey = (task: Task, date: string) => (task.repeat === "weekdays" ? date : "_");

export const goalsFor = (task: Task, date: string): Goal[] => task.goals?.[goalsKey(task, date)] ?? [];

/** Próximo dia da tarefa que repete, depois de `date` (null se não repete ou não tem dias). */
export function nextOccurrence(task: Task, date: string): string | null {
  if (task.repeat !== "weekdays" || !task.weekdays?.length) return null;
  for (let i = 1; i <= 7; i++) {
    const d = shiftDay(date, i);
    if (task.weekdays.includes(weekdayOf(d))) return d;
  }
  return null;
}

/** "Levar para o próximo dia": os não feitos saem de `from` e vão para o fim da lista de `to` (sem repetir texto). */
export function carryOver(from: Goal[], to: Goal[]): { from: Goal[]; to: Goal[] } {
  const moving = from.filter((g) => !g.done);
  const have = new Set(to.map((g) => g.text.trim().toLowerCase()));
  return { from: from.filter((g) => g.done), to: [...to, ...moving.filter((g) => !have.has(g.text.trim().toLowerCase()))] };
}

export const goalsSummary = (goals: Goal[]) => ({ done: goals.filter((g) => g.done).length, total: goals.length });
