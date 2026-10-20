"use client";

import { Bell, Check, Download, Minus, MoreHorizontal, Pause, Pencil, Play, Plus, RotateCcw, SkipForward, Trash2 } from "lucide-react";
import { useState } from "react";
import { saveSettings } from "@/lib/db";
import { fmtMin, todayKey } from "@/lib/dates";
import { dayItems } from "@/lib/metrics";
import { dayClock } from "@/lib/schedule";
import {
  addPomoTask,
  clearPomoTasks,
  notImported,
  countToday,
  importTasks,
  isRunning,
  listSummary,
  pausePomodoro,
  removePomoTask,
  selectTask,
  skipPhase,
  startPomodoro,
  suggestPomodoros,
  switchPhase,
  updatePomoTask,
} from "@/lib/pomodoro";
import { useStore } from "./store";
import { useToast } from "./toast";
import { pomodoroDisplay, pomodoroLabel, useNow } from "./Timer";
import { Button, IconButton, Modal, Switch, cx, inputCls } from "./ui";

/**
 * Foco: o pomodoro como recurso avulso, no estilo do Pomofocus.
 * Não registra tempo. Pode apontar a tarefa em que está focando, só para contar pomodoros nela.
 * O cronômetro (que registra) aparece só na barra flutuante.
 */
export function FocusView() {
  const { uid, settings } = useStore();
  const now = useNow();
  const p = settings.pomodoro;
  const [menu, setMenu] = useState(false);
  const phase = p?.phase ?? "focus";
  const brk = phase === "break";
  const running = isRunning(p);
  const paused = !!p && p.pausedLeftMs !== undefined;
  // Fase esperando o Começar mostra o tempo atual da configuração (mudou de 25 para 50? aparece 50:00 na hora).
  const shown = p?.waiting ? { ...p, durationMin: phase === "break" ? settings.breakMin : settings.focusMin } : p;
  const pd = shown ? pomodoroDisplay(shown, now) : null;
  const clock = pd?.text ?? `${String(settings.focusMin).padStart(2, "0")}:00`;
  const done = countToday(p);
  const focusTask = (settings.pomodoroTasks ?? []).find((t) => t.id === p?.taskId);

  const tab = (value: "focus" | "break", label: string) => (
    <button
      onClick={() => value !== phase || running || paused ? switchPhase(uid, settings, value) : undefined}
      aria-pressed={phase === value}
      className={cx("rounded-lg px-5 py-1.5 text-sm font-semibold transition-colors", phase === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-md flex-col items-center justify-center gap-6 lg:min-h-[calc(100dvh-5rem)]">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Pomodoro</h2>
        <IconButton label="Configurar pomodoro" onClick={() => setMenu(true)}>
          <MoreHorizontal size={18} />
        </IconButton>
      </div>

      <div className="inline-flex gap-1 rounded-xl bg-sunken p-1">
        {tab("focus", "Foco")}
        {tab("break", "Pausa")}
      </div>

      {/* O anel vai se preenchendo; azul no foco, verde na pausa. */}
      <div className={brk ? "text-done" : "text-todo"}>
        <Ring pct={pd ? pd.pct : 0} size={280}>
          <span className="tabular text-[72px] leading-none font-semibold tracking-tight text-ink">{clock}</span>
          <span className="mt-3 text-sm text-muted">{p ? pomodoroLabel(p) : "Pronto para focar"}</span>
        </Ring>
      </div>

      <div className="flex w-full items-center justify-center gap-3">
        <button
          onClick={() => (running ? pausePomodoro(uid, settings) : startPomodoro(uid, settings))}
          className={cx(
            "flex h-14 flex-1 items-center justify-center gap-2 rounded-full text-base font-semibold transition-colors",
            running ? "border border-line bg-surface text-ink hover:bg-sunken" : "bg-brand text-brand-ink hover:bg-brand/90",
          )}
        >
          {running ? <Pause size={16} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          {running ? "Pausar" : paused ? "Continuar" : brk ? "Começar pausa" : "Começar foco"}
        </button>
        {(running || paused) && (
          <IconButton label={brk ? "Pular pausa" : "Pular para a pausa"} onClick={() => skipPhase(uid, settings)} className="h-14 w-14 rounded-full border border-line bg-surface">
            <SkipForward size={20} />
          </IconButton>
        )}
      </div>

      <div className="text-center">
        <p className="tabular text-sm text-muted">#{brk ? done : done + 1}</p>
        <p className="mt-0.5 font-semibold">{brk ? "Hora da pausa!" : (focusTask?.title ?? "Hora de focar!")}</p>
        {done > 0 && <p className="mt-1 text-xs text-muted">{done === 1 ? "1 pomodoro hoje" : `${done} pomodoros hoje`}</p>}
      </div>

      {(running || paused) && (
        <button onClick={() => switchPhase(uid, settings, "focus")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
          <RotateCcw size={13} /> Zerar
        </button>
      )}

      <FocusTasks />

      {menu && <PomodoroMenu onClose={() => setMenu(false)} />}
    </div>
  );
}

/**
 * Lista de tarefas do pomodoro, como no Pomofocus: nome, pomodoros feitos / estimados (a pessoa decide),
 * escolher em qual está focando e "Termina às". Independente das tarefas do app; dá para importar as de hoje.
 * Só conta pomodoros: não registra nem muda horas.
 */
function FocusTasks() {
  const { uid, settings, tasks, blocks, sessions } = useStore();
  const toast = useToast();
  const now = useNow(60000);
  const p = settings.pomodoro;
  const list = settings.pomodoroTasks ?? [];
  const [form, setForm] = useState<{ id?: string; title: string; est: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const sum = listSummary(list, settings, now);

  // Tarefas abertas de hoje no app, e quais ainda não estão na lista (as apagadas da lista voltam a aparecer aqui).
  // Com o horário do dia, para saber o que é "extra" (fora do seu horário).
  const day = todayKey();
  const today = dayItems(day, tasks, blocks, sessions, dayClock(settings, day, new Date(now)).window)
    .filter((i) => !i.completed && !i.skipped)
    .map((i) => ({ id: i.task.id, title: i.task.title, minutes: i.remainingMin || i.estimateMin, outside: i.outside }));
  const candidates = notImported(settings, today);
  const pending = candidates.length;
  const [picking, setPicking] = useState(false);

  function importToday() {
    setMenu(false);
    setPicking(true);
  }
  function save() {
    if (!form || !form.title.trim()) return;
    if (form.id) updatePomoTask(uid, settings, form.id, { title: form.title.trim(), est: form.est });
    else addPomoTask(uid, settings, form.title, form.est);
    setForm(null);
  }

  const formBox = (
    <div className="rounded-xl border border-line bg-surface p-3">
      <input
        autoFocus
        className={inputCls}
        value={form?.title ?? ""}
        onChange={(e) => setForm((f) => f && { ...f, title: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="Em que você vai focar?"
        aria-label="Nome da tarefa"
      />
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[13px] font-medium">Pomodoros estimados</span>
        <span className="flex items-center rounded-lg border border-line">
          <IconButton label="Menos um" type="button" onClick={() => setForm((f) => f && { ...f, est: Math.max(1, f.est - 1) })} className="h-9 w-9 rounded-r-none">
            <Minus size={14} />
          </IconButton>
          <span className="tabular w-8 text-center font-semibold">{form?.est}</span>
          <IconButton label="Mais um" type="button" onClick={() => setForm((f) => f && { ...f, est: Math.min(99, f.est + 1) })} className="h-9 w-9 rounded-l-none">
            <Plus size={14} />
          </IconButton>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        {form?.id && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              const removed = list.find((t) => t.id === form.id);
              removePomoTask(uid, settings, form.id!);
              setForm(null);
              if (removed) toast(`${removed.title} saiu da lista`, { tone: "info", undo: () => saveSettings(uid, { pomodoroTasks: list }) });
            }}
          >
            Apagar
          </Button>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => setForm(null)}>
          Cancelar
        </Button>
        <Button size="sm" variant="primary" onClick={save} disabled={!form?.title.trim()}>
          Salvar
        </Button>
      </div>
    </div>
  );

  return (
    <section className="w-full">
      <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
        <h3 className="text-sm font-semibold">Tarefas</h3>
        <div className="relative">
          <IconButton label="Opções da lista" onClick={() => setMenu((v) => !v)}>
            <MoreHorizontal size={16} />
          </IconButton>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div className="absolute right-0 bottom-full z-50 mb-1 w-60 rounded-xl border border-line bg-surface p-1 shadow-xl">
                {pending > 0 && (
                  <MenuItem onClick={importToday}>
                    <Download size={15} /> Importar tarefas de hoje ({pending})
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    setMenu(false);
                    clearPomoTasks(uid, settings, true);
                  }}
                >
                  <Check size={15} /> Limpar concluídas
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setMenu(false);
                    clearPomoTasks(uid, settings, false);
                    toast("Lista limpa", { tone: "info", undo: () => saveSettings(uid, { pomodoroTasks: list }) });
                  }}
                >
                  <Trash2 size={15} /> Limpar tudo
                </MenuItem>
              </div>
            </>
          )}
        </div>
      </div>

      <ul className="space-y-1.5">
        {list.map((t) =>
          form?.id === t.id ? (
            <li key={t.id}>{formBox}</li>
          ) : (
            <li
              key={t.id}
              className={cx(
                "flex items-center gap-2 rounded-xl border bg-surface pr-1 pl-2 transition-colors",
                p?.taskId === t.id ? "border-todo border-l-4" : "border-line",
              )}
            >
              <button
                onClick={() => updatePomoTask(uid, settings, t.id, { checked: !t.checked })}
                aria-label={t.checked ? "Desmarcar" : "Concluir"}
                className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", t.checked ? "border-done bg-done text-white" : "border-line hover:border-done")}
              >
                {t.checked && <Check size={13} strokeWidth={3} />}
              </button>
              <button onClick={() => selectTask(uid, settings, t.id)} aria-pressed={p?.taskId === t.id} className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left text-sm" title="Focar nesta">
                <span className={cx("min-w-0 flex-1 truncate", p?.taskId === t.id && "font-semibold", t.checked && "text-muted line-through")}>{t.title}</span>
                <span className={cx("tabular shrink-0", t.done > t.est ? "text-break" : "text-muted")} title={t.done > t.est ? "Passou da estimativa" : undefined}>
                  <b className={cx("font-semibold", t.done > t.est ? "text-break" : "text-ink")}>{t.done}</b>/{t.est}
                </span>
              </button>
              <IconButton label="Editar" onClick={() => setForm({ id: t.id, title: t.title, est: t.est })}>
                <Pencil size={14} />
              </IconButton>
            </li>
          ),
        )}
      </ul>

      {form && !form.id ? (
        <div className="mt-1.5">{formBox}</div>
      ) : (
        // Os dois caminhos sempre à vista; importar só aparece quando há algo novo de hoje.
        <div className={cx("mt-1.5 grid gap-1.5", pending > 0 && "grid-cols-2")}>
          <button
            onClick={() => setForm({ title: "", est: 1 })}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-2 text-sm font-semibold text-muted hover:border-muted/50 hover:text-ink"
          >
            <Plus size={16} className="shrink-0" /> Adicionar tarefa
          </button>
          {pending > 0 && (
            <button
              onClick={importToday}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-2 text-sm font-semibold text-muted hover:border-muted/50 hover:text-ink"
            >
              <Download size={16} className="shrink-0" /> Importar de hoje ({pending})
            </button>
          )}
        </div>
      )}

      {sum.est > 0 && (
        <p className="mt-3 rounded-xl bg-sunken px-4 py-3 text-center text-sm text-muted">
          Pomodoros <b className="tabular text-base font-semibold text-ink">{sum.done}</b>/<span className="tabular">{sum.est}</span>
          {sum.leftMin > 0 && (
            <>
              {" "}· Termina às{" "}
              <b className="tabular text-base font-semibold text-ink">{sum.finishAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</b>{" "}
              <span className="tabular">({fmtMin(sum.leftMin)})</span>
            </>
          )}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">Só conta pomodoros. As horas da tarefa vêm do ▶ no Dia.</p>
      {picking && (
        <ImportDialog
          candidates={candidates}
          onClose={() => setPicking(false)}
          onImport={async (chosen, leftOut) => {
            setPicking(false);
            const n = await importTasks(uid, settings, chosen, leftOut);
            if (n) toast(`${n === 1 ? "1 tarefa importada" : `${n} tarefas importadas`}. Ajuste os pomodoros se quiser.`, "info");
          }}
        />
      )}
    </section>
  );
}

type Candidate = { id: string; title: string; minutes: number; outside: boolean };

/**
 * Escolher quais tarefas de hoje entram na lista do pomodoro. As "extra" (fora do seu horário, ex: academia)
 * já vêm desmarcadas; as desmarcadas ficam de fora até amanhã.
 */
function ImportDialog({ candidates, onClose, onImport }: { candidates: Candidate[]; onClose: () => void; onImport: (chosen: Candidate[], leftOut: string[]) => void }) {
  const { settings } = useStore();
  const [on, setOn] = useState<Set<string>>(() => new Set(candidates.filter((c) => !c.outside).map((c) => c.id)));
  const toggle = (id: string) =>
    setOn((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chosen = candidates.filter((c) => on.has(c.id));
  return (
    <Modal title="Importar tarefas de hoje" description="Escolha as que vão para o pomodoro. As desmarcadas ficam de fora até amanhã." onClose={onClose}>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {candidates.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-3 text-sm hover:bg-sunken">
              <input type="checkbox" checked={on.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 shrink-0 accent-[var(--brand)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.title}</span>
                {c.outside && <span className="text-xs text-break">extra · fora do seu horário</span>}
              </span>
              <span className="tabular shrink-0 text-xs text-muted">~{suggestPomodoros(c.minutes, settings)} pomodoros</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={() => onImport(chosen, candidates.filter((c) => !on.has(c.id)).map((c) => c.id))}
        >
          {chosen.length ? `Importar ${chosen.length}` : "Deixar todas de fora"}
        </Button>
      </div>
    </Modal>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-sunken [&>svg]:text-muted">
      {children}
    </button>
  );
}

function Ring({ pct, size = 300, children }: { pct: number; size?: number; children: React.ReactNode }) {
  const stroke = 10;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const fill = pct / 100;
  const mid = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--sunken)" strokeWidth={stroke} />
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fill)}
          transform={`rotate(-90 ${mid} ${mid})`}
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
      <div className="mt-5 border-t border-line pt-3">
        <Switch label="Início de foco automático" checked={!!settings.autoStartFocus} onChange={(v) => saveSettings(uid, { autoStartFocus: v })} />
        <Switch label="Pausas automáticas" checked={!!settings.autoStartBreaks} onChange={(v) => saveSettings(uid, { autoStartBreaks: v })} />
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

