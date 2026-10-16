"use client";

import { Check, ChevronRight, Clock, Play, SkipForward, Square, Target } from "lucide-react";
import { fmtMin } from "@/lib/dates";
import { slotsOf } from "@/lib/schedule";
import { toggleDone } from "@/lib/db";
import { timerDisplay, useNow } from "./Timer";
import { useTimerActions } from "./toast";
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
  /** Marcada só fora do horário do dia: não ocupa o horário. */
  outside?: boolean;
  checkable?: boolean;
  /** Aviso curto na linha (ex: conflito de horário). */
  warning?: string;
}

export function TaskRow({ task, date, estimateMin, doneMin, completed, skipped, outside, checkable = true, warning }: Props) {
  const { uid, settings } = useStore();
  const { logTime } = useDialogs();
  const timer = useTimerActions();
  const running = settings.activeTimer?.taskId === task.id && settings.activeTimer.phase === "focus" && !settings.activeTimer.waiting;
  const pct = estimateMin > 0 ? Math.min(100, (doneMin / estimateMin) * 100) : 0;
  const slots = slotsOf(task);

  return (
    <li
      className={cx(
        "flex items-center gap-3 rounded-xl border bg-surface pl-3 transition-colors",
        running ? "border-todo/50 bg-todo/[0.04]" : "border-line hover:border-muted/40",
      )}
    >
      {skipped ? (
        <span className="grid h-6 w-6 shrink-0 place-items-center text-muted" title="Pulada neste dia">
          <SkipForward size={15} />
        </span>
      ) : checkable ? (
        <button
          onClick={() => toggleDone(uid, task, date, !completed)}
          className={cx(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
            completed ? "border-done bg-done text-white" : "border-line hover:border-done",
          )}
          aria-label={completed ? "Marcar como não concluída" : "Concluir"}
          title={completed ? "Desmarcar" : "Concluir"}
        >
          {completed && <Check size={13} strokeWidth={3} />}
        </button>
      ) : (
        <span className={cx("grid h-6 w-6 shrink-0 place-items-center", completed ? "text-done" : "text-todo")} title="Termina cumprindo o tempo">
          {completed ? <Check size={16} strokeWidth={3} /> : <Target size={16} />}
        </span>
      )}

      {/* Toque abre a tarefa no dia: registrar tempo, concluir, pular, editar. */}
      <button className="flex min-w-0 flex-1 items-center gap-2 py-3 pr-2 text-left" onClick={() => logTime(task)}>
        <span className="min-w-0 flex-1">
          <span className={cx("line-clamp-2 text-sm font-medium", (completed || skipped) && "text-muted line-through")}>{task.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-10 overflow-hidden rounded-full bg-sunken">
                <span className="block h-full rounded-full bg-done" style={{ width: `${pct}%` }} />
              </span>
              <span className="tabular">
                {fmtMin(doneMin)} de {fmtMin(estimateMin)}
              </span>
            </span>
            {slots.length > 0 && (
              <span className="tabular inline-flex items-center gap-1 font-medium text-ink">
                <Clock size={11} /> {slots.map((sl) => `${sl.start}–${sl.end}`).join(", ")}
              </span>
            )}
            {running && <RunningClock />}
            {skipped && <span className="font-medium">pulada</span>}
            {outside && <span className="rounded bg-break/15 px-1.5 font-medium text-break">extra</span>}
            {warning && <span className="font-medium text-break">⚠ {warning}</span>}
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-muted" />
      </button>

      {/* ▶ começa o timer nesta tarefa (no último modo usado); ■ para e registra. */}
      {!completed && !skipped && (
        <button
          onClick={() => (running ? timer.stop() : timer.start(task.id, settings.lastTimerMode ?? "stopwatch"))}
          className={cx(
            "mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors",
            running ? "bg-todo text-white hover:bg-todo/85" : "bg-todo/10 text-todo hover:bg-todo hover:text-white",
          )}
          aria-label={running ? "Parar e registrar" : "Começar timer nesta tarefa"}
          title={running ? "Parar e registrar" : settings.lastTimerMode === "pomodoro" ? "Começar pomodoro" : "Começar cronômetro"}
        >
          {running ? <Square size={13} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
        </button>
      )}
    </li>
  );
}

/** Tempo do timer rodando, atualizado a cada segundo. */
function RunningClock() {
  const { settings } = useStore();
  const now = useNow();
  const t = settings.activeTimer;
  if (!t) return null;
  return <span className="tabular font-semibold text-todo">● {timerDisplay(t, now).text}</span>;
}
