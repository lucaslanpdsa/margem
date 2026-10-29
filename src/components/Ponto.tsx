"use client";

import { Briefcase, LogIn, LogOut, Pause, Pencil, Play, Plus, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { WEEKDAY_SHORT, fmtMin, parseDuration, todayKey, weekDays } from "@/lib/dates";
import { saveSettings, setPunches, updateTask } from "@/lib/db";
import type { DayMetrics } from "@/lib/metrics";
import { hhmm, punchesFromSessions, weekWork, workFromTask } from "@/lib/ponto";
import type { DayWindow, Task, WorkConfig } from "@/lib/types";
import { PlanDayDialog } from "./PlanClose";
import { useStore } from "./store";
import { useToast } from "./toast";
import { Button, Modal, Panel, TimeSelect, cx, inputCls } from "./ui";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
/** "Seu dia" sugerido quando o trabalho vira ponto: o tempo acordado, com o trabalho dentro. */
const WHOLE_DAY: DayWindow = { start: "07:00", end: "23:00" };

const isoAt = (date: string, hm: string) => new Date(`${date}T${hm}:00`).toISOString();
const hmOf = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** A tarefa que dá para transformar em ponto: "cumpro o tempo", que repete, ativa (ex: Trabalho 7h seg–sex). */
export const workTaskCandidate = (tasks: Task[]) => tasks.find((t) => t.doneBy === "time" && t.repeat === "weekdays" && !t.archived);

/**
 * Cartão do ponto no Dia (hoje): o estado, quanto trabalhou, a saída prevista e o botão da próxima marcação.
 * Entrar abre o "Planejar o dia" se ainda não planejou.
 */
export function PontoCard({ m }: { m: DayMetrics }) {
  const { uid, settings, days } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [setup, setSetup] = useState(false);
  const [planning, setPlanning] = useState(false);
  const today = todayKey();
  const work = settings.work;
  if (!work || m.date !== today) return null;
  const w = m.work;
  const day = days[today];
  const punches = day?.punches ?? [];
  const week = weekWork(work, weekDays(today), days, new Date());

  const punch = (end = false) => {
    const next = [...punches, new Date().toISOString()];
    setPunches(uid, today, next, end);
    toast(end ? "Saída marcada. O resto do dia é seu." : next.length % 2 ? "Entrada marcada" : "Pausa marcada", {
      tone: "info",
      undo: () => setPunches(uid, today, punches, !!day?.workEnded),
    });
    if (next.length === 1 && !day?.plannedAt) setPlanning(true);
  };
  const resume = () => {
    const next = [...punches, new Date().toISOString()];
    setPunches(uid, today, next, false);
    toast("Voltou ao trabalho", { tone: "info", undo: () => setPunches(uid, today, punches, !!day?.workEnded) });
  };

  const state = w?.state ?? "fora";
  const title =
    !w || (state === "fora" && w.plannedMin === 0)
      ? "Hoje não é dia de trabalho"
      : state === "fora"
        ? `Jornada de ${fmtMin(w.plannedMin)} · entrada às ${work.start}`
        : state === "trabalhando"
          ? `Trabalhando · ${fmtMin(w.workedMin)} de ${fmtMin(w.plannedMin)}`
          : state === "pausa"
            ? `Em pausa · ${fmtMin(w.workedMin)} de ${fmtMin(w.plannedMin)}`
            : `Trabalho encerrado · ${fmtMin(w.workedMin)}`;
  const diff = w && state === "encerrado" && w.plannedMin ? w.workedMin - w.plannedMin : 0;

  return (
    <Panel className="p-5">
      <div className="flex items-start gap-3">
        <Briefcase size={18} className={cx("mt-0.5 shrink-0", state === "trabalhando" ? "text-todo" : "text-muted")} />
        <div className="min-w-0 flex-1">
          <p className="tabular text-[15px] font-semibold">{title}</p>
          <p className="tabular mt-0.5 text-[13px] text-muted">
            {w?.exitAt != null && state !== "encerrado" && w.leftMin > 0 && <>Saída prevista {hhmm(w.exitAt)} · faltam {fmtMin(w.leftMin)}</>}
            {state === "encerrado" && w?.plannedMin ? (diff === 0 ? "Jornada cumprida" : diff > 0 ? `${fmtMin(diff)} a mais que a jornada` : `${fmtMin(-diff)} a menos que a jornada`) : null}
          </p>
          {punches.length > 0 && (
            <button onClick={() => setEditing(true)} className="tabular mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink" title="Corrigir marcações">
              {punches.map(hmOf).join(" · ")} <Pencil size={11} />
            </button>
          )}
        </div>
        <button onClick={() => setSetup(true)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink" aria-label="Jornada do ponto" title="Jornada">
          <Settings2 size={15} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state === "fora" && (
          <Button variant="primary" onClick={() => punch()}>
            <LogIn size={15} /> Entrar
          </Button>
        )}
        {state === "trabalhando" && (
          <>
            <Button variant="secondary" onClick={() => punch()}>
              <Pause size={15} /> Pausar
            </Button>
            <Button variant="secondary" onClick={() => punch(true)}>
              <LogOut size={15} /> Sair
            </Button>
          </>
        )}
        {(state === "pausa" || state === "encerrado") && (
          <Button variant={state === "pausa" ? "primary" : "ghost"} onClick={resume}>
            <Play size={15} /> {state === "pausa" ? "Voltar" : "Voltar ao trabalho"}
          </Button>
        )}
        {state === "pausa" && (
          <Button
            variant="ghost"
            onClick={() => {
              setPunches(uid, today, punches, true);
              toast("Trabalho encerrado. O resto do dia é seu.", { tone: "info", undo: () => setPunches(uid, today, punches, false) });
            }}
          >
            Encerrar o dia
          </Button>
        )}
        {!punches.length && (
          <button onClick={() => setEditing(true)} className="text-[13px] font-medium text-accent hover:underline">
            Esqueci de marcar
          </button>
        )}
      </div>

      <p className="tabular mt-3 border-t border-line pt-2.5 text-xs text-muted">
        Semana: <b className="font-semibold text-ink">{fmtMin(week.workedMin)}</b> de {fmtMin(week.plannedMin)}
        {week.balanceMin !== 0 && (
          <>
            {" · saldo "}
            <b className={cx("font-semibold", week.balanceMin > 0 ? "text-done" : "text-over")}>
              {week.balanceMin > 0 ? "+" : "−"}
              {fmtMin(Math.abs(week.balanceMin))}
            </b>
          </>
        )}
      </p>

      {editing && <PunchEditor date={today} onClose={() => setEditing(false)} />}
      {setup && <WorkSetupDialog onClose={() => setSetup(false)} />}
      {planning && <PlanDayDialog onClose={() => setPlanning(false)} />}
    </Panel>
  );
}

/** Corrigir as marcações do dia (esqueceu de bater, bateu errado). Entrada e saída se alternam. */
export function PunchEditor({ date, onClose }: { date: string; onClose: () => void }) {
  const { uid, days } = useStore();
  const toast = useToast();
  const before = days[date]?.punches ?? [];
  const [times, setTimes] = useState<string[]>(() => before.map(hmOf));
  const [ended, setEnded] = useState(!!days[date]?.workEnded);

  function save() {
    const clean = times.filter(Boolean).sort();
    setPunches(uid, date, clean.map((t) => isoAt(date, t)), ended && clean.length % 2 === 0);
    toast("Marcações salvas", { tone: "info", undo: () => setPunches(uid, date, before, !!days[date]?.workEnded) });
    onClose();
  }

  return (
    <Modal title="Marcações do dia" description="Entrada e saída se alternam. Pausa = uma saída e uma entrada." onClose={onClose}>
      <ul className="space-y-2">
        {times.map((t, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 text-muted">{i % 2 ? "Saída" : "Entrada"}</span>
            <input type="time" value={t} onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))} className={cx(inputCls, "h-9 w-32")} aria-label={i % 2 ? "Saída" : "Entrada"} />
            <button onClick={() => setTimes(times.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-over" aria-label="Apagar marcação">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" className="mt-2" onClick={() => setTimes([...times, times.length ? "" : "08:00"])}>
        <Plus size={14} /> {times.length % 2 ? "Saída" : "Entrada"}
      </Button>
      {times.length > 0 && times.length % 2 === 0 && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ended} onChange={(e) => setEnded(e.target.checked)} /> Já encerrei o trabalho hoje
        </label>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={save}>
          Salvar
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Configurar o ponto (jornada + "Seu dia"). Com a tarefa "Trabalho" ("cumpro o tempo"), transforma ela em ponto:
 * jornada a partir dela, registros com horário viram marcações, a tarefa é desativada. Tudo desfazível.
 */
export function WorkSetupDialog({ onClose }: { onClose: () => void }) {
  const { uid, settings, tasks, sessions } = useStore();
  const toast = useToast();
  const current = settings.work;
  const from = current ? null : workTaskCandidate(tasks);
  const base: WorkConfig = current ?? (from ? workFromTask(from) : { days: [1, 2, 3, 4, 5], dailyMin: 480, start: "08:00" });
  const [days, setDays] = useState<number[]>(base.days);
  const [daily, setDaily] = useState(fmtMin(base.dailyMin));
  const [start, setStart] = useState(base.start);
  // "Seu dia" passa a ser o tempo acordado (o trabalho fica dentro dele).
  const firstWindow = settings.windows.find(Boolean) ?? null;
  const [dayStart, setDayStart] = useState(current ? (firstWindow?.start ?? WHOLE_DAY.start) : WHOLE_DAY.start);
  const [dayEnd, setDayEnd] = useState(current ? (firstWindow?.end ?? WHOLE_DAY.end) : WHOLE_DAY.end);
  const [error, setError] = useState("");

  async function save() {
    const dailyMin = parseDuration(daily);
    if (!dailyMin) return setError("Informe a jornada, por exemplo 8h ou 7h30.");
    if (!days.length) return setError("Escolha pelo menos um dia de trabalho.");
    const before = { work: settings.work ?? null, windows: settings.windows };
    const work: WorkConfig = { days: [...days].sort(), dailyMin, start, since: base.since ?? todayKey(), ...(base.taskId ? { taskId: base.taskId } : {}) };
    // "Seu dia" nos dias que já tinham horário (e nos de trabalho).
    const windows = settings.windows.map((w, d) => (w || days.includes(d) ? { start: dayStart, end: dayEnd } : null));
    await saveSettings(uid, { work, windows });
    if (from) {
      // Registros com horário viram marcações (só nos dias ainda sem marcação), e o cronômetro rodando vira entrada.
      const punches = punchesFromSessions(sessions, from.id);
      const running = settings.activeTimer?.taskId === from.id ? settings.activeTimer : null;
      if (running) {
        const t = todayKey();
        punches[t] = [...(punches[t] ?? []), running.startedAt];
        await saveSettings(uid, { activeTimer: null });
      }
      await Promise.all(Object.entries(punches).map(([d, p]) => setPunches(uid, d, p, false)));
      await updateTask(uid, from.id, { archived: true });
    }
    toast(from ? `${from.title} virou ponto` : "Jornada salva", {
      tone: "info",
      undo: async () => {
        await saveSettings(uid, before);
        if (from) await updateTask(uid, from.id, { archived: false });
      },
    });
    onClose();
  }

  async function turnOff() {
    const before = settings.work ?? null;
    await saveSettings(uid, { work: null });
    toast("Ponto desligado", { tone: "info", undo: () => saveSettings(uid, { work: before }) });
    onClose();
  }

  return (
    <Modal
      title={current ? "Jornada do ponto" : from ? `Transformar "${from.title}" em ponto` : "Ponto do trabalho"}
      description={
        from
          ? "O trabalho sai das tarefas: você marca entrada, pausas e saída, e as tarefas ficam com o resto do dia. A tarefa é desativada e os registros com horário viram marcações."
          : "Marque entrada, pausas e saída; as tarefas ficam com o resto do dia."
      }
      onClose={onClose}
      wide
    >
      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-1.5 font-medium">Dias de trabalho</p>
          <div className="flex flex-wrap gap-1.5">
            {ORDER.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                className={cx("h-9 w-11 rounded-lg border text-[13px] font-medium", days.includes(d) ? "border-brand/40 bg-brand/10 text-ink" : "border-line text-muted")}
                aria-pressed={days.includes(d)}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1.5 block font-medium">Jornada por dia</span>
            <input className={cx(inputCls, "w-28")} value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="8h" />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-medium">Entrada de costume</span>
            <TimeSelect label="Entrada de costume" value={start} onChange={setStart} />
          </label>
        </div>
        <div>
          <p className="mb-1.5 font-medium">Seu dia</p>
          <p className="mb-2 text-xs text-muted">De que horas a que horas você está disponível, contando o trabalho. As tarefas usam o que sobra fora dele. As pausas fixas (almoço) continuam valendo.</p>
          <div className="flex items-center gap-2 text-muted">
            <TimeSelect label="Início do dia" value={dayStart} onChange={setDayStart} />
            até
            <TimeSelect label="Fim do dia" value={dayEnd} onChange={setDayEnd} />
          </div>
        </div>
        {error && <p className="text-[13px] font-medium text-over">{error}</p>}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        {current && (
          <Button variant="ghost" className="mr-auto" onClick={turnOff}>
            Desligar o ponto
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={save}>
          {from ? "Transformar em ponto" : "Salvar"}
        </Button>
      </div>
    </Modal>
  );
}

/** Convite no Dia, uma vez: separar o trabalho num ponto (quando há uma tarefa "cumpro o tempo" que repete). */
export function PontoOffer() {
  const { uid, settings, tasks } = useStore();
  const [open, setOpen] = useState(false);
  const from = workTaskCandidate(tasks);
  if (settings.work || settings.pontoOfferDismissed || !from) return null;
  return (
    <Panel className="p-5">
      <div className="flex items-start gap-3">
        <Briefcase size={18} className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Separe o trabalho num ponto</p>
          <p className="mt-0.5 text-[13px] text-muted">
            Em vez de cronometrar &quot;{from.title}&quot; como tarefa: marque entrada, pausas e saída. O app prevê sua saída e as tarefas ficam com o resto do dia.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
              Transformar em ponto
            </Button>
            <Button size="sm" variant="ghost" onClick={() => saveSettings(uid, { pontoOfferDismissed: true })}>
              Agora não
            </Button>
          </div>
        </div>
      </div>
      {open && <WorkSetupDialog onClose={() => setOpen(false)} />}
    </Panel>
  );
}
