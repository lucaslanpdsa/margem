"use client";

import { ArrowRight, Check, ListChecks, X } from "lucide-react";
import { useState } from "react";
import { dayName, todayKey } from "@/lib/dates";
import { setGoals } from "@/lib/db";
import { carryOver, goalsFor, goalsKey, nextOccurrence } from "@/lib/goals";
import type { Goal, Task } from "@/lib/types";
import { useStore } from "./store";
import { useToast } from "./toast";
import { cx } from "./ui";

/**
 * "Objetivos de hoje" na janela da tarefa: o que você quer entregar nesse tempo (ex: tickets do trabalho, capítulos do estudo).
 * Só marcar; sem tempo por objetivo, para a conta do dia continuar só com o tempo da tarefa.
 * Para planejar amanhã, abra a tarefa pela coluna de amanhã em Tarefas › Esta semana.
 */
export function Goals({ task, date }: { task: Task; date: string }) {
  const { uid } = useStore();
  const toast = useToast();
  const key = goalsKey(task, date);
  // Estado local: responde na hora (e funciona na prévia, que não grava).
  const [goals, setLocal] = useState<Goal[]>(() => goalsFor(task, date));
  const [text, setText] = useState("");
  const save = (next: Goal[]) => {
    setLocal(next);
    setGoals(uid, task, key, next);
  };
  const next = nextOccurrence(task, date);
  const pending = goals.filter((g) => !g.done).length;
  const label = date === todayKey() ? "Objetivos de hoje" : task.repeat === "weekdays" ? `Objetivos de ${dayName(date).toLowerCase()}` : "Objetivos";

  function add() {
    const t = text.trim();
    if (!t) return;
    save([...goals, { id: crypto.randomUUID().slice(0, 8), text: t, done: false }]);
    setText("");
  }
  function remove(g: Goal) {
    const before = goals;
    save(goals.filter((x) => x.id !== g.id));
    toast(`"${g.text}" removido`, { tone: "info", undo: () => save(before) });
  }
  function carry() {
    if (!next) return;
    const beforeFrom = goals;
    const beforeTo = task.goals?.[next] ?? [];
    const r = carryOver(goals, beforeTo);
    save(r.from);
    setGoals(uid, task, next, r.to);
    toast(`${pending} ${pending === 1 ? "objetivo foi" : "objetivos foram"} para ${dayName(next).toLowerCase()}`, {
      tone: "info",
      undo: () => {
        save(beforeFrom);
        setGoals(uid, task, next, beforeTo);
      },
    });
  }

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <ListChecks size={14} className="text-muted" /> {label}
        </p>
        {goals.length > 0 && (
          <span className="tabular text-xs text-muted">
            {goals.length - pending}/{goals.length}
          </span>
        )}
      </div>
      {goals.length > 0 && (
        <ul className="mb-1.5 space-y-0.5">
          {goals.map((g) => (
            <li key={g.id} className="group flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-sunken">
              <button
                onClick={() => save(goals.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)))}
                aria-label={g.done ? "Desmarcar" : "Marcar como feito"}
                className={cx(
                  "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors",
                  g.done ? "border-done bg-done text-white" : "border-line hover:border-done",
                )}
              >
                {g.done && <Check size={11} strokeWidth={3} />}
              </button>
              <span className={cx("min-w-0 flex-1 text-sm break-words", g.done && "text-muted line-through")}>{g.text}</span>
              <button
                onClick={() => remove(g)}
                aria-label="Remover objetivo"
                className="grid size-6 shrink-0 place-items-center rounded text-muted opacity-60 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={goals.length ? "Adicionar outro" : "Ex: fechar ticket 123, revisar PR"}
        className="h-9 w-full rounded-lg border border-dashed border-line bg-transparent px-3 text-sm outline-none placeholder:text-muted/70 focus:border-brand focus:border-solid"
      />
      {/* O que não deu para fazer vai para o próximo dia da tarefa, sem reescrever. */}
      {next && pending > 0 && date <= todayKey() && (
        <button onClick={carry} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          Levar {pending === 1 ? "o que falta" : `os ${pending} que faltam`} para {dayName(next).toLowerCase()} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
