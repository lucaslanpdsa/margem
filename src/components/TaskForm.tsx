"use client";

import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { WEEKDAY_SHORT, fmtMin, fromKey, parseDuration, shiftDay, todayKey } from "@/lib/dates";
import { addTask, deleteTask, replaceTask, updateTask } from "@/lib/db";
import { findConflicts, slotsMinutes, slotsOf, taskTimeBlocks, toMin } from "@/lib/schedule";
import type { Task, TimeSlot } from "@/lib/types";
import { useStore } from "./store";
import { Button, Field, IconButton, Modal, Segmented, TimeSelect, cx, inputCls } from "./ui";

export type TaskDraft = Partial<Task>;

/** Nome, quando, quanto tempo e (opcional) horário. Só o que entra na conta do dia. */
export function TaskForm({ initial, onClose }: { initial: TaskDraft; onClose: () => void }) {
  const { uid, tasks } = useStore();
  const editing = !!initial.id;
  const [title, setTitle] = useState(initial.title ?? "");
  const [repeat, setRepeat] = useState<"once" | "weekdays">(initial.repeat === "once" || !initial.repeat ? "once" : "weekdays");
  const [estimate, setEstimate] = useState(initial.estimateMin ? fmtMin(initial.estimateMin) : "");
  const [date, setDate] = useState(initial.date ?? todayKey());
  const [slots, setSlotsState] = useState<TimeSlot[]>(() => slotsOf({ estimateMin: 0, ...initial } as Task));
  const [doneBy, setDoneBy] = useState<"check" | "time">(initial.doneBy ?? "check");
  // Horários e "como termina" ficam guardados em "Mais opções", abertos se a tarefa já usa algum.
  const [more, setMore] = useState(() => slotsOf({ estimateMin: 0, ...initial } as Task).length > 0 || initial.doneBy === "time");
  const [weekdays, setWeekdays] = useState<number[]>(initial.weekdays ?? [1, 2, 3, 4, 5]);
  const [error, setError] = useState("");
  const parsed = parseDuration(estimate);

  // Conflitos de horário nas próximas 2 semanas (só avisa; não impede salvar).
  const conflicts = (() => {
    if (!slots.length) return [];
    const draft: Task = {
      id: initial.id ?? "__nova",
      title,
      repeat,
      date: repeat === "once" ? date || todayKey() : undefined,
      weekdays: repeat === "weekdays" ? weekdays : undefined,
      slots,
      estimateMin: parsed ?? 0,
      createdAt: "2000-01-01T00:00:00.000Z",
    };
    const days = Array.from({ length: 14 }, (_, i) => shiftDay(todayKey(), i));
    const others = tasks.filter((t) => t.id !== draft.id && !t.archived);
    const found = findConflicts(taskTimeBlocks([draft, ...others], days)).filter((c) => c.taskId === draft.id);
    const byTask = new Map<string, { title: string; days: Set<number>; when: string }>();
    for (const c of found) {
      const other = others.find((t) => t.id === c.otherId);
      if (!other) continue;
      const hh = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const cur = byTask.get(other.id) ?? { title: other.title, days: new Set<number>(), when: `${hh(c.start)}–${hh(c.end)}` };
      cur.days.add(fromKey(c.date).getDay());
      byTask.set(other.id, cur);
    }
    return [...byTask.values()].map((v) => ({
      ...v,
      dayText: repeat === "once" ? "" : ` (${[...v.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_SHORT[d].toLowerCase()).join(", ")})`,
    }));
  })();

  // Ao mexer nos horários, o tempo da tarefa vira a soma deles (dá para mudar depois).
  const setSlots = (next: TimeSlot[]) => {
    setSlotsState(next);
    const total = slotsMinutes(next);
    if (total > 0) setEstimate(fmtMin(total));
  };
  const addSlot = () => {
    const last = slots[slots.length - 1];
    const startMin = last ? Math.min(toMin(last.end) + 60, 22 * 60) : 8 * 60;
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    setSlots([...slots, { start: hhmm(startMin), end: hhmm(Math.min(startMin + 60, 23 * 60 + 45)) }]);
  };

  async function save() {
    if (!title.trim()) return setError("Dê um nome para a tarefa.");
    if (!parsed) return setError("Informe o tempo, por exemplo 45m ou 1h30.");
    if (repeat === "weekdays" && weekdays.length === 0) return setError("Escolha pelo menos um dia.");
    if (slots.some((sl) => toMin(sl.end) <= toMin(sl.start))) return setError("Cada horário precisa terminar depois de começar.");

    const data: Omit<Task, "id" | "createdAt"> = {
      title: title.trim(),
      repeat,
      estimateMin: parsed,
      date: repeat === "once" ? date || todayKey() : undefined,
      weekdays: repeat === "weekdays" ? [...weekdays].sort() : undefined,
      slots: slots.length ? slots : undefined,
      doneBy: doneBy === "time" ? "time" : undefined,
      completedAt: repeat === "once" ? (initial.completedAt ?? undefined) : undefined,
      completions: repeat === "weekdays" ? initial.completions : undefined,
      skipped: repeat === "weekdays" ? initial.skipped : undefined,
      estimateFor: initial.estimateFor,
      archived: repeat === "weekdays" ? initial.archived : undefined,
    };
    if (editing) await replaceTask(uid, { ...data, id: initial.id!, createdAt: initial.createdAt! });
    else await addTask(uid, data);
    onClose();
  }

  // Pausar só vale para o que repete: para de aparecer nos dias, sem perder o histórico.
  async function togglePause() {
    await updateTask(uid, initial.id!, { archived: !initial.archived });
    onClose();
  }

  async function remove() {
    if (!confirm("Excluir esta tarefa? O tempo já registrado continua no histórico.")) return;
    await deleteTask(uid, initial.id!);
    onClose();
  }

  return (
    <Modal title={editing ? initial.title || "Tarefa" : "Nova tarefa"} description={editing ? "Editar tarefa" : undefined} onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nome">
          <input autoFocus={!editing} className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Estudar Next.js" />
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

        <Field label={doneBy === "time" ? "Meta de tempo" : "Quanto tempo leva"} hint={slots.length ? "Preenchido com a soma dos horários. Dá para mudar." : undefined}>
          <input className={cx(inputCls, "sm:w-56")} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="Ex: 45m, 1h30, 6h" />
        </Field>

        {more ? (
          <div className="space-y-5 rounded-xl border border-line p-4">
          <div>
            <span className="block text-[13px] font-medium">Horário</span>
            <span className="mb-1.5 block text-xs text-muted">
              Com horário, o tempo conta sozinho enquanto o horário passa, e o app avisa no início e no fim (com o app aberto).
            </span>
            {slots.length > 0 && <NotifyPermission />}
            {slots.length > 0 && (
              <ul className="mb-2 space-y-2">
                {slots.map((sl, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <TimeSelect label="Início" value={sl.start} onChange={(v) => setSlots(slots.map((x, j) => (j === i ? { ...x, start: v } : x)))} className="h-10" />
                    <span className="text-sm text-muted">até</span>
                    <TimeSelect label="Fim" value={sl.end} onChange={(v) => setSlots(slots.map((x, j) => (j === i ? { ...x, end: v } : x)))} className="h-10" />
                    <IconButton label="Remover horário" type="button" onClick={() => setSlots(slots.filter((_, j) => j !== i))}>
                      <Trash2 size={15} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={addSlot} className="-ml-2.5 text-todo">
              <Plus size={14} /> {slots.length ? "Adicionar outro horário" : "Adicionar horário"}
            </Button>
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

          </div>
        ) : (
          <button type="button" onClick={() => setMore(true)} className="inline-flex items-center gap-1 text-[13px] font-medium text-todo hover:underline">
            <Plus size={14} /> Mais opções: horário e como termina
          </button>
        )}

        {conflicts.length > 0 && (
          <div className="rounded-lg bg-break/12 px-3 py-2 text-sm text-ink">
            {conflicts.map((c) => (
              <p key={c.title}>
                ⚠ Conflita com <b className="font-semibold">{c.title}</b> das {c.when}
                {c.dayText}.
              </p>
            ))}
            <p className="mt-0.5 text-xs text-muted">Dá para salvar assim mesmo, se for de propósito.</p>
          </div>
        )}

        {error && <p className="rounded-lg bg-over/10 px-3 py-2 text-sm text-over">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          {editing ? (
            <div className="flex gap-2">
              <Button type="button" variant="danger" onClick={remove}>
                <Trash2 size={14} /> Excluir
              </Button>
              {initial.repeat === "weekdays" && (
                <Button type="button" variant="ghost" onClick={togglePause}>
                  {initial.archived ? <Play size={14} /> : <Pause size={14} />}
                  {initial.archived ? "Retomar" : "Pausar"}
                </Button>
              )}
            </div>
          ) : (
            <span />
          )}
          <div className="ml-auto flex gap-2">
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

/** Pede permissão de notificação, se ainda não foi dada, para os avisos de início e fim do horário. */
function NotifyPermission() {
  const [perm, setPerm] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  if (perm !== "default") return null;
  return (
    <button type="button" onClick={() => Notification.requestPermission().then(setPerm)} className="mb-2 text-xs font-medium text-todo hover:underline">
      Permitir notificações para os avisos
    </button>
  );
}
