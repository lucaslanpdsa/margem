import { findConflicts, slotEventText, slotEvents, taskTimeBlocks } from "./schedule";
import { entryTimes, parseDuration, parseQuickAdd, parseTimeEntry } from "./dates";
import { describe, expect, it } from "vitest";
import { dayMetrics } from "./metrics";
import { streak, taskWeek, weekHistory } from "./week";
import { planOf } from "./plan";
import { migrateTask } from "./migrate";
import { isLive, liveSession, migrateTimer, setTimerStart } from "./timer";
import { remainingMs } from "./pomodoro";
import { DEFAULT_SETTINGS, type Block, type Session, type Task } from "./types";

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

  it("tempo que falta na fase; fase esperando mostra a fase inteira", () => {
    const p = { phase: "focus" as const, startedAt: new Date("2026-10-20T10:00:00").toISOString(), durationMin: 25 };
    expect(remainingMs(p, new Date("2026-10-20T10:10:00").getTime())).toBe(15 * 60000);
    expect(remainingMs({ ...p, waiting: true }, new Date("2026-10-20T11:00:00").getTime())).toBe(25 * 60000);
  });
});
