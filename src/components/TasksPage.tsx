"use client";

import { ChevronDown, Clock, Pause, Play, Plus, Search, Target } from "lucide-react";
import { useState } from "react";
import { WEEKDAY_SHORT, fmtMin, fromKey, parseDuration, parseQuickAdd, shiftDay, todayKey, weekDays } from "@/lib/dates";
import { addTask, saveSettings, updateTask } from "@/lib/db";
import { allSlotsOutside, slotsOf, toMin, weekdayCapacity } from "@/lib/schedule";
import type { DayWindow, Task } from "@/lib/types";
import { useDialogs } from "./dialogs";
import { useStore } from "./store";
import { ScheduleEditor, type Schedule } from "./ScheduleEditor";
import { Button, Modal, cx, inputCls } from "./ui";

/**
 * Tela de organização das tarefas.
 * Repetem: uma grade da semana (cada tarefa com os 7 dias), com os totais de cada dia embaixo.
 * Não repetem: agrupadas por data. Tempo, dias e data mudam com um toque; o nome abre a edição completa.
 */

/** Semana começando na segunda. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const slotText = (t: Task) =>
  slotsOf(t)
    .map((sl) => `${sl.start}–${sl.end}`)
    .join(", ");

const byTimeThenTitle = (a: Task, b: Task) => {
  const sa = slotsOf(a)[0]?.start;
  const sb = slotsOf(b)[0]?.start;
  if (sa && sb && sa !== sb) return toMin(sa) - toMin(sb);
  if (!!sa !== !!sb) return sa ? -1 : 1;
  return a.title.localeCompare(b.title);
};

export function TasksPage() {
  const { tasks, user, logout } = useStore();
  const [query, setQuery] = useState("");
  const q = norm(query.trim());
  const match = (t: Task) => !q || norm(t.title).includes(q);

  const active = tasks.filter((t) => !t.archived);
  const routine = active.filter((t) => t.repeat === "weekdays").sort(byTimeThenTitle);
  const once = active.filter((t) => t.repeat === "once" && !t.completedAt);
  const goals = active.filter((t) => t.repeat === "weeklyGoal");
  const paused = tasks.filter((t) => t.archived && !(t.repeat === "once" && t.completedAt));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ScheduleCard />

      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tarefa" aria-label="Buscar tarefa" className={cx(inputCls, "pl-9")} />
      </label>

      <RoutineCard tasks={routine} visible={routine.filter(match)} searching={!!q} />
      <OnceCard tasks={once.filter(match)} searching={!!q} />
      {goals.filter(match).length > 0 && <GoalsCard tasks={goals.filter(match)} />}
      {paused.filter(match).length > 0 && <PausedCard tasks={paused.filter(match)} />}

      <p className="pt-4 text-center text-[13px] text-muted">
        {user?.email ? `Conectado como ${user.email}. ` : ""}
        <button className="font-medium text-brand hover:underline" onClick={logout}>
          Sair
        </button>
      </p>
    </div>
  );
}

// ---------------- Seu horário ----------------

const same = (a: DayWindow | null, b: DayWindow | null) => (a && b ? a.start === b.start && a.end === b.end : a === b);

/** "Seg a Sex, 08:00–18:00 · Sáb, 09:00–12:00": dias seguidos com o mesmo horário viram um trecho. */
function describeWindows(windows: (DayWindow | null)[]) {
  const parts: string[] = [];
  let i = 0;
  while (i < WEEK.length) {
    const w = windows[WEEK[i]] ?? null;
    let j = i;
    while (j + 1 < WEEK.length && same(windows[WEEK[j + 1]] ?? null, w)) j++;
    if (w) {
      const days = i === j ? WEEKDAY_SHORT[WEEK[i]] : `${WEEKDAY_SHORT[WEEK[i]]}${j === i + 1 ? " e " : " a "}${WEEKDAY_SHORT[WEEK[j]]}`;
      parts.push(`${days}, ${w.start}–${w.end}`);
    }
    i = j + 1;
  }
  return parts.length ? parts.join(" · ") : "Nenhum dia com horário";
}

/** O horário do dia para tarefas, resumido numa linha; tocar abre a edição. */
function ScheduleCard() {
  const { uid, settings } = useStore();
  const [editing, setEditing] = useState<Schedule | null>(null);
  const breaks = settings.breaks.map((b) => `${b.label.toLowerCase()} ${b.start}–${b.end}`).join(", ");

  async function save() {
    if (!editing) return;
    await saveSettings(uid, { windows: editing.windows, breaks: editing.breaks, scheduleSet: true });
    setEditing(null);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <button
        onClick={() => setEditing({ windows: settings.windows, breaks: settings.breaks })}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-sunken/50 sm:px-5"
        title="Mudar seu horário"
      >
        <Clock size={18} className="shrink-0 text-todo" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Seu horário</span>
          <span className="tabular block text-[13px] text-muted">
            {describeWindows(settings.windows)}
            {breaks && ` · ${breaks}`}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-medium text-brand">Editar</span>
      </button>
      {editing && (
        <Modal
          title="Seu horário"
          description="De que horas a que horas você tem para tarefas. Para mudar só um dia, use “Mudar hoje” na tela do dia. Tarefas com horário fora dele contam como extra."
          onClose={() => setEditing(null)}
        >
          <ScheduleEditor value={editing} onChange={setEditing} />
          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save}>
              Salvar
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

// ---------------- Repetem ----------------

function RoutineCard({ tasks, visible, searching }: { tasks: Task[]; visible: Task[]; searching: boolean }) {
  const { uid, settings } = useStore();
  const { editTask } = useDialogs();

  // Totais da semana: o que as tarefas fixas ocupam em cada dia e o que sobra do horário.
  const totals = WEEK.map((dow) => {
    const { window, capacityMin } = weekdayCapacity(settings, dow);
    const fixed = tasks.filter((t) => t.weekdays?.includes(dow) && !allSlotsOutside(t, window)).reduce((a, t) => a + t.estimateMin, 0);
    return { dow, hasWindow: !!window, capacityMin, fixed, free: capacityMin - fixed };
  });

  async function quickAdd(text: string) {
    const { title, minutes } = parseQuickAdd(text);
    if (!title) return;
    // Começa nos dias que têm horário; os dias se ajustam depois na própria linha.
    const days = WEEK.filter((d) => settings.windows[d]);
    const weekdays = (days.length ? days : [1, 2, 3, 4, 5]).sort();
    if (minutes === null) return editTask({ title, repeat: "weekdays", weekdays });
    await addTask(uid, { title, repeat: "weekdays", weekdays, estimateMin: minutes, priority: 2 });
  }

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2 sm:px-5">
        <div>
          <h2 className="text-[15px] font-semibold">Repetem</h2>
          <p className="text-[13px] text-muted">Toque nos dias para ligar ou desligar.</p>
        </div>
        <span className="tabular text-[13px] text-muted">{tasks.length}</span>
      </header>

      {visible.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-muted sm:px-5">{searching ? "Nenhuma encontrada." : "Nenhuma ainda. Crie abaixo, ex: Academia 1h."}</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {visible.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <TaskName task={t} />
              <div className="flex shrink-0 gap-1">
                {WEEK.map((dow) => {
                  const on = !!t.weekdays?.includes(dow);
                  const last = on && (t.weekdays?.length ?? 0) <= 1;
                  return (
                    <button
                      key={dow}
                      onClick={() => {
                        if (last) return;
                        const next = on ? t.weekdays!.filter((d) => d !== dow) : [...(t.weekdays ?? []), dow];
                        updateTask(uid, t.id, { weekdays: next.sort() });
                      }}
                      aria-pressed={on}
                      aria-label={`${WEEKDAY_SHORT[dow]}: ${on ? "repete" : "não repete"}`}
                      title={last ? "Precisa de pelo menos um dia" : on ? `Tirar de ${WEEKDAY_SHORT[dow].toLowerCase()}` : `Repetir ${WEEKDAY_SHORT[dow].toLowerCase()}`}
                      className={cx(
                        "h-8 w-9 rounded-md text-[11px] font-semibold transition-colors",
                        on ? "bg-todo text-white hover:bg-todo/85" : "bg-sunken text-muted hover:bg-line hover:text-ink",
                      )}
                    >
                      {WEEKDAY_SHORT[dow]}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      {tasks.length > 0 && !searching && (
        <div className="space-y-1 border-t border-line bg-sunken/40 px-4 py-3 sm:px-5">
          <TotalsRow label="Fixas" hint="Quanto as tarefas que repetem ocupam em cada dia" cells={totals.map((d) => ({ text: d.fixed ? fmtMin(d.fixed) : "–", tone: "muted" as const }))} />
          <TotalsRow
            label="Livre"
            hint="O que sobra do seu horário para o resto"
            cells={totals.map((d) =>
              !d.hasWindow
                ? { text: "–", tone: "muted" as const }
                : { text: d.free < 0 ? `-${fmtMin(-d.free)}` : fmtMin(d.free), tone: d.free < 0 ? ("over" as const) : ("done" as const) },
            )}
          />
        </div>
      )}

      <QuickAdd placeholder="Nova que repete, ex: Academia 1h" onAdd={quickAdd} />
    </section>
  );
}

function TotalsRow({ label, hint, cells }: { label: string; hint: string; cells: { text: string; tone: "muted" | "over" | "done" }[] }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <span className="min-w-0 flex-1 text-xs font-semibold text-muted" title={hint}>
        {label}
      </span>
      <div className="flex shrink-0 gap-1">
        {cells.map((c, i) => (
          <span
            key={i}
            className={cx(
              "tabular w-9 text-center text-[11px] font-semibold",
              c.tone === "over" ? "text-over" : c.tone === "done" ? "text-done" : "text-muted",
            )}
          >
            {c.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------- Não repetem ----------------

function OnceCard({ tasks, searching }: { tasks: Task[]; searching: boolean }) {
  const { uid } = useStore();
  const today = todayKey();
  const tomorrow = shiftDay(today, 1);
  const weekEnd = weekDays(today)[6];
  const dayOf = (t: Task) => t.date ?? today;

  const groups = [
    { title: "Atrasadas", late: true, list: tasks.filter((t) => dayOf(t) < today) },
    { title: "Hoje", list: tasks.filter((t) => dayOf(t) === today) },
    { title: "Amanhã", list: tasks.filter((t) => dayOf(t) === tomorrow) },
    { title: "Esta semana", list: tasks.filter((t) => dayOf(t) > tomorrow && dayOf(t) <= weekEnd) },
    { title: "Depois", list: tasks.filter((t) => dayOf(t) > tomorrow && dayOf(t) > weekEnd) },
  ].filter((g) => g.list.length > 0);

  async function quickAdd(text: string) {
    const { title, minutes } = parseQuickAdd(text);
    if (!title) return;
    await addTask(uid, { title, repeat: "once", date: today, estimateMin: minutes ?? 30, priority: 2 });
  }

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2 sm:px-5">
        <div>
          <h2 className="text-[15px] font-semibold">Não repetem</h2>
          <p className="text-[13px] text-muted">As que ainda não foram feitas, por data.</p>
        </div>
        <span className="tabular text-[13px] text-muted">{tasks.length}</span>
      </header>

      {groups.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-muted sm:px-5">{searching ? "Nenhuma encontrada." : "Nada pendente."}</p>
      ) : (
        groups.map((g) => (
          <div key={g.title} className="border-t border-line">
            <p className={cx("px-4 pt-3 pb-1 text-xs font-semibold tracking-wide uppercase sm:px-5", g.late ? "text-over" : "text-muted")}>
              {g.title} <span className="font-normal">· {g.list.length}</span>
            </p>
            <ul>
              {[...g.list]
                .sort((a, b) => dayOf(a).localeCompare(dayOf(b)) || byTimeThenTitle(a, b))
                .map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <TaskName task={t} />
                    <DateChip task={t} />
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}

      <QuickAdd placeholder="Nova para hoje, ex: Revisar PR 45m" onAdd={quickAdd} />
    </section>
  );
}

// ---------------- Outras ----------------

function GoalsCard({ tasks }: { tasks: Task[] }) {
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="px-4 pt-4 pb-2 sm:px-5">
        <h2 className="text-[15px] font-semibold">Metas semanais (antigas)</h2>
        <p className="text-[13px] text-muted">Tipo que saiu do app. Toque no nome para virar uma tarefa que repete.</p>
      </header>
      <ul className="divide-y divide-line border-t border-line">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Target size={15} className="shrink-0 text-muted" />
            <TaskName task={t} sub={`${fmtMin(t.weeklyGoalMin ?? 0)} por semana`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PausedCard({ tasks }: { tasks: Task[] }) {
  const { uid } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 px-1 text-[13px] font-medium text-muted hover:text-ink">
        <ChevronDown size={14} className={cx("transition-transform", !open && "-rotate-90")} />
        <Pause size={13} /> Pausadas ({tasks.length})
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3 opacity-80 sm:px-5">
              <TaskName task={t} />
              <button
                onClick={() => updateTask(uid, t.id, { archived: false })}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-medium hover:bg-sunken"
              >
                <Play size={12} /> Retomar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------- Peças ----------------

/** Nome (abre a edição completa) e, embaixo, tempo editável e horários. */
function TaskName({ task, sub }: { task: Task; sub?: string }) {
  const { editTask } = useDialogs();
  const { settings } = useStore();
  const slots = slotText(task);
  // Horário fora do seu horário em todos os dias dela: não entra nas contas (ex: academia à noite).
  const days = task.repeat === "weekdays" ? (task.weekdays ?? []) : [];
  const extra = days.length > 0 && days.every((d) => allSlotsOutside(task, weekdayCapacity(settings, d).window));
  return (
    <div className="min-w-0 flex-1">
      <button onClick={() => editTask(task)} className="block max-w-full truncate text-left text-sm font-medium hover:text-todo" title="Editar tudo">
        {task.title}
      </button>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        {sub ?? <DurationChip task={task} />}
        {slots && <span className="tabular">{slots}</span>}
        {task.doneBy === "time" && <span>meta de tempo</span>}
        {extra && (
          <span className="rounded bg-break/15 px-1.5 font-medium text-break" title="Fora do seu horário: não entra na conta dos dias">
            extra
          </span>
        )}
      </div>
    </div>
  );
}

/** Tempo da tarefa; toque para mudar ali mesmo (45m, 1h30). Enter salva, Esc cancela. */
function DurationChip({ task }: { task: Task }) {
  const { uid } = useStore();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  async function commit() {
    if (draft === null) return;
    const min = parseDuration(draft);
    if (!min) return setInvalid(true);
    setDraft(null);
    setInvalid(false);
    if (min !== task.estimateMin) await updateTask(uid, task.id, { estimateMin: min });
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
        aria-label="Tempo da tarefa"
        aria-invalid={invalid}
        className={cx("tabular h-6 w-16 rounded border bg-surface px-1.5 text-xs font-semibold text-ink outline-none", invalid ? "border-over" : "border-brand")}
      />
    );
  }
  return (
    <button
      onClick={() => setDraft(fmtMin(task.estimateMin))}
      className="tabular rounded border border-dashed border-line px-1.5 py-px font-semibold text-ink hover:border-todo hover:text-todo"
      title="Mudar o tempo"
    >
      {fmtMin(task.estimateMin)}
    </button>
  );
}

/** Data da tarefa avulsa; toque para trocar (hoje, amanhã ou outro dia). */
function DateChip({ task }: { task: Task }) {
  const { uid } = useStore();
  const [open, setOpen] = useState(false);
  const today = todayKey();
  const key = task.date ?? today;
  const d = fromKey(key);
  const short = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
  const late = key < today;
  const label = key === today ? "Hoje" : key === shiftDay(today, 1) ? "Amanhã" : `${WEEKDAY_SHORT[d.getDay()]}, ${short}`;

  const set = async (date: string) => {
    setOpen(false);
    if (date && date !== task.date) await updateTask(uid, task.id, { date });
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx(
          "tabular h-8 rounded-full border px-3 text-[13px] font-medium transition-colors",
          late ? "border-over/40 text-over hover:bg-over/10" : "border-line hover:bg-sunken",
        )}
        title="Mudar a data"
      >
        {late ? short : label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-48 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
            <MenuItem onClick={() => set(today)}>Hoje</MenuItem>
            <MenuItem onClick={() => set(shiftDay(today, 1))}>Amanhã</MenuItem>
            <MenuItem onClick={() => set(shiftDay(weekDays(today)[0], 7))}>Próxima segunda</MenuItem>
            <label className="mt-1 block border-t border-line px-2 pt-2 pb-1 text-xs text-muted">
              Outro dia
              <input type="date" defaultValue={key} onChange={(e) => set(e.target.value)} className={cx(inputCls, "mt-1 h-9 text-sm")} />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sunken">
      {children}
    </button>
  );
}

/** Campo de criação rápida no fim de cada grupo: "Nome 45m" + Enter. */
function QuickAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => Promise<unknown> | void }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex items-center gap-2 border-t border-line px-4 py-2.5 sm:px-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const value = text;
        setText("");
        await onAdd(value);
      }}
    >
      <Plus size={16} className="shrink-0 text-todo" />
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
      {text.trim() && (
        <button type="submit" className="h-8 shrink-0 rounded-full bg-brand px-3 text-[13px] font-semibold text-white">
          Criar
        </button>
      )}
    </form>
  );
}
