"use client";

import { Check, Info } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { fmtMin } from "@/lib/dates";
import { startTimer, stopTimer, type Closed } from "@/lib/pomodoro";
import { useStore } from "./store";
import { cx } from "./ui";

/** Aviso curto no rodapé, que some sozinho: confirma o que aconteceu (ex: tempo registrado). */
type Tone = "ok" | "info";
interface ToastMsg {
  id: number;
  text: string;
  tone: Tone;
}

const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, tone: Tone = "ok") => {
    if (timer.current) clearTimeout(timer.current);
    setMsg({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setMsg(null), 3500);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-8">
          <div
            key={msg.id}
            role="status"
            className={cx(
              "pointer-events-auto flex max-w-md items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg",
              msg.tone === "ok" ? "bg-ink text-surface" : "bg-surface text-ink ring-1 ring-line",
            )}
          >
            {msg.tone === "ok" ? <Check size={16} className="shrink-0 text-done" strokeWidth={3} /> : <Info size={16} className="shrink-0 text-muted" />}
            {msg.text}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Começar e parar o timer avisando o que foi registrado (ou que não foi, com menos de 1 minuto). */
export function useTimerActions() {
  const { uid, settings, tasks } = useStore();
  const toast = useToast();

  const report = (closed: Closed | null) => {
    if (!closed) return;
    const title = tasks.find((t) => t.id === closed.taskId)?.title ?? "sem tarefa";
    if (closed.minutes > 0) toast(`${fmtMin(closed.minutes)} registrados em ${title}`);
    else toast("Menos de 1 minuto: não foi registrado", "info");
  };

  return {
    start: async (taskId: string, mode: "pomodoro" | "stopwatch") => report(await startTimer(uid, settings, taskId, mode)),
    stop: async () => report(await stopTimer(uid, settings)),
  };
}
