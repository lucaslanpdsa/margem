"use client";

import type { ReactNode } from "react";
import { shiftDay, todayKey, weekDays } from "@/lib/dates";
import { cx, inputCls } from "./ui";

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
}: {
  value: string;
  onPick: (date: string) => void;
  onClose: () => void;
  align?: "left" | "right";
  /** Abre para cima (ex: no rodapé de uma janela). */
  up?: boolean;
}) {
  const today = todayKey();
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className={cx(
          "absolute z-50 w-48 rounded-xl border border-line bg-surface p-1.5 shadow-xl",
          align === "right" ? "right-0" : "left-0",
          up ? "bottom-full mb-1" : "top-full mt-1",
        )}
      >
        <MenuItem onClick={() => onPick(today)}>Hoje</MenuItem>
        <MenuItem onClick={() => onPick(shiftDay(today, 1))}>Amanhã</MenuItem>
        <MenuItem onClick={() => onPick(shiftDay(weekDays(today)[0], 7))}>Próxima segunda</MenuItem>
        <label className="mt-1 block border-t border-line px-2 pt-2 pb-1 text-xs text-muted">
          Outro dia
          <input type="date" defaultValue={value} onChange={(e) => e.target.value && onPick(e.target.value)} className={cx(inputCls, "mt-1 h-9 text-sm")} />
        </label>
      </div>
    </>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sunken">
      {children}
    </button>
  );
}
