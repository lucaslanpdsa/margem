"use client";

import { doc, setDoc } from "firebase/firestore";
import { dayKey } from "./dates";
import { saveSettings } from "./db";
import { db } from "./firebase";
import type { ActiveTimer, Session, Settings } from "./types";

/**
 * O timer ativo fica salvo como "começou em X" nas configurações,
 * então sobrevive a recarregar a página e aparece igual em outro dispositivo.
 *
 * Pomodoro: foco com tempo fixo, depois pausa. Só o foco conta como feito.
 * Cronômetro: livre, conta até parar.
 * Sessão sem tarefa: conta como feito no dia e o app pergunta em que a pessoa trabalhou.
 */

export const isStopwatch = (t: ActiveTimer) => t.mode === "stopwatch";

/** Minutos completos desde o início (no pomodoro, no máximo a duração da fase). */
export function elapsedMin(t: ActiveTimer, now = Date.now()) {
  const m = Math.floor((now - Date.parse(t.startedAt)) / 60000);
  return isStopwatch(t) ? m : Math.min(t.durationMin, m);
}

export const LIVE_SESSION_ID = "ao-vivo";

/**
 * O timer rodando como um registro provisório, para o tempo entrar na conta do dia ao vivo.
 * Só o foco conta (pausa e fase esperando, não). Some quando o timer para e vira um registro de verdade.
 */
export function liveSession(t: ActiveTimer | null | undefined, now = Date.now()): Session | null {
  if (!t || t.waiting || t.phase !== "focus") return null;
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

/** Grava o tempo. O id vem do início, então gravar duas vezes não duplica. Menos de 1 minuto não grava. */
async function record(uid: string, t: ActiveTimer, minutes: number, endedAt: Date, prefix: string) {
  if (minutes < 1) return 0;
  const startedAt = new Date(t.startedAt);
  const id = `${prefix}-${startedAt.getTime()}`;
  await setDoc(doc(db(), "users", uid, "sessions", id), {
    taskId: t.taskId,
    date: dayKey(startedAt),
    minutes,
    kind: "pomodoro",
    startedAt: t.startedAt,
    endedAt: endedAt.toISOString(),
  });
  // Foco sem tarefa: pergunta depois em que a pessoa trabalhou.
  if (!t.taskId && t.phase === "focus") await saveSettings(uid, { pendingAssign: id });
  return minutes;
}

/** O que aconteceu com o foco encerrado: em que tarefa e quantos minutos foram registrados (0 = nada). */
export interface Closed {
  taskId: string;
  minutes: number;
}

/** Encerra o que estiver rodando, gravando o tempo que deve contar. Devolve o foco encerrado, se havia. */
async function closeCurrent(uid: string, settings: Settings, endedAt = new Date()): Promise<Closed | null> {
  const t = settings.activeTimer;
  if (!t || t.waiting || t.phase !== "focus") return null;
  const min = elapsedMin(t, endedAt.getTime());
  const minutes = await record(uid, t, min, endedAt, isStopwatch(t) ? "sw" : "pomo");
  return { taskId: t.taskId, minutes };
}

export async function startTimer(uid: string, settings: Settings, taskId: string, mode: "pomodoro" | "stopwatch" = "pomodoro") {
  const closed = await closeCurrent(uid, settings);
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  await saveSettings(uid, {
    lastTimerMode: mode,
    activeTimer: {
      mode,
      taskId,
      phase: "focus",
      startedAt: new Date().toISOString(),
      durationMin: mode === "stopwatch" ? 0 : settings.focusMin,
    },
  });
  return closed;
}

/** Atalho usado nas listas de tarefas: começa um pomodoro na tarefa. */
export const startFocus = (uid: string, settings: Settings, taskId: string) => startTimer(uid, settings, taskId, "pomodoro");

/** Parar agora: o tempo já feito conta. */
export async function stopTimer(uid: string, settings: Settings) {
  const closed = await closeCurrent(uid, settings);
  await saveSettings(uid, { activeTimer: null });
  return closed;
}

/** Monta a próxima fase: já rodando ou esperando o toque em começar. */
const phase = (t: ActiveTimer, settings: Settings, p: "focus" | "break", auto: boolean): ActiveTimer => ({
  mode: "pomodoro",
  taskId: t.taskId,
  phase: p,
  startedAt: new Date().toISOString(),
  durationMin: p === "focus" ? settings.focusMin : settings.breakMin,
  waiting: !auto,
});

/** Fim natural de uma fase do pomodoro (chamado pelo timer quando o tempo acaba). */
export async function finishPhase(uid: string, settings: Settings, t: ActiveTimer) {
  const endedAt = new Date(Date.parse(t.startedAt) + t.durationMin * 60000);
  if (t.phase === "focus") {
    await record(uid, t, t.durationMin, endedAt, "pomo");
    await saveSettings(uid, { activeTimer: phase(t, settings, "break", !!settings.autoStartBreaks) });
  } else {
    await saveSettings(uid, { activeTimer: phase(t, settings, "focus", !!settings.autoStartFocus) });
  }
}

/** Começa agora a fase que estava esperando. */
export async function startWaiting(uid: string, settings: Settings) {
  const t = settings.activeTimer;
  if (!t) return;
  await saveSettings(uid, { activeTimer: phase(t, settings, t.phase, true) });
}

/** Pula a pausa (rodando ou esperando) e começa o próximo foco. */
export async function skipBreak(uid: string, settings: Settings) {
  const t = settings.activeTimer;
  if (!t) return;
  await closeCurrent(uid, settings);
  await saveSettings(uid, { activeTimer: phase(t, settings, "focus", true) });
}

export function notify(title: string, body: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon.svg" });
    }
  } catch {
    /* alguns navegadores móveis não permitem Notification direto */
  }
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    o.start();
    o.stop(ctx.currentTime + 0.8);
  } catch {
    /* sem áudio, sem problema */
  }
}
