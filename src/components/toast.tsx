"use client";

import { AlertTriangle, Check, Info, WifiOff } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { fmtMin } from "@/lib/dates";
import { onSaveError } from "@/lib/db";
import { startTimer, stopTimer, type Closed } from "@/lib/timer";
import { useStore } from "./store";
import { cx } from "./ui";

/**
 * Aviso curto no rodapé, que some sozinho: confirma o que aconteceu (ex: tempo registrado).
 * Com `undo`, mostra "Desfazer" e fica mais tempo. Erros de gravação aparecem aqui também.
 */
type Tone = "ok" | "info" | "error";
interface ToastOptions {
  tone?: Tone;
  /** Desfaz a ação (ex: regrava o registro apagado). */
  undo?: () => unknown;
}
interface ToastMsg {
  id: number;
  text: string;
  tone: Tone;
  undo?: () => unknown;
}
type ShowToast = (text: string, opts?: Tone | ToastOptions) => void;

const Ctx = createContext<ShowToast>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ShowToast>((text, opts) => {
    const o: ToastOptions = typeof opts === "string" ? { tone: opts } : (opts ?? {});
    if (timer.current) clearTimeout(timer.current);
    setMsg({ id: Date.now(), text, tone: o.tone ?? "ok", undo: o.undo });
    timer.current = setTimeout(() => setMsg(null), o.undo || o.tone === "error" ? 6000 : 3500);
  }, []);

  // Gravação que falhou no banco vira aviso de erro.
  useEffect(() => onSaveError(() => show("Não foi possível salvar. Confira a internet e tente de novo.", "error")), [show]);

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-8">
          <div
            key={msg.id}
            role={msg.tone === "error" ? "alert" : "status"}
            className={cx(
              "pointer-events-auto flex max-w-md items-center gap-2 rounded-full py-2 pr-2 pl-4 text-sm font-medium shadow-lg",
              msg.tone === "ok" && "bg-ink text-surface",
              msg.tone === "info" && "bg-surface text-ink ring-1 ring-line",
              msg.tone === "error" && "bg-over text-white",
            )}
          >
            {msg.tone === "ok" && <Check size={16} className="shrink-0 text-done" strokeWidth={3} />}
            {msg.tone === "info" && <Info size={16} className="shrink-0 text-muted" />}
            {msg.tone === "error" && <AlertTriangle size={16} className="shrink-0" />}
            <span className="py-0.5 pr-2">{msg.text}</span>
            {msg.undo && (
              <button
                onClick={() => {
                  msg.undo?.();
                  setMsg(null);
                }}
                className={cx("shrink-0 rounded-full px-3 py-1 font-semibold", msg.tone === "info" ? "text-todo hover:bg-sunken" : "bg-surface/15 text-surface hover:bg-surface/25")}
              >
                Desfazer
              </button>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** "Sem internet": as mudanças ficam no aparelho e são enviadas quando a conexão voltar. */
export function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    const first = setTimeout(update, 0);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearTimeout(first);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-2">
      <span className="flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-surface shadow-lg">
        <WifiOff size={14} /> Sem internet · salva quando voltar
      </span>
    </div>
  );
}

/** Começar e parar o cronômetro avisando o que foi registrado (ou que não foi, com menos de 1 minuto). */
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
    start: async (taskId: string) => report(await startTimer(uid, settings, taskId)),
    stop: async () => report(await stopTimer(uid, settings)),
  };
}
