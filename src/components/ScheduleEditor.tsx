"use client";

import { Plus, Trash2 } from "lucide-react";
import { WEEKDAY_SHORT, fmtMin } from "@/lib/dates";
import { toMin } from "@/lib/schedule";
import type { BreakTime, DayWindow } from "@/lib/types";
import { Button, IconButton, TimeSelect, cx } from "./ui";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

function dayTotal(w: DayWindow | null, breaks: BreakTime[]) {
  if (!w) return 0;
  const s = toMin(w.start);
  const e = toMin(w.end);
  if (e <= s) return 0;
  const inBreaks = breaks.reduce((a, b) => a + Math.max(0, Math.min(e, toMin(b.end)) - Math.max(s, toMin(b.start))), 0);
  return e - s - inBreaks;
}

export interface Schedule {
  windows: (DayWindow | null)[];
  breaks: BreakTime[];
}

/** Horário de cada dia da semana + pausas fixas (almoço etc.). */
export function ScheduleEditor({ value, onChange }: { value: Schedule; onChange: (v: Schedule) => void }) {
  const { windows, breaks } = value;
  const setWindow = (d: number, w: DayWindow | null) => onChange({ ...value, windows: windows.map((x, i) => (i === d ? w : x)) });
  const setBreak = (i: number, b: BreakTime | null) =>
    onChange({ ...value, breaks: b ? breaks.map((x, j) => (j === i ? b : x)) : breaks.filter((_, j) => j !== i) });
  const copyMonday = () => {
    const mon = windows[1];
    onChange({ ...value, windows: windows.map((w, i) => (i >= 1 && i <= 5 ? (mon ? { ...mon } : null) : w)) });
  };
  const weekTotal = windows.reduce((a, w) => a + dayTotal(w, breaks), 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Seu horário em cada dia</p>
          <Button size="sm" variant="ghost" onClick={copyMonday} title="Copiar o horário de segunda para terça a sexta">
            Repetir segunda até sexta
          </Button>
        </div>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {ORDER.map((d) => {
            const w = windows[d];
            return (
              <li key={d} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                <label className="flex w-20 cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={!!w}
                    onChange={(e) => setWindow(d, e.target.checked ? { start: "08:00", end: "18:00" } : null)}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  {WEEKDAY_SHORT[d]}
                </label>
                {w ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <TimeSelect label={`Início ${WEEKDAY_SHORT[d]}`} value={w.start} onChange={(v) => setWindow(d, { ...w, start: v })} />
                      <span className="text-muted">até</span>
                      <TimeSelect label={`Fim ${WEEKDAY_SHORT[d]}`} value={w.end} onChange={(v) => setWindow(d, { ...w, end: v })} />
                    </div>
                    <span className="tabular ml-auto text-[13px] text-muted">{fmtMin(dayTotal(w, breaks))}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted">Sem tarefas neste dia</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="text-sm font-semibold">Pausas fixas</p>
        <p className="mt-0.5 mb-2 text-[13px] text-muted">Valem para todos os dias e não contam como tempo para tarefas.</p>
        <ul className="space-y-2">
          {breaks.map((b, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input
                className="h-9 w-32 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand"
                value={b.label}
                aria-label="Nome da pausa"
                onChange={(e) => setBreak(i, { ...b, label: e.target.value })}
              />
              <TimeSelect label="Início da pausa" value={b.start} onChange={(v) => setBreak(i, { ...b, start: v })} />
              <span className="text-muted">até</span>
              <TimeSelect label="Fim da pausa" value={b.end} onChange={(v) => setBreak(i, { ...b, end: v })} />
              <IconButton label="Remover pausa" onClick={() => setBreak(i, null)}>
                <Trash2 size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => onChange({ ...value, breaks: [...breaks, { label: "Pausa", start: "15:00", end: "15:15" }] })}>
          <Plus size={14} /> Adicionar pausa
        </Button>
      </div>

      <p className={cx("text-sm text-muted")}>
        Total na semana: <span className="tabular font-semibold text-ink">{fmtMin(weekTotal)}</span> para tarefas.
      </p>
    </div>
  );
}
