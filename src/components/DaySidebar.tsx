"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { fmtMin, parseQuickAdd, todayKey } from "@/lib/dates";
import { addTask, updateTask } from "@/lib/db";
import { isTimeTask, overdue, type DayItem, type DayMetrics } from "@/lib/metrics";
import type { Task } from "@/lib/types";
import { findConflicts } from "@/lib/schedule";
import { useDialogs } from "./dialogs";
import { useStore } from "./store";
import { TaskRow } from "./TaskRow";
import { Button, Panel, cx, inputCls } from "./ui";

/** "Revisar PR 45m" + Enter cria direto; sem tempo no fim, abre o formulário. */
export function QuickAdd({ date }: { date: string }) {
  const { uid } = useStore();
  const { editTask } = useDialogs();
  const [text, setText] = useState("");
  const preview = parseQuickAdd(text);

  async function submit() {
    const { title, minutes } = parseQuickAdd(text);
    if (!title) return;
    if (minutes === null) editTask({ title, date, repeat: "once" });
    else await addTask(uid, { title, estimateMin: minutes, date, repeat: "once" });
    setText("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="relative">
        <Plus size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          className={cx(inputCls, "pl-9")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nova tarefa, ex: Revisar PR 45m"
          aria-label="Nova tarefa"
        />
      </div>
      {text && (
        <p className="mt-1.5 text-xs text-muted">
          {preview.minutes !== null ? `Enter cria "${preview.title}" com ${fmtMin(preview.minutes)}.` : "Coloque o tempo no fim (45m, 1h30) ou aperte Enter para mais opções."}
        </p>
      )}
    </form>
  );
}

export function DayLists({ m }: { m: DayMetrics }) {
  const { tasks, blocks, date } = useStore();
  const [showDone, setShowDone] = useState(false);
  const isToday = date === todayKey();

  // Uma lista só: primeiro o que tem horário (na ordem do horário), depois o resto.
  const startOf = (i: DayItem) => blocks.filter((b) => b.taskId === i.task.id && b.date === date).map((b) => b.start).sort()[0];
  const open = m.items
    .filter((i) => !i.completed && !i.skipped)
    .sort((a, b) => {
      const sa = startOf(a);
      const sb = startOf(b);
      if (sa && sb) return sa.localeCompare(sb);
      if (sa || sb) return sa ? -1 : 1;
      return a.task.createdAt.localeCompare(b.task.createdAt);
    });
  const done = m.items.filter((i) => i.completed || i.skipped);
  const skippedCount = done.filter((i) => i.skipped).length;
  const conflicts = findConflicts(blocks.filter((b) => b.date === date));
  const conflictText = (id: string) => {
    const names = [...new Set(conflicts.filter((c) => c.taskId === id).map((c) => tasks.find((t) => t.id === c.otherId)?.title))].filter(Boolean);
    return names.length ? `conflita com ${names.join(", ")}` : undefined;
  };
  const late = isToday ? overdue(date, tasks) : [];

  return (
    <Panel className="p-5">
      <h2 className="mb-3 text-[15px] font-semibold">{isToday ? "Tarefas de hoje" : "Tarefas do dia"}</h2>
      <QuickAdd date={date} />

      {late.length > 0 && <LateBanner tasks={late} date={date} />}

      <ul className="mt-4 space-y-1.5">
        {open.map((i) => (
          <TaskRow
            key={i.task.id}
            task={i.task}
            date={date}
            estimateMin={i.estimateMin}
            doneMin={i.doneMin}
            checkable={!isTimeTask(i.task)}
            warning={conflictText(i.task.id)}
            outside={i.outside}
          />
        ))}
      </ul>
      {open.length === 0 && (
        <p className="mt-4 rounded-xl bg-sunken px-4 py-3 text-sm text-muted">
          {m.items.length === 0 ? "Nenhuma tarefa neste dia. Adicione acima ou pelo botão Nova tarefa." : "Tudo feito por aqui."}
        </p>
      )}

      {done.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowDone((v) => !v)} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
            <ChevronDown size={14} className={cx("transition-transform", !showDone && "-rotate-90")} />
            {skippedCount === 0 ? "Concluídas" : skippedCount === done.length ? "Puladas" : "Concluídas e puladas"} ({done.length})
          </button>
          {showDone && (
            <ul className="mt-1.5 space-y-1.5">
              {done.map((i) => (
                <TaskRow
                  key={i.task.id}
                  task={i.task}
                  date={date}
                  estimateMin={i.estimateMin}
                  doneMin={i.doneMin}
                  completed={i.completed}
                  skipped={i.skipped}
                  checkable={!isTimeTask(i.task)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

/** Tarefas de dias anteriores que não foram feitas: um aviso compacto, não mais linhas na lista de hoje. */
function LateBanner({ tasks, date }: { tasks: Task[]; date: string }) {
  const { uid } = useStore();
  const [open, setOpen] = useState(false);
  const total = tasks.reduce((a, t) => a + t.estimateMin, 0);
  const bring = (list: Task[]) => Promise.all(list.map((t) => updateTask(uid, t.id, { date })));

  return (
    <div className="mt-4 rounded-xl border border-over/25 bg-over/[0.05] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-1 text-left text-[13px] font-medium text-over">
          <ChevronDown size={14} className={cx("shrink-0 transition-transform", !open && "-rotate-90")} />
          {tasks.length === 1 ? "1 tarefa ficou" : `${tasks.length} tarefas ficaram`} de dias anteriores · {fmtMin(total)}
        </button>
        <Button size="sm" variant="secondary" onClick={() => bring(tasks)}>
          Trazer para hoje
        </Button>
      </div>
      {open && (
        <ul className="mt-2 space-y-1 border-t border-over/15 pt-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span className="tabular shrink-0 text-xs text-muted">{fmtMin(t.estimateMin)}</span>
              <button onClick={() => bring([t])} className="shrink-0 text-[13px] font-medium text-brand hover:underline">
                Hoje
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
