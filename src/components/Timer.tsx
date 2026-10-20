"use client";

import { Brain, Coffee, Square, Timer as TimerIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { finishPhase, notify, remainingMs, skipBreak, startWaiting } from "@/lib/pomodoro";
import type { ActiveTimer, PomodoroState } from "@/lib/types";
import { useStore } from "./store";
import { Button, cx } from "./ui";
import { useTimerActions } from "./toast";
import { TimerStart } from "./TimerStart";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
};

/** Cronômetro: tempo desde o início. */
export const stopwatchText = (t: ActiveTimer, now: number) => mmss(now - Date.parse(t.startedAt));

/** Pomodoro: contagem regressiva da fase e quanto dela já passou (0–100). */
export function pomodoroDisplay(p: PomodoroState, now: number) {
  const total = p.durationMin * 60000;
  const left = remainingMs(p, now);
  return { text: mmss(Math.ceil(left / 1000) * 1000), pct: p.waiting ? 0 : Math.min(100, Math.max(0, ((total - left) / total) * 100)), left };
}

export const pomodoroLabel = (p: PomodoroState) => (p.waiting ? (p.phase === "break" ? "Pausa pronta" : "Próximo foco") : p.phase === "break" ? "Pausa" : "Foco");

/**
 * Motor dos timers (sempre montado) + barra flutuante.
 * O cronômetro só conta; o pomodoro troca de fase sozinho e avisa. A barra some na tela de Foco.
 */
export function Timer({ hidden, onOpen }: { hidden?: boolean; onOpen?: () => void }) {
  const { uid, settings, tasks } = useStore();
  const t = settings.activeTimer;
  const p = settings.pomodoro;
  const now = useNow();
  const handled = useRef<string | null>(null);
  const timer = useTimerActions();
  const task = tasks.find((x) => x.id === t?.taskId);
  const pd = p ? pomodoroDisplay(p, now) : null;

  // Fim de uma fase do pomodoro: avisa e passa para a próxima (não grava tempo).
  useEffect(() => {
    if (!p || p.waiting || !pd || pd.left > 0 || handled.current === p.startedAt) return;
    handled.current = p.startedAt;
    if (p.phase === "focus") notify("Hora da pausa", settings.autoStartBreaks ? `A pausa de ${settings.breakMin}min começou.` : "Foco concluído.");
    else notify("Pausa terminou", settings.autoStartFocus ? "O próximo foco começou." : "Pronto para o próximo?");
    finishPhase(uid, settings, p);
  }, [p, pd, uid, settings]);

  useEffect(() => {
    const parts = [pd && p ? `${pd.text} ${pomodoroLabel(p)}` : "", t ? `${stopwatchText(t, now)} ${task?.title ?? ""}` : ""].filter(Boolean);
    document.title = parts.length ? parts.join(" · ") : "Margem";
  }, [t, p, pd, now, task?.title]);

  if ((!t && !p) || hidden) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96">
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        {/* Cronômetro: o que está sendo registrado. */}
        {t && (
          <div className="flex items-center gap-3 px-3 py-2.5">
            <button onClick={onOpen} title="Abrir o Foco" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-todo/10 text-todo">
              <TimerIcon size={17} />
            </button>
            <div className="min-w-0 flex-1">
              <button onClick={onOpen} className="flex w-full min-w-0 items-baseline gap-2 text-left" title="Abrir o Foco">
                <span className="tabular shrink-0 text-xl leading-tight font-semibold">{stopwatchText(t, now)}</span>
                <span className="truncate text-[13px] text-muted">{task?.title ?? "Sem tarefa"}</span>
              </button>
              <TimerStart className="block text-xs" />
            </div>
            <Button size="sm" variant="secondary" onClick={() => timer.stop()} title="Para e registra o tempo">
              <Square size={12} fill="currentColor" /> Parar
            </Button>
          </div>
        )}
        {/* Pomodoro: só o ritmo, numa linha. */}
        {p && pd && (
          <div className="flex items-center gap-3 px-3 py-2">
            <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", p.phase === "focus" ? "bg-sunken text-muted" : "bg-break/15 text-break")}>
              {p.phase === "focus" ? <Brain size={14} /> : <Coffee size={14} />}
            </span>
            <button onClick={onOpen} className="min-w-0 flex-1 text-left text-[13px]" title="Abrir o Foco">
              <span className="text-muted">Pomodoro · {pomodoroLabel(p)}</span> <span className="tabular font-semibold">{pd.text}</span>
            </button>
            {p.waiting ? (
              <Button size="sm" variant="primary" onClick={() => startWaiting(uid, settings)}>
                Começar
              </Button>
            ) : (
              p.phase === "break" && (
                <Button size="sm" variant="ghost" onClick={() => skipBreak(uid, settings)}>
                  Pular
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
