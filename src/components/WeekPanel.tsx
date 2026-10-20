"use client";

import { Flame, Play } from "lucide-react";
import { useState } from "react";
import { WEEKDAY_SHORT, fmtMin, fromKey, todayKey, weekDays, weekdayOf } from "@/lib/dates";
import { streak, taskWeek, weekHistory, type TaskWeek } from "@/lib/week";
import type { Task } from "@/lib/types";
import { ProLocked, usePlan } from "./Pro";
import { useStore } from "./store";
import { useTimerActions } from "./toast";
import { Button, Modal, Panel, cx } from "./ui";

/** Tarefas que repetem com plano na semana do dia aberto, e como está cada uma. */
export function useWeekItems() {
  const { tasks, sessions, date } = useStore();
  const today = todayKey();
  return tasks
    .filter((t) => t.repeat === "weekdays" && !t.archived)
    .map((task) => ({ task, week: taskWeek(task, date, sessions, today) }))
    .filter((x) => x.week.plannedMin > 0);
}

/** Status curto: atrasada, cumprida ou em dia. */
function status(w: TaskWeek) {
  if (w.leftMin === 0) return { text: "semana cumprida", cls: "text-done" };
  if (w.behindMin > 0) return { text: `${fmtMin(w.behindMin)} atrasado`, cls: "text-break" };
  return { text: "em dia", cls: "text-muted" };
}

/**
 * "Esta semana" no Dia: a meta da semana de cada tarefa que repete (soma do planejado nos dias dela),
 * o registrado e o atraso. Tocar abre a constância da tarefa.
 */
export function WeekPanel() {
  const { date } = useStore();
  const items = useWeekItems();
  const [open, setOpen] = useState<Task | null>(null);
  const plan = usePlan();
  if (!items.length) return null;
  if (!plan.pro)
    return <ProLocked title="Esta semana" text="Veja a meta da semana de cada tarefa que repete, quanto ficou para trás e quantos dias seguidos você cumpriu." />;
  const days = weekDays(date);
  const isThisWeek = days.includes(todayKey());
  const weekend = isThisWeek && [0, 6].includes(weekdayOf(todayKey()));
  const left = items.reduce((a, x) => a + x.week.leftMin, 0);

  return (
    <Panel className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{isThisWeek ? "Esta semana" : "Semana"}</h2>
        <span className="tabular text-xs text-muted">
          {fromKey(days[0]).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}–
          {fromKey(days[6]).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
        </span>
      </div>
      {/* Fim de semana: hora de fechar o que ficou da semana. */}
      {weekend && left > 0 && (
        <p className="mt-1 text-[13px] text-muted">
          Para fechar a semana faltam <b className="tabular font-semibold text-ink">{fmtMin(left)}</b> até domingo.
        </p>
      )}
      <ul className="mt-3 space-y-1">
        {items.map(({ task, week }) => {
          const st = status(week);
          const pct = Math.min(100, (week.doneMin / week.plannedMin) * 100);
          return (
            <li key={task.id}>
              <button onClick={() => setOpen(task)} className="-mx-2 w-[calc(100%+1rem)] rounded-lg px-2 py-2 text-left hover:bg-sunken">
                <span className="flex items-baseline gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                  <span className="tabular shrink-0 text-xs text-muted">
                    <b className="font-semibold text-ink">{fmtMin(week.doneMin)}</b> de {fmtMin(week.plannedMin)}
                  </span>
                </span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <span className={cx("block h-full rounded-full", week.behindMin > 0 ? "bg-break" : "bg-done")} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={cx("tabular shrink-0 text-xs font-medium", st.cls)}>{st.text}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && <ConsistencyDialog task={open} onClose={() => setOpen(null)} />}
    </Panel>
  );
}

/** Constância de uma tarefa: dias seguidos, a semana dia a dia e as últimas semanas. */
function ConsistencyDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { sessions, date } = useStore();
  const timer = useTimerActions();
  const today = todayKey();
  const week = taskWeek(task, date, sessions, today);
  const history = weekHistory(task, sessions, today, 5);
  const loadedSince = sessions.reduce((a, s) => (s.date < a ? s.date : a), today);
  const days = streak(task, sessions, today, history[0].start < loadedSince ? history[0].start : loadedSince);
  const max = Math.max(1, ...history.map((h) => Math.max(h.plannedMin, h.doneMin)));

  return (
    <Modal title={task.title} description="Meta da semana = soma do tempo planejado em cada dia da tarefa." onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-sunken p-3">
          <p className="text-[13px] text-muted">Dias seguidos</p>
          <p className="tabular mt-0.5 flex items-center gap-1.5 text-2xl font-semibold">
            {days > 0 && <Flame size={20} className="text-break" />}
            {days}
          </p>
        </div>
        <div className="rounded-xl bg-sunken p-3">
          <p className="text-[13px] text-muted">Esta semana</p>
          <p className="tabular mt-0.5 text-2xl font-semibold">
            {fmtMin(week.doneMin)}
            <span className="text-base font-normal text-muted"> de {fmtMin(week.plannedMin)}</span>
          </p>
        </div>
      </div>

      {/* A semana dia a dia: verde cumprido, laranja ficou para trás, cinza ainda vai acontecer. */}
      <p className="mt-5 mb-2 text-[13px] font-medium">Dia a dia</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {week.days.map((d) => {
          const missed = d.plannedMin > 0 && !d.met && d.date < today;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <span className={cx("text-[11px]", d.date === today ? "font-semibold text-ink" : "text-muted")}>{WEEKDAY_SHORT[weekdayOf(d.date)]}</span>
              <span
                className={cx(
                  "grid h-9 w-full place-items-center rounded-md text-[11px] font-semibold tabular",
                  d.plannedMin === 0 ? "text-muted/50" : d.met ? "bg-done/15 text-done" : missed ? "bg-break/15 text-break" : "bg-sunken text-muted",
                )}
              >
                {d.plannedMin === 0 ? "–" : d.doneMin ? fmtMin(d.doneMin) : "0"}
              </span>
            </div>
          );
        })}
      </div>
      {week.behindMin > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-break/[0.08] px-3 py-2.5 text-[13px]">
          <span className="min-w-0 flex-1">
            <b className="tabular font-semibold">{fmtMin(week.behindMin)}</b> ficaram para trás nesta semana.
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              timer.start(task.id);
              onClose();
            }}
          >
            <Play size={12} fill="currentColor" /> Recuperar
          </Button>
        </div>
      )}

      <p className="mt-5 mb-2 text-[13px] font-medium">Últimas semanas</p>
      <ul className="space-y-1.5">
        {history.map((h) => (
          <li key={h.start} className="flex items-center gap-3 text-xs">
            <span className="tabular w-12 shrink-0 text-muted">{fromKey(h.start).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
              {/* Marca do planejado e barra do registrado na mesma escala. */}
              <span className="absolute inset-y-0 left-0 rounded-full bg-todo/20" style={{ width: `${(h.plannedMin / max) * 100}%` }} />
              <span
                className={cx("absolute inset-y-0 left-0 rounded-full", h.doneMin >= h.plannedMin ? "bg-done" : "bg-todo")}
                style={{ width: `${(h.doneMin / max) * 100}%` }}
              />
            </span>
            <span className="tabular w-24 shrink-0 text-right">
              <b className="font-semibold">{fmtMin(h.doneMin)}</b> <span className="text-muted">de {fmtMin(h.plannedMin)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">As semanas antigas usam os dias e o tempo atuais da tarefa.</p>
    </Modal>
  );
}
