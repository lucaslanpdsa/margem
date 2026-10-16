"use client";

import { Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import { fmtMin, fromKey, todayKey } from "@/lib/dates";
import { saveSettings } from "@/lib/db";
import type { DayMetrics } from "@/lib/metrics";
import type { DayWindow } from "@/lib/types";
import { useStore } from "./store";
import { Button, Panel, TimeSelect, cx } from "./ui";

/**
 * Divide o dia em segmentos que somam o horário:
 * feito | passou sem registro | falta (o que cabe) | não cabe | livre
 */
function segments(m: DayMetrics) {
  const used = Math.max(m.doneMin, m.elapsedMin);
  const room = Math.max(0, m.capacityMin - used);
  const fits = Math.min(m.remainingMin, room);
  const excess = m.remainingMin - fits;
  return { done: m.doneMin, idle: m.idleMin, fits, excess, free: Math.max(0, m.freeMin) };
}

/** Barra compacta (cabeçalho da semana). */
export function CapacityBar({ m, thin }: { m: DayMetrics; thin?: boolean }) {
  const s = segments(m);
  const total = Math.max(1, s.done + s.idle + s.fits + s.excess + s.free);
  const pct = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className={cx("flex w-full gap-px overflow-hidden rounded-full bg-sunken", thin ? "h-1.5" : "h-2.5")}>
      <div className="bg-done" style={{ width: pct(s.done) }} />
      <div className="bg-idle" style={{ width: pct(s.idle) }} />
      <div className="bg-todo" style={{ width: pct(s.fits) }} />
      <div className="bg-over" style={{ width: pct(s.excess) }} />
      <div className="hatch" style={{ width: pct(s.free) }} />
    </div>
  );
}

function Segment({ width, className, label }: { width: number; className: string; label: string }) {
  if (width <= 0) return null;
  return (
    <div className={cx("relative flex h-full items-center overflow-hidden px-3", className)} style={{ width: `${width}%` }}>
      {width > 13 && <span className="truncate text-[13px] font-semibold">{label}</span>}
    </div>
  );
}

const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** A régua do dia: o que já foi feito, o tempo que passou, o que falta e o que ainda cabe. */
export function DayBudget({ m, now }: { m: DayMetrics; now: Date }) {
  const { uid, settings } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DayWindow>({ start: "08:00", end: "18:00" });

  const s = segments(m);
  const total = Math.max(1, s.done + s.idle + s.fits + s.excess + s.free);
  const p = (v: number) => (v / total) * 100;
  const isToday = m.date === todayKey();
  const custom = m.date in settings.windowOverrides;
  const weekday = fromKey(m.date).toLocaleDateString("pt-BR", { weekday: "long" });
  const over = s.excess > 0;

  async function saveOverride(w: DayWindow | null) {
    await saveSettings(uid, { windowOverrides: { ...settings.windowOverrides, [m.date]: w } });
    setEditing(false);
  }
  async function resetOverride() {
    const next = { ...settings.windowOverrides };
    delete next[m.date];
    await saveSettings(uid, { windowOverrides: next });
  }

  let headline: string;
  let sub: string;
  if (!m.window) {
    headline = isToday ? "Hoje sem horário para tarefas" : "Dia sem horário para tarefas";
    sub = "Defina um horário para este dia se quiser planejar algo.";
  } else if (m.leftMin === 0 && !isToday) {
    headline = `${fmtMin(m.doneMin)} feitos`;
    sub = `Dia encerrado. De ${fmtMin(m.capacityMin)} de horário, ${fmtMin(m.doneMin)} ficaram registrados em tarefas.`;
  } else if (m.leftMin === 0) {
    headline = "Seu horário de hoje acabou";
    sub = `Você registrou ${fmtMin(m.doneMin)} em tarefas hoje.`;
  } else if (over) {
    headline = `${fmtMin(s.excess)} não cabem`;
    sub = isToday
      ? `São ${hhmm(now)}. Restam ${fmtMin(m.leftMin)} do seu horário, mas faltam ${fmtMin(m.remainingMin)} de tarefas. Mova algo para outro dia.`
      : `Faltam ${fmtMin(m.remainingMin)} de tarefas para ${fmtMin(m.leftMin)} de horário. Mova algo para outro dia.`;
  } else {
    headline = `${fmtMin(m.freeMin)} livres`;
    sub = isToday
      ? `São ${hhmm(now)}. Restam ${fmtMin(m.leftMin)} do seu horário até as ${m.window.end}, e ${fmtMin(m.remainingMin)} disso já são das tarefas de hoje.`
      : `De ${fmtMin(m.capacityMin)} de horário, ${fmtMin(m.remainingMin)} já são das tarefas deste dia.`;
  }

  const breaksText = settings.breaks.length ? `, menos ${settings.breaks.map((b) => `${b.label.toLowerCase()} ${b.start}–${b.end}`).join(" e ")}` : "";

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className={cx("tabular text-[32px] leading-none font-semibold tracking-tight", over && "text-over")}>{headline}</p>
          <p className="mt-2 max-w-2xl text-sm text-muted">{sub}</p>
        </div>

        {editing ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveOverride(draft);
            }}
          >
            <TimeSelect label="Início" value={draft.start} onChange={(v) => setDraft({ ...draft, start: v })} />
            <span className="text-muted">até</span>
            <TimeSelect label="Fim" value={draft.end} onChange={(v) => setDraft({ ...draft, end: v })} />
            <Button type="submit" variant="primary">
              Salvar
            </Button>
            <Button type="button" variant="ghost" onClick={() => saveOverride(null)}>
              Sem horário
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(m.window ?? { start: "08:00", end: "18:00" });
              setEditing(true);
            }}
          >
            <Pencil size={14} /> Mudar horário {isToday ? "de hoje" : "deste dia"}
          </Button>
        )}
      </div>

      {m.window && (
        <>
          <div className="mt-5 flex h-11 w-full gap-[2px] overflow-hidden rounded-xl bg-sunken">
            <Segment width={p(s.done)} className="bg-done text-white" label={`Feito ${fmtMin(s.done)}`} />
            <Segment width={p(s.idle)} className="bg-idle text-white" label={`Passou ${fmtMin(s.idle)}`} />
            <Segment width={p(s.fits)} className="bg-todo text-white" label={`Falta ${fmtMin(s.fits)}`} />
            <Segment width={p(s.excess)} className="bg-over text-white" label={`Não cabe ${fmtMin(s.excess)}`} />
            <Segment width={p(s.free)} className="hatch text-muted" label={`Livre ${fmtMin(s.free)}`} />
          </div>

          <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Legend swatch="bg-done" label="Feito" value={s.done} text="Tempo registrado em tarefas, por pomodoro ou manualmente." />
            <Legend swatch="bg-idle" label="Passou" value={s.idle} text="Horário que já passou sem nenhuma tarefa registrada." />
            <Legend
              swatch="bg-todo"
              label="Falta"
              value={m.remainingMin}
              text={over ? `O que resta das tarefas do dia. ${fmtMin(s.excess)} disso não cabe no horário.` : "O que ainda resta das tarefas do dia."}
            />
            <Legend swatch="hatch" label="Livre" value={s.free} text="Horário que sobra para encaixar mais coisas." />
          </dl>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3 text-[13px] text-muted">
        <span>
          {m.window ? (
            <>
              Horário {m.window.start}–{m.window.end}
              {breaksText} = <span className="tabular font-medium text-ink">{fmtMin(m.capacityMin)}</span> para tarefas
            </>
          ) : (
            "Sem horário para tarefas"
          )}
          {custom ? " (ajustado só para este dia)." : ` (padrão de ${weekday}, definido em Ajustes).`}
        </span>
        {m.outsideMin > 0 && <span className="w-full text-break">Mais {fmtMin(m.outsideMin)} de tarefas marcadas fora do horário, como extra.</span>}
        {custom && (
          <button onClick={resetOverride} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            <RotateCcw size={12} /> Voltar ao padrão
          </button>
        )}
      </div>
    </Panel>
  );
}

function Legend({ swatch, label, value, text }: { swatch: string; label: string; value: number; text: string }) {
  return (
    <div className="flex gap-3">
      <span className={cx("mt-1 h-3 w-3 shrink-0 rounded-[4px]", swatch)} />
      <div>
        <dt className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="tabular text-sm font-semibold">{fmtMin(value)}</span>
        </dt>
        <dd className="mt-0.5 text-[13px] leading-snug text-muted">{text}</dd>
      </div>
    </div>
  );
}
