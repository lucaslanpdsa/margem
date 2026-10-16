"use client";

import { doc, setDoc } from "firebase/firestore";
import { dayKey } from "./dates";
import { saveSettings } from "./db";
import { db } from "./firebase";
import type { ActiveTimer, Settings } from "./types";

/**
 * O timer ativo fica salvo como "começou em X" nas configurações,
 * então sobrevive a recarregar a página e aparece igual em outro dispositivo.
 *
 * Pomodoro: foco com tempo fixo, depois pausa. A pausa só conta como feito se a pessoa escolher.
 * Cronômetro: livre, conta até parar.
 * Sessão sem tarefa: conta como feito no dia e o app pergunta em que a pessoa trabalhou.
 */

export const isStopwatch = (t: ActiveTimer) => t.mode === "stopwatch";

/** Minutos completos desde o início (no pomodoro, no máximo a duração da fase). */
export function elapsedMin(t: ActiveTimer, now = Date.now()) {
  const m = Math.floor((now - Date.parse(t.startedAt)) / 60000);
  return isStopwatch(t) ? m : Math.min(t.durationMin, m);
}

/** Grava o tempo. O id vem do início, então gravar duas vezes não duplica. */
async function record(uid: string, t: ActiveTimer, minutes: number, endedAt: Date, prefix: string) {
  if (minutes < 1) return;
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
}

/** Encerra o que estiver rodando, gravando o tempo que deve contar. */
async function closeCurrent(uid: string, settings: Settings, endedAt = new Date()) {
  const t = settings.activeTimer;
  if (!t || t.waiting) return;
  const min = elapsedMin(t, endedAt.getTime());
  if (t.phase === "focus") await record(uid, t, min, endedAt, isStopwatch(t) ? "sw" : "pomo");
  else if (settings.countBreaks) await record(uid, t, min, endedAt, "pausa");
}

export async function startTimer(uid: string, settings: Settings, taskId: string, mode: "pomodoro" | "stopwatch" = "pomodoro") {
  await closeCurrent(uid, settings);
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  await saveSettings(uid, {
    activeTimer: {
      mode,
      taskId,
      phase: "focus",
      startedAt: new Date().toISOString(),
      durationMin: mode === "stopwatch" ? 0 : settings.focusMin,
    },
  });
}

/** Atalho usado nas listas de tarefas: começa um pomodoro na tarefa. */
export const startFocus = (uid: string, settings: Settings, taskId: string) => startTimer(uid, settings, taskId, "pomodoro");

/** Parar agora: o tempo já feito conta. */
export async function stopTimer(uid: string, settings: Settings) {
  await closeCurrent(uid, settings);
  await saveSettings(uid, { activeTimer: null });
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
    if (settings.countBreaks) await record(uid, t, t.durationMin, endedAt, "pausa");
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
