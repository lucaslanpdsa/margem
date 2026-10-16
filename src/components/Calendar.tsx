"use client";

import type { EventChangeArg, EventClickArg, EventInput } from "@fullcalendar/core";
import ptBr from "@fullcalendar/core/locales/pt-br";
import interactionPlugin, { type EventReceiveArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useEffect, useMemo, useRef, useState } from "react";
import { dayKey, fmtMin, fromKey, minutesBetween } from "@/lib/dates";
import { addBlock, deleteBlock, toggleDone, updateBlock, updateTask } from "@/lib/db";
import { blockOutside, dayMetrics, isCompletedOn } from "@/lib/metrics";
import { toMin, windowFor } from "@/lib/schedule";
import { startFocus } from "@/lib/pomodoro";
import type { Block, Task } from "@/lib/types";
import { CapacityBar } from "./CapacityPanel";
import { useNow } from "./Timer";
import { useStore } from "./store";
import { Check, Play, Trash2 } from "lucide-react";
import { Button, Modal, Panel, PanelHeader, cx } from "./ui";

interface Props {
  view: "timeGridDay" | "timeGridWeek";
  onPickDay?: (date: string) => void;
}

export function Calendar({ view, onPickDay }: Props) {
  const { uid, date, tasks, blocks, sessions, settings } = useStore();
  const ref = useRef<FullCalendar>(null);
  const [selected, setSelected] = useState<Block | null>(null);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  useEffect(() => {
    ref.current?.getApi().gotoDate(fromKey(date));
  }, [date]);

  const blockEvents: EventInput[] = blocks.map((b) => {
    const t = taskById.get(b.taskId);
    const done = t ? (t.repeat === "weeklyGoal" ? false : isCompletedOn(t, b.date)) : false;
    const active = settings.activeTimer?.taskId === b.taskId && settings.activeTimer.phase === "focus";
    return {
      id: b.id,
      title: t?.title ?? "(tarefa excluída)",
      start: b.start,
      end: b.end,
      classNames: cx(done && "is-done", active && "is-active", blockOutside(b, windowFor(settings, b.date)) && "is-extra")
        .split(" ")
        .filter(Boolean),
    };
  });

  // Seu horário fica em destaque; o resto do dia fica cinza. Pausas (almoço) aparecem marcadas.
  const workDays = settings.windows.map((w, d) => (w ? d : -1)).filter((d) => d >= 0);
  const businessHours = settings.windows.flatMap((w, d) => (w ? [{ daysOfWeek: [d], startTime: w.start, endTime: w.end }] : []));
  const breakEvents: EventInput[] = settings.breaks.map((b, i) => ({
    id: `break-${i}`,
    title: b.label,
    daysOfWeek: workDays,
    startTime: b.start,
    endTime: b.end,
    display: "background",
    classNames: ["is-break"],
  }));
  const events = [...blockEvents, ...breakEvents];
  const earliest = Math.min(...settings.windows.filter(Boolean).map((w) => toMin(w!.start)), 8 * 60);
  const slotMin = `${String(Math.max(0, Math.floor(earliest / 60) - 1)).padStart(2, "0")}:00:00`;

  // Quando a tarefa avulsa vai para a agenda de outro dia, ela passa a pertencer a esse dia.
  async function syncTaskDate(task: Task | undefined, day: string) {
    if (task?.repeat === "once" && task.date !== day) await updateTask(uid, task.id, { date: day });
  }

  async function onReceive(info: EventReceiveArg) {
    const taskId = info.event.extendedProps.taskId as string;
    const start = info.event.start!;
    const end = info.event.end ?? new Date(start.getTime() + 30 * 60000);
    info.event.remove(); // o bloco real chega pelo Firestore
    const day = dayKey(start);
    await addBlock(uid, { taskId, date: day, start: start.toISOString(), end: end.toISOString() });
    await syncTaskDate(taskById.get(taskId), day);
  }

  async function onChange(info: EventChangeArg) {
    const block = blocks.find((b) => b.id === info.event.id);
    const start = info.event.start!;
    const end = info.event.end!;
    const day = dayKey(start);
    await updateBlock(uid, info.event.id, { date: day, start: start.toISOString(), end: end.toISOString() });
    if (block) await syncTaskDate(taskById.get(block.taskId), day);
  }

  function onClick(info: EventClickArg) {
    setSelected(blocks.find((b) => b.id === info.event.id) ?? null);
  }

  return (
    <Panel className="overflow-hidden">
      {view === "timeGridDay" && (
        <PanelHeader title="Agenda" description="Arraste tarefas da lista para cá. Puxe a borda de um bloco para mudar a duração." />
      )}
      <div className={view === "timeGridDay" ? "border-t border-line" : ""}>
      <FullCalendar
        ref={ref}
        plugins={[timeGridPlugin, interactionPlugin]}
        locale={ptBr}
        initialView={view}
        initialDate={fromKey(date)}
        headerToolbar={false}
        dayHeaders={view !== "timeGridDay"}
        allDaySlot={false}
        nowIndicator
        editable
        droppable
        eventDurationEditable
        snapDuration="00:15:00"
        slotDuration="00:30:00"
        slotMinTime={slotMin}
        businessHours={businessHours}
        slotMaxTime="24:00:00"
        scrollTime={`${String(Math.max(Math.floor(earliest / 60) - 1, new Date().getHours() - 1)).padStart(2, "0")}:00:00`}
        firstDay={1}
        height={view === "timeGridDay" ? "70vh" : "74vh"}
        events={events}
        eventReceive={onReceive}
        eventChange={onChange}
        eventClick={onClick}
        dayHeaderContent={(arg) => {
          if (view === "timeGridDay") return null;
          const key = dayKey(arg.date);
          const m = dayMetrics(key, settings, tasks, blocks, sessions);
          const label = !m.window
            ? "sem horário"
            : m.leftMin === 0
              ? `${fmtMin(m.doneMin)} feitos`
              : m.freeMin < 0
                ? `${fmtMin(-m.freeMin)} não cabem`
                : `${fmtMin(m.freeMin)} livres`;
          return (
            <button className="block w-full rounded-lg px-1.5 py-1.5 text-left hover:bg-sunken" onClick={() => onPickDay?.(key)} title="Abrir este dia">
              <span className={cx("block text-[13px] capitalize", arg.isToday ? "font-semibold text-todo" : "text-ink")}>{arg.text}</span>
              <span className="mt-1.5 block">
                <CapacityBar m={m} thin />
              </span>
              <span className={cx("tabular mt-1 block text-[11px] font-normal", m.freeMin < 0 && m.leftMin > 0 ? "text-over" : "text-muted")}>
                {label}
              </span>
            </button>
          );
        }}
      />
      </div>
      {selected && <BlockActions block={selected} task={taskById.get(selected.taskId)} onClose={() => setSelected(null)} />}
    </Panel>
  );
}

function BlockActions({ block, task, onClose }: { block: Block; task?: Task; onClose: () => void }) {
  const { uid, settings } = useStore();
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const now = useNow(30000);
  const passed = Date.parse(block.end) <= now;
  const canComplete = task && task.repeat !== "weeklyGoal" && !isCompletedOn(task, block.date);
  const act = (fn: () => unknown) => () => {
    fn();
    onClose();
  };

  return (
    <Modal
      title={task?.title ?? "Bloco"}
      description={`${hhmm(block.start)}–${hhmm(block.end)} · ${fmtMin(minutesBetween(block.start, block.end))}${passed ? " · já passou" : ""}`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        {canComplete && (
          <Button variant={passed ? "primary" : "secondary"} className="h-11" onClick={act(() => toggleDone(uid, task!, block.date, true))}>
            <Check size={16} /> Concluir
          </Button>
        )}
        {task && !passed && (
          <Button variant="primary" className="h-11" onClick={act(() => startFocus(uid, settings, task.id))}>
            <Play size={14} fill="currentColor" /> Começar foco
          </Button>
        )}
        <Button variant="danger" className="h-11" onClick={act(() => deleteBlock(uid, block.id))}>
          <Trash2 size={14} /> Tirar da agenda
        </Button>
      </div>
    </Modal>
  );
}
