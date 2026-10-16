"use client";

import { useState } from "react";
import { fmtMin } from "@/lib/dates";
import { Segmented, cx } from "./ui";

/**
 * Escolha da folga com um exemplo visual usando o dia típico da pessoa:
 * mostra quanto dá para planejar e quanto fica de reserva.
 */
export function SlackPicker({ value, onChange, typicalDayMin }: { value: number; onChange: (v: number) => void; typicalDayMin: number }) {
  const day = typicalDayMin > 0 ? typicalDayMin : 240;
  const reserve = Math.round(day * (value / 100));
  const usable = day - reserve;

  return (
    <div>
      <p className="text-sm text-muted">
        Você nunca usa 100% do tempo livre em tarefas: tem pausas, água, celular, troca de contexto e imprevistos. A folga separa um pedaço do dia para isso,
        para o app não deixar você planejar mais do que cabe de verdade.
      </p>

      <div className="mt-4 rounded-xl bg-sunken p-4">
        <p className="text-[13px] text-muted">Num dia com {fmtMin(day)} para tarefas:</p>
        <div className="mt-2 flex h-9 gap-[2px] overflow-hidden rounded-lg text-[12px] font-semibold">
          <div className="flex items-center bg-todo px-2.5 text-white" style={{ width: `${100 - value}%` }}>
            <span className="truncate">Para planejar {fmtMin(usable)}</span>
          </div>
          {value > 0 && (
            <div className="hatch flex items-center px-2 text-muted" style={{ width: `${value}%` }}>
              {value >= 20 && <span className="truncate">{fmtMin(reserve)}</span>}
            </div>
          )}
        </div>
        <p className="mt-2 text-[13px]">
          {value === 0 ? (
            "Sem folga: o app conta com cada minuto. Bom só se você é muito constante."
          ) : (
            <>
              Você planeja até <b className="font-semibold">{fmtMin(usable)}</b> de tarefas e <b className="font-semibold">{fmtMin(reserve)}</b> ficam de reserva.
            </>
          )}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={30}
          step={5}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className="flex-1 accent-[var(--brand)]"
          aria-label="Porcentagem de folga"
        />
        <span className="tabular w-12 text-right text-sm font-semibold">{value}%</span>
      </div>
      <p className="mt-1 text-xs text-muted">Dica: com pomodoro de 25 + 5, só as pausas já ocupam uns 17% do tempo. 15% é um bom começo; ajuste se seus dias vivem estourando.</p>
    </div>
  );
}

const POMO_PRESETS = [
  { focus: 25, brk: 5, label: "25 + 5", hint: "Clássico. Bom para começar e para tarefas cansativas." },
  { focus: 50, brk: 10, label: "50 + 10", hint: "Para quando você entra no ritmo e não quer parar tão cedo." },
  { focus: 90, brk: 20, label: "90 + 20", hint: "Blocos longos de concentração, como estudo ou código pesado." },
];

/** Escolha de foco + pausa: três opções prontas ou personalizado. */
export function PomodoroPicker({
  focus,
  brk,
  onChange,
}: {
  focus: number;
  brk: number;
  onChange: (focus: number, brk: number) => void;
}) {
  const [custom, setCustom] = useState(false);
  const match = POMO_PRESETS.find((p) => p.focus === focus && p.brk === brk);
  const preset = custom ? undefined : match;
  const mode = preset ? preset.label : "custom";
  const num = (v: number, set: (n: number) => void, min: number, max: number, label: string) => (
    <label className="text-[13px] font-medium">
      <span className="mb-1.5 block">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={v}
        onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="tabular h-10 w-24 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand"
      />
    </label>
  );

  return (
    <div>
      <p className="text-sm text-muted">Minutos de foco + minutos de pausa. O tempo de foco conta como feito na tarefa, e parar no meio também conta.</p>
      <div className="mt-3 overflow-x-auto">
        <Segmented
          value={mode}
          onChange={(v) => {
            const p = POMO_PRESETS.find((x) => x.label === v);
            setCustom(!p);
            if (p) onChange(p.focus, p.brk);
          }}
          options={[...POMO_PRESETS.map((p) => ({ value: p.label, label: p.label })), { value: "custom", label: "Personalizar" }]}
        />
      </div>
      {preset ? (
        <p className="mt-2 text-[13px] text-muted">
          {preset.focus} minutos de foco, {preset.brk} de pausa. {preset.hint}
        </p>
      ) : (
        <div className={cx("mt-3 flex flex-wrap items-end gap-4")}>
          {num(focus, (n) => onChange(n, brk), 5, 180, "Foco (minutos)")}
          {num(brk, (n) => onChange(focus, n), 1, 60, "Pausa (minutos)")}
        </div>
      )}
    </div>
  );
}
