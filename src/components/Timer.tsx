"use client";

import { Coffee, Square, Timer as TimerIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { saveSettings } from "@/lib/db";
import { notify, recordFocus, startFocus, stopTimer } from "@/lib/pomodoro";
import { useStore } from "./store";
import { Button, cx } from "./ui";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Barra flutuante do pomodoro. Também é quem fecha o ciclo foco → pausa → fim. */
export function Timer() {
  const { uid, settings, tasks } = useStore();
  const t = settings.activeTimer;
  const now = useNow();
  const handled = useRef<string | null>(null);

  const endsAt = t ? Date.parse(t.startedAt) + t.durationMin * 60000 : 0;
  const remaining = endsAt - now;
  const task = tasks.find((x) => x.id === t?.taskId);

  useEffect(() => {
    if (!t || remaining > 0 || handled.current === t.startedAt) return;
    handled.current = t.startedAt;
    (async () => {
      if (t.phase === "focus") {
        await recordFocus(uid, t, t.durationMin, new Date(endsAt));
        notify("Pomodoro concluído 🍅", `${t.durationMin}min em "${task?.title ?? "tarefa"}". Hora da pausa.`);
        await saveSettings(uid, {
          activeTimer: { taskId: t.taskId, phase: "break", startedAt: new Date().toISOString(), durationMin: settings.breakMin },
        });
      } else {
        notify("Pausa terminou", "Pronto para o próximo?");
        await saveSettings(uid, { activeTimer: null });
      }
    })();
  }, [t, remaining, uid, endsAt, task?.title, settings.breakMin]);

  useEffect(() => {
    document.title = t ? `${mmss(remaining)} · ${t.phase === "focus" ? task?.title ?? "Foco" : "Pausa"}` : "Margem";
  }, [t, remaining, task?.title]);

  if (!t) return null;
  const pct = Math.min(100, Math.max(0, 100 - (remaining / (t.durationMin * 60000)) * 100));
  const focus = t.phase === "focus";

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="h-1 bg-sunken">
          <div className={cx("h-full transition-[width] duration-1000", focus ? "bg-todo" : "bg-break")} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-4 p-4">
          <div className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full", focus ? "bg-todo/10 text-todo" : "bg-break/15 text-break")}>
            {focus ? <TimerIcon size={20} /> : <Coffee size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="tabular text-2xl leading-none font-semibold">{mmss(remaining)}</p>
            <p className="mt-1 truncate text-[13px] text-muted">
              {focus ? `Foco em ${task?.title ?? "tarefa"}` : "Pausa. Levante, beba água."}
            </p>
          </div>
          {focus ? (
            <Button variant="secondary" onClick={() => stopTimer(uid, settings)} title="Para agora e conta o tempo já feito">
              <Square size={12} fill="currentColor" /> Parar
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button variant="ghost" onClick={() => stopTimer(uid, settings)}>
                Encerrar
              </Button>
              <Button variant="primary" onClick={() => startFocus(uid, settings, t.taskId)}>
                Próximo
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
