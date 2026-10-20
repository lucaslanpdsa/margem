"use client";

import { saveSettings } from "./db";
import type { PomodoroState, Settings } from "./types";

/**
 * Pomodoro: só o ritmo (foco, pausa, avisos), no estilo do Pomofocus. **Não grava tempo.**
 * Quem registra é o cronômetro (timer.ts), que pode rodar ao mesmo tempo.
 * Fica nas configurações para aparecer igual no computador e no celular.
 */

const phase = (settings: Settings, p: "focus" | "break", auto: boolean, startedAt = new Date()): PomodoroState => ({
  phase: p,
  startedAt: startedAt.toISOString(),
  durationMin: p === "focus" ? settings.focusMin : settings.breakMin,
  waiting: !auto,
});

/** Tempo que falta na fase, em ms (fase esperando = a fase inteira). */
export function remainingMs(p: PomodoroState, now = Date.now()) {
  if (p.waiting) return p.durationMin * 60000;
  return p.durationMin * 60000 - (now - Date.parse(p.startedAt));
}

export const startPomodoro = (uid: string, settings: Settings) => saveSettings(uid, { pomodoro: phase(settings, "focus", true) });

export const stopPomodoro = (uid: string) => saveSettings(uid, { pomodoro: null });

/**
 * Fim natural de uma fase. A próxima começa no fim da anterior (não na hora em que o app foi aberto),
 * e o id da fase é o início: dois aparelhos abertos chegam ao mesmo resultado.
 */
export async function finishPhase(uid: string, settings: Settings, p: PomodoroState) {
  const end = new Date(Date.parse(p.startedAt) + p.durationMin * 60000);
  const next = p.phase === "focus" ? "break" : "focus";
  const auto = next === "break" ? !!settings.autoStartBreaks : !!settings.autoStartFocus;
  await saveSettings(uid, { pomodoro: phase(settings, next, auto, auto ? end : new Date()) });
}

/** Começa agora a fase que estava esperando. */
export async function startWaiting(uid: string, settings: Settings) {
  const p = settings.pomodoro;
  if (p) await saveSettings(uid, { pomodoro: phase(settings, p.phase, true) });
}

/** Encerra o foco agora e começa a pausa. */
export const goToBreak = (uid: string, settings: Settings) => saveSettings(uid, { pomodoro: phase(settings, "break", true) });

/** Pula a pausa e começa o próximo foco. */
export const skipBreak = (uid: string, settings: Settings) => saveSettings(uid, { pomodoro: phase(settings, "focus", true) });

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
