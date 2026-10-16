"use client";

import { useState } from "react";
import { fmtMin, todayKey } from "@/lib/dates";
import { saveSettings } from "@/lib/db";
import type { DayMetrics } from "@/lib/metrics";
import type { DayWindow } from "@/lib/types";
import { useStore } from "./store";
import { Button, Panel, TimeSelect, cx } from "./ui";

/** Segmentos que somam o horário: feito | passou sem registro | falta (o que cabe) | não cabe | livre. */
function segments(m: DayMetrics) {
  const used = Math.max(m.doneMin, m.elapsedMin);
  const room = Math.max(0, m.capacityMin - used);
  const fits = Math.min(m.remainingMin, room);
  return { done: m.doneMin, idle: m.idleMin, fits, excess: m.remainingMin - fits, free: Math.max(0, m.freeMin) };
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

  let status: string;
  let headline: string;
  if (!m.window) {
    status = "Sem horário";
    headline = isToday ? "Hoje não tem horário para tarefas" : "Dia sem horário para tarefas";
  } else if (ended) {
    status = "Dia encerrado";
    headline = `${fmtMin(m.doneMin)} feitos`;
  } else if (late) {
    status = "Atrasado";
    headline = `${fmtMin(s.excess)} a mais do que cabe`;
  } else {
    status = "Em dia";
    headline = `Sobram ${fmtMin(m.freeMin)}`;
  }

  return (
    <Panel className="p-5">
      <p className={cx("text-sm font-semibold", late ? "text-over" : m.window && !ended ? "text-done" : "text-muted")}>{status}</p>
      <p className={cx("tabular mt-1 text-[32px] leading-none font-semibold tracking-tight", late && "text-over")}>{headline}</p>
      {m.window && !ended && (
        <p className="mt-2 text-sm text-muted">
          {isToday ? `Restam ${fmtMin(m.leftMin)} até as ${m.window.end}` : `${fmtMin(m.capacityMin)} de horário`} e faltam {fmtMin(m.remainingMin)} de tarefas.
        </p>
      )}

      {m.window && (
        <>
          <div className="mt-4">
            <CapacityBar m={m} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
            <Key swatch="bg-done" label="Feito" value={s.done} />
            {s.idle > 0 && <Key swatch="bg-idle" label="Passou sem registro" value={s.idle} />}
            <Key swatch="bg-todo" label="Falta" value={m.remainingMin} />
            <Key swatch="hatch" label="Livre" value={s.free} />
          </div>
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
              {m.window ? `Horário ${m.window.start}–${m.window.end} · ${fmtMin(m.capacityMin)} para tarefas` : "Sem horário"}
              {custom && " (só neste dia)"}
            </span>
            <button
              className="font-medium text-brand hover:underline"
              onClick={() => {
                setDraft(m.window ?? { start: "08:00", end: "18:00" });
                setEditing(true);
              }}
            >
              Mudar {isToday ? "hoje" : "neste dia"}
            </button>
          </>
        )}
      </div>
      {m.outsideMin > 0 && <p className="mt-2 text-[13px] text-break">+ {fmtMin(m.outsideMin)} fora do horário (extra)</p>}
    </Panel>
  );
}
