"use client";

import type { EventChangeArg, EventClickArg, EventInput } from "@fullcalendar/core";
import ptBr from "@fullcalendar/core/locales/pt-br";
import interactionPlugin, { type EventReceiveArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useEffect, useMemo, useRef, useState } from "react";
import { dayKey, fmtMin, fromKey, minutesBetween } from "@/lib/dates";
import { addBlock, deleteBlock, updateBlock, updateTask } from "@/lib/db";
import { dayMetrics, isCompletedOn } from "@/lib/metrics";
import { startFocus } from "@/lib/pomodoro";
import type { Block, Task } from "@/lib/types";
import { CapacityBar } from "./CapacityPanel";
import { useDialogs } from "./dialogs";
import { useStore } from "./store";
import { Button, Modal, cx } from "./ui";

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

  const events: EventInput[] = blocks.map((b) => {
    const t = taskById.get(b.taskId);
    const done = t ? (t.repeat === "weeklyGoal" ? false : isCompletedOn(t, b.date)) : false;
    const active = settings.activeTimer?.taskId === b.taskId && settings.activeTimer.phase === "focus";
    return {
      id: b.id,
      title: t?.title ?? "(tarefa excluída)",
      start: b.start,
      end: b.end,
      classNames: cx(done && "is-done", active && "is-active").split(" ").filter(Boolean),
    };
  });

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
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <FullCalendar
        ref={ref}
        plugins={[timeGridPlugin, interactionPlugin]}
        locale={ptBr}
        initialView={view}
        initialDate={fromKey(date)}
        headerToolbar={false}
        allDaySlot={false}
        nowIndicator
        editable
        droppable
        eventDurationEditable
        snapDuration="00:15:00"
        slotDuration="00:30:00"
        slotMinTime="05:00:00"
        slotMaxTime="24:00:00"
        scrollTime={`${String(Math.max(5, new Date().getHours() - 1)).padStart(2, "0")}:00:00`}
        firstDay={1}
        height={view === "timeGridDay" ? "72vh" : "78vh"}
        events={events}
        eventReceive={onReceive}
        eventChange={onChange}
        eventClick={onClick}
        dayHeaderContent={(arg) => {
          if (view === "timeGridDay") return null;
          const key = dayKey(arg.date);
          const m = dayMetrics(key, settings, tasks, blocks, sessions);
          return (
            <button className="block w-full px-1 py-1 text-left" onClick={() => onPickDay?.(key)} title="Abrir o dia">
              <span className={cx("text-xs", arg.isToday && "font-semibold text-done")}>{arg.text}</span>
              <span className="mt-1 block">
                <CapacityBar m={m} thin />
              </span>
              <span className={cx("tabular mt-0.5 block text-[11px]", m.freeMin < 0 ? "text-warn" : "text-muted")}>
                {m.freeMin < 0 ? `+${fmtMin(-m.freeMin)} além` : `${fmtMin(m.freeMin)} livre`}
              </span>
            </button>
          );
        }}
      />
      {selected && <BlockActions block={selected} task={taskById.get(selected.taskId)} onClose={() => setSelected(null)} />}
    </div>
  );
}

function BlockActions({ block, task, onClose }: { block: Block; task?: Task; onClose: () => void }) {
  const { uid, settings } = useStore();
  const { editTask, logTime } = useDialogs();
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <Modal title={task?.title ?? "Bloco"} onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        {hhmm(block.start)}–{hhmm(block.end)} · {fmtMin(minutesBetween(block.start, block.end))}
      </p>
      <div className="flex flex-wrap gap-2">
        {task && (
          <>
            <Button
              variant="primary"
              onClick={() => {
                startFocus(uid, settings, task.id);
                onClose();
              }}
            >
              ▶ Iniciar pomodoro
            </Button>
            <Button
              onClick={() => {
                onClose();
                logTime(task);
              }}
            >
              Registrar tempo
            </Button>
            <Button
              onClick={() => {
                onClose();
                editTask(task);
              }}
            >
              Editar tarefa
            </Button>
          </>
        )}
        <Button
          variant="danger"
          onClick={() => {
            deleteBlock(uid, block.id);
            onClose();
          }}
        >
          Tirar da agenda
        </Button>
      </div>
    </Modal>
  );
}
