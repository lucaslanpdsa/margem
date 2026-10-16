"use client";

import { Check, Clock, GripVertical, Target } from "lucide-react";
import type { ReactNode } from "react";
import { fmtMin } from "@/lib/dates";
import { isTimeTask } from "@/lib/metrics";
import { slotsOf } from "@/lib/schedule";
import { toggleDone } from "@/lib/db";
import type { Task } from "@/lib/types";
import { useDialogs } from "./dialogs";
import { useStore } from "./store";
import { cx } from "./ui";

interface Props {
  task: Task;
  date: string;
  /** Minutos esperados (para metas semanais, a meta da semana). */
  estimateMin: number;
  doneMin: number;
  completed?: boolean;
  /** Se definido, a linha pode ser arrastada para a agenda com essa duração. */
  dragMin?: number;
  extra?: ReactNode;
  checkable?: boolean;
}

export function TaskRow({ task, date, estimateMin, doneMin, completed, dragMin, extra, checkable = true }: Props) {
  const { uid, settings } = useStore();
  const { logTime } = useDialogs();
  const running = settings.activeTimer?.taskId === task.id && settings.activeTimer.phase === "focus";
  const pct = estimateMin > 0 ? Math.min(100, (doneMin / estimateMin) * 100) : 0;
  const draggable = dragMin !== undefined;
  const dragDuration = Math.min(240, Math.max(15, Math.round((dragMin ?? estimateMin) / 15) * 15 || 30));

  return (
    <li
      className={cx(
        "group relative flex items-center gap-2 rounded-xl border bg-surface py-2.5 pr-2 pl-1.5 transition-colors",
        running ? "border-todo/50 bg-todo/[0.04]" : "border-line hover:border-muted/40",
        draggable && "fc-drag",
      )}
      data-task-id={task.id}
      data-title={task.title}
      data-duration={dragDuration}
    >
      <span className={cx("grid w-4 place-items-center text-muted/50", draggable ? "cursor-grab" : "invisible")} title="Arraste para a agenda">
        <GripVertical size={14} />
      </span>

      {checkable ? (
        <button
          onClick={() => toggleDone(uid, task, date, !completed)}
          className={cx(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
            completed ? "border-done bg-done text-white" : "border-line hover:border-done",
          )}
          aria-label={completed ? "Marcar como não concluída" : "Concluir"}
          title={completed ? "Desmarcar" : "Concluir"}
        >
          {completed && <Check size={12} strokeWidth={3} />}
        </button>
      ) : (
        <span
          className={cx("grid h-5 w-5 shrink-0 place-items-center", completed ? "text-done" : "text-todo")}
          title={task.repeat === "weeklyGoal" ? "Meta semanal: termina cumprindo o tempo" : "Termina cumprindo o tempo"}
        >
          {completed ? <Check size={16} strokeWidth={3} /> : <Target size={16} />}
        </span>
      )}

      <button className="min-w-0 flex-1 text-left" onClick={() => logTime(task)} title="Ver e reportar tempo">
        <span className={cx("block truncate text-sm font-medium", completed && "text-muted line-through")}>{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-12 overflow-hidden rounded-full bg-sunken">
              <span className="block h-full rounded-full bg-done" style={{ width: `${pct}%` }} />
            </span>
            <span className="tabular">
              {fmtMin(doneMin)} de {fmtMin(estimateMin)}
              {task.repeat === "weeklyGoal" && " na semana"}
            </span>
          </span>
          {slotsOf(task).length > 0 && task.repeat !== "weeklyGoal" && (
            <span className="tabular inline-flex items-center gap-1 font-medium text-ink">
              <Clock size={11} /> {slotsOf(task).map((sl) => `${sl.start}–${sl.end}`).join(", ")}
            </span>
          )}
          {isTimeTask(task) && task.repeat !== "weeklyGoal" && <span>meta de tempo</span>}
        </span>
      </button>

      {extra}
      <button
        onClick={() => logTime(task)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-todo/10 px-3 text-[13px] font-semibold text-todo transition-colors hover:bg-todo hover:text-white"
        title="Registrar tempo feito nesta tarefa"
      >
        <Clock size={15} /> Registrar
      </button>
    </li>
  );
}
