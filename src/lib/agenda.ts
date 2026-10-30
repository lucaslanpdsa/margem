import { addDays, startOfDay } from "date-fns";
import { fromKey } from "./dates";
import type { BreakTime } from "./types";

// Google Agenda (só leitura): compromissos saem do tempo do dia, como pausas. O app não cria nem muda eventos.
// Não conta: evento de dia inteiro (aniversário, feriado) e evento marcado como "Disponível" no Google
// (é assim que um bloco de foco, ex: "Estudar 19–21h", fica na agenda sem descontar o tempo das tarefas).

/** Evento como chega de /api/agenda (ver server/google.ts). */
export interface AgendaEvent {
  id: string;
  title: string;
  /** ISO com fuso (com horário) ou "yyyy-MM-dd" (dia inteiro). */
  start: string;
  end: string;
  allDay: boolean;
  /** "Disponível" no Google: aparece, mas não ocupa tempo. */
  free: boolean;
}

/** O evento neste dia, já no horário local e cortado na meia-noite. */
export interface DayEvent {
  event: AgendaEvent;
  /** "HH:mm"; fim pode ser "24:00". Vazio no dia inteiro. */
  start: string;
  end: string;
  /** Ocupa tempo (com horário e não "Disponível"). */
  busy: boolean;
}

const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Eventos de um dia, em ordem de início (dia inteiro primeiro). */
export function eventsOn(events: AgendaEvent[], date: string): DayEvent[] {
  // fromKey dá meio-dia (evita erro de fuso); aqui precisa da meia-noite local.
  const dayStart = startOfDay(fromKey(date)).getTime();
  const dayEnd = addDays(startOfDay(fromKey(date)), 1).getTime();
  const out: DayEvent[] = [];
  for (const e of events) {
    if (e.allDay) {
      // No Google o fim do dia inteiro é exclusivo (evento de 1 dia: start = dia, end = dia seguinte).
      if (e.start.slice(0, 10) <= date && date < e.end.slice(0, 10)) out.push({ event: e, start: "", end: "", busy: false });
      continue;
    }
    const s = Date.parse(e.start);
    const f = Date.parse(e.end);
    if (!(f > dayStart && s < dayEnd)) continue;
    const a = Math.round((Math.max(s, dayStart) - dayStart) / 60000);
    const b = Math.round((Math.min(f, dayEnd) - dayStart) / 60000);
    if (b <= a) continue;
    out.push({ event: e, start: hm(a), end: hm(b), busy: !e.free });
  }
  return out.sort((x, y) => (x.start || "").localeCompare(y.start || ""));
}

/** Compromissos do dia como pausas (para mergeBreaks em dayMetrics). */
export function agendaBreaks(events: AgendaEvent[] | undefined, date: string): BreakTime[] {
  if (!events?.length) return [];
  return eventsOn(events, date)
    .filter((d) => d.busy)
    .map((d) => ({ label: d.event.title, start: d.start, end: d.end }));
}

/** Agrupa os eventos pelos dias que eles tocam (chaves "yyyy-MM-dd" no fuso do aparelho). */
export function byDay(events: AgendaEvent[], dates: string[]): Record<string, AgendaEvent[]> {
  const out: Record<string, AgendaEvent[]> = {};
  for (const d of dates) {
    const list = eventsOn(events, d).map((x) => x.event);
    if (list.length) out[d] = list;
  }
  return out;
}

/** Intervalo pedido ao servidor: do início do primeiro dia ao fim do último, no fuso do aparelho. */
export function rangeFor(first: string, last: string) {
  return { from: startOfDay(fromKey(first)).toISOString(), to: addDays(startOfDay(fromKey(last)), 1).toISOString() };
}
