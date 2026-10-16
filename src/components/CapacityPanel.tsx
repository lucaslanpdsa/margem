"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { fmtMin, shiftDay, todayKey } from "@/lib/dates";
import { saveSettings, setSkipped, updateTask } from "@/lib/db";
import type { DayItem, DayMetrics } from "@/lib/metrics";
import { slotsOf } from "@/lib/schedule";
import type { DayWindow } from "@/lib/types";
import { useStore } from "./store";
import { Button, Panel, TimeSelect, cx } from "./ui";

/** Segmentos que somam o horário: feito | passou sem registro | falta (o que cabe) | não cabe | livre. */
function segments(m: DayMetrics) {
  const used = Math.max(m.doneMin, m.elapsedMin);
  const room = Math.max(0, m.capacityMin - used);
  const fits = Math.min(m.remainingMin, room);
  return {
    done: m.doneMin,
    idle: m.idleMin,
    fits,
    excess: m.remainingMin - fits,
    free: Math.max(0, m.freeMin),
  };
}

/** Barra do dia (também usada, fina, no cabeçalho da semana). */
export function CapacityBar({ m, thin }: { m: DayMetrics; thin?: boolean }) {
  const s = segments(m);
  const total = Math.max(1, s.done + s.idle + s.fits + s.excess + s.free);
  const pct = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className={cx("flex w-full gap-px overflow-hidden rounded-full bg-sunken", thin ? "h-1.5" : "h-3")}>
      <div className="bg-done" style={{ width: pct(s.done) }} />
      <div className="bg-idle" style={{ width: pct(s.idle) }} />
      <div className="bg-todo" style={{ width: pct(s.fits) }} />
      <div className="bg-over" style={{ width: pct(s.excess) }} />
      <div className="hatch" style={{ width: pct(s.free) }} />
    </div>
  );
}

function Key({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("h-2.5 w-2.5 rounded-[3px]", swatch)} />
      {label} <span className="tabular font-semibold text-ink">{fmtMin(value)}</span>
    </span>
  );
}

/** Responde as duas perguntas do app: quanto tempo ainda tenho e se estou atrasado. */
export function DayBudget({ m }: { m: DayMetrics }) {
  const { uid, settings } = useStore();
  const [editing, setEditing] = useState(false);
  const [explain, setExplain] = useState(false);
  const [draft, setDraft] = useState<DayWindow>({
    start: "08:00",
    end: "18:00",
  });
  const s = segments(m);
  const isToday = m.date === todayKey();
  const custom = m.date in settings.windowOverrides;
  const late = s.excess > 0;
  const ended = !!m.window && m.leftMin === 0;

  async function saveOverride(w: DayWindow | null) {
    await saveSettings(uid, {
      windowOverrides: { ...settings.windowOverrides, [m.date]: w },
    });
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

  return (
    <Panel className="p-5">
      <p className={cx("tabular text-[26px] leading-tight font-semibold tracking-tight sm:text-[32px]", late ? "text-over" : m.window && !ended ? "text-done" : "text-ink")}>
        {headline}
      </p>
      <p className="mt-1 text-sm text-muted">{detail}</p>

      {m.window && (
        <>
          <div className="mt-4">
            <CapacityBar m={m} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
            <Key swatch="bg-done" label="Feito" value={s.done} />
            {s.idle > 0 && <Key swatch="bg-idle" label="Sem registro" value={s.idle} />}
            <Key swatch="bg-todo" label="A fazer" value={s.fits} />
            {s.excess > 0 && <Key swatch="bg-over" label="Não cabe" value={s.excess} />}
            <Key swatch="hatch" label="Sobra" value={s.free} />
            <button
              onClick={() => setExplain((v) => !v)}
              aria-expanded={explain}
              aria-label="O que significa cada cor"
              title="O que significa cada cor"
              className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink"
            >
              <Info size={15} />
            </button>
          </div>
          {explain && (
            <ul className="mt-3 space-y-1 rounded-xl bg-sunken px-4 py-3 text-[13px] text-muted">
              <li>
                <b className="font-semibold text-ink">Feito:</b> tempo registrado hoje, mais o horário que já passou das tarefas com horário.
              </li>
              <li>
                <b className="font-semibold text-ink">Sem registro:</b> tempo do seu horário que já passou sem nada registrado.
              </li>
              <li>
                <b className="font-semibold text-ink">A fazer:</b> o que falta das tarefas de hoje e ainda cabe até o fim do horário.
              </li>
              <li>
                <b className="font-semibold text-ink">Não cabe:</b> o que falta e passa do fim do horário.
              </li>
              <li>
                <b className="font-semibold text-ink">Sobra:</b> tempo do horário que fica livre depois das tarefas.
              </li>
            </ul>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[13px] text-muted">
        {editing ? (
          <>
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
          </>
        ) : (
          <>
            <span>
              {m.window
                ? `Seu horário ${isToday ? "hoje" : "neste dia"}: ${m.window.start}–${m.window.end} (${fmtMin(m.capacityMin)})`
                : `Sem horário ${isToday ? "hoje" : "neste dia"}`}
              {custom && ` · alterado só ${isToday ? "hoje" : "neste dia"}`}
            </span>
            <button
              className="font-medium text-brand hover:underline"
              onClick={() => {
                setDraft(m.window ?? { start: "08:00", end: "18:00" });
                setEditing(true);
              }}
            >
              Mudar
            </button>
          </>
        )}
      </div>
      {m.outsideMin > 0 && <p className="mt-2 text-[13px] text-break">+ {fmtMin(m.outsideMin)} fora do horário (extra)</p>}
      {late && !ended && <WhatToDrop m={m} excess={s.excess} />}
    </Panel>
  );
}

/**
 * Quando não cabe: as tarefas que dá para tirar de hoje, com um toque.
 * Primeiro as sem horário (as com horário já têm hora marcada), as maiores antes.
 */
function WhatToDrop({ m, excess }: { m: DayMetrics; excess: number }) {
  const { uid, settings } = useStore();
  const tomorrow = shiftDay(m.date, 1);
  const t = settings.activeTimer;
  const runningId = t && t.phase === "focus" && !t.waiting ? t.taskId : null;
  // Não sugere tirar o que você está fazendo agora.
  const candidates = m.items
    .filter((i) => !i.completed && !i.skipped && !i.outside && i.remainingMin > 0 && i.task.id !== runningId)
    .sort((a, b) => Number(slotsOf(a.task).length > 0) - Number(slotsOf(b.task).length > 0) || b.remainingMin - a.remainingMin)
    .slice(0, 4);
  if (!candidates.length) return null;

  const drop = (i: DayItem) => (i.task.repeat === "weekdays" ? setSkipped(uid, i.task, m.date, true) : updateTask(uid, i.task.id, { date: tomorrow }));

  return (
    <div className="mt-4 rounded-xl bg-over/[0.06] p-3">
      <p className="text-[13px] font-medium text-ink">Para dar tempo, tire {fmtMin(excess)} de hoje:</p>
      <ul className="mt-2 space-y-1">
        {candidates.map((i) => (
          <li key={i.task.id} className="flex items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{i.task.title}</span>
            <span className="tabular shrink-0 text-xs text-muted">{fmtMin(i.remainingMin)}</span>
            <button onClick={() => drop(i)} className="h-8 shrink-0 rounded-full border border-line bg-surface px-3 text-[13px] font-medium hover:bg-sunken">
              {i.task.repeat === "weekdays" ? "Pular hoje" : "Amanhã"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
