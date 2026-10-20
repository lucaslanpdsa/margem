"use client";

import { todayKey } from "./dates";
import { saveSettings } from "./db";
import type { PomodoroState, Settings } from "./types";

/**
 * Pomodoro: um recurso avulso, no estilo do Pomofocus (foco, pausa, pausar, pular, contador do dia).
 * **Não grava tempo e não sabe de tarefas.** Quem registra horas é o cronômetro (timer.ts).
 * Fica nas configurações para aparecer igual no computador e no celular.
 */

type Phase = PomodoroState["phase"];

const durationOf = (settings: Settings, phase: Phase) => (phase === "focus" ? settings.focusMin : settings.breakMin);

/** Pomodoros de foco feitos hoje (zera ao virar o dia). */
export const countToday = (p: PomodoroState | null | undefined, today = todayKey()) => (p && p.countDate === today ? (p.count ?? 0) : 0);

/** Estado sem campos vazios (o Firestore não aceita undefined). */
function make(settings: Settings, phase: Phase, opts: { running: boolean; startedAt?: Date; count: number }): PomodoroState {
  const s: PomodoroState = {
    phase,
    startedAt: (opts.startedAt ?? new Date()).toISOString(),
    durationMin: durationOf(settings, phase),
    count: opts.count,
    countDate: todayKey(),
  };
  if (!opts.running) s.waiting = true;
  return s;
}

/** Quanto falta da fase, em ms. Esperando = a fase inteira; pausado = o que faltava ao pausar. */
export function remainingMs(p: PomodoroState, now = Date.now()) {
  if (p.waiting) return p.durationMin * 60000;
  if (p.pausedLeftMs !== undefined) return p.pausedLeftMs;
  return p.durationMin * 60000 - (now - Date.parse(p.startedAt));
}

export const isRunning = (p: PomodoroState | null | undefined): p is PomodoroState => !!p && !p.waiting && p.pausedLeftMs === undefined;

/** Começar: do zero, a fase que estava esperando, ou continuar de onde pausou. */
export async function startPomodoro(uid: string, settings: Settings) {
  const p = settings.pomodoro;
  const count = countToday(p);
  if (p && p.pausedLeftMs !== undefined) {
    const startedAt = new Date(Date.now() - (p.durationMin * 60000 - p.pausedLeftMs));
    return saveSettings(uid, { pomodoro: { ...make(settings, p.phase, { running: true, startedAt, count }), durationMin: p.durationMin } });
  }
  return saveSettings(uid, { pomodoro: make(settings, p?.phase ?? "focus", { running: true, count }) });
}

export async function pausePomodoro(uid: string, settings: Settings) {
  const p = settings.pomodoro;
  if (!isRunning(p)) return;
  await saveSettings(uid, { pomodoro: { ...p, pausedLeftMs: Math.max(0, remainingMs(p)) } });
}

/** Trocar de aba (Foco / Pausa): a fase fica pronta, esperando o Começar. */
export const switchPhase = (uid: string, settings: Settings, phase: Phase) =>
  saveSettings(uid, { pomodoro: make(settings, phase, { running: false, count: countToday(settings.pomodoro) }) });

/** Pular para a próxima fase (foco pulado não conta no "#"). Segue o início automático. */
export async function skipPhase(uid: string, settings: Settings) {
  const p = settings.pomodoro;
  const next: Phase = (p?.phase ?? "focus") === "focus" ? "break" : "focus";
  const auto = next === "break" ? !!settings.autoStartBreaks : !!settings.autoStartFocus;
  await saveSettings(uid, { pomodoro: make(settings, next, { running: auto, count: countToday(p) }) });
}

/**
 * Fim natural de uma fase: conta o pomodoro (se era foco) e passa para a próxima.
 * Com início automático, a próxima começa no fim da anterior (não na hora em que o app foi aberto),
 * então dois aparelhos abertos chegam ao mesmo estado.
 */
export async function finishPhase(uid: string, settings: Settings, p: PomodoroState) {
  const end = new Date(Date.parse(p.startedAt) + p.durationMin * 60000);
  const next: Phase = p.phase === "focus" ? "break" : "focus";
  const auto = next === "break" ? !!settings.autoStartBreaks : !!settings.autoStartFocus;
  const count = countToday(p) + (p.phase === "focus" ? 1 : 0);
  await saveSettings(uid, { pomodoro: make(settings, next, { running: auto, startedAt: auto ? end : new Date(), count }) });
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
