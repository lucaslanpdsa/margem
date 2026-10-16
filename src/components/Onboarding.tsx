"use client";

import { CalendarRange, ListChecks, Minus, Plus, Timer } from "lucide-react";
import { useState } from "react";
import { WEEKDAY_SHORT, fmtMin } from "@/lib/dates";
import { saveSettings } from "@/lib/db";
import { useStore } from "./store";
import { PomodoroPicker, SlackPicker } from "./pickers";
import { Button, Modal, cx } from "./ui";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Dia "típico" para os exemplos: o valor que mais se repete na semana. */
export function typicalDay(caps: number[]) {
  const days = caps.filter((c) => c > 0);
  if (days.length === 0) return 240;
  const count = new Map<number, number>();
  days.forEach((d) => count.set(d, (count.get(d) ?? 0) + 1));
  return [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

/** Editor de tempo por dia da semana, de 30 em 30 minutos. */
export function CapacityEditor({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const set = (d: number, min: number) => onChange(value.map((v, i) => (i === d ? Math.max(0, Math.min(16 * 60, min)) : v)));
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {ORDER.map((d) => (
        <div key={d} className="flex flex-col items-center rounded-xl border border-line bg-surface py-2">
          <span className="text-xs font-medium text-muted">{WEEKDAY_SHORT[d]}</span>
          <button type="button" aria-label={`Mais tempo ${WEEKDAY_SHORT[d]}`} onClick={() => set(d, value[d] + 30)} className="mt-1 rounded p-1 text-muted hover:bg-sunken hover:text-ink">
            <Plus size={14} />
          </button>
          <span className={cx("tabular py-0.5 text-sm font-semibold", value[d] === 0 && "text-muted")}>{value[d] === 0 ? "—" : fmtMin(value[d])}</span>
          <button type="button" aria-label={`Menos tempo ${WEEKDAY_SHORT[d]}`} onClick={() => set(d, value[d] - 30)} className="rounded p-1 text-muted hover:bg-sunken hover:text-ink">
            <Minus size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

const PRESETS: { label: string; caps: number[] }[] = [
  { label: "Noites livres", caps: [240, 120, 120, 120, 120, 120, 240] },
  { label: "Meio período", caps: [180, 240, 240, 240, 240, 240, 180] },
  { label: "Dia todo livre", caps: [240, 480, 480, 480, 480, 480, 240] },
];

const HOW = [
  {
    icon: CalendarRange,
    title: "Você diz quanto tempo tem",
    text: "Para cada dia da semana, quanto sobra para suas tarefas, fora trabalho, refeições e compromissos fixos.",
  },
  {
    icon: ListChecks,
    title: "Cada tarefa tem uma estimativa",
    text: "Pode ser de uma vez, repetir em dias fixos ou ser uma meta semanal. O app soma tudo e mostra se cabe no dia.",
  },
  {
    icon: Timer,
    title: "O pomodoro mede o que foi feito",
    text: "Cada minuto focado conta como feito. Assim você vê, a qualquer hora, o que já fez, o que falta e o que ainda está livre.",
  },
];

export function HowItWorks() {
  return (
    <div className="space-y-4">
      {HOW.map((h) => (
        <div key={h.title} className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-todo/10 text-todo">
            <h.icon size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold">{h.title}</p>
            <p className="mt-0.5 text-sm text-muted">{h.text}</p>
          </div>
        </div>
      ))}
      <div className="rounded-xl bg-sunken p-4">
        <div className="flex h-8 gap-[2px] overflow-hidden rounded-lg text-[11px] font-semibold">
          <div className="flex w-[30%] items-center bg-done px-2 text-white">Feito</div>
          <div className="flex w-[40%] items-center bg-todo px-2 text-white">Falta</div>
          <div className="hatch flex flex-1 items-center px-2 text-muted">Livre</div>
        </div>
        <p className="mt-2 text-xs text-muted">É essa régua que você vê no topo de cada dia.</p>
      </div>
    </div>
  );
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Como o Margem funciona" onClose={onClose}>
      <HowItWorks />
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Entendi
        </Button>
      </div>
    </Modal>
  );
}

export function Onboarding() {
  const { uid, settings } = useStore();
  const [step, setStep] = useState(0);
  const [caps, setCaps] = useState(settings.capacityByWeekday);
  const [slack, setSlack] = useState(Math.round(settings.slack * 100));
  const [focus, setFocus] = useState(settings.focusMin);
  const [brk, setBrk] = useState(settings.breakMin);

  const weekTotal = caps.reduce((a, b) => a + b, 0);
  const finish = (skip = false) =>
    saveSettings(uid, {
      ...(skip
        ? {}
        : {
            capacityByWeekday: caps,
            slack: slack / 100,
            focusMin: focus,
            breakMin: brk,
          }),
      onboarded: true,
    });

  const steps = [
    {
      title: "Bem-vindo ao Margem",
      description: "Um jeito de organizar uma rotina flexível sem se enganar sobre quanto cabe no dia.",
      body: <HowItWorks />,
    },
    {
      title: "Quanto tempo você tem para tarefas?",
      description: "Conte só o tempo livre para as tarefas daqui. Dá para mudar um dia específico depois.",
      body: (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant={caps.join() === p.caps.join() ? "primary" : "secondary"} onClick={() => setCaps(p.caps)}>
                {p.label}
              </Button>
            ))}
          </div>
          <CapacityEditor value={caps} onChange={setCaps} />
          <p className="text-sm text-muted">
            Total na semana: <span className="tabular font-semibold text-ink">{fmtMin(weekTotal)}</span>
          </p>
        </div>
      ),
    },
    {
      title: "Quanto reservar para imprevistos?",
      description: "A margem de folga deixa as contas do dia mais realistas.",
      body: <SlackPicker value={slack} onChange={setSlack} typicalDayMin={typicalDay(caps)} />,
    },
    {
      title: "Como você gosta de focar?",
      description: "Duração do pomodoro. Dá para mudar depois em Ajustes.",
      body: (
        <PomodoroPicker
          focus={focus}
          brk={brk}
          onChange={(f, b) => {
            setFocus(f);
            setBrk(b);
          }}
        />
      ),
    },
  ];

  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <Modal title={s.title} description={s.description} onClose={() => finish(true)} wide>
      {s.body}
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <span className="text-[13px] text-muted">
          Passo {step + 1} de {steps.length}
        </span>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          )}
          <Button variant="primary" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? "Começar a usar" : "Continuar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
