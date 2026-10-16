"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { WEEKDAY_SHORT, fmtMin, parseDuration, todayKey } from "@/lib/dates";
import { addTask, deleteTask, replaceTask } from "@/lib/db";
import type { Task } from "@/lib/types";
import { useStore } from "./store";
import { Button, Field, Modal, Segmented, TimeSelect, cx, inputCls } from "./ui";

export type TaskDraft = Partial<Task>;

/** Nome, quando, quanto tempo e (opcional) horário. Só o que entra na conta do dia. */
export function TaskForm({ initial, onClose }: { initial: TaskDraft; onClose: () => void }) {
  const { uid } = useStore();
  const editing = !!initial.id;
  // Metas semanais saíram do app: ao editar uma antiga, ela vira tarefa que repete, por tempo.
  const legacyGoal = initial.repeat === "weeklyGoal";
  const [title, setTitle] = useState(initial.title ?? "");
  const [repeat, setRepeat] = useState<"once" | "weekdays">(initial.repeat === "once" || !initial.repeat ? "once" : "weekdays");
  const [estimate, setEstimate] = useState(initial.estimateMin ? fmtMin(initial.estimateMin) : "");
  const [date, setDate] = useState(initial.date ?? todayKey());
  const [time, setTime] = useState(initial.time ?? "");
  const [doneBy, setDoneBy] = useState<"check" | "time">(legacyGoal ? "time" : (initial.doneBy ?? "check"));
  const [weekdays, setWeekdays] = useState<number[]>(initial.weekdays ?? [1, 2, 3, 4, 5]);
  const [error, setError] = useState("");
  const parsed = parseDuration(estimate);

  async function save() {
    if (!title.trim()) return setError("Dê um nome para a tarefa.");
    if (!parsed) return setError("Informe o tempo, por exemplo 45m ou 1h30.");
    if (repeat === "weekdays" && weekdays.length === 0) return setError("Escolha pelo menos um dia.");

    const data: Omit<Task, "id" | "createdAt"> = {
      title: title.trim(),
      priority: initial.priority ?? 2,
      repeat,
      estimateMin: parsed,
      date: repeat === "once" ? date || todayKey() : undefined,
      weekdays: repeat === "weekdays" ? [...weekdays].sort() : undefined,
      time: time || undefined,
      doneBy: doneBy === "time" ? "time" : undefined,
      completedAt: repeat === "once" ? (initial.completedAt ?? undefined) : undefined,
      completions: repeat === "weekdays" ? initial.completions : undefined,
    };
    if (editing) await replaceTask(uid, { ...data, id: initial.id!, createdAt: initial.createdAt! });
    else await addTask(uid, data);
    onClose();
  }

  async function remove() {
    if (!confirm("Excluir esta tarefa? O tempo já registrado continua no histórico.")) return;
    await deleteTask(uid, initial.id!);
    onClose();
  }

  return (
    <Modal title={editing ? "Editar tarefa" : "Nova tarefa"} onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Tarefa">
          <input autoFocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Estudar Next.js" />
        </Field>

        <div className="space-y-3">
          <Segmented
            value={repeat}
            onChange={setRepeat}
            options={[
              { value: "once" as const, label: "Uma vez" },
              { value: "weekdays" as const, label: "Repete" },
            ]}
          />
          {repeat === "once" ? (
            <input type="date" aria-label="Dia" className={cx(inputCls, "sm:w-56")} value={date} onChange={(e) => setDate(e.target.value)} />
          ) : (
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  type="button"
                  key={d}
                  aria-pressed={weekdays.includes(d)}
                  onClick={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))}
                  className={cx(
                    "h-10 flex-1 rounded-lg border text-[13px] font-medium transition-colors",
                    weekdays.includes(d) ? "border-todo bg-todo text-white" : "border-line text-muted hover:text-ink",
                  )}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={doneBy === "time" ? "Meta de tempo" : "Quanto tempo leva"}>
            <input className={inputCls} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="Ex: 45m, 1h30, 6h" />
          </Field>
          <Field label="Horário (opcional)">
            <TimeSelect label="Horário" value={time} onChange={setTime} emptyLabel="Sem horário" className="h-10 w-full" />
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Como termina</span>
          <Segmented
            value={doneBy}
            onChange={setDoneBy}
            options={[
              { value: "check" as const, label: "Marco como feita" },
              { value: "time" as const, label: "Cumpro o tempo" },
            ]}
          />
          <p className="mt-1.5 text-xs text-muted">
            {doneBy === "check" ? "Terminou antes? Marque como feita e o tempo que sobrou volta para o dia." : "Ex: trabalhar 6h. Conclui sozinha quando o tempo reportado chegar na meta."}
          </p>
        </div>

        {error && <p className="rounded-lg bg-over/10 px-3 py-2 text-sm text-over">{error}</p>}

        <div className="flex items-center justify-between border-t border-line pt-4">
          {editing ? (
            <Button type="button" variant="danger" onClick={remove}>
              <Trash2 size={14} /> Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
