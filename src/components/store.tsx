"use client";

import { GoogleAuthProvider, deleteUser, onAuthStateChanged, reauthenticateWithPopup, signInWithPopup, signOut, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dayKey, fromKey, shiftDay, todayKey, weekDays } from "@/lib/dates";
import { addDays, differenceInCalendarDays } from "date-fns";
import { SIGNED_IN_KEY } from "@/lib/legal";
import { deleteUserData, replaceTask, saveSettings, watchBilling, watchDays, watchSessions, watchSettings, watchTasks } from "@/lib/db";
import type { Billing } from "@/lib/plan";
import { migrateTask } from "@/lib/migrate";
import { taskTimeBlocks } from "@/lib/schedule";
import { byDay, rangeFor, type AgendaEvent } from "@/lib/agenda";
import { liveSession, migrateTimer } from "@/lib/timer";
import { auth } from "@/lib/firebase";
import { DEFAULT_SETTINGS, type Block, type DayDoc, type Session, type Settings, type Task } from "@/lib/types";

export interface Store {
  user: User | null;
  uid: string;
  ready: boolean;
  tasks: Task[];
  blocks: Block[];
  sessions: Session[];
  settings: Settings;
  /** Fila e fechamento por dia (users/{uid}/days), do mesmo início dos registros em diante. */
  days: Record<string, DayDoc>;
  /** As configurações já chegaram do banco. */
  settingsReady: boolean;
  /** Tarefas, registros e dias já chegaram (para contas que não podem sair com dados pela metade, como o fechamento). */
  dataReady: boolean;
  /** Dia em foco na tela. */
  date: string;
  setDate: (d: string) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  /** Exclui a conta e todos os dados (LGPD). Pede o Google de novo antes, por segurança. */
  deleteAccount: () => Promise<void>;
  /** Situação da assinatura gravada pelo servidor (null = nunca assinou ou ainda não carregou). */
  billing: Billing | null;
  /** Google Agenda: "off" = não conectado; "reconnect" = o acesso caiu; "error" = não deu para ler agora. */
  agendaStatus?: AgendaStatus;
  /** Lê o Google Agenda de novo agora. */
  refreshAgenda?: () => void;
}

export type AgendaStatus = "off" | "loading" | "ok" | "error" | "reconnect";

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
  const [days, setDays] = useState<Record<string, DayDoc>>({});
  // O que já chegou do banco, por assinatura (com o uid e o início, para não valer o de antes).
  const [arrived, setArrived] = useState<Record<string, string>>({});
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
        setArrived((a) => ({ ...a, tasks: uid }));
      }),
      watchSettings(uid, (s) => {
        // Timer de quando o pomodoro registrava: vira cronômetro (ou some, se era pausa).
        const migrated = migrateTimer(s.activeTimer);
        if (migrated !== undefined) {
          s = { ...s, activeTimer: migrated };
          saveSettings(uid, { activeTimer: migrated });
        }
        setSettings(s);
        setSettingsReady(true);
      }),
      watchBilling(uid, setBilling),
    ];
    return () => subs.forEach((u) => u());
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const key = `${uid}|${fromDate}`;
    const subs = [
      watchSessions(uid, fromDate, (s) => {
        setSessions(s);
        setArrived((a) => ({ ...a, sessions: key }));
      }),
      watchDays(uid, fromDate, (d) => {
        setDays(d);
        setArrived((a) => ({ ...a, days: key }));
      }),
    ];
    return () => subs.forEach((u) => u());
  }, [uid, fromDate]);

  // Google Agenda (só leitura): da semana em foco até 2 semanas depois (e sempre hoje e os próximos 7 dias).
  // Lido do servidor ao abrir, ao mudar de semana, ao voltar para o app e a cada 10 minutos.
  const agendaOn = !!settings.agenda;
  const agendaRange = useMemo(() => {
    const t = todayKey();
    const a = weekDays(date)[0];
    const b = shiftDay(weekDays(date)[6], 7);
    return { first: a < t ? a : t, last: b > shiftDay(t, 7) ? b : shiftDay(t, 7) };
  }, [date]);
  const [agenda, setAgenda] = useState<{ key: string; events: AgendaEvent[]; status: AgendaStatus }>({ key: "", events: [], status: "off" });
  const agendaKey = `${uid}|${agendaRange.first}|${agendaRange.last}`;
  const loadAgenda = useCallback(async () => {
    const u = auth().currentUser;
    if (!u || !agendaOn) return;
    const { from, to } = rangeFor(agendaRange.first, agendaRange.last);
    try {
      const res = await fetch(`/api/agenda?de=${encodeURIComponent(from)}&ate=${encodeURIComponent(to)}`, { headers: { authorization: `Bearer ${await u.getIdToken()}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setAgenda({ key: agendaKey, events: data.events ?? [], status: "ok" });
      // Falhou: mantém o que já tinha (sem internet não apaga os compromissos da tela).
      else setAgenda((p) => ({ ...p, status: data.reconnect ? "reconnect" : "error" }));
    } catch {
      setAgenda((p) => ({ ...p, status: "error" }));
    }
  }, [agendaOn, agendaRange, agendaKey]);
  useEffect(() => {
    if (!uid || !agendaOn) return;
    const first = setTimeout(loadAgenda, 0);
    const id = setInterval(loadAgenda, 10 * 60000);
    const onShow = () => document.visibilityState === "visible" && loadAgenda();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [uid, agendaOn, loadAgenda]);
  const agendaStatus: AgendaStatus = !agendaOn ? "off" : agenda.status === "off" ? "loading" : agenda.status;
  // Os compromissos entram em days[dia].agenda (não é gravado): assim toda conta do dia (dayMetrics) já os vê.
  const daysWithAgenda = useMemo(() => {
    if (!agendaOn || !agenda.events.length || !agenda.key.startsWith(`${uid}|`)) return days;
    const n = differenceInCalendarDays(fromKey(agendaRange.last), fromKey(agendaRange.first)) + 1;
    const dates = Array.from({ length: n }, (_, i) => shiftDay(agendaRange.first, i));
    const map = byDay(agenda.events, dates);
    const out = { ...days };
    for (const [d, list] of Object.entries(map)) out[d] = { ...out[d], agenda: list };
    return out;
  }, [days, agenda, agendaOn, agendaRange, uid]);

  // Horários fixos das tarefas, do início carregado até 2 semanas depois do dia em foco.
  const allBlocks = useMemo(() => {
    const last = shiftDay(weekDays(date)[6], 7);
    const n = differenceInCalendarDays(fromKey(last), fromKey(fromDate)) + 1;
    const dates = Array.from({ length: n }, (_, i) => dayKey(addDays(fromKey(fromDate), i)));
    return taskTimeBlocks(tasks, dates);
  }, [tasks, date, fromDate]);

  // Timer rodando: o tempo dele entra na conta ao vivo, atualizado a cada 30s.
  const [tick, setTick] = useState(() => Date.now());
  const running = !!settings.activeTimer;
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
    days: daysWithAgenda,
    settingsReady,
    dataReady: settingsReady && arrived.tasks === uid && arrived.sessions === `${uid}|${fromDate}` && arrived.days === `${uid}|${fromDate}`,
    date,
    setDate,
    login: async () => {
      await signInWithPopup(auth(), new GoogleAuthProvider());
    },
    logout: () => signOut(auth()),
    billing,
    agendaStatus,
    refreshAgenda: loadAgenda,
    deleteAccount: async () => {
      const u = auth().currentUser;
      if (!u) return;
      // Confirma a identidade primeiro (o Google exige login recente para excluir), só então apaga.
      await reauthenticateWithPopup(u, new GoogleAuthProvider());
      // Tira o acesso ao Google Agenda antes (o que fica guardado no servidor).
      if (settings.agenda) await fetch("/api/agenda/desconectar", { method: "POST", headers: { authorization: `Bearer ${await u.getIdToken()}` } }).catch(() => {});
      await deleteUserData(u.uid);
      await deleteUser(u);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
