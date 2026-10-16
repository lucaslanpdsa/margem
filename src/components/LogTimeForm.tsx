"use client";

import { Check, Pencil } from "lucide-react";
import { useState } from "react";
import { entryTimes, fmtMin, parseTimeEntry, type TimeEntry } from "@/lib/dates";
import { addSession, toggleDone } from "@/lib/db";
import { isCompletedOn, isTimeTask } from "@/lib/metrics";
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
  const { uid, date, sessions } = useStore();
  const { editTask } = useDialogs();
  const timeTask = isTimeTask(task);
  const completed = !timeTask && isCompletedOn(task, date);
  const [other, setOther] = useState("");
  const [error, setError] = useState("");

  const list = sessions.filter((s) => s.taskId === task.id && s.date === date).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const total = list.reduce((a, s) => a + s.minutes, 0);

  async function register(entry: TimeEntry) {
    await addSession(uid, { taskId: task.id, date, minutes: entry.minutes, kind: "manual", ...entryTimes(entry, date) });
    onClose();
  }

  return (
    <Modal title={task.title} onClose={onClose}>
      <div className="mb-5 rounded-xl bg-sunken p-4">
        <p className="text-[13px] text-muted">Reportado neste dia</p>
        <p className="tabular mt-0.5 text-2xl font-semibold">
          {fmtMin(total)}
          {task.estimateMin > 0 && <span className="text-base font-normal text-muted"> de {fmtMin(task.estimateMin)}</span>}
        </p>
        {task.estimateMin > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-done" style={{ width: `${Math.min(100, (total / task.estimateMin) * 100)}%` }} />
          </div>
        )}
      </div>

      <p className="mb-2 text-[13px] font-medium">Reportar tempo</p>
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
          Registrar
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

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4">
        <Button
          variant="ghost"
          onClick={() => {
            onClose();
            editTask(task);
          }}
        >
          <Pencil size={14} /> Editar tarefa
        </Button>
        {!timeTask && (
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
