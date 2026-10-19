"use client";

import { Coffee, Square, Timer as TimerIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { finishPhase, isStopwatch, notify, skipBreak, startWaiting } from "@/lib/pomodoro";
import type { ActiveTimer } from "@/lib/types";
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

/** O que mostrar no relógio: contagem regressiva no pomodoro, crescente no cronômetro. */
export function timerDisplay(t: ActiveTimer, now: number) {
  if (t.waiting) return { text: mmss(t.durationMin * 60000), pct: 0 as number | null, remaining: Infinity };
  const elapsed = now - Date.parse(t.startedAt);
  if (isStopwatch(t)) return { text: mmss(elapsed), pct: null as number | null, remaining: Infinity };
  const total = t.durationMin * 60000;
  const remaining = total - elapsed;
  return { text: mmss(Math.ceil(remaining / 1000) * 1000), pct: Math.min(100, Math.max(0, (elapsed / total) * 100)), remaining };
}

/**
 * Motor do timer (sempre montado) + barra flutuante.
 * A barra some na tela de Foco, que mostra o relógio grande; clicar nela abre essa tela.
 */
export function Timer({ hidden, onOpen }: { hidden?: boolean; onOpen?: () => void }) {
  const { uid, settings, tasks } = useStore();
  const t = settings.activeTimer;
  const now = useNow();
  const handled = useRef<string | null>(null);
  const timer = useTimerActions();
  const task = tasks.find((x) => x.id === t?.taskId);
  const d = t ? timerDisplay(t, now) : null;

  // Fim de uma fase do pomodoro.
  useEffect(() => {
    if (!t || isStopwatch(t) || !d || d.remaining > 0 || handled.current === t.startedAt) return;
    handled.current = t.startedAt;
    if (t.phase === "focus")
      notify("Pomodoro concluído", `${t.durationMin}min${task ? ` em "${task.title}"` : ""}. ${settings.autoStartBreaks ? "A pausa começou." : "Hora da pausa."}`);
    else notify("Pausa terminou", settings.autoStartFocus ? "O próximo foco começou." : "Pronto para o próximo?");
    finishPhase(uid, settings, t);
  }, [t, d, uid, settings, task]);

  useEffect(() => {
    document.title = t && d ? `${d.text} · ${t.phase === "break" ? "Pausa" : (task?.title ?? "Foco")}` : "Margem";
  }, [t, d, task?.title]);

  if (!t || !d || hidden) return null;
  const focus = t.phase === "focus";

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        {d.pct !== null && (
          <div className="h-1 bg-sunken">
            <div className={cx("h-full transition-[width] duration-1000", focus ? "bg-todo" : "bg-break")} style={{ width: `${d.pct}%` }} />
          </div>
        )}
        {/* Compacta (2 linhas) para não cobrir a lista do dia no celular. */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            onClick={onOpen}
            title="Abrir a tela de foco"
            className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", focus ? "bg-todo/10 text-todo" : "bg-break/15 text-break")}
          >
            {focus ? <TimerIcon size={17} /> : <Coffee size={17} />}
          </button>
          <div className="min-w-0 flex-1">
            <button onClick={onOpen} className="flex w-full min-w-0 items-baseline gap-2 text-left" title="Abrir a tela de foco">
              <span className="tabular shrink-0 text-xl leading-tight font-semibold">{d.text}</span>
              <span className="truncate text-[13px] text-muted">
                {t.waiting ? (focus ? "Próximo foco" : "Pausa pronta") : focus ? (task?.title ?? "Sem tarefa") : "Pausa"}
              </span>
            </button>
            {focus && !t.waiting && <TimerStart className="block text-xs" />}
          </div>
          {t.waiting ? (
            <div className="flex gap-1.5">
              {focus ? (
                <Button variant="ghost" onClick={() => timer.stop()}>
                  Encerrar
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => skipBreak(uid, settings)}>
                  Pular
                </Button>
              )}
              <Button variant="primary" onClick={() => startWaiting(uid, settings)}>
                Começar
              </Button>
            </div>
          ) : focus ? (
            <Button size="sm" variant="secondary" onClick={() => timer.stop()} title="Para agora e conta o tempo já feito">
              <Square size={12} fill="currentColor" /> Parar
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button variant="ghost" onClick={() => timer.stop()}>
                Encerrar
              </Button>
              <Button variant="primary" onClick={() => skipBreak(uid, settings)}>
                Próximo
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
