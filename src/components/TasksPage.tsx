"use client";

import { ArrowDown, Clock, Plus, Repeat, Search } from "lucide-react";
import { useState, type DragEvent } from "react";
import { parseCapture } from "@/lib/capture";
import { WEEKDAY_SHORT, dayName, fmtMin, fromKey, parseDuration, shiftDay, todayKey, weekDays } from "@/lib/dates";
import { fmtFactor } from "@/lib/calibration";
import { addTask, deleteTask, moveToDay, saveSettings, setDayOrder, toggleDone, updateTask } from "@/lib/db";
import { dayMetrics, isReminder, tracksTime, type DayItem, type DayMetrics } from "@/lib/metrics";
import { moveInQueue, orderItems } from "@/lib/queue";
import { DONE_DAYS, matchesFilter, sortTasks, taskSummary, whenOf, type Filter, type SortKey, type TaskSummary } from "@/lib/tasklist";
import type { DayWindow, Task } from "@/lib/types";
import { DayMenu } from "./DayMenu";
import { captureHint, saveCapture } from "./Later";
import { useToast } from "./toast";
import { useDialogs } from "./dialogs";
import { useStore } from "./store";
import { ScheduleEditor, type Schedule } from "./ScheduleEditor";
import { Button, Modal, Segmented, cx, inputCls } from "./ui";
import { useNow } from "./Timer";

/**
 * Aba Tarefas: criar, organizar e ver o que aconteceu com cada tarefa.
 * Computador: "Semana" (quadro com uma coluna por dia; arrastar muda o dia ou a ordem) e "Lista" (tabela com filtros).
 * Celular: a semana numa faixa (tempo livre de cada dia) e a lista em cartões. Arrastar no celular é ruim, então não tem quadro.
 * Prioridade = a ordem do dia (a mesma fila do Dia): em cima é o que vem primeiro; o que não cabe é o do fim.
 */

/** Semana começando na segunda. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const VIEW_KEY = "margem.tarefas.visao";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function TasksPage({ onOpenDay }: { onOpenDay: (date: string) => void }) {
  // Visão do computador lembrada no aparelho.
  const [view, setViewState] = useState<"semana" | "lista">(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "lista" ? "lista" : "semana";
    } catch {
      return "semana";
    }
  });
  const setView = (v: "semana" | "lista") => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* sem armazenamento: vale só agora */
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 lg:max-w-6xl">
      <div className="hidden items-center justify-end lg:flex">
        <Segmented
          value={view}
          onChange={(v) => setView(v as "semana" | "lista")}
          options={[
            { value: "semana", label: "Semana" },
            { value: "lista", label: "Lista" },
          ]}
        />
      </div>
      <CreateBox />
      {/* Celular: faixa da semana e lista em cartões. */}
      <div className="space-y-4 lg:hidden">
        <WeekStrip onOpenDay={onOpenDay} />
        <TaskList mode="cards" />
      </div>
      {/* Computador: quadro ou tabela. */}
      <div className="hidden lg:block">{view === "semana" ? <WeekBoard /> : <TaskList mode="table" />}</div>
      <ScheduleCard />
    </div>
  );
}

// ---------------- Criar ----------------

/** Um campo só, igual ao do Dia e do Depois: "Revisar PR amanhã 45m", "Inglês ter e qui 45m", "Ligar pro banco" (vai para Depois). */
function CreateBox() {
  const { uid } = useStore();
  const toast = useToast();
  const [text, setText] = useState("");
  const c = parseCapture(text, todayKey());
  async function submit() {
    if (!c.title) return;
    const id = await saveCapture(uid, c);
    toast(captureHint(c).split(".")[0], { tone: "info", undo: () => deleteTask(uid, id) });
    setText("");
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-2xl border border-line bg-surface px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <Plus size={18} className="shrink-0 text-brand" aria-hidden="true" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nova tarefa, ex: Inglês ter e qui 45m"
          aria-label="Nova tarefa"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
        {text.trim() && (
          <button type="submit" className="h-9 shrink-0 rounded-full bg-brand px-4 text-[13px] font-semibold text-brand-ink">
            Criar
          </button>
        )}
      </div>
      {text.trim() && <p className="px-7 pb-1 text-xs text-muted">{captureHint(c)}</p>}
    </form>
  );
}

// ---------------- Semana (computador) ----------------

/** A ordem do dia salva, com os itens que entram na fila (sem lembretes, concluídas e puladas). */
function queueOf(m: DayMetrics, order: string[] | undefined, blocks: ReturnType<typeof useStore>["blocks"]) {
  return orderItems(
    m.items.filter((i) => !i.completed && !i.skipped && !isReminder(i.task)),
    order,
    blocks,
    m.date,
  );
}

function WeekBoard() {
  const { uid, settings, tasks, blocks, sessions, days: dayDocs } = useStore();
  const toast = useToast();
  const now = new Date(useNow(60000));
  const today = todayKey(now);
  const [offset, setOffset] = useState(0);
  const days = weekDays(shiftDay(today, offset * 7));
  const ms = days.map((d) => dayMetrics(d, settings, tasks, blocks, sessions, now, dayDocs[d]));
  // Arrastando: qual tarefa, de que dia; e onde vai cair (antes de qual cartão, ou no fim da coluna).
  const [drag, setDrag] = useState<{ id: string; from: string } | null>(null);
  const [over, setOver] = useState<{ date: string; before: string | null } | null>(null);

  function drop(date: string, before: string | null) {
    const d = drag;
    setDrag(null);
    setOver(null);
    if (!d) return;
    const task = tasks.find((t) => t.id === d.id);
    if (!task) return;
    const m = ms.find((x) => x.date === date)!;
    const ids = queueOf(m, dayDocs[date]?.order, blocks).map((i) => i.task.id);
    if (d.from === date) {
      // Mesmo dia: muda a ordem (a prioridade).
      const next = moveInQueue(ids, task.id, { before });
      if (next.join() !== ids.join()) setDayOrder(uid, date, next);
      return;
    }
    if (task.repeat === "weekdays") return toast("As que repetem mudam de dia na janela da tarefa.", { tone: "info" });
    if (task.completedAt) return;
    // Outro dia: a tarefa vai para lá, no lugar onde caiu.
    const prev = task.date;
    moveToDay(uid, task, date);
    const withIt = [...ids, task.id];
    setDayOrder(uid, date, moveInQueue(withIt, task.id, { before }));
    toast(`${task.title} foi para ${dayName(date).toLowerCase()}`, { tone: "info", undo: () => updateTask(uid, task.id, { date: prev ?? today, later: !!task.later }) });
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">
          {offset === 0 ? "Esta semana" : offset === 1 ? "Próxima semana" : offset === -1 ? "Semana passada" : "Semana"}
          <span className="ml-2 font-normal text-muted">
            {fromKey(days[0]).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a {fromKey(days[6]).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </span>
        </h2>
        <div className="flex items-center gap-1 rounded-xl bg-sunken p-0.5">
          <button onClick={() => setOffset(offset - 1)} aria-label="Semana anterior" className="h-8 w-8 rounded-lg text-ink hover:bg-surface">
            ‹
          </button>
          <button onClick={() => setOffset(0)} className={cx("h-8 rounded-lg px-3 text-[13px] font-medium", offset === 0 ? "bg-surface shadow-sm" : "hover:bg-surface")}>
            Esta semana
          </button>
          <button onClick={() => setOffset(offset + 1)} aria-label="Próxima semana" className="h-8 w-8 rounded-lg text-ink hover:bg-surface">
            ›
          </button>
        </div>
      </header>
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[1000px] grid-cols-7 gap-2.5">
          {ms.map((m) => (
            <DayColumn key={m.date} m={m} today={today} drag={drag} over={over} setDrag={setDrag} setOver={setOver} onDrop={drop} />
          ))}
        </div>
      </div>
      <p className="text-[13px] text-muted">Arraste para mudar o dia ou a ordem. Em cima vem primeiro; o que não cabe fica no fim.</p>
    </section>
  );
}

function DayColumn({
  m,
  today,
  drag,
  over,
  setDrag,
  setOver,
  onDrop,
}: {
  m: DayMetrics;
  today: string;
  drag: { id: string; from: string } | null;
  over: { date: string; before: string | null } | null;
  setDrag: (d: { id: string; from: string } | null) => void;
  setOver: (o: { date: string; before: string | null } | null) => void;
  onDrop: (date: string, before: string | null) => void;
}) {
  const { blocks, days, settings } = useStore();
  const past = m.date < today;
  const isToday = m.date === today;
  const queue = queueOf(m, days[m.date]?.order, blocks);
  const reminders = m.items.filter((i) => isReminder(i.task) && !i.completed);
  const done = m.items.filter((i) => i.completed || i.skipped);
  const late = !past && m.freeMin < 0;
  const track = tracksTime(settings);
  // Quanto do tempo livre as tarefas usam; passado mostra o feito.
  const room = m.remainingMin + Math.max(0, m.freeMin);
  const fill = past ? (m.plannedMin ? Math.min(1, m.doneMin / m.plannedMin) : 0) : room ? Math.min(1, m.remainingMin / room) : m.remainingMin ? 1 : 0;
  const cap = !m.window
    ? "Sem horário"
    : past
      ? track
        ? `${fmtMin(m.doneMin)} feitos de ${fmtMin(m.plannedMin)}`
        : `${done.filter((i) => i.completed).length} de ${m.items.filter((i) => !isReminder(i.task)).length} feitas`
      : late
        ? `Não cabe: ${fmtMin(-m.freeMin)} a mais`
        : `${fmtMin(m.remainingMin)} de ${fmtMin(room)} livres`;
  const d = fromKey(m.date);
  const dragOver = (before: string | null) => (e: DragEvent) => {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    if (over?.date !== m.date || over.before !== before) setOver({ date: m.date, before });
  };
  const dropHere = (before: string | null) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop(m.date, before);
  };
  const marker = (before: string | null) => over?.date === m.date && over.before === before && <div className="h-0.5 rounded bg-brand" />;

  return (
    <section
      onDragOver={dragOver(null)}
      onDrop={dropHere(null)}
      className={cx("flex min-h-[520px] min-w-0 flex-col gap-2 rounded-2xl border p-2.5", isToday ? "border-todo/40 bg-todo/[0.05]" : "border-transparent bg-sunken")}
    >
      <header className="space-y-1.5 px-1 pt-0.5 pb-1">
        <div className="flex items-baseline justify-between gap-1">
          <span className={cx("font-semibold", isToday && "text-todo")}>
            {WEEKDAY_SHORT[d.getDay()]} {d.getDate()}
          </span>
          {isToday && <span className="text-xs text-muted">hoje</span>}
        </div>
        {m.window && (
          <div className="flex h-1.5 overflow-hidden rounded-full bg-line">
            <span className={cx("block", late ? "bg-over" : past ? "bg-idle" : "bg-todo")} style={{ width: `${Math.round(fill * 100)}%` }} />
          </div>
        )}
        <p className={cx("tabular text-xs font-semibold", late ? "text-over" : "text-muted")}>{cap}</p>
        {m.agendaMin > 0 && <p className="tabular text-xs text-muted">Agenda {fmtMin(m.agendaMin)}</p>}
      </header>

      {queue.map((i) => (
        <div key={i.task.id} onDragOver={dragOver(i.task.id)} onDrop={dropHere(i.task.id)}>
          {marker(i.task.id)}
          <BoardCard item={i} date={m.date} onDragStart={() => setDrag({ id: i.task.id, from: m.date })} onDragEnd={() => (setDrag(null), setOver(null))} />
        </div>
      ))}
      {marker(null)}
      {reminders.map((i) => (
        <BoardCard key={i.task.id} item={i} date={m.date} />
      ))}
      {done.map((i) => (
        <BoardCard key={i.task.id} item={i} date={m.date} />
      ))}
      <ColumnAdd date={m.date} />
    </section>
  );
}

/** Cartão do quadro: círculo (concluir), nome (abre a janela da tarefa), tempo e se repete. */
function BoardCard({ item, date, onDragStart, onDragEnd }: { item: DayItem; date: string; onDragStart?: () => void; onDragEnd?: () => void }) {
  const { uid } = useStore();
  const { openTask } = useDialogs();
  const t = item.task;
  const reminder = isReminder(t);
  const progress = !item.completed && !item.skipped && item.doneMin > 0 && !reminder;
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.id);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={cx(
        "flex items-start gap-2 rounded-xl border border-line bg-surface px-2.5 py-2 shadow-[0_1px_2px_rgba(16,24,40,.04)]",
        onDragStart && "cursor-grab active:cursor-grabbing",
        (item.completed || item.skipped) && "opacity-70",
      )}
    >
      <button
        onClick={() => toggleDone(uid, t, date, !item.completed)}
        aria-label={item.completed ? `Desmarcar ${t.title}` : `Concluir ${t.title}`}
        disabled={item.skipped || t.doneBy === "time"}
        className={cx(
          "relative mt-0.5 h-4 w-4 shrink-0 rounded-full border-[1.5px] before:absolute before:-inset-2.5 before:content-['']",
          item.completed ? "border-done bg-done" : "border-idle hover:border-done",
        )}
      />
      <button onClick={() => openTask(t, date)} className="min-w-0 flex-1 text-left" title="Abrir tarefa">
        <span className={cx("block text-[13px] leading-snug font-medium break-words", item.completed && "text-muted line-through")}>{t.title}</span>
        <span className="tabular mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <span className="font-semibold text-ink/80">{reminder ? "lembrete" : fmtMin(item.estimateMin)}</span>
          {t.repeat === "weekdays" && (
            <span className="inline-flex items-center gap-0.5" title="Repete">
              <Repeat size={11} aria-hidden="true" /> repete
            </span>
          )}
          {item.skipped && <span>pulada</span>}
          {progress && <span>{fmtMin(item.doneMin)} feitos</span>}
        </span>
      </button>
    </div>
  );
}

/** "+ Adicionar" no fim da coluna: cria no dia da coluna. Sem tempo, abre o formulário (como no Dia). */
function ColumnAdd({ date }: { date: string }) {
  const { uid } = useStore();
  const { editTask } = useDialogs();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-auto h-9 rounded-xl border border-dashed border-free text-[13px] text-muted hover:border-todo hover:text-todo">
        + Adicionar
      </button>
    );
  async function submit() {
    const c = parseCapture(text, todayKey());
    if (!c.title) return setOpen(false);
    setText("");
    if (c.weekdays) {
      const id = await saveCapture(uid, c);
      return toast(captureHint(c).split(".")[0], { tone: "info", undo: () => deleteTask(uid, id) });
    }
    const day = c.date ?? date;
    if (c.minutes === null) return editTask({ title: c.title, date: day, repeat: "once" });
    await addTask(uid, { title: c.title, repeat: "once", date: day, estimateMin: c.minutes });
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mt-auto"
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => !text.trim() && setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Nome 45m"
        aria-label={`Nova tarefa em ${dayName(date).toLowerCase()}`}
        className={cx(inputCls, "h-9 text-[13px]")}
      />
    </form>
  );
}

// ---------------- Semana (celular) ----------------

/** Faixa da semana com o número e o que ele quer dizer ("livre", "não cabe", "feitas"). Tocar abre o dia. */
function WeekStrip({ onOpenDay }: { onOpenDay: (date: string) => void }) {
  const { settings, tasks, blocks, sessions, days: dayDocs } = useStore();
  const now = new Date(useNow(60000));
  const today = todayKey(now);
  const days = weekDays(today);
  const track = tracksTime(settings);
  return (
    <section aria-label="Esta semana" className="rounded-2xl border border-line bg-surface px-2 pt-3 pb-2">
      <div className="flex items-baseline justify-between px-2 pb-2">
        <h2 className="text-[15px] font-semibold">Esta semana</h2>
        <span className="text-xs text-muted">tempo livre por dia</span>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((date) => {
          const m = dayMetrics(date, settings, tasks, blocks, sessions, now, dayDocs[date]);
          const d = fromKey(date);
          const past = date < today;
          const late = !past && m.freeMin < 0;
          const value = !m.window ? "–" : past ? (track ? fmtMin(m.doneMin) : String(m.items.filter((i) => i.completed).length)) : fmtMin(Math.abs(m.freeMin));
          const label = !m.window ? "" : past ? (track ? "feitos" : "feitas") : late ? "não cabe" : "livre";
          return (
            <button
              key={date}
              onClick={() => onOpenDay(date)}
              className={cx("flex flex-col items-center rounded-xl py-1.5", date === today && "bg-todo/[0.07] ring-1 ring-todo/40")}
              title={`Abrir ${dayName(date).toLowerCase()}`}
            >
              <span className={cx("text-[11px] font-semibold", date === today ? "text-todo" : "text-muted")}>{WEEKDAY_SHORT[d.getDay()]}</span>
              <span className={cx("text-sm font-semibold", past && "text-muted")}>{d.getDate()}</span>
              <span className={cx("tabular text-[11px] font-semibold", late ? "text-over" : past || !m.window ? "text-muted" : "text-done")}>{value}</span>
              <span className={cx("text-[10px]", late ? "text-over" : "text-muted")}>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------- Lista ----------------

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "routine", label: "Repetem" },
  { id: "once", label: "Uma vez" },
  { id: "reminders", label: "Lembretes" },
  { id: "done", label: "Concluídas" },
  { id: "archived", label: "Desativadas" },
];

const GROUPS: { bucket: ReturnType<typeof whenOf>["bucket"]; title: string }[] = [
  { bucket: "late", title: "Atrasadas" },
  { bucket: "today", title: "Hoje" },
  { bucket: "next", title: "Próximos dias" },
  { bucket: "routine", title: "Repetem" },
  { bucket: "later", title: "Depois (sem dia)" },
  { bucket: "done", title: `Concluídas nos últimos ${DONE_DAYS} dias` },
  { bucket: "archived", title: "Desativadas" },
];

/** Lista de todas as tarefas: tabela no computador, cartões agrupados por "quando" no celular. */
function TaskList({ mode }: { mode: "table" | "cards" }) {
  const { tasks, sessions, settings } = useStore();
  const today = todayKey();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("when");
  const [query, setQuery] = useState("");
  const q = norm(query.trim());
  const track = tracksTime(settings);
  // Registros carregados vão até 4 semanas atrás: é o histórico do "estimado × real".
  const since = shiftDay(today, -28);
  const cache = new Map<string, TaskSummary>();
  const summary = (t: Task) => {
    if (!cache.has(t.id)) cache.set(t.id, taskSummary(t, sessions, today, since));
    return cache.get(t.id)!;
  };
  const count = (f: Filter) => tasks.filter((t) => matchesFilter(t, f, today)).length;
  const list = sortTasks(
    tasks.filter((t) => matchesFilter(t, filter, today) && (!q || norm(t.title).includes(q))),
    sort,
    today,
    summary,
  );

  const controls = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="Filtrar" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTERS.map((f) => {
          const n = count(f.id);
          if (n === 0 && f.id !== "all" && filter !== f.id) return null;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cx(
                "h-9 shrink-0 rounded-full border px-3 text-[13px] font-semibold",
                filter === f.id ? "border-ink bg-ink text-bg" : "border-line bg-surface hover:bg-sunken",
              )}
            >
              {f.label} <span className="font-medium opacity-70">{n}</span>
            </button>
          );
        })}
      </div>
      <label className="relative block w-full lg:w-64">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar tarefa" className={cx(inputCls, "h-9 pl-9")} />
      </label>
    </div>
  );

  const empty = <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{q ? "Nada com esse nome." : "Nada aqui."}</p>;

  if (mode === "cards") {
    // Celular: agrupadas por quando (a ordem da lista já é por quando).
    const groups = GROUPS.map((g) => ({ ...g, items: list.filter((t) => whenOf(t, today).bucket === g.bucket) })).filter((g) => g.items.length);
    return (
      <div className="space-y-3">
        {controls}
        {!list.length && empty}
        {groups.map((g) => (
          <section key={g.bucket} className="space-y-2">
            <h3 className={cx("px-0.5 pt-1 text-xs font-bold tracking-wide uppercase", g.bucket === "late" ? "text-over" : "text-muted")}>
              {g.title} · {g.items.length}
            </h3>
            {g.items.map((t) => (
              <TaskCard key={t.id} task={t} s={summary(t)} track={track} />
            ))}
          </section>
        ))}
      </div>
    );
  }

  const th = (key: SortKey | null, label: string, cls = "") => (
    <th className={cx("px-3 py-2.5 text-left text-xs font-semibold text-muted", cls)} aria-sort={key && sort === key ? "ascending" : undefined}>
      {key ? (
        <button onClick={() => setSort(key)} className={cx("inline-flex items-center gap-1 hover:text-ink", sort === key && "text-ink")}>
          {label} {sort === key && <ArrowDown size={12} aria-hidden="true" />}
        </button>
      ) : (
        label
      )}
    </th>
  );
  return (
    <div className="space-y-3">
      {controls}
      {!list.length ? (
        empty
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="border-b border-line">
              <tr>
                {th("title", "Tarefa", "pl-4")}
                {th("when", "Quando")}
                {th("time", "Tempo")}
                {th("week", "Esta semana", "w-60")}
                {track && th(null, "Estimado × real")}
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <TaskRowLine key={t.id} task={t} s={summary(t)} track={track} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[13px] text-muted">Toque no nome para abrir a tarefa. Toque no dia ou no tempo para mudar ali mesmo. Toque no título de uma coluna para ordenar.</p>
    </div>
  );
}

/** Círculo da lista: conclui a de uma vez; na que repete, conclui hoje (só se hoje é dia dela). */
function DoneCircle({ task }: { task: Task }) {
  const { uid } = useStore();
  const today = todayKey();
  const w = whenOf(task, today).bucket;
  if (task.archived) return <span className="h-4 w-4 shrink-0" />;
  if (task.repeat === "weekdays") {
    const isDay = (task.weekdays ?? []).includes(fromKey(today).getDay()) && task.doneBy !== "time";
    if (!isDay) return <Repeat size={15} className="shrink-0 text-muted" aria-label="Repete" />;
    const done = !!task.completions?.[today];
    return (
      <button
        onClick={() => toggleDone(uid, task, today, !done)}
        aria-label={done ? `Desmarcar ${task.title} hoje` : `Concluir ${task.title} hoje`}
        title="Concluir hoje"
        className={cx("relative h-4 w-4 shrink-0 rounded-full border-[1.5px] before:absolute before:-inset-3 before:content-['']", done ? "border-done bg-done" : "border-idle hover:border-done")}
      />
    );
  }
  const done = w === "done";
  return (
    <button
      onClick={() => toggleDone(uid, task, today, !done)}
      aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
      className={cx(
        "relative h-4 w-4 shrink-0 rounded-full border-[1.5px] before:absolute before:-inset-3 before:content-['']",
        done ? "border-done bg-done" : w === "late" ? "border-over" : "border-idle hover:border-done",
      )}
    />
  );
}

/** "Quando": de uma vez muda o dia ali mesmo; que repete abre a janela (os dias se mudam lá). */
function WhenChip({ task }: { task: Task }) {
  const { openTask } = useDialogs();
  const w = whenOf(task, todayKey());
  if (task.repeat === "once" && w.bucket !== "done" && w.bucket !== "archived") return <DateChip task={task} label={w.label} late={w.bucket === "late"} />;
  return (
    <button onClick={() => openTask(task)} className="h-8 rounded-full border border-line px-3 text-[13px] font-medium whitespace-nowrap hover:bg-sunken" title="Abrir tarefa">
      {w.label}
    </button>
  );
}

function WeekCell({ s, track }: { s: TaskSummary; track: boolean }) {
  const w = s.week;
  if (!w) return <span className="text-xs text-muted">{track && s.doneMin > 0 ? `${fmtMin(s.doneMin)} registrados` : "—"}</span>;
  // Sem registro de tempo, a semana é em dias cumpridos.
  const pct = track ? (w.plannedMin ? Math.min(1, w.doneMin / w.plannedMin) : 0) : w.plannedDays ? w.metDays / w.plannedDays : 0;
  const text = track ? `${fmtMin(w.doneMin)} de ${fmtMin(w.plannedMin)} · ${w.metDays} de ${w.plannedDays} dias` : `${w.metDays} de ${w.plannedDays} dias`;
  return (
    <div className="space-y-1">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-line">
        <span className={cx("block", w.behindMin > 0 ? "bg-break" : "bg-done")} style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <p className="tabular text-xs text-muted">
        {text}
        {track && w.behindMin > 0 && <b className="ml-1 font-semibold text-break"> {fmtMin(w.behindMin)} atrasado</b>}
      </p>
    </div>
  );
}

function FactorCell({ task, s }: { task: Task; s: TaskSummary }) {
  if (!s.factor) return <span className="text-xs text-muted" title="Aparece depois de 3 vezes concluída com tempo registrado">—</span>;
  const f = s.factor.value;
  const accurate = Math.abs(f - 1) < 0.1;
  return (
    <span className={cx("tabular text-[13px] font-semibold whitespace-nowrap", accurate ? "text-done" : "text-break")} title={`Baseado em ${s.factor.n} vezes`}>
      {fmtFactor(f)} <span className="font-normal text-muted">{accurate ? "acerta" : `leva ${fmtMin(Math.round(task.estimateMin * f))}`}</span>
    </span>
  );
}

/** Tempo: lembrete não tem; em "Depois" sem tempo ainda, "sem tempo". */
function TimeCell({ task }: { task: Task }) {
  if (isReminder(task)) return <span className="text-muted">lembrete</span>;
  if (task.later && task.estimateMin === 0) return <span className="text-muted">sem tempo</span>;
  return <DurationChip task={task} />;
}

function TaskRowLine({ task, s, track }: { task: Task; s: TaskSummary; track: boolean }) {
  const { openTask, editTask } = useDialogs();
  const done = whenOf(task, todayKey()).bucket === "done";
  return (
    <tr className="border-b border-sunken last:border-0">
      <td className="py-2.5 pr-3 pl-4">
        <div className="flex items-center gap-2.5">
          <DoneCircle task={task} />
          <button
            onClick={() => (task.archived ? editTask(task) : openTask(task))}
            className={cx("min-w-0 truncate text-left text-sm font-medium hover:text-todo", done && "text-muted line-through")}
          >
            {task.title}
          </button>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <WhenChip task={task} />
      </td>
      <td className="px-3 py-2.5 text-xs">
        <TimeCell task={task} />
      </td>
      <td className="px-3 py-2.5">
        <WeekCell s={s} track={track} />
      </td>
      {track && (
        <td className="px-3 py-2.5">
          <FactorCell task={task} s={s} />
        </td>
      )}
    </tr>
  );
}

function TaskCard({ task, s, track }: { task: Task; s: TaskSummary; track: boolean }) {
  const { openTask, editTask } = useDialogs();
  const w = whenOf(task, todayKey());
  return (
    <div className={cx("flex items-start gap-3 rounded-2xl border bg-surface p-3", w.bucket === "late" ? "border-over/40" : "border-line")}>
      <div className="pt-0.5">
        <DoneCircle task={task} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => (task.archived ? editTask(task) : openTask(task))}
            className={cx("min-w-0 text-left text-[15px] leading-snug font-medium", w.bucket === "done" && "text-muted line-through")}
          >
            {task.title}
          </button>
          <span className="shrink-0 text-xs"><TimeCell task={task} /></span>
        </div>
        <WhenChip task={task} />
        {s.week && <WeekCell s={s} track={track} />}
      </div>
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
  return parts.length ? parts : ["Nenhum dia com horário"];
}

/** O horário do dia para tarefas, resumido numa linha; tocar abre a edição. */
function ScheduleCard() {
  const { uid, settings } = useStore();
  const [editing, setEditing] = useState<Schedule | null>(null);
  const breaks = settings.breaks.map((b) => `${b.label} ${b.start}–${b.end}`).join(" · ");

  async function save() {
    if (!editing) return;
    await saveSettings(uid, { windows: editing.windows, breaks: editing.breaks, scheduleSet: true });
    setEditing(null);
  }

  // Uma linha só, em cima da semana: o horário é contexto, não precisa de cartão próprio.
  return (
    <section>
      <button
        onClick={() => setEditing({ windows: settings.windows, breaks: settings.breaks })}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-left text-[13px] hover:bg-sunken/50"
        title="Mudar seu horário"
      >
        <Clock size={15} className="shrink-0 text-todo" />
        <span className="font-semibold">Seu horário</span>
        {/* No celular o horário desce para a linha de baixo, inteiro. */}
        <span className="tabular order-last min-w-0 basis-full pl-[23px] text-muted sm:order-none sm:flex-1 sm:basis-auto sm:pl-0">
          {describeWindows(settings.windows).join(" · ")}
          {breaks && ` · ${breaks}`}
        </span>
        <span className="ml-auto font-medium text-accent sm:ml-0">Editar</span>
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

// ---------------- Peças ----------------

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
      className="tabular relative rounded border border-dashed border-line px-1.5 py-px font-semibold text-ink before:absolute before:-inset-2 before:content-[''] hover:border-todo hover:text-todo"
      title="Mudar o tempo"
    >
      {fmtMin(task.estimateMin)}
    </button>
  );
}

/** Data da tarefa de uma vez; toque para trocar (hoje, amanhã ou outro dia). Também tira de "Depois". */
function DateChip({ task, label: shown, late: isLate }: { task: Task; label?: string; late?: boolean }) {
  const { uid } = useStore();
  const [open, setOpen] = useState(false);
  const today = todayKey();
  const key = task.date ?? today;
  const d = fromKey(key);
  const short = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
  const late = key < today;
  const label = key === today ? "Hoje" : key === shiftDay(today, 1) ? "Amanhã" : `${WEEKDAY_SHORT[d.getDay()]}, ${short}`;

  const toast = useToast();
  const set = async (date: string) => {
    setOpen(false);
    if (!date || date === task.date) return;
    const before = task.date ?? today;
    await updateTask(uid, task.id, { date, later: false });
    toast(`${task.title} foi para ${dayName(date).toLowerCase()}`, { tone: "info", undo: () => updateTask(uid, task.id, { date: before, later: !!task.later }) });
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx(
          "tabular h-8 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
          (isLate ?? late) ? "border-over/40 text-over hover:bg-over/10" : "border-line hover:bg-sunken",
        )}
        title="Mudar a data"
      >
        {shown ?? (late ? short : label)}
      </button>
      {open && <DayMenu value={key} task={task} onPick={set} onClose={() => setOpen(false)} />}
    </div>
  );
}
