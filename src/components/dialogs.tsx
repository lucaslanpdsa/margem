"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Task } from "@/lib/types";
import { LogTimeForm } from "./LogTimeForm";
import { TaskForm, type TaskDraft } from "./TaskForm";

interface Dialogs {
  editTask: (draft?: TaskDraft) => void;
  logTime: (task: Task) => void;
}

const Ctx = createContext<Dialogs | null>(null);
export const useDialogs = () => useContext(Ctx)!;

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [logTask, setLogTask] = useState<Task | null>(null);

  return (
    <Ctx.Provider value={{ editTask: (d) => setDraft(d ?? {}), logTime: setLogTask }}>
      {children}
      {draft && <TaskForm initial={draft} onClose={() => setDraft(null)} />}
      {logTask && <LogTimeForm task={logTask} onClose={() => setLogTask(null)} />}
    </Ctx.Provider>
  );
}
