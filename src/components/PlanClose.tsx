"use client";

import { CalendarCheck, Moon, Sunrise } from "lucide-react";
import { useState } from "react";
import { daySnapshot } from "@/lib/closing";
import { dayName, fmtMin, shiftDay, todayKey } from "@/lib/dates";
import { closeDay, deleteTask, moveToDay, moveToLater, replaceTask, restoreTaskPlace, setDayPlanned, setSkipped } from "@/lib/db";
import { dayMetrics, isReminder, tracksTime, type DayItem, type DayMetrics } from "@/lib/metrics";
import { orderItems } from "@/lib/queue";
import { toMin } from "@/lib/schedule";
import type { Task } from "@/lib/types";
import { LaterRow, ReminderRow, laterTasks } from "./Later";
import { useStore } from "./store";
import { useNow } from "./Timer";
import { useToast } from "./toast";
import { Button, Modal, cx } from "./ui";

/** O que cabe e o que passa, na linha que decide: "Dá tempo: sobram 40min" / "Passou 1h: tire algo". */
function verdict(m: DayMetrics) {
  const room = Math.max(0, m.capacityMin - Math.max(m.doneMin, m.elapsedMin));
  const excess = Math.max(0, m.remainingMin - room);
  if (!m.window) return { text: "Hoje sem horário", detail: "Sem horário para tarefas hoje.", over: false };
  return excess > 0
    ? { text: `Passou ${fmtMin(excess)}: tire algo`, detail: `Você tem ${fmtMin(m.remainingMin)} de tarefas e ${fmtMin(room)} até as ${m.window.end}.`, over: true }
    : { text: `Dá tempo: sobram ${fmtMin(m.freeMin)}`, detail: `Você tem ${fmtMin(room)} até as ${m.window.end}, e ${fmtMin(m.remainingMin)} de tarefas.`, over: false };
}

/** Tarefas abertas de hoje que ocupam horas (sem lembretes nem extra), na ordem da fila. */
function openItems(m: DayMetrics, order: string[] | undefined, blocks: Parameters<typeof orderItems>[2]): DayItem[] {
  return orderItems(
    m.items.filter((i) => !i.completed && !i.skipped && !i.outside && !i.block && !isReminder(i.task)),
    order,
    blocks,
    m.date,
  );
}

// ---------------- Planejar o dia ----------------

/**
 * Cartão da manhã: aparece hoje até você planejar (ou escolher "Agora não").
 * É o momento em que o "dá tempo?" ajuda a decidir, antes de começar.
 */
export function PlanDayCard({ m }: { m: DayMetrics }) {
  const { uid, days, tasks } = useStore();
  const [open, setOpen] = useState(false);
  const today = todayKey();
  if (m.date !== today || !m.window || m.ended || days[today]?.plannedAt) return open ? <PlanDayDialog onClose={() => setOpen(false)} /> : null;
  const waiting = laterTasks(tasks).length;
  return (
    <div className="mt-4 rounded-xl border border-brand/30 bg-brand/[0.05] px-4 py-3">
      <div className="flex items-start gap-3">
        <Sunrise size={18} className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Planeje o dia (2 min)</p>
          <p className="mt-0.5 text-[13px] text-muted">
            Escolha o que entra hoje{waiting ? ` (${waiting} em Depois)` : ""} e veja se cabe antes de começar.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
              Planejar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDayPlanned(uid, today)}>
              Agora não
            </Button>
          </div>
        </div>
      </div>
      {open && <PlanDayDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

/** Uma tela só: o veredito ao vivo, o que já está hoje (tirar) e o que está em Depois (trazer, tempo num toque). */
export function PlanDayDialog({ onClose }: { onClose: () => void }) {
  const { uid, tasks, blocks, sessions, settings, days } = useStore();
  const toast = useToast();
  const now = new Date(useNow(60000));
  const today = todayKey();
  const m = dayMetrics(today, settings, tasks, blocks, sessions, now, days[today]);
  const v = verdict(m);
  const open = openItems(m, days[today]?.order, blocks);
  const reminders = m.items.filter((i) => isReminder(i.task)).map((i) => i.task);
  const later = laterTasks(tasks);

  const takeOut = (t: Task) => {
    if (t.repeat === "weekdays") {
      setSkipped(uid, t, today, true);
      toast(`${t.title} pulada hoje`, { tone: "info", undo: () => setSkipped(uid, t, today, false) });
    } else {
      moveToLater(uid, t);
      toast(`${t.title} foi para Depois`, { tone: "info", undo: () => restoreTaskPlace(uid, t) });
    }
  };

  return (
    <Modal title="Planejar o dia" onClose={onClose} wide>
      <div className={cx("rounded-xl px-4 py-3", v.over ? "bg-over/10" : "bg-done/10")}>
        <p className={cx("tabular text-lg font-semibold", v.over ? "text-over" : "text-done")}>{v.text}</p>
        <p className="mt-0.5 text-[13px] text-muted">{v.detail}</p>
      </div>

      <h3 className="mt-5 mb-2 text-[13px] font-semibold text-muted">Hoje · na ordem da fila</h3>
      {open.length ? (
        <ul className="space-y-1">
          {open.map((i) => (
            <li key={i.task.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{i.task.title}</span>
              <span className="tabular shrink-0 text-xs text-muted">{fmtMin(i.remainingMin)}</span>
              {/* Trabalho por tempo não sai do dia por aqui: encurtar é em "Como dar tempo". */}
              {i.task.doneBy !== "time" && (
                <button onClick={() => takeOut(i.task)} className="shrink-0 text-[13px] font-medium text-accent hover:underline">
                  {i.task.repeat === "weekdays" ? "Pular hoje" : "Tirar"}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nada ainda. Traga algo de Depois.</p>
      )}

      {reminders.length > 0 && (
        <>
          <h3 className="mt-4 mb-1 text-[13px] font-semibold text-muted">Lembretes de hoje</h3>
          <ul>
            {reminders.map((t) => (
              <ReminderRow key={t.id} task={t} />
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-5 mb-2 text-[13px] font-semibold text-muted">Em Depois · traga o que cabe</h3>
      {later.length ? (
        <ul className="space-y-1.5">
          {later.map((t) => (
            <LaterRow key={t.id} task={t} compact />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Depois está vazio.</p>
      )}

      <div className="mt-5 flex justify-end">
        <Button
          variant="primary"
          onClick={() => {
            setDayPlanned(uid, today);
            onClose();
          }}
        >
          <CalendarCheck size={15} /> Pronto
        </Button>
      </div>
    </Modal>
  );
}

// ---------------- Fechar o dia ----------------

/** Cartão da noite: depois do fim do horário, até você fechar o dia. */
export function CloseDayCard({ m }: { m: DayMetrics }) {
  const { days } = useStore();
  const now = useNow(60000);
  const [open, setOpen] = useState(false);
  const today = todayKey();
  // Uma hora antes do fim do seu dia (ou depois dele): com o "Seu dia" até as 23h, ninguém espera até lá.
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const late = m.ended || nowMin >= toMin(m.window?.end ?? "24:00") - 60;
  if (m.date !== today || !m.window || !late || days[today]?.closedAt) return null;
  const left = m.items.filter((i) => !i.completed && !i.skipped && i.task.repeat === "once").length;
  return (
    <div className="mt-4 rounded-xl border border-line bg-sunken px-4 py-3">
      <div className="flex items-start gap-3">
        <Moon size={18} className="mt-0.5 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Feche o dia (1 min)</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {left ? `${left === 1 ? "1 tarefa ficou" : `${left} tarefas ficaram`} abertas: decida para onde vão e durma sem nada solto.` : "Tudo decidido hoje. Feche para guardar como foi o dia."}
          </p>
          <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => setOpen(true)}>
            Fechar o dia
          </Button>
        </div>
      </div>
      {open && <CloseDayDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

/** O que sobrou de hoje vai para amanhã, Depois ou é excluído; termina mostrando como amanhã começa. */
export function CloseDayDialog({ onClose }: { onClose: () => void }) {
  const { uid, tasks, blocks, sessions, settings, days } = useStore();
  const toast = useToast();
  const now = new Date(useNow(60000));
  const today = todayKey();
  const tomorrow = shiftDay(today, 1);
  const m = dayMetrics(today, settings, tasks, blocks, sessions, now, days[today]);
  // A fotografia é de quando a janela abriu: mover as sobras muda o planejado de hoje.
  const [snap] = useState(() => daySnapshot(m));
  const [counts] = useState(() => {
    const c = m.items.filter((i) => !i.skipped && !i.outside && !i.block && !isReminder(i.task));
    return { done: c.filter((i) => i.completed).length, total: c.length };
  });
  const leftovers = m.items.filter((i) => !i.completed && !i.skipped && i.task.repeat === "once").map((i) => i.task);
  const next = dayMetrics(tomorrow, settings, tasks, blocks, sessions, now, days[tomorrow]);
  const nextTasks = next.items.filter((i) => !i.skipped && !i.outside && !i.block && i.estimateMin > 0);

  const send = (t: Task, where: "amanha" | "depois" | "excluir") => {
    if (where === "amanha") {
      moveToDay(uid, t, tomorrow);
      toast(`${t.title} foi para amanhã`, { tone: "info", undo: () => restoreTaskPlace(uid, t) });
    } else if (where === "depois") {
      moveToLater(uid, t);
      toast(`${t.title} foi para Depois`, { tone: "info", undo: () => restoreTaskPlace(uid, t) });
    } else {
      deleteTask(uid, t.id);
      toast(`${t.title} excluída`, { undo: () => replaceTask(uid, t) });
    }
  };

  return (
    <Modal title="Fechar o dia" onClose={onClose} wide>
      <p className="text-sm">
        {tracksTime(settings) ? (
          <>
            Hoje: planejado <b className="tabular">{fmtMin(snap.plannedMin)}</b>, feito <b className="tabular">{fmtMin(snap.doneMin)}</b>.
          </>
        ) : (
          <>
            Hoje: <b className="tabular">{counts.done}</b> de <b className="tabular">{counts.total}</b> tarefas feitas.
          </>
        )}
      </p>

      <h3 className="mt-4 mb-2 text-[13px] font-semibold text-muted">O que sobrou</h3>
      {leftovers.length ? (
        <ul className="space-y-1">
          {leftovers.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span className="flex shrink-0 gap-3 text-[13px] font-medium">
                <button onClick={() => send(t, "amanha")} className="text-accent hover:underline">
                  Amanhã
                </button>
                <button onClick={() => send(t, "depois")} className="text-accent hover:underline">
                  Depois
                </button>
                <button onClick={() => send(t, "excluir")} className="text-muted hover:text-over">
                  Excluir
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nada solto. As tarefas que repetem voltam sozinhas no próximo dia delas.</p>
      )}

      <p className="mt-4 rounded-xl bg-sunken px-4 py-3 text-sm">
        {nextTasks.length ? (
          <>
            {dayName(tomorrow)} já começa com <b className="tabular">{nextTasks.length}</b> {nextTasks.length === 1 ? "tarefa" : "tarefas"} e{" "}
            <b className="tabular">{fmtMin(next.plannedMin)}</b>
            {next.window && next.plannedMin > next.capacityMin ? <span className="text-over"> (passa do horário)</span> : null}.
          </>
        ) : (
          <>{dayName(tomorrow)} começa livre.</>
        )}
      </p>

      <div className="mt-5 flex justify-end">
        <Button
          variant="primary"
          onClick={() => {
            closeDay(uid, today, snap);
            toast("Dia fechado. Até amanhã.", { tone: "info" });
            onClose();
          }}
        >
          <Moon size={15} /> Fechar o dia
        </Button>
      </div>
    </Modal>
  );
}
