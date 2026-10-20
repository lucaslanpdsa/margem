"use client";

import { Bell, Minus, MoreHorizontal, Plus, RotateCcw, SkipForward } from "lucide-react";
import { useState } from "react";
import { saveSettings } from "@/lib/db";
import { countToday, isRunning, pausePomodoro, skipPhase, startPomodoro, switchPhase } from "@/lib/pomodoro";
import { useStore } from "./store";
import { pomodoroDisplay, useNow } from "./Timer";
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
  const clock = p ? pomodoroDisplay(p, now).text : `${String(settings.focusMin).padStart(2, "0")}:00`;
  const done = countToday(p);

  const tab = (value: "focus" | "break", label: string) => (
    <button
      onClick={() => value !== phase || running || paused ? switchPhase(uid, settings, value) : undefined}
      aria-pressed={phase === value}
      className={cx("rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors", phase === value ? "bg-surface/80 text-ink shadow-sm" : "text-ink/60 hover:text-ink")}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-md flex-col items-center justify-center gap-5 lg:min-h-[calc(100dvh-5rem)]">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Pomodoro</h2>
        <IconButton label="Configurar pomodoro" onClick={() => setMenu(true)}>
          <MoreHorizontal size={18} />
        </IconButton>
      </div>

      {/* Cartão no estilo do Pomofocus: a cor muda entre foco e pausa. */}
      <section className={cx("w-full rounded-3xl px-6 pt-5 pb-7 text-center transition-colors duration-500", brk ? "bg-done/15" : "bg-todo/12")}>
        <div className="inline-flex gap-1 rounded-xl bg-ink/5 p-1">
          {tab("focus", "Foco")}
          {tab("break", "Pausa")}
        </div>
        <p className="tabular mt-6 text-[88px] leading-none font-semibold tracking-tight sm:text-[104px]">{clock}</p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            onClick={() => (running ? pausePomodoro(uid, settings) : startPomodoro(uid, settings))}
            className={cx(
              "h-14 w-48 rounded-2xl bg-surface text-lg font-bold tracking-wide uppercase shadow-[0_6px_0_var(--line)] transition-transform active:translate-y-1 active:shadow-none",
              brk ? "text-done" : "text-todo",
            )}
          >
            {running ? "Pausar" : paused ? "Continuar" : "Começar"}
          </button>
          {(running || paused) && (
            <IconButton label={brk ? "Pular pausa" : "Pular para a pausa"} onClick={() => skipPhase(uid, settings)} className="h-12 w-12 text-ink/70">
              <SkipForward size={22} fill="currentColor" />
            </IconButton>
          )}
        </div>
      </section>

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

