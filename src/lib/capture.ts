// Captura em uma linha: "Pagar luz dia 10", "Estudar Docker 1h", "Ligar pro mecânico amanhã".
// Pura e testada. Entende o dia e o tempo no FIM do texto; o resto é o título.

import { addMonths, format, getDaysInMonth } from "date-fns";
import { fromKey, parseDuration, shiftDay, weekdayOf } from "./dates";

const WEEKDAYS: Record<string, number> = {
  dom: 0, domingo: 0,
  seg: 1, segunda: 1,
  ter: 2, terça: 2, terca: 2,
  qua: 3, quarta: 3,
  qui: 4, quinta: 4,
  sex: 5, sexta: 5,
  sab: 6, sáb: 6, sábado: 6, sabado: 6,
};
// Palavras que podem vir antes do dia: "na sexta", "no sábado", "até amanhã", "dia 10".
const FILLER = new Set(["na", "no", "nesta", "neste", "nessa", "nesse", "até", "ate", "pra", "para", "em"]);

const norm = (w: string) => w.toLowerCase().replace(/[.,;]$/, "").replace(/-feira$/, "");

/** Próxima data com aquele dia do mês (este mês, se ainda não passou). */
function dayOfMonth(n: number, today: string): string | null {
  if (n < 1 || n > 31) return null;
  for (let i = 0; i < 3; i++) {
    const month = addMonths(fromKey(today), i);
    if (n > getDaysInMonth(month)) continue;
    const key = format(new Date(month.getFullYear(), month.getMonth(), n, 12), "yyyy-MM-dd");
    if (key >= today) return key;
  }
  return null;
}

/** Dia que as últimas palavras descrevem, e quantas palavras usou. */
function trailingDate(words: string[], today: string): { date: string; used: number } | null {
  const w = words.map(norm);
  const n = w.length;
  const last = w[n - 1];
  if (!last) return null;
  if (n >= 3 && w[n - 3] === "depois" && w[n - 2] === "de" && (last === "amanhã" || last === "amanha")) return { date: shiftDay(today, 2), used: 3 };
  if (last === "hoje") return { date: today, used: 1 };
  if (last === "amanhã" || last === "amanha") return { date: shiftDay(today, 1), used: 1 };
  if (last in WEEKDAYS) {
    // O próximo, nunca hoje: "sexta" numa sexta é a da semana que vem.
    const target = WEEKDAYS[last];
    const ahead = ((target - weekdayOf(today) + 7) % 7) || 7;
    return { date: shiftDay(today, ahead), used: 1 };
  }
  if (n >= 2 && w[n - 2] === "dia" && /^\d{1,2}$/.test(last)) {
    const d = dayOfMonth(Number(last), today);
    return d ? { date: d, used: 2 } : null;
  }
  const m = last.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const [day, month] = [Number(m[1]), Number(m[2])];
    let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(today.slice(0, 4));
    const make = (y: number) => {
      const dt = new Date(y, month - 1, day, 12);
      return dt.getMonth() === month - 1 ? format(dt, "yyyy-MM-dd") : null;
    };
    let key = make(year);
    // Sem ano e já passou: é o do ano que vem.
    if (key && !m[3] && key < today) key = make(++year);
    return key ? { date: key, used: 1 } : null;
  }
  return null;
}

export interface Capture {
  title: string;
  /** Tempo dito no texto ("1h", "45m"), ou null. */
  minutes: number | null;
  /** Dia dito no texto, ou null. */
  date: string | null;
}

/** Separa título, dia e tempo. O dia e o tempo valem só no fim, em qualquer ordem ("1h amanhã" ou "amanhã 1h"). */
export function parseCapture(input: string, today: string): Capture {
  let words = input.trim().split(/\s+/).filter(Boolean);
  let minutes: number | null = null;
  let date: string | null = null;
  for (let pass = 0; pass < 2; pass++) {
    // O dia antes do tempo: "dia 10" não pode virar "10 minutos". Sempre sobra pelo menos uma palavra de título.
    if (date === null && words.length > 1) {
      const d = trailingDate(words, today);
      if (d && words.length - d.used >= 1) {
        date = d.date;
        words = words.slice(0, -d.used);
        // "na sexta", "até amanhã": a palavra de ligação sai junto.
        if (words.length > 1 && FILLER.has(norm(words[words.length - 1]))) words = words.slice(0, -1);
      }
    }
    // Sempre sobra pelo menos uma palavra de título.
    if (minutes === null && words.length > 1) {
      const m = parseDuration(words[words.length - 1]);
      if (m) {
        minutes = m;
        words = words.slice(0, -1);
      }
    }
  }
  return { title: words.join(" "), minutes, date };
}

export type CaptureKind = "task" | "reminder" | "later";

/** O que a captura vira: tarefa no dia (dia + tempo), lembrete (só dia) ou "Depois" (sem dia). */
export const captureKind = (c: Pick<Capture, "date" | "minutes">): CaptureKind => (c.date ? (c.minutes ? "task" : "reminder") : "later");
