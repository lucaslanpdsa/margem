import { parseDuration, parseQuickAdd } from "./dates";
import { describe, expect, it } from "vitest";
import { dayMetrics, flexibleQueue, suggestNow, weeklyGoals } from "./metrics";
import { DEFAULT_SETTINGS, type Block, type Session, type Task } from "./types";

const D = "2026-10-16"; // sexta
const base = { priority: 2 as const, createdAt: "2026-10-01T10:00:00.000Z", estimateMin: 60 };

const tasks: Task[] = [
  { ...base, id: "a", title: "Relatório", repeat: "once", date: D, deadline: "2026-10-17", priority: 1 },
  { ...base, id: "b", title: "Estudar", repeat: "weekdays", weekdays: [1, 3, 5], estimateMin: 90 },
  { ...base, id: "c", title: "Inglês", repeat: "weeklyGoal", weeklyGoalMin: 300, estimateMin: 0 },
  { ...base, id: "d", title: "Outro dia", repeat: "once", date: "2026-10-20" },
];
const blocks: Block[] = [
  { id: "x", taskId: "c", date: D, start: `${D}T14:00:00`, end: `${D}T15:00:00` },
];
const sessions: Session[] = [
  { id: "s1", taskId: "b", date: D, minutes: 30, kind: "pomodoro", startedAt: "", endedAt: "" },
  { id: "s2", taskId: "c", date: "2026-10-13", minutes: 100, kind: "manual", startedAt: "", endedAt: "" },
];
const settings = { ...DEFAULT_SETTINGS, capacityByWeekday: [0, 0, 0, 0, 0, 300, 0], slack: 0.2 };

describe("dayMetrics", () => {
  const m = dayMetrics(D, settings, tasks, blocks, sessions);

  it("inclui avulsa do dia, recorrente do dia e meta com bloco", () => {
    expect(m.items.map((i) => i.task.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("calcula capacidade, planejado, feito, restante e livre", () => {
    expect(m.capacityMin).toBe(300);
    expect(m.usableMin).toBe(240);
    expect(m.plannedMin).toBe(60 + 90 + 60);
    expect(m.doneMin).toBe(30);
    expect(m.remainingMin).toBe(60 + 60 + 60);
    expect(m.freeMin).toBe(240 - 30 - 180);
  });

  it("tarefa concluída mais cedo libera tempo", () => {
    const done = tasks.map((t) => (t.id === "b" ? { ...t, completions: { [D]: true } } : t));
    expect(dayMetrics(D, settings, done, blocks, sessions).freeMin).toBe(240 - 30 - 120);
  });

  it("override de capacidade vale para o dia", () => {
    const s = { ...settings, capacityOverrides: { [D]: 100 } };
    expect(dayMetrics(D, s, tasks, blocks, sessions).usableMin).toBe(80);
  });
});

describe("fila flexível e sugestão", () => {
  const m = dayMetrics(D, settings, tasks, blocks, sessions);

  it("ordena por prazo antes de prioridade e ignora agendadas", () => {
    expect(flexibleQueue(m).map((i) => i.task.id)).toEqual(["a", "b"]);
  });

  it("dentro de um bloco, sugere o bloco", () => {
    expect(suggestNow(new Date(`${D}T14:30:00`), m, blocks).kind).toBe("block");
  });

  it("fora de bloco, sugere a primeira flexível e o tempo até o próximo bloco", () => {
    const s = suggestNow(new Date(`${D}T13:00:00`), m, blocks);
    expect(s.item?.task.id).toBe("a");
    expect(s.untilNextMin).toBe(60);
  });
});

it("meta semanal soma a semana inteira", () => {
  const [g] = weeklyGoals(D, tasks, sessions);
  expect(g.doneMin).toBe(100);
  expect(g.remainingMin).toBe(200);
});

it("entende durações", () => {
  expect(["45", "45m", "1h", "1h30", "1:30", "1,5h", "2h05min", "abc"].map(parseDuration)).toEqual([45, 45, 60, 90, 90, 90, 125, null]);
  expect(parseQuickAdd("Estudar React 1h30")).toEqual({ title: "Estudar React", minutes: 90 });
  expect(parseQuickAdd("Ligar pro banco")).toEqual({ title: "Ligar pro banco", minutes: null });
});
