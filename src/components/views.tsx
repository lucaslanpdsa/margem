"use client";

import { Draggable } from "@fullcalendar/interaction";
import { Archive, ArchiveRestore, Bell, CalendarPlus, Plus, Repeat, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WEEKDAY_SHORT, fmtMin, fromKey, todayKey, weekDays } from "@/lib/dates";
import { saveSettings, updateTask } from "@/lib/db";
import { dayMetrics, weeklyGoals } from "@/lib/metrics";
import type { RepeatKind, Task } from "@/lib/types";
import { Calendar } from "./Calendar";
import { CapacityBar, DayBudget } from "./CapacityPanel";
import { DayLists } from "./DaySidebar";
import { useDialogs } from "./dialogs";
import { CapacityEditor } from "./Onboarding";
import { PomodoroPicker } from "./pickers";
import { useStore } from "./store";
import { Button, Panel, PanelHeader, Segmented, cx } from "./ui";

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
    <div className="space-y-4">
      <DayBudget m={m} />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div ref={listRef} className="min-w-0">
          <DayLists m={m} />
        </div>
        <div className="min-w-0 xl:sticky xl:top-4">
          <Calendar view="timeGridDay" />
        </div>
      </div>
    </div>
  );
}

// ---------------- Semana ----------------

export function WeekView({ onPickDay }: { onPickDay: (d: string) => void }) {
  const { date, settings, tasks, blocks, sessions } = useStore();
  const days = weekDays(date);
  const ms = days.map((d) => dayMetrics(d, settings, tasks, blocks, sessions));
  const usable = ms.reduce((a, m) => a + m.capacityMin, 0);
  const done = ms.reduce((a, m) => a + m.doneMin, 0);
  // Dias que já passaram não têm mais "por fazer": o que ficou para trás não conta como pendente.
  const today = todayKey();
  const remaining = ms.filter((m) => m.date >= today).reduce((a, m) => a + m.remainingMin, 0);
  const free = usable - done - remaining;
  const goals = weeklyGoals(date, tasks, sessions);
  const overDays = ms.filter((m) => m.freeMin < 0).length;
  const weekMetrics = { date, capacityMin: usable, plannedMin: 0, doneMin: done, remainingMin: remaining, freeMin: free, items: [] };

  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={cx("tabular text-[28px] leading-none font-semibold tracking-tight", free < 0 && "text-over")}>
              {free < 0 ? `${fmtMin(-free)} além do limite` : `${fmtMin(free)} livres na semana`}
            </p>
            <p className="mt-2 text-sm text-muted">
              {fmtMin(done)} feitos e {fmtMin(remaining)} por fazer daqui em diante, de {fmtMin(usable)} para tarefas.
              {overDays > 0 && ` ${overDays === 1 ? "Um dia passou" : `${overDays} dias passaram`} do limite.`}
            </p>
          </div>
          <p className="text-[13px] text-muted">Clique num dia para abrir.</p>
        </div>
        <div className="mt-4">
          <CapacityBar m={weekMetrics} />
        </div>
      </Panel>

      {goals.length > 0 && (
        <Panel>
          <PanelHeader title="Metas da semana" description="Quanto já foi feito de cada meta, somando todos os dias." />
          <ul className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            {goals.map((g) => (
              <li key={g.task.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{g.task.title}</span>
                  <span className="tabular text-muted">
                    {fmtMin(g.doneMin)} de {fmtMin(g.goalMin)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-done" style={{ width: `${Math.min(100, (g.doneMin / Math.max(1, g.goalMin)) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Calendar view="timeGridWeek" onPickDay={onPickDay} />
    </div>
  );
}

// ---------------- Tarefas ----------------

const GROUPS: { kind: RepeatKind; title: string; description: string; icon: typeof Repeat }[] = [
  { kind: "weekdays", title: "Repetem", description: "Aparecem sozinhas nos dias marcados.", icon: Repeat },
  { kind: "weeklyGoal", title: "Metas semanais", description: "Horas por semana, no dia que der.", icon: Target },
  { kind: "once", title: "De uma vez, pendentes", description: "Avulsas ainda não concluídas.", icon: CalendarPlus },
];

function describe(t: Task) {
  if (t.repeat === "weekdays") return `${fmtMin(t.estimateMin)} por dia, ${(t.weekdays ?? []).map((d) => WEEKDAY_SHORT[d].toLowerCase()).join(", ")}`;
  if (t.repeat === "weeklyGoal") return `${fmtMin(t.weeklyGoalMin ?? 0)} por semana`;
  const short = (k: string) => fromKey(k).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  const day = t.date ? `para ${short(t.date)}` : "sem dia (caixa de entrada)";
  return `${fmtMin(t.estimateMin)}, ${day}${t.deadline ? `, prazo ${short(t.deadline)}` : ""}`;
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
        return (
          <Panel key={g.kind}>
            <PanelHeader
              title={`${g.title} (${list.length})`}
              description={g.description}
              right={
                show === "active" && (
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
  const [caps, setCaps] = useState(settings.capacityByWeekday);
  const [focus, setFocus] = useState(settings.focusMin);
  const [brk, setBrk] = useState(settings.breakMin);
  const [saved, setSaved] = useState(false);
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  async function save() {
    await saveSettings(uid, { capacityByWeekday: caps, focusMin: focus, breakMin: brk });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }


  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel>
        <PanelHeader
          title="Tempo para tarefas em cada dia"
          description="Quanto do dia sobra para as tarefas daqui, fora trabalho e compromissos fixos. Para mudar só um dia, use o botão “Mudar o tempo” na tela do dia."
        />
        <div className="px-5 pb-5">
          <CapacityEditor value={caps} onChange={setCaps} />
          <p className="mt-3 text-sm text-muted">
            Total na semana: <span className="tabular font-semibold text-ink">{fmtMin(caps.reduce((a, b) => a + b, 0))}</span>
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Pomodoro" />
        <div className="space-y-4 px-5 pb-5">
          <PomodoroPicker
            focus={focus}
            brk={brk}
            onChange={(f, b) => {
              setFocus(f);
              setBrk(b);
            }}
          />
          {perm !== "granted" && perm !== "unsupported" && (
            <Button onClick={() => Notification.requestPermission().then(setPerm)}>
              <Bell size={14} /> Avisar quando o pomodoro acabar
            </Button>
          )}
          {perm === "granted" && <p className="text-[13px] text-done">Notificações ativadas.</p>}
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
