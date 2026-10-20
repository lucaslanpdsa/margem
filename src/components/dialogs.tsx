"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Task } from "@/lib/types";
import { TaskDialog } from "./TaskDialog";
import { TaskForm, type TaskDraft } from "./TaskForm";

interface Dialogs {
  /** Sem id: formulário de criar. Com id: a janela da tarefa (onde também se edita). */
  editTask: (draft?: TaskDraft) => void;
  /** A janela da tarefa; `day` = o dia de onde foi aberta (padrão: o Dia aberto). */
  openTask: (task: Task, day?: string) => void;
}

const Ctx = createContext<Dialogs | null>(null);
export const useDialogs = () => useContext(Ctx)!;

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [open, setOpen] = useState<{ task: Task; day?: string } | null>(null);
  const openTask = (task: Task, day?: string) => setOpen({ task, day });

  return (
    <Ctx.Provider value={{ editTask: (d) => (d?.id ? openTask(d as Task) : setDraft(d ?? {})), openTask }}>
      {children}
      {draft && <TaskForm initial={draft} onClose={() => setDraft(null)} />}
      {/* key: trocar de tarefa recria a janela (o estado local dos campos é de uma tarefa só). */}
      {open && <TaskDialog key={open.task.id} task={open.task} day={open.day} onClose={() => setOpen(null)} />}
    </Ctx.Provider>
  );
}
