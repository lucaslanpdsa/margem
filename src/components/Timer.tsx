"use client";

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
    <div className="fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-80">
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-lg">
        <div className="h-1 bg-paper">
          <div className={cx("h-full transition-all", focus ? "bg-done" : "bg-ok")} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-3 p-3">
          <div className="tabular font-display text-3xl">{mmss(remaining)}</div>
          <div className="min-w-0 flex-1">
            <p className={cx("text-xs font-semibold uppercase tracking-wider", focus ? "text-done" : "text-ok")}>
              {focus ? "Foco" : "Pausa"}
            </p>
            <p className="truncate text-sm">{task?.title ?? "Tarefa"}</p>
          </div>
          {focus ? (
            <Button variant="soft" onClick={() => stopTimer(uid, settings)} title="Parar e registrar o tempo feito">
              Parar
            </Button>
          ) : (
            <div className="flex flex-col gap-1">
              <Button variant="primary" onClick={() => startFocus(uid, settings, t.taskId)}>
                Próximo
              </Button>
              <Button variant="ghost" onClick={() => stopTimer(uid, settings)}>
                Encerrar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
