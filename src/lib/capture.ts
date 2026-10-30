// Captura em uma linha: "Pagar luz dia 10", "Estudar Docker 1h", "Ligar pro mecânico amanhã", "Inglês ter e qui 45m".
// Pura e testada. Entende o dia (ou os dias em que repete) e o tempo no FIM do texto; o resto é o título.

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

const isDay = (w: string) => w in WEEKDAYS;
/** Plural ("sextas", "sábados") e "-feiras" viram o nome do dia. */
const singular = (w: string) => {
  const x = norm(w).replace(/-feiras$/, "");
  return isDay(x) ? x : x.endsWith("s") && isDay(x.slice(0, -1)) ? x.slice(0, -1) : x;
};
const range = (a: number, b: number) => {
  const out: number[] = [];
  for (let d = a; ; d = (d + 1) % 7) {
    out.push(d);
    if (d === b || out.length > 7) break;
  }
  return out;
};

/**
 * Dias em que repete, ditos no fim: "todo dia", "dias úteis", "seg a sex", "fim de semana", "toda sexta", "às terças",
 * "ter e qui", "seg, qua e sex". Um dia sozinho ("sexta") é data, não repetição.
 */
function trailingRepeat(words: string[]): { weekdays: number[]; used: number } | null {
  const w = words.map((x) => singular(x).replace(/,$/, ""));
  const n = w.length;
  const tail = (k: number) => w.slice(n - k).join(" ");
  const fixed: [string, number[]][] = [
    ["todos os dias", [0, 1, 2, 3, 4, 5, 6]],
    ["todo dia", [0, 1, 2, 3, 4, 5, 6]],
    ["fins de semana", [0, 6]],
    ["fim de semana", [0, 6]],
    ["dias úteis", [1, 2, 3, 4, 5]],
    ["dias uteis", [1, 2, 3, 4, 5]],
    ["diariamente", [0, 1, 2, 3, 4, 5, 6]],
    ["diário", [0, 1, 2, 3, 4, 5, 6]],
    ["diario", [0, 1, 2, 3, 4, 5, 6]],
  ];
  for (const [text, days] of fixed) {
    const k = text.split(" ").length;
    if (n >= k && tail(k) === text) return { weekdays: days, used: k };
  }
  // "seg a sex", "segunda à sexta"
  if (n >= 3 && isDay(w[n - 3]) && ["a", "à", "até", "ate"].includes(w[n - 2]) && isDay(w[n - 1]))
    return { weekdays: range(WEEKDAYS[w[n - 3]], WEEKDAYS[w[n - 1]]).sort(), used: 3 };
  // "toda sexta", "todas as terças", "às quartas", "aos sábados"
  if (isDay(w[n - 1])) {
    if (n >= 3 && (w[n - 3] === "todas" || w[n - 3] === "todos") && (w[n - 2] === "as" || w[n - 2] === "os")) return { weekdays: [WEEKDAYS[w[n - 1]]], used: 3 };
    if (n >= 2 && (w[n - 2] === "toda" || w[n - 2] === "todo")) return { weekdays: [WEEKDAYS[w[n - 1]]], used: 2 };
    // "às" só com o plural ("às terças"); "às terça" não é jeito de falar.
    const plural = norm(words[n - 1]).replace(/,$/, "") !== w[n - 1];
    if (n >= 2 && plural && ["às", "as", "aos"].includes(w[n - 2])) return { weekdays: [WEEKDAYS[w[n - 1]]], used: 2 };
  }
  // Lista: "ter e qui", "seg, qua e sex", "seg qua sex" (dois dias ou mais)
  let i = n - 1;
  const days: number[] = [];
  while (i >= 0) {
    if (isDay(w[i])) {
      days.unshift(WEEKDAYS[w[i]]);
      i--;
    } else if (w[i] === "e" && days.length && i > 0 && isDay(w[i - 1])) i--;
    else break;
  }
  if (days.length >= 2) return { weekdays: [...new Set(days)].sort(), used: n - 1 - i };
  return null;
}

export interface Capture {
  title: string;
  /** Tempo dito no texto ("1h", "45m"), ou null. */
  minutes: number | null;
  /** Dia dito no texto, ou null. */
  date: string | null;
  /** Dias em que repete (0 = domingo), ou null. */
  weekdays: number[] | null;
}

/** Separa título, dia e tempo. O dia e o tempo valem só no fim, em qualquer ordem ("1h amanhã" ou "amanhã 1h"). */
export function parseCapture(input: string, today: string): Capture {
  let words = input.trim().split(/\s+/).filter(Boolean);
  let minutes: number | null = null;
  let date: string | null = null;
  let weekdays: number[] | null = null;
  for (let pass = 0; pass < 2; pass++) {
    // Repetição antes do dia: "ter e qui" não pode virar "quinta que vem".
    if (weekdays === null && date === null && words.length > 1) {
      const r = trailingRepeat(words);
      if (r && words.length - r.used >= 1) {
        weekdays = r.weekdays;
        words = words.slice(0, -r.used);
      }
    }
    // O dia antes do tempo: "dia 10" não pode virar "10 minutos". Sempre sobra pelo menos uma palavra de título.
    if (date === null && weekdays === null && words.length > 1) {
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
  return { title: words.join(" "), minutes, date, weekdays };
}

export type CaptureKind = "routine" | "task" | "reminder" | "later";

/** O que a captura vira: tarefa que repete (dias), tarefa no dia (dia + tempo), lembrete (só dia) ou "Depois" (sem dia). */
export const captureKind = (c: Pick<Capture, "date" | "minutes"> & { weekdays?: number[] | null }): CaptureKind =>
  c.weekdays?.length ? "routine" : c.date ? (c.minutes ? "task" : "reminder") : "later";

/** Tempo de uma tarefa que repete criada sem tempo (o hint avisa; muda na janela da tarefa). */
export const ROUTINE_DEFAULT_MIN = 30;
