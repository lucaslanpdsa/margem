// Lista de tarefas (aba Tarefas › Lista): quando é cada uma, o que aconteceu com ela e filtros/ordem.
// Pura e testada. O "Esta semana" e o "Estimado × real" só mostram; nunca mudam nada sozinhos.

import { calibrate, samples } from "./calibration";
import { WEEKDAY_SHORT, fromKey, repeatText, shiftDay } from "./dates";
import { isReminder } from "./metrics";
import type { Session, Task } from "./types";
import { taskWeek } from "./week";

/** Com menos que isso, o "estimado × real" de uma tarefa engana. */
export const TASK_MIN_SAMPLES = 3;

export type Bucket = "late" | "today" | "next" | "later" | "routine" | "done" | "archived";

export interface When {
  bucket: Bucket;
  /** "Hoje", "Sáb, 31/10", "Seg a sex", "Depois", "Feita hoje". */
  label: string;
  /** Para ordenar por "Quando". */
  sort: string;
}

const ORDER: Record<Bucket, string> = { late: "0", today: "1", next: "2", routine: "3", later: "4", done: "5", archived: "6" };

const shortDate = (key: string) => {
  const d = fromKey(key);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function whenOf(task: Task, today: string): When {
  if (task.archived) return { bucket: "archived", label: "Desativada", sort: ORDER.archived + task.title };
  if (task.repeat === "weekdays") {
    const label = repeatText(task.weekdays ?? []);
    return { bucket: "routine", label: label[0].toUpperCase() + label.slice(1), sort: ORDER.routine + task.title };
  }
  if (task.completedAt) {
    const day = task.completedAt.slice(0, 10);
    return { bucket: "done", label: day === today ? "Feita hoje" : "Feita", sort: ORDER.done + (9999999999999 - Date.parse(task.completedAt)) };
  }
  if (task.later) return { bucket: "later", label: "Depois", sort: ORDER.later + task.createdAt };
  const date = task.date ?? today;
  if (date < today) return { bucket: "late", label: `Atrasada · ${shortDate(date).slice(5)}`, sort: ORDER.late + date };
  if (date === today) return { bucket: "today", label: "Hoje", sort: ORDER.today + date };
  return { bucket: "next", label: date === shiftDay(today, 1) ? "Amanhã" : shortDate(date), sort: ORDER.next + date };
}

export interface TaskSummary {
  /** Que repete: planejado e feito na semana, dias cumpridos e atraso. */
  week?: { plannedMin: number; doneMin: number; behindMin: number; metDays: number; plannedDays: number };
  /** De uma vez: tudo o que foi registrado nela. */
  doneMin: number;
  /** Estimado × real desta tarefa (só com amostras suficientes). */
  factor?: { value: number; n: number };
}

export function taskSummary(task: Task, sessions: Session[], today: string, since: string): TaskSummary {
  const doneMin = sessions.filter((s) => s.taskId === task.id).reduce((a, s) => a + s.minutes, 0);
  const c = calibrate(samples([task], sessions, since));
  const factor = c.n >= TASK_MIN_SAMPLES ? { value: c.factor, n: c.n } : undefined;
  if (task.repeat !== "weekdays") return { doneMin, factor };
  const w = taskWeek(task, today, sessions, today);
  // Dias cumpridos contam até hoje; os que ainda vêm não são "não cumpridos".
  const upToToday = w.days.filter((d) => d.date <= today && d.plannedMin > 0);
  return {
    doneMin,
    factor,
    week: {
      plannedMin: w.plannedMin,
      doneMin: w.doneMin,
      behindMin: w.behindMin,
      metDays: upToToday.filter((d) => d.met).length,
      plannedDays: w.days.filter((d) => d.plannedMin > 0).length,
    },
  };
}

export type Filter = "all" | "routine" | "once" | "reminders" | "done" | "archived";

/** As de uma vez concluídas aparecem por duas semanas (para reabrir uma concluída por engano). */
export const DONE_DAYS = 14;

export function matchesFilter(task: Task, f: Filter, today: string): boolean {
  const b = whenOf(task, today).bucket;
  if (f === "archived") return b === "archived";
  if (b === "archived") return false;
  if (f === "done") return b === "done" && task.completedAt!.slice(0, 10) >= shiftDay(today, -DONE_DAYS);
  if (b === "done") return false;
  if (f === "routine") return b === "routine";
  // Lembrete: de uma vez, com dia e sem tempo (ex: pagar a luz). Em "Depois" sem tempo é só uma tarefa sem tempo ainda.
  const reminder = isReminder(task);
  if (f === "reminders") return task.repeat === "once" && reminder;
  if (f === "once") return task.repeat === "once" && !reminder;
  return true;
}

export type SortKey = "when" | "title" | "time" | "week";

export function sortTasks(list: Task[], key: SortKey, today: string, summary: (t: Task) => TaskSummary): Task[] {
  const by: Record<SortKey, (a: Task, b: Task) => number> = {
    when: (a, b) => whenOf(a, today).sort.localeCompare(whenOf(b, today).sort) || a.title.localeCompare(b.title),
    title: (a, b) => a.title.localeCompare(b.title, "pt-BR"),
    time: (a, b) => b.estimateMin - a.estimateMin || a.title.localeCompare(b.title),
    // Mais atrasada primeiro; depois a que tem mais por fazer.
    week: (a, b) => {
      const wa = summary(a).week;
      const wb = summary(b).week;
      if (!!wa !== !!wb) return wa ? -1 : 1;
      return (wb?.behindMin ?? 0) - (wa?.behindMin ?? 0) || (wb ? wb.plannedMin - wb.doneMin : 0) - (wa ? wa.plannedMin - wa.doneMin : 0);
    },
  };
  return [...list].sort(by[key]);
}
