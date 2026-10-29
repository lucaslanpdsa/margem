"use client";

import { ArrowDown, ArrowUp, Check, ChevronsUp, Clock, GripVertical, ListChecks, MoreVertical, Play, SkipForward, Square, Target } from "lucide-react";
import { useState, type DragEvent } from "react";
import type { Move } from "@/lib/queue";
import { fmtMin } from "@/lib/dates";
import { slotsOf } from "@/lib/schedule";
import { goalsFor, goalsSummary } from "@/lib/goals";
import { toggleDone } from "@/lib/db";
import { tracksTime } from "@/lib/metrics";
import { stopwatchText, useNow } from "./Timer";
import { useTimerActions, useToast } from "./toast";
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
  /** Modo leve: bloco reservado (o horário já saiu do dia; não pede tempo nem cronômetro). */
  block?: boolean;
  /** Fila: "Agora" (a que está acontecendo) ou "Próxima" (depois de uma pausa). */
  badge?: string;
  /** Fila: horário previsto, ex: "14:10–15:40" ou "17:20 · não termina hoje". */
  projected?: string;
  /** A previsão avisa que parte não cabe (texto em vermelho). */
  projectedOver?: boolean;
  /** Fila: passa do fim do horário (abaixo de "Não cabe hoje"). */
  dimmed?: boolean;
  /** Fila: mudar de lugar (sem isto, a linha não se move: concluídas, fixas no horário). */
  onMove?: (to: Move) => void;
  canUp?: boolean;
  canDown?: boolean;
  /** Arrastar no computador (a lista cuida de onde soltou). */
  drag?: { onDragStart: () => void; onDragOver: (e: DragEvent) => void; onDrop: () => void; onDragEnd: () => void; over: boolean };
}

export function TaskRow({ task, date, estimateMin, doneMin, completed, skipped, outside, checkable = true, warning, badge, projected, projectedOver, dimmed, block, onMove, canUp, canDown, drag }: Props) {
  const [menu, setMenu] = useState(false);
  const { uid, settings } = useStore();
  const { openTask } = useDialogs();
  const timer = useTimerActions();
  const toast = useToast();
  const running = settings.activeTimer?.taskId === task.id;
  // Modo leve: só as tarefas "cumpro o tempo" precisam do cronômetro (e a que já está rodando).
  const showPlay = !block && (tracksTime(settings) || task.doneBy === "time" || running);
  const pct = estimateMin > 0 ? Math.min(100, (doneMin / estimateMin) * 100) : 0;
  const slots = slotsOf(task);
  const goals = goalsSummary(goalsFor(task, date));

  return (
    <li
      draggable={!!drag}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        drag?.onDragStart();
      }}
      onDragOver={drag?.onDragOver}
      onDrop={(e) => {
        e.preventDefault();
        drag?.onDrop();
      }}
      onDragEnd={drag?.onDragEnd}
      className={cx(
        "group relative flex items-center gap-3 rounded-xl border bg-surface pl-3 transition-colors",
        running ? "border-todo/50 bg-todo/[0.04]" : "border-line hover:border-muted/40",
        dimmed && !running && "opacity-60",
        drag?.over && "shadow-[0_-2px_0_0_var(--color-brand)]",
      )}
    >
      {/* Alça de arrastar: só no computador (no celular, o menu ⋮ move). */}
      {drag && (
        <span className="absolute top-1/2 -left-4 hidden -translate-y-1/2 cursor-grab text-muted opacity-0 group-hover:opacity-100 lg:block" aria-hidden>
          <GripVertical size={14} />
        </span>
      )}
      {block ? (
        <span className="grid h-6 w-6 shrink-0 place-items-center text-muted" title="Horário reservado">
          <Clock size={16} />
        </span>
      ) : skipped ? (
        <span className="grid h-6 w-6 shrink-0 place-items-center text-muted" title="Pulada neste dia">
          <SkipForward size={15} />
        </span>
      ) : checkable ? (
        <button
          onClick={() => {
            toggleDone(uid, task, date, !completed);
            if (!completed) toast(`${task.title} concluída`, { undo: () => toggleDone(uid, task, date, false) });
          }}
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
      <button className="flex min-w-0 flex-1 items-center gap-2 py-3 pr-2 text-left" onClick={() => openTask(task)}>
        <span className="min-w-0 flex-1">
          {(badge || projected) && (
            <span className="mb-0.5 flex items-center gap-2 text-xs">
              {badge && <span className="rounded bg-brand px-1.5 py-px font-semibold text-brand-ink">{badge}</span>}
              {projected && <span className={cx("tabular font-medium", projectedOver ? "text-over" : "text-muted")}>{projected}</span>}
            </span>
          )}
          <span className={cx("line-clamp-2 text-sm font-medium", (completed || skipped) && "text-muted line-through")}>{task.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
            {block && <span className="font-medium">horário reservado</span>}
            {!block && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-sunken">
                  <span className="block h-full rounded-full bg-done" style={{ width: `${pct}%` }} />
                </span>
                <span className="tabular">
                  {fmtMin(doneMin)} de {fmtMin(estimateMin)}
                </span>
              </span>
            )}
            {slots.length > 0 && (
              <span className="tabular inline-flex items-center gap-1 font-medium text-ink">
                <Clock size={11} /> {slots.map((sl) => `${sl.start}–${sl.end}`).join(", ")}
              </span>
            )}
            {goals.total > 0 && (
              <span className={cx("tabular inline-flex items-center gap-1 font-medium", goals.done === goals.total ? "text-done" : "text-ink")} title="Objetivos do dia">
                <ListChecks size={12} /> {goals.done}/{goals.total}
              </span>
            )}
            {running && <RunningClock />}
            {skipped && <span className="font-medium">pulada</span>}
            {outside && <span className="rounded bg-break/15 px-1.5 font-medium text-break">extra</span>}
            {warning && <span className="font-medium text-break">⚠ {warning}</span>}
          </span>
        </span>
      </button>

      {block && <span className="w-2" />}
      {/* Mudar de lugar na fila. */}
      {onMove && (
        <div className={cx("relative", showPlay ? "-mr-1" : "mr-1.5")}>
          <button
            onClick={() => setMenu((v) => !v)}
            className="grid h-10 w-7 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
            aria-label="Mudar de lugar na fila"
            aria-expanded={menu}
            title="Mudar de lugar"
          >
            <MoreVertical size={16} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div className="absolute top-full right-0 z-50 mt-1 w-44 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
                {[
                  { to: "top" as const, label: "Fazer agora", icon: <ChevronsUp size={14} />, ok: canUp },
                  { to: "up" as const, label: "Subir", icon: <ArrowUp size={14} />, ok: canUp },
                  { to: "down" as const, label: "Descer", icon: <ArrowDown size={14} />, ok: canDown },
                ].map((o) => (
                  <button
                    key={o.to}
                    disabled={!o.ok}
                    onClick={() => {
                      setMenu(false);
                      onMove(o.to);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sunken disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    {o.icon} {o.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ▶ começa o timer nesta tarefa (no último modo usado); ■ para e registra. */}
      {!completed && !skipped && showPlay && (
        <button
          onClick={() => (running ? timer.stop() : timer.start(task.id))}
          className={cx(
            "mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors",
            running ? "bg-todo text-white hover:bg-todo/85" : "border border-line text-muted hover:border-brand hover:bg-brand hover:text-brand-ink",
          )}
          aria-label={running ? "Parar e registrar" : "Começar timer nesta tarefa"}
          title={running ? "Parar e registrar" : "Começar cronômetro"}
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
  return <span className="tabular font-semibold text-todo">● {stopwatchText(t, now)}</span>;
}
