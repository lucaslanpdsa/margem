"use client";

import { Check, Pencil, Play, SkipForward, Square, Timer as TimerIcon, Undo2 } from "lucide-react";
import { useState } from "react";
import { entryTimes, fmtMin, parseTimeEntry, type TimeEntry } from "@/lib/dates";
import { addSession, setSkipped, toggleDone } from "@/lib/db";
import { isCompletedOn, isSkippedOn, isTimeTask, slotMinutesPassed } from "@/lib/metrics";
import { windowFor } from "@/lib/schedule";
import { isLive, startTimer, stopTimer } from "@/lib/pomodoro";
import { timerDisplay, useNow } from "./Timer";
import { useDialogs } from "./dialogs";
import { RecordTime } from "./EditableMinutes";
import type { Session, Task } from "@/lib/types";
import { useStore } from "./store";
import { Button, Modal, cx, inputCls } from "./ui";

const QUICK = [15, 30, 60, 120];

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
/** "14:00–15:30" quando o registro tem horário; senão, de onde veio. */
const recordLabel = (s: Session) =>
  s.endedAt > s.startedAt ? `${hhmm(s.startedAt)}–${hhmm(s.endedAt)}${s.kind === "manual" ? "" : " · foco"}` : "Sem horário";

/** A "página" da tarefa: quanto já foi reportado hoje, atalhos para reportar, concluir e editar. */
export function LogTimeForm({ task, onClose }: { task: Task; onClose: () => void }) {
  const { uid, date, sessions, settings } = useStore();
  const { editTask } = useDialogs();
  const timeTask = isTimeTask(task);
  const skipped = isSkippedOn(task, date);
  const completed = !timeTask && !skipped && isCompletedOn(task, date);
  const [other, setOther] = useState("");
  const [error, setError] = useState("");

  const mine = sessions.filter((s) => s.taskId === task.id && s.date === date);
  // O timer rodando entra no total, mas não na lista de registros (ainda não é um registro).
  const list = mine.filter((s) => !isLive(s)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const logged = mine.reduce((a, s) => a + s.minutes, 0);
  const t = settings.activeTimer;
  const running = !!t && t.taskId === task.id && t.phase === "focus" && !t.waiting;
  const canStart = !completed && !skipped;

  async function start(mode: "stopwatch" | "pomodoro") {
    await startTimer(uid, settings, task.id, mode);
    onClose();
  }
  // Sem registro, tarefa com horário conta sozinha o horário que já passou.
  const auto = logged > 0 || skipped ? 0 : slotMinutesPassed(task, date, windowFor(settings, date), settings.breaks, new Date());
  const total = logged || auto;

  async function register(entry: TimeEntry) {
    await addSession(uid, { taskId: task.id, date, minutes: entry.minutes, kind: "manual", ...entryTimes(entry, date) });
    onClose();
  }

  return (
    <Modal title={task.title} onClose={onClose}>
      <div className="mb-5 rounded-xl bg-sunken p-4">
        <p className="text-[13px] text-muted">{auto > 0 ? "Contado pelo horário" : "Feito neste dia"}</p>
        <p className="tabular mt-0.5 text-2xl font-semibold">
          {fmtMin(total)}
          {task.estimateMin > 0 && <span className="text-base font-normal text-muted"> de {fmtMin(task.estimateMin)}</span>}
        </p>
        {task.estimateMin > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-done" style={{ width: `${Math.min(100, (total / task.estimateMin) * 100)}%` }} />
          </div>
        )}
        {auto > 0 && <p className="mt-2 text-xs text-muted">O horário da tarefa conta sozinho. Se registrar tempo, vale o registrado.</p>}
      </div>

      {running ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-todo/40 bg-todo/[0.05] p-3">
          <TimerIcon size={18} className="shrink-0 text-todo" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">{t?.mode === "stopwatch" ? "Cronômetro rodando" : "Pomodoro rodando"}</span>
            <LiveClock />
          </span>
          <Button variant="primary" onClick={() => stopTimer(uid, settings)}>
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
                className="flex h-14 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white hover:bg-brand/90"
              >
                <Play size={15} fill="currentColor" /> Cronômetro
              </button>
              <button
                onClick={() => start("pomodoro")}
                className="flex h-14 items-center justify-center gap-2 rounded-xl border border-todo/40 font-semibold text-todo hover:bg-todo/[0.06]"
              >
                <TimerIcon size={16} /> Pomodoro {settings.focusMin}min
              </button>
            </div>
          </>
        )
      )}

      <p className="mb-2 text-[13px] font-medium">Adicionar tempo já feito</p>
      <div className="grid grid-cols-4 gap-2">
        {QUICK.map((m) => (
          <button
            key={m}
            onClick={() => register({ minutes: m })}
            className="h-14 rounded-xl border border-line text-base font-semibold transition-colors hover:border-todo hover:bg-todo/[0.06] hover:text-todo"
          >
            {m < 60 ? `${m}m` : `${m / 60}h`}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const entry = parseTimeEntry(other);
          if (!entry) return setError("Escreva a duração (45m, 1h30) ou o horário (14:00-15:30).");
          register(entry);
        }}
      >
        <input className={cx(inputCls, "h-11")} value={other} onChange={(e) => setOther(e.target.value)} placeholder="45m, 1h30 ou 14:00-15:30" aria-label="Outro valor" />
        <Button type="submit" variant="primary" className="h-11">
          Adicionar
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-over">{error}</p>}

      {list.length > 0 && (
        <div className="mt-5 border-t border-line pt-3">
          <p className="mb-1 text-[13px] font-medium">Registros</p>
          <ul className="divide-y divide-line">
            {list.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-muted">
                  {recordLabel(s)}
                </span>
                <RecordTime session={s} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Button
          variant="ghost"
          onClick={() => {
            onClose();
            editTask(task);
          }}
        >
          <Pencil size={14} /> Editar tarefa
        </Button>
        {task.repeat === "weekdays" && !completed && (
          <Button
            variant="ghost"
            onClick={() => {
              setSkipped(uid, task, date, !skipped);
              onClose();
            }}
          >
            {skipped ? <Undo2 size={14} /> : <SkipForward size={14} />} {skipped ? "Desfazer pulo" : "Pular hoje"}
          </Button>
        )}
        {!timeTask && !skipped && (
          <Button
            variant={completed ? "ghost" : "secondary"}
            onClick={() => {
              toggleDone(uid, task, date, !completed);
              onClose();
            }}
          >
            <Check size={15} /> {completed ? "Reabrir" : "Concluir"}
          </Button>
        )}
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
