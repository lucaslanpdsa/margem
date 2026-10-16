"use client";

import { Draggable } from "@fullcalendar/interaction";
import { useEffect, useRef, useState } from "react";
import { WEEKDAY_SHORT, fmtMin, fromKey, parseDuration, todayKey, weekDays } from "@/lib/dates";
import { saveSettings, updateTask } from "@/lib/db";
import { dayMetrics, weeklyGoals } from "@/lib/metrics";
import type { RepeatKind, Task } from "@/lib/types";
import { Calendar } from "./Calendar";
import { CapacityPanel } from "./CapacityPanel";
import { DaySidebar } from "./DaySidebar";
import { useDialogs } from "./dialogs";
import { useStore } from "./store";
import { Button, Card, Field, PRIORITY_DOT, SectionTitle, cx, inputCls } from "./ui";

// ---------------- Dia ----------------

export function DayView() {
  const { date, settings, tasks, blocks, sessions } = useStore();
  const m = dayMetrics(date, settings, tasks, blocks, sessions);
  const listRef = useRef<HTMLDivElement>(null);

  // Itens com a classe .fc-drag podem ser arrastados para a agenda.
  useEffect(() => {
    if (!listRef.current) return;
    const d = new Draggable(listRef.current, {
      itemSelector: ".fc-drag",
      minDistance: 8,
      eventData: (el) => ({
        title: el.dataset.title,
        duration: { minutes: Number(el.dataset.duration) || 30 },
        extendedProps: { taskId: el.dataset.taskId },
        create: true,
      }),
    });
    return () => d.destroy();
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <CapacityPanel m={m} />
        <Calendar view="timeGridDay" />
      </div>
      <div ref={listRef}>
        <DaySidebar m={m} />
      </div>
    </div>
  );
}

// ---------------- Semana ----------------

export function WeekView({ onPickDay }: { onPickDay: (d: string) => void }) {
  const { date, settings, tasks, blocks, sessions } = useStore();
  const days = weekDays(date);
  const ms = days.map((d) => dayMetrics(d, settings, tasks, blocks, sessions));
  const sum = (k: "usableMin" | "doneMin" | "remainingMin" | "freeMin") => ms.reduce((a, m) => a + m[k], 0);
  const goals = weeklyGoals(date, tasks, sessions);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Tempo usável", sum("usableMin"), "text-ink"],
          ["Feito", sum("doneMin"), "text-done"],
          ["Falta", sum("remainingMin"), "text-todo"],
          ["Livre", sum("freeMin"), sum("freeMin") < 0 ? "text-warn" : "text-ink"],
        ].map(([label, v, tone]) => (
          <Card key={label as string} className="py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
            <p className={cx("tabular font-display text-2xl", tone as string)}>{fmtMin(v as number)}</p>
          </Card>
        ))}
      </div>

      {goals.length > 0 && (
        <Card>
          <SectionTitle>Metas da semana</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {goals.map((g) => (
              <li key={g.task.id}>
                <div className="flex justify-between text-sm">
                  <span>{g.task.title}</span>
                  <span className="tabular text-muted">
                    {fmtMin(g.doneMin)} / {fmtMin(g.goalMin)}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
                  <div className="h-full bg-done" style={{ width: `${Math.min(100, (g.doneMin / Math.max(1, g.goalMin)) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Calendar view="timeGridWeek" onPickDay={onPickDay} />
    </div>
  );
}

// ---------------- Tarefas ----------------

const GROUPS: { kind: RepeatKind; title: string }[] = [
  { kind: "weekdays", title: "Dias fixos" },
  { kind: "weeklyGoal", title: "Metas semanais" },
  { kind: "once", title: "Avulsas pendentes" },
];

function describe(t: Task) {
  if (t.repeat === "weekdays") return `${fmtMin(t.estimateMin)} · ${(t.weekdays ?? []).map((d) => WEEKDAY_SHORT[d]).join(", ")}`;
  if (t.repeat === "weeklyGoal") return `${fmtMin(t.weeklyGoalMin ?? 0)} por semana`;
  const day = t.date ? fromKey(t.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "sem dia";
  return `${fmtMin(t.estimateMin)} · ${day}${t.deadline ? ` · prazo ${fromKey(t.deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}`;
}

export function TasksView() {
  const { uid, tasks } = useStore();
  const { editTask } = useDialogs();
  const [showArchived, setShowArchived] = useState(false);

  const visible = tasks.filter((t) => (showArchived ? t.archived : !t.archived));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Mostrar arquivadas
        </label>
        <Button variant="primary" onClick={() => editTask({ repeat: "weekdays" })}>
          + Nova tarefa
        </Button>
      </div>

      {GROUPS.map((g) => {
        const list = visible
          .filter((t) => t.repeat === g.kind && (g.kind !== "once" || !t.completedAt))
          .sort((a, b) => a.title.localeCompare(b.title));
        return (
          <Card key={g.kind}>
            <SectionTitle>
              {g.title} ({list.length})
            </SectionTitle>
            {list.length === 0 && <p className="text-sm text-muted">Nada aqui.</p>}
            <ul className="divide-y divide-line">
              {list.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className={cx("h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[t.priority])} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => editTask(t)}>
                    <p className="truncate text-sm">{t.title}</p>
                    <p className="text-xs text-muted">
                      {describe(t)}
                      {t.category && ` · ${t.category}`}
                    </p>
                  </button>
                  <Button variant="ghost" onClick={() => updateTask(uid, t.id, { archived: !t.archived })}>
                    {t.archived ? "Reativar" : "Arquivar"}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------- Ajustes ----------------

export function SettingsView() {
  const { uid, settings, user, logout } = useStore();
  const [caps, setCaps] = useState(settings.capacityByWeekday.map(fmtMin));
  const [slack, setSlack] = useState(String(Math.round(settings.slack * 100)));
  const [focus, setFocus] = useState(String(settings.focusMin));
  const [brk, setBrk] = useState(String(settings.breakMin));
  const [saved, setSaved] = useState(false);
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  async function save() {
    await saveSettings(uid, {
      capacityByWeekday: caps.map((c) => parseDuration(c) ?? 0),
      slack: Math.min(50, Math.max(0, Number(slack) || 0)) / 100,
      focusMin: Math.max(5, Number(focus) || 25),
      breakMin: Math.max(1, Number(brk) || 5),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <SectionTitle>Tempo disponível para tarefas, por dia</SectionTitle>
        <p className="mb-3 text-sm text-muted">Quanto do seu dia sobra para as tarefas daqui (fora trabalho fixo, refeições etc.). Para mudar só um dia, use o ✎ na tela do dia.</p>
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Field key={d} label={WEEKDAY_SHORT[d]}>
              <input
                className={cx(inputCls, "px-2 text-center")}
                value={caps[d]}
                onChange={(e) => setCaps((c) => c.map((v, i) => (i === d ? e.target.value : v)))}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Margem de folga e pomodoro</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Folga (%)" hint="Tempo reservado para pausas e imprevistos">
            <input className={inputCls} value={slack} onChange={(e) => setSlack(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Foco (min)">
            <input className={inputCls} value={focus} onChange={(e) => setFocus(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Pausa (min)">
            <input className={inputCls} value={brk} onChange={(e) => setBrk(e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        {perm !== "granted" && perm !== "unsupported" && (
          <Button className="mt-3" onClick={() => Notification.requestPermission().then(setPerm)}>
            Ativar notificações do pomodoro
          </Button>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted">
          {user?.email} ·{" "}
          <button className="underline" onClick={logout}>
            sair
          </button>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-ok">Salvo</span>}
          <Button variant="primary" onClick={save}>
            Salvar ajustes
          </Button>
        </div>
      </div>
      <p className="text-center text-xs text-muted">Hoje: {fromKey(todayKey()).toLocaleDateString("pt-BR", { dateStyle: "full" })}</p>
    </div>
  );
}
