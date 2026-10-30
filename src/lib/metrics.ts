import { todayKey, weekdayOf } from "./dates";
import { dayClock, mergeBreaks, slotsOf, toMin, windowFor } from "./schedule";
import { hhmm, workDay, type WorkDay } from "./ponto";
import { agendaBreaks } from "./agenda";
import type { Block, BreakTime, DayDoc, DayWindow, Session, Settings, Task } from "./types";

export interface DayItem {
  task: Task;
  /** Minutos esperados neste dia. */
  estimateMin: number;
  /** Minutos registrados nesta tarefa neste dia (timer, pomodoro ou manual). */
  doneMin: number;
  completed: boolean;
  /** Tarefa que repete, pulada neste dia: não falta nada dela. */
  skipped: boolean;
  /** Tem bloco na agenda neste dia. */
  scheduled: boolean;
  /** Quanto falta (0 se concluída). */
  remainingMin: number;
  /** Marcada na agenda só fora do horário do dia (ex: aula às 20h). Não ocupa o horário. */
  outside: boolean;
  /** Modo leve: "cumpro o tempo" com horário vira bloco reservado (isBlockTask). Não deve nada; o horário dela sai do tempo do dia. */
  block?: boolean;
}

export interface DayMetrics {
  date: string;
  window: DayWindow | null; // horário do dia
  capacityMin: number; // horário menos pausas
  elapsedMin: number; // quanto do horário já passou no relógio
  leftMin: number; // quanto do horário ainda resta
  past: boolean; // o dia já acabou
  ended: boolean; // o relógio passou do fim do horário (com blocos, o tempo livre pode acabar antes disso)
  /** Ponto do dia (marcações + previsão da jornada); null sem ponto ou fora de dia de trabalho. */
  work: WorkDay | null;
  /** Pausas valendo no dia: as fixas + blocos reservados + trabalho do ponto + compromissos do Google Agenda (a fila usa as mesmas). */
  breaks: BreakTime[];
  /** Compromissos do Google Agenda que ocupam tempo neste dia (já entram em breaks). */
  agendaMin: number;
  plannedMin: number; // soma das estimativas do dia
  doneMin: number; // tudo que foi trabalhado no dia
  idleMin: number; // tempo que já passou sem nada registrado
  remainingMin: number; // o que ainda falta das tarefas do dia (dentro do horário)
  outsideMin: number; // tarefas marcadas fora do horário (não ocupam o horário)
  freeMin: number; // o que resta do horário menos o que falta; negativo = não cabe
  items: DayItem[];
}

/** Lembrete: de uma vez, com dia e sem tempo (ex: pagar a luz). Aparece no dia, não ocupa horas. */
export const isReminder = (task: Task) => task.repeat === "once" && !task.later && task.estimateMin === 0 && task.doneBy !== "time";

/** Registro de tempo ligado (cronômetro e o que depende dele). Sem valor = ligado, como era antes. */
export const tracksTime = (settings: { trackTime?: boolean }) => settings.trackTime !== false;

/** Tarefa que termina cumprindo o tempo (e não marcando como feita). */
export const isTimeTask = (task: Task) => task.doneBy === "time";

/**
 * Modo leve: uma tarefa "cumpro o tempo" com horário (ex: Trabalho 08–11 e 14–18) vira bloco reservado.
 * Sem registro não dá para saber quanto dela foi feito; em vez de devê-la o dia todo, o horário dela
 * sai do tempo disponível (como uma pausa). Nada conta como feito: o "Feito" continua só com registros.
 */
export const isBlockTask = (task: Task, settings: { trackTime?: boolean }) => !tracksTime(settings) && isTimeTask(task) && slotsOf(task).length > 0;

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

export function dayItems(date: string, tasks: Task[], blocks: Block[], sessions: Session[], window: DayWindow | null = null): DayItem[] {
  const dayBlocks = blocks.filter((b) => b.date === date);
  const daySessions = sessions.filter((s) => s.date === date);
  const doneFor = (id: string) => daySessions.filter((s) => s.taskId === id).reduce((a, s) => a + s.minutes, 0);
  const dow = weekdayOf(date);

  const items: DayItem[] = [];
  for (const task of tasks) {
    // "Depois" não tem dia: só entra quando for puxada para um.
    if (task.archived || task.later) continue;
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
    const done = doneFor(task.id);
    const skipped = isSkippedOn(task, date);
    const completed = !skipped && (isTimeTask(task) ? done >= estimate : isCompletedOn(task, date));
    items.push({
      task,
      estimateMin: estimate,
      doneMin: done,
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
  day?: DayDoc,
): DayMetrics {
  const window = windowFor(settings, date);
  // Ponto: o trabalho (marcado + o que falta da jornada) sai do tempo do dia; as tarefas ficam com o resto.
  const work = workDay(settings.work, date, day, settings.breaks, now);
  const workBreaks = (work?.intervals ?? []).map(([a, b]) => ({ label: "Trabalho", start: hhmm(a), end: hhmm(b) }));
  const raw = dayItems(date, tasks, blocks, sessions, window);
  // Blocos reservados (modo leve): os horários deles saem do tempo do dia, como pausas.
  const blockIds = new Set(raw.filter((i) => !i.outside && !i.skipped && isBlockTask(i.task, settings)).map((i) => i.task.id));
  const reserved = raw.filter((i) => blockIds.has(i.task.id)).flatMap((i) => slotsOf(i.task).map((s) => ({ label: i.task.title, start: s.start, end: s.end })));
  // Google Agenda: compromissos com horário (e não "Disponível") também saem do tempo do dia.
  const agenda = agendaBreaks(day?.agenda, date);
  const extra = [...reserved, ...workBreaks, ...agenda];
  const breaks = extra.length ? mergeBreaks([...settings.breaks, ...extra]) : settings.breaks;
  const clock = dayClock(extra.length ? { ...settings, breaks } : settings, date, now);
  const items = raw.map((i) => (blockIds.has(i.task.id) ? { ...i, block: true, remainingMin: 0 } : i));
  const inside = items.filter((i) => !i.outside && !i.block);
  // Fora da conta de uso do horário: tarefas marcadas fora do horário e blocos (o tempo deles já saiu do dia).
  // A antiga tarefa "Trabalho" (que virou ponto) também: o trabalho agora vem das marcações.
  const notCounted = new Set([...items.filter((i) => i.outside || i.block).map((i) => i.task.id), ...(settings.work?.taskId ? [settings.work.taskId] : [])]);
  // Pulada conta só o que chegou a ser feito.
  const plannedMin = inside.reduce((a, i) => a + (i.skipped ? i.doneMin : i.estimateMin), 0);
  const doneMin = sessions.filter((s) => s.date === date && !notCounted.has(s.taskId)).reduce((a, s) => a + s.minutes, 0);
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
    work,
    breaks,
    agendaMin: mergeBreaks(agenda).reduce((a, b) => a + toMin(b.end) - toMin(b.start), 0),
    ended: !!clock.window && (date < todayKey(now) || (date === todayKey(now) && now.getHours() * 60 + now.getMinutes() >= toMin(clock.window.end))),
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
    .filter((t) => t.repeat === "once" && !t.archived && !t.later && !t.completedAt && t.date && t.date < today)
    .sort((a, b) => a.date!.localeCompare(b.date!));
}
