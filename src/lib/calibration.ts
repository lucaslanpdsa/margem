// Estimado vs. realizado: quanto você costuma levar a mais (ou a menos) do que estima.
// Pura e testada. O app só mostra o fator; nunca muda as estimativas sozinho.

import { dayKey } from "./dates";
import { goalsKey } from "./goals";
import { isTimeTask } from "./metrics";
import type { Session, Task } from "./types";

/** Abaixo disso o fator não aparece: com poucas tarefas ele engana. */
export const MIN_SAMPLES = 10;

export interface Sample {
  taskId: string;
  /** Dia (tarefas que repetem) ou o dia em que foi concluída (de uma vez). */
  date: string;
  estMin: number;
  realMin: number;
}

/** Estimativa do dia, para gravar ao concluir pelo círculo. */
export const estimateOn = (task: Task, date: string) => task.estimateFor?.[date] ?? task.estimateMin;

/** Chave da estimativa gravada: o dia (que repete) ou "_" (de uma vez), como nos objetivos. */
export const estKey = goalsKey;

/**
 * Tarefas concluídas pelo círculo com estimativa gravada, desde `since` (inclusive).
 * - "Cumpro o tempo" fica de fora: termina na meta por definição.
 * - Sem nenhum registro fica de fora: provavelmente o cronômetro foi esquecido, e contaria como "levou 0".
 * - Realizado: de uma vez = todos os registros dela; que repete = os registros daquele dia.
 */
export function samples(tasks: Task[], sessions: Session[], since: string): Sample[] {
  const out: Sample[] = [];
  for (const task of tasks) {
    if (isTimeTask(task) || !task.estAtDone) continue;
    for (const [key, estMin] of Object.entries(task.estAtDone)) {
      if (!(estMin > 0)) continue;
      let date: string;
      let realMin: number;
      if (task.repeat === "once") {
        if (key !== estKey(task, "") || !task.completedAt) continue;
        date = dayKey(new Date(task.completedAt)); // chave local, não a data em UTC
        realMin = sessions.filter((s) => s.taskId === task.id).reduce((a, s) => a + s.minutes, 0);
      } else {
        if (!task.completions?.[key]) continue;
        date = key;
        realMin = sessions.filter((s) => s.taskId === task.id && s.date === key).reduce((a, s) => a + s.minutes, 0);
      }
      if (date < since || realMin < 1) continue;
      out.push({ taskId: task.id, date, estMin, realMin });
    }
  }
  return out;
}

export interface Calibration {
  n: number;
  /** Soma do realizado ÷ soma do estimado (não a média das razões, que exagera as tarefas curtas). */
  factor: number;
  /** Já dá para mostrar (n >= MIN_SAMPLES). */
  ready: boolean;
}

export function calibrate(list: Sample[]): Calibration {
  const est = list.reduce((a, s) => a + s.estMin, 0);
  const real = list.reduce((a, s) => a + s.realMin, 0);
  return { n: list.length, factor: est > 0 ? real / est : 1, ready: list.length >= MIN_SAMPLES && est > 0 };
}

/** Fator "certeiro": até 10% para mais ou para menos. */
export const isAccurate = (c: Calibration) => Math.abs(c.factor - 1) < 0.1;

/** "1,3×" */
export const fmtFactor = (f: number) => `${f.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}×`;

/** Quanto uma estimativa costuma virar, arredondado para 5 minutos. */
export const likelyMin = (estMin: number, c: Calibration) => Math.max(5, Math.round((estMin * c.factor) / 5) * 5);
