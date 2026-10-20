"use client";

import { CalendarRange, ListChecks, Sun, Timer } from "lucide-react";
import { useState } from "react";
import { fmtMin } from "@/lib/dates";
import { addTask, saveSettings } from "@/lib/db";
import { ScheduleEditor, type Schedule } from "./ScheduleEditor";
import { useStore } from "./store";
import { Button, Modal, Switch, cx, inputCls } from "./ui";

const HOW = [
  {
    icon: CalendarRange,
    title: "Você diz o seu horário",
    text: "Por exemplo, das 7h às 18h com uma hora de almoço. O app acompanha o relógio e sabe quanto do dia já passou.",
  },
  {
    icon: ListChecks,
    title: "Cada tarefa tem uma estimativa",
    text: "Uma vez ou repetindo em dias fixos. O app soma tudo e mostra se ainda cabe no seu dia.",
  },
  {
    icon: Timer,
    title: "Você registra o que fez",
    text: "Toque no ▶ da tarefa para cronometrar, ou adicione 30m, 1h… depois. A qualquer hora você vê se dá tempo.",
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
          <div className="flex w-[22%] items-center bg-done px-2 text-white">Feito</div>
          <div className="flex w-[14%] items-center bg-idle px-2 text-white">Sem reg.</div>
          <div className="flex w-[34%] items-center bg-todo px-2 text-white">A fazer</div>
          <div className="hatch flex flex-1 items-center px-2 text-muted">Sobra</div>
        </div>
        <p className="mt-2 text-xs text-muted">É essa régua que você vê no topo de cada dia.</p>
      </div>
    </div>
  );
}

/** O que cada aba faz e os atalhos que valem a pena conhecer. */
const TABS_HELP = [
  {
    icon: Sun,
    title: "Dia",
    text: "Mostra se dá tempo hoje e, em “Esta semana”, quanto falta da meta de cada tarefa que repete. Toque numa tarefa para registrar, concluir, pular ou mudar o dia. O ▶ começa o timer nela.",
  },
  {
    icon: ListChecks,
    title: "Tarefas",
    text: "Onde você organiza: seu horário, a semana (quanto sobra em cada dia), as tarefas que repetem (toque nos dias para ligar ou desligar) e as de uma vez, por data.",
  },
  {
    icon: Timer,
    title: "Foco",
    text: "Em cima, o pomodoro: só o ritmo de foco e pausa, não registra. Embaixo, o cronômetro: registra as horas na tarefa. Dá para usar os dois juntos.",
  },
];

const TIPS = [
  "Esqueceu de dar play? Com o timer rodando, use “Começou às… · Mudar”.",
  "Passou tempo sem registrar? “O que você fez?” no topo do dia distribui esse tempo.",
  "Não dá tempo? O app sugere o que tirar de hoje: pular, mandar para amanhã ou encurtar.",
  "Ficou para trás na semana? Quando sobrar tempo, o topo do dia sugere quanto dá para recuperar.",
  "Errou? Os avisos no rodapé têm “Desfazer”.",
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Como o Margem funciona" onClose={onClose}>
      <HowItWorks />
      <h3 className="mt-6 mb-3 text-sm font-semibold">As abas</h3>
      <div className="space-y-3">
        {TABS_HELP.map((h) => (
          <div key={h.title} className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sunken text-muted">
              <h.icon size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold">{h.title}</p>
              <p className="mt-0.5 text-sm text-muted">{h.text}</p>
            </div>
          </div>
        ))}
      </div>
      <h3 className="mt-6 mb-2 text-sm font-semibold">Dicas</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        {TIPS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Entendi
        </Button>
      </div>
    </Modal>
  );
}

/** A rotina de quem trabalha e estuda, em dois blocos: o trabalho (opcional) e o que quer encaixar. */
export interface Routine {
  work: boolean;
  workMin: number;
  study: boolean;
  studyTitle: string;
  studyMin: number;
  studyDays: number[];
}

const DAY_SETS = [
  { label: "Seg a sex", days: [1, 2, 3, 4, 5] },
  { label: "Seg a sáb", days: [1, 2, 3, 4, 5, 6] },
  { label: "Todos os dias", days: [0, 1, 2, 3, 4, 5, 6] },
];

function Chips<T>({ options, value, onChange }: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = JSON.stringify(o.value) === JSON.stringify(value);
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "h-10 rounded-lg border px-3.5 text-[13px] font-medium transition-colors",
              on ? "border-todo/30 bg-todo/15 text-todo" : "border-line text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function RoutineStep({ value, onChange }: { value: Routine; onChange: (r: Routine) => void }) {
  const set = (p: Partial<Routine>) => onChange({ ...value, ...p });
  const weekly = value.studyMin * value.studyDays.length;
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-line p-4">
        <Switch checked={value.work} onChange={(work) => set({ work })} label="Trabalho" />
        {value.work && (
          <div className="mt-3">
            <p className="mb-2 text-[13px] text-muted">Quantas horas por dia, de segunda a sexta? Ele termina quando você cumprir o tempo.</p>
            <Chips
              value={value.workMin}
              onChange={(workMin) => set({ workMin })}
              options={[4, 6, 8].map((h) => ({ label: `${h}h`, value: h * 60 }))}
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line p-4">
        <Switch checked={value.study} onChange={(study) => set({ study })} label="O que você quer encaixar (estudo, curso…)" />
        {value.study && (
          <div className="mt-3 space-y-3">
            <input className={inputCls} value={value.studyTitle} onChange={(e) => set({ studyTitle: e.target.value })} placeholder="Ex: Estudar para o concurso" aria-label="Nome" />
            <Chips value={value.studyDays} onChange={(studyDays) => set({ studyDays })} options={DAY_SETS.map((d) => ({ label: d.label, value: d.days }))} />
            <Chips
              value={value.studyMin}
              onChange={(studyMin) => set({ studyMin })}
              options={[30, 60, 90, 120].map((m) => ({ label: fmtMin(m), value: m }))}
            />
            <p className="text-[13px] text-muted">
              Meta da semana: <b className="tabular font-semibold text-ink">{fmtMin(weekly)}</b>. O app mostra quanto falta e quando dá para recuperar.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function Onboarding() {
  const { uid, settings, tasks } = useStore();
  // Quem já usava a versão antiga (por horas) vê só o passo do horário.
  const returning = !!settings.onboarded;
  const [step, setStep] = useState(returning ? 1 : 0);
  const [schedule, setSchedule] = useState<Schedule>({ windows: settings.windows, breaks: settings.breaks });
  // Só oferece montar a rotina para quem ainda não tem tarefas.
  const [routine, setRoutine] = useState<Routine>({ work: true, workMin: 480, study: true, studyTitle: "Estudar", studyMin: 60, studyDays: [1, 2, 3, 4, 5] });
  const offerRoutine = !returning && tasks.length === 0;

  const finish = async (skip = false) => {
    if (!skip && offerRoutine) {
      const workdays = [1, 2, 3, 4, 5];
      if (routine.work) await addTask(uid, { title: "Trabalho", repeat: "weekdays", weekdays: workdays, estimateMin: routine.workMin, doneBy: "time" });
      if (routine.study && routine.studyTitle.trim())
        await addTask(uid, { title: routine.studyTitle.trim(), repeat: "weekdays", weekdays: routine.studyDays, estimateMin: routine.studyMin });
    }
    await saveSettings(uid, {
      ...(skip ? {} : { windows: schedule.windows, breaks: schedule.breaks }),
      onboarded: true,
      scheduleSet: true,
    });
  };

  const steps = [
    {
      title: "Bem-vindo ao Margem",
      description: "Um jeito de organizar uma rotina flexível sem se enganar sobre quanto cabe no dia.",
      body: <HowItWorks />,
    },
    {
      title: returning ? "Agora o Margem usa o seu horário" : "Qual é o seu horário?",
      description: returning
        ? "Em vez de um total de horas, diga de que horas a que horas você tem para tarefas. Assim o app sabe quanto do dia já passou."
        : "De que horas a que horas você tem para tarefas em cada dia. Dá para mudar um dia específico depois.",
      body: <ScheduleEditor value={schedule} onChange={setSchedule} />,
    },
    ...(offerRoutine
      ? [
          {
            title: "Sua rotina",
            description: "Para começar com o trabalho e o estudo já no lugar. Dá para mudar tudo depois em Tarefas.",
            body: <RoutineStep value={routine} onChange={setRoutine} />,
          },
        ]
      : []),
  ];

  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <Modal title={s.title} description={s.description} onClose={() => finish(true)} wide>
      {s.body}
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <span className="text-[13px] text-muted">{returning ? "" : `Passo ${step + 1} de ${steps.length}`}</span>
        <div className="flex gap-2">
          {step > 0 && !returning && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          )}
          <Button variant="primary" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? "Salvar e começar" : "Continuar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
