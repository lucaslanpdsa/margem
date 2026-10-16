"use client";

import { CalendarRange, ListChecks, Timer } from "lucide-react";
import { useState } from "react";
import { saveSettings } from "@/lib/db";
import { ScheduleEditor, type Schedule } from "./ScheduleEditor";
import { useStore } from "./store";
import { Button, Modal } from "./ui";

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
    title: "O tempo feito entra quase sozinho",
    text: "Tarefas com horário contam sozinhas enquanto o horário passa. Nas outras, registre 30m, 1h… ou use o pomodoro. A qualquer hora você vê se está em dia ou atrasado.",
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
          <div className="flex w-[12%] items-center bg-idle px-2 text-white">Passou</div>
          <div className="flex w-[36%] items-center bg-todo px-2 text-white">Falta</div>
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
  // Quem já usava a versão antiga (por horas) vê só o passo do horário.
  const returning = !!settings.onboarded;
  const [step, setStep] = useState(returning ? 1 : 0);
  const [schedule, setSchedule] = useState<Schedule>({ windows: settings.windows, breaks: settings.breaks });

  const finish = (skip = false) =>
    saveSettings(uid, {
      ...(skip ? {} : { windows: schedule.windows, breaks: schedule.breaks }),
      onboarded: true,
      scheduleSet: true,
    });

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
