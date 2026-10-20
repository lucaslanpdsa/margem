"use client";

import { Brain, Coffee, Square, Timer as TimerIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { finishPhase, isRunning, notify, remainingMs, skipPhase, startPomodoro } from "@/lib/pomodoro";
import type { ActiveTimer, PomodoroState } from "@/lib/types";
import { useDialogs } from "./dialogs";
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
  return { text: mmss(Math.ceil(left / 1000) * 1000), pct: Math.min(100, Math.max(0, ((total - left) / total) * 100)), left };
}

export const pomodoroLabel = (p: PomodoroState) =>
  p.waiting ? (p.phase === "break" ? "Pausa pronta" : "Pronto para focar") : p.pausedLeftMs !== undefined ? "Pausado" : p.phase === "break" ? "Pausa" : "Foco";

/**
 * Motor dos timers (sempre montado) + barra flutuante.
 * - Cronômetro (registra): aparece em todas as telas, inclusive no Foco, para não esquecer que está rodando.
 *   Tocar abre a janela da tarefa.
 * - Pomodoro (avulso): uma linha menor fora do Foco, quando está rodando ou pausado.
 */
export function Timer({ onFoco, onOpenFocus }: { onFoco?: boolean; onOpenFocus?: () => void }) {
  const { uid, settings, tasks } = useStore();
  const { openTask } = useDialogs();
  const t = settings.activeTimer;
  const p = settings.pomodoro;
  const now = useNow();
  const handled = useRef<string | null>(null);
  const timer = useTimerActions();
  const task = tasks.find((x) => x.id === t?.taskId);
  const pd = p ? pomodoroDisplay(p, now) : null;

  // Fim de uma fase do pomodoro: avisa e passa para a próxima (não grava tempo).
  useEffect(() => {
    if (!isRunning(p) || !pd || pd.left > 0 || handled.current === p.startedAt) return;
    handled.current = p.startedAt;
    if (p.phase === "focus") notify("Hora da pausa", settings.autoStartBreaks ? `A pausa de ${settings.breakMin}min começou.` : "Foco concluído.");
    else notify("Pausa terminou", settings.autoStartFocus ? "O próximo foco começou." : "Pronto para o próximo?");
    finishPhase(uid, settings, p);
  }, [p, pd, uid, settings]);

  const showPomodoro = !onFoco && !!p && !!pd && !p.waiting;

  useEffect(() => {
    const parts = [p && pd && !p.waiting ? `${pd.text} ${pomodoroLabel(p)}` : "", t ? `${stopwatchText(t, now)} ${task?.title ?? ""}` : ""].filter(Boolean);
    document.title = parts.length ? parts.join(" · ") : "Margem";
  }, [t, p, pd, now, task?.title]);

  if (!t && !showPomodoro) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96">
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        {/* Cronômetro: o que está sendo registrado. */}
        {t && (
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-todo/10 text-todo" aria-hidden>
              <TimerIcon size={17} />
              <span className="absolute top-0.5 right-0.5 h-2 w-2 animate-pulse rounded-full bg-over" />
            </span>
            <div className="min-w-0 flex-1">
              <button onClick={() => task && openTask(task)} className="flex w-full min-w-0 items-baseline gap-2 text-left" title="Abrir a tarefa">
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
        {showPomodoro && p && pd && (
          <div className="flex items-center gap-3 px-3 py-2">
            <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", p.phase === "focus" ? "bg-sunken text-muted" : "bg-done/15 text-done")}>
              {p.phase === "focus" ? <Brain size={14} /> : <Coffee size={14} />}
            </span>
            <button onClick={onOpenFocus} className="min-w-0 flex-1 text-left text-[13px]" title="Abrir o pomodoro">
              <span className="text-muted">Pomodoro · {pomodoroLabel(p)}</span> <span className="tabular font-semibold">{pd.text}</span>
            </button>
            {p.pausedLeftMs !== undefined ? (
              <Button size="sm" variant="primary" onClick={() => startPomodoro(uid, settings)}>
                Continuar
              </Button>
            ) : (
              p.phase === "break" && (
                <Button size="sm" variant="ghost" onClick={() => skipPhase(uid, settings)}>
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
