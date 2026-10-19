/**
 * Dados de exemplo para a prévia (/dev). Só usados em desenvolvimento.
 * A rotina imita um uso real: trabalho com dois horários, academia fora do horário (extra),
 * estudo, inglês, uma tarefa atrasada, uma concluída e uma desativada.
 */
import { shiftDay, todayKey } from "@/lib/dates";
import { liveSession } from "@/lib/pomodoro";
import { DEFAULT_SETTINGS, type Session, type Settings, type Task } from "@/lib/types";

export { PREVIEW_UID } from "@/lib/preview";

export type Scenario = "dia" | "sobra" | "apertado" | "timer" | "vazio" | "onboarding" | "entrar";
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "dia", label: "Dia normal (com atrasada e sem registro)" },
  { id: "sobra", label: "Dia com sobra (encaixe para recuperar a semana)" },
  { id: "apertado", label: "Não dá tempo" },
  { id: "timer", label: "Timer rodando" },
  { id: "vazio", label: "Sem tarefas" },
  { id: "onboarding", label: "Configuração inicial" },
  { id: "entrar", label: "Tela de entrar" },
];

const created = "2026-09-01T10:00:00.000Z";
const win = { start: "08:00", end: "18:00" };

function tasks(t0: string): Task[] {
  return [
    { id: "trabalho", title: "Trabalho CI&T", repeat: "weekdays", weekdays: [1, 2, 3, 4, 5], estimateMin: 420, doneBy: "time", slots: [{ start: "08:00", end: "11:00" }, { start: "14:00", end: "18:00" }], createdAt: created },
    { id: "academia", title: "Academia", repeat: "weekdays", weekdays: [1, 3, 5], estimateMin: 60, slots: [{ start: "18:30", end: "19:30" }], createdAt: created },
    { id: "estudo", title: "Estudar certificação Claude", repeat: "weekdays", weekdays: [1, 2, 3, 4, 5, 6], estimateMin: 90, createdAt: created },
    { id: "ingles", title: "Inglês (Fluency)", repeat: "weekdays", weekdays: [2, 4], estimateMin: 45, createdAt: created },
    { id: "pr", title: "Revisar PR do módulo de pagamentos", repeat: "once", date: shiftDay(t0, -2), estimateMin: 45, createdAt: created },
    { id: "deploy", title: "Deploy do Margem", repeat: "once", date: t0, estimateMin: 30, createdAt: created },
    { id: "simulado", title: "Simulado CCA-F", repeat: "once", date: shiftDay(t0, 1), estimateMin: 120, createdAt: created },
    { id: "mecanico", title: "Ligar para o mecânico", repeat: "once", date: t0, estimateMin: 15, completedAt: `${t0}T09:00:00`, createdAt: created },
    { id: "meditar", title: "Meditar", repeat: "weekdays", weekdays: [0, 6], estimateMin: 20, archived: true, createdAt: created },
  ];
}

const at = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00`).toISOString();
const s = (id: string, taskId: string, d: string, from: string, to: string, minutes: number, note?: string): Session => ({
  id,
  taskId,
  date: d,
  minutes,
  kind: id.startsWith("m") ? "manual" : "pomodoro",
  startedAt: at(d, from),
  endedAt: at(d, to),
  ...(note ? { note } : {}),
});

/** Histórico das últimas semanas, com falhas de propósito, para a semana e a constância. */
function history(t0: string): Session[] {
  const out: Session[] = [];
  for (let i = 1; i <= 33; i++) {
    const d = shiftDay(t0, -i);
    const dow = new Date(`${d}T12:00:00`).getDay();
    const day = Number(d.slice(8));
    if (dow >= 1 && dow <= 6 && day % 4 !== 0) out.push(s(`h-e-${d}`, "estudo", d, "07:00", "08:30", day % 5 === 0 ? 45 : 90));
    if ((dow === 2 || dow === 4) && day % 3 !== 0) out.push(s(`h-i-${d}`, "ingles", d, "19:00", "19:45", 45));
    if (dow >= 1 && dow <= 5 && i > 3) out.push(s(`h-t-${d}`, "trabalho", d, "08:00", "15:00", 420));
  }
  return out;
}

function sessions(t0: string): Session[] {
  return [
    ...history(t0),
    s("sw-1", "trabalho", t0, "08:10", "09:40", 90, "Ajuste no módulo de pagamentos"),
    s("pomo-2", "estudo", t0, "07:20", "07:45", 25),
    s("m1", "trabalho", shiftDay(t0, -3), "09:00", "12:00", 180, "Daily + revisão de PR"),
    s("m2", "trabalho", shiftDay(t0, -3), "13:00", "17:00", 240),
  ];
}

export interface PreviewData {
  tasks: Task[];
  sessions: Session[];
  settings: Settings;
  signedIn: boolean;
}

/** Monta os dados de um cenário. `now` em ms, para o timer rodando. */
export function previewData(scenario: Scenario, now: number): PreviewData {
  const t0 = todayKey(new Date(now));
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    windows: [null, win, win, win, win, win, { start: "09:00", end: "12:00" }],
    scheduleSet: true,
    onboarded: true,
    lastTimerMode: "stopwatch",
  };
  let ts = tasks(t0);
  let ss = sessions(t0);

  if (scenario === "vazio") {
    ts = [];
    ss = [];
  }
  if (scenario === "sobra") {
    // Dia leve (sem trabalho hoje), para sobrar tempo e aparecer o encaixe.
    ts = ts.filter((t) => t.id !== "trabalho" && t.id !== "pr");
  }
  if (scenario === "apertado") {
    ts = [...ts, { id: "relatorio", title: "Relatório mensal", repeat: "once", date: t0, estimateMin: 150, createdAt: created }];
  }
  if (scenario === "onboarding") {
    // Conta nova: sem tarefas, para aparecer o passo "Sua rotina".
    ts = [];
    ss = [];
    settings.scheduleSet = false;
    settings.onboarded = false;
  }
  if (scenario === "timer") {
    settings.activeTimer = { mode: "stopwatch", taskId: "estudo", phase: "focus", startedAt: new Date(now - 23 * 60000).toISOString(), durationMin: 0 };
    const live = liveSession(settings.activeTimer, now);
    if (live) ss = [...ss, live];
  }
  return { tasks: ts, sessions: ss, settings, signedIn: scenario !== "entrar" };
}
