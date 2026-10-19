"use client";

import { Bell, Check, ChevronDown, Minus, MoreHorizontal, Play, Plus, Square } from "lucide-react";
import { useState } from "react";
import { fmtMin, todayKey } from "@/lib/dates";
import { saveSettings, updateSession } from "@/lib/db";
import { dayItems } from "@/lib/metrics";
import { isStopwatch, skipBreak, startWaiting } from "@/lib/pomodoro";
import type { Task } from "@/lib/types";
import { DayEntries } from "./TimeEntries";
import { useStore } from "./store";
import { timerDisplay, useNow } from "./Timer";
import { Button, IconButton, Modal, Segmented, Switch, cx, inputCls } from "./ui";
import { useTimerActions } from "./toast";
import { TimerStart } from "./TimerStart";

/** Tarefas que fazem sentido escolher hoje: as do dia ainda abertas. */
export function useTaskOptions() {
  const { tasks, blocks, sessions } = useStore();
  const today = todayKey();
  return dayItems(today, tasks, blocks, sessions)
    .filter((i) => !i.completed && !i.skipped)
    .map((i) => ({ task: i.task, hint: `falta ${fmtMin(i.remainingMin)}` }));
}

/** Escolha da tarefa do foco: lista própria (com quanto falta) em vez da caixa do navegador. */
function TaskSelect({ value, onChange, disabled, extra }: { value: string; onChange: (id: string) => void; disabled?: boolean; extra?: Task }) {
  const options = useTaskOptions();
  const [open, setOpen] = useState(false);
  const list = extra && !options.some((o) => o.task.id === extra.id) ? [...options, { task: extra, hint: "" }] : options;
  const current = list.find((o) => o.task.id === value);
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };
  const row = (id: string, title: string, hint: string) => (
    <li key={id || "none"}>
      <button
        type="button"
        onClick={() => pick(id)}
        className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-sunken", id === value && "bg-todo/[0.08]")}
      >
        <span className={cx("min-w-0 flex-1 truncate font-medium", !id && "text-muted")}>{title}</span>
        {hint && <span className="tabular shrink-0 text-xs text-muted">{hint}</span>}
        {id === value && <Check size={15} className="shrink-0 text-todo" />}
      </button>
    </li>
  );
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Tarefa"
        className={cx(inputCls, "flex h-11 items-center gap-2 text-left font-medium")}
      >
        <span className={cx("min-w-0 flex-1 truncate", !current && "text-muted")}>{current?.task.title ?? "Sem tarefa"}</span>
        {current?.hint && <span className="tabular shrink-0 text-xs font-normal text-muted">{current.hint}</span>}
        <ChevronDown size={16} className={cx("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <ul className="absolute inset-x-0 bottom-full z-50 mb-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
            {list.map((o) => row(o.task.id, o.task.title, o.hint))}
            {row("", "Sem tarefa", "")}
          </ul>
        </>
      )}
    </div>
  );
}

function Ring({ pct, active, size = 300, children }: { pct: number | null; active: boolean; size?: number; children: React.ReactNode }) {
  const stroke = 10;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const fill = pct === null ? (active ? 1 : 0) : pct / 100;
  const mid = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--sunken)" strokeWidth={stroke} />
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fill)}
          transform={`rotate(-90 ${mid} ${mid})`}
          className="transition-[stroke-dashoffset] duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Número em minutos com − e + (bom para o dedo no celular); também aceita digitar. */
function MinutesField({ label, value, step, min, max, onChange }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const set = (v: number) => {
    setDraft(null);
    onChange(Math.max(min, Math.min(max, Math.round(v) || value)));
  };
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      <span className="flex h-12 items-center rounded-xl border border-line">
        <IconButton label={`Menos ${label.toLowerCase()}`} type="button" onClick={() => set(value - step)} className="h-full w-11 rounded-r-none">
          <Minus size={16} />
        </IconButton>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== null && set(Number(draft))}
          onKeyDown={(e) => e.key === "Enter" && draft !== null && set(Number(draft))}
          className="tabular h-full w-full min-w-0 bg-transparent text-center text-lg font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <IconButton label={`Mais ${label.toLowerCase()}`} type="button" onClick={() => set(value + step)} className="h-full w-11 rounded-l-none">
          <Plus size={16} />
        </IconButton>
      </span>
    </label>
  );
}

function PomodoroMenu({ onClose }: { onClose: () => void }) {
  const { uid, settings } = useStore();
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  return (
    <Modal title="Pomodoro" description="Tempo em minutos." onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <MinutesField label="Foco" value={settings.focusMin} step={5} min={5} max={180} onChange={(v) => saveSettings(uid, { focusMin: v })} />
        <MinutesField label="Pausa" value={settings.breakMin} step={1} min={1} max={60} onChange={(v) => saveSettings(uid, { breakMin: v })} />
      </div>
      <div className="mt-5 border-t border-line pt-3">
        <Switch label="Início de foco automático" checked={!!settings.autoStartFocus} onChange={(v) => saveSettings(uid, { autoStartFocus: v })} />
        <Switch label="Pausas automáticas" checked={!!settings.autoStartBreaks} onChange={(v) => saveSettings(uid, { autoStartBreaks: v })} />
      </div>
      {perm !== "unsupported" && (
        <div className="mt-5 border-t border-line pt-4">
          {perm === "granted" ? (
            <p className="text-sm text-done">Você recebe um aviso quando o foco ou a pausa acabam.</p>
          ) : (
            <Button onClick={() => Notification.requestPermission().then(setPerm)}>
              <Bell size={14} /> Avisar quando o tempo acabar
            </Button>
          )}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Pronto
        </Button>
      </div>
    </Modal>
  );
}

/** "Hoje · Xh registrados": a mesma lista de registros do Dia, recolhida. */
function History() {
  const { sessions } = useStore();
  const today = todayKey();
  const total = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.minutes, 0);
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-sunken hover:text-ink">
        <ChevronDown size={15} className={cx("transition-transform", !open && "-rotate-90")} />
        Hoje · <span className="tabular font-semibold text-ink">{fmtMin(total)}</span> registrados
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-surface px-4 py-1">
          <DayEntries date={today} />
        </div>
      )}
    </div>
  );
}

export function FocusView({ initialTaskId = "" }: { initialTaskId?: string }) {
  const { uid, settings, tasks } = useStore();
  const timer = useTimerActions();
  const now = useNow();
  const t = settings.activeTimer;
  // Mesmo modo do ▶ das tarefas: o último usado (cronômetro na primeira vez).
  const [mode, setMode] = useState<"pomodoro" | "stopwatch">(settings.lastTimerMode ?? "stopwatch");
  const [taskId, setTaskId] = useState(initialTaskId);
  const [menu, setMenu] = useState(false);

  const running = !!t;
  const shownMode = t ? (isStopwatch(t) ? "stopwatch" : "pomodoro") : mode;
  const d = t ? timerDisplay(t, now) : null;
  const focus = !t || t.phase === "focus";
  const runningTask = tasks.find((x) => x.id === t?.taskId);

  const clock = d?.text ?? (mode === "pomodoro" ? `${String(settings.focusMin).padStart(2, "0")}:00` : "00:00");
  const status = !t
    ? "Pronto para começar"
    : t.waiting
      ? t.phase === "break"
        ? "Pausa pronta"
        : "Próximo foco"
      : t.phase === "break"
        ? "Pausa"
        : isStopwatch(t)
          ? "Contando"
          : "Foco";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-md flex-col items-center justify-center gap-7 lg:min-h-[calc(100dvh-5rem)]">
      <div className="relative flex w-full justify-center">
        {running ? (
          <p className="py-1.5 text-sm font-medium text-muted">{shownMode === "pomodoro" ? (t?.phase === "break" ? "Pausa" : "Pomodoro") : "Cronômetro"}</p>
        ) : (
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "pomodoro", label: "Pomodoro" },
              { value: "stopwatch", label: "Cronômetro" },
            ]}
          />
        )}
        <div className="absolute top-0 right-0">
          <IconButton label="Configurar pomodoro" onClick={() => setMenu(true)}>
            <MoreHorizontal size={18} />
          </IconButton>
        </div>
      </div>

      <div className={focus ? "text-todo" : "text-break"}>
        <Ring pct={d ? d.pct : null} active={running} size={300}>
          <span className="tabular text-[76px] leading-none font-semibold tracking-tight text-ink">{clock}</span>
          <span className="mt-3 text-sm text-muted">{status}</span>
        </Ring>
      </div>

      <div className="w-full space-y-3">
        {running ? (
          <div className="text-center">
            <p className={cx("text-base font-medium", !runningTask && "text-muted")}>{runningTask?.title ?? "Sem tarefa"}</p>
            <TimerStart className="mt-1 block" />
          </div>
        ) : (
          <TaskSelect value={taskId} onChange={setTaskId} />
        )}

        {!t ? (
          <button
            onClick={() => timer.start(taskId, mode)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-white hover:bg-brand/90"
          >
            <Play size={15} fill="currentColor" /> Começar
          </button>
        ) : t.waiting ? (
          <div className="space-y-2">
            <button
              onClick={() => startWaiting(uid, settings)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-white hover:bg-brand/90"
            >
              <Play size={15} fill="currentColor" /> {t.phase === "break" ? "Começar pausa" : "Começar foco"}
            </button>
            <div className={cx("grid gap-2", t.phase === "break" ? "grid-cols-2" : "grid-cols-1")}>
              <button onClick={() => timer.stop()} className="h-12 rounded-full border border-line bg-surface font-semibold hover:bg-sunken">
                Encerrar
              </button>
              {t.phase === "break" && (
                <button onClick={() => skipBreak(uid, settings)} className="h-12 rounded-full border border-line bg-surface font-semibold hover:bg-sunken">
                  Pular pausa
                </button>
              )}
            </div>
          </div>
        ) : t.phase === "focus" ? (
          <button
            onClick={() => timer.stop()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full border border-line bg-surface text-base font-semibold hover:bg-sunken"
          >
            <Square size={13} fill="currentColor" /> Parar e registrar
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => timer.stop()} className="h-14 rounded-full border border-line bg-surface font-semibold hover:bg-sunken">
              Encerrar
            </button>
            <button onClick={() => skipBreak(uid, settings)} className="h-14 rounded-full bg-brand font-semibold text-white hover:bg-brand/90">
              Próximo foco
            </button>
          </div>
        )}
      </div>

      <History />
      {menu && <PomodoroMenu onClose={() => setMenu(false)} />}
    </div>
  );
}

/** Depois de um foco sem tarefa: "Em que você trabalhou?" */
export function AssignDialog() {
  const { uid, settings, sessions } = useStore();
  const options = useTaskOptions();
  const [choice, setChoice] = useState("");
  const session = sessions.find((s) => s.id === settings.pendingAssign);
  if (!settings.pendingAssign || !session) return null;

  const close = async (taskId?: string) => {
    if (taskId) await updateSession(uid, session.id, { taskId });
    await saveSettings(uid, { pendingAssign: null });
  };

  return (
    <Modal title="Em que você trabalhou?" description={`${fmtMin(session.minutes)} de foco sem tarefa. O tempo entra na tarefa escolhida; sem tarefa, conta só no seu dia.`} onClose={() => close()}>
      <fieldset className="space-y-1.5">
        <legend className="sr-only">Tarefa</legend>
        {[...options, { task: { id: "", title: "Sem tarefa por enquanto" } as Task, hint: "" }].map((o) => (
          <label
            key={o.task.id || "none"}
            className={cx(
              "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4",
              choice === o.task.id ? "border-todo bg-todo/[0.06] ring-1 ring-todo" : "border-line",
              !o.task.id && "border-dashed",
            )}
          >
            <input type="radio" name="assign" checked={choice === o.task.id} onChange={() => setChoice(o.task.id)} className="accent-[var(--brand)]" />
            <span className={cx("flex-1 text-sm font-medium", !o.task.id && "text-muted")}>{o.task.title}</span>
            {o.hint && <span className="text-xs text-muted">{o.hint}</span>}
          </label>
        ))}
      </fieldset>
      <div className="mt-5 flex justify-end">
        <Button variant="primary" onClick={() => close(choice || undefined)}>
          Salvar
        </Button>
      </div>
    </Modal>
  );
}
