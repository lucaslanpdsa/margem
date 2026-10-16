"use client";

import { CalendarPlus, Check, ChevronDown, Pencil, Plus, Repeat, Target } from "lucide-react";
import { useState } from "react";
import { WEEKDAY_SHORT, fmtMin, fromKey, shiftDay, todayKey, weekDays } from "@/lib/dates";
import { saveSettings } from "@/lib/db";
import { dayMetrics, type DayMetrics } from "@/lib/metrics";
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
  const [open, setOpen] = useState<Set<string>>(() => new Set([today]));
  const allOpen = ms.every((m) => open.has(m.date));
  const toggle = (d: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel className="p-5">
        <p className={cx("text-sm font-semibold", lateDays ? "text-over" : "text-done")}>{lateDays ? "Atrasado" : "Em dia"}</p>
        <p className={cx("tabular mt-1 text-[28px] leading-none font-semibold tracking-tight", lateDays > 0 && "text-over")}>
          {lateDays ? `${lateDays === 1 ? "1 dia" : `${lateDays} dias`} com mais do que cabe` : `Sobram ${fmtMin(Math.max(0, free))} na semana`}
        </p>
        <p className="mt-2 text-sm text-muted">Contando de hoje até domingo. Toque num dia para ver as tarefas.</p>
      </Panel>

      <Panel className="divide-y divide-line">
        <div className="flex justify-end px-3 py-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(allOpen ? new Set() : new Set(ms.map((m) => m.date)))}>
            {allOpen ? "Recolher tudo" : "Mostrar tudo"}
          </Button>
        </div>
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
          const expanded = open.has(m.date);
          return (
            <div key={m.date}>
            <button
              onClick={() => toggle(m.date)}
              aria-expanded={expanded}
              className={cx("flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-sunken/60", past && !expanded && "opacity-60")}
            >
              <ChevronDown size={16} className={cx("-mr-2 shrink-0 text-muted transition-transform", !expanded && "-rotate-90")} />
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
              <span className={cx("tabular w-28 shrink-0 text-right text-[13px] font-medium sm:w-44", late ? "text-over" : "text-muted")}>{label}</span>
            </button>
            {expanded && <WeekDayTasks m={m} onOpenDay={() => onPickDay(m.date)} />}
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

/** Tarefas de um dia na semana: só leitura (nome, horário, tempo, feito). */
function WeekDayTasks({ m, onOpenDay }: { m: DayMetrics; onOpenDay: () => void }) {
  const items = [...m.items].sort((a, b) => (slotsOf(a.task)[0]?.start ?? "99").localeCompare(slotsOf(b.task)[0]?.start ?? "99"));
  return (
    <div className="bg-sunken/40 px-5 pt-1 pb-3">
      {items.length === 0 ? (
        <p className="py-2 text-sm text-muted">Nenhuma tarefa neste dia.</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {items.map((i) => {
            const slots = slotsOf(i.task);
            return (
              <li key={i.task.id} className="flex items-center gap-3 py-2 text-sm">
                <span className={cx("grid h-4 w-4 shrink-0 place-items-center rounded-full border", i.completed ? "border-done bg-done text-white" : "border-line")}>
                  {i.completed && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className={cx("min-w-0 flex-1 truncate", i.completed && "text-muted line-through")}>{i.task.title}</span>
                {slots.length > 0 && <span className="tabular hidden text-xs text-muted sm:inline">{slots.map((s) => `${s.start}–${s.end}`).join(", ")}</span>}
                {i.outside && <span className="rounded bg-break/15 px-1.5 text-xs font-medium text-break">extra</span>}
                <span className="tabular w-20 shrink-0 text-right text-xs text-muted">
                  {i.doneMin > 0 ? `${fmtMin(i.doneMin)} de ${fmtMin(i.estimateMin)}` : fmtMin(i.estimateMin)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <button onClick={onOpenDay} className="mt-1 text-[13px] font-medium text-brand hover:underline">
        Abrir o dia
      </button>
    </div>
  );
}

// ---------------- Tarefas ----------------

const GROUPS: { kind: RepeatKind; title: string; description: string; icon: typeof Repeat }[] = [
  { kind: "weekdays", title: "Repetem", description: "Aparecem sozinhas nos dias marcados.", icon: Repeat },
  { kind: "once", title: "Não repetem", description: "As que ainda não foram feitas, por data.", icon: CalendarPlus },
  { kind: "weeklyGoal", title: "Metas semanais (antigas)", description: "Tipo que saiu do app. Edite para virar uma tarefa que repete.", icon: Target },
];

/** "hoje", "amanhã", "sex, 23 out" ou "atrasada · 14 out". */
function dayLabel(key: string | undefined) {
  const today = todayKey();
  const k = key ?? today;
  const d = fromKey(k);
  const short = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
  if (k === today) return { text: "hoje", late: false };
  if (k === shiftDay(today, 1)) return { text: "amanhã", late: false };
  if (k < today) return { text: `atrasada · ${short}`, late: true };
  return { text: `${WEEKDAY_SHORT[d.getDay()].toLowerCase()}, ${short}`, late: false };
}

function describe(t: Task) {
  if (t.repeat === "weekdays")
    return `${fmtMin(t.estimateMin)} por dia, ${(t.weekdays ?? []).map((d) => WEEKDAY_SHORT[d].toLowerCase()).join(", ")}${slotsOf(t).length ? `, ${slotsOf(t).map((sl) => `${sl.start}–${sl.end}`).join(", ")}` : ""}`;
  if (t.repeat === "weeklyGoal") return `${fmtMin(t.weeklyGoalMin ?? 0)} por semana`;
  return `${fmtMin(t.estimateMin)}${slotsOf(t).length ? `, ${slotsOf(t).map((sl) => `${sl.start}–${sl.end}`).join(", ")}` : ""}`;
}

export function TasksView() {
  const { tasks } = useStore();
  const { editTask } = useDialogs();
  const hasPaused = tasks.some((t) => t.archived);
  const [show, setShow] = useState<"active" | "archived">("active");
  const showing = hasPaused ? show : "active";
  const visible = tasks.filter((t) => (showing === "archived" ? t.archived : !t.archived));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Todas as suas tarefas, por tipo.</p>
        {hasPaused && (
          <Segmented
            value={showing}
            onChange={setShow}
            options={[
              { value: "active", label: "Ativas" },
              { value: "archived", label: "Pausadas" },
            ]}
          />
        )}
      </div>

      {GROUPS.map((g) => {
        const list = visible
          .filter((t) => t.repeat === g.kind && (g.kind !== "once" || !t.completedAt))
          .sort((a, b) =>
            g.kind === "once"
              ? (a.date ?? todayKey()).localeCompare(b.date ?? todayKey()) || a.title.localeCompare(b.title)
              : a.title.localeCompare(b.title),
          );
        if (g.kind === "weeklyGoal" && list.length === 0) return null;
        return (
          <Panel key={g.kind}>
            <PanelHeader
              title={`${g.title} (${list.length})`}
              description={g.description}
              right={
                showing === "active" && g.kind !== "weeklyGoal" && (
                  <Button size="sm" variant="secondary" onClick={() => editTask({ repeat: g.kind })}>
                    <Plus size={14} /> Nova
                  </Button>
                )
              }
            />
            {list.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Nenhuma ainda.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {list.map((t) => {
                  const day = g.kind === "once" ? dayLabel(t.date) : null;
                  return (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-sunken/50">
                    <g.icon size={16} className="shrink-0 text-muted" />
                    <button className="min-w-0 flex-1 text-left" onClick={() => editTask(t)}>
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted">
                        {day && <span className={cx("font-semibold", day.late ? "text-over" : "text-ink")}>{day.text} · </span>}
                        {describe(t)}
                      </p>
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => editTask(t)}>
                      <Pencil size={14} /> Editar
                    </Button>
                  </li>
                  );
                })}
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
