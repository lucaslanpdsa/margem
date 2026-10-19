"use client";

import { GoogleAuthProvider, deleteUser, onAuthStateChanged, reauthenticateWithPopup, signInWithPopup, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dayKey, fromKey, shiftDay, todayKey, weekDays } from "@/lib/dates";
import { addDays, differenceInCalendarDays } from "date-fns";
import { SIGNED_IN_KEY } from "@/lib/legal";
import { deleteUserData, replaceTask, watchBilling, watchSessions, watchSettings, watchTasks } from "@/lib/db";
import type { Billing } from "@/lib/plan";
import { migrateTask } from "@/lib/migrate";
import { taskTimeBlocks } from "@/lib/schedule";
import { liveSession } from "@/lib/pomodoro";
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
  /** Exclui a conta e todos os dados (LGPD). Pede o Google de novo antes, por segurança. */
  deleteAccount: () => Promise<void>;
  /** Situação da assinatura gravada pelo servidor (null = nunca assinou ou ainda não carregou). */
  billing: Billing | null;
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [date, setDate] = useState(todayKey);

  useEffect(
    () =>
      onAuthStateChanged(auth(), (u) => {
        setUser(u);
        setAuthReady(true);
        // A página inicial (vendas) lê isto para mandar quem já entrou direto para o app.
        try {
          if (u) localStorage.setItem(SIGNED_IN_KEY, "1");
          else localStorage.removeItem(SIGNED_IN_KEY);
        } catch {
          /* sem armazenamento: a página inicial só não redireciona */
        }
      }),
    [],
  );

  const uid = user?.uid ?? "";

  // Carrega a partir do menor entre: semana em foco e o começo da semana de 4 semanas atrás
  // (histórico recente com semanas inteiras, para a constância).
  const fromDate = useMemo(() => {
    const a = weekDays(date)[0];
    const b = weekDays(shiftDay(todayKey(), -28))[0];
    return a < b ? a : b;
  }, [date]);

  useEffect(() => {
    if (!uid) return;
    const subs = [
      watchTasks(uid, (raw) => {
        // Tarefas de versões antigas são convertidas na hora e regravadas no formato atual.
        const migrated = raw.map(migrateTask);
        migrated.filter((m) => m.changed).forEach((m) => replaceTask(uid, m.task));
        setTasks(migrated.map((m) => m.task));
      }),
      watchSettings(uid, (s) => {
        setSettings(s);
        setSettingsReady(true);
      }),
      watchBilling(uid, setBilling),
    ];
    return () => subs.forEach((u) => u());
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const subs = [watchSessions(uid, fromDate, setSessions)];
    return () => subs.forEach((u) => u());
  }, [uid, fromDate]);

  // Horários fixos das tarefas, do início carregado até 2 semanas depois do dia em foco.
  const allBlocks = useMemo(() => {
    const last = shiftDay(weekDays(date)[6], 7);
    const n = differenceInCalendarDays(fromKey(last), fromKey(fromDate)) + 1;
    const dates = Array.from({ length: n }, (_, i) => dayKey(addDays(fromKey(fromDate), i)));
    return taskTimeBlocks(tasks, dates);
  }, [tasks, date, fromDate]);

  // Timer rodando: o tempo dele entra na conta ao vivo, atualizado a cada 30s.
  const [tick, setTick] = useState(() => Date.now());
  const running = !!settings.activeTimer && !settings.activeTimer.waiting && settings.activeTimer.phase === "focus";
  useEffect(() => {
    if (!running) return;
    const first = setTimeout(() => setTick(Date.now()), 0);
    const id = setInterval(() => setTick(Date.now()), 30000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [running, settings.activeTimer?.startedAt]);
  const allSessions = useMemo(() => {
    const live = liveSession(settings.activeTimer, tick);
    return live ? [...sessions, live] : sessions;
  }, [sessions, settings.activeTimer, tick]);

  const value: Store = {
    user,
    uid,
    ready: authReady,
    tasks,
    blocks: allBlocks,
    sessions: allSessions,
    settings,
    settingsReady,
    date,
    setDate,
    login: async () => {
      await signInWithPopup(auth(), new GoogleAuthProvider());
    },
    logout: () => signOut(auth()),
    billing,
    deleteAccount: async () => {
      const u = auth().currentUser;
      if (!u) return;
      // Confirma a identidade primeiro (o Google exige login recente para excluir), só então apaga.
      await reauthenticateWithPopup(u, new GoogleAuthProvider());
      await deleteUserData(u.uid);
      await deleteUser(u);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
