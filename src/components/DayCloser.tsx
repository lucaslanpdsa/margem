"use client";

import { useEffect, useRef } from "react";
import { todayKey } from "@/lib/dates";
import { closeDay } from "@/lib/db";
import { daySnapshot, daysToClose } from "@/lib/closing";
import { dayMetrics } from "@/lib/metrics";
import { useStore } from "./store";
import { useNow } from "./Timer";

/**
 * Fecha os dias que passaram: grava a fotografia das contas (planejado e feito) na primeira abertura depois deles.
 * Só com tudo carregado, para não gravar um dia pela metade. Não mostra nada.
 */
export function DayCloser() {
  const { uid, dataReady, days, settings, tasks, blocks, sessions } = useStore();
  const today = todayKey(new Date(useNow(60000)));
  // Uma vez por dia por aba: as contas mudam ao vivo (cronômetro) e não precisa regravar.
  const done = useRef("");
  useEffect(() => {
    if (!uid || !dataReady || done.current === today) return;
    done.current = today;
    const now = new Date();
    for (const d of daysToClose(today, days, settings)) closeDay(uid, d, daySnapshot(dayMetrics(d, settings, tasks, blocks, sessions, now, days[d])));
  }, [uid, dataReady, today, days, settings, tasks, blocks, sessions]);
  return null;
}
