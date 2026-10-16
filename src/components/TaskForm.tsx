"use client";

import { CalendarPlus, Repeat, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { WEEKDAY_SHORT, fmtMin, parseDuration } from "@/lib/dates";
import { addTask, deleteTask, replaceTask } from "@/lib/db";
import type { Priority, RepeatKind, Task } from "@/lib/types";
import { useStore } from "./store";
import { Button, Field, Modal, Segmented, cx, inputCls } from "./ui";

export type TaskDraft = Partial<Task>;

const KINDS: { value: RepeatKind; icon: typeof Repeat; label: string; hint: string }[] = [
  { value: "once", icon: CalendarPlus, label: "Uma vez", hint: "Num dia escolhido, ou sem dia (fica na caixa de entrada)." },
  { value: "weekdays", icon: Repeat, label: "Repete", hint: "Aparece sozinha nos dias da semana que você marcar." },
  { value: "weeklyGoal", icon: Target, label: "Meta semanal", hint: "Um total de horas por semana, feito no dia que der." },
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
  const parsedEstimate = parseDuration(estimate);
  const parsedGoal = parseDuration(goal);

  async function save() {
    const estimateMin = parsedEstimate ?? 0;
    const weeklyGoalMin = parsedGoal ?? 0;
    if (!title.trim()) return setError("Dê um nome para a tarefa.");
    if (repeat !== "weeklyGoal" && estimateMin <= 0) return setError("Informe quanto tempo leva, por exemplo 45 ou 1h30.");
    if (repeat === "weeklyGoal" && weeklyGoalMin <= 0) return setError("Informe a meta da semana, por exemplo 5h.");
    if (repeat === "weekdays" && weekdays.length === 0) return setError("Escolha pelo menos um dia da semana.");

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
    if (!confirm("Excluir esta tarefa? O tempo já registrado continua contando no histórico.")) return;
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
        <Field label="O que você vai fazer?">
          <input autoFocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Estudar Next.js" />
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Com que frequência?</span>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                type="button"
                key={k.value}
                onClick={() => setRepeat(k.value)}
                className={cx(
                  "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors",
                  repeat === k.value ? "border-todo bg-todo/[0.06] ring-1 ring-todo" : "border-line hover:border-muted/50",
                )}
              >
                <k.icon size={18} className={repeat === k.value ? "text-todo" : "text-muted"} />
                <span className="text-sm font-medium">{k.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{KINDS.find((k) => k.value === repeat)?.hint}</p>
        </div>

        {repeat === "weekdays" && (
          <Field label="Em quais dias?">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))}
                  className={cx(
                    "h-9 flex-1 rounded-lg border text-[13px] font-medium transition-colors",
                    weekdays.includes(d) ? "border-todo bg-todo text-white" : "border-line text-muted hover:text-ink",
                  )}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {repeat === "weeklyGoal" ? (
            <Field label="Quantas horas por semana?" hint={parsedGoal ? `${fmtMin(parsedGoal)} por semana` : "Ex: 5h, 3h30, 300"}>
              <input className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="5h" />
            </Field>
          ) : (
            <Field
              label={repeat === "weekdays" ? "Quanto tempo por dia?" : "Quanto tempo leva?"}
              hint={parsedEstimate ? `Estimativa de ${fmtMin(parsedEstimate)}` : "Ex: 45, 1h, 1h30"}
            >
              <input className={inputCls} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="1h" />
            </Field>
          )}
          <div>
            <span className="mb-1.5 block text-[13px] font-medium">Prioridade</span>
            <Segmented
              value={priority}
              onChange={setPriority}
              options={[
                { value: 1 as Priority, label: "Alta" },
                { value: 2 as Priority, label: "Média" },
                { value: 3 as Priority, label: "Baixa" },
              ]}
            />
          </div>
        </div>

        {repeat === "once" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Em que dia?" hint="Deixe vazio para guardar na caixa de entrada.">
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Prazo (opcional)" hint="Tarefas com prazo perto sobem na lista.">
              <input type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
          </div>
        )}

        <Field label="Categoria (opcional)" hint="Para agrupar: Estudo, Trabalho, Casa…">
          <input className={inputCls} list="cats" value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

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
              {editing ? "Salvar alterações" : "Criar tarefa"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
