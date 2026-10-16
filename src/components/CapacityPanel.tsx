"use client";

import { useState } from "react";
import { fmtMin, fromKey, parseDuration } from "@/lib/dates";
import { saveSettings } from "@/lib/db";
import type { DayMetrics } from "@/lib/metrics";
import { useStore } from "./store";
import { cx, inputCls } from "./ui";

/** Barra empilhada: feito | falta | livre, sobre o tempo usável do dia. */
export function CapacityBar({ m, thin }: { m: DayMetrics; thin?: boolean }) {
  const total = Math.max(m.usableMin, m.doneMin + m.remainingMin, 1);
  const pct = (v: number) => `${(Math.max(0, v) / total) * 100}%`;
  const over = m.freeMin < 0;
  return (
    <div className={cx("relative flex w-full overflow-hidden rounded-full bg-paper", thin ? "h-1.5" : "h-3")}>
      <div className="bg-done" style={{ width: pct(m.doneMin) }} />
      <div className="bg-todo" style={{ width: pct(m.remainingMin) }} />
      <div className="bg-free" style={{ width: pct(m.freeMin) }} />
      {over && (
        <div className="absolute inset-y-0 border-r-2 border-warn" style={{ left: pct(m.usableMin) }} title="Limite do dia" />
      )}
    </div>
  );
}

export function CapacityPanel({ m }: { m: DayMetrics }) {
  const { uid, settings } = useStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const over = m.freeMin < 0;
  const override = settings.capacityOverrides[m.date];
  const weekday = fromKey(m.date).toLocaleDateString("pt-BR", { weekday: "long" });

  async function saveOverride() {
    const min = parseDuration(value);
    const next = { ...settings.capacityOverrides };
    if (min === null) delete next[m.date];
    else next[m.date] = min;
    await saveSettings(uid, { capacityOverrides: next });
    setEditing(false);
  }

  async function clearOverride() {
    const next = { ...settings.capacityOverrides };
    delete next[m.date];
    await saveSettings(uid, { capacityOverrides: next });
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{over ? "Passou do limite" : "Ainda livre hoje"}</p>
          <p className={cx("tabular font-display text-4xl leading-tight", over && "text-warn")}>
            {over ? `+${fmtMin(-m.freeMin)}` : fmtMin(m.freeMin)}
          </p>
        </div>
        <div className="text-right text-sm text-muted">
          {editing ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveOverride();
              }}
            >
              <span>Hoje tenho</span>
              <input autoFocus className={cx(inputCls, "w-20 py-1")} value={value} onChange={(e) => setValue(e.target.value)} onBlur={saveOverride} placeholder="3h" />
            </form>
          ) : (
            <button
              className="hover:text-ink"
              onClick={() => {
                setValue(fmtMin(m.capacityMin));
                setEditing(true);
              }}
              title="Mudar o tempo disponível só neste dia"
            >
              Tempo do dia: <span className="tabular font-medium text-ink">{fmtMin(m.capacityMin)}</span> ✎
            </button>
          )}
          <p className="text-xs">
            {override !== undefined ? (
              <>
                ajustado para este dia ·{" "}
                <button className="underline" onClick={clearOverride}>
                  voltar ao padrão de {weekday}
                </button>
              </>
            ) : (
              <>
                usável {fmtMin(m.usableMin)} (folga de {Math.round(settings.slack * 100)}%)
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <CapacityBar m={m} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Stat dot="bg-done" label="Feito" value={m.doneMin} />
        <Stat dot="bg-todo" label="Falta" value={m.remainingMin} />
        <Stat dot="border border-muted" label="Planejado" value={m.plannedMin} />
      </dl>

      {over && (
        <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
          O que falta não cabe no tempo de hoje. Mova algo para outro dia ou reduza uma estimativa.
        </p>
      )}
    </div>
  );
}

function Stat({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        <span className={cx("h-2 w-2 rounded-full", dot)} />
        {label}
      </dt>
      <dd className="tabular font-medium">{fmtMin(value)}</dd>
    </div>
  );
}
