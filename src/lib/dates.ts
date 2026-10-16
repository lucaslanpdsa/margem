import { addDays, format, parseISO, startOfWeek } from "date-fns";

/** Chave local "yyyy-MM-dd" (fuso do navegador). */
export const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

export const todayKey = () => dayKey(new Date());

/** Converte a chave em Date ao meio-dia local (evita problemas de fuso). */
export const fromKey = (key: string) => parseISO(`${key}T12:00:00`);

export const weekdayOf = (key: string) => fromKey(key).getDay();

/** Semana de segunda a domingo. */
export const weekDays = (key: string): string[] => {
  const start = startOfWeek(fromKey(key), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(start, i)));
};

export const shiftDay = (key: string, n: number) => dayKey(addDays(fromKey(key), n));

export const minutesBetween = (startIso: string, endIso: string) =>
  Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000));

/** 135 -> "2h15", 45 -> "45min", -30 -> "-30min" */
export const fmtMin = (min: number) => {
  const sign = min < 0 ? "-" : "";
  const m = Math.abs(Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${sign}${r}min`;
  return `${sign}${h}h${r ? String(r).padStart(2, "0") : ""}`;
};

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "45" | "45m" | "1h" | "1h30" | "1:30" | "1,5h" -> minutos (ou null). */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(",", ".");
  if (!s) return null;
  let m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return +m[1] * 60 + +m[2];
  m = s.match(/^(\d+(?:\.\d+)?)h(?:(\d{1,2})(?:m|min)?)?$/);
  if (m) return Math.round(parseFloat(m[1]) * 60) + (m[2] ? +m[2] : 0);
  m = s.match(/^(\d+)(?:m|min)?$/);
  if (m) return +m[1];
  return null;
}

/** Adição rápida: "Estudar React 1h30" -> { title: "Estudar React", minutes: 90 }. */
export function parseQuickAdd(input: string): { title: string; minutes: number | null } {
  const parts = input.trim().split(/\s+/);
  if (parts.length > 1) {
    const minutes = parseDuration(parts[parts.length - 1]);
    if (minutes !== null) return { title: parts.slice(0, -1).join(" "), minutes };
  }
  return { title: input.trim(), minutes: null };
}
