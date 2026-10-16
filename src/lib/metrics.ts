import { minutesBetween, weekDays, weekdayOf } from "./dates";
import type { Block, Session, Settings, Task } from "./types";

export interface DayItem {
  task: Task;
  /** Minutos esperados neste dia. */
  estimateMin: number;
  /** Minutos trabalhados nesta tarefa neste dia. */
  doneMin: number;
  completed: boolean;
  /** Tem bloco na agenda neste dia. */
  scheduled: boolean;
  /** Quanto falta (0 se concluída). */
  remainingMin: number;
}

export interface DayMetrics {
  date: string;
  capacityMin: number; // tempo do dia, antes da folga
  usableMin: number; // depois da margem de folga
  plannedMin: number; // soma das estimativas do dia
  doneMin: number; // tudo que foi trabalhado no dia
  remainingMin: number; // o que ainda falta das tarefas do dia
  freeMin: number; // usável - (feito + restante); negativo = dia sobrecarregado
  items: DayItem[];
}

export const isCompletedOn = (task: Task, date: string) =>
  task.repeat === "weekdays" ? !!task.completions?.[date] : !!task.completedAt;

const createdKey = (t: Task) => t.createdAt.slice(0, 10);

export function capacityFor(settings: Settings, date: string) {
  return settings.capacityOverrides[date] ?? settings.capacityByWeekday[weekdayOf(date)] ?? 0;
}

/** Tarefas que pertencem a um dia (sem contar metas semanais sem bloco). */
export function dayItems(date: string, tasks: Task[], blocks: Block[], sessions: Session[]): DayItem[] {
  const dayBlocks = blocks.filter((b) => b.date === date);
  const daySessions = sessions.filter((s) => s.date === date);
  const doneFor = (id: string) => daySessions.filter((s) => s.taskId === id).reduce((a, s) => a + s.minutes, 0);
  const dow = weekdayOf(date);

  const items: DayItem[] = [];
  for (const task of tasks) {
    if (task.archived) continue;
    let estimate: number | null = null;

    if (task.repeat === "once" && task.date === date) {
      estimate = task.estimateMin;
    } else if (task.repeat === "weekdays" && task.weekdays?.includes(dow) && createdKey(task) <= date) {
      estimate = task.estimateMin;
    } else if (task.repeat === "weeklyGoal") {
      // Meta semanal só entra no dia quando você reserva um bloco para ela.
      const mins = dayBlocks.filter((b) => b.taskId === task.id).reduce((a, b) => a + minutesBetween(b.start, b.end), 0);
      if (mins > 0) estimate = mins;
    }
    if (estimate === null) continue;

    const done = doneFor(task.id);
    const completed = task.repeat === "weeklyGoal" ? done >= estimate : isCompletedOn(task, date);
    items.push({
      task,
      estimateMin: estimate,
      doneMin: done,
      completed,
      scheduled: dayBlocks.some((b) => b.taskId === task.id),
      remainingMin: completed ? 0 : Math.max(0, estimate - done),
    });
  }
  return items;
}

export function dayMetrics(
  date: string,
  settings: Settings,
  tasks: Task[],
  blocks: Block[],
  sessions: Session[],
): DayMetrics {
  const items = dayItems(date, tasks, blocks, sessions);
  const capacityMin = capacityFor(settings, date);
  const usableMin = Math.round(capacityMin * (1 - settings.slack));
  const plannedMin = items.reduce((a, i) => a + i.estimateMin, 0);
  const doneMin = sessions.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0);
  const remainingMin = items.reduce((a, i) => a + i.remainingMin, 0);
  return {
    date,
    capacityMin,
    usableMin,
    plannedMin,
    doneMin,
    remainingMin,
    freeMin: usableMin - doneMin - remainingMin,
    items,
  };
}

/** Ordenação das tarefas flexíveis: prazo → prioridade → menor primeiro. */
export function byUrgency(a: Task, b: Task) {
  const da = a.deadline ?? "9999-12-31";
  const db = b.deadline ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.estimateMin - b.estimateMin;
}

/** Tarefas do dia ainda sem horário e não concluídas, na ordem sugerida. */
export function flexibleQueue(m: DayMetrics): DayItem[] {
  return m.items.filter((i) => !i.scheduled && !i.completed).sort((a, b) => byUrgency(a.task, b.task));
}

export interface WeeklyGoalProgress {
  task: Task;
  goalMin: number;
  doneMin: number;
  remainingMin: number;
}

export function weeklyGoals(date: string, tasks: Task[], sessions: Session[]): WeeklyGoalProgress[] {
  const days = new Set(weekDays(date));
  return tasks
    .filter((t) => t.repeat === "weeklyGoal" && !t.archived)
    .map((task) => {
      const doneMin = sessions.filter((s) => s.taskId === task.id && days.has(s.date)).reduce((a, s) => a + s.minutes, 0);
      const goalMin = task.weeklyGoalMin ?? 0;
      return { task, goalMin, doneMin, remainingMin: Math.max(0, goalMin - doneMin) };
    });
}

/** Avulsas atrasadas: dia planejado já passou e não foram concluídas. */
export function overdue(today: string, tasks: Task[]) {
  return tasks
    .filter((t) => t.repeat === "once" && !t.archived && !t.completedAt && t.date && t.date < today)
    .sort(byUrgency);
}

/** Caixa de entrada: avulsas sem dia planejado. */
export function inbox(tasks: Task[]) {
  return tasks.filter((t) => t.repeat === "once" && !t.archived && !t.completedAt && !t.date).sort(byUrgency);
}

/** "O que faço agora?" */
export function suggestNow(now: Date, m: DayMetrics, blocks: Block[]) {
  const t = now.getTime();
  const dayBlocks = blocks
    .filter((b) => b.date === m.date)
    .sort((a, b) => a.start.localeCompare(b.start));
  const current = dayBlocks.find((b) => Date.parse(b.start) <= t && t < Date.parse(b.end));
  if (current) {
    const item = m.items.find((i) => i.task.id === current.taskId);
    return { kind: "block" as const, block: current, item, untilNextMin: null };
  }
  const next = dayBlocks.find((b) => Date.parse(b.start) > t);
  const untilNextMin = next ? Math.round((Date.parse(next.start) - t) / 60000) : null;
  const queue = flexibleQueue(m);
  return { kind: "flex" as const, item: queue[0], untilNextMin, block: undefined };
}
