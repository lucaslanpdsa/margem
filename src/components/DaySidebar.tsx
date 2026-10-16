"use client";

import { CalendarPlus, ChevronDown, Inbox, Plus, Repeat, Target, Timer, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { fmtMin, parseQuickAdd, todayKey } from "@/lib/dates";
import { addTask, updateTask } from "@/lib/db";
import { flexibleQueue, inbox, isTimeTask, overdue, suggestNow, weeklyGoals, type DayMetrics } from "@/lib/metrics";
import type { RepeatKind } from "@/lib/types";
import { useDialogs } from "./dialogs";
import { useNav } from "./nav";
import { useStore } from "./store";
import { TaskRow } from "./TaskRow";
import { useNow } from "./Timer";
import { Button, Panel, PanelHeader, cx, inputCls } from "./ui";

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
          placeholder="Adicionar tarefa, ex: Revisar PR 45min"
          aria-label="Adicionar tarefa rápida"
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {text && preview.minutes !== null ? (
          <>
            Enter para criar <b className="font-medium text-ink">{preview.title}</b> com <b className="font-medium text-ink">{fmtMin(preview.minutes)}</b> estimados.
          </>
        ) : text ? (
          "Sem tempo no final, abre o formulário completo ao apertar Enter."
        ) : (
          "Termine com a estimativa (30, 45min, 1h30) para criar direto."
        )}
      </p>
    </form>
  );
}

function NowCard({ m }: { m: DayMetrics }) {
  const { settings, blocks } = useStore();
  const { goFocus } = useNav();
  const now = useNow(30000);
  const s = suggestNow(new Date(now), m, blocks, settings.breaks);
  if (settings.activeTimer?.phase === "focus") return null;
  if (s.kind === "pause") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-break/15 px-5 py-4">
        <p className="text-sm">
          <b className="font-semibold">{s.pause.label}</b> até as {s.pause.end}. Esse tempo não conta no seu dia.
        </p>
      </div>
    );
  }
  const item = s.item;
  if (!item) return null;

  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const context =
    s.kind === "block" && s.block
      ? `Está na sua agenda até ${hhmm(s.block.end)}.`
      : s.untilNextMin !== null
        ? `Você tem ${fmtMin(s.untilNextMin)} até ${s.nextLabel}.`
        : "Nada marcado na agenda pelo resto do dia.";

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-todo px-5 py-4 text-white">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-white/75">{s.kind === "block" ? "Agora, pela sua agenda" : "Sugestão para agora"}</p>
        <p className="truncate text-lg font-semibold">{item.task.title}</p>
        <p className="text-[13px] text-white/75">
          Falta {fmtMin(item.remainingMin)}. {context}
        </p>
      </div>
      <button
        onClick={() => goFocus(item.task.id)}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-todo transition-opacity hover:opacity-90"
      >
        <Timer size={15} /> Focar nela
      </button>
    </div>
  );
}

const STARTERS: { repeat: RepeatKind; icon: typeof Repeat; title: string; text: string }[] = [
  { repeat: "weekdays", icon: Repeat, title: "Algo que se repete", text: "Ex: estudar 1h toda segunda, quarta e sexta." },
  { repeat: "weeklyGoal", icon: Target, title: "Uma meta da semana", text: "Ex: 5h de inglês, no dia que der." },
  { repeat: "once", icon: CalendarPlus, title: "Algo só uma vez", text: "Ex: entregar o relatório até sexta." },
];

function Starters({ date }: { date: string }) {
  const { editTask } = useDialogs();
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {STARTERS.map((s) => (
        <button
          key={s.repeat}
          onClick={() => editTask({ repeat: s.repeat, date: s.repeat === "once" ? date : undefined })}
          className="rounded-xl border border-dashed border-line p-3 text-left transition-colors hover:border-todo hover:bg-todo/[0.03]"
        >
          <s.icon size={18} className="text-todo" />
          <p className="mt-2 text-sm font-medium">{s.title}</p>
          <p className="mt-0.5 text-xs text-muted">{s.text}</p>
        </button>
      ))}
    </div>
  );
}

export function DayLists({ m }: { m: DayMetrics }) {
  const { uid, tasks, sessions, blocks, date } = useStore();
  const [showDone, setShowDone] = useState(false);
  const isToday = date === todayKey();

  const queue = flexibleQueue(m);
  const scheduled = m.items.filter((i) => i.scheduled && !i.completed && !i.outside);
  const extras = m.items.filter((i) => i.outside && !i.completed);
  const blockTime = (taskId: string) => {
    const b = blocks.filter((x) => x.taskId === taskId && x.date === date).sort((x, y) => x.start.localeCompare(y.start))[0];
    return b ? new Date(b.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  };
  const done = m.items.filter((i) => i.completed);
  const late = isToday ? overdue(date, tasks) : [];
  const goals = weeklyGoals(date, tasks, sessions);
  const box = inbox(tasks);
  const doneFor = (id: string) => sessions.filter((s) => s.taskId === id && s.date === date).reduce((a, s) => a + s.minutes, 0);
  const firstUse = tasks.filter((t) => !t.archived).length === 0;

  const toDay = (id: string) => (
    <Button size="sm" variant="ghost" onClick={() => updateTask(uid, id, { date })} title="Planejar para este dia" className="text-todo">
      {isToday ? "Fazer hoje" : "Neste dia"}
    </Button>
  );

  return (
    <div className="space-y-4">
      {isToday && <NowCard m={m} />}

      <Panel>
        <PanelHeader
          title={isToday ? "Tarefas de hoje" : "Tarefas do dia"}
          description="Na ordem sugerida: prazo mais perto primeiro, depois prioridade. Arraste para a agenda para marcar horário."
        />
        <div className="space-y-3 px-5 pb-5">
          <QuickAdd date={date} />

          {firstUse ? (
            <div className="pt-2">
              <p className="mb-2 text-sm text-muted">Ou comece pelo que faz parte da sua rotina:</p>
              <Starters date={date} />
            </div>
          ) : (
            <>
              {queue.length > 0 ? (
                <ul className="space-y-1.5">
                  {queue.map((i) => (
                    <TaskRow key={i.task.id} task={i.task} date={date} estimateMin={i.estimateMin} doneMin={i.doneMin} dragMin={i.remainingMin} checkable={!isTimeTask(i.task)} />
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-muted">
                  {m.items.length === 0 ? "Nenhuma tarefa neste dia ainda." : "Tudo que sobrou já está com horário na agenda."}
                </p>
              )}

              {scheduled.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-muted">Com horário na agenda</p>
                  <ul className="space-y-1.5">
                    {scheduled.map((i) => (
                      <TaskRow
                        key={i.task.id}
                        task={i.task}
                        date={date}
                        estimateMin={i.estimateMin}
                        doneMin={i.doneMin}
                        completed={i.completed}
                        checkable={!isTimeTask(i.task)}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {extras.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-muted">Fora do seu horário (extra, não ocupa o tempo do dia)</p>
                  <ul className="space-y-1.5">
                    {extras.map((i) => (
                      <TaskRow
                        key={i.task.id}
                        task={i.task}
                        date={date}
                        estimateMin={i.estimateMin}
                        doneMin={i.doneMin}
                        checkable={!isTimeTask(i.task)}
                        extra={i.task.time ? undefined : <span className="tabular rounded-md bg-break/15 px-2 py-1 text-xs font-medium text-break">{blockTime(i.task.id)}</span>}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {done.length > 0 && (
                <div>
                  <button onClick={() => setShowDone((v) => !v)} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
                    <ChevronDown size={14} className={cx("transition-transform", !showDone && "-rotate-90")} />
                    Concluídas ({done.length})
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
                          completed
                          checkable={!isTimeTask(i.task)}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Panel>

      {late.length > 0 && (
        <Panel className="border-over/30">
          <PanelHeader
            title={`Atrasadas (${late.length})`}
            description="Eram para dias que já passaram. Traga para hoje ou edite a data."
            right={<TriangleAlert size={18} className="text-over" />}
          />
          <ul className="space-y-1.5 px-5 pb-5">
            {late.map((t) => (
              <TaskRow key={t.id} task={t} date={date} estimateMin={t.estimateMin} doneMin={doneFor(t.id)} extra={toDay(t.id)} />
            ))}
          </ul>
        </Panel>
      )}

      {goals.length > 0 && (
        <Panel>
          <PanelHeader
            title="Metas da semana"
            description="Não têm dia certo. Arraste para a agenda quando quiser reservar um tempo para elas."
            right={<Target size={18} className="text-todo" />}
          />
          <ul className="space-y-1.5 px-5 pb-5">
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
        </Panel>
      )}

      {(box.length > 0 || !firstUse) && (
        <Panel>
          <PanelHeader
            title={`Caixa de entrada (${box.length})`}
            description="Tarefas sem dia definido. Traga para um dia quando tiver espaço."
            right={<Inbox size={18} className="text-muted" />}
          />
          <div className="px-5 pb-5">
            {box.length === 0 ? (
              <p className="text-sm text-muted">Vazia. Ao criar uma tarefa avulsa sem data, ela fica aqui.</p>
            ) : (
              <ul className="space-y-1.5">
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
          </div>
        </Panel>
      )}
    </div>
  );
}
