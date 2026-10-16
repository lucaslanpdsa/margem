import { minutesBetween, weekDays, weekdayOf } from "./dates";
import { dayClock, toMin } from "./schedule";
import type { Block, BreakTime, DayWindow, Session, Settings, Task } from "./types";

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
  /** Marcada na agenda só fora do horário do dia (ex: aula às 20h). Não ocupa o horário. */
  outside: boolean;
}

export interface DayMetrics {
  date: string;
  window: DayWindow | null; // horário do dia
  capacityMin: number; // horário menos pausas
  elapsedMin: number; // quanto do horário já passou no relógio
  leftMin: number; // quanto do horário ainda resta
  past: boolean; // o dia já acabou
  plannedMin: number; // soma das estimativas do dia
  doneMin: number; // tudo que foi trabalhado no dia
  idleMin: number; // tempo que já passou sem nada registrado
  remainingMin: number; // o que ainda falta das tarefas do dia (dentro do horário)
  outsideMin: number; // tarefas marcadas fora do horário (não ocupam o horário)
  freeMin: number; // o que resta do horário menos o que falta; negativo = não cabe
  items: DayItem[];
}

/** Tarefa que termina cumprindo o tempo (e não marcando como feita). Metas semanais sempre são assim. */
export const isTimeTask = (task: Task) => task.repeat === "weeklyGoal" || task.doneBy === "time";

export const isCompletedOn = (task: Task, date: string) =>
  task.repeat === "weekdays" ? !!task.completions?.[date] : !!task.completedAt;

const createdKey = (t: Task) => t.createdAt.slice(0, 10);

/** Tarefas que pertencem a um dia (sem contar metas semanais sem bloco). */
const localMin = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

/** O bloco fica inteiro fora do horário do dia? */
export function blockOutside(b: Block, window: DayWindow | null) {
  if (!window) return true;
  const s = localMin(b.start);
  const e = localMin(b.end) || 24 * 60;
  return e <= toMin(window.start) || s >= toMin(window.end);
}

export function dayItems(date: string, tasks: Task[], blocks: Block[], sessions: Session[], window: DayWindow | null = null): DayItem[] {
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

    const taskBlocks = dayBlocks.filter((b) => b.taskId === task.id);
    const done = doneFor(task.id);
    const completed = isTimeTask(task) ? done >= estimate : isCompletedOn(task, date);
    items.push({
      task,
      estimateMin: estimate,
      doneMin: done,
      completed,
      scheduled: taskBlocks.length > 0,
      remainingMin: completed ? 0 : Math.max(0, estimate - done),
      outside: taskBlocks.length > 0 && taskBlocks.every((b) => blockOutside(b, window)),
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
  now: Date = new Date(),
): DayMetrics {
  const clock = dayClock(settings, date, now);
  const items = dayItems(date, tasks, blocks, sessions, clock.window);
  const inside = items.filter((i) => !i.outside);
  const outsideIds = new Set(items.filter((i) => i.outside).map((i) => i.task.id));
  const plannedMin = inside.reduce((a, i) => a + i.estimateMin, 0);
  // Tempo feito em tarefas marcadas fora do horário não conta como uso do horário.
  const doneMin = sessions.filter((s) => s.date === date && !outsideIds.has(s.taskId)).reduce((a, s) => a + s.minutes, 0);
  const remainingMin = inside.reduce((a, i) => a + i.remainingMin, 0);
  const outsideMin = items.filter((i) => i.outside).reduce((a, i) => a + i.estimateMin, 0);
  // O que já foi "gasto" do dia: o que passou no relógio ou o que foi registrado, o que for maior.
  const usedMin = Math.max(doneMin, clock.elapsedMin);
  return {
    date,
    window: clock.window,
    capacityMin: clock.capacityMin,
    elapsedMin: clock.elapsedMin,
    leftMin: clock.capacityMin - clock.elapsedMin,
    past: clock.past,
    plannedMin,
    doneMin,
    idleMin: Math.max(0, clock.elapsedMin - doneMin),
    remainingMin,
    outsideMin,
    freeMin: clock.capacityMin - usedMin - remainingMin,
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
/** "O que faço agora?" — e quanto tempo há até a próxima parada (bloco, pausa ou fim do horário). */
export function suggestNow(now: Date, m: DayMetrics, blocks: Block[], breaks: BreakTime[] = []) {
  const t = now.getTime();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dayBlocks = blocks.filter((b) => b.date === m.date).sort((a, b) => a.start.localeCompare(b.start));

  const current = dayBlocks.find((b) => Date.parse(b.start) <= t && t < Date.parse(b.end));
  if (current) {
    const item = m.items.find((i) => i.task.id === current.taskId);
    return { kind: "block" as const, block: current, item, untilNextMin: null, nextLabel: null };
  }

  const inBreak = m.window ? breaks.find((b) => toMin(b.start) <= nowMin && nowMin < toMin(b.end)) : undefined;
  if (inBreak) return { kind: "pause" as const, pause: inBreak, item: undefined, untilNextMin: null, nextLabel: null, block: undefined };

  // Próxima parada: o que vier primeiro entre um bloco da agenda, uma pausa e o fim do horário.
  const stops: { min: number; label: string }[] = [];
  const next = dayBlocks.find((b) => Date.parse(b.start) > t);
  if (next) stops.push({ min: Math.round((Date.parse(next.start) - t) / 60000), label: "o próximo compromisso" });
  if (m.window) {
    for (const b of breaks) if (toMin(b.start) > nowMin) stops.push({ min: toMin(b.start) - nowMin, label: b.label.toLowerCase() });
    const end = toMin(m.window.end);
    if (nowMin >= toMin(m.window.start) && end > nowMin) stops.push({ min: end - nowMin, label: "o fim do seu horário" });
  }
  stops.sort((a, b) => a.min - b.min);
  const queue = flexibleQueue(m).filter((i) => !i.outside);
  return { kind: "flex" as const, item: queue[0], untilNextMin: stops[0]?.min ?? null, nextLabel: stops[0]?.label ?? null, block: undefined };
}
