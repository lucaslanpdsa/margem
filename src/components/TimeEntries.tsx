"use client";

import { Check, ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { dayName, entryTimes, fmtMin, parseTimeEntry, shiftDay, todayKey } from "@/lib/dates";
import { addSession, deleteSession, updateSession, watchTaskSessions } from "@/lib/db";
import { isLive, sessionSource } from "@/lib/pomodoro";
import { PREVIEW_UID } from "@/lib/preview";
import type { Session, Task } from "@/lib/types";
import { useStore } from "./store";
import { useToast } from "./toast";
import { Button, IconButton, cx, inputCls } from "./ui";

const QUICK = [15, 30, 60, 120];
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const hasRange = (s: Session) => s.endedAt > s.startedAt;

/** Dia de um registro: Hoje / Ontem / outro dia, em botões, como o "quando" do ClickUp. */
function DayPicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const today = todayKey();
  const yesterday = shiftDay(today, -1);
  const chip = (active: boolean) =>
    cx("h-9 rounded-lg border px-3 text-[13px] font-medium transition-colors", active ? "border-todo bg-todo/10 text-todo" : "border-line hover:bg-sunken");
  const other = value !== today && value !== yesterday;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className={chip(value === today)} onClick={() => onChange(today)}>
        Hoje
      </button>
      <button type="button" className={chip(value === yesterday)} onClick={() => onChange(yesterday)}>
        Ontem
      </button>
      <label className={cx(chip(other), "relative flex items-center")}>
        {other ? dayName(value) : "Outro dia"}
        <input
          type="date"
          value={value}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Escolher o dia"
        />
      </label>
    </div>
  );
}

/**
 * Registrar tempo já feito: atalhos (15m, 30m, 1h, 2h) ou duração/intervalo digitado,
 * com o dia (hoje, ontem, outro) e uma nota opcional.
 */
export function AddTime({ task, defaultDate, onDone }: { task: Task; defaultDate: string; onDone: () => void }) {
  const { uid } = useStore();
  const toast = useToast();
  const [date, setDate] = useState(defaultDate > todayKey() ? todayKey() : defaultDate);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function add(minutes: number, start?: string, end?: string) {
    await addSession(uid, {
      taskId: task.id,
      date,
      minutes,
      kind: "manual",
      ...entryTimes({ minutes, start, end }, date),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    toast(`${fmtMin(minutes)} adicionados em ${task.title} · ${dayName(date).toLowerCase()}`);
    onDone();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {QUICK.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => add(m)}
            className="h-12 rounded-xl border border-line text-base font-semibold transition-colors hover:border-todo hover:bg-todo/[0.06] hover:text-todo"
          >
            {m < 60 ? `${m}m` : `${m / 60}h`}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const entry = parseTimeEntry(text);
          if (!entry) return setError("Escreva a duração (3h 20m, 45m) ou o horário (14:00-15:30).");
          add(entry.minutes, entry.start, entry.end);
        }}
      >
        <input
          className={cx(inputCls, "h-11")}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          placeholder="3h 20m ou 14:00-15:30"
          aria-label="Tempo"
        />
        <Button type="submit" variant="primary" className="h-11">
          Adicionar
        </Button>
      </form>
      {error && <p className="text-sm text-over">{error}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13px] text-muted">Quando</span>
        <DayPicker value={date} onChange={setDate} />
      </div>
      <input className={cx(inputCls, "h-10 text-sm")} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional), ex: revisão do PR 45" aria-label="Nota" />
    </div>
  );
}

/** Todos os registros da tarefa, agrupados por dia (mais recente primeiro), com total do dia. */
export function TaskEntries({ task }: { task: Task }) {
  const { uid, sessions } = useStore();
  // Registros vindos do banco (null = ainda carregando).
  const [all, setAll] = useState<Session[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Na prévia (/dev) não há banco: o histórico vem dos registros de exemplo.
  const preview = uid === PREVIEW_UID;
  useEffect(() => (preview ? undefined : watchTaskSessions(uid, task.id, setAll)), [uid, task.id, preview]);

  // Histórico completo do banco + o timer rodando (que ainda não é um registro).
  const live = sessions.filter((s) => isLive(s) && s.taskId === task.id);
  const stored = preview ? sessions.filter((s) => s.taskId === task.id && !isLive(s)) : all;
  const list = [...(stored ?? []), ...live];
  if (stored === null) return null;
  if (list.length === 0) return <p className="text-sm text-muted">Nenhum registro ainda.</p>;

  const byDay = new Map<string, Session[]>();
  for (const s of list) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
  const days = [...byDay.keys()].sort().reverse();
  const shown = showAll ? days : days.slice(0, 5);
  const total = list.reduce((a, s) => a + s.minutes, 0);

  return (
    <div>
      <p className="mb-2 text-[13px] text-muted">
        Total <b className="tabular font-semibold text-ink">{fmtMin(total)}</b> em {days.length === 1 ? "1 dia" : `${days.length} dias`}
      </p>
      <div className="space-y-3">
        {shown.map((d) => {
          // Mais recente primeiro; os sem horário no fim do dia.
          const items = byDay.get(d)!.sort((a, b) => Number(hasRange(b)) - Number(hasRange(a)) || b.startedAt.localeCompare(a.startedAt));
          return (
            <div key={d}>
              <p className="tabular flex justify-between border-b border-line pb-1 text-xs font-semibold text-muted">
                <span className="tracking-wide uppercase">{dayName(d)}</span>
                <span className="text-ink">{fmtMin(items.reduce((a, s) => a + s.minutes, 0))}</span>
              </p>
              <ul className="divide-y divide-line">
                {items.map((s) => (isLive(s) ? <LiveRow key={s.id} s={s} /> : <EntryRow key={s.id} s={s} />))}
              </ul>
            </div>
          );
        })}
      </div>
      {days.length > 5 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
          <ChevronDown size={14} className={cx("transition-transform", showAll && "rotate-180")} />
          {showAll ? "Mostrar menos" : `Mostrar mais ${days.length - 5} dias`}
        </button>
      )}
    </div>
  );
}

function LiveRow({ s }: { s: Session }) {
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className="tabular w-24 shrink-0 text-muted">{hhmm(s.startedAt)}–agora</span>
      <span className="min-w-0 flex-1 text-xs font-medium text-todo">● rodando</span>
      <span className="tabular font-semibold">{fmtMin(s.minutes)}</span>
    </li>
  );
}

/** Um registro: horário, de onde veio, nota e tempo; lápis edita (tempo, dia, nota), lixeira apaga. */
function EntryRow({ s }: { s: Session }) {
  const { uid } = useStore();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [date, setDate] = useState(s.date);
  const [note, setNote] = useState(s.note ?? "");
  const [invalid, setInvalid] = useState(false);

  function open() {
    setText(hasRange(s) ? `${hhmm(s.startedAt)}-${hhmm(s.endedAt)}` : fmtMin(s.minutes));
    setDate(s.date);
    setNote(s.note ?? "");
    setInvalid(false);
    setEditing(true);
  }

  async function save() {
    const entry = parseTimeEntry(text);
    if (!entry) return setInvalid(true);
    // Sem intervalo novo e sem mudar o dia, mantém o horário que o registro já tinha.
    const keepTimes = !entry.start && date === s.date;
    await updateSession(uid, s.id, {
      minutes: entry.minutes,
      date,
      note: note.trim(),
      ...(keepTimes ? {} : entryTimes(entry, date)),
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="space-y-2 py-2.5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setInvalid(false);
            }}
            aria-label="Tempo do registro"
            aria-invalid={invalid}
            placeholder="3h 20m ou 14:00-15:30"
            className={cx(inputCls, "tabular h-9 text-sm", invalid && "border-over")}
          />
          <IconButton label="Salvar" type="submit" className="text-todo">
            <Check size={16} />
          </IconButton>
          <IconButton label="Cancelar" type="button" onClick={() => setEditing(false)}>
            <X size={16} />
          </IconButton>
        </form>
        <DayPicker value={date} onChange={setDate} />
        <input className={cx(inputCls, "h-9 text-sm")} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" aria-label="Nota" />
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 py-2 text-sm">
      <span className="tabular w-24 shrink-0 text-muted">{hasRange(s) ? `${hhmm(s.startedAt)}–${hhmm(s.endedAt)}` : "sem horário"}</span>
      <span className="min-w-0 flex-1">
        {s.note && <span className="block truncate">{s.note}</span>}
        <span className="block text-xs text-muted">{sessionSource(s)}</span>
      </span>
      <span className="tabular font-semibold">{fmtMin(s.minutes)}</span>
      <span className="flex">
        <IconButton label="Editar registro" onClick={open}>
          <Pencil size={14} />
        </IconButton>
        <IconButton label="Apagar registro" onClick={() => deleteSession(uid, s.id)}>
          <Trash2 size={14} />
        </IconButton>
      </span>
    </li>
  );
}
