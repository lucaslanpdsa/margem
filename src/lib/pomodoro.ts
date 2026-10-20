"use client";

import { todayKey } from "./dates";
import { saveSettings } from "./db";
import type { PomodoroState, Settings } from "./types";

/**
 * Pomodoro: um recurso avulso, no estilo do Pomofocus (foco, pausa, pausar, pular, contador do dia).
 * **Não grava tempo.** Pode apontar uma tarefa só para contar pomodoros nela ("2/4"), sem tocar nas horas.
 * Quem registra horas é o cronômetro (timer.ts).
 * Fica nas configurações para aparecer igual no computador e no celular.
 */

type Phase = PomodoroState["phase"];

const durationOf = (settings: Settings, phase: Phase) => (phase === "focus" ? settings.focusMin : settings.breakMin);

/** Pomodoros de foco feitos hoje (zera ao virar o dia). */
export const countToday = (p: PomodoroState | null | undefined, today = todayKey()) => (p && p.countDate === today ? (p.count ?? 0) : 0);

/** Pomodoros feitos hoje numa tarefa. */
export const countForTask = (p: PomodoroState | null | undefined, taskId: string, today = todayKey()) =>
  p && p.countDate === today ? (p.perTask?.[taskId] ?? 0) : 0;

/** Minutos de ciclo (foco + pausa) já concluídos hoje numa tarefa. */
export const minutesForTask = (p: PomodoroState | null | undefined, taskId: string, today = todayKey()) =>
  p && p.countDate === today ? (p.perTaskMin?.[taskId] ?? 0) : 0;

/**
 * Pomodoros estimados para a tarefa: os já feitos + o que falta do tempo dela dividido pelo ciclo atual (foco + pausa).
 * Ex: 7h com 25+5 = 14. Mudou o tamanho no meio? Só o que falta é recalculado; o feito continua valendo.
 */
export function pomodorosFor(taskMin: number, settings: Pick<Settings, "focusMin" | "breakMin">, done = 0, coveredMin = 0) {
  const cycle = Math.max(1, settings.focusMin + settings.breakMin);
  // Contagens de antes de guardar os minutos: supõe ciclos do tamanho atual.
  const covered = coveredMin || done * cycle;
  return Math.max(1, done + Math.ceil(Math.max(0, taskMin - covered) / cycle));
}

/**
 * Estado sem campos vazios (o Firestore não aceita undefined).
 * Mantém a tarefa escolhida e as contagens do dia de uma fase para a outra.
 */
function make(settings: Settings, phase: Phase, opts: { running: boolean; startedAt?: Date; count: number; prev?: PomodoroState | null }): PomodoroState {
  const today = todayKey();
  const s: PomodoroState = {
    phase,
    startedAt: (opts.startedAt ?? new Date()).toISOString(),
    durationMin: durationOf(settings, phase),
    count: opts.count,
    countDate: today,
  };
  if (!opts.running) s.waiting = true;
  if (opts.prev?.taskId) s.taskId = opts.prev.taskId;
  if (opts.prev?.perTask && opts.prev.countDate === today) s.perTask = opts.prev.perTask;
  if (opts.prev?.perTaskMin && opts.prev.countDate === today) s.perTaskMin = opts.prev.perTaskMin;
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
    return saveSettings(uid, { pomodoro: { ...make(settings, p.phase, { running: true, startedAt, count, prev: p }), durationMin: p.durationMin } });
  }
  return saveSettings(uid, { pomodoro: make(settings, p?.phase ?? "focus", { running: true, count, prev: p }) });
}

export async function pausePomodoro(uid: string, settings: Settings) {
  const p = settings.pomodoro;
  if (!isRunning(p)) return;
  await saveSettings(uid, { pomodoro: { ...p, pausedLeftMs: Math.max(0, remainingMs(p)) } });
}

/** Trocar de aba (Foco / Pausa): a fase fica pronta, esperando o Começar. */
export const switchPhase = (uid: string, settings: Settings, phase: Phase) =>
  saveSettings(uid, { pomodoro: make(settings, phase, { running: false, count: countToday(settings.pomodoro), prev: settings.pomodoro }) });

/** Escolher (ou tirar, com o mesmo id) a tarefa em que está focando. Não muda o tempo da fase. */
export async function selectTask(uid: string, settings: Settings, taskId: string) {
  const p = settings.pomodoro ?? make(settings, "focus", { running: false, count: 0 });
  const next: PomodoroState = { ...p };
  if (p.taskId === taskId) delete next.taskId;
  else next.taskId = taskId;
  await saveSettings(uid, { pomodoro: next });
}

/** Pular para a próxima fase (foco pulado não conta no "#"). Segue o início automático. */
export async function skipPhase(uid: string, settings: Settings) {
  const p = settings.pomodoro;
  const next: Phase = (p?.phase ?? "focus") === "focus" ? "break" : "focus";
  const auto = next === "break" ? !!settings.autoStartBreaks : !!settings.autoStartFocus;
  await saveSettings(uid, { pomodoro: make(settings, next, { running: auto, count: countToday(p), prev: p }) });
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
  const focus = p.phase === "focus";
  const count = countToday(p) + (focus ? 1 : 0);
  // Foco completo numa tarefa escolhida: +1 nela.
  const today = todayKey();
  const fresh = p.countDate === today;
  const prev: PomodoroState = { ...p, countDate: today, perTask: fresh ? p.perTask : undefined, perTaskMin: fresh ? p.perTaskMin : undefined };
  if (p.taskId) {
    // Foco completo: +1 pomodoro. Foco e pausa completos somam minutos de ciclo na tarefa.
    if (focus) prev.perTask = { ...prev.perTask, [p.taskId]: countForTask(p, p.taskId) + 1 };
    prev.perTaskMin = { ...prev.perTaskMin, [p.taskId]: minutesForTask(p, p.taskId) + p.durationMin };
  }
  await saveSettings(uid, { pomodoro: make(settings, next, { running: auto, startedAt: auto ? end : new Date(), count, prev }) });
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
