"use client";

import { ChevronDown, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { entryTimes, fmtMin, shiftDay, todayKey } from "@/lib/dates";
import { addSession, deleteSession, saveSettings, setDayEstimate, setSkipped, updateTask } from "@/lib/db";
import { isTimeTask, type DayItem, type DayMetrics } from "@/lib/metrics";
import { slotsOf } from "@/lib/schedule";
import type { DayWindow } from "@/lib/types";
import { useStore } from "./store";
import { useToast } from "./toast";
import { Button, Modal, Panel, TimeSelect, cx } from "./ui";

/** Segmentos do horário: feito | passou sem registro | a fazer (o que cabe) | sobra; e o que não cabe, depois do fim. */
function segments(m: DayMetrics) {
  const used = Math.max(m.doneMin, m.elapsedMin);
  const room = Math.max(0, m.capacityMin - used);
  const fits = Math.min(m.remainingMin, room);
  return { done: m.doneMin, idle: m.idleMin, fits, excess: m.remainingMin - fits, free: Math.max(0, m.freeMin) };
}

/**
 * A barra do dia como linha do tempo: do início ao fim do seu horário, com "agora" marcado.
 * À esquerda do "agora", o que já passou (feito ou sem registro); à direita, o que vem.
 * O que não cabe aparece depois da marca do fim, para ficar claro que passa do horário.
 */
function TimelineBar({ m, isToday }: { m: DayMetrics; isToday: boolean }) {
  const s = segments(m);
  const inside = Math.max(1, s.done + s.idle + s.fits + s.free);
  const total = inside + s.excess;
  const pct = (v: number) => (v / total) * 100;
  const endPct = pct(inside);
  const showNow = isToday && m.elapsedMin > 0 && m.leftMin > 0;
  const nowPct = pct(Math.min(m.elapsedMin, inside));
  // Rótulos a menos de ~30% de distância se sobrepõem no celular; aí mostra só o "agora".
  const near = (a: number, b: number) => Math.abs(a - b) < 30;
  const hhmm = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mt-4">
      <div className="relative">
        <div className="flex h-3.5 w-full">
          <div className="flex h-full gap-px overflow-hidden rounded-l-full bg-sunken" style={{ width: `${endPct}%` }}>
            <div className="bg-done" style={{ width: `${(s.done / inside) * 100}%` }} />
            <div className="bg-idle" style={{ width: `${(s.idle / inside) * 100}%` }} />
            <div className="bg-todo" style={{ width: `${(s.fits / inside) * 100}%` }} />
            <div className="hatch" style={{ width: `${(s.free / inside) * 100}%` }} />
          </div>
          {s.excess > 0 && <div className="ml-px h-full rounded-r-full bg-over" style={{ width: `${pct(s.excess)}%` }} />}
        </div>
        {/* Fim do horário */}
        <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-ink/70" style={{ left: `calc(${endPct}% - 1px)` }} />
        {/* Agora */}
        {showNow && <div className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded bg-ink" style={{ left: `calc(${nowPct}% - 1px)` }} />}
      </div>
      <div className="tabular relative mt-1.5 h-4 text-[11px] text-muted">
        {!(showNow && nowPct < 30) && <span className="absolute left-0">{m.window!.start}</span>}
        {showNow && (
          <span className="absolute font-semibold text-ink" style={{ left: `${nowPct}%`, transform: `translateX(${nowPct < 8 ? "0" : nowPct > 92 ? "-100%" : "-50%"})` }}>
            agora {hhmm}
          </span>
        )}
        {!(showNow && near(nowPct, endPct)) && (
          <span className="absolute" style={{ left: `${endPct}%`, transform: `translateX(${endPct > 85 ? "-100%" : "-50%"})` }}>
            {m.window!.end}
          </span>
        )}
        {s.excess > 0 && endPct < 85 && <span className="absolute right-0 font-semibold text-over">+{fmtMin(s.excess)}</span>}
      </div>
    </div>
  );
}

function Key({ swatch, label, value, text }: { swatch: string; label: string; value: number; text: string }) {
  return (
    <li className="flex gap-2">
      <span className={cx("mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]", swatch)} />
      <span>
        <b className="font-semibold text-ink">
          {label} <span className="tabular">{fmtMin(value)}</span>
        </b>{" "}
        · {text}
      </span>
    </li>
  );
}

/** Responde as duas perguntas do app: quanto tempo ainda tenho e se dá tempo. */
export function DayBudget({ m }: { m: DayMetrics }) {
  const { uid, settings } = useStore();
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(false);
  const [filling, setFilling] = useState(false);
  const [draft, setDraft] = useState<DayWindow>({ start: "08:00", end: "18:00" });
  const s = segments(m);
  const isToday = m.date === todayKey();
  const custom = m.date in settings.windowOverrides;
  const late = s.excess > 0;
  const ended = !!m.window && m.leftMin === 0;

  async function saveOverride(w: DayWindow | null) {
    await saveSettings(uid, { windowOverrides: { ...settings.windowOverrides, [m.date]: w } });
    setEditing(false);
  }
  async function resetOverride() {
    const next = { ...settings.windowOverrides };
    delete next[m.date];
    await saveSettings(uid, { windowOverrides: next });
    setEditing(false);
  }

  // Uma linha que responde a pergunta do app; o resto é detalhe.
  let headline: string;
  let detail = "";
  if (!m.window) {
    headline = isToday ? "Hoje sem horário" : "Dia sem horário";
    detail = "Sem horário para tarefas neste dia.";
  } else if (ended) {
    headline = `${fmtMin(m.doneMin)} feitos`;
    detail = "Dia encerrado.";
  } else {
    headline = late ? `Não dá tempo: ${fmtMin(s.excess)} a mais` : `Dá tempo: sobram ${fmtMin(m.freeMin)}`;
    const room = isToday ? `${late ? "só " : ""}${fmtMin(m.leftMin)} até as ${m.window.end}` : `${fmtMin(m.capacityMin)} de horário neste dia`;
    detail = `Você tem ${fmtMin(m.remainingMin)} de tarefas e ${room}.`;
  }
  const where = isToday ? "hoje" : "neste dia";

  return (
    <Panel className="p-5">
      <p
        className={cx(
          "tabular text-[22px] leading-tight font-semibold tracking-tight sm:text-[32px]",
          late ? "text-over" : m.window && !ended ? "text-done" : "text-ink",
        )}
      >
        {headline}
      </p>
      <p className="mt-1 text-sm text-muted">{detail}</p>

      {/* Horário do dia: texto pequeno, com edição só deste dia. */}
      {editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <TimeSelect label="Início" value={draft.start} onChange={(v) => setDraft({ ...draft, start: v })} />
          <span>até</span>
          <TimeSelect label="Fim" value={draft.end} onChange={(v) => setDraft({ ...draft, end: v })} />
          <Button size="sm" variant="primary" onClick={() => saveOverride(draft)}>
            Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => saveOverride(null)}>
            Sem horário
          </Button>
          {custom && (
            <Button size="sm" variant="ghost" onClick={resetOverride}>
              Voltar ao padrão
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted">
          {m.window ? `Seu horário ${where}: ${m.window.start}–${m.window.end} (${fmtMin(m.capacityMin)})` : `Sem horário ${where}`}
          {custom && ` · alterado só ${where}`}
          {" · "}
          <button
            className="font-medium text-brand hover:underline"
            onClick={() => {
              setDraft(m.window ?? { start: "08:00", end: "18:00" });
              setEditing(true);
            }}
          >
            Mudar
          </button>
        </p>
      )}

      {m.window && <TimelineBar m={m} isToday={isToday} />}

      {/* Ações: o que dá para fazer com o que a barra mostra. */}
      {m.window && s.idle >= 5 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-sunken px-3 py-2.5">
          <span className="min-w-0 flex-1 text-[13px] text-muted">
            <b className="tabular font-semibold text-ink">{fmtMin(s.idle)}</b> já passaram sem nada registrado.
          </span>
          <Button size="sm" variant="secondary" onClick={() => setFilling(true)}>
            O que você fez?
          </Button>
        </div>
      )}
      {late && !ended && <WhatToDrop m={m} excess={s.excess} />}

      {m.window && (
        <div className="mt-3">
          <button onClick={() => setDetails((v) => !v)} aria-expanded={details} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
            <ChevronDown size={14} className={cx("transition-transform", !details && "-rotate-90")} />
            Detalhes
          </button>
          {details && (
            <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
              <Key swatch="bg-done" label="Feito" value={s.done} text="tempo registrado nas tarefas (timer, pomodoro ou à mão)." />
              <Key swatch="bg-idle" label="Sem registro" value={s.idle} text="tempo do seu horário que já passou sem nada registrado." />
              <Key swatch="bg-todo" label="A fazer" value={s.fits} text="o que falta das tarefas e ainda cabe até o fim do horário." />
              {s.excess > 0 && <Key swatch="bg-over" label="Não cabe" value={s.excess} text="o que falta e passa do fim do horário." />}
              <Key swatch="hatch" label="Sobra" value={s.free} text="tempo do horário que fica livre depois das tarefas." />
              {m.outsideMin > 0 && (
                <li className="pl-[18px]">
                  <b className="font-semibold text-break">Extra {fmtMin(m.outsideMin)}</b> · tarefas com horário fora do seu horário; não entram na conta.
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {filling && <FillGapDialog m={m} onClose={() => setFilling(false)} />}
    </Panel>
  );
}

/**
 * Quando não cabe: o que dá para tirar de hoje, com um toque.
 * Tarefa por tempo (ex: trabalhar 7h) é encurtada só hoje; as outras são puladas ou vão para amanhã.
 * Primeiro as sem horário, as maiores antes.
 */
function WhatToDrop({ m, excess }: { m: DayMetrics; excess: number }) {
  const { uid, settings } = useStore();
  const toast = useToast();
  const tomorrow = shiftDay(m.date, 1);
  const t = settings.activeTimer;
  const runningId = t && t.phase === "focus" && !t.waiting ? t.taskId : null;
  const candidates = m.items
    // Não sugere tirar de hoje o que você está fazendo agora (encurtar, sim).
    .filter((i) => !i.completed && !i.skipped && !i.outside && i.remainingMin > 0 && (i.task.id !== runningId || isTimeTask(i.task)))
    .sort((a, b) => Number(slotsOf(a.task).length > 0) - Number(slotsOf(b.task).length > 0) || b.remainingMin - a.remainingMin)
    .slice(0, 4);
  if (!candidates.length) return null;

  // Cada ação avisa e pode ser desfeita.
  const action = (i: DayItem) => {
    if (isTimeTask(i.task)) {
      const to = i.estimateMin - Math.min(i.remainingMin, excess);
      const before = i.task.estimateFor?.[m.date] ?? null;
      return {
        label: `Encurtar para ${fmtMin(to)}`,
        run: () => {
          setDayEstimate(uid, i.task, m.date, to);
          toast(`${i.task.title}: ${fmtMin(to)} só hoje`, { tone: "info", undo: () => setDayEstimate(uid, i.task, m.date, before) });
        },
      };
    }
    if (i.task.repeat === "weekdays")
      return {
        label: "Pular hoje",
        run: () => {
          setSkipped(uid, i.task, m.date, true);
          toast(`${i.task.title} pulada hoje`, { tone: "info", undo: () => setSkipped(uid, i.task, m.date, false) });
        },
      };
    const before = i.task.date ?? m.date;
    return {
      label: "Amanhã",
      run: () => {
        updateTask(uid, i.task.id, { date: tomorrow });
        toast(`${i.task.title} foi para amanhã`, { tone: "info", undo: () => updateTask(uid, i.task.id, { date: before }) });
      },
    };
  };

  return (
    <div className="mt-3 rounded-xl bg-over/[0.06] p-3">
      <p className="text-[13px] font-medium text-ink">Para dar tempo, tire {fmtMin(excess)} de hoje:</p>
      <ul className="mt-2 space-y-1">
        {candidates.map((i) => {
          const a = action(i);
          return (
            <li key={i.task.id} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{i.task.title}</span>
              <span className="tabular shrink-0 text-xs text-muted">falta {fmtMin(i.remainingMin)}</span>
              <button onClick={a.run} className="h-8 shrink-0 rounded-full border border-line bg-surface px-3 text-[13px] font-medium hover:bg-sunken">
                {a.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** "O que você fez?": distribui o tempo que passou sem registro entre as tarefas do dia. */
function FillGapDialog({ m, onClose }: { m: DayMetrics; onClose: () => void }) {
  const { uid } = useStore();
  const toast = useToast();
  const gap = m.idleMin;
  const items = m.items.filter((i) => !i.skipped && !i.outside);
  const [mins, setMins] = useState<Record<string, number>>({});
  const given = Object.values(mins).reduce((a, v) => a + v, 0);
  const left = gap - given;
  const set = (id: string, v: number) => setMins((x) => ({ ...x, [id]: Math.max(0, v) }));

  async function save() {
    const entries = Object.entries(mins).filter(([, v]) => v > 0);
    const ids = await Promise.all(entries.map(([taskId, minutes]) => addSession(uid, { taskId, date: m.date, minutes, kind: "manual", ...entryTimes({ minutes }, m.date) })));
    if (entries.length)
      toast(`${fmtMin(given)} registrados em ${entries.length === 1 ? "1 tarefa" : `${entries.length} tarefas`}`, {
        undo: () => Promise.all(ids.map((id) => deleteSession(uid, id))),
      });
    onClose();
  }

  return (
    <Modal title="O que você fez?" description={`${fmtMin(gap)} do seu horário passaram sem nada registrado. Diga em que tarefas foi esse tempo.`} onClose={onClose}>
      <p className={cx("tabular mb-3 text-sm font-medium", left < 0 ? "text-over" : left === 0 ? "text-done" : "text-muted")}>
        {left > 0 ? `Falta distribuir ${fmtMin(left)}` : left === 0 ? "Tudo distribuído" : `${fmtMin(-left)} a mais do que passou`}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma tarefa neste dia.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {items.map((i) => {
            const v = mins[i.task.id] ?? 0;
            return (
              <li key={i.task.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{i.task.title}</span>
                  <span className="tabular text-xs text-muted">
                    feito {fmtMin(i.doneMin)} de {fmtMin(i.estimateMin)}
                  </span>
                </span>
                {left > 0 && v === 0 && (
                  <button onClick={() => set(i.task.id, left)} className="shrink-0 text-xs font-medium text-brand hover:underline">
                    Tudo aqui
                  </button>
                )}
                <span className="flex shrink-0 items-center rounded-lg border border-line">
                  <button onClick={() => set(i.task.id, v - 15)} className="grid h-8 w-8 place-items-center text-muted hover:text-ink" aria-label="Menos 15 minutos">
                    <Minus size={14} />
                  </button>
                  <span className="tabular w-12 text-center text-sm font-semibold">{v ? fmtMin(v) : "–"}</span>
                  <button onClick={() => set(i.task.id, v + 15)} className="grid h-8 w-8 place-items-center text-muted hover:text-ink" aria-label="Mais 15 minutos">
                    <Plus size={14} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={save} disabled={given === 0}>
          Registrar {given > 0 ? fmtMin(given) : ""}
        </Button>
      </div>
    </Modal>
  );
}
