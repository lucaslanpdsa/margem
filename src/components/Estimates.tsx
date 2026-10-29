"use client";

import { Gauge } from "lucide-react";
import { fmtMin, shiftDay, todayKey } from "@/lib/dates";
import { calibrate, estKey, fmtFactor, isAccurate, samples, type Calibration } from "@/lib/calibration";
import { isTimeTask, tracksTime } from "@/lib/metrics";
import type { Task } from "@/lib/types";
import { usePlan } from "./Pro";
import { useStore } from "./store";
import { Panel } from "./ui";

/** Últimos 28 dias: o que o app carrega de registros, e o seu jeito de estimar mais recente. */
const DAYS = 28;

/** Fator de estimado vs. realizado (Pro). null enquanto não há tarefas suficientes ou no grátis. */
export function useCalibration(): Calibration | null {
  const { tasks, sessions, settings } = useStore();
  const plan = usePlan();
  if (!plan.pro || !tracksTime(settings)) return null;
  const c = calibrate(samples(tasks, sessions, shiftDay(todayKey(), -DAYS)));
  return c.ready ? c : null;
}

/** "Suas estimativas" no Dia: só aparece com tarefas suficientes, e só mostra (não muda nada sozinho). */
export function EstimateCard() {
  const c = useCalibration();
  if (!c) return null;
  const accurate = isAccurate(c);
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-2">
        <Gauge size={16} className="text-muted" />
        <h2 className="text-[15px] font-semibold">Suas estimativas</h2>
      </div>
      <p className="mt-1.5 text-sm">
        {accurate ? (
          <>Você acerta o tempo: as tarefas levam o que você estima.</>
        ) : c.factor > 1 ? (
          <>
            Você costuma levar <b className="tabular font-semibold">{fmtFactor(c.factor)}</b> o que estima. Uma tarefa de 1h vira {fmtMin(60 * c.factor)}.
          </>
        ) : (
          <>
            Você costuma levar <b className="tabular font-semibold">{fmtFactor(c.factor)}</b> o que estima: suas tarefas acabam antes.
          </>
        )}
      </p>
      <p className="mt-1 text-xs text-muted">
        Baseado em {c.n} tarefas concluídas com tempo registrado nos últimos {DAYS} dias. As que terminam cumprindo o tempo ficam de fora.
      </p>
    </Panel>
  );
}

/** "Estimado 45min · levou 1h05" na tarefa concluída pelo círculo. */
export function EstimateVsReal({ task, date }: { task: Task; date: string }) {
  const { sessions } = useStore();
  const est = task.estAtDone?.[estKey(task, date)];
  if (isTimeTask(task) || !est) return null;
  const real = sessions.filter((s) => s.taskId === task.id && (task.repeat === "once" || s.date === date)).reduce((a, s) => a + s.minutes, 0);
  if (real < 1) return null;
  return (
    <p className="mt-2 text-xs text-muted">
      Estimado {fmtMin(est)} · levou <b className="tabular font-semibold text-ink">{fmtMin(real)}</b>
    </p>
  );
}
