"use client";

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dayKey, fromKey, shiftDay, todayKey, weekDays } from "@/lib/dates";
import { addDays, differenceInCalendarDays } from "date-fns";
import { watchBlocks, watchSessions, watchSettings, watchTasks } from "@/lib/db";
import { taskTimeBlocks } from "@/lib/schedule";
import { auth } from "@/lib/firebase";
import { DEFAULT_SETTINGS, type Block, type Session, type Settings, type Task } from "@/lib/types";

export interface Store {
  user: User | null;
  uid: string;
  ready: boolean;
  tasks: Task[];
  blocks: Block[];
  sessions: Session[];
  settings: Settings;
  /** As configurações já chegaram do banco. */
  settingsReady: boolean;
  /** Dia em foco na tela. */
  date: string;
  setDate: (d: string) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const StoreCtx = createContext<Store | null>(null);
const Ctx = StoreCtx;

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [date, setDate] = useState(todayKey);

  useEffect(
    () =>
      onAuthStateChanged(auth(), (u) => {
        setUser(u);
        setAuthReady(true);
      }),
    [],
  );

  const uid = user?.uid ?? "";

  // Carrega a partir do menor entre: semana em foco e 4 semanas atrás (para metas e histórico recente).
  const fromDate = useMemo(() => {
    const a = weekDays(date)[0];
    const b = shiftDay(todayKey(), -28);
    return a < b ? a : b;
  }, [date]);

  useEffect(() => {
    if (!uid) return;
    const subs = [
      watchTasks(uid, setTasks),
      watchSettings(uid, (s) => {
        setSettings(s);
        setSettingsReady(true);
      }),
    ];
    return () => subs.forEach((u) => u());
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const subs = [watchBlocks(uid, fromDate, setBlocks), watchSessions(uid, fromDate, setSessions)];
    return () => subs.forEach((u) => u());
  }, [uid, fromDate]);

  // Blocos reais + horários fixos das tarefas, do início carregado até 2 semanas depois do dia em foco.
  const allBlocks = useMemo(() => {
    const last = shiftDay(weekDays(date)[6], 7);
    const n = differenceInCalendarDays(fromKey(last), fromKey(fromDate)) + 1;
    const dates = Array.from({ length: n }, (_, i) => dayKey(addDays(fromKey(fromDate), i)));
    return [...blocks, ...taskTimeBlocks(tasks, blocks, dates)];
  }, [blocks, tasks, date, fromDate]);

  const value: Store = {
    user,
    uid,
    ready: authReady,
    tasks,
    blocks: allBlocks,
    sessions,
    settings,
    settingsReady,
    date,
    setDate,
    login: async () => {
      await signInWithPopup(auth(), new GoogleAuthProvider());
    },
    logout: () => signOut(auth()),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
