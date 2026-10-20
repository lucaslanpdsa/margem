"use client";

import { todayKey } from "./dates";
import { saveSettings } from "./db";
import type { PomoTask, PomodoroState, Settings } from "./types";

/**
 * Pomodoro: um recurso avulso, no estilo do Pomofocus (foco, pausa, pausar, pular, contador do dia).
 * **Não grava tempo.** Tem a própria lista de tarefas (como no Pomofocus), com pomodoros feitos / estimados;
 * dá para importar as tarefas do app, mas a lista é independente e não mexe nas horas.
 * Quem registra horas é o cronômetro (timer.ts).
 * Fica nas configurações para aparecer igual no computador e no celular.
 */

type Phase = PomodoroState["phase"];

const durationOf = (settings: Settings, phase: Phase) => (phase === "focus" ? settings.focusMin : settings.breakMin);

/** Pomodoros de foco feitos hoje (zera ao virar o dia). */
export const countToday = (p: PomodoroState | null | undefined, today = todayKey()) => (p && p.countDate === today ? (p.count ?? 0) : 0);

/** Sugestão de pomodoros para uma tarefa do app: tempo dela ÷ ciclo (foco + pausa). 7h com 25+5 = 14. */
export const suggestPomodoros = (taskMin: number, settings: Pick<Settings, "focusMin" | "breakMin">) =>
  Math.max(1, Math.ceil(taskMin / Math.max(1, settings.focusMin + settings.breakMin)));

/**
 * Estado sem campos vazios (o Firestore não aceita undefined).
 * Mantém a tarefa escolhida de uma fase para a outra.
 */
function make(settings: Settings, phase: Phase, opts: { running: boolean; startedAt?: Date; count: number; prev?: PomodoroState | null }): PomodoroState {
  const s: PomodoroState = {
    phase,
    startedAt: (opts.startedAt ?? new Date()).toISOString(),
    durationMin: durationOf(settings, phase),
    count: opts.count,
    countDate: todayKey(),
  };
  if (!opts.running) s.waiting = true;
  if (opts.prev?.taskId) s.taskId = opts.prev.taskId;
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
  const pomodoro = make(settings, next, { running: auto, startedAt: auto ? end : new Date(), count, prev: p });
  // Foco completo com uma tarefa da lista escolhida: +1 nela.
  const list = settings.pomodoroTasks ?? [];
  if (focus && p.taskId && list.some((t) => t.id === p.taskId)) {
    await saveSettings(uid, { pomodoro, pomodoroTasks: list.map((t) => (t.id === p.taskId ? { ...t, done: t.done + 1 } : t)) });
    return;
  }
  await saveSettings(uid, { pomodoro });
}

// ---------- Lista de tarefas do pomodoro ----------

const newId = () => `pt-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const saveList = (uid: string, list: PomoTask[]) => saveSettings(uid, { pomodoroTasks: list });
/** Tira campos vazios (o Firestore não aceita undefined). */
const tidy = (t: PomoTask): PomoTask => Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined)) as PomoTask;

/**
 * Grava a lista e, se nada estiver escolhido para o foco, escolhe a primeira não concluída (como no Pomofocus).
 * Se a escolhida foi concluída ou apagada, passa para a próxima.
 */
async function saveListPicking(uid: string, settings: Settings, list: PomoTask[]) {
  const p = settings.pomodoro;
  const current = list.find((t) => t.id === p?.taskId && !t.checked);
  const pick = current ?? list.find((t) => !t.checked);
  if ((pick?.id ?? undefined) === p?.taskId) return saveList(uid, list);
  const base = p ?? make(settings, "focus", { running: false, count: 0 });
  const pomodoro: PomodoroState = { ...base };
  if (pick) pomodoro.taskId = pick.id;
  else delete pomodoro.taskId;
  return saveSettings(uid, { pomodoroTasks: list, pomodoro });
}

export function addPomoTask(uid: string, settings: Settings, title: string, est: number) {
  const t: PomoTask = { id: newId(), title: title.trim(), est: Math.max(1, est), done: 0 };
  return saveListPicking(uid, settings, [...(settings.pomodoroTasks ?? []), t]);
}

export const updatePomoTask = (uid: string, settings: Settings, id: string, patch: Partial<PomoTask>) =>
  saveListPicking(uid, settings, (settings.pomodoroTasks ?? []).map((t) => (t.id === id ? tidy({ ...t, ...patch }) : t)));

export const removePomoTask = (uid: string, settings: Settings, id: string) =>
  saveListPicking(uid, settings, (settings.pomodoroTasks ?? []).filter((t) => t.id !== id));

/** Tarefas do app ainda não trazidas para a lista (as apagadas da lista podem voltar). */
export function notImported<T extends { id: string }>(settings: Settings, from: T[]) {
  const have = new Set((settings.pomodoroTasks ?? []).map((t) => t.fromTaskId).filter(Boolean));
  return from.filter((x) => !have.has(x.id));
}

/** Traz tarefas do app para a lista, com estimativa sugerida. Não repete as que já estão. Devolve quantas entraram. */
export async function importTasks(uid: string, settings: Settings, from: { id: string; title: string; minutes: number }[]) {
  const add = notImported(settings, from).map(
    (x): PomoTask => ({ id: newId() + x.id.slice(0, 4), title: x.title, est: suggestPomodoros(x.minutes, settings), done: 0, fromTaskId: x.id }),
  );
  if (add.length) await saveListPicking(uid, settings, [...(settings.pomodoroTasks ?? []), ...add]);
  return add.length;
}

export const clearPomoTasks = (uid: string, settings: Settings, onlyChecked: boolean) =>
  saveList(uid, onlyChecked ? (settings.pomodoroTasks ?? []).filter((t) => !t.checked) : []);

/** "Pomodoros 1/3 · Termina às 16:25": soma das não concluídas e quando acabam com o ciclo atual. */
export function listSummary(list: PomoTask[], settings: Pick<Settings, "focusMin" | "breakMin">, now = Date.now()) {
  const open = list.filter((t) => !t.checked);
  const done = open.reduce((a, t) => a + Math.min(t.done, t.est), 0);
  const est = open.reduce((a, t) => a + t.est, 0);
  const leftMin = Math.max(0, est - done) * (settings.focusMin + settings.breakMin);
  return { done, est, leftMin, finishAt: new Date(now + leftMin * 60000) };
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
