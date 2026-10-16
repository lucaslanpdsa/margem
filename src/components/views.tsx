"use client";

import { useState } from "react";
import { saveSettings } from "@/lib/db";
import { dayMetrics } from "@/lib/metrics";
import { DayBudget } from "./CapacityPanel";
import { DayLists } from "./DaySidebar";
import { ScheduleEditor, type Schedule } from "./ScheduleEditor";
import { useNow } from "./Timer";
import { useStore } from "./store";
import { Button, Panel, PanelHeader } from "./ui";

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

// ---------------- Ajustes ----------------

export function SettingsView() {
  const { uid, settings, user, logout } = useStore();
  const [schedule, setSchedule] = useState<Schedule>({ windows: settings.windows, breaks: settings.breaks });
  const [saved, setSaved] = useState(false);

  async function save() {
    await saveSettings(uid, { windows: schedule.windows, breaks: schedule.breaks, scheduleSet: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }


  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel>
        <PanelHeader
          title="Seu horário"
          description="De que horas a que horas você tem para tarefas. Para mudar só um dia, use “Mudar hoje” na tela do dia. Tarefas com horário fora dele contam como extra."
        />
        <div className="px-5 pb-5">
          <ScheduleEditor value={schedule} onChange={setSchedule} />
        </div>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Conectado como {user?.email}.{" "}
          <button className="font-medium text-brand hover:underline" onClick={logout}>
            Sair
          </button>
        </p>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-done">Ajustes salvos</span>}
          <Button variant="primary" onClick={save}>
            Salvar ajustes
          </Button>
        </div>
      </div>
    </div>
  );
}
