"use client";

import { CalendarDays, CalendarCheck, ChevronDown, Inbox, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { dayName, fmtMin, shiftDay, todayKey } from "@/lib/dates";
import { addTask, deleteTask, moveToLater, replaceTask, restoreTaskPlace, setDayOrder, updateTask } from "@/lib/db";
import { isReminder, isTimeTask, overdue, tracksTime, type DayMetrics } from "@/lib/metrics";
import { parseCapture } from "@/lib/capture";
import { ReminderRow, TimeChips, saveCapture } from "./Later";
import { repeatText } from "@/lib/dates";
import { CloseDayCard, PlanDayCard, PlanDayDialog } from "./PlanClose";
import { displayOrder, firstNotFitting, fmtClock, moveInQueue, orderItems, projectDay, type Move } from "@/lib/queue";
import type { Task } from "@/lib/types";
import { findConflicts, slotsOf, toMin } from "@/lib/schedule";
import { isAccurate, likelyMin } from "@/lib/calibration";
import { DayMenu } from "./DayMenu";
import { useDialogs } from "./dialogs";
import { useCalibration } from "./Estimates";
import { useStore } from "./store";
import { TaskRow } from "./TaskRow";
import { useNow } from "./Timer";
import { useToast } from "./toast";
import { Button, Panel, cx, inputCls } from "./ui";

/**
 * Criação rápida no dia aberto: "Revisar PR 45m" + Enter cria direto. Um dia no fim manda para ele ("amanhã", "sexta").
 * Sem tempo, aparecem os tempos de um toque, "Lembrete" e "Depois"; Enter abre o formulário completo.
 */
export function QuickAdd({ date }: { date: string }) {
  const { uid } = useStore();
  const { editTask } = useDialogs();
  const toast = useToast();
  const [text, setText] = useState("");
  const c = parseCapture(text, todayKey());
  const day = c.date ?? date;
  // Com estimativas suficientes (Pro), a dica de quanto isso costuma virar.
  const cal = useCalibration();
  const likely = cal && c.minutes !== null && !isAccurate(cal) ? likelyMin(c.minutes, cal) : null;

  async function create(minutes: number) {
    if (!c.title) return;
    const id = await addTask(uid, { title: c.title, estimateMin: minutes, date: day, repeat: "once" });
    if (day !== date || minutes === 0) toast(minutes === 0 ? `Lembrete: ${c.title}` : `${c.title} foi para ${dayName(day).toLowerCase()}`, { tone: "info", undo: () => deleteTask(uid, id) });
    setText("");
  }
  async function later() {
    if (!c.title) return;
    const id = await saveCapture(uid, { title: c.title, minutes: null, date: null, weekdays: null });
    toast(`${c.title} foi para Depois`, { tone: "info", undo: () => deleteTask(uid, id) });
    setText("");
  }
  async function submit() {
    if (!c.title) return;
    // "Inglês ter e qui 45m": tarefa que repete.
    if (c.weekdays) {
      const id = await saveCapture(uid, c);
      toast(`${c.title} criada: ${repeatText(c.weekdays)}`, { tone: "info", undo: () => deleteTask(uid, id) });
      return setText("");
    }
    if (c.minutes !== null) create(c.minutes);
    else editTask({ title: c.title, date: day, repeat: "once" });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="relative">
        <Plus size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          className={cx(inputCls, "pl-9")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nova tarefa, ex: Revisar PR 45m"
          aria-label="Nova tarefa"
        />
      </div>
      {text && c.minutes !== null && (
        <p className="mt-1.5 text-xs text-muted">
          Enter cria &quot;{c.title}&quot; com {fmtMin(c.minutes)}
          {day !== date ? ` ${dayName(day).toLowerCase()}` : ""}.{likely !== null && likely !== c.minutes && ` Costuma levar ~${fmtMin(likely)}.`}
        </p>
      )}
      {text && c.minutes === null && c.title && (
        <div className="mt-2">
          <p className="mb-1.5 text-xs text-muted">{day !== date ? `${dayName(day)} · quanto tempo?` : "Quanto tempo?"} Enter abre mais opções.</p>
          <TimeChips onPick={create}>
            <button type="button" onClick={later} className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-2.5 text-[13px] font-medium text-muted hover:text-ink">
              <Inbox size={13} /> Depois
            </button>
          </TimeChips>
        </div>
      )}
    </form>
  );
}

export function DayLists({ m, onGoTasks }: { m: DayMetrics; onGoTasks: () => void }) {
  const { uid, tasks, blocks, date, days, settings } = useStore();
  const { editTask } = useDialogs();
  const toast = useToast();
  const now = useNow(60000);
  const [showDone, setShowDone] = useState(false);
  const isToday = date === todayKey();

  // Fila: a ordem salva do dia. Enquanto a gravação não volta do banco (e na prévia, que não grava),
  // vale a que a pessoa acabou de escolher, desde que a salva não tenha mudado por outro aparelho.
  const stored = days[date]?.order;
  const storedKey = JSON.stringify(stored ?? null);
  const [mine, setMine] = useState<{ date: string; ids: string[]; base: string } | null>(null);
  const order = mine && mine.date === date && mine.base === storedKey ? mine.ids : stored;

  // Lembretes não ocupam horas: ficam numa lista própria, fora da fila.
  const reminders = m.items.filter((i) => isReminder(i.task)).map((i) => i.task);
  const ordered = orderItems(
    m.items.filter((i) => !i.completed && !i.skipped && !isReminder(i.task)),
    order,
    blocks,
    date,
  );
  // Mesmo "A fazer" do topo do dia, para a previsão bater com ele.
  const room = Math.max(0, m.capacityMin - Math.max(m.doneMin, m.elapsedMin));
  // As mesmas pausas da conta do dia (fixas + trabalho do ponto + blocos).
  const proj = projectDay(ordered, { ...settings, breaks: m.breaks }, date, new Date(now), room, settings.activeTimer?.taskId);
  const open = displayOrder(ordered, proj);
  const ids = ordered.map((i) => i.task.id);
  // As de horário marcado (ainda por vir) e as extra não mudam de lugar: o lugar delas é o horário.
  const movable = new Set(ordered.filter((i) => !i.outside && !proj.byTask.get(i.task.id)?.fixed).map((i) => i.task.id));
  const movableIds = ids.filter((id) => movable.has(id));
  const firstOut = firstNotFitting(open, proj);
  // Soma do que não cabe nada (abaixo da linha); o que cabe em parte avisa na própria linha.
  const outMin = firstOut < 0 ? 0 : open.slice(firstOut).reduce((a, i) => a + (proj.byTask.get(i.task.id)?.excessMin ?? 0), 0);
  // "Agora": a primeira com horário previsto. Bloco só conta enquanto está acontecendo (um que já passou não é "agora").
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const blockNow = (i: (typeof open)[number]) => slotsOf(i.task).some((s) => toMin(s.start) <= nowMin && nowMin < toMin(s.end));
  const firstPlanned = open.find((i) => (proj.byTask.get(i.task.id)?.start ?? -1) >= 0 && (!i.block || blockNow(i)));

  function saveOrder(next: string[]) {
    setMine({ date, ids: next, base: storedKey });
    setDayOrder(uid, date, next);
  }
  function move(task: Task, to: Move | { before: string | null }) {
    const before = ids;
    const next = moveInQueue(ids, task.id, to, movable);
    if (next.join() === before.join()) return;
    saveOrder(next);
    if (to === "top") toast(`${task.title} é a próxima`, { tone: "info", undo: () => saveOrder(before) });
  }

  // Arrastar (computador): solta antes da linha em que parou.
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const done = m.items.filter((i) => (i.completed || i.skipped) && !isReminder(i.task));
  const [planning, setPlanning] = useState(false);
  const skippedCount = done.filter((i) => i.skipped).length;
  const conflicts = findConflicts(blocks.filter((b) => b.date === date));
  const conflictText = (id: string) => {
    const names = [...new Set(conflicts.filter((c) => c.taskId === id).map((c) => tasks.find((t) => t.id === c.otherId)?.title))].filter(Boolean);
    return names.length ? `conflita com ${names.join(", ")}` : undefined;
  };
  const late = isToday ? overdue(date, tasks) : [];

  /** "14:10–15:40"; se só uma parte cabe, "17:20 · 40min não cabe" (as fixas já mostram o horário delas). */
  const projected = (id: string): { text: string; over: boolean } | undefined => {
    const p = proj.byTask.get(id);
    if (!p || p.start < 0 || p.end <= p.start) return undefined;
    if (p.fits) return p.fixed ? undefined : { text: `${fmtClock(p.start)}–${fmtClock(p.end)}`, over: false };
    const lost = `${fmtMin(p.excessMin)} não cabe`;
    return { text: p.fixed ? lost : `${fmtClock(p.start)} · ${lost}`, over: true };
  };
  const badgeFor = (id: string) => {
    if (!isToday || firstPlanned?.task.id !== id) return undefined;
    const it = open.find((i) => i.task.id === id)!;
    return it.block || proj.byTask.get(id)!.start <= proj.cursor ? "Agora" : "Próxima";
  };

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{isToday ? "Tarefas de hoje" : "Tarefas do dia"}</h2>
        {isToday && days[date]?.plannedAt && (
          <Button size="sm" variant="ghost" onClick={() => setPlanning(true)}>
            <CalendarCheck size={14} /> Planejar
          </Button>
        )}
      </div>
      {planning && <PlanDayDialog onClose={() => setPlanning(false)} />}
      <QuickAdd date={date} />

      <PlanDayCard m={m} />
      <CloseDayCard m={m} />
      {late.length > 0 && <DayClosing tasks={late} date={date} />}

      {reminders.length > 0 && (
        <ul className="mt-4 rounded-xl border border-line px-2 py-1">
          {reminders.map((t) => (
            <ReminderRow key={t.id} task={t} />
          ))}
        </ul>
      )}

      <ul className="mt-4 space-y-1.5">
        {open.map((i, idx) => {
          const id = i.task.id;
          const canMove = movable.has(id) && movableIds.length > 1;
          return (
            <FragmentWithDivider key={id} divider={idx === firstOut} isToday={isToday} excessMin={outMin}>
              <TaskRow
                task={i.task}
                date={date}
                estimateMin={i.estimateMin}
                doneMin={i.doneMin}
                checkable={!isTimeTask(i.task)}
                warning={conflictText(id)}
                outside={i.outside}
                block={i.block}
                badge={badgeFor(id)}
                projected={projected(id)?.text}
                projectedOver={projected(id)?.over}
                dimmed={firstOut >= 0 && idx >= firstOut}
                onMove={canMove ? (to) => move(i.task, to) : undefined}
                canUp={movableIds[0] !== id}
                canDown={movableIds[movableIds.length - 1] !== id}
                drag={
                  canMove
                    ? {
                        over: over === id && dragging !== id,
                        onDragStart: () => setDragging(id),
                        onDragOver: (e) => {
                          if (!dragging || !movable.has(id)) return;
                          e.preventDefault();
                          setOver(id);
                        },
                        onDrop: () => {
                          const t = tasks.find((x) => x.id === dragging);
                          if (t && dragging !== id) move(t, { before: id });
                          setDragging(null);
                          setOver(null);
                        },
                        onDragEnd: () => {
                          setDragging(null);
                          setOver(null);
                        },
                      }
                    : undefined
                }
              />
            </FragmentWithDivider>
          );
        })}
      </ul>
      {/* Soltar depois da última: vai para o fim da fila. */}
      {dragging && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(null);
          }}
          onDrop={() => {
            const t = tasks.find((x) => x.id === dragging);
            if (t) move(t, { before: null });
            setDragging(null);
          }}
          className="mt-1.5 hidden rounded-xl border border-dashed border-line py-2 text-center text-xs text-muted lg:block"
        >
          Soltar aqui para ir para o fim
        </div>
      )}
      {open.length === 0 &&
        (m.items.length === 0 ? (
          // Dia vazio: os dois caminhos para começar.
          <div className="mt-4 rounded-xl bg-sunken px-4 py-4 text-sm">
            <p className="font-medium">Nenhuma tarefa neste dia.</p>
            <p className="mt-0.5 text-muted">Crie uma tarefa para hoje ou monte a rotina da semana (tarefas que repetem).</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => editTask({ repeat: "once", date })}>
                <Plus size={14} /> Criar tarefa
              </Button>
              <Button variant="secondary" onClick={onGoTasks}>
                Montar rotina em Tarefas
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-sunken px-4 py-3 text-sm text-muted">Tudo feito por aqui.</p>
        ))}

      {done.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowDone((v) => !v)} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
            <ChevronDown size={14} className={cx("transition-transform", !showDone && "-rotate-90")} />
            {skippedCount === 0 ? "Concluídas" : skippedCount === done.length ? "Puladas" : "Concluídas e puladas"} ({done.length})
          </button>
          {showDone && (
            <ul className="mt-1.5 space-y-1.5">
              {done.map((i) => (
                <TaskRow
                  key={i.task.id}
                  task={i.task}
                  date={date}
                  estimateMin={i.estimateMin}
                  doneMin={i.doneMin}
                  completed={i.completed}
                  skipped={i.skipped}
                  checkable={!isTimeTask(i.task)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

/** Linha "Não cabe hoje" antes da primeira tarefa que passa do fim do horário. */
function FragmentWithDivider({ divider, isToday, excessMin, children }: { divider: boolean; isToday: boolean; excessMin: number; children: ReactNode }) {
  return (
    <>
      {divider && (
        <li className="flex items-center gap-2 pt-1.5 pb-0.5 text-xs font-medium text-over" aria-label="Daqui para baixo não cabe">
          <span className="h-px flex-1 bg-over/40" />
          Não cabe {isToday ? "hoje" : "no dia"} · {fmtMin(excessMin)}
          <span className="h-px flex-1 bg-over/40" />
        </li>
      )}
      {children}
    </>
  );
}

/**
 * Fechamento do dia: o que ficou de dias anteriores pede uma decisão (hoje, outro dia ou excluir),
 * com o resumo de ontem. Só tarefas de uma vez: as que repetem não acumulam (o atraso delas fica em "Esta semana").
 */
function DayClosing({ tasks, date }: { tasks: Task[]; date: string }) {
  const { uid, days, sessions, settings } = useStore();
  // Poucas tarefas: já aberto, para decidir de uma vez.
  const [open, setOpen] = useState(tasks.length <= 3);
  const [moving, setMoving] = useState<string | null>(null);
  const toast = useToast();
  const left = (t: Task) => Math.max(0, t.estimateMin - sessions.filter((s) => s.taskId === t.id).reduce((a, s) => a + s.minutes, 0));
  const total = tasks.reduce((a, t) => a + left(t), 0);
  const y = days[shiftDay(date, -1)];
  // Em horas só faz sentido com registro de tempo (no modo leve o "feito" seria sempre zero).
  const yesterday = tracksTime(settings) && y?.closedAt && (y.plannedMin ?? 0) > 0 ? y : null;

  const moveTo = (list: Task[], to: string) => {
    const before = list.map((t) => [t.id, t.date] as const);
    Promise.all(list.map((t) => updateTask(uid, t.id, { date: to })));
    const where = to === date ? "hoje" : dayName(to, date).toLowerCase();
    toast(list.length === 1 ? `${list[0].title} foi para ${where}` : `${list.length} tarefas foram para ${where}`, {
      tone: "info",
      undo: () => Promise.all(before.map(([id, d]) => updateTask(uid, id, { date: d }))),
    });
  };
  const remove = (t: Task) => {
    deleteTask(uid, t.id);
    toast(`${t.title} excluída`, { undo: () => replaceTask(uid, t) });
  };

  return (
    <div className="mt-4 rounded-xl bg-sunken px-3 py-2.5">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-1 text-left text-[13px] font-medium text-ink">
          <ChevronDown size={14} className={cx("shrink-0 transition-transform", !open && "-rotate-90")} />
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-over" />
          {tasks.length === 1 ? "1 tarefa ficou" : `${tasks.length} tarefas ficaram`} de dias anteriores · {fmtMin(total)}
        </button>
        <Button size="sm" variant="secondary" onClick={() => moveTo(tasks, date)}>
          Trazer para hoje
        </Button>
      </div>
      {open && (
        <div className="mt-2 border-t border-line pt-2">
          {yesterday && (
            <p className="mb-1.5 text-xs text-muted">
              Ontem: planejado <b className="tabular font-semibold text-ink">{fmtMin(yesterday.plannedMin!)}</b>, feito{" "}
              <b className="tabular font-semibold text-ink">{fmtMin(yesterday.doneMin ?? 0)}</b>. Decida para onde vai o que sobrou:
            </p>
          )}
          <ul className="space-y-1">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="tabular shrink-0 text-xs text-muted">{fmtMin(left(t))}</span>
                <button onClick={() => moveTo([t], date)} className="shrink-0 px-1 text-[13px] font-medium text-accent hover:underline">
                  Hoje
                </button>
                <div className="relative shrink-0">
                  <button onClick={() => setMoving(moving === t.id ? null : t.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink" aria-label={`Outro dia para ${t.title}`} title="Outro dia">
                    <CalendarDays size={15} />
                  </button>
                  {moving === t.id && (
                    <DayMenu
                      value={date}
                      task={t}
                      onClose={() => setMoving(null)}
                      onPick={(d) => {
                        setMoving(null);
                        moveTo([t], d);
                      }}
                    />
                  )}
                </div>
                <button
                  onClick={() => {
                    moveToLater(uid, t);
                    toast(`${t.title} foi para Depois`, { tone: "info", undo: () => restoreTaskPlace(uid, t) });
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
                  aria-label={`${t.title} para Depois`}
                  title="Depois"
                >
                  <Inbox size={15} />
                </button>
                <button onClick={() => remove(t)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-over" aria-label={`Excluir ${t.title}`} title="Excluir">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
