import { findConflicts, mergeBreaks, slotEventText, slotEvents, taskTimeBlocks } from "./schedule";
import { entryTimes, parseDuration, parseQuickAdd, parseTimeEntry } from "./dates";
import { describe, expect, it } from "vitest";
import { dayMetrics, isReminder, tracksTime } from "./metrics";
import { streak, taskWeek, weekHistory } from "./week";
import { planOf } from "./plan";
import { carryOver, goalsFor, goalsKey, nextOccurrence } from "./goals";
import { migrateTask } from "./migrate";
import { isLive, liveSession, migrateTimer, setTimerStart } from "./timer";
import { countToday, isRunning, listSummary, notImported, remainingMs, suggestPomodoros } from "./pomodoro";
import { autoOrder, displayOrder, firstNotFitting, fmtClock, moveInQueue, orderItems, projectDay } from "./queue";
import { MIN_SAMPLES, calibrate, isAccurate, likelyMin, samples } from "./calibration";
import { daysToClose, planFit } from "./closing";
import { captureKind, parseCapture } from "./capture";
import { pontoState, punchesFromSessions, weekWork, workDay, workFromTask } from "./ponto";
import { DEFAULT_SETTINGS, type Block, type Session, type Settings, type Task } from "./types";

const D = "2026-10-16"; // sexta
const base = { createdAt: "2026-10-01T10:00:00.000Z", estimateMin: 60 };

const tasks: Task[] = [
  { ...base, id: "a", title: "Relatório", repeat: "once", date: D },
  { ...base, id: "b", title: "Estudar", repeat: "weekdays", weekdays: [1, 3, 5], estimateMin: 90 },
  { ...base, id: "d", title: "Outro dia", repeat: "once", date: "2026-10-20" },
];
const blocks: Block[] = [];
const sessions: Session[] = [
  { id: "s1", taskId: "b", date: D, minutes: 30, kind: "pomodoro", startedAt: "", endedAt: "" },
];
// Sexta com 4h: 14:00–18:00, sem pausas. "Agora" = 06:00, antes do dia começar.
const settings = { ...DEFAULT_SETTINGS, windows: [null, null, null, null, null, { start: "14:00", end: "18:00" }, null], breaks: [] };
const early = new Date(`${D}T06:00:00`);

describe("dayMetrics", () => {
  const m = dayMetrics(D, settings, tasks, blocks, sessions, early);

  it("inclui avulsa do dia e recorrente do dia", () => {
    expect(m.items.map((i) => i.task.id).sort()).toEqual(["a", "b"]);
  });

  it("calcula capacidade, planejado, feito, restante e livre", () => {
    expect(m.capacityMin).toBe(240);
    expect(m.plannedMin).toBe(60 + 90);
    expect(m.doneMin).toBe(30);
    expect(m.remainingMin).toBe(60 + 60);
    expect(m.freeMin).toBe(240 - 30 - 120);
  });

  it("tarefa concluída mais cedo libera tempo", () => {
    const done = tasks.map((t) => (t.id === "b" ? { ...t, completions: { [D]: true } } : t));
    expect(dayMetrics(D, settings, done, blocks, sessions, early).freeMin).toBe(240 - 30 - 60);
  });

  it("tarefa pulada sai da conta, mas o tempo já feito continua", () => {
    const skip = tasks.map((t) => (t.id === "b" ? { ...t, skipped: { [D]: true } } : t));
    const s = dayMetrics(D, settings, skip, blocks, sessions, early);
    const b = s.items.find((i) => i.task.id === "b")!;
    expect(b.skipped).toBe(true);
    expect(b.completed).toBe(false);
    expect(s.remainingMin).toBe(60);
    expect(s.plannedMin).toBe(60 + 30);
    expect(s.doneMin).toBe(30);
  });

  it("pular vale só para aquele dia", () => {
    const skip = tasks.map((t) => (t.id === "b" ? { ...t, skipped: { "2026-10-14": true } } : t));
    expect(dayMetrics(D, settings, skip, blocks, sessions, early).items.find((i) => i.task.id === "b")!.skipped).toBe(false);
  });

  it("override de capacidade vale para o dia", () => {
    const s = { ...settings, windowOverrides: { [D]: { start: "16:00", end: "18:00" } } };
    expect(dayMetrics(D, s, tasks, blocks, sessions, early).capacityMin).toBe(120);
  });
});

describe("horário do dia", () => {
  const work = {
    ...DEFAULT_SETTINGS,
    windows: [null, null, null, null, null, { start: "07:00", end: "18:00" }, null],
    breaks: [{ label: "Almoço", start: "12:00", end: "13:00" }],
  };

  it("desconta o almoço do tempo do dia", () => {
    expect(dayMetrics(D, work, [], [], [], early).capacityMin).toBe(600);
  });

  it("às 9h, 2h já passaram e o livre considera só o que resta", () => {
    const m = dayMetrics(D, work, tasks, blocks, sessions, new Date(`${D}T09:00:00`));
    expect(m.elapsedMin).toBe(120);
    expect(m.leftMin).toBe(480);
    expect(m.idleMin).toBe(120 - 30);
    expect(m.freeMin).toBe(480 - m.remainingMin);
  });

  it("durante o almoço o relógio não conta", () => {
    expect(dayMetrics(D, work, [], [], [], new Date(`${D}T12:30:00`)).elapsedMin).toBe(300);
  });

  it("tarefa marcada fora do horário não ocupa o horário", () => {
    const evening: Block[] = [{ id: "z", taskId: "b", date: D, start: `${D}T20:00:00`, end: `${D}T21:30:00` }];
    const m = dayMetrics(D, work, tasks, evening, sessions, early);
    const item = m.items.find((i) => i.task.id === "b")!;
    expect(item.outside).toBe(true);
    expect(m.outsideMin).toBe(90);
    expect(m.remainingMin).toBe(60); // só a avulsa "a" ocupa o horário
    expect(m.doneMin).toBe(0); // os 30min feitos em "b" ficam fora do horário
  });


  it("dia sem horário tem capacidade zero", () => {
    expect(dayMetrics("2026-10-18", work, [], [], [], early).capacityMin).toBe(0);
  });
});



it("entende durações", () => {
  expect(["45", "45m", "1h", "1h30", "1:30", "1,5h", "2h05min", "abc"].map(parseDuration)).toEqual([45, 45, 60, 90, 90, 90, 125, null]);
  expect(parseQuickAdd("Estudar React 1h30")).toEqual({ title: "Estudar React", minutes: 90 });
  expect(parseQuickAdd("Ligar pro banco")).toEqual({ title: "Ligar pro banco", minutes: null });
});

describe("horário fixo da tarefa", () => {
  const rec: Task = { id: "g", title: "Academia", repeat: "weekdays", weekdays: [1, 3, 5], time: "18:00", estimateMin: 90, createdAt: "2026-10-01T10:00:00.000Z" };
  const once: Task = { id: "o", title: "Dentista", repeat: "once", date: "2026-10-15", time: "14:30", estimateMin: 60, createdAt: "2026-10-01T10:00:00.000Z" };
  const dates = ["2026-10-14", "2026-10-15", "2026-10-16"]; // qua, qui, sex

  it("cria blocos nos dias em que a tarefa acontece, na hora certa", () => {
    const b = taskTimeBlocks([rec, once], dates);
    expect(b.map((x) => x.date).sort()).toEqual(["2026-10-14", "2026-10-15", "2026-10-16"]);
    const fri = b.find((x) => x.taskId === "g" && x.date === "2026-10-16")!;
    expect(new Date(fri.start).getHours()).toBe(18);
    expect((Date.parse(fri.end) - Date.parse(fri.start)) / 60000).toBe(90);
  });


  it("a tarefa com horário conta como agendada no dia", () => {
    const blocks = taskTimeBlocks([rec], dates);
    const m = dayMetrics("2026-10-16", settings, [rec], blocks, [], early);
    expect(m.items[0].scheduled).toBe(true);
  });
});

describe("tarefa por tempo", () => {
  const work: Task = { id: "w", title: "Trabalho", repeat: "weekdays", weekdays: [5], doneBy: "time", estimateMin: 360, createdAt: "2026-10-01T10:00:00.000Z" };
  const s = (m: number): Session[] => [{ id: "x", taskId: "w", date: D, minutes: m, kind: "manual", startedAt: "", endedAt: "" }];

  it("falta o que ainda não foi cumprido e não conclui antes da meta", () => {
    const [i] = dayMetrics(D, settings, [work], [], s(240), early).items;
    expect(i.completed).toBe(false);
    expect(i.remainingMin).toBe(120);
  });

  it("conclui sozinha ao atingir a meta, mesmo marcada como feita antes", () => {
    expect(dayMetrics(D, settings, [{ ...work, completions: { [D]: true } }], [], s(100), early).items[0].completed).toBe(false);
    expect(dayMetrics(D, settings, [work], [], s(360), early).items[0].completed).toBe(true);
  });
});

describe("vários horários na mesma tarefa", () => {
  const work: Task = {
    id: "w2",
    title: "Trabalho",
    repeat: "weekdays",
    weekdays: [5],
    doneBy: "time",
    estimateMin: 420,
    slots: [
      { start: "08:00", end: "11:00" },
      { start: "14:00", end: "18:00" },
    ],
    createdAt: "2026-10-01T10:00:00.000Z",
  };

  it("gera um bloco por horário, no dia em que a tarefa acontece", () => {
    const b = taskTimeBlocks([work], ["2026-10-15", "2026-10-16"]);
    expect(b).toHaveLength(2);
    expect(b.map((x) => new Date(x.start).getHours())).toEqual([8, 14]);
    expect(b.map((x) => x.slot)).toEqual([0, 1]);
  });

  it("a tarefa continua uma só, com a meta somada", () => {
    const blocks = taskTimeBlocks([work], [D]);
    const m = dayMetrics(D, { ...settings, windows: [null, null, null, null, null, { start: "08:00", end: "18:00" }, null] }, [work], blocks, [], early);
    expect(m.items).toHaveLength(1);
    expect(m.items[0].estimateMin).toBe(420);
    expect(m.items[0].outside).toBe(false);
  });
});

it("entende intervalos de horário e durações", () => {
  expect(parseTimeEntry("14:00-15:30")).toEqual({ minutes: 90, start: "14:00", end: "15:30" });
  expect(parseTimeEntry("14h às 15h30")).toEqual({ minutes: 90, start: "14:00", end: "15:30" });
  expect(parseTimeEntry("9-11")).toEqual({ minutes: 120, start: "09:00", end: "11:00" });
  expect(parseTimeEntry("1h30")).toEqual({ minutes: 90 });
  expect(parseTimeEntry("45m")).toEqual({ minutes: 45 });
  expect(parseTimeEntry("15:00-14:00")).toBeNull();
  expect(parseTimeEntry("abc")).toBeNull();
});

describe("conflito de horário", () => {
  const work: Task = { id: "w", title: "Trabalho", repeat: "weekdays", weekdays: [5], slots: [{ start: "08:00", end: "11:00" }, { start: "14:00", end: "18:00" }], estimateMin: 420, createdAt: "2026-10-01T10:00:00.000Z" };
  const atoa: Task = { id: "t", title: "atoa", repeat: "once", date: D, slots: [{ start: "15:30", end: "16:15" }], estimateMin: 45, createdAt: "2026-10-01T10:00:00.000Z" };
  const gym: Task = { id: "g", title: "Academia", repeat: "once", date: D, slots: [{ start: "11:00", end: "13:00" }], estimateMin: 120, createdAt: "2026-10-01T10:00:00.000Z" };

  it("acha a sobreposição entre tarefas diferentes no mesmo dia", () => {
    const c = findConflicts(taskTimeBlocks([work, atoa], [D]));
    expect(c.map((x) => `${x.taskId}>${x.otherId}`).sort()).toEqual(["t>w", "w>t"]);
  });

  it("horários encostados (11:00 termina, 11:00 começa) não são conflito", () => {
    expect(findConflicts(taskTimeBlocks([work, gym], [D]))).toEqual([]);
  });
});


it("meta semanal antiga vira tarefa que repete de segunda a sexta, por tempo", () => {
  const { task, changed } = migrateTask({ id: "m", title: "Inglês", repeat: "weeklyGoal", weeklyGoalMin: 300, estimateMin: 0, createdAt: "2026-10-01T10:00:00.000Z" });
  expect(changed).toBe(true);
  expect(task).toMatchObject({ repeat: "weekdays", weekdays: [1, 2, 3, 4, 5], estimateMin: 60, doneBy: "time" });
  expect("weeklyGoalMin" in task).toBe(false);
  expect(migrateTask({ ...task }).changed).toBe(false);
});

describe("timer rodando conta ao vivo", () => {
  const start = new Date(`${D}T14:00:00`);
  const sw = { mode: "stopwatch" as const, taskId: "b", phase: "focus" as const, startedAt: start.toISOString(), durationMin: 0 };

  it("vira um registro provisório com o tempo até agora", () => {
    const live = liveSession(sw, start.getTime() + 47 * 60000)!;
    expect(live.minutes).toBe(47);
    expect(live.taskId).toBe("b");
    expect(isLive(live)).toBe(true);
  });

  it("entra no feito do dia e da tarefa", () => {
    const live = liveSession(sw, start.getTime() + 60 * 60000)!;
    const m = dayMetrics(D, settings, tasks, blocks, [live], new Date(`${D}T15:00:00`));
    expect(m.doneMin).toBe(60);
    expect(m.items.find((i) => i.task.id === "b")!.doneMin).toBe(60);
  });

  it("menos de 1 minuto ainda não conta", () => {
    expect(liveSession(sw, start.getTime() + 30000)).toBeNull();
  });
});

describe("avisos de início e fim do horário", () => {
  const job: Task = { id: "j", title: "Trabalho", repeat: "weekdays", weekdays: [5], estimateMin: 180, slots: [{ start: "08:00", end: "11:00" }], createdAt: "2026-10-01T10:00:00.000Z" };

  it("um aviso no início e outro no fim de cada horário", () => {
    const ev = slotEvents([job], D);
    expect(ev.map((e) => [e.kind, e.atMin])).toEqual([
      ["start", 480],
      ["end", 660],
    ]);
  });

  it("pulada, pausada ou de outro dia não avisa", () => {
    expect(slotEvents([{ ...job, skipped: { [D]: true } }], D)).toHaveLength(0);
    expect(slotEvents([{ ...job, archived: true }], D)).toHaveLength(0);
    expect(slotEvents([job], "2026-10-15")).toHaveLength(0);
  });
});

it("com dois horários, o fim do primeiro é pausa e o último é fim do dia", () => {
  const job: Task = {
    id: "j2",
    title: "Trabalho",
    repeat: "weekdays",
    weekdays: [5],
    estimateMin: 420,
    slots: [
      { start: "14:00", end: "18:00" },
      { start: "08:00", end: "11:00" },
    ],
    createdAt: "2026-10-01T10:00:00.000Z",
  };
  expect(slotEvents([job], D).map(slotEventText)).toEqual([
    "Trabalho começa agora (08:00–11:00)",
    "Trabalho: pausa até as 14:00",
    "Trabalho recomeça agora (14:00–18:00)",
    "Trabalho terminou por hoje",
  ]);
});

it("tempo encurtado só vale naquele dia", () => {
  const b = tasks.find((t) => t.id === "b")!;
  const short = { ...b, estimateFor: { [D]: 45 } };
  expect(dayMetrics(D, settings, [short], blocks, [], early).items[0].estimateMin).toBe(45);
  expect(dayMetrics("2026-10-14", { ...settings, windows: Array(7).fill({ start: "14:00", end: "18:00" }) }, [short], blocks, [], early).items[0].estimateMin).toBe(90);
});

it("horário da tarefa não conta como feito sozinho", () => {
  const sim: Task = { id: "s", title: "Simulado", repeat: "once", date: D, estimateMin: 60, slots: [{ start: "07:00", end: "08:00" }], createdAt: "2026-10-01T10:00:00.000Z" };
  const [i] = dayMetrics(D, { ...settings, windows: Array(7).fill({ start: "07:00", end: "18:00" }) }, [sim], [], [], new Date(`${D}T10:00:00`)).items;
  expect(i.doneMin).toBe(0);
  expect(i.completed).toBe(false);
});

it("duração com espaço e registro em outro dia sem horário", () => {
  expect(parseDuration("3h 20m")).toBe(200);
  expect(parseTimeEntry("1h 30")).toEqual({ minutes: 90 });
  const t = entryTimes({ minutes: 60 }, "2026-10-01");
  expect(t.startedAt).toBe(t.endedAt);
  expect(new Date(t.startedAt).getDate()).toBe(1);
});

describe("mudar a hora em que o timer começou", () => {
  const now = new Date(`${D}T10:33:00`);
  const sw = { mode: "stopwatch" as const, taskId: "b", phase: "focus" as const, startedAt: now.toISOString(), durationMin: 0 };
  const base = { ...DEFAULT_SETTINGS, activeTimer: sw };

  it("não aceita horário no futuro nem sem timer", async () => {
    expect(await setTimerStart("u", base, "11:00", now)).toMatch(/futuro/);
    expect(await setTimerStart("u", { ...base, activeTimer: null }, "10:00", now)).toMatch(/Nenhum/);
  });

  it("começando às 10:00, às 10:33 o timer já conta 33min", () => {
    const at10 = { ...sw, startedAt: new Date(`${D}T10:00:00`).toISOString() };
    expect(liveSession(at10, now.getTime())!.minutes).toBe(33);
  });
});

describe("semana da tarefa", () => {
  // Semana de seg 12/10 a dom 18/10; "hoje" = qua 14/10. Estudar 1h seg a sex.
  const t: Task = { ...base, id: "w", title: "Estudar", repeat: "weekdays", weekdays: [1, 2, 3, 4, 5], estimateMin: 60 };
  const s = (date: string, minutes: number): Session => ({ id: date + minutes, taskId: "w", date, minutes, kind: "manual", startedAt: "", endedAt: "" });
  const today = "2026-10-14";

  it("meta da semana é a soma do planejado e o número mostrado é o registrado", () => {
    const w = taskWeek(t, today, [s("2026-10-12", 60)], today);
    expect(w.plannedMin).toBe(300);
    expect(w.doneMin).toBe(60);
    expect(w.leftMin).toBe(240);
  });

  it("atraso vem só dos dias que já passaram", () => {
    const w = taskWeek(t, today, [s("2026-10-12", 60)], today);
    expect(w.behindMin).toBe(60); // terça ficou sem nada; hoje ainda não conta
  });

  it("feito a mais hoje recupera o atraso", () => {
    const w = taskWeek(t, today, [s("2026-10-12", 60), s(today, 90)], today);
    expect(w.behindMin).toBe(30);
  });

  it("concluir pelo círculo cumpre o dia sem inventar horas registradas", () => {
    const done = { ...t, completions: { "2026-10-13": true } };
    const w = taskWeek(done, today, [s("2026-10-12", 60), s("2026-10-13", 20)], today);
    expect(w.behindMin).toBe(0);
    expect(w.doneMin).toBe(80);
  });

  it("dia pulado sai da meta", () => {
    const skip = { ...t, skipped: { "2026-10-13": true } };
    const w = taskWeek(skip, today, [s("2026-10-12", 60)], today);
    expect(w.plannedMin).toBe(240);
    expect(w.behindMin).toBe(0);
  });

  it("tarefa criada no meio da semana não cobra os dias anteriores", () => {
    const novo = { ...t, createdAt: "2026-10-14T10:00:00.000Z" };
    expect(taskWeek(novo, today, [], today).plannedMin).toBe(180);
  });

  it("dias seguidos pulam dias sem plano e hoje não quebra", () => {
    // sex 9, seg 12, ter 13 cumpridos (sáb e dom não são dias dela); hoje (qua) ainda não
    const ss = [s("2026-10-09", 60), s("2026-10-12", 60), s("2026-10-13", 60)];
    expect(streak(t, ss, today, "2026-10-01")).toBe(3);
    expect(streak(t, [...ss, s(today, 60)], today, "2026-10-01")).toBe(4);
    expect(streak(t, [s("2026-10-12", 60)], today, "2026-10-01")).toBe(0); // terça quebrou
  });

  it("histórico traz as últimas semanas, a mais antiga primeiro", () => {
    const h = weekHistory(t, [s("2026-10-05", 120), s(today, 30)], today, 2);
    expect(h.map((w) => w.start)).toEqual(["2026-10-05", "2026-10-12"]);
    expect(h.map((w) => w.doneMin)).toEqual([120, 30]);
  });
});

describe("plano (grátis ou Pro)", () => {
  const now = new Date("2026-11-01T12:00:00Z").getTime();
  const old = "2026-09-01T12:00:00Z";

  it("com a cobrança desligada, todo mundo é Pro", () => {
    expect(planOf(null, old, now, false)).toEqual({ pro: true, reason: "aberto" });
  });

  it("conta nova tem 14 dias de teste", () => {
    const p = planOf(null, "2026-10-25T12:00:00Z", now, true);
    expect(p.pro).toBe(true);
    expect(p.trialDaysLeft).toBe(7);
  });

  it("depois do teste, sem assinatura, é grátis", () => {
    expect(planOf(null, old, now, true).pro).toBe(false);
  });

  it("assinatura ativa é Pro; cancelada vale até o fim do que foi pago", () => {
    expect(planOf({ status: "active" }, old, now, true).reason).toBe("assinante");
    expect(planOf({ status: "cancelled", paidUntil: "2026-11-10T00:00:00Z" }, old, now, true).pro).toBe(true);
    expect(planOf({ status: "cancelled", paidUntil: "2026-10-10T00:00:00Z" }, old, now, true).pro).toBe(false);
  });
});

describe("pomodoro separado do registro", () => {
  it("timer antigo: foco do pomodoro vira cronômetro desde o mesmo início; pausa e espera somem", () => {
    const old = { taskId: "b", startedAt: "2026-10-20T10:00:00.000Z" };
    expect(migrateTimer({ ...old, mode: "pomodoro", phase: "focus", durationMin: 25 })).toEqual(old);
    expect(migrateTimer({ ...old, mode: "pomodoro", phase: "break", durationMin: 5 })).toBeNull();
    expect(migrateTimer({ ...old, mode: "stopwatch", phase: "focus", durationMin: 0, waiting: true })).toBeNull();
    expect(migrateTimer(old)).toBeUndefined();
    expect(migrateTimer(null)).toBeUndefined();
  });

  it("o pomodoro não vira registro no dia", () => {
    // Só o cronômetro (activeTimer) entra ao vivo; o pomodoro fica em settings.pomodoro.
    expect(liveSession(null)).toBeNull();
  });

  it("pausado guarda o que faltava e não está rodando", () => {
    const p = { phase: "focus" as const, startedAt: new Date("2026-10-20T10:00:00").toISOString(), durationMin: 25, pausedLeftMs: 7 * 60000 };
    expect(remainingMs(p, new Date("2026-10-20T12:00:00").getTime())).toBe(7 * 60000);
    expect(isRunning(p)).toBe(false);
  });

  it("contador do dia zera ao virar o dia", () => {
    const p = { phase: "focus" as const, startedAt: "", durationMin: 25, count: 3, countDate: "2026-10-20" };
    expect(countToday(p, "2026-10-20")).toBe(3);
    expect(countToday(p, "2026-10-21")).toBe(0);
  });

  it("tempo que falta na fase; fase esperando mostra a fase inteira", () => {
    const p = { phase: "focus" as const, startedAt: new Date("2026-10-20T10:00:00").toISOString(), durationMin: 25 };
    expect(remainingMs(p, new Date("2026-10-20T10:10:00").getTime())).toBe(15 * 60000);
    expect(remainingMs({ ...p, waiting: true }, new Date("2026-10-20T11:00:00").getTime())).toBe(25 * 60000);
  });
});

describe("lista do pomodoro (só contagem, sem horas)", () => {
  const ciclo = { focusMin: 25, breakMin: 5 };

  it("sugestão ao importar usa o ciclo inteiro (foco + pausa)", () => {
    expect(suggestPomodoros(420, ciclo)).toBe(14); // 7h / 30min
    expect(suggestPomodoros(20, ciclo)).toBe(1);
  });

  it("tarefa apagada da lista pode ser importada de novo", () => {
    const app = [{ id: "estudo" }, { id: "ingles" }];
    const settings = { ...DEFAULT_SETTINGS, pomodoroTasks: [{ id: "p1", title: "Estudo", est: 3, done: 0, fromTaskId: "estudo" }] };
    expect(notImported(settings, app).map((x) => x.id)).toEqual(["ingles"]);
    expect(notImported({ ...settings, pomodoroTasks: [] }, app).map((x) => x.id)).toEqual(["estudo", "ingles"]);
  });

  it("deixadas de fora não aparecem para importar até o dia seguinte", () => {
    const app = [{ id: "academia" }, { id: "ingles" }];
    const settings = { ...DEFAULT_SETTINGS, pomodoroSkip: { date: "2026-10-20", ids: ["academia"] } };
    expect(notImported(settings, app, "2026-10-20").map((x) => x.id)).toEqual(["ingles"]);
    expect(notImported(settings, app, "2026-10-21").map((x) => x.id)).toEqual(["academia", "ingles"]);
  });

  it("resumo: feitos/estimados das não concluídas e quando acaba", () => {
    const list = [
      { id: "a", title: "A", est: 3, done: 1 },
      { id: "b", title: "B", est: 2, done: 5 }, // passou da estimativa: conta só até ela
      { id: "c", title: "C", est: 4, done: 0, checked: true }, // concluída: fora
    ];
    const now = new Date("2026-10-20T16:00:00").getTime();
    const s = listSummary(list, ciclo, now);
    expect([s.done, s.est, s.leftMin]).toEqual([3, 5, 60]);
    expect(s.finishAt.getHours()).toBe(17);
  });
});

describe("objetivos do dia", () => {
  const rep: Task = { ...base, id: "r", title: "Trabalho", repeat: "weekdays", weekdays: [1, 3, 5] };
  const once: Task = { ...base, id: "o", title: "Relatório", repeat: "once", date: D, goals: { _: [{ id: "1", text: "x", done: false }] } };
  it("repete: por dia; uma vez: lista única, mesmo mudando de dia", () => {
    expect(goalsKey(rep, D)).toBe(D);
    expect(goalsFor(once, "2026-10-20")).toHaveLength(1);
  });
  it("próximo dia da tarefa (sexta → segunda)", () => {
    expect(nextOccurrence(rep, D)).toBe("2026-10-19");
    expect(nextOccurrence(once, D)).toBeNull();
  });
  it("levar para o próximo dia: só os não feitos, sem repetir texto", () => {
    const r = carryOver(
      [
        { id: "1", text: "A", done: true },
        { id: "2", text: "B", done: false },
        { id: "3", text: "C", done: false },
      ],
      [{ id: "4", text: "c ", done: false }],
    );
    expect(r.from.map((g) => g.text)).toEqual(["A"]);
    expect(r.to.map((g) => g.text)).toEqual(["c ", "B"]);
  });
});

// ---------- Fila do dia ----------

describe("fila do dia", () => {
  // Sexta 14:00–18:00 (4h), sem pausas. "Agora" = 15:00.
  const at15 = new Date(`${D}T15:00:00`);
  const t = (id: string, estimateMin: number, extra: Partial<Task> = {}): Task => ({ ...base, id, title: id, repeat: "once", date: D, estimateMin, ...extra });
  const run = (ts: Task[], order: string[] | undefined, opts: { now?: Date; s?: Settings; ss?: Session[]; running?: string } = {}) => {
    const st = opts.s ?? settings;
    const now = opts.now ?? at15;
    const bl = taskTimeBlocks(ts, [D]);
    const m = dayMetrics(D, st, ts, bl, opts.ss ?? [], now);
    const ordered = orderItems(m.items, order, bl, D);
    const room = Math.max(0, m.capacityMin - Math.max(m.doneMin, m.elapsedMin));
    const p = projectDay(ordered, st, D, now, room, opts.running);
    const at = (id: string) => {
      const x = p.byTask.get(id)!;
      return `${fmtClock(x.start)}-${fmtClock(x.end)}`;
    };
    return { m, ordered, p, at, room };
  };

  it("sem fila salva, vale a ordem automática; com fila, as novas vão para o fim", () => {
    const ts = [t("a", 30), t("b", 30, { createdAt: "2026-10-02T10:00:00.000Z" }), t("c", 30, { createdAt: "2026-10-03T10:00:00.000Z" })];
    expect(run(ts, undefined).ordered.map((i) => i.task.id)).toEqual(["a", "b", "c"]);
    expect(run(ts, ["c", "a"]).ordered.map((i) => i.task.id)).toEqual(["c", "a", "b"]);
  });

  it("prevê o horário de cada uma na ordem da fila, a partir de agora", () => {
    const r = run([t("x", 60), t("y", 90)], ["y", "x"]);
    expect(r.at("y")).toBe("15:00-16:30");
    expect(r.at("x")).toBe("16:30-17:30");
    expect(r.p.excessMin).toBe(0);
  });

  it("pula as pausas fixas", () => {
    const s = { ...settings, breaks: [{ label: "Café", start: "16:00", end: "16:30" }] };
    const r = run([t("x", 60), t("y", 90)], ["y", "x"], { s });
    expect(r.at("y")).toBe("15:00-17:00");
    expect(r.at("x")).toBe("17:00-18:00");
  });

  it("o que não cabe bate com o 'Não cabe' do topo do dia", () => {
    const r = run([t("x", 60), t("y", 90), t("z", 60)], ["y", "x", "z"]);
    const excess = r.m.remainingMin - Math.min(r.m.remainingMin, r.room);
    expect(excess).toBe(30);
    expect(r.p.excessMin).toBe(excess);
    expect(r.p.byTask.get("z")!.fits).toBe(false);
    expect(r.p.byTask.get("z")!.excessMin).toBe(30);
    expect(r.p.byTask.get("x")!.fits).toBe(true);
  });

  it("usa o que falta pelos registros, não a estimativa inteira", () => {
    const ss: Session[] = [{ id: "s", taskId: "y", date: D, minutes: 60, kind: "manual", startedAt: "", endedAt: "" }];
    const r = run([t("x", 60), t("y", 90)], ["y", "x"], { ss });
    expect(r.at("y")).toBe("15:00-15:30");
    expect(r.at("x")).toBe("15:30-16:30");
  });

  it("tarefa com horário ainda por vir fica no horário dela; as outras se encaixam em volta", () => {
    const f = t("f", 60, { slots: [{ start: "16:00", end: "17:00" }] });
    const r = run([f, t("x", 90)], ["f", "x"]);
    expect(r.p.byTask.get("f")!.fixed).toBe(true);
    expect(r.at("f")).toBe("16:00-17:00");
    expect(r.at("x")).toBe("15:00-17:30");
    // Na tela, cada uma aparece onde acontece: x começa antes de f.
    expect(displayOrder(r.ordered, r.p).map((i) => i.task.id)).toEqual(["x", "f"]);
  });

  it("horário que já passou não prende a tarefa: o que falta vai para a fila", () => {
    const f = t("f", 60, { slots: [{ start: "14:00", end: "15:00" }] });
    const r = run([t("x", 30), f], ["x", "f"]);
    expect(r.p.byTask.get("f")!.fixed).toBe(false);
    expect(r.at("x")).toBe("15:00-15:30");
    expect(r.at("f")).toBe("15:30-16:30");
  });

  it("o que passar do horário da fixa entra na fila, e o total continua batendo", () => {
    const f = t("f", 120, { slots: [{ start: "17:00", end: "18:00" }] });
    const r = run([t("x", 120), f], ["x", "f"]);
    expect(r.at("x")).toBe("15:00-17:00");
    // f: 17–18 no horário; os outros 60min não cabem antes (x ocupou), então passam do fim.
    expect(r.p.byTask.get("f")!.excessMin).toBe(60);
    expect(r.p.excessMin).toBe(r.m.remainingMin - Math.min(r.m.remainingMin, r.room));
  });

  it("na tela: as que cabem (mesmo em parte) pelo horário, depois as extra, por último as que não cabem nada", () => {
    const f = t("f", 120, { slots: [{ start: "17:00", end: "18:00" }] });
    const e = t("e", 30, { slots: [{ start: "19:00", end: "19:30" }] });
    const r = run([t("x", 120), f, t("z", 30), e], ["z", "x", "f"]);
    // z 15:00–15:30, x 15:30–17:00 + nada (f ocupa 17–18), f em parte; o resto de x e o de f não cabem.
    const shown = displayOrder(r.ordered, r.p);
    expect(shown.map((i) => i.task.id)).toEqual(["z", "x", "f", "e"]);
    expect(firstNotFitting(shown, r.p)).toBe(-1);
    const r2 = run([t("x", 240), t("y", 30), e], ["x", "y"]);
    const shown2 = displayOrder(r2.ordered, r2.p);
    expect(shown2.map((i) => i.task.id)).toEqual(["x", "e", "y"]);
    expect(firstNotFitting(shown2, r2.p)).toBe(2);
  });

  it("o cronômetro rodando vem primeiro", () => {
    const r = run([t("x", 60), t("y", 60)], ["x", "y"], { running: "y" });
    expect(r.at("y")).toBe("15:00-16:00");
    expect(r.at("x")).toBe("16:00-17:00");
  });

  it("dia futuro começa no início do horário; dia passado não tem previsão", () => {
    const r = run([t("x", 60)], undefined, { now: new Date(`${D}T06:00:00`) });
    expect(r.at("x")).toBe("14:00-15:00");
    const past = run([t("x", 60)], undefined, { now: new Date("2026-10-17T10:00:00") });
    expect(past.p.byTask.size).toBe(0);
    expect(displayOrder(past.ordered, past.p).map((i) => i.task.id)).toEqual(["x"]);
  });

  it("concluídas, puladas e extra ficam fora da previsão", () => {
    const r = run([t("x", 60, { completedAt: `${D}T10:00:00` }), t("e", 60, { slots: [{ start: "20:00", end: "21:00" }] }), t("y", 30)], undefined);
    expect([...r.p.byTask.keys()]).toEqual(["y"]);
  });

  it("mover na fila: para o topo, subir/descer pulando as fixas, antes de outra", () => {
    const ids = ["a", "f", "b", "c"];
    const movable = new Set(["a", "b", "c"]);
    expect(moveInQueue(ids, "c", "top", movable)).toEqual(["c", "a", "f", "b"]);
    expect(moveInQueue(ids, "b", "up", movable)).toEqual(["b", "f", "a", "c"]);
    expect(moveInQueue(ids, "a", "up", movable)).toEqual(ids);
    expect(moveInQueue(ids, "c", "down", movable)).toEqual(ids);
    expect(moveInQueue(ids, "a", { before: "c" })).toEqual(["f", "b", "a", "c"]);
    expect(moveInQueue(ids, "a", { before: null })).toEqual(["f", "b", "c", "a"]);
  });

  it("ordem automática: com horário pela hora, depois pela criação", () => {
    const ts = [t("n", 30), t("h", 30, { slots: [{ start: "16:00", end: "16:30" }] })];
    const m = dayMetrics(D, settings, ts, taskTimeBlocks(ts, [D]), [], at15);
    expect(autoOrder(m.items, taskTimeBlocks(ts, [D]), D).map((i) => i.task.id)).toEqual(["h", "n"]);
  });

  it("horário previsto arredondado de 5 em 5 minutos", () => {
    expect(fmtClock(15 * 60 + 2)).toBe("15:00");
    expect(fmtClock(15 * 60 + 3)).toBe("15:05");
    expect(fmtClock(23 * 60 + 58)).toBe("00:00");
  });
});

// ---------- Estimado vs. realizado ----------

describe("calibração", () => {
  const sess = (taskId: string, date: string, minutes: number): Session => ({ id: `${taskId}-${date}`, taskId, date, minutes, kind: "manual", startedAt: "", endedAt: "" });
  const once = (id: string, est: number, done: string): Task => ({ ...base, id, title: id, repeat: "once", date: done, estimateMin: est, completedAt: `${done}T15:00:00`, estAtDone: { _: est } });

  it("compara a estimativa gravada ao concluir com o registrado (soma, não média das razões)", () => {
    const ts = [once("a", 60, D), once("b", 30, D)];
    const list = samples(ts, [sess("a", D, 90), sess("b", D, 30)], "2026-10-01");
    expect(list.map((s) => [s.taskId, s.estMin, s.realMin])).toEqual([["a", 60, 90], ["b", 30, 30]]);
    expect(calibrate(list).factor).toBeCloseTo(120 / 90);
  });

  it("de uma vez: soma os registros de todos os dias", () => {
    expect(samples([once("a", 60, D)], [sess("a", "2026-10-15", 40), sess("a", D, 40)], "2026-10-01")[0].realMin).toBe(80);
  });

  it("que repete: só o dia, e só se concluído nele", () => {
    const r: Task = { ...base, id: "r", title: "r", repeat: "weekdays", weekdays: [4, 5], completions: { [D]: true, "2026-10-15": false }, estAtDone: { [D]: 45, "2026-10-15": 45 } };
    const list = samples([r], [sess("r", D, 50), sess("r", "2026-10-15", 30)], "2026-10-01");
    expect(list).toEqual([{ taskId: "r", date: D, estMin: 45, realMin: 50 }]);
  });

  it("fica de fora: 'cumpro o tempo', sem registro, antes do período, sem estimativa gravada", () => {
    const ts = [
      { ...once("t", 60, D), doneBy: "time" as const },
      once("vazia", 60, D),
      once("velha", 60, "2026-09-01"),
      { ...once("sem", 60, D), estAtDone: undefined },
    ];
    const ss = [sess("t", D, 60), sess("velha", "2026-09-01", 60), sess("sem", D, 60)];
    expect(samples(ts, ss, "2026-10-01")).toEqual([]);
  });

  it(`só aparece com ${MIN_SAMPLES} tarefas ou mais`, () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ taskId: `${i}`, date: D, estMin: 30, realMin: 32 }));
    expect(calibrate(mk(MIN_SAMPLES - 1)).ready).toBe(false);
    const c = calibrate(mk(MIN_SAMPLES));
    expect(c.ready).toBe(true);
    expect(isAccurate(c)).toBe(true);
    expect(calibrate([]).factor).toBe(1);
  });

  it("quanto uma estimativa costuma virar, de 5 em 5 minutos", () => {
    expect(likelyMin(45, { n: 20, factor: 1.3, ready: true })).toBe(60);
  });
});

// ---------- Fechamento do dia ----------

describe("fechamento do dia", () => {
  const s = { ...DEFAULT_SETTINGS, windows: [null, { start: "08:00", end: "18:00" }, { start: "08:00", end: "18:00" }, null, null, null, null] };

  it("fotografa os dias passados com horário que ainda não foram fechados", () => {
    // Quarta 2026-10-21: olha seg (19), ter (20). Domingo e quarta não têm horário aqui.
    expect(daysToClose("2026-10-21", {}, s)).toEqual(["2026-10-19", "2026-10-20"]);
    expect(daysToClose("2026-10-21", { "2026-10-20": { closedAt: "x" } }, s)).toEqual(["2026-10-19"]);
    expect(daysToClose("2026-10-21", { "2026-10-20": { order: ["a"] } }, s)).toEqual(["2026-10-19", "2026-10-20"]);
  });

  it("o plano coube com 90% ou mais do planejado feito", () => {
    expect(planFit({ plannedMin: 600, doneMin: 540 })).toBe(true);
    expect(planFit({ plannedMin: 600, doneMin: 500 })).toBe(false);
    expect(planFit({ plannedMin: 0, doneMin: 100 })).toBe(false);
  });
});

// ---------- Captura ----------

describe("captura em uma linha", () => {
  const T = "2026-10-29"; // quinta
  const c = (s: string) => parseCapture(s, T);

  it("só título vai para Depois", () => {
    expect(c("Ideia: vender cursos")).toEqual({ title: "Ideia: vender cursos", minutes: null, date: null });
    expect(captureKind(c("Ideia: vender cursos"))).toBe("later");
  });

  it("tempo sem dia vai para Depois com tempo", () => {
    expect(c("Estudar Docker 1h")).toEqual({ title: "Estudar Docker", minutes: 60, date: null });
  });

  it("dia sem tempo é lembrete", () => {
    expect(c("Pagar luz dia 10")).toEqual({ title: "Pagar luz", minutes: null, date: "2026-11-10" });
    expect(c("Pagar luz dia 30").date).toBe("2026-10-30");
    expect(captureKind(c("Pagar luz dia 10"))).toBe("reminder");
  });

  it("hoje, amanhã, depois de amanhã e dia da semana (o próximo, nunca hoje)", () => {
    expect(c("Ligar pro mecânico amanhã").date).toBe("2026-10-30");
    expect(c("Ligar pro mecânico amanhã").title).toBe("Ligar pro mecânico");
    expect(c("Ver pneu hoje").date).toBe(T);
    expect(c("Ver pneu depois de amanhã")).toEqual({ title: "Ver pneu", minutes: null, date: "2026-10-31" });
    expect(c("Mercado na sexta").date).toBe("2026-10-30");
    expect(c("Mercado na sexta").title).toBe("Mercado");
    expect(c("Revisão quinta-feira").date).toBe("2026-11-05");
    expect(c("Revisão seg").date).toBe("2026-11-02");
  });

  it("dia/mês, com o ano que vem quando já passou", () => {
    expect(c("Prova 15/11").date).toBe("2026-11-15");
    expect(c("Renovar seguro 10/02").date).toBe("2027-02-10");
    expect(c("Renovar seguro 31/02").date).toBeNull();
  });

  it("dia e tempo em qualquer ordem viram tarefa", () => {
    expect(c("Simulado amanhã 2h")).toEqual({ title: "Simulado", minutes: 120, date: "2026-10-30" });
    expect(c("Simulado 2h amanhã")).toEqual({ title: "Simulado", minutes: 120, date: "2026-10-30" });
    expect(captureKind(c("Simulado amanhã 2h"))).toBe("task");
  });

  it("nunca come o título inteiro", () => {
    expect(c("amanhã")).toEqual({ title: "amanhã", minutes: null, date: null });
    expect(c("1h")).toEqual({ title: "1h", minutes: null, date: null });
    expect(c("Ir na sexta")).toEqual({ title: "Ir", minutes: null, date: "2026-10-30" });
  });
});

// ---------- Depois e lembretes ----------

describe("Depois e lembretes", () => {
  it("o que está em Depois não entra em nenhum dia nem fica atrasado", () => {
    const later: Task = { ...base, id: "l", title: "l", repeat: "once", date: "2026-10-10", later: true };
    expect(dayMetrics("2026-10-10", settings, [later], [], [], early).items).toEqual([]);
    expect(dayMetrics(D, settings, [later], [], [], early).items).toEqual([]);
  });

  it("lembrete aparece no dia e não ocupa horas", () => {
    const r: Task = { ...base, id: "r", title: "Pagar luz", repeat: "once", date: D, estimateMin: 0 };
    const m = dayMetrics(D, settings, [r], [], [], early);
    expect(m.items.map((i) => i.task.id)).toEqual(["r"]);
    expect(m.plannedMin).toBe(0);
    expect(m.remainingMin).toBe(0);
    expect(isReminder(r)).toBe(true);
    expect(isReminder({ ...r, estimateMin: 30 })).toBe(false);
  });

  it("registro de tempo: ligado por padrão (contas antigas)", () => {
    expect(tracksTime({})).toBe(true);
    expect(tracksTime({ trackTime: false })).toBe(false);
  });
});

// ---------- Modo leve: bloco reservado ----------

describe("modo leve: 'cumpro o tempo' com horário vira bloco reservado", () => {
  // Sexta 14:00–18:00 (4h). Trabalho 15:00–17:00 por tempo. Agora = 14:30.
  const leve = { ...settings, trackTime: false };
  const now = new Date(`${D}T14:30:00`);
  const work: Task = { ...base, id: "w", title: "Trabalho", repeat: "once", date: D, estimateMin: 120, doneBy: "time", slots: [{ start: "15:00", end: "17:00" }] };
  const x: Task = { ...base, id: "x", title: "x", repeat: "once", date: D, estimateMin: 60 };

  it("o horário do bloco sai do tempo do dia e ele não deve nada", () => {
    const m = dayMetrics(D, leve, [work, x], taskTimeBlocks([work, x], [D]), [], now);
    expect(m.capacityMin).toBe(240 - 120);
    expect(m.elapsedMin).toBe(30);
    expect(m.plannedMin).toBe(60);
    expect(m.remainingMin).toBe(60);
    expect(m.freeMin).toBe(120 - 30 - 60);
    expect(m.items.find((i) => i.task.id === "w")!.block).toBe(true);
    expect(m.doneMin).toBe(0); // nada conta como feito
  });

  it("com registro ligado, continua como antes (deve a meta)", () => {
    const m = dayMetrics(D, settings, [work, x], taskTimeBlocks([work, x], [D]), [], now);
    expect(m.capacityMin).toBe(240);
    expect(m.remainingMin).toBe(180);
    expect(m.items.find((i) => i.task.id === "w")!.block).toBeUndefined();
  });

  it("sem horário, não vira bloco (precisa do cronômetro)", () => {
    const noSlots = { ...work, slots: undefined };
    const m = dayMetrics(D, leve, [noSlots], [], [], now);
    expect(m.items[0].block).toBeUndefined();
    expect(m.remainingMin).toBe(120);
  });

  it("pulado hoje, o horário volta a ficar livre", () => {
    const skipped = { ...work, repeat: "weekdays" as const, weekdays: [5], skipped: { [D]: true } };
    expect(dayMetrics(D, leve, [skipped], [], [], now).capacityMin).toBe(240);
  });

  it("bloco junto com pausa no mesmo horário não desconta duas vezes", () => {
    const s = { ...leve, breaks: [{ label: "Café", start: "16:00", end: "16:30" }] };
    expect(dayMetrics(D, s, [work], [], [], now).capacityMin).toBe(240 - 120);
  });

  it("a fila passa por cima do bloco, e o que não cabe bate com o topo", () => {
    const y: Task = { ...x, id: "y", estimateMin: 90 };
    const ts = [work, x, y];
    const bl = taskTimeBlocks(ts, [D]);
    const m = dayMetrics(D, leve, ts, bl, [], now);
    const ordered = orderItems(m.items.filter((i) => !i.completed), ["x", "y"], bl, D);
    const room = Math.max(0, m.capacityMin - Math.max(m.doneMin, m.elapsedMin));
    const p = projectDay(ordered, leve, D, now, room);
    const at = (id: string) => `${fmtClock(p.byTask.get(id)!.start)}-${fmtClock(p.byTask.get(id)!.end)}`;
    expect(at("x")).toBe("14:30-17:30"); // 14:30–15:00 e 17:00–17:30
    expect(at("w")).toBe("15:00-17:00");
    expect(p.byTask.get("w")!.fixed).toBe(true);
    expect(p.excessMin).toBe(m.remainingMin - Math.min(m.remainingMin, room));
    expect(p.excessMin).toBe(60);
  });
});

describe("juntar pausas", () => {
  it("junta as que se sobrepõem", () => {
    expect(mergeBreaks([{ label: "a", start: "12:00", end: "13:00" }, { label: "b", start: "12:30", end: "14:00" }, { label: "c", start: "15:00", end: "15:10" }]).map((b) => `${b.start}-${b.end}`)).toEqual(["12:00-14:00", "15:00-15:10"]);
  });
});

// ---------- Ponto ----------

describe("ponto", () => {
  // Sexta: "Seu dia" 07–23 com almoço 12–13; jornada 8h, entrada habitual 08:00.
  const P = { ...DEFAULT_SETTINGS, windows: [null, null, null, null, null, { start: "07:00", end: "23:00" }, null], breaks: [{ label: "Almoço", start: "12:00", end: "13:00" }], work: { days: [1, 2, 3, 4, 5], dailyMin: 480, start: "08:00" } };
  const iso = (hm: string, d = D) => new Date(`${d}T${hm}:00`).toISOString();
  const at = (hm: string, d = D) => new Date(`${d}T${hm}:00`);

  it("estado pelas marcações", () => {
    expect(pontoState([])).toBe("fora");
    expect(pontoState([iso("08:00")])).toBe("trabalhando");
    expect(pontoState([iso("08:00"), iso("12:00")])).toBe("pausa");
    expect(pontoState([iso("08:00"), iso("17:00")], true)).toBe("encerrado");
  });

  it("antes da entrada, a jornada é prevista a partir da entrada habitual, pulando o almoço", () => {
    const w = workDay(P.work, D, undefined, P.breaks, at("07:30"))!;
    expect(w.state).toBe("fora");
    expect(w.workedMin).toBe(0);
    expect(w.exitAt).toBe(17 * 60);
    expect(w.intervals).toEqual([[480, 720], [780, 1020]]);
  });

  it("trabalhando: conta até agora e prevê a saída pelo que falta", () => {
    const w = workDay(P.work, D, { punches: [iso("08:20")] }, P.breaks, at("10:20"))!;
    expect(w.state).toBe("trabalhando");
    expect(w.workedMin).toBe(120);
    expect(w.leftMin).toBe(360);
    expect(w.exitAt).toBe(17 * 60 + 20); // entrou 20 min depois, sai 20 min depois
  });

  it("em pausa: o que falta é previsto a partir de agora", () => {
    const w = workDay(P.work, D, { punches: [iso("08:00"), iso("12:00")] }, P.breaks, at("12:30"))!;
    expect(w.state).toBe("pausa");
    expect(w.workedMin).toBe(240);
    expect(w.predicted).toEqual([[780, 1020]]);
  });

  it("depois de Sair, nada é previsto, mesmo sem cumprir a jornada", () => {
    const w = workDay(P.work, D, { punches: [iso("08:00"), iso("12:00"), iso("13:00"), iso("16:00")], workEnded: true }, P.breaks, at("16:30"))!;
    expect(w.state).toBe("encerrado");
    expect(w.workedMin).toBe(420);
    expect(w.leftMin).toBe(0);
    expect(w.exitAt).toBe(16 * 60);
  });

  it("dia que não é de trabalho e sem marcação: sem ponto; dia passado: só as marcações", () => {
    expect(workDay(P.work, "2026-10-17", undefined, P.breaks, at("10:00"))).toBeNull();
    const past = workDay(P.work, "2026-10-15", { punches: [iso("09:00", "2026-10-15")] }, P.breaks, at("10:00"))!;
    expect(past.workedMin).toBe(0); // esqueceu de sair: não inventa horas
    expect(past.predicted).toEqual([]);
  });

  it("o trabalho sai do tempo do dia: as tarefas ficam com o resto", () => {
    const x: Task = { ...base, id: "x", title: "Estudar", repeat: "once", date: D, estimateMin: 90 };
    const m = dayMetrics(D, P, [x], [], [], at("10:20"), { punches: [iso("08:20")] });
    // Seu dia 07–23 (16h) − almoço 1h = 15h; trabalho 08:20–12:00 e 13:00–17:20 = 8h.
    expect(m.capacityMin).toBe(900 - 480);
    // Já passou do tempo livre: 07:00–08:20 = 80 min.
    expect(m.elapsedMin).toBe(80);
    expect(m.freeMin).toBe(420 - 80 - 90);
    expect(m.work?.exitAt).toBe(17 * 60 + 20);
  });

  it("os registros da antiga tarefa Trabalho não contam em dobro", () => {
    const Pw = { ...P, work: { ...P.work, taskId: "trab" } };
    const ss: Session[] = [{ id: "s", taskId: "trab", date: D, minutes: 120, kind: "manual", startedAt: "", endedAt: "" }];
    expect(dayMetrics(D, Pw, [], [], ss, at("10:20"), { punches: [iso("08:20")] }).doneMin).toBe(0);
  });

  it("a fila passa por cima do trabalho, e o que não cabe bate com o topo", () => {
    const ts: Task[] = [
      { ...base, id: "a", title: "a", repeat: "once", date: D, estimateMin: 60 },
      { ...base, id: "b", title: "b", repeat: "once", date: D, estimateMin: 120 },
    ];
    const m = dayMetrics(D, P, ts, [], [], at("07:30"), undefined);
    const ordered = orderItems(m.items, ["a", "b"], [], D);
    const room = Math.max(0, m.capacityMin - Math.max(m.doneMin, m.elapsedMin));
    const p = projectDay(ordered, { ...P, breaks: m.breaks }, D, at("07:30"), room);
    const span = (id: string) => `${fmtClock(p.byTask.get(id)!.start)}-${fmtClock(p.byTask.get(id)!.end)}`;
    expect(span("a")).toBe("07:30-17:30"); // 07:30–08:00 e, depois do trabalho, 17:00–17:30
    expect(span("b")).toBe("17:30-19:30");
    expect(p.excessMin).toBe(m.remainingMin - Math.min(m.remainingMin, room));
  });

  it("semana: trabalhado, jornada e saldo só dos dias fechados", () => {
    const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", D, "2026-10-17", "2026-10-18"];
    const days = {
      "2026-10-12": { punches: [iso("08:00", "2026-10-12"), iso("17:30", "2026-10-12")] }, // 9h30 (+1h30)
      "2026-10-13": { punches: [iso("08:00", "2026-10-13"), iso("15:00", "2026-10-13")] }, // 7h (−1h)
      [D]: { punches: [iso("08:00")] }, // hoje, aberto
    };
    const w = weekWork(P.work, week, days, at("10:00"));
    expect(w.plannedMin).toBe(5 * 480);
    expect(w.workedMin).toBe(570 + 420 + 120);
    // 14 e 15 sem marcação contam como −8h cada.
    expect(w.balanceMin).toBe(90 - 60 - 480 - 480);
  });

  it("transformar a tarefa Trabalho: jornada e marcações a partir dela", () => {
    const t: Task = { ...base, id: "trab", title: "Trabalho", repeat: "weekdays", weekdays: [5, 1, 2], estimateMin: 420, doneBy: "time", slots: [{ start: "14:00", end: "18:00" }, { start: "08:00", end: "11:00" }] };
    expect(workFromTask(t)).toEqual({ days: [1, 2, 5], dailyMin: 420, start: "08:00", taskId: "trab" });
    const ss: Session[] = [
      { id: "1", taskId: "trab", date: D, minutes: 60, kind: "manual", startedAt: iso("08:00"), endedAt: iso("09:00") },
      { id: "2", taskId: "trab", date: D, minutes: 60, kind: "manual", startedAt: iso("09:00"), endedAt: iso("10:00") },
      { id: "3", taskId: "trab", date: D, minutes: 30, kind: "manual", startedAt: iso("12:00"), endedAt: iso("12:00") }, // sem horário
      { id: "4", taskId: "outra", date: D, minutes: 60, kind: "manual", startedAt: iso("13:00"), endedAt: iso("14:00") },
    ];
    expect(punchesFromSessions(ss, "trab")).toEqual({ [D]: [iso("08:00"), iso("10:00")] });
  });
});

describe("ponto: saldo só depois de começar", () => {
  it("dia sem marcação antes do ponto não é falta", () => {
    const work = { days: [1, 2, 3, 4, 5], dailyMin: 480, start: "08:00", since: D };
    const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", D, "2026-10-17", "2026-10-18"];
    const at = new Date(`${D}T18:00:00`);
    const p = [new Date(`${D}T08:00:00`).toISOString(), new Date(`${D}T17:30:00`).toISOString()];
    expect(weekWork(work, week, { [D]: { punches: p, workEnded: true } }, at).balanceMin).toBe(90);
  });
});
