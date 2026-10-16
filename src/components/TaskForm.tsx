"use client";

import { useState } from "react";
import { WEEKDAY_SHORT, fmtMin, parseDuration } from "@/lib/dates";
import { addTask, deleteTask, replaceTask } from "@/lib/db";
import type { Priority, RepeatKind, Task } from "@/lib/types";
import { useStore } from "./store";
import { Button, Field, Modal, cx, inputCls } from "./ui";

export type TaskDraft = Partial<Task>;

const REPEAT_OPTIONS: { value: RepeatKind; label: string; hint: string }[] = [
  { value: "once", label: "Avulsa", hint: "Uma vez, num dia ou na caixa de entrada" },
  { value: "weekdays", label: "Dias fixos", hint: "Repete nos dias escolhidos" },
  { value: "weeklyGoal", label: "Meta semanal", hint: "X horas por semana, em qualquer dia" },
];

export function TaskForm({ initial, onClose }: { initial: TaskDraft; onClose: () => void }) {
  const { uid, tasks } = useStore();
  const editing = !!initial.id;
  const [title, setTitle] = useState(initial.title ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [priority, setPriority] = useState<Priority>(initial.priority ?? 2);
  const [repeat, setRepeat] = useState<RepeatKind>(initial.repeat ?? "once");
  const [estimate, setEstimate] = useState(initial.estimateMin ? fmtMin(initial.estimateMin) : "");
  const [date, setDate] = useState(initial.date ?? "");
  const [deadline, setDeadline] = useState(initial.deadline ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(initial.weekdays ?? [1, 2, 3, 4, 5]);
  const [goal, setGoal] = useState(initial.weeklyGoalMin ? fmtMin(initial.weeklyGoalMin) : "");
  const [error, setError] = useState("");

  const categories = [...new Set(tasks.map((t) => t.category).filter(Boolean))] as string[];

  async function save() {
    const estimateMin = parseDuration(estimate) ?? 0;
    const weeklyGoalMin = parseDuration(goal) ?? 0;
    if (!title.trim()) return setError("Dê um nome para a tarefa.");
    if (repeat !== "weeklyGoal" && estimateMin <= 0) return setError("Informe a estimativa (ex: 45, 1h30).");
    if (repeat === "weeklyGoal" && weeklyGoalMin <= 0) return setError("Informe a meta da semana (ex: 5h).");
    if (repeat === "weekdays" && weekdays.length === 0) return setError("Escolha pelo menos um dia.");

    const data: Omit<Task, "id" | "createdAt"> = {
      title: title.trim(),
      category: category.trim() || undefined,
      priority,
      repeat,
      estimateMin: repeat === "weeklyGoal" ? 0 : estimateMin,
      date: repeat === "once" ? date || undefined : undefined,
      deadline: repeat === "once" ? deadline || undefined : undefined,
      weekdays: repeat === "weekdays" ? [...weekdays].sort() : undefined,
      weeklyGoalMin: repeat === "weeklyGoal" ? weeklyGoalMin : undefined,
      completedAt: repeat === "once" ? initial.completedAt ?? undefined : undefined,
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
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Tarefa">
          <input autoFocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Estudar Next.js" />
        </Field>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-paper p-1">
          {REPEAT_OPTIONS.map((o) => (
            <button
              type="button"
              key={o.value}
              onClick={() => setRepeat(o.value)}
              className={cx("rounded-lg px-2 py-1.5 text-sm", repeat === o.value ? "bg-card font-medium shadow-sm" : "text-muted")}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="-mt-2 text-xs text-muted">{REPEAT_OPTIONS.find((o) => o.value === repeat)?.hint}</p>

        <div className="grid grid-cols-2 gap-3">
          {repeat === "weeklyGoal" ? (
            <Field label="Meta por semana" hint="Ex: 5h, 300">
              <input className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="5h" />
            </Field>
          ) : (
            <Field label="Estimativa" hint="Ex: 45, 1h30, 2h">
              <input className={inputCls} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="1h" />
            </Field>
          )}
          <Field label="Prioridade">
            <select className={inputCls} value={priority} onChange={(e) => setPriority(+e.target.value as Priority)}>
              <option value={1}>Alta</option>
              <option value={2}>Média</option>
              <option value={3}>Baixa</option>
            </select>
          </Field>
        </div>

        {repeat === "once" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia planejado" hint="Vazio = caixa de entrada">
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Prazo (opcional)">
              <input type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
          </div>
        )}

        {repeat === "weekdays" && (
          <Field label="Dias da semana">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))}
                  className={cx(
                    "flex-1 rounded-lg border py-1.5 text-xs",
                    weekdays.includes(d) ? "border-ink bg-ink text-paper" : "border-line text-muted",
                  )}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Categoria (opcional)">
          <input className={inputCls} list="cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Estudo, Trabalho, Casa..." />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        {error && <p className="text-sm text-warn">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          {editing ? (
            <Button type="button" variant="danger" onClick={remove}>
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Salvar
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
