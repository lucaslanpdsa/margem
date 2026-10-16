import type { Task } from "./types";

/**
 * Converte tarefas de versões antigas para o modelo atual.
 * Meta semanal ("X horas por semana") vira tarefa que repete de segunda a sexta,
 * por tempo, com a meta dividida pelos 5 dias.
 * Devolve a tarefa convertida e se ela precisa ser regravada.
 */
type StoredTask = Omit<Task, "repeat"> & { repeat: string; weeklyGoalMin?: number };

export function migrateTask(raw: StoredTask): { task: Task; changed: boolean } {
  if (raw.repeat !== "weeklyGoal") return { task: raw as Task, changed: false };
  const perDay = Math.max(5, Math.round((raw.weeklyGoalMin ?? 0) / 5 / 5) * 5);
  const { weeklyGoalMin: _goal, ...rest } = raw;
  void _goal;
  return {
    task: { ...(rest as Task), repeat: "weekdays", weekdays: [1, 2, 3, 4, 5], estimateMin: perDay, doneBy: "time" },
    changed: true,
  };
}
