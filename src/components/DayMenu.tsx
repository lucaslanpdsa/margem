"use client";

import type { ReactNode } from "react";
import { fmtMin, shiftDay, todayKey, weekDays } from "@/lib/dates";
import { dayMetrics } from "@/lib/metrics";
import type { Task } from "@/lib/types";
import { useStore } from "./store";
import { useNow } from "./Timer";
import { cx, inputCls } from "./ui";

/**
 * Quanto sobra num dia se a tarefa for para lá: o livre do dia (sem contar a própria tarefa) menos o que falta dela.
 * Negativo = não cabe.
 */
function useRoomFor(task: Task | undefined) {
  const { settings, tasks, blocks, sessions } = useStore();
  const now = new Date(useNow(60000));
  if (!task) return null;
  const done = sessions.filter((s) => s.taskId === task.id).reduce((a, s) => a + s.minutes, 0);
  const need = Math.max(0, task.estimateMin - done);
  const others = tasks.filter((t) => t.id !== task.id);
  return (date: string) => {
    const m = dayMetrics(date, settings, others, blocks, sessions, now);
    if (!m.window) return { text: "sem horário", over: true };
    if (m.past) return null;
    const left = m.freeMin - need;
    return left >= 0 ? { text: `sobra ${fmtMin(left)}`, over: false } : { text: `não cabe · +${fmtMin(-left)}`, over: true };
  };
}

/**
 * Menu para escolher o dia de uma tarefa de uma vez: Hoje, Amanhã, Próxima segunda ou outro dia.
 * Usado na data das tarefas (Tarefas) e em "Mudar dia" (janela da tarefa).
 */
export function DayMenu({
  value,
  onPick,
  onClose,
  align = "right",
  up = false,
  task,
}: {
  value: string;
  onPick: (date: string) => void;
  onClose: () => void;
  align?: "left" | "right";
  /** Abre para cima (ex: no rodapé de uma janela). */
  up?: boolean;
  /** A tarefa que vai mudar de dia: mostra se cabe em cada opção. */
  task?: Task;
}) {
  const today = todayKey();
  const room = useRoomFor(task);
  const hint = (d: string) => {
    const r = room?.(d);
    return r ? <span className={cx("tabular text-xs", r.over ? "text-over" : "text-muted")}>{r.text}</span> : null;
  };
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className={cx(
          "absolute z-50 rounded-xl border border-line bg-surface p-1.5 shadow-xl",
          task ? "w-68" : "w-48",
          align === "right" ? "right-0" : "left-0",
          up ? "bottom-full mb-1" : "top-full mt-1",
        )}
      >
        <MenuItem onClick={() => onPick(today)} hint={hint(today)}>
          Hoje
        </MenuItem>
        <MenuItem onClick={() => onPick(shiftDay(today, 1))} hint={hint(shiftDay(today, 1))}>
          Amanhã
        </MenuItem>
        <MenuItem onClick={() => onPick(shiftDay(weekDays(today)[0], 7))} hint={hint(shiftDay(weekDays(today)[0], 7))}>
          Próxima segunda
        </MenuItem>
        <label className="mt-1 block border-t border-line px-2 pt-2 pb-1 text-xs text-muted">
          Outro dia
          <input type="date" defaultValue={value} onChange={(e) => e.target.value && onPick(e.target.value)} className={cx(inputCls, "mt-1 h-9 text-sm")} />
        </label>
      </div>
    </>
  );
}

function MenuItem({ onClick, children, hint }: { onClick: () => void; children: ReactNode; hint?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sunken">
      <span className="shrink-0">{children}</span>
      {hint}
    </button>
  );
}
