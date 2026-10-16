"use client";

import { Check, Clock, SkipForward, Target } from "lucide-react";
import type { ReactNode } from "react";
import { fmtMin } from "@/lib/dates";
import { isTimeTask } from "@/lib/metrics";
import { slotsOf } from "@/lib/schedule";
import { setSkipped, toggleDone } from "@/lib/db";
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
  /** Pulada neste dia. */
  skipped?: boolean;
  extra?: ReactNode;
  checkable?: boolean;
  /** Aviso curto na linha (ex: conflito de horário). */
  warning?: string;
}

export function TaskRow({ task, date, estimateMin, doneMin, completed, skipped, extra, checkable = true, warning }: Props) {
  const { uid, settings } = useStore();
  const { editTask, logTime } = useDialogs();
  const running = settings.activeTimer?.taskId === task.id && settings.activeTimer.phase === "focus" && !settings.activeTimer.waiting;
  const pct = estimateMin > 0 ? Math.min(100, (doneMin / estimateMin) * 100) : 0;

  return (
    <li
      className={cx(
        "group relative flex items-center gap-3 rounded-xl border bg-surface py-2.5 pr-2 pl-3 transition-colors",
        running ? "border-todo/50 bg-todo/[0.04]" : "border-line hover:border-muted/40",
      )}
    >

      {skipped ? (
        <button
          onClick={() => setSkipped(uid, task, date, false)}
          className="grid h-5 w-5 shrink-0 place-items-center text-muted hover:text-ink"
          aria-label="Desfazer pulo"
          title="Pulada neste dia. Toque para desfazer"
        >
          <SkipForward size={15} />
        </button>
      ) : checkable ? (
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

      <button className="min-w-0 flex-1 text-left" onClick={() => editTask(task)} title="Editar tarefa">
        <span className={cx("block truncate text-sm font-medium", (completed || skipped) && "text-muted line-through")}>{task.title}</span>
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
          {skipped && <span className="font-medium">pulada</span>}
          {isTimeTask(task) && task.repeat !== "weeklyGoal" && <span>meta de tempo</span>}
          {warning && <span className="font-medium text-break">⚠ {warning}</span>}
        </span>
      </button>

      {extra}
      {task.repeat === "weekdays" && !completed && !skipped && (
        <button
          onClick={() => setSkipped(uid, task, date, true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink"
          aria-label="Pular hoje"
          title="Pular hoje: sai da conta do dia"
        >
          <SkipForward size={16} />
        </button>
      )}
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
