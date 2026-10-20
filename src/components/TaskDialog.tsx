"use client";

import { Archive, ArchiveRestore, CalendarDays, Check, Clock, Flag, Hourglass, Play, Plus, Repeat, SkipForward, Square, Timer as TimerIcon, Trash2, Undo2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { WEEKDAY_SHORT, dayName, fmtMin, fromKey, parseDuration, todayKey } from "@/lib/dates";
import { deleteTask, replaceTask, setDayEstimate, setSkipped, toggleDone, updateTask } from "@/lib/db";
import { isCompletedOn, isSkippedOn, isTimeTask } from "@/lib/metrics";
import { slotsMinutes, slotsOf, toMin } from "@/lib/schedule";
import type { Task, TimeSlot } from "@/lib/types";
import { stopwatchText, useNow } from "./Timer";
import { useTimerActions, useToast } from "./toast";
import { DayMenu } from "./DayMenu";
import { AddTime, TaskEntries } from "./TimeEntries";
import { TimerStart } from "./TimerStart";
import { Goals } from "./Goals";
import { ConflictNote, DayChoice, NotifyPermission, slotConflicts } from "./TaskForm";
import { useStore } from "./store";
import { Button, IconButton, Modal, Segmented, TimeSelect, cx, inputCls } from "./ui";

/**
 * A janela da tarefa, tudo num lugar só (como no ClickUp): propriedades editáveis à esquerda e,
 * à direita, o dia (feito, cronômetro, objetivos do dia, adicionar tempo, registros). Cada campo salva sozinho.
 * No celular, o tempo vem primeiro (é o uso do dia a dia) e as propriedades embaixo.
 * `day` = o dia de onde foi aberta (o Dia aberto, ou a coluna da semana em Tarefas).
 */
export function TaskDialog({ task: opened, day, onClose }: { task: Task; day?: string; onClose: () => void }) {
  const { tasks } = useStore();
  // A tarefa ao vivo (muda quando um campo é salvo); a aberta serve enquanto o banco não responde.
  const task = tasks.find((t) => t.id === opened.id) ?? opened;
  const { date: openDay } = useStore();
  const date = day ?? openDay;

  return (
    <Modal title={task.title} wide="xl" onClose={onClose} header={<TitleField task={task} />}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="order-2 lg:order-1">
          <Properties task={task} onClose={onClose} />
        </div>
        <div className="order-1 lg:order-2 lg:border-l lg:border-line lg:pl-6">
          {task.archived ? (
            <p className="rounded-xl bg-sunken p-4 text-sm text-muted">Desativada: não aparece nos dias. Reative para voltar a registrar tempo.</p>
          ) : (
            <DayTime task={task} date={date} onClose={onClose} />
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Nome grande e editável; salva ao sair do campo ou com Enter. */
function TitleField({ task }: { task: Task }) {
  const { uid } = useStore();
  const [title, setTitle] = useState(task.title);
  const save = () => {
    const t = title.trim();
    if (!t) return setTitle(task.title);
    if (t !== task.title) updateTask(uid, task.id, { title: t });
  };
  return (
    <input
      aria-label="Nome da tarefa"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="-mx-2 min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-xl font-semibold outline-none hover:border-line focus:border-brand focus:ring-2 focus:ring-brand/15"
    />
  );
}

/** Linha de propriedade: ícone e nome à esquerda, valor à direita (no celular, um embaixo do outro). */
function Prop({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <span className="flex items-center gap-2 text-[13px] text-muted sm:h-10">
        {icon} {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Propriedades da tarefa. Cada mudança grava na hora (a tarefa inteira, para limpar o que saiu). */
function Properties({ task, onClose }: { task: Task; onClose: () => void }) {
  const { uid, tasks } = useStore();
  const toast = useToast();
  // Estado local: a tela responde na hora (e na prévia, que não grava).
  const [repeat, setRepeat] = useState<"once" | "weekdays">(task.repeat === "weekdays" ? "weekdays" : "once");
  const [date, setDate] = useState(task.date ?? todayKey());
  const [weekdays, setWeekdays] = useState<number[]>(task.weekdays ?? [1, 2, 3, 4, 5]);
  const [estimate, setEstimate] = useState(fmtMin(task.estimateMin));
  const [slots, setSlotsState] = useState<TimeSlot[]>(() => slotsOf(task));
  const [doneBy, setDoneBy] = useState<"check" | "time">(task.doneBy ?? "check");
  const [error, setError] = useState("");

  type Fields = { repeat: typeof repeat; date: string; weekdays: number[]; estimateMin: number; slots: TimeSlot[]; doneBy: typeof doneBy };
  const current: Fields = { repeat, date, weekdays, estimateMin: parseDuration(estimate) ?? task.estimateMin, slots, doneBy };
  const draft = (f: Fields): Task => ({
    ...task,
    time: undefined,
    repeat: f.repeat,
    estimateMin: f.estimateMin,
    date: f.repeat === "once" ? f.date || todayKey() : undefined,
    weekdays: f.repeat === "weekdays" ? [...f.weekdays].sort() : undefined,
    slots: f.slots.length ? f.slots : undefined,
    doneBy: f.doneBy === "time" ? "time" : undefined,
    completedAt: f.repeat === "once" ? (task.completedAt ?? undefined) : undefined,
    completions: f.repeat === "weekdays" ? task.completions : undefined,
    skipped: f.repeat === "weekdays" ? task.skipped : undefined,
    archived: f.repeat === "weekdays" ? task.archived : undefined,
  });

  /** Valida e grava. Com erro, avisa e não grava (o campo fica como a pessoa deixou para corrigir). */
  function save(patch: Partial<Fields>) {
    const f = { ...current, ...patch };
    if (f.repeat === "weekdays" && f.weekdays.length === 0) return setError("Escolha pelo menos um dia.");
    if (f.slots.some((sl) => toMin(sl.end) <= toMin(sl.start))) return setError("Cada horário precisa terminar depois de começar.");
    if (!f.estimateMin) return setError("Informe o tempo, por exemplo 45m ou 1h30.");
    setError("");
    replaceTask(uid, draft(f));
  }

  // Ao mexer nos horários, o tempo vira a soma deles (dá para mudar depois), como na criação.
  const setSlots = (next: TimeSlot[]) => {
    setSlotsState(next);
    const total = slotsMinutes(next);
    if (total > 0) setEstimate(fmtMin(total));
    save({ slots: next, ...(total > 0 ? { estimateMin: total } : {}) });
  };
  const addSlot = () => {
    const last = slots[slots.length - 1];
    const startMin = last ? Math.min(toMin(last.end) + 60, 22 * 60) : 8 * 60;
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    setSlots([...slots, { start: hhmm(startMin), end: hhmm(Math.min(startMin + 60, 23 * 60 + 45)) }]);
  };

  const conflicts = slotConflicts(draft(current), tasks);

  // Desativar só vale para o que repete: para de aparecer nos dias, sem perder o histórico.
  function toggleArchived() {
    const was = !!task.archived;
    updateTask(uid, task.id, { archived: !was });
    toast(was ? `${task.title} reativada` : `${task.title} desativada`, { tone: "info", undo: () => updateTask(uid, task.id, { archived: was }) });
    onClose();
  }
  // Excluir sem confirmação, mas com "Desfazer": a tarefa é regravada igual (os registros nunca são apagados).
  function remove() {
    deleteTask(uid, task.id);
    toast(`${task.title} excluída`, { tone: "info", undo: () => replaceTask(uid, task) });
    onClose();
  }

  return (
    <div>
      <p className="mb-1 border-t border-line pt-4 text-[13px] font-medium lg:hidden">Detalhes da tarefa</p>
      <div className="divide-y divide-line/70">
        <Prop icon={<Repeat size={14} />} label="Quando">
          <div className="space-y-2">
            <Segmented
              value={repeat}
              onChange={(v) => {
                setRepeat(v);
                save({ repeat: v });
              }}
              options={[
                { value: "once" as const, label: "Uma vez" },
                { value: "weekdays" as const, label: "Repete" },
              ]}
            />
            {repeat === "once" ? (
              <DayChoice
                value={date}
                onChange={(d) => {
                  setDate(d);
                  save({ date: d });
                }}
              />
            ) : (
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <button
                    type="button"
                    key={d}
                    aria-pressed={weekdays.includes(d)}
                    onClick={() => {
                      const next = weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d];
                      setWeekdays(next);
                      save({ weekdays: next });
                    }}
                    className={cx(
                      "h-9 flex-1 rounded-lg border text-[12px] font-medium transition-colors",
                      weekdays.includes(d) ? "border-todo/30 bg-todo/15 text-todo" : "border-line text-muted hover:text-ink",
                    )}
                  >
                    {WEEKDAY_SHORT[d]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Prop>

        <Prop icon={<Hourglass size={14} />} label={doneBy === "time" ? "Meta de tempo" : "Quanto tempo leva"}>
          <input
            className={cx(inputCls, "sm:w-40")}
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            onBlur={() => {
              const m = parseDuration(estimate);
              if (!m) return setError("Informe o tempo, por exemplo 45m ou 1h30.");
              setEstimate(fmtMin(m));
              if (m !== task.estimateMin) save({ estimateMin: m });
              else setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder="Ex: 45m, 1h30"
          />
          {slots.length > 0 && <p className="mt-1 text-xs text-muted">Preenchido com a soma dos horários. Dá para mudar.</p>}
        </Prop>

        <Prop icon={<Clock size={14} />} label="Horário">
          {slots.length > 0 && <NotifyPermission />}
          {slots.length > 0 && (
            <ul className="mb-1 space-y-2">
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
          {!slots.length && <p className="text-xs text-muted">Opcional. Aparece na agenda e o app avisa no início e no fim (com o app aberto).</p>}
        </Prop>

        <Prop icon={<Flag size={14} />} label="Como termina">
          <Segmented
            value={doneBy}
            onChange={(v) => {
              setDoneBy(v);
              save({ doneBy: v });
            }}
            options={[
              { value: "check" as const, label: "Marco como feita" },
              { value: "time" as const, label: "Cumpro o tempo" },
            ]}
          />
          <p className="mt-1.5 text-xs text-muted">
            {doneBy === "check" ? "Terminou antes? Marque como feita e o tempo que sobrou volta para o dia." : "Conclui sozinha quando o tempo registrado chegar na meta."}
          </p>
        </Prop>
      </div>

      <div className="mt-3 space-y-3">
        <ConflictNote conflicts={conflicts} />
        {error && <p className="rounded-lg bg-over/10 px-3 py-2 text-sm text-over">{error}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="button" size="sm" variant="danger" onClick={remove}>
          <Trash2 size={14} /> Excluir
        </Button>
        {task.repeat === "weekdays" && (
          <Button type="button" size="sm" variant="ghost" onClick={toggleArchived}>
            {task.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            {task.archived ? "Reativar" : "Desativar"}
          </Button>
        )}
        <span className="ml-auto text-xs text-muted">As mudanças são salvas sozinhas.</span>
      </div>
    </div>
  );
}

/** O tempo do dia: feito, pular/mudar dia/concluir, cronômetro, adicionar tempo e registros. */
function DayTime({ task, date, onClose }: { task: Task; date: string; onClose: () => void }) {
  const { uid, sessions, settings } = useStore();
  const timer = useTimerActions();
  const toast = useToast();
  const [moving, setMoving] = useState(false);
  // "Adicionar tempo já feito" recolhido, para a coluna ficar curta.
  const [adding, setAdding] = useState(false);
  const timeTask = isTimeTask(task);
  const skipped = isSkippedOn(task, date);
  const completed = !timeTask && !skipped && isCompletedOn(task, date);

  // Feito neste dia, com o cronômetro rodando incluído.
  const total = sessions.filter((s) => s.taskId === task.id && s.date === date).reduce((a, s) => a + s.minutes, 0);
  const running = settings.activeTimer?.taskId === task.id;
  const canStart = !completed && !skipped;
  const dayLabel = date === todayKey() ? "hoje" : `em ${fromKey(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  // Tempo deste dia (pode ter sido encurtado só hoje).
  const est = task.estimateFor?.[date] ?? task.estimateMin;

  return (
    <div>
      <div className="mb-4 rounded-xl bg-sunken p-4">
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
                      const before = task.date ?? todayKey();
                      if (d === before) return;
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
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-todo/40 bg-todo/[0.05] p-3">
          <TimerIcon size={18} className="shrink-0 text-todo" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">Cronômetro rodando</span>
            <LiveClock />
            <TimerStart className="mt-0.5 block" />
          </span>
          <Button variant="primary" onClick={() => timer.stop()}>
            <Square size={12} fill="currentColor" /> Parar
          </Button>
        </div>
      ) : (
        canStart && (
          // Um botão só: o cronômetro registra. O pomodoro (ritmo) fica no Foco, separado.
          <button
            onClick={async () => {
              await timer.start(task.id);
              onClose();
            }}
            className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-brand-ink hover:bg-brand/90"
          >
            <Play size={15} fill="currentColor" /> Começar cronômetro
          </button>
        )
      )}

      <Goals task={task} date={date} />

      {adding ? (
        <>
          <p className="mb-2 text-[13px] font-medium">Adicionar tempo já feito</p>
          <AddTime task={task} defaultDate={date} onDone={() => setAdding(false)} />
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
    </div>
  );
}

function LiveClock() {
  const { settings } = useStore();
  const now = useNow();
  const t = settings.activeTimer;
  if (!t) return null;
  return <span className="tabular block text-xl font-semibold">{stopwatchText(t, now)}</span>;
}
