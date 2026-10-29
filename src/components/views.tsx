"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { fmtMin, todayKey } from "@/lib/dates";
import { dayMetrics } from "@/lib/metrics";
import { DayBudget } from "./CapacityPanel";
import { DayLists } from "./DaySidebar";
import { EstimateCard } from "./Estimates";
import { DayEntries } from "./TimeEntries";
import { WeekPanel } from "./WeekPanel";
import { useNow } from "./Timer";
import { useStore } from "./store";
import { Panel, cx } from "./ui";

// ---------------- Dia ----------------

export function DayView({ onGoTasks }: { onGoTasks: () => void }) {
  const { date, settings, tasks, blocks, sessions } = useStore();
  const now = new Date(useNow(60000));
  const m = dayMetrics(date, settings, tasks, blocks, sessions, now);
  // No computador, duas colunas: o resumo do dia fica parado à esquerda e as tarefas rolam à direita.
  return (
    <div className="mx-auto grid max-w-3xl gap-4 lg:max-w-6xl lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
      {/* No computador a semana fica embaixo do resumo; no celular, depois das tarefas. */}
      <div className="space-y-4 lg:sticky lg:top-6">
        <DayBudget m={m} />
        <div className="hidden space-y-4 lg:block">
          <WeekPanel />
          <EstimateCard />
        </div>
      </div>
      <div className="min-w-0 space-y-4">
        <DayLists m={m} onGoTasks={onGoTasks} />
        <div className="space-y-4 lg:hidden">
          <WeekPanel />
          <EstimateCard />
        </div>
        <DayRecords date={date} />
      </div>
    </div>
  );
}

/** "Registros de hoje": tudo o que foi registrado no dia, de todas as tarefas (recolhido). */
export function DayRecords({ date, defaultOpen = false }: { date: string; defaultOpen?: boolean }) {
  const { sessions } = useStore();
  const [open, setOpen] = useState(defaultOpen);
  const list = sessions.filter((s) => s.date === date);
  const total = list.reduce((a, s) => a + s.minutes, 0);
  const loose = list.filter((s) => !s.taskId).length;
  return (
    <Panel className="p-5">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
        <ChevronDown size={16} className={cx("shrink-0 text-muted transition-transform", !open && "-rotate-90")} />
        <span className="flex-1 text-[15px] font-semibold">{date === todayKey() ? "Registros de hoje" : "Registros do dia"}</span>
        {loose > 0 && <span className="rounded bg-break/15 px-1.5 text-xs font-medium text-break">{loose} sem tarefa</span>}
        <span className="tabular text-sm font-semibold">{fmtMin(total)}</span>
      </button>
      {open && (
        <div className="mt-3">
          <DayEntries date={date} />
        </div>
      )}
    </Panel>
  );
}
