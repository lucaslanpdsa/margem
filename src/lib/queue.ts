// Fila do dia: a ordem em que você quer fazer as tarefas e a previsão de horário de cada uma.
// Pura e testada (queue.test.ts). A ordem é sempre da pessoa: o app nunca reordena sozinho.

import { dayKey } from "./dates";
import type { DayItem } from "./metrics";
import { slotsOf, toMin, windowFor } from "./schedule";
import type { Block, Settings } from "./types";

/** Ordem automática (sem fila salva): com horário pela hora, depois as outras pela criação. */
export function autoOrder(items: DayItem[], blocks: Block[], date: string): DayItem[] {
  const startOf = (i: DayItem) =>
    blocks
      .filter((b) => b.taskId === i.task.id && b.date === date)
      .map((b) => b.start)
      .sort()[0];
  return [...items].sort((a, b) => {
    const sa = startOf(a);
    const sb = startOf(b);
    if (sa && sb) return sa.localeCompare(sb);
    if (sa || sb) return sa ? -1 : 1;
    return a.task.createdAt.localeCompare(b.task.createdAt);
  });
}

/** Ordem da fila: primeiro as que estão na ordem salva (na ordem dela), depois as novas, na ordem automática. */
export function orderItems(items: DayItem[], order: string[] | undefined, blocks: Block[], date: string): DayItem[] {
  const auto = autoOrder(items, blocks, date);
  if (!order?.length) return auto;
  const pos = new Map(order.map((id, i) => [id, i]));
  const saved = auto.filter((i) => pos.has(i.task.id)).sort((a, b) => pos.get(a.task.id)! - pos.get(b.task.id)!);
  return [...saved, ...auto.filter((i) => !pos.has(i.task.id))];
}

export type Move = "top" | "up" | "down";

/**
 * Nova ordem depois de mover `id`. `movable` = as que podem mudar de lugar (as de horário fixo não entram:
 * o lugar delas é o horário). Subir/descer troca com a vizinha que também pode mudar.
 */
export function moveInQueue(ids: string[], id: string, to: Move | { before: string | null }, movable: Set<string> = new Set(ids)): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const rest = ids.filter((x) => x !== id);
  if (typeof to === "object") {
    const at = to.before === null ? rest.length : rest.indexOf(to.before);
    if (at < 0) return ids;
    return [...rest.slice(0, at), id, ...rest.slice(at)];
  }
  if (to === "top") return [id, ...rest];
  const step = to === "up" ? -1 : 1;
  let j = from + step;
  while (j >= 0 && j < ids.length && !movable.has(ids[j])) j += step;
  if (j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[j]] = [next[j], next[from]];
  return next;
}

export interface Projection {
  /** Minuto do dia do primeiro minuto previsto e do fim (exclusivo). Sem nada previsto: -1. */
  start: number;
  end: number;
  /** Cabe inteira até o fim do horário. */
  fits: boolean;
  /** Quanto dela passa do fim do horário. */
  excessMin: number;
  /** Tem horário marcado ainda por vir: fica no horário dela, não muda de lugar na fila. */
  fixed: boolean;
}

export interface DayProjection {
  /** Por tarefa (só as abertas e dentro do horário). */
  byTask: Map<string, Projection>;
  /** Minuto em que a previsão começa (agora, ou o início do horário). */
  cursor: number;
  /** Soma do que não cabe: bate com "Não cabe" do topo do dia. */
  excessMin: number;
}

/**
 * Previsão de horário de cada tarefa, seguindo a fila.
 *
 * - Começa agora (hoje) ou no início do horário (dia futuro). Dia passado ou sem horário: sem previsão.
 * - Usa o que FALTA de cada tarefa (pelos registros), nunca supõe que o horário foi cumprido.
 * - Tarefa com horário ainda por vir ocupa o horário dela primeiro; o que passar do horário vai para a fila.
 * - As outras ocupam o tempo livre em ordem, pulando pausas e horários das fixas.
 * - O total previsto não passa de `roomMin` (o mesmo "A fazer" do topo do dia), para os números baterem.
 * - `runningId` (cronômetro rodando) vem primeiro: é o que está acontecendo.
 */
export function projectDay(ordered: DayItem[], settings: Settings, date: string, now: Date, roomMin: number, runningId?: string | null): DayProjection {
  const byTask = new Map<string, Projection>();
  const window = windowFor(settings, date);
  const today = dayKey(now);
  if (!window || date < today) return { byTask, cursor: -1, excessMin: 0 };

  const winStart = toMin(window.start);
  const winEnd = toMin(window.end);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const cursor = date === today ? Math.max(winStart, nowMin) : winStart;

  // Minutos do dia: livre (0) ou ocupado (1). Fora do horário, antes do cursor e pausas ficam ocupados.
  const busy = new Uint8Array(24 * 60).fill(1);
  for (let m = cursor; m < winEnd; m++) busy[m] = 0;
  for (const b of settings.breaks) for (let m = toMin(b.start); m < toMin(b.end); m++) busy[m] = 1;

  const open = ordered.filter((i) => !i.completed && !i.skipped && !i.outside);
  let budget = Math.max(0, roomMin);
  const used = new Map<string, number[]>(); // minutos usados por tarefa
  const take = (id: string, m: number) => {
    busy[m] = 1;
    budget--;
    used.set(id, [...(used.get(id) ?? []), m]);
  };

  // 0) Blocos reservados (modo leve): o horário deles fica ocupado e eles não pedem tempo.
  const fixed = new Set<string>();
  const leftover = new Map<string, number>();
  const blockSpan = new Map<string, { start: number; end: number }>();
  for (const i of open.filter((x) => x.block)) {
    const slots = slotsOf(i.task).map((s) => ({ a: Math.max(toMin(s.start), winStart), b: Math.min(toMin(s.end), winEnd) })).filter((s) => s.b > s.a);
    for (const s of slots) for (let m = Math.max(s.a, cursor); m < s.b; m++) busy[m] = 1;
    fixed.add(i.task.id);
    leftover.set(i.task.id, 0);
    if (slots.length) blockSpan.set(i.task.id, { start: Math.min(...slots.map((s) => s.a)), end: Math.max(...slots.map((s) => s.b)) });
  }

  // 1) Fixas: o que falta delas, dentro dos próprios horários que ainda vão acontecer.
  for (const i of open.filter((x) => !x.block)) {
    const slots = slotsOf(i.task).map((s) => ({ a: Math.max(toMin(s.start), cursor), b: Math.min(toMin(s.end), winEnd) })).filter((s) => s.b > s.a);
    if (!slots.length) continue;
    fixed.add(i.task.id);
    let left = i.remainingMin;
    for (const s of slots.sort((x, y) => x.a - y.a))
      for (let m = s.a; m < s.b && left > 0 && budget > 0; m++)
        if (!busy[m]) {
          take(i.task.id, m);
          left--;
        }
    leftover.set(i.task.id, left);
  }

  // 2) O resto, na ordem da fila (o cronômetro rodando primeiro), no tempo livre mais cedo.
  const queue = [...open].sort((a, b) => Number(b.task.id === runningId) - Number(a.task.id === runningId));
  let m = cursor;
  for (const i of queue) {
    let left = leftover.get(i.task.id) ?? (fixed.has(i.task.id) ? 0 : i.remainingMin);
    while (left > 0 && budget > 0 && m < winEnd) {
      if (!busy[m]) {
        take(i.task.id, m);
        left--;
      }
      m++;
    }
    leftover.set(i.task.id, left);
    // As fixas tomaram minutos lá na frente: a próxima volta a procurar do começo do que ainda está livre.
    m = cursor;
    while (m < winEnd && busy[m]) m++;
  }

  let excessMin = 0;
  for (const i of open) {
    const mins = used.get(i.task.id) ?? [];
    const left = leftover.get(i.task.id) ?? 0;
    excessMin += left;
    const span = blockSpan.get(i.task.id);
    byTask.set(i.task.id, {
      // Bloco: o horário dele (mesmo o que já passou), para aparecer onde acontece.
      start: span ? span.start : mins.length ? Math.min(...mins) : i.remainingMin === 0 ? cursor : -1,
      end: span ? span.end : mins.length ? Math.max(...mins) + 1 : i.remainingMin === 0 ? cursor : -1,
      fits: left === 0,
      excessMin: left,
      fixed: fixed.has(i.task.id),
    });
  }
  return { byTask, cursor, excessMin };
}

/**
 * Ordem de exibição: pelo horário previsto (as fixas caem onde acontecem), depois as extra (fora do horário)
 * e por último as que não cabem nada, na ordem da fila.
 */
export function displayOrder(ordered: DayItem[], p: DayProjection): DayItem[] {
  if (p.cursor < 0) return ordered;
  const key = (i: DayItem) => {
    const x = p.byTask.get(i.task.id);
    if (!x) return 24 * 60; // extra: sem previsão, mas acontece (fora do horário)
    return x.start < 0 ? Infinity : x.start;
  };
  // sort é estável: empates mantêm a ordem da fila.
  return [...ordered].sort((a, b) => key(a) - key(b));
}

/** Índice da primeira que não cabe nada (onde entra a linha "Não cabe hoje"); -1 se todas cabem pelo menos em parte. */
export function firstNotFitting(shown: DayItem[], p: DayProjection) {
  return shown.findIndex((i) => (p.byTask.get(i.task.id)?.start ?? 0) < 0);
}

/** 845 -> "14:05", arredondado para 5 minutos (a previsão muda a cada minuto e cansa a vista). */
export function fmtClock(min: number) {
  const r = Math.round(min / 5) * 5;
  return `${String(Math.floor(r / 60) % 24).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
}
