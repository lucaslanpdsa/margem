"use client";

import { CalendarDays, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { dayName, fmtMin, parseQuickAdd, shiftDay, todayKey } from "@/lib/dates";
import { addTask, deleteTask, replaceTask, setDayOrder, updateTask } from "@/lib/db";
import { isTimeTask, overdue, type DayMetrics } from "@/lib/metrics";
import { displayOrder, firstNotFitting, fmtClock, moveInQueue, orderItems, projectDay, type Move } from "@/lib/queue";
import type { Task } from "@/lib/types";
import { findConflicts } from "@/lib/schedule";
import { isAccurate, likelyMin } from "@/lib/calibration";
import { DayMenu } from "./DayMenu";
import { useDialogs } from "./dialogs";
import { useCalibration } from "./Estimates";
import { useStore } from "./store";
import { TaskRow } from "./TaskRow";
import { useNow } from "./Timer";
import { useToast } from "./toast";
import { Button, Panel, cx, inputCls } from "./ui";

/** "Revisar PR 45m" + Enter cria direto; sem tempo no fim, abre o formulário. */
export function QuickAdd({ date }: { date: string }) {
  const { uid } = useStore();
  const { editTask } = useDialogs();
  const [text, setText] = useState("");
  const preview = parseQuickAdd(text);
  // Com estimativas suficientes (Pro), a dica de quanto isso costuma virar.
  const cal = useCalibration();
  const likely = cal && preview.minutes !== null && !isAccurate(cal) ? likelyMin(preview.minutes, cal) : null;

  async function submit() {
    const { title, minutes } = parseQuickAdd(text);
    if (!title) return;
    if (minutes === null) editTask({ title, date, repeat: "once" });
    else await addTask(uid, { title, estimateMin: minutes, date, repeat: "once" });
    setText("");
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
      {text && (
        <p className="mt-1.5 text-xs text-muted">
          {preview.minutes !== null ? `Enter cria "${preview.title}" com ${fmtMin(preview.minutes)}.` : "Coloque o tempo no fim (45m, 1h30) ou aperte Enter para mais opções."}
          {likely !== null && likely !== preview.minutes && ` Costuma levar ~${fmtMin(likely)}.`}
        </p>
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

  const ordered = orderItems(
    m.items.filter((i) => !i.completed && !i.skipped),
    order,
    blocks,
    date,
  );
  // Mesmo "A fazer" do topo do dia, para a previsão bater com ele.
  const room = Math.max(0, m.capacityMin - Math.max(m.doneMin, m.elapsedMin));
  const proj = projectDay(ordered, settings, date, new Date(now), room, settings.activeTimer?.taskId);
  const open = displayOrder(ordered, proj);
  const ids = ordered.map((i) => i.task.id);
  // As de horário marcado (ainda por vir) e as extra não mudam de lugar: o lugar delas é o horário.
  const movable = new Set(ordered.filter((i) => !i.outside && !proj.byTask.get(i.task.id)?.fixed).map((i) => i.task.id));
  const movableIds = ids.filter((id) => movable.has(id));
  const firstOut = firstNotFitting(open, proj);
  // Soma do que não cabe nada (abaixo da linha); o que cabe em parte avisa na própria linha.
  const outMin = firstOut < 0 ? 0 : open.slice(firstOut).reduce((a, i) => a + (proj.byTask.get(i.task.id)?.excessMin ?? 0), 0);
  const firstPlanned = open.find((i) => (proj.byTask.get(i.task.id)?.start ?? -1) >= 0);

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

  const done = m.items.filter((i) => i.completed || i.skipped);
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
    return proj.byTask.get(id)!.start <= proj.cursor ? "Agora" : "Próxima";
  };

  return (
    <Panel className="p-5">
      <h2 className="mb-3 text-[15px] font-semibold">{isToday ? "Tarefas de hoje" : "Tarefas do dia"}</h2>
      <QuickAdd date={date} />

      {late.length > 0 && <DayClosing tasks={late} date={date} />}

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
  const { uid, days, sessions } = useStore();
  // Poucas tarefas: já aberto, para decidir de uma vez.
  const [open, setOpen] = useState(tasks.length <= 3);
  const [moving, setMoving] = useState<string | null>(null);
  const toast = useToast();
  const left = (t: Task) => Math.max(0, t.estimateMin - sessions.filter((s) => s.taskId === t.id).reduce((a, s) => a + s.minutes, 0));
  const total = tasks.reduce((a, t) => a + left(t), 0);
  const y = days[shiftDay(date, -1)];
  const yesterday = y?.closedAt && (y.plannedMin ?? 0) > 0 ? y : null;

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
              <b className="tabular font-semibold text-ink">{fmtMin(yesterday.doneMin ?? 0)}</b>. Decida o que fazer com o que sobrou:
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
