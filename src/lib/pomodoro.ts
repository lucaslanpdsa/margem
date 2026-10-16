"use client";

import { doc, setDoc } from "firebase/firestore";
import { dayKey } from "./dates";
import { saveSettings } from "./db";
import { db } from "./firebase";
import type { ActiveTimer, Settings } from "./types";

/**
 * O timer é guardado como "começou em X, dura Y min" nas configurações.
 * Assim ele sobrevive a recarregar a página e aparece igual em outro dispositivo.
 */

/** Grava o tempo focado. O id é derivado do início, então gravar duas vezes não duplica. */
export async function recordFocus(uid: string, t: ActiveTimer, minutes: number, endedAt = new Date()) {
  if (minutes < 1) return;
  const startedAt = new Date(t.startedAt);
  await setDoc(doc(db(), "users", uid, "sessions", `pomo-${startedAt.getTime()}`), {
    taskId: t.taskId,
    date: dayKey(startedAt),
    minutes,
    kind: "pomodoro",
    startedAt: t.startedAt,
    endedAt: endedAt.toISOString(),
  });
}

export function elapsedMin(t: ActiveTimer, now = Date.now()) {
  return Math.min(t.durationMin, Math.floor((now - Date.parse(t.startedAt)) / 60000));
}

export async function startFocus(uid: string, settings: Settings, taskId: string) {
  const current = settings.activeTimer;
  if (current?.phase === "focus") await recordFocus(uid, current, elapsedMin(current));
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  await saveSettings(uid, {
    activeTimer: { taskId, phase: "focus", startedAt: new Date().toISOString(), durationMin: settings.focusMin },
  });
}

/** Para o timer. No foco, o tempo parcial conta. */
export async function stopTimer(uid: string, settings: Settings) {
  const t = settings.activeTimer;
  if (t?.phase === "focus") await recordFocus(uid, t, elapsedMin(t));
  await saveSettings(uid, { activeTimer: null });
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
