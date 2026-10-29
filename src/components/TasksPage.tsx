"use client";

import { Archive, ArchiveRestore, Check, ChevronDown, Clock, Plus, Search } from "lucide-react";
import { useState } from "react";
import { WEEKDAY_SHORT, dayName, fmtMin, fromKey, parseDuration, parseQuickAdd, shiftDay, todayKey, weekDays } from "@/lib/dates";
import { addTask, saveSettings, toggleDone, updateTask } from "@/lib/db";
import { dayMetrics, type DayItem, type DayMetrics } from "@/lib/metrics";
import { allSlotsOutside, slotsOf, toMin, weekdayCapacity } from "@/lib/schedule";
import type { DayWindow, Task } from "@/lib/types";
import { DayMenu } from "./DayMenu";
import { useToast } from "./toast";
import { useDialogs } from "./dialogs";
import { useStore } from "./store";
import { ScheduleEditor, type Schedule } from "./ScheduleEditor";
import { Button, Modal, Segmented, cx, inputCls } from "./ui";
import { useNow } from "./Timer";

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

export function TasksPage({ onOpenDay }: { onOpenDay: (date: string) => void }) {
  const { tasks } = useStore();
  const [query, setQuery] = useState("");
  const q = norm(query.trim());
  const match = (t: Task) => !q || norm(t.title).includes(q);

  const active = tasks.filter((t) => !t.archived);
  const routine = active.filter((t) => t.repeat === "weekdays").sort(byTimeThenTitle);
  // As de "Depois" ficam na aba Depois.
  const once = active.filter((t) => t.repeat === "once" && !t.completedAt && !t.later);
  // Concluídas nos últimos 7 dias, para reabrir uma concluída por engano.
  const weekAgo = shiftDay(todayKey(), -7);
  const done = active
    .filter((t) => t.repeat === "once" && t.completedAt && t.completedAt.slice(0, 10) >= weekAgo)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  const paused = tasks.filter((t) => t.archived && !(t.repeat === "once" && t.completedAt));

  return (
    // No computador: "Repetem" ao lado de "Não repetem".
    <div className="mx-auto max-w-3xl space-y-4 lg:max-w-6xl">
      {/* Horário numa linha e a semana como agenda, na largura toda. */}
      <div className="space-y-2">
        <ScheduleCard />
        <WeekCard onOpenDay={onOpenDay} />
      </div>

      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tarefa" aria-label="Buscar tarefa" className={cx(inputCls, "pl-9")} />
      </label>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <RoutineCard tasks={routine} visible={routine.filter(match)} searching={!!q} />
        <div className="space-y-4">
          <OnceCard tasks={once.filter(match)} done={done.filter(match)} searching={!!q} />
          {paused.filter(match).length > 0 && <PausedCard tasks={paused.filter(match)} />}
        </div>
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

// ---------------- Repetem ----------------

function RoutineCard({ tasks, visible, searching }: { tasks: Task[]; visible: Task[]; searching: boolean }) {
  const { uid, settings } = useStore();
  const { editTask } = useDialogs();

  async function quickAdd(text: string) {
    const { title, minutes } = parseQuickAdd(text);
    if (!title) return;
    // Começa nos dias que têm horário; os dias se ajustam depois na própria linha.
    const days = WEEK.filter((d) => settings.windows[d]);
    const weekdays = (days.length ? days : [1, 2, 3, 4, 5]).sort();
    if (minutes === null) return editTask({ title, repeat: "weekdays", weekdays });
    await addTask(uid, { title, repeat: "weekdays", weekdays, estimateMin: minutes });
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
            <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:px-5">
              <TaskName task={t} />
              <div className="flex shrink-0 gap-1 sm:gap-1">
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
                        "h-10 flex-1 rounded-md text-[11px] font-semibold transition-colors sm:h-8 sm:w-10 sm:flex-none",
                        // Azul claro para ligado: o azul forte fica para os botões de ação.
                        on ? "bg-todo/15 text-todo hover:bg-todo/25" : "text-muted/80 ring-1 ring-line ring-inset hover:bg-sunken hover:text-ink",
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

      <QuickAdd placeholder="Nova que repete, ex: Academia 1h" onAdd={quickAdd} />
    </section>
  );
}

// ---------------- Não repetem ----------------

function OnceCard({ tasks, done, searching }: { tasks: Task[]; done: Task[]; searching: boolean }) {
  const { uid } = useStore();
  const { editTask } = useDialogs();
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
    if (minutes === null) return editTask({ title, repeat: "once", date: today });
    await addTask(uid, { title, repeat: "once", date: today, estimateMin: minutes });
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

      {done.length > 0 && <DoneGroup tasks={done} />}

      <QuickAdd placeholder="Nova para hoje, ex: Revisar PR 45m" onAdd={quickAdd} />
    </section>
  );
}

/** Concluídas nos últimos 7 dias, recolhidas, com Reabrir. */
function DoneGroup({ tasks }: { tasks: Task[] }) {
  const { uid } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-line">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-1 px-4 pt-3 pb-2 text-left text-xs font-semibold tracking-wide text-muted uppercase sm:px-5">
        <ChevronDown size={14} className={cx("transition-transform", !open && "-rotate-90")} />
        Concluídas · últimos 7 dias <span className="font-normal">· {tasks.length}</span>
      </button>
      {open && (
        <ul className="pb-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-2 sm:px-5">
              <Check size={15} className="shrink-0 text-done" />
              <span className="min-w-0 flex-1 truncate text-sm text-muted line-through">{t.title}</span>
              <span className="shrink-0 text-xs text-muted">{dayName(t.completedAt!.slice(0, 10)).toLowerCase()}</span>
              <button
                onClick={() => {
                  toggleDone(uid, t, t.date ?? todayKey(), false);
                  toast(`${t.title} reaberta`, { tone: "info", undo: () => toggleDone(uid, t, t.date ?? todayKey(), true) });
                }}
                className="h-9 shrink-0 rounded-full border sm:h-8 border-line px-3 text-[13px] font-medium hover:bg-sunken"
              >
                Reabrir
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------- Esta semana ----------------

/**
 * A semana dia a dia: quanto sobra (ou falta) em cada dia e, embaixo, as tarefas nos horários delas (calendário no computador, lista no celular).
 * Dias passados mostram o feito. Tocar num dia abre o Dia nele (no celular, mostra a lista dele).
 */
function WeekCard({ onOpenDay }: { onOpenDay: (date: string) => void }) {
  const { settings, tasks, blocks, sessions, days: dayDocs } = useStore();
  const now = new Date(useNow(60000));
  const today = todayKey(now);
  const [next, setNext] = useState(false);
  const days = weekDays(next ? shiftDay(today, 7) : today);
  const ms = days.map((d) => dayMetrics(d, settings, tasks, blocks, sessions, now, dayDocs[d]));
  // Dia aberto no celular: hoje (ou segunda, na próxima semana) até tocar em outro.
  const [picked, setPicked] = useState<string | null>(null);
  const shown = picked && days.includes(picked) ? picked : days.includes(today) ? today : days[0];
  const shownMetrics = ms.find((m) => m.date === shown);
  // Calendário fechado por padrão: a prioridade da tela são as tarefas. A escolha fica lembrada no aparelho.
  const [cal, setCalState] = useState(() => {
    try {
      return localStorage.getItem(CAL_KEY) === "1";
    } catch {
      return false;
    }
  });
  const setCal = (v: boolean) => {
    setCalState(v);
    try {
      localStorage.setItem(CAL_KEY, v ? "1" : "0");
    } catch {
      /* sem armazenamento: vale só agora */
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5">
        {/* O número de cada dia já diz se cabe; sem frase de resumo. */}
        <h2 className="text-[15px] font-semibold">{next ? "Próxima semana" : "Esta semana"}</h2>
        <div className="flex items-center gap-2">
        <button
          onClick={() => setCal(!cal)}
          aria-expanded={cal}
          className="hidden h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-muted hover:bg-sunken hover:text-ink lg:inline-flex"
        >
          <ChevronDown size={14} className={cx("transition-transform", !cal && "-rotate-90")} /> {cal ? "Esconder horários" : "Ver horários"}
        </button>
        <Segmented
          value={next ? "next" : "this"}
          onChange={(v) => setNext(v === "next")}
          options={[
            { value: "this", label: "Esta" },
            { value: "next", label: "Próxima" },
          ]}
        />
        </div>
      </header>
      {/* Celular: faixa de dias; o dia escolhido mostra as atividades embaixo. Computador: 7 colunas com as atividades. */}
      <div className={cx(GRID_COLS, "gap-1 px-2 pb-3 sm:px-4")}>
        <span className="hidden lg:block" />
        {ms.map((m) => {
          const d = fromKey(m.date);
          const past = m.date < today;
          const isToday = m.date === today;
          const late = !past && m.freeMin < 0;
          const value = !m.window ? "–" : past ? fmtMin(m.doneMin) : late ? `-${fmtMin(-m.freeMin)}` : fmtMin(m.freeMin);
          return (
            <div key={m.date} className="min-w-0">
              <button
                onClick={() => (isDesktop() ? onOpenDay(m.date) : setPicked(m.date))}
                className={cx(
                  "flex min-h-16 w-full flex-col items-center justify-center rounded-xl px-0.5 py-2 transition-colors hover:bg-sunken",
                  isToday && "bg-todo/[0.07] ring-1 ring-todo/40",
                  shown === m.date && !isToday && "bg-sunken lg:bg-transparent",
                )}
                title={!m.window ? "Sem horário" : past ? `${fmtMin(m.doneMin)} feitos` : late ? `${fmtMin(-m.freeMin)} a mais do que cabe` : `Sobram ${fmtMin(m.freeMin)}`}
              >
                <span className={cx("text-[11px] font-semibold", isToday ? "text-todo" : "text-muted")}>{WEEKDAY_SHORT[d.getDay()]}</span>
                <span className={cx("text-sm font-semibold", past && "text-muted")}>{d.getDate()}</span>
                <span className={cx("tabular mt-0.5 text-[11px] font-semibold", !m.window || past ? "text-muted" : late ? "text-over" : "text-done")}>{value}</span>
              </button>
            </div>
          );
        })}
      </div>
      {/* Computador: calendário com os horários. */}
      {cal && <WeekCalendar ms={ms} now={now} today={today} />}
      {/* Celular: atividades do dia escolhido. */}
      {shownMetrics && (
        <div className="border-t border-line px-4 pt-3 pb-4 lg:hidden">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[13px] font-semibold first-letter:uppercase">{dayName(shownMetrics.date).toLowerCase()}</p>
            <button onClick={() => onOpenDay(shownMetrics.date)} className="text-[13px] font-medium text-accent">
              Abrir o dia ›
            </button>
          </div>
          <DayActivities m={shownMetrics} />
        </div>
      )}
    </section>
  );
}

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

const GRID_COLS = "grid grid-cols-7 lg:grid-cols-[2.5rem_repeat(7,minmax(0,1fr))]";
const HOUR_PX = 34;
const CAL_KEY = "margem.semana.horarios";

/** Cor do bloco: concluída, extra (fora do seu horário) ou normal. */
const itemCls = (i: DayItem) =>
  i.completed ? "border-done bg-done/[0.08] text-muted" : i.outside ? "border-break bg-break/[0.08]" : "border-todo bg-todo/[0.08]";

interface CalEvent {
  item: DayItem;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

/** Horários do dia em faixas: o que se sobrepõe divide a largura da coluna. */
function dayEvents(m: DayMetrics): CalEvent[] {
  const evs = m.items
    .filter((i) => !i.skipped)
    .flatMap((item) => slotsOf(item.task).map((sl) => ({ item, start: toMin(sl.start), end: Math.max(toMin(sl.end), toMin(sl.start) + 15), lane: 0, lanes: 1 })))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let group: CalEvent[] = [];
  let groupEnd = -1;
  const close = () => group.forEach((e) => (e.lanes = Math.max(...group.map((g) => g.lane)) + 1));
  for (const e of evs) {
    if (e.start >= groupEnd) {
      close();
      group = [];
      groupEnd = -1;
    }
    const used = new Set(group.filter((g) => g.end > e.start).map((g) => g.lane));
    while (used.has(e.lane)) e.lane++;
    group.push(e);
    groupEnd = Math.max(groupEnd, e.end);
  }
  close();
  return evs;
}

/**
 * Calendário da semana (só no computador): cada tarefa no horário dela, o seu horário em branco e o resto em cinza.
 * Tarefas sem horário ficam numa faixa em cima, como "dia inteiro" de um calendário. Tocar abre o formulário da tarefa.
 */
function WeekCalendar({ ms, now, today }: { ms: DayMetrics[]; now: Date; today: string }) {
  const { openTask } = useDialogs();
  const events = ms.map(dayEvents);
  const untimed = ms.map((m) => m.items.filter((i) => !i.skipped && !slotsOf(i.task).length));
  // Faixa de horas: do mais cedo ao mais tarde entre o seu horário e as tarefas.
  const mins = ms.flatMap((m, d) => [...(m.window ? [toMin(m.window.start), toMin(m.window.end)] : []), ...events[d].flatMap((e) => [e.start, e.end])]);
  if (!mins.length && !untimed.some((u) => u.length)) return null;
  const from = Math.floor(Math.min(...(mins.length ? mins : [480])) / 60);
  const to = Math.min(24, Math.ceil(Math.max(...(mins.length ? mins : [1080])) / 60));
  const hours = Array.from({ length: to - from }, (_, k) => from + k);
  const y = (min: number) => ((min - from * 60) / 60) * HOUR_PX;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="hidden px-4 pb-4 lg:block">
      {untimed.some((u) => u.length > 0) && (
        <div className={cx(GRID_COLS, "gap-1 border-b border-line pb-2")}>
          <span className="self-center text-[10px] leading-tight text-muted">sem horário</span>
          {untimed.map((list, d) => (
            <ul key={ms[d].date} className="min-w-0 space-y-1">
              {list.map((i) => (
                <li key={i.task.id}>
                  <button
                    onClick={() => openTask(i.task, ms[d].date)}
                    title={`${i.task.title} · ${fmtMin(i.estimateMin)}`}
                    className={cx("flex w-full items-baseline gap-1 rounded-md border-l-2 px-1.5 py-1 text-left text-[11px] hover:brightness-95", itemCls(i))}
                  >
                    <span className={cx("min-w-0 flex-1 truncate font-medium", i.completed && "line-through")}>{i.task.title}</span>
                    <span className="tabular shrink-0 text-muted">{fmtMin(i.estimateMin)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
      {hours.length > 0 && (
        <div className={cx(GRID_COLS, "gap-1 pt-2")}>
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => (
              <span key={h} className={cx("tabular absolute right-1 text-[10px] text-muted", h > from && "-translate-y-1/2")} style={{ top: y(h * 60) }}>
                {`${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>
          {ms.map((m, d) => (
            <div key={m.date} className="relative overflow-hidden rounded-lg bg-sunken/60" style={{ height: hours.length * HOUR_PX }}>
              {/* O seu horário em branco; fora dele, cinza. */}
              {m.window && <div className="absolute inset-x-0 bg-surface" style={{ top: y(toMin(m.window.start)), height: y(toMin(m.window.end)) - y(toMin(m.window.start)) }} />}
              {hours.slice(1).map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: y(h * 60) }} />
              ))}
              {events[d].map((e, k) => {
                const h = y(e.end) - y(e.start);
                const when = `${fmtClock(e.start)}–${fmtClock(e.end)}`;
                return (
                  <button
                    key={k}
                    onClick={() => openTask(e.item.task, ms[d].date)}
                    title={`${e.item.task.title} · ${when}${e.item.outside ? " · extra (fora do seu horário)" : ""}`}
                    className={cx("absolute overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-tight hover:brightness-95", itemCls(e.item))}
                    style={{ top: y(e.start) + 1, height: h - 2, left: `calc(${(e.lane / e.lanes) * 100}% + 2px)`, width: `calc(${100 / e.lanes}% - 4px)` }}
                  >
                    <span className={cx("block truncate font-medium text-ink", e.item.completed && "text-muted line-through")}>{e.item.task.title}</span>
                    {h >= 30 && <span className="tabular block truncate text-muted">{when}</span>}
                  </button>
                );
              })}
              {/* Agora. */}
              {m.date === today && nowMin >= from * 60 && nowMin <= to * 60 && (
                <div className="pointer-events-none absolute inset-x-0 border-t-2 border-over" style={{ top: y(nowMin) }}>
                  <span className="absolute -top-[5px] -left-[3px] size-2 rounded-full bg-over" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const fmtClock = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Atividades de um dia (celular), em ordem de horário: horário, nome, tempo e "extra".
 * Tocar abre o formulário da tarefa (Tarefas é a área de editar; o dia em si abre por "Abrir o dia").
 */
function DayActivities({ m }: { m: DayMetrics }) {
  const { openTask } = useDialogs();
  const items = m.items
    .filter((i) => !i.skipped)
    .sort((a, b) => {
      const sa = slotsOf(a.task)[0]?.start;
      const sb = slotsOf(b.task)[0]?.start;
      if (sa && sb) return toMin(sa) - toMin(sb);
      if (!!sa !== !!sb) return sa ? -1 : 1;
      return a.task.title.localeCompare(b.task.title);
    });
  if (!items.length) return <p className="text-sm text-muted">{m.window ? "Nada planejado." : "Sem horário."}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((i) => {
        const slots = slotsOf(i.task);
        return (
          <li key={i.task.id}>
            <button
              onClick={() => openTask(i.task, m.date)}
              className={cx("flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-left transition-colors hover:brightness-95", itemCls(i))}
            >
              <span className="tabular w-[5.5rem] shrink-0 text-xs leading-snug text-muted">
                {slots.length ? slots.map((sl) => <span key={sl.start} className="block">{`${sl.start}–${sl.end}`}</span>) : "sem horário"}
              </span>
              <span className={cx("min-w-0 flex-1 truncate text-sm font-medium text-ink", i.completed && "text-muted line-through")}>{i.task.title}</span>
              <span className="tabular shrink-0 text-xs text-muted">
                {fmtMin(i.estimateMin)}
                {i.outside && <span className="font-medium text-break"> · extra</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------- Desativadas ----------------

function PausedCard({ tasks }: { tasks: Task[] }) {
  const { uid } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 px-1 text-[13px] font-medium text-muted hover:text-ink">
        <ChevronDown size={14} className={cx("transition-transform", !open && "-rotate-90")} />
        <Archive size={13} /> Desativadas ({tasks.length})
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
                <ArchiveRestore size={12} /> Reativar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------- Peças ----------------

/** Nome (abre a janela da tarefa, igual ao Dia; desativadas abrem a edição) e, embaixo, tempo editável e horários. */
function TaskName({ task, sub }: { task: Task; sub?: string }) {
  const { editTask, openTask } = useDialogs();
  const { settings } = useStore();
  const slots = slotText(task);
  // Horário fora do seu horário em todos os dias dela: não entra nas contas (ex: academia à noite).
  const days = task.repeat === "weekdays" ? (task.weekdays ?? []) : [];
  const extra = days.length > 0 && days.every((d) => allSlotsOutside(task, weekdayCapacity(settings, d).window));
  return (
    <div className="min-w-0 flex-1">
      <button
        onClick={() => (task.archived ? editTask(task) : openTask(task))}
        className="block max-w-full truncate text-left text-sm font-medium hover:text-todo"
        title={task.archived ? "Editar" : "Abrir tarefa"}
      >
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
      className="tabular relative rounded border border-dashed border-line px-1.5 py-px font-semibold text-ink before:absolute before:-inset-2 before:content-[''] hover:border-todo hover:text-todo"
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
          "tabular h-9 rounded-full border px-3 text-[13px] font-medium transition-colors sm:h-8",
          late ? "border-over/40 text-over hover:bg-over/10" : "border-line hover:bg-sunken",
        )}
        title="Mudar a data"
      >
        {late ? short : label}
      </button>
      {open && <DayMenu value={key} task={task} onPick={set} onClose={() => setOpen(false)} />}
    </div>
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
        <button type="submit" className="h-8 shrink-0 rounded-full bg-brand px-3 text-[13px] font-semibold text-brand-ink">
          Criar
        </button>
      )}
    </form>
  );
}
