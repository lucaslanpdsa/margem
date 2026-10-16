"use client";

import { useEffect, useRef } from "react";
import { todayKey } from "@/lib/dates";
import { notify } from "@/lib/pomodoro";
import { slotEvents } from "@/lib/schedule";
import { useStore } from "./store";
import { useToast } from "./toast";

/** Até quantos minutos depois do horário o aviso ainda sai (ex: app aberto um pouco depois das 8h). */
const GRACE_MIN = 2;
const STORAGE_KEY = "margem.avisos";

function loadSent(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveSent(sent: Set<string>, today: string) {
  try {
    // Guarda só os de hoje, para a lista não crescer.
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...sent].filter((k) => k.includes(`|${today}|`))));
  } catch {
    /* sem armazenamento: no pior caso um aviso pode repetir ao recarregar */
  }
}

/**
 * Avisa no início e no fim do horário das tarefas, enquanto o app está aberto.
 * Notificação do sistema quando permitida, mais o aviso no rodapé e um bipe.
 */
export function SlotAlerts() {
  const { tasks } = useStore();
  const toast = useToast();
  const sent = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!sent.current) sent.current = loadSent();
    const check = () => {
      const now = new Date();
      const today = todayKey(now);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      for (const e of slotEvents(tasks, today)) {
        if (nowMin < e.atMin || nowMin > e.atMin + GRACE_MIN || sent.current!.has(e.key)) continue;
        sent.current!.add(e.key);
        const when = `${e.slot.start}–${e.slot.end}`;
        const title = e.kind === "start" ? `${e.task.title} começa agora` : `${e.task.title} terminou`;
        notify(title, when);
        toast(`${title} (${when})`, "info");
      }
      saveSent(sent.current!, today);
    };
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [tasks, toast]);

  return null;
}
