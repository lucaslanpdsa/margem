"use client";

import { Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import { fmtMin, fromKey, parseDuration, todayKey } from "@/lib/dates";
import { saveSettings } from "@/lib/db";
import type { DayMetrics } from "@/lib/metrics";
import { useStore } from "./store";
import { Button, Panel, cx, inputCls } from "./ui";

/** Separa o que falta em "cabe no dia" e "passou do limite". */
function splitRemaining(m: DayMetrics) {
  const excess = Math.max(0, m.doneMin + m.remainingMin - m.capacityMin);
  const inLimit = Math.max(0, m.remainingMin - excess);
  return { inLimit, excess: m.remainingMin - inLimit };
}

/** Barra compacta (cabeçalho da semana). */
export function CapacityBar({ m, thin }: { m: DayMetrics; thin?: boolean }) {
  const total = Math.max(m.capacityMin, m.doneMin + m.remainingMin, 1);
  const pct = (v: number) => `${(Math.max(0, v) / total) * 100}%`;
  const { inLimit, excess } = splitRemaining(m);
  return (
    <div className={cx("flex w-full gap-px overflow-hidden rounded-full bg-sunken", thin ? "h-1.5" : "h-2.5")}>
      <div className="bg-done" style={{ width: pct(m.doneMin) }} />
      <div className="bg-todo" style={{ width: pct(inLimit) }} />
      <div className="bg-over" style={{ width: pct(excess) }} />
      <div className="hatch" style={{ width: pct(m.freeMin) }} />
    </div>
  );
}

function Segment({ width, className, label }: { width: number; className: string; label: string }) {
  if (width <= 0) return null;
  return (
    <div className={cx("relative flex h-full items-center overflow-hidden px-3", className)} style={{ width: `${width}%` }}>
      {width > 14 && <span className="truncate text-[13px] font-semibold">{label}</span>}
    </div>
  );
}

/** A régua do dia: mostra o que já foi feito, o que falta e o que ainda cabe. */
export function DayBudget({ m }: { m: DayMetrics }) {
  const { uid, settings } = useStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const over = m.freeMin < 0;
  const total = Math.max(m.capacityMin, m.doneMin + m.remainingMin, 1);
  const p = (v: number) => (Math.max(0, v) / total) * 100;
  const { inLimit, excess } = splitRemaining(m);
  const isToday = m.date === todayKey();
  const custom = settings.capacityOverrides[m.date] !== undefined;
  const weekday = fromKey(m.date).toLocaleDateString("pt-BR", { weekday: "long" });

  async function saveOverride() {
    const min = parseDuration(value);
    const next = { ...settings.capacityOverrides };
    if (min === null) delete next[m.date];
    else next[m.date] = min;
    await saveSettings(uid, { capacityOverrides: next });
    setEditing(false);
  }

  async function resetOverride() {
    const next = { ...settings.capacityOverrides };
    delete next[m.date];
    await saveSettings(uid, { capacityOverrides: next });
  }

  const headline = m.capacityMin === 0 ? "Dia sem tempo para tarefas" : over ? `${fmtMin(-m.freeMin)} além do limite` : `${fmtMin(m.freeMin)} livres`;

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className={cx("tabular text-[32px] leading-none font-semibold tracking-tight", over && "text-over")}>{headline}</p>
          <p className="mt-2 text-sm text-muted">
            {over
              ? "O que falta não cabe no tempo que você tem. Mova algo para outro dia ou reduza uma estimativa."
              : `${isToday ? "Ainda cabe no seu dia de hoje" : "Ainda cabe neste dia"}, depois de contar o que já fez e o que falta.`}
          </p>
        </div>

        {editing ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveOverride();
            }}
          >
            <span className="text-sm text-muted">{isToday ? "Hoje" : "Neste dia"} tenho</span>
            <input autoFocus className={cx(inputCls, "h-9 w-20")} value={value} onChange={(e) => setValue(e.target.value)} placeholder="3h" />
            <Button type="submit" variant="primary">
              Salvar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setValue(fmtMin(m.capacityMin));
              setEditing(true);
            }}
          >
            <Pencil size={14} /> Mudar o tempo {isToday ? "de hoje" : "deste dia"}
          </Button>
        )}
      </div>

      {/* Régua */}
      <div className="relative mt-5">
        <div className="flex h-11 w-full gap-[2px] overflow-hidden rounded-xl bg-sunken">
          <Segment width={p(m.doneMin)} className="bg-done text-white" label={`Feito ${fmtMin(m.doneMin)}`} />
          <Segment width={p(inLimit)} className="bg-todo text-white" label={`Falta ${fmtMin(over ? inLimit : m.remainingMin)}`} />
          <Segment width={p(excess)} className="bg-over text-white" label={`Não cabe ${fmtMin(excess)}`} />
          <Segment width={p(m.freeMin)} className="hatch text-muted" label={`Livre ${fmtMin(m.freeMin)}`} />
        </div>
      </div>

      {/* Legenda explicada */}
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <Legend swatch="bg-done" label="Feito" value={m.doneMin} text="Tempo registrado no dia, por pomodoro ou manualmente." />
        <Legend swatch="bg-todo" label="Falta" value={m.remainingMin} text={over ? `O que ainda resta das tarefas deste dia. ${fmtMin(excess)} disso não cabe (em vermelho).` : "O que ainda resta das tarefas deste dia."} />
        <Legend swatch="hatch" label="Livre" value={Math.max(0, m.freeMin)} text="Tempo que sobra para encaixar mais coisas." />
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3 text-[13px] text-muted">
        <span>
          <span className="tabular font-medium text-ink">{fmtMin(m.capacityMin)}</span> para tarefas neste dia
          {custom ? " (ajustado só para este dia)." : ` (padrão de ${weekday}, definido em Ajustes).`}
        </span>
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
