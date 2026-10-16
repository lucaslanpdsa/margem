"use client";

import { useState } from "react";
import { Segmented, cx } from "./ui";

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
