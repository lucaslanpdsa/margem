"use client";

import type { ReactNode } from "react";
import { fmtMin, fromKey, todayKey } from "@/lib/dates";
import { toggleDone } from "@/lib/db";
import { startFocus } from "@/lib/pomodoro";
import type { Task } from "@/lib/types";
import { useDialogs } from "./dialogs";
import { useStore } from "./store";
import { PRIORITY_DOT, PRIORITY_LABEL, cx } from "./ui";

interface Props {
  task: Task;
  date: string;
  /** Minutos esperados (para metas semanais, o que falta na semana). */
  estimateMin: number;
  doneMin: number;
  completed?: boolean;
  /** Duração sugerida ao arrastar para a agenda. */
  dragMin?: number;
  /** Ações extras à direita. */
  extra?: ReactNode;
  /** Mostrar checkbox de concluir. */
  checkable?: boolean;
}

export function deadlineLabel(deadline: string) {
  const today = todayKey();
  if (deadline < today) return { text: "prazo vencido", tone: "text-warn" };
  if (deadline === today) return { text: "vence hoje", tone: "text-warn" };
  const d = fromKey(deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return { text: `prazo ${d}`, tone: "text-muted" };
}

export function TaskRow({ task, date, estimateMin, doneMin, completed, dragMin, extra, checkable = true }: Props) {
  const { uid, settings } = useStore();
  const { editTask, logTime } = useDialogs();
  const running = settings.activeTimer?.taskId === task.id && settings.activeTimer.phase === "focus";
  const pct = estimateMin > 0 ? Math.min(100, (doneMin / estimateMin) * 100) : 0;
  const dl = task.deadline ? deadlineLabel(task.deadline) : null;
  const dragDuration = Math.min(240, Math.max(15, Math.round((dragMin ?? estimateMin) / 15) * 15 || 30));

  return (
    <li
      className={cx(
        "group flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 hover:border-line hover:bg-paper",
        dragMin !== undefined && "fc-drag cursor-grab",
        running && "border-done/40 bg-done/5",
      )}
      data-task-id={task.id}
      data-title={task.title}
      data-duration={dragDuration}
    >
      {checkable ? (
        <input
          type="checkbox"
          checked={!!completed}
          onChange={(e) => toggleDone(uid, task, date, e.target.checked)}
          className="h-4 w-4 shrink-0 accent-[var(--done)]"
          aria-label="Concluir"
        />
      ) : (
        <span className="w-4 shrink-0" />
      )}

      <button className="min-w-0 flex-1 text-left" onClick={() => editTask(task)}>
        <div className="flex items-center gap-1.5">
          <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT[task.priority])} title={`Prioridade ${PRIORITY_LABEL[task.priority]}`} />
          <span className={cx("truncate text-sm", completed && "text-muted line-through")}>{task.title}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
          <span className="tabular">
            {fmtMin(doneMin)} / {fmtMin(estimateMin)}
          </span>
          <span className="h-1 w-14 overflow-hidden rounded-full bg-line">
            <span className="block h-full bg-done" style={{ width: `${pct}%` }} />
          </span>
          {task.category && <span className="truncate">{task.category}</span>}
          {dl && <span className={dl.tone}>{dl.text}</span>}
        </div>
      </button>

      {extra}
      <button
        onClick={() => logTime(task)}
        className="rounded-md p-1.5 text-muted opacity-60 hover:bg-card hover:text-ink group-hover:opacity-100"
        title="Registrar tempo manualmente"
        aria-label="Registrar tempo"
      >
        ⏱
      </button>
      <button
        onClick={() => startFocus(uid, settings, task.id)}
        disabled={running || completed}
        className="rounded-md p-1.5 text-done hover:bg-card disabled:opacity-30"
        title="Iniciar pomodoro"
        aria-label="Iniciar pomodoro"
      >
        ▶
      </button>
    </li>
  );
}
