"use client";

import { CalendarDays, Check, Pencil, Play, Plus, SkipForward, Square, Timer as TimerIcon, Undo2 } from "lucide-react";
import { useState } from "react";
import { dayName, fmtMin, fromKey, todayKey } from "@/lib/dates";
import { setDayEstimate, setSkipped, toggleDone, updateTask } from "@/lib/db";
import { isCompletedOn, isSkippedOn, isTimeTask } from "@/lib/metrics";
import { timerDisplay, useNow } from "./Timer";
import { useTimerActions, useToast } from "./toast";
import { DayMenu } from "./DayMenu";
import { AddTime, TaskEntries } from "./TimeEntries";
import { TimerStart } from "./TimerStart";
import { useDialogs } from "./dialogs";
import type { Task } from "@/lib/types";
import { useStore } from "./store";
import { Button, Modal } from "./ui";


/** A "página" da tarefa: quanto já foi reportado hoje, atalhos para reportar, concluir e editar. */
export function LogTimeForm({ task, onClose }: { task: Task; onClose: () => void }) {
  const { uid, date, sessions, settings } = useStore();
  const { editTask } = useDialogs();
  const timer = useTimerActions();
  const toast = useToast();
  const [moving, setMoving] = useState(false);
  // "Adicionar tempo já feito" recolhido, para a janela ficar curta; aberto se não dá para começar timer.
  const [adding, setAdding] = useState(false);
  const timeTask = isTimeTask(task);
  const skipped = isSkippedOn(task, date);
  const completed = !timeTask && !skipped && isCompletedOn(task, date);

  // Feito neste dia, com o timer rodando incluído.
  const logged = sessions.filter((s) => s.taskId === task.id && s.date === date).reduce((a, s) => a + s.minutes, 0);
  const t = settings.activeTimer;
  const running = !!t && t.taskId === task.id && t.phase === "focus" && !t.waiting;
  const canStart = !completed && !skipped;

  async function start(mode: "stopwatch" | "pomodoro") {
    await timer.start(task.id, mode);
    onClose();
  }
  const total = logged;
  const dayLabel = date === todayKey() ? "hoje" : `em ${fromKey(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  // Tempo deste dia (pode ter sido encurtado só hoje).
  const est = task.estimateFor?.[date] ?? task.estimateMin;


  return (
    <Modal
      title={task.title}
      onClose={onClose}
      action={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onClose();
            editTask(task);
          }}
        >
          <Pencil size={14} /> Editar
        </Button>
      }
    >
      <div className="mb-5 rounded-xl bg-sunken p-4">
        <p className="text-[13px] text-muted">Feito {dayLabel}</p>
        <p className="tabular mt-0.5 text-2xl font-semibold">
          {fmtMin(total)}
          {est > 0 && <span className="text-base font-normal text-muted"> de {fmtMin(est)}</span>}
        </p>
        {est > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-done" style={{ width: `${Math.min(100, (total / est) * 100)}%` }} />
          </div>
        )}
        {task.estimateFor?.[date] !== undefined && (
          <p className="mt-2 text-xs text-muted">
            Encurtada só neste dia (normal {fmtMin(task.estimateMin)}).{" "}
            <button onClick={() => setDayEstimate(uid, task, date, null)} className="font-medium text-accent hover:underline">
              Voltar ao normal
            </button>
          </p>
        )}
        {/* Ações do dia dentro do resumo: ficam juntas e perto do número. */}
        {(!completed || !timeTask) && (
        <div className="-mx-1 mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-2">
          {task.repeat === "weekdays" && !completed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSkipped(uid, task, date, !skipped);
                toast(skipped ? `${task.title}: pulo desfeito` : `${task.title} pulada ${dayLabel}`, { tone: "info", undo: () => setSkipped(uid, task, date, skipped) });
                onClose();
              }}
            >
              {skipped ? <Undo2 size={14} /> : <SkipForward size={14} />} {skipped ? "Desfazer pulo" : `Pular ${dayLabel}`}
            </Button>
          )}
          {task.repeat === "once" && !completed && (
            <div className="relative">
              <Button size="sm" variant="ghost" onClick={() => setMoving((v) => !v)} aria-expanded={moving}>
                <CalendarDays size={14} /> Mudar dia
              </Button>
              {moving && (
                <DayMenu
                  align="left"
                  value={task.date ?? todayKey()}
                  onClose={() => setMoving(false)}
                  onPick={async (d) => {
                    setMoving(false);
                    if (d === (task.date ?? todayKey())) return;
                    const before = task.date ?? todayKey();
                    await updateTask(uid, task.id, { date: d });
                    toast(`${task.title} foi para ${dayName(d).toLowerCase()}`, { tone: "info", undo: () => updateTask(uid, task.id, { date: before }) });
                    onClose();
                  }}
                />
              )}
            </div>
          )}
          {!timeTask && !skipped && (
            <Button
              size="sm"
              className="ml-auto"
              variant={completed ? "ghost" : "secondary"}
              onClick={() => {
                toggleDone(uid, task, date, !completed);
                if (!completed) toast(`${task.title} concluída`, { undo: () => toggleDone(uid, task, date, false) });
                onClose();
              }}
            >
              <Check size={15} /> {completed ? "Reabrir" : "Concluir"}
            </Button>
          )}
        </div>
        )}
      </div>

      {running ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-todo/40 bg-todo/[0.05] p-3">
          <TimerIcon size={18} className="shrink-0 text-todo" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">{t?.mode === "stopwatch" ? "Cronômetro rodando" : "Pomodoro rodando"}</span>
            <LiveClock />
            <TimerStart className="mt-0.5 block" />
          </span>
          <Button variant="primary" onClick={() => timer.stop()}>
            <Square size={12} fill="currentColor" /> Parar
          </Button>
        </div>
      ) : (
        canStart && (
          <>
            <p className="mb-2 text-[13px] font-medium">Começar agora</p>
            <div className="mb-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => start("stopwatch")}
                className="flex h-14 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-brand-ink hover:bg-brand/90"
              >
                <Play size={15} fill="currentColor" /> Cronômetro
              </button>
              <button
                onClick={() => start("pomodoro")}
                className="flex h-14 items-center justify-center gap-2 rounded-xl border border-line font-semibold text-ink hover:bg-sunken"
              >
                <TimerIcon size={16} /> Pomodoro {settings.focusMin}min
              </button>
            </div>
          </>
        )
      )}

      {adding ? (
        <>
          <p className="mb-2 text-[13px] font-medium">Adicionar tempo já feito</p>
          <AddTime task={task} defaultDate={date} onDone={onClose} />
        </>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}>
          <Plus size={14} /> Adicionar tempo já feito
        </Button>
      )}

      <div className="mt-5 border-t border-line pt-3">
        <p className="mb-1 text-[13px] font-medium">Registros</p>
        <TaskEntries task={task} />
      </div>

    </Modal>
  );
}

function LiveClock() {
  const { settings } = useStore();
  const now = useNow();
  const t = settings.activeTimer;
  if (!t) return null;
  return <span className="tabular block text-xl font-semibold">{timerDisplay(t, now).text}</span>;
}
