"use client";

import { Bell, CalendarDays, Check, Inbox, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { captureKind, parseCapture, type Capture } from "@/lib/capture";
import { dayName, fmtMin, todayKey } from "@/lib/dates";
import { addTask, deleteTask, moveToDay, moveToLater, replaceTask, restoreTaskPlace, toggleDone } from "@/lib/db";
import { isReminder } from "@/lib/metrics";
import type { Task } from "@/lib/types";
import { DayMenu } from "./DayMenu";
import { useDialogs } from "./dialogs";
import { useStore } from "./store";
import { useToast } from "./toast";
import { Button, Panel, cx, inputCls } from "./ui";

/** Tempos de um toque, para dar tempo a uma tarefa na hora de colocar num dia. */
export const QUICK_TIMES = [15, 30, 60, 120];

/** Grava o que foi capturado: tarefa no dia (dia + tempo), lembrete (só dia) ou "Depois" (sem dia). */
export async function saveCapture(uid: string, c: Capture) {
  const kind = captureKind(c);
  if (kind === "later") return addTask(uid, { title: c.title, repeat: "once", estimateMin: c.minutes ?? 0, later: true });
  return addTask(uid, { title: c.title, repeat: "once", date: c.date!, estimateMin: kind === "task" ? c.minutes! : 0 });
}

/** O que vai acontecer, em palavras, antes de apertar Enter. */
export function captureHint(c: Capture) {
  const kind = captureKind(c);
  if (kind === "later") return `Vai para Depois${c.minutes ? ` com ${fmtMin(c.minutes)}` : ""}. Coloque um dia no fim (amanhã, sexta, dia 10) para virar lembrete.`;
  if (kind === "reminder") return `Lembrete ${dayName(c.date!).toLowerCase()}. Com tempo no fim (45m, 1h) vira tarefa do dia.`;
  return `Tarefa ${dayName(c.date!).toLowerCase()} com ${fmtMin(c.minutes!)}.`;
}

/** Campo de capturar: só o título; dia e tempo, se vierem, no fim do texto. */
export function CaptureBox({ autoFocus }: { autoFocus?: boolean }) {
  const { uid } = useStore();
  const toast = useToast();
  const [text, setText] = useState("");
  const c = parseCapture(text, todayKey());

  async function submit() {
    if (!c.title) return;
    const id = await saveCapture(uid, c);
    const kind = captureKind(c);
    toast(kind === "later" ? `${c.title} foi para Depois` : kind === "reminder" ? `Lembrete: ${c.title}` : `${c.title} criada`, {
      tone: "info",
      undo: () => deleteTask(uid, id),
    });
    setText("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="relative">
        <Plus size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          className={cx(inputCls, "pl-9")}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tirar da cabeça, ex: Pagar luz dia 10"
          aria-label="Capturar"
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">{text ? captureHint(c) : "Só o título já basta. Enter guarda."}</p>
    </form>
  );
}

/** "15m 30m 1h 2h · Lembrete": o tempo da tarefa ao entrar num dia, num toque. */
export function TimeChips({ onPick, reminder = true, children }: { onPick: (minutes: number) => void; reminder?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {QUICK_TIMES.map((m) => (
        <button key={m} type="button" onClick={() => onPick(m)} className="tabular h-8 rounded-full border border-line px-2.5 text-[13px] font-medium hover:border-brand hover:bg-brand hover:text-brand-ink">
          {fmtMin(m)}
        </button>
      ))}
      {reminder && (
        <button type="button" onClick={() => onPick(0)} className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-2.5 text-[13px] font-medium text-muted hover:text-ink">
          <Bell size={13} /> Lembrete
        </button>
      )}
      {children}
    </div>
  );
}

/**
 * Item de "Depois" com o que dá para fazer com ele: trazer para um dia (com o tempo num toque, se não tiver),
 * concluir ou excluir. Usado na aba Depois e no "Planejar o dia".
 */
export function LaterRow({ task, compact }: { task: Task; compact?: boolean }) {
  const { uid } = useStore();
  const { openTask } = useDialogs();
  const toast = useToast();
  const [choosing, setChoosing] = useState(false);
  const [moving, setMoving] = useState(false);
  const today = todayKey();

  const bring = (date: string, minutes?: number) => {
    moveToDay(uid, task, date, minutes);
    const what = minutes === 0 || (minutes === undefined && task.estimateMin === 0) ? "como lembrete" : "";
    toast(`${task.title} foi para ${dayName(date).toLowerCase()} ${what}`.trim(), { tone: "info", undo: () => restoreTaskPlace(uid, task) });
    setChoosing(false);
  };

  return (
    <li className="rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-2 pl-3">
        {!compact && (
          <button
            onClick={() => {
              toggleDone(uid, task, today, true);
              toast(`${task.title} concluída`, { undo: () => toggleDone(uid, task, today, false) });
            }}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-line hover:border-done"
            aria-label="Concluir"
            title="Concluir"
          />
        )}
        <button onClick={() => openTask(task)} className="min-w-0 flex-1 py-2.5 text-left">
          <span className="line-clamp-2 text-sm font-medium">{task.title}</span>
          <span className="tabular text-xs text-muted">{task.estimateMin > 0 ? fmtMin(task.estimateMin) : "sem tempo"}</span>
        </button>
        <Button size="sm" variant="secondary" onClick={() => (task.estimateMin > 0 ? bring(today) : setChoosing((v) => !v))} aria-expanded={choosing}>
          Hoje
        </Button>
        {!compact && (
          <>
            <div className="relative">
              <button onClick={() => setMoving((v) => !v)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink" aria-label={`Outro dia para ${task.title}`} title="Outro dia">
                <CalendarDays size={15} />
              </button>
              {moving && (
                <DayMenu
                  value={today}
                  task={task}
                  onClose={() => setMoving(false)}
                  onPick={(d) => {
                    setMoving(false);
                    bring(d);
                  }}
                />
              )}
            </div>
            <button
              onClick={() => {
                deleteTask(uid, task.id);
                toast(`${task.title} excluída`, { undo: () => replaceTask(uid, task) });
              }}
              className="mr-1.5 grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-over"
              aria-label={`Excluir ${task.title}`}
              title="Excluir"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
        {compact && <span className="w-1.5" />}
      </div>
      {choosing && (
        <div className="border-t border-line px-3 py-2.5">
          <p className="mb-1.5 text-xs text-muted">Quanto tempo hoje?</p>
          <TimeChips onPick={(m) => bring(today, m)} />
        </div>
      )}
    </li>
  );
}

/** Lembrete na lista: concluir, abrir, mandar para Depois ou excluir. */
export function ReminderRow({ task, showDay }: { task: Task; showDay?: boolean }) {
  const { uid } = useStore();
  const { openTask } = useDialogs();
  const toast = useToast();
  const done = !!task.completedAt;
  return (
    <li className="flex items-center gap-2.5 rounded-lg px-1 py-1">
      <button
        onClick={() => {
          toggleDone(uid, task, task.date ?? todayKey(), !done);
          if (!done) toast(`${task.title} feito`, { undo: () => toggleDone(uid, task, task.date ?? todayKey(), false) });
        }}
        className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", done ? "border-done bg-done text-white" : "border-line hover:border-done")}
        aria-label={done ? "Desmarcar" : "Feito"}
      >
        {done && <Check size={11} strokeWidth={3} />}
      </button>
      <Bell size={13} className="shrink-0 text-muted" />
      <button onClick={() => openTask(task)} className={cx("min-w-0 flex-1 truncate text-left text-sm", done && "text-muted line-through")}>
        {task.title}
      </button>
      {showDay && task.date && <span className="tabular shrink-0 text-xs text-muted">{dayName(task.date)}</span>}
      {!done && (
        <button
          onClick={() => {
            moveToLater(uid, task);
            toast(`${task.title} foi para Depois`, { tone: "info", undo: () => restoreTaskPlace(uid, task) });
          }}
          className="shrink-0 text-xs font-medium text-accent hover:underline"
        >
          Depois
        </button>
      )}
    </li>
  );
}

/** Itens em "Depois", os mais novos primeiro. */
export const laterTasks = (tasks: Task[]) =>
  tasks.filter((t) => t.repeat === "once" && t.later && !t.archived && !t.completedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** Aba Depois: capturar, a caixa e os próximos lembretes. */
export function LaterPage() {
  const { tasks } = useStore();
  const today = todayKey();
  const later = laterTasks(tasks);
  const reminders = tasks
    .filter((t) => isReminder(t) && !t.archived && !t.completedAt && (t.date ?? today) >= today)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  return (
    <div className="mx-auto grid max-w-3xl gap-4 lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
      <div className="min-w-0 space-y-4">
        <Panel className="p-5">
          <h2 className="mb-3 text-[15px] font-semibold">Capturar</h2>
          <CaptureBox />
        </Panel>
        <Panel className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <Inbox size={16} className="text-muted" /> Depois {later.length > 0 && <span className="tabular text-sm font-normal text-muted">({later.length})</span>}
          </h2>
          {later.length ? (
            <ul className="space-y-1.5">
              {later.map((t) => (
                <LaterRow key={t.id} task={t} />
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-muted">Nada esperando. O que aparecer na cabeça, escreva aqui em cima: na hora de planejar o dia, você escolhe o que entra.</p>
          )}
        </Panel>
      </div>
      <Panel className="p-5">
        <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold">
          <Bell size={16} className="text-muted" /> Próximos lembretes
        </h2>
        <p className="mb-2 text-xs text-muted">Coisas com dia e sem tempo: aparecem no dia, sem ocupar horas.</p>
        {reminders.length ? (
          <ul>
            {reminders.map((t) => (
              <ReminderRow key={t.id} task={t} showDay />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhum. Escreva &quot;Pagar luz dia 10&quot; para criar um.</p>
        )}
      </Panel>
    </div>
  );
}
