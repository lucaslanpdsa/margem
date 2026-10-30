/**
 * Dados de exemplo para a prévia (/dev). Só usados em desenvolvimento.
 * A rotina imita um uso real: trabalho com dois horários, academia fora do horário (extra),
 * estudo, inglês, uma tarefa atrasada, uma concluída e uma desativada.
 */
import { shiftDay, todayKey } from "@/lib/dates";
import { liveSession } from "@/lib/timer";
import { DEFAULT_SETTINGS, type DayDoc, type Session, type Settings, type Task } from "@/lib/types";

export { PREVIEW_UID } from "@/lib/preview";

export type Scenario = "dia" | "ponto" | "agenda" | "fila" | "leve" | "noite" | "sobra" | "apertado" | "timer" | "vazio" | "onboarding" | "entrar";
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "dia", label: "Dia normal (com atrasada e sem registro)" },
  { id: "ponto", label: "Trabalho no ponto (trabalhando desde 13:00)" },
  { id: "agenda", label: "Google Agenda conectado (trabalho e compromissos na agenda)" },
  { id: "fila", label: "Fila montada (ordem escolhida)" },
  { id: "leve", label: "Modo leve (sem registrar tempo), dia já planejado" },
  { id: "noite", label: "Horário de hoje acabou (Fechar o dia)" },
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
    { id: "trabalho", title: "Trabalho CI&T", repeat: "weekdays", weekdays: [1, 2, 3, 4, 5], estimateMin: 420, doneBy: "time", slots: [{ start: "08:00", end: "11:00" }, { start: "14:00", end: "18:00" }], createdAt: created,
      goals: { [t0]: [{ id: "g1", text: "Fechar ticket PAG-412 (redirect)", done: true }, { id: "g2", text: "Revisar PR do módulo de pagamentos", done: false }, { id: "g3", text: "Daily: alinhar deploy de sexta", done: false }] } },
    { id: "academia", title: "Academia", repeat: "weekdays", weekdays: [1, 3, 5], estimateMin: 60, slots: [{ start: "18:30", end: "19:30" }], createdAt: created },
    { id: "estudo", title: "Estudar certificação Claude", repeat: "weekdays", weekdays: [1, 2, 3, 4, 5, 6], estimateMin: 90, createdAt: created },
    { id: "ingles", title: "Inglês (Fluency)", repeat: "weekdays", weekdays: [2, 4], estimateMin: 45, createdAt: created },
    { id: "pr", title: "Revisar PR do módulo de pagamentos", repeat: "once", date: shiftDay(t0, -2), estimateMin: 45, createdAt: created },
    { id: "deploy", title: "Deploy do Margem", repeat: "once", date: t0, estimateMin: 30, createdAt: created },
    { id: "simulado", title: "Simulado CCA-F", repeat: "once", date: shiftDay(t0, 1), estimateMin: 120, createdAt: created },
    { id: "mecanico", title: "Ligar para o mecânico", repeat: "once", date: t0, estimateMin: 15, completedAt: `${t0}T09:00:00`, createdAt: created },
    { id: "meditar", title: "Meditar", repeat: "weekdays", weekdays: [0, 6], estimateMin: 20, archived: true, createdAt: created },
    // Depois (sem dia) e lembretes (com dia, sem tempo).
    { id: "oleo", title: "Trocar o óleo do carro", repeat: "once", estimateMin: 0, later: true, createdAt: "2026-10-20T10:00:00.000Z" },
    { id: "freela", title: "Responder proposta de freela Drupal", repeat: "once", estimateMin: 30, later: true, createdAt: "2026-10-22T10:00:00.000Z" },
    { id: "ideia", title: "Ideia: automação de ofertas", repeat: "once", estimateMin: 0, later: true, createdAt: "2026-10-25T10:00:00.000Z" },
    { id: "luz", title: "Pagar a conta de luz", repeat: "once", date: t0, estimateMin: 0, createdAt: created },
    { id: "niver", title: "Aniversário da tia Rosa", repeat: "once", date: shiftDay(t0, 3), estimateMin: 0, createdAt: created },
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
  days: Record<string, DayDoc>;
  signedIn: boolean;
}

/**
 * Dias do histórico em que o estudo e o inglês foram feitos inteiros contam como concluídos pelo círculo,
 * com a estimativa de quando foram concluídos um pouco menor que o feito (para o fator "1,2×" aparecer).
 */
function withEstimates(ts: Task[], ss: Session[], t0: string): Task[] {
  const est: Record<string, [number, number]> = { estudo: [90, 75], ingles: [45, 40] };
  return ts.map((t) => {
    const e = est[t.id];
    if (!e) return t;
    const full = ss.filter((x) => x.taskId === t.id && x.date < t0 && x.minutes === e[0]).map((x) => x.date);
    if (!full.length) return t;
    return {
      ...t,
      completions: { ...t.completions, ...Object.fromEntries(full.map((d) => [d, true])) },
      estAtDone: Object.fromEntries(full.map((d) => [d, e[1]])),
    };
  });
}

/** Monta os dados de um cenário. `now` em ms, para o timer rodando. */
export function previewData(scenario: Scenario, now: number): PreviewData {
  const t0 = todayKey(new Date(now));
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    windows: [null, win, win, win, win, win, { start: "09:00", end: "12:00" }],
    scheduleSet: true,
    onboarded: true,
  };
  let ss = sessions(t0);
  let ts = withEstimates(tasks(t0), ss, t0);
  // Ontem já fechado: o resumo do fechamento ("Ontem: planejado 9h, feito 7h40").
  const days: Record<string, DayDoc> = { [shiftDay(t0, -1)]: { plannedMin: 540, doneMin: 460, closedAt: `${t0}T08:00:00.000Z` } };

  if (scenario === "vazio") {
    ts = [];
    ss = [];
  }
  if (scenario === "fila") {
    // Fila escolhida: o deploy antes do estudo, e uma tarefa nova (fora da fila) que entra no fim.
    ts = [...ts, { id: "nota", title: "Mandar nota fiscal", repeat: "once", date: t0, estimateMin: 20, createdAt: "2026-10-01T09:00:00.000Z" }];
    days[t0] = { order: ["deploy", "ingles", "estudo"] };
  }
  if (scenario === "ponto") {
    // O Trabalho virou ponto: "Seu dia" 07–23, jornada 7h a partir das 08:00; entrou 08:05, almoço 12:02–13:00.
    const trab = ts.find((t) => t.id === "trabalho")!;
    settings.work = { days: [1, 2, 3, 4, 5], dailyMin: trab.estimateMin, start: "08:00", taskId: "trabalho", since: shiftDay(t0, -2) };
    // Os dois dias de ponto antes de hoje: um com 30 min a mais, outro completo.
    const on = (d: string, hm: string) => new Date(`${d}T${hm}:00`).toISOString();
    days[shiftDay(t0, -2)] = { punches: [on(shiftDay(t0, -2), "08:00"), on(shiftDay(t0, -2), "12:00"), on(shiftDay(t0, -2), "13:00"), on(shiftDay(t0, -2), "16:30")], workEnded: true };
    days[shiftDay(t0, -1)] = { ...days[shiftDay(t0, -1)], punches: [on(shiftDay(t0, -1), "08:00"), on(shiftDay(t0, -1), "12:00"), on(shiftDay(t0, -1), "13:00"), on(shiftDay(t0, -1), "16:00")], workEnded: true };
    settings.windows = settings.windows.map((w) => (w ? { start: "07:00", end: "23:00" } : null));
    ts = ts.map((t) => (t.id === "trabalho" ? { ...t, archived: true } : t));
    const at = (hm: string) => new Date(`${t0}T${hm}:00`).toISOString();
    days[t0] = { punches: [at("08:05"), at("12:02"), at("13:00")], plannedAt: at("08:06") };
  }
  if (scenario === "agenda") {
    // Horários vêm do Google Agenda: trabalho e consulta descontam; "Estudar" (Disponível) e o dia inteiro não.
    settings.agenda = { connectedAt: `${t0}T08:00:00.000Z` };
    settings.windows = settings.windows.map((w) => (w ? { start: "07:00", end: "23:00" } : null));
    ts = ts.filter((t) => t.id !== "trabalho");
    const at = (hm: string) => new Date(`${t0}T${hm}:00`).toISOString();
    const ev = (id: string, title: string, a: string, b: string, free = false) => ({ id, title, start: at(a), end: at(b), allDay: false, free });
    days[t0] = {
      agenda: [
        { id: "aniv", title: "Aniversário do Pedro", start: t0, end: shiftDay(t0, 1), allDay: true, free: false },
        ev("t1", "Trabalho", "08:00", "11:00"),
        ev("t2", "Trabalho", "14:00", "18:00"),
        ev("med", "Dentista", "19:00", "19:40"),
        ev("est", "Estudar certificação", "20:00", "21:30", true),
      ],
    };
  }
  if (scenario === "leve") {
    settings.trackTime = false;
    ss = ss.filter((x) => x.date !== t0);
    days[t0] = { plannedAt: `${t0}T08:00:00.000Z` };
  }
  if (scenario === "noite") {
    // O horário de hoje terminou ao meio-dia: aparece o "Fechar o dia".
    settings.windowOverrides = { [t0]: { start: "08:00", end: "12:00" } };
    days[t0] = { plannedAt: `${t0}T08:00:00.000Z` };
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
    // Cronômetro registrando o estudo e, por cima, um pomodoro marcando o ritmo.
    settings.activeTimer = { taskId: "estudo", startedAt: new Date(now - 23 * 60000).toISOString() };
    settings.pomodoro = { phase: "focus", startedAt: new Date(now - 9 * 60000).toISOString(), durationMin: 25, taskId: "pt-estudo", count: 2, countDate: t0 };
    settings.pomodoroTasks = [
      { id: "pt-estudo", title: "Estudar certificação Claude", est: 3, done: 2, fromTaskId: "estudo" },
      { id: "pt-ingles", title: "Inglês (Fluency)", est: 2, done: 0, fromTaskId: "ingles" },
      { id: "pt-ler", title: "Ler capítulo 4", est: 1, done: 1, checked: true },
    ];
    const live = liveSession(settings.activeTimer, now);
    if (live) ss = [...ss, live];
  }
  return { tasks: ts, sessions: ss, settings, days, signedIn: scenario !== "entrar" };
}
