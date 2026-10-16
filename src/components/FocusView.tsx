"use client";

import { Bell, Check, Minus, MoreHorizontal, Play, Plus, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { fmtMin, parseDuration, todayKey } from "@/lib/dates";
import { addSession, deleteSession, saveSettings, updateSession } from "@/lib/db";
import { dayItems, weeklyGoals } from "@/lib/metrics";
import { isStopwatch, startTimer, stopTimer } from "@/lib/pomodoro";
import type { Session, Task } from "@/lib/types";
import { useStore } from "./store";
import { timerDisplay, useNow } from "./Timer";
import { Button, IconButton, Modal, Panel, PanelHeader, Segmented, cx, inputCls } from "./ui";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Tarefas que fazem sentido escolher hoje: as do dia ainda abertas e as metas da semana. */
export function useTaskOptions() {
  const { tasks, blocks, sessions } = useStore();
  const today = todayKey();
  const open = dayItems(today, tasks, blocks, sessions)
    .filter((i) => !i.completed && i.task.repeat !== "weeklyGoal")
    .map((i) => ({ task: i.task, hint: `falta ${fmtMin(i.remainingMin)}` }));
  const goals = weeklyGoals(today, tasks, sessions).map((g) => ({ task: g.task, hint: "meta da semana" }));
  return [...open, ...goals];
}

function TaskSelect({ value, onChange, disabled, extra }: { value: string; onChange: (id: string) => void; disabled?: boolean; extra?: Task }) {
  const options = useTaskOptions();
  const list = extra && !options.some((o) => o.task.id === extra.id) ? [...options, { task: extra, hint: "" }] : options;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={cx(inputCls, "h-11 font-medium disabled:opacity-100")} aria-label="Tarefa">
      <option value="">Sem tarefa</option>
      {list.map((o) => (
        <option key={o.task.id} value={o.task.id}>
          {o.task.title}
          {o.hint ? ` · ${o.hint}` : ""}
        </option>
      ))}
    </select>
  );
}

function Ring({ pct, active, children }: { pct: number | null; active: boolean; children: React.ReactNode }) {
  const r = 106;
  const c = 2 * Math.PI * r;
  const fill = pct === null ? (active ? 1 : 0) : pct / 100;
  return (
    <div className="relative h-[236px] w-[236px]">
      <svg width="236" height="236" viewBox="0 0 236 236" aria-hidden="true">
        <circle cx="118" cy="118" r={r} fill="none" stroke="var(--sunken)" strokeWidth="12" />
        <circle
          cx="118"
          cy="118"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fill)}
          transform="rotate(-90 118 118)"
          className="transition-[stroke-dashoffset] duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Número em minutos com − e + (bom para o dedo no celular); também aceita digitar. */
function MinutesField({ label, value, step, min, max, onChange }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const set = (v: number) => {
    setDraft(null);
    onChange(Math.max(min, Math.min(max, Math.round(v) || value)));
  };
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      <span className="flex h-12 items-center rounded-xl border border-line">
        <IconButton label={`Menos ${label.toLowerCase()}`} type="button" onClick={() => set(value - step)} className="h-full w-11 rounded-r-none">
          <Minus size={16} />
        </IconButton>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== null && set(Number(draft))}
          onKeyDown={(e) => e.key === "Enter" && draft !== null && set(Number(draft))}
          className="tabular h-full w-full min-w-0 bg-transparent text-center text-lg font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <IconButton label={`Mais ${label.toLowerCase()}`} type="button" onClick={() => set(value + step)} className="h-full w-11 rounded-l-none">
          <Plus size={16} />
        </IconButton>
      </span>
    </label>
  );
}

function PomodoroMenu({ onClose }: { onClose: () => void }) {
  const { uid, settings } = useStore();
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  return (
    <Modal title="Pomodoro" description="Tempo em minutos." onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <MinutesField label="Foco" value={settings.focusMin} step={5} min={5} max={180} onChange={(v) => saveSettings(uid, { focusMin: v })} />
        <MinutesField label="Pausa" value={settings.breakMin} step={1} min={1} max={60} onChange={(v) => saveSettings(uid, { breakMin: v })} />
      </div>
      {perm !== "unsupported" && (
        <div className="mt-5 border-t border-line pt-4">
          {perm === "granted" ? (
            <p className="text-sm text-done">Você recebe um aviso quando o foco ou a pausa acabam.</p>
          ) : (
            <Button onClick={() => Notification.requestPermission().then(setPerm)}>
              <Bell size={14} /> Avisar quando o tempo acabar
            </Button>
          )}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Pronto
        </Button>
      </div>
    </Modal>
  );
}

const KIND_LABEL: Record<string, string> = { sw: "Cronômetro", pomo: "Pomodoro", pausa: "Pausa do pomodoro" };
const kindOf = (s: Session) => (s.kind === "manual" ? "Manual" : (KIND_LABEL[s.id.split("-")[0]] ?? "Pomodoro"));

function History() {
  const { uid, sessions, tasks } = useStore();
  const today = todayKey();
  const list = sessions.filter((s) => s.date === today).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const total = list.reduce((a, s) => a + s.minutes, 0);
  const [taskId, setTaskId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  async function addManual() {
    const m = parseDuration(amount);
    if (!m) return setError("Escreva o tempo, por exemplo 30m ou 2h.");
    const now = new Date().toISOString();
    await addSession(uid, { taskId, date: today, minutes: m, kind: "manual", startedAt: now, endedAt: now });
    setAmount("");
    setError("");
  }

  return (
    <Panel className="flex flex-col">
      <PanelHeader title="Hoje" description="Tudo que foi registrado hoje. Troque a tarefa de uma sessão se precisar." right={<span className="tabular font-semibold">{fmtMin(total)}</span>} />
      <ul className="space-y-1.5 px-4">
        {list.length === 0 && <li className="rounded-xl bg-sunken px-4 py-3 text-sm text-muted">Nada registrado ainda hoje.</li>}
        {list.map((s) => {
          const task = tasks.find((t) => t.id === s.taskId);
          return (
            <li key={s.id} className={cx("flex items-center gap-3 rounded-xl border px-3 py-2", s.taskId ? "border-line" : "border-dashed border-muted/40")}>
              <span className="tabular w-[5.5rem] shrink-0 text-[13px] text-muted">{s.kind === "manual" ? hhmm(s.startedAt) : `${hhmm(s.startedAt)}–${hhmm(s.endedAt)}`}</span>
              <div className="min-w-0 flex-1">
                <select
                  value={s.taskId}
                  onChange={(e) => updateSession(uid, s.id, { taskId: e.target.value })}
                  className={cx("w-full truncate bg-transparent text-sm font-medium outline-none", !s.taskId && "text-muted")}
                  aria-label="Tarefa da sessão"
                >
                  <option value="">Sem tarefa</option>
                  {tasks
                    .filter((t) => !t.archived || t.id === s.taskId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
                <span className="block text-xs text-muted">{task || !s.taskId ? kindOf(s) : "Tarefa excluída"}</span>
              </div>
              <span className="tabular text-sm font-semibold">{fmtMin(s.minutes)}</span>
              <IconButton label="Apagar registro" onClick={() => deleteSession(uid, s.id)}>
                <Trash2 size={15} />
              </IconButton>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-auto space-y-2 border-t border-line px-4 pt-4 pb-4 [&]:mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          addManual();
        }}
      >
        <p className="text-[13px] font-medium">Registrar sem timer</p>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-0 flex-[2_1_180px]">
            <TaskSelect value={taskId} onChange={setTaskId} />
          </div>
          <input className={cx(inputCls, "h-11 w-24 flex-[0_0_6rem]")} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="30m, 2h" aria-label="Quanto tempo" />
          <Button type="submit" variant="secondary" className="h-11">
            Registrar
          </Button>
        </div>
        {error && <p className="text-sm text-over">{error}</p>}
      </form>
    </Panel>
  );
}

export function FocusView() {
  const { uid, settings, tasks } = useStore();
  const now = useNow();
  const t = settings.activeTimer;
  const [mode, setMode] = useState<"pomodoro" | "stopwatch">("pomodoro");
  const [taskId, setTaskId] = useState("");
  const [menu, setMenu] = useState(false);

  const running = !!t;
  const shownMode = t ? (isStopwatch(t) ? "stopwatch" : "pomodoro") : mode;
  const d = t ? timerDisplay(t, now) : null;
  const focus = !t || t.phase === "focus";
  const runningTask = tasks.find((x) => x.id === t?.taskId);

  const clock = d?.text ?? (mode === "pomodoro" ? `${String(settings.focusMin).padStart(2, "0")}:00` : "00:00");
  const status = !t ? "Pronto para começar" : t.phase === "break" ? "Pausa" : isStopwatch(t) ? "Contando" : "Foco";

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Panel className="relative flex flex-col items-center gap-6 px-5 pt-6 pb-7">
        <IconButton label="Configurar pomodoro" onClick={() => setMenu(true)} className="absolute top-4 right-4">
          <MoreHorizontal size={18} />
        </IconButton>

        {running ? (
          <p className="text-sm font-medium text-muted">{shownMode === "pomodoro" ? "Pomodoro" : "Cronômetro"}</p>
        ) : (
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "pomodoro", label: "Pomodoro" },
              { value: "stopwatch", label: "Cronômetro" },
            ]}
          />
        )}

        <div className={focus ? "text-todo" : "text-break"}>
          <Ring pct={d ? d.pct : null} active={running}>
            <span className="tabular text-[52px] leading-none font-semibold tracking-tight text-ink">{clock}</span>
            <span className="mt-2 text-sm text-muted">{status}</span>
          </Ring>
        </div>

        <div className="w-full max-w-md space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">
              Tarefa <span className="font-normal text-muted">(opcional)</span>
            </span>
            {running ? (
              <span className={cx(inputCls, "flex h-11 items-center font-medium", !runningTask && "text-muted")}>{runningTask?.title ?? "Sem tarefa"}</span>
            ) : (
              <TaskSelect value={taskId} onChange={setTaskId} />
            )}
          </label>

          {shownMode === "pomodoro" && (
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium">O que conta como feito</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: false, title: "Só o foco", hint: `${settings.focusMin} min por ciclo` },
                  { v: true, title: "Foco + pausa", hint: `${settings.focusMin + settings.breakMin} min por ciclo` },
                ].map((o) => {
                  const on = !!settings.countBreaks === o.v;
                  return (
                    <button
                      type="button"
                      key={String(o.v)}
                      onClick={() => saveSettings(uid, { countBreaks: o.v })}
                      aria-pressed={on}
                      className={cx(
                        "flex items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                        on ? "border-todo bg-todo/[0.06] ring-1 ring-todo" : "border-line hover:border-muted/50",
                      )}
                    >
                      <span className={cx("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2", on ? "border-todo bg-todo text-white" : "border-line")}>
                        {on && <Check size={10} strokeWidth={4} />}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{o.title}</span>
                        <span className="block text-xs text-muted">{o.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {!t ? (
            <button
              onClick={() => startTimer(uid, settings, taskId, mode)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-semibold text-white hover:bg-brand/90"
            >
              <Play size={14} fill="currentColor" /> Começar
            </button>
          ) : t.phase === "focus" ? (
            <button
              onClick={() => stopTimer(uid, settings)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-surface text-[15px] font-semibold hover:bg-sunken"
            >
              <Square size={13} fill="currentColor" /> Parar e registrar
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => stopTimer(uid, settings)} className="h-12 rounded-full border border-line bg-surface font-semibold hover:bg-sunken">
                Encerrar
              </button>
              <button onClick={() => startTimer(uid, settings, t.taskId, "pomodoro")} className="h-12 rounded-full bg-brand font-semibold text-white hover:bg-brand/90">
                Próximo foco
              </button>
            </div>
          )}
        </div>
      </Panel>

      <History />
      {menu && <PomodoroMenu onClose={() => setMenu(false)} />}
    </div>
  );
}

/** Depois de um foco sem tarefa: "Em que você trabalhou?" */
export function AssignDialog() {
  const { uid, settings, sessions } = useStore();
  const options = useTaskOptions();
  const [choice, setChoice] = useState("");
  const session = sessions.find((s) => s.id === settings.pendingAssign);
  if (!settings.pendingAssign || !session) return null;

  const close = async (taskId?: string) => {
    if (taskId) await updateSession(uid, session.id, { taskId });
    await saveSettings(uid, { pendingAssign: null });
  };

  return (
    <Modal title="Em que você trabalhou?" description={`${fmtMin(session.minutes)} de foco sem tarefa. O tempo entra na tarefa escolhida; sem tarefa, conta só no seu dia.`} onClose={() => close()}>
      <fieldset className="space-y-1.5">
        <legend className="sr-only">Tarefa</legend>
        {[...options, { task: { id: "", title: "Sem tarefa por enquanto" } as Task, hint: "" }].map((o) => (
          <label
            key={o.task.id || "none"}
            className={cx(
              "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4",
              choice === o.task.id ? "border-todo bg-todo/[0.06] ring-1 ring-todo" : "border-line",
              !o.task.id && "border-dashed",
            )}
          >
            <input type="radio" name="assign" checked={choice === o.task.id} onChange={() => setChoice(o.task.id)} className="accent-[var(--brand)]" />
            <span className={cx("flex-1 text-sm font-medium", !o.task.id && "text-muted")}>{o.task.title}</span>
            {o.hint && <span className="text-xs text-muted">{o.hint}</span>}
          </label>
        ))}
      </fieldset>
      <div className="mt-5 flex justify-end">
        <Button variant="primary" onClick={() => close(choice || undefined)}>
          Salvar
        </Button>
      </div>
    </Modal>
  );
}
