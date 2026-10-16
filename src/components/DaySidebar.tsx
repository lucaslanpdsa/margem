"use client";

import { useState } from "react";
import { fmtMin, parseQuickAdd, todayKey } from "@/lib/dates";
import { addTask, updateTask } from "@/lib/db";
import { flexibleQueue, inbox, overdue, suggestNow, weeklyGoals, type DayMetrics } from "@/lib/metrics";
import { startFocus } from "@/lib/pomodoro";
import { useDialogs } from "./dialogs";
import { useStore } from "./store";
import { TaskRow } from "./TaskRow";
import { useNow } from "./Timer";
import { Button, Card, SectionTitle, cx, inputCls } from "./ui";

export function QuickAdd({ date }: { date: string }) {
  const { uid } = useStore();
  const { editTask } = useDialogs();
  const [text, setText] = useState("");

  async function submit() {
    const { title, minutes } = parseQuickAdd(text);
    if (!title) return;
    if (minutes === null) editTask({ title, date, repeat: "once" });
    else await addTask(uid, { title, estimateMin: minutes, date, repeat: "once", priority: 2 });
    setText("");
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder='Adicionar rápido: "Revisar PR 45"' />
      <Button type="button" variant="soft" onClick={() => editTask({ date, repeat: "once" })} title="Formulário completo">
        +
      </Button>
    </form>
  );
}

function NowCard({ m }: { m: DayMetrics }) {
  const { uid, settings, blocks, tasks } = useStore();
  const now = useNow(30000);
  const timer = settings.activeTimer;
  const s = suggestNow(new Date(now), m, blocks);
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (timer?.phase === "focus") {
    const t = tasks.find((x) => x.id === timer.taskId);
    return (
      <Card className="border-done/40">
        <SectionTitle>Agora</SectionTitle>
        <p className="font-display text-lg">Em foco: {t?.title}</p>
      </Card>
    );
  }

  const item = s.item;
  if (!item) {
    return (
      <Card>
        <SectionTitle>Agora</SectionTitle>
        <p className="text-sm text-muted">
          {m.items.length === 0 ? "Nenhuma tarefa para hoje ainda." : "Nada pendente fora da agenda. 🎉"}
          {s.untilNextMin !== null && ` Próximo compromisso em ${fmtMin(s.untilNextMin)}.`}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>{s.kind === "block" ? "Agora, pela agenda" : "Sugestão para agora"}</SectionTitle>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg">{item.task.title}</p>
          <p className="text-xs text-muted">
            falta {fmtMin(item.remainingMin)}
            {s.kind === "block" && s.block && ` · até ${hhmm(s.block.end)}`}
            {s.kind === "flex" &&
              (s.untilNextMin !== null ? ` · você tem ${fmtMin(s.untilNextMin)} até o próximo compromisso` : " · agenda livre pelo resto do dia")}
          </p>
        </div>
        <Button variant="primary" onClick={() => startFocus(uid, settings, item.task.id)}>
          ▶ Começar
        </Button>
      </div>
    </Card>
  );
}

export function DaySidebar({ m }: { m: DayMetrics }) {
  const { uid, tasks, sessions, date } = useStore();
  const [showDone, setShowDone] = useState(false);
  const isToday = date === todayKey();

  const queue = flexibleQueue(m);
  const scheduled = m.items.filter((i) => i.scheduled && !i.completed);
  const done = m.items.filter((i) => i.completed);
  const late = isToday ? overdue(date, tasks) : [];
  const goals = weeklyGoals(date, tasks, sessions);
  const box = inbox(tasks);
  const doneFor = (id: string) => sessions.filter((s) => s.taskId === id && s.date === date).reduce((a, s) => a + s.minutes, 0);

  const toDay = (id: string) => (
    <button onClick={() => updateTask(uid, id, { date })} className="rounded-md px-2 py-1 text-xs text-todo hover:bg-card" title="Planejar para este dia">
      {isToday ? "Hoje" : "Neste dia"}
    </button>
  );

  return (
    <div className="space-y-3">
      {isToday && <NowCard m={m} />}

      <Card>
        <SectionTitle right={<span className="text-xs text-muted">arraste para a agenda</span>}>Para fazer ({queue.length})</SectionTitle>
        <QuickAdd date={date} />
        <ul className="mt-2 space-y-0.5">
          {queue.map((i) => (
            <TaskRow key={i.task.id} task={i.task} date={date} estimateMin={i.estimateMin} doneMin={i.doneMin} dragMin={i.remainingMin} />
          ))}
        </ul>
        {queue.length === 0 && <p className="mt-2 text-sm text-muted">Nada sem horário. Use a caixa de entrada ou adicione acima.</p>}

        {scheduled.length > 0 && (
          <>
            <p className="mt-3 mb-1 text-xs font-medium text-muted">Na agenda</p>
            <ul className="space-y-0.5">
              {scheduled.map((i) => (
                <TaskRow key={i.task.id} task={i.task} date={date} estimateMin={i.estimateMin} doneMin={i.doneMin} completed={i.completed} checkable={i.task.repeat !== "weeklyGoal"} />
              ))}
            </ul>
          </>
        )}

        {done.length > 0 && (
          <button onClick={() => setShowDone((v) => !v)} className="mt-3 text-xs text-muted hover:text-ink">
            {showDone ? "▾" : "▸"} Concluídas ({done.length})
          </button>
        )}
        {showDone && (
          <ul className="space-y-0.5">
            {done.map((i) => (
              <TaskRow key={i.task.id} task={i.task} date={date} estimateMin={i.estimateMin} doneMin={i.doneMin} completed checkable={i.task.repeat !== "weeklyGoal"} />
            ))}
          </ul>
        )}
      </Card>

      {late.length > 0 && (
        <Card className="border-warn/40">
          <SectionTitle>Atrasadas ({late.length})</SectionTitle>
          <ul className="space-y-0.5">
            {late.map((t) => (
              <TaskRow key={t.id} task={t} date={date} estimateMin={t.estimateMin} doneMin={doneFor(t.id)} extra={toDay(t.id)} />
            ))}
          </ul>
        </Card>
      )}

      {goals.length > 0 && (
        <Card>
          <SectionTitle right={<span className="text-xs text-muted">arraste para reservar tempo</span>}>Metas da semana</SectionTitle>
          <ul className="space-y-0.5">
            {goals.map((g) => (
              <TaskRow
                key={g.task.id}
                task={g.task}
                date={date}
                estimateMin={g.goalMin}
                doneMin={g.doneMin}
                completed={g.remainingMin === 0}
                checkable={false}
                dragMin={g.remainingMin > 0 ? Math.min(g.remainingMin, 60) : undefined}
              />
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle>Caixa de entrada ({box.length})</SectionTitle>
        {box.length === 0 ? (
          <p className="text-sm text-muted">Tarefas avulsas sem dia aparecem aqui, ordenadas por prazo e prioridade.</p>
        ) : (
          <ul className={cx("space-y-0.5")}>
            {box.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                date={date}
                estimateMin={t.estimateMin}
                doneMin={doneFor(t.id)}
                dragMin={Math.max(15, t.estimateMin - doneFor(t.id))}
                extra={toDay(t.id)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
