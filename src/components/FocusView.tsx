"use client";

import { Bell, Minus, MoreHorizontal, Pause, Play, Plus, RotateCcw, SkipForward } from "lucide-react";
import { useState } from "react";
import { saveSettings } from "@/lib/db";
import { countToday, isRunning, pausePomodoro, skipPhase, startPomodoro, switchPhase } from "@/lib/pomodoro";
import { useStore } from "./store";
import { pomodoroDisplay, pomodoroLabel, useNow } from "./Timer";
import { Button, IconButton, Modal, Switch, cx } from "./ui";

/**
 * Foco: o pomodoro como recurso avulso, no estilo do Pomofocus.
 * Não registra tempo e não fala de tarefas; o cronômetro (que registra) aparece só na barra flutuante.
 */
export function FocusView() {
  const { uid, settings } = useStore();
  const now = useNow();
  const p = settings.pomodoro;
  const [menu, setMenu] = useState(false);
  const phase = p?.phase ?? "focus";
  const brk = phase === "break";
  const running = isRunning(p);
  const paused = !!p && p.pausedLeftMs !== undefined;
  const pd = p ? pomodoroDisplay(p, now) : null;
  const clock = pd?.text ?? `${String(settings.focusMin).padStart(2, "0")}:00`;
  const done = countToday(p);

  const tab = (value: "focus" | "break", label: string) => (
    <button
      onClick={() => value !== phase || running || paused ? switchPhase(uid, settings, value) : undefined}
      aria-pressed={phase === value}
      className={cx("rounded-lg px-5 py-1.5 text-sm font-semibold transition-colors", phase === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-md flex-col items-center justify-center gap-6 lg:min-h-[calc(100dvh-5rem)]">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Pomodoro</h2>
        <IconButton label="Configurar pomodoro" onClick={() => setMenu(true)}>
          <MoreHorizontal size={18} />
        </IconButton>
      </div>

      <div className="inline-flex gap-1 rounded-xl bg-sunken p-1">
        {tab("focus", "Foco")}
        {tab("break", "Pausa")}
      </div>

      {/* O anel vai se preenchendo; azul no foco, verde na pausa. */}
      <div className={brk ? "text-done" : "text-todo"}>
        <Ring pct={pd ? pd.pct : 0} size={280}>
          <span className="tabular text-[72px] leading-none font-semibold tracking-tight text-ink">{clock}</span>
          <span className="mt-3 text-sm text-muted">{p ? pomodoroLabel(p) : "Pronto para focar"}</span>
        </Ring>
      </div>

      <div className="flex w-full items-center justify-center gap-3">
        <button
          onClick={() => (running ? pausePomodoro(uid, settings) : startPomodoro(uid, settings))}
          className={cx(
            "flex h-14 flex-1 items-center justify-center gap-2 rounded-full text-base font-semibold transition-colors",
            running ? "border border-line bg-surface text-ink hover:bg-sunken" : "bg-brand text-brand-ink hover:bg-brand/90",
          )}
        >
          {running ? <Pause size={16} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          {running ? "Pausar" : paused ? "Continuar" : brk ? "Começar pausa" : "Começar foco"}
        </button>
        {(running || paused) && (
          <IconButton label={brk ? "Pular pausa" : "Pular para a pausa"} onClick={() => skipPhase(uid, settings)} className="h-14 w-14 rounded-full border border-line bg-surface">
            <SkipForward size={20} />
          </IconButton>
        )}
      </div>

      <div className="text-center">
        <p className="tabular text-sm text-muted">#{brk ? done : done + 1}</p>
        <p className="mt-0.5 font-semibold">{brk ? "Hora da pausa!" : "Hora de focar!"}</p>
        {done > 0 && <p className="mt-1 text-xs text-muted">{done === 1 ? "1 pomodoro hoje" : `${done} pomodoros hoje`}</p>}
      </div>

      {(running || paused) && (
        <button onClick={() => switchPhase(uid, settings, "focus")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
          <RotateCcw size={13} /> Zerar
        </button>
      )}

      {menu && <PomodoroMenu onClose={() => setMenu(false)} />}
    </div>
  );
}

function Ring({ pct, size = 300, children }: { pct: number; size?: number; children: React.ReactNode }) {
  const stroke = 10;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const fill = pct / 100;
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

