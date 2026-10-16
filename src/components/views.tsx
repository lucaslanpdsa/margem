"use client";

import { Archive, ArchiveRestore, CalendarPlus, Plus, Repeat, Target } from "lucide-react";
import { useState } from "react";
import { WEEKDAY_SHORT, fmtMin, fromKey, todayKey, weekDays } from "@/lib/dates";
import { saveSettings, updateTask } from "@/lib/db";
import { dayMetrics } from "@/lib/metrics";
import { slotsOf } from "@/lib/schedule";
import type { RepeatKind, Task } from "@/lib/types";
import { CapacityBar, DayBudget } from "./CapacityPanel";
import { DayLists } from "./DaySidebar";
import { useDialogs } from "./dialogs";
import { ScheduleEditor, type Schedule } from "./ScheduleEditor";
import { useNow } from "./Timer";
import { useStore } from "./store";
import { Button, Panel, PanelHeader, Segmented, cx } from "./ui";

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

// ---------------- Semana ----------------

export function WeekView({ onPickDay }: { onPickDay: (d: string) => void }) {
  const { date, settings, tasks, blocks, sessions } = useStore();
  const now = new Date(useNow(60000));
  const today = todayKey();
  const ms = weekDays(date).map((d) => dayMetrics(d, settings, tasks, blocks, sessions, now));
  // Dias que já passaram não entram na conta do que falta.
  const ahead = ms.filter((m) => m.date >= today && m.window);
  const free = ahead.reduce((a, m) => a + m.freeMin, 0);
  const lateDays = ahead.filter((m) => m.freeMin < 0).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel className="p-5">
        <p className={cx("text-sm font-semibold", lateDays ? "text-over" : "text-done")}>{lateDays ? "Atrasado" : "Em dia"}</p>
        <p className={cx("tabular mt-1 text-[28px] leading-none font-semibold tracking-tight", lateDays > 0 && "text-over")}>
          {lateDays ? `${lateDays === 1 ? "1 dia" : `${lateDays} dias`} com mais do que cabe` : `Sobram ${fmtMin(Math.max(0, free))} na semana`}
        </p>
        <p className="mt-2 text-sm text-muted">Contando de hoje até domingo. Toque num dia para abrir.</p>
      </Panel>

      <Panel className="divide-y divide-line">
        {ms.map((m) => {
          const past = m.date < today;
          const late = !past && m.freeMin < 0;
          const label = !m.window
            ? "Sem horário"
            : past || m.leftMin === 0
              ? `${fmtMin(m.doneMin)} feitos`
              : late
                ? `${fmtMin(-m.freeMin)} a mais`
                : `Sobram ${fmtMin(m.freeMin)}`;
          return (
            <button key={m.date} onClick={() => onPickDay(m.date)} className={cx("flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-sunken/60", past && "opacity-60")}>
              <span className="w-16 shrink-0">
                <span className={cx("block text-sm font-semibold", m.date === today && "text-todo")}>{m.date === today ? "Hoje" : WEEKDAY_SHORT[fromKey(m.date).getDay()]}</span>
                <span className="block text-xs text-muted">{fromKey(m.date).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</span>
              </span>
              <span className="min-w-0 flex-1">
                {m.window && !past ? (
                  <CapacityBar m={m} thin />
                ) : (
                  // Dia que passou: só o quanto foi feito do horário.
                  <span className="block h-1.5 overflow-hidden rounded-full bg-sunken">
                    <span className="block h-full bg-done" style={{ width: `${m.capacityMin ? Math.min(100, (m.doneMin / m.capacityMin) * 100) : 0}%` }} />
                  </span>
                )}
              </span>
              <span className={cx("tabular w-32 shrink-0 text-right text-[13px] font-medium sm:w-44", late ? "text-over" : "text-muted")}>{label}</span>
            </button>
          );
        })}
      </Panel>
    </div>
  );
}

// ---------------- Tarefas ----------------

const GROUPS: { kind: RepeatKind; title: string; description: string; icon: typeof Repeat }[] = [
  { kind: "weekdays", title: "Repetem", description: "Aparecem sozinhas nos dias marcados.", icon: Repeat },
  { kind: "once", title: "Uma vez, pendentes", description: "Ainda não concluídas.", icon: CalendarPlus },
  { kind: "weeklyGoal", title: "Metas semanais (antigas)", description: "Tipo que saiu do app. Edite para virar uma tarefa que repete.", icon: Target },
];

function describe(t: Task) {
  if (t.repeat === "weekdays")
    return `${fmtMin(t.estimateMin)} por dia, ${(t.weekdays ?? []).map((d) => WEEKDAY_SHORT[d].toLowerCase()).join(", ")}${slotsOf(t).length ? `, ${slotsOf(t).map((sl) => `${sl.start}–${sl.end}`).join(", ")}` : ""}`;
  if (t.repeat === "weeklyGoal") return `${fmtMin(t.weeklyGoalMin ?? 0)} por semana`;
  const short = (k: string) => fromKey(k).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  return `${fmtMin(t.estimateMin)}, ${t.date ? short(t.date) : "hoje"}${slotsOf(t).length ? `, ${slotsOf(t).map((sl) => `${sl.start}–${sl.end}`).join(", ")}` : ""}`;
}

export function TasksView() {
  const { uid, tasks } = useStore();
  const { editTask } = useDialogs();
  const [show, setShow] = useState<"active" | "archived">("active");
  const visible = tasks.filter((t) => (show === "archived" ? t.archived : !t.archived));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Todas as suas tarefas, por tipo. Clique numa para editar.</p>
        <Segmented
          value={show}
          onChange={setShow}
          options={[
            { value: "active", label: "Ativas" },
            { value: "archived", label: "Arquivadas" },
          ]}
        />
      </div>

      {GROUPS.map((g) => {
        const list = visible
          .filter((t) => t.repeat === g.kind && (g.kind !== "once" || !t.completedAt))
          .sort((a, b) => a.title.localeCompare(b.title));
        if (g.kind === "weeklyGoal" && list.length === 0) return null;
        return (
          <Panel key={g.kind}>
            <PanelHeader
              title={`${g.title} (${list.length})`}
              description={g.description}
              right={
                show === "active" && g.kind !== "weeklyGoal" && (
                  <Button size="sm" variant="ghost" onClick={() => editTask({ repeat: g.kind })}>
                    <Plus size={14} /> Adicionar
                  </Button>
                )
              }
            />
            {list.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Nenhuma ainda.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {list.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-sunken/50">
                    <g.icon size={16} className="shrink-0 text-muted" />
                    <button className="min-w-0 flex-1 text-left" onClick={() => editTask(t)}>
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted">
                        {describe(t)}
                        {t.category && ` · ${t.category}`}
                      </p>
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => updateTask(uid, t.id, { archived: !t.archived })}>
                      {t.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                      {t.archived ? "Reativar" : "Arquivar"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );
      })}
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
