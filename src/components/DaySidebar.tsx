"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { fmtMin, parseQuickAdd, todayKey } from "@/lib/dates";
import { addTask, updateTask } from "@/lib/db";
import { isTimeTask, overdue, type DayItem, type DayMetrics } from "@/lib/metrics";
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
    else await addTask(uid, { title, estimateMin: minutes, date, repeat: "once", priority: 2 });
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
  const { uid, tasks, sessions, blocks, date } = useStore();
  const [showDone, setShowDone] = useState(false);
  const isToday = date === todayKey();

  // Uma lista só: primeiro o que tem horário (na ordem do horário), depois o resto.
  const startOf = (i: DayItem) => blocks.filter((b) => b.taskId === i.task.id && b.date === date).map((b) => b.start).sort()[0];
  const open = m.items
    .filter((i) => !i.completed)
    .sort((a, b) => {
      const sa = startOf(a);
      const sb = startOf(b);
      if (sa && sb) return sa.localeCompare(sb);
      if (sa || sb) return sa ? -1 : 1;
      return a.task.createdAt.localeCompare(b.task.createdAt);
    });
  const done = m.items.filter((i) => i.completed);
  const late = isToday ? overdue(date, tasks) : [];
  const doneFor = (id: string) => sessions.filter((s) => s.taskId === id && s.date === date).reduce((a, s) => a + s.minutes, 0);

  return (
    <Panel className="p-5">
      <h2 className="mb-3 text-[15px] font-semibold">{isToday ? "Tarefas de hoje" : "Tarefas do dia"}</h2>
      <QuickAdd date={date} />

      {late.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[13px] font-medium text-over">Ficaram de dias anteriores</p>
          <ul className="space-y-1.5">
            {late.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                date={date}
                estimateMin={t.estimateMin}
                doneMin={doneFor(t.id)}
                checkable={!isTimeTask(t)}
                extra={
                  <Button size="sm" variant="ghost" className="text-todo" onClick={() => updateTask(uid, t.id, { date })}>
                    Fazer hoje
                  </Button>
                }
              />
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 space-y-1.5">
        {open.map((i) => (
          <TaskRow
            key={i.task.id}
            task={i.task}
            date={date}
            estimateMin={i.estimateMin}
            doneMin={i.doneMin}
            checkable={!isTimeTask(i.task)}
            dragMin={i.scheduled ? undefined : i.remainingMin}
            extra={i.outside ? <span className="rounded-md bg-break/15 px-2 py-1 text-xs font-medium text-break">extra</span> : undefined}
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
            Concluídas ({done.length})
          </button>
          {showDone && (
            <ul className="mt-1.5 space-y-1.5">
              {done.map((i) => (
                <TaskRow key={i.task.id} task={i.task} date={date} estimateMin={i.estimateMin} doneMin={i.doneMin} completed checkable={!isTimeTask(i.task)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
