"use client";

import { Bell, Check, ChevronDown, Minus, MoreHorizontal, Play, Plus, Square, Timer as TimerIcon } from "lucide-react";
import { useState } from "react";
import { fmtMin, todayKey } from "@/lib/dates";
import { saveSettings } from "@/lib/db";
import { dayItems } from "@/lib/metrics";
import { goToBreak, skipBreak, startPomodoro, startWaiting, stopPomodoro } from "@/lib/pomodoro";
import type { Task } from "@/lib/types";
import { DayEntries } from "./TimeEntries";
import { useStore } from "./store";
import { pomodoroDisplay, pomodoroLabel, stopwatchText, useNow } from "./Timer";
import { Button, IconButton, Modal, Switch, cx, inputCls } from "./ui";
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
        <span className={cx("min-w-0 flex-1 truncate", !current && "text-muted")}>{current?.task.title ?? "Escolher tarefa"}</span>
        {current?.hint && <span className="tabular shrink-0 text-xs font-normal text-muted">{current.hint}</span>}
        <ChevronDown size={16} className={cx("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <ul className="absolute inset-x-0 bottom-full z-50 mb-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
            {list.map((o) => row(o.task.id, o.task.title, o.hint))}
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

/**
 * Foco: duas coisas independentes na mesma tela.
 * - Pomodoro (em cima): só o ritmo de foco e pausa, com avisos. Não registra tempo.
 * - Cronômetro (embaixo): o que registra horas numa tarefa, do início ao fim.
 */
export function FocusView({ initialTaskId = "" }: { initialTaskId?: string }) {
  const { uid, settings } = useStore();
  const now = useNow();
  const p = settings.pomodoro;
  const [menu, setMenu] = useState(false);
  const pd = p ? pomodoroDisplay(p, now) : null;
  const clock = pd?.text ?? `${String(settings.focusMin).padStart(2, "0")}:00`;
  const status = p ? pomodoroLabel(p) : "Pronto para começar";
  const brk = p?.phase === "break";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-md flex-col items-center justify-center gap-6 lg:min-h-[calc(100dvh-5rem)]">
      <div className="relative flex w-full justify-center">
        <p className="py-1.5 text-sm font-medium text-muted">Pomodoro</p>
        <div className="absolute top-0 right-0">
          <IconButton label="Configurar pomodoro" onClick={() => setMenu(true)}>
            <MoreHorizontal size={18} />
          </IconButton>
        </div>
      </div>

      <div className={brk ? "text-break" : "text-todo"}>
        <Ring pct={pd ? pd.pct : null} active={!!p && !p.waiting} size={260}>
          <span className="tabular text-[68px] leading-none font-semibold tracking-tight text-ink">{clock}</span>
          <span className="mt-3 text-sm text-muted">{status}</span>
        </Ring>
      </div>

      {/* Controles do pomodoro, no estilo do Pomofocus. */}
      <div className="w-full">
        {!p ? (
          <button
            onClick={() => startPomodoro(uid, settings)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-brand-ink hover:bg-brand/90"
          >
            <Play size={15} fill="currentColor" /> Começar foco
          </button>
        ) : p.waiting ? (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              onClick={() => startWaiting(uid, settings)}
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-brand-ink hover:bg-brand/90"
            >
              <Play size={15} fill="currentColor" /> {brk ? "Começar pausa" : "Começar foco"}
            </button>
            <button onClick={() => (brk ? skipBreak(uid, settings) : stopPomodoro(uid))} className="h-14 rounded-full border border-line bg-surface px-5 font-semibold hover:bg-sunken">
              {brk ? "Pular pausa" : "Encerrar"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => stopPomodoro(uid)} className="h-14 rounded-full border border-line bg-surface font-semibold hover:bg-sunken">
              Encerrar
            </button>
            {brk ? (
              <button onClick={() => skipBreak(uid, settings)} className="h-14 rounded-full bg-brand font-semibold text-brand-ink hover:bg-brand/90">
                Pular pausa
              </button>
            ) : (
              <button onClick={() => goToBreak(uid, settings)} className="h-14 rounded-full border border-line bg-surface font-semibold hover:bg-sunken">
                Ir para a pausa
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-center text-xs text-muted">O pomodoro só marca o ritmo. Quem registra as horas é o cronômetro abaixo.</p>
      </div>

      <StopwatchCard initialTaskId={initialTaskId} />

      <History />
      {menu && <PomodoroMenu onClose={() => setMenu(false)} />}
    </div>
  );
}

/** Cartão do cronômetro no Foco: rodando (tarefa, tempo, Parar) ou escolher a tarefa e começar. */
function StopwatchCard({ initialTaskId }: { initialTaskId: string }) {
  const { settings, tasks } = useStore();
  const timer = useTimerActions();
  const now = useNow();
  const t = settings.activeTimer;
  const [taskId, setTaskId] = useState(initialTaskId);
  const runningTask = tasks.find((x) => x.id === t?.taskId);

  return (
    <section className="w-full rounded-2xl border border-line bg-surface p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-muted">
        <TimerIcon size={14} /> Cronômetro · registra as horas
      </p>
      {t ? (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-2">
              <span className="tabular text-2xl font-semibold">{stopwatchText(t, now)}</span>
              <span className={cx("truncate text-sm font-medium", !runningTask && "text-muted")}>{runningTask?.title ?? "Sem tarefa"}</span>
            </p>
            <TimerStart className="block text-xs" />
          </div>
          <Button variant="secondary" onClick={() => timer.stop()}>
            <Square size={12} fill="currentColor" /> Parar
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <TaskSelect value={taskId} onChange={setTaskId} />
          <Button variant="primary" className="h-11 w-full" disabled={!taskId} onClick={() => timer.start(taskId)}>
            <Play size={13} fill="currentColor" /> {taskId ? "Começar cronômetro" : "Escolha a tarefa para começar"}
          </Button>
        </div>
      )}
    </section>
  );
}
