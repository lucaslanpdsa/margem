"use client";

import { dayMetrics } from "@/lib/metrics";
import { DayBudget } from "./CapacityPanel";
import { DayLists } from "./DaySidebar";
import { useNow } from "./Timer";
import { useStore } from "./store";

// ---------------- Dia ----------------

export function DayView() {
  const { date, settings, tasks, blocks, sessions } = useStore();
  const now = new Date(useNow(60000));
  const m = dayMetrics(date, settings, tasks, blocks, sessions, now);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <DayBudget m={m} />
      <DayLists m={m} />
    </div>
  );
}
