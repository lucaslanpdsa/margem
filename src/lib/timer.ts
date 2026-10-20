"use client";

import { doc, setDoc } from "firebase/firestore";
import { dayKey } from "./dates";
import { saveSettings, write } from "./db";
import { db } from "./firebase";
import type { ActiveTimer, Session, Settings } from "./types";

/**
 * Cronômetro: o único timer que registra tempo. Fica salvo como "começou em X" nas configurações,
 * então sobrevive a recarregar a página e aparece igual em outro aparelho.
 * Ao parar, vira um registro só, do início ao fim. O pomodoro (pomodoro.ts) é separado e não grava nada.
 */

/** Minutos completos desde o início. */
export const elapsedMin = (t: ActiveTimer, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(t.startedAt)) / 60000));

export const LIVE_SESSION_ID = "ao-vivo";

/** O cronômetro rodando como um registro provisório, para o tempo entrar na conta do dia ao vivo. */
export function liveSession(t: ActiveTimer | null | undefined, now = Date.now()): Session | null {
  if (!t) return null;
  const minutes = elapsedMin(t, now);
  if (minutes < 1) return null;
  return {
    id: LIVE_SESSION_ID,
    taskId: t.taskId,
    date: dayKey(new Date(t.startedAt)),
    minutes,
    kind: "pomodoro",
    startedAt: t.startedAt,
    endedAt: new Date(now).toISOString(),
  };
}

export const isLive = (s: Session) => s.id === LIVE_SESSION_ID;

const SOURCE: Record<string, string> = { sw: "cronômetro", pomo: "pomodoro", pausa: "pausa do pomodoro" };
/** De onde veio o registro. "pomo" e "pausa" são de quando o pomodoro registrava. */
export const sessionSource = (s: Session) => (s.kind === "manual" ? "manual" : (SOURCE[s.id.split("-")[0]] ?? "pomodoro"));

/** O que foi registrado ao parar: em que tarefa e quantos minutos (0 = menos de 1 minuto, nada gravado). */
export interface Closed {
  taskId: string;
  minutes: number;
}

/** Grava o cronômetro como um registro. O id vem do início, então gravar duas vezes não duplica. */
async function closeCurrent(uid: string, settings: Settings, endedAt = new Date()): Promise<Closed | null> {
  const t = settings.activeTimer;
  if (!t) return null;
  const minutes = elapsedMin(t, endedAt.getTime());
  if (minutes >= 1) {
    const startedAt = new Date(t.startedAt);
    await write(uid, () =>
      setDoc(doc(db(), "users", uid, "sessions", `sw-${startedAt.getTime()}`), {
        taskId: t.taskId,
        date: dayKey(startedAt),
        minutes,
        kind: "pomodoro",
        startedAt: t.startedAt,
        endedAt: endedAt.toISOString(),
      }),
    );
  }
  return { taskId: t.taskId, minutes: minutes >= 1 ? minutes : 0 };
}

/** Começa o cronômetro numa tarefa. Se outro estava rodando, encerra e registra antes. */
export async function startTimer(uid: string, settings: Settings, taskId: string) {
  const closed = await closeCurrent(uid, settings);
  await saveSettings(uid, { activeTimer: { taskId, startedAt: new Date().toISOString() } });
  return closed;
}

/** Parar: o tempo desde o início vira um registro. */
export async function stopTimer(uid: string, settings: Settings) {
  const closed = await closeCurrent(uid, settings);
  await saveSettings(uid, { activeTimer: null });
  return closed;
}

/**
 * Muda a hora em que o cronômetro começou (ex: começou às 10:33, mas estava fazendo desde as 10:00).
 * Só hoje e não no futuro. Devolve um erro curto ou null.
 */
export async function setTimerStart(uid: string, settings: Settings, hhmm: string, now = new Date()): Promise<string | null> {
  const t = settings.activeTimer;
  if (!t) return "Nenhum cronômetro rodando.";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "Horário inválido.";
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  if (start.getTime() > now.getTime()) return "Não dá para começar no futuro.";
  await saveSettings(uid, { activeTimer: { ...t, startedAt: start.toISOString() } });
  return null;
}

/**
 * Timer de versões antigas (quando o pomodoro registrava): foco rodando vira cronômetro desde o mesmo início;
 * pausa ou fase esperando é descartada. Devolve o novo valor, ou undefined se não precisa mudar.
 */
export function migrateTimer(t: ActiveTimer | null | undefined): ActiveTimer | null | undefined {
  if (!t || (t.mode === undefined && t.phase === undefined && t.durationMin === undefined && t.waiting === undefined)) return undefined;
  if (t.waiting || t.phase === "break") return null;
  return { taskId: t.taskId, startedAt: t.startedAt };
}
