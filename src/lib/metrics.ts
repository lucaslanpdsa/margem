import { todayKey, weekdayOf } from "./dates";
import { dayClock, slotsOf, toMin } from "./schedule";
import type { Block, BreakTime, DayWindow, Session, Settings, Task } from "./types";

export interface DayItem {
  task: Task;
  /** Minutos esperados neste dia. */
  estimateMin: number;
  /** Minutos feitos nesta tarefa neste dia: o registrado ou, sem registro, o horário que já passou. */
  doneMin: number;
  /** Minutos registrados (pomodoro, cronômetro ou manual). */
  loggedMin: number;
  /** Minutos contados sozinhos pelo horário da tarefa (só vale enquanto não há registro). */
  autoMin: number;
  completed: boolean;
  /** Tarefa que repete, pulada neste dia: não falta nada dela. */
  skipped: boolean;
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

/** Tarefa que termina cumprindo o tempo (e não marcando como feita). */
export const isTimeTask = (task: Task) => task.doneBy === "time";

export const isSkippedOn = (task: Task, date: string) => task.repeat === "weekdays" && !!task.skipped?.[date];

export const isCompletedOn = (task: Task, date: string) =>
  task.repeat === "weekdays" ? !!task.completions?.[date] : !!task.completedAt;

const createdKey = (t: Task) => t.createdAt.slice(0, 10);

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

const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

/**
 * Quanto do horário da tarefa já passou, dentro do horário do dia e fora das pausas.
 * Dia passado: tudo; hoje: até agora; dia futuro: nada.
 */
export function slotMinutesPassed(task: Task, date: string, window: DayWindow | null, breaks: BreakTime[], now: Date) {
  if (!window) return 0;
  const today = todayKey(now);
  if (date > today) return 0;
  const limit = date < today ? 24 * 60 : now.getHours() * 60 + now.getMinutes();
  const ws = toMin(window.start);
  const we = Math.min(toMin(window.end), limit);
  return slotsOf(task).reduce((a, sl) => {
    const s = Math.max(toMin(sl.start), ws);
    const e = Math.min(toMin(sl.end), we);
    if (e <= s) return a;
    const inBreaks = breaks.reduce((x, b) => x + overlap(s, e, toMin(b.start), toMin(b.end)), 0);
    return a + (e - s - inBreaks);
  }, 0);
}

export interface DayItemsOptions {
  window?: DayWindow | null;
  breaks?: BreakTime[];
  now?: Date;
}

export function dayItems(date: string, tasks: Task[], blocks: Block[], sessions: Session[], opts: DayItemsOptions = {}): DayItem[] {
  const { window = null, breaks = [], now = new Date() } = opts;
  const dayBlocks = blocks.filter((b) => b.date === date);
  const daySessions = sessions.filter((s) => s.date === date);
  const doneFor = (id: string) => daySessions.filter((s) => s.taskId === id).reduce((a, s) => a + s.minutes, 0);
  const dow = weekdayOf(date);

  const items: DayItem[] = [];
  for (const task of tasks) {
    if (task.archived) continue;
    let estimate: number | null = null;

    // Avulsa sem dia (versões antigas tinham "caixa de entrada") conta como de hoje.
    if (task.repeat === "once" && (task.date ?? todayKey()) === date) {
      estimate = task.estimateMin;
    } else if (task.repeat === "weekdays" && task.weekdays?.includes(dow) && createdKey(task) <= date) {
      estimate = task.estimateMin;
    }
    if (estimate === null) continue;
    // Tempo ajustado só para este dia ("encurtar hoje").
    estimate = task.estimateFor?.[date] ?? estimate;

    const taskBlocks = dayBlocks.filter((b) => b.taskId === task.id);
    const logged = doneFor(task.id);
    const skipped = isSkippedOn(task, date);
    // Tarefa com horário conta sozinha enquanto o horário passa; registrar algo nela substitui essa conta.
    const auto = skipped || logged > 0 ? 0 : slotMinutesPassed(task, date, window, breaks, now);
    const done = logged || auto;
    const byTime = isTimeTask(task) || slotsOf(task).length > 0;
    const completed = !skipped && ((byTime && done >= estimate) || (!isTimeTask(task) && isCompletedOn(task, date)));
    items.push({
      task,
      estimateMin: estimate,
      doneMin: done,
      loggedMin: logged,
      autoMin: auto,
      completed,
      skipped,
      scheduled: taskBlocks.length > 0,
      remainingMin: completed || skipped ? 0 : Math.max(0, estimate - done),
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
  const items = dayItems(date, tasks, blocks, sessions, { window: clock.window, breaks: settings.breaks, now });
  const inside = items.filter((i) => !i.outside);
  const outsideIds = new Set(items.filter((i) => i.outside).map((i) => i.task.id));
  // Pulada conta só o que chegou a ser feito.
  const plannedMin = inside.reduce((a, i) => a + (i.skipped ? i.doneMin : i.estimateMin), 0);
  // Tempo feito em tarefas marcadas fora do horário não conta como uso do horário.
  // Mais o que os horários das tarefas contaram sozinhos.
  const doneMin =
    sessions.filter((s) => s.date === date && !outsideIds.has(s.taskId)).reduce((a, s) => a + s.minutes, 0) +
    inside.reduce((a, i) => a + i.autoMin, 0);
  const remainingMin = inside.reduce((a, i) => a + i.remainingMin, 0);
  const outsideMin = items.filter((i) => i.outside && !i.skipped).reduce((a, i) => a + i.estimateMin, 0);
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

/** Avulsas atrasadas: dia planejado já passou e não foram concluídas. */
export function overdue(today: string, tasks: Task[]) {
  return tasks
    .filter((t) => t.repeat === "once" && !t.archived && !t.completedAt && t.date && t.date < today)
    .sort((a, b) => a.date!.localeCompare(b.date!));
}
