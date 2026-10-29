"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  deleteField,
  documentId,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { PREVIEW_UID } from "./preview";
import type { Billing } from "./plan";
import { estKey, estimateOn } from "./calibration";
import { DEFAULT_SETTINGS, type DayDoc, type Goal, type Session, type Settings, type Task } from "./types";

const col = (uid: string, name: string) => collection(db(), "users", uid, name);

// ---------- Gravação ----------

type SaveErrorListener = (error: unknown) => void;
const saveErrorListeners = new Set<SaveErrorListener>();

/** Avisa quem quiser (o aviso do rodapé) quando uma gravação falha. */
export function onSaveError(cb: SaveErrorListener) {
  saveErrorListeners.add(cb);
  return () => {
    saveErrorListeners.delete(cb);
  };
}

/**
 * Envolve uma gravação no Firestore:
 * - se falhar, avisa (onSaveError) em vez de sumir em silêncio;
 * - não prende a tela sem internet: a promessa do Firestore só termina quando o servidor confirma,
 *   então resolve no que vier primeiro, a confirmação ou 1,2s (a mudança já está no cache local).
 * Nunca rejeita.
 */
export function saved(p: Promise<unknown>): Promise<void> {
  const done = p.then(
    () => undefined,
    (e) => {
      console.error("Margem: não foi possível salvar", e);
      saveErrorListeners.forEach((cb) => cb(e));
    },
  );
  return Promise.race([done, new Promise<void>((r) => setTimeout(r, 1200))]);
}
const settingsRef = (uid: string) => doc(db(), "users", uid, "meta", "settings");

/** Firestore não aceita campos undefined. */
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/** Grava com saved(); na prévia (/dev) não há banco, então não faz nada. */
export function write(uid: string, make: () => Promise<unknown>): Promise<void> {
  if (uid === PREVIEW_UID) return Promise.resolve();
  return saved(make());
}

// ---------- Assinaturas em tempo real ----------

export function watchTasks(uid: string, cb: (t: Task[]) => void): Unsubscribe {
  return onSnapshot(col(uid, "tasks"), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Task, "id">), id: d.id }))),
  );
}

export function watchSessions(uid: string, fromDate: string, cb: (s: Session[]) => void): Unsubscribe {
  return onSnapshot(query(col(uid, "sessions"), where("date", ">=", fromDate)), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Session, "id">), id: d.id }))),
  );
}

/** Todos os registros de uma tarefa (histórico completo, para a janela da tarefa). */
export function watchTaskSessions(uid: string, taskId: string, cb: (s: Session[]) => void): Unsubscribe {
  return onSnapshot(query(col(uid, "sessions"), where("taskId", "==", taskId)), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Session, "id">), id: d.id }))),
  );
}

export function watchSettings(uid: string, cb: (s: Settings) => void): Unsubscribe {
  return onSnapshot(settingsRef(uid), (snap) => cb({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings>) }));
}

// ---------- Tarefas ----------

/** Cria a tarefa; devolve o id (para desfazer). */
export async function addTask(uid: string, task: Omit<Task, "id" | "createdAt">) {
  const ref = uid === PREVIEW_UID ? { id: `preview-${Date.now()}` } : doc(col(uid, "tasks"));
  await write(uid, () => setDoc(ref as ReturnType<typeof doc>, clean({ ...task, createdAt: new Date().toISOString() })));
  return ref.id;
}

export const updateTask = (uid: string, id: string, patch: Partial<Task>) =>
  write(uid, () => updateDoc(doc(db(), "users", uid, "tasks", id), clean(patch) as Record<string, unknown>));

/** Substitui a tarefa inteira (usado no formulário de edição, para limpar campos removidos). */
export const replaceTask = (uid: string, task: Task) => {
  const { id, ...data } = task;
  return write(uid, () => setDoc(doc(db(), "users", uid, "tasks", id), clean(data)));
};

export const deleteTask = (uid: string, id: string) => write(uid, () => deleteDoc(doc(db(), "users", uid, "tasks", id)));

/** Concluir ou reabrir. Ao concluir, guarda a estimativa daquele momento (estimado vs. realizado, calibration.ts). */
export function toggleDone(uid: string, task: Task, date: string, done: boolean) {
  const est = { [`estAtDone.${estKey(task, date)}`]: done ? estimateOn(task, date) : deleteField() };
  const ref = doc(db(), "users", uid, "tasks", task.id);
  if (task.repeat === "weekdays") return write(uid, () => updateDoc(ref, { [`completions.${date}`]: done, ...est }));
  return write(uid, () => updateDoc(ref, { completedAt: done ? new Date().toISOString() : null, ...est }));
}

/** Pular (ou desfazer o pulo de) uma tarefa que repete, só neste dia. */
/** Objetivos de um dia da tarefa (lista vazia apaga o dia). Chave: goalsKey (dia ou "_"). */
export const setGoals = (uid: string, task: Task, key: string, goals: Goal[]) =>
  write(uid, () => updateDoc(doc(db(), "users", uid, "tasks", task.id), { [`goals.${key}`]: goals.length ? goals : deleteField() }));

export const setSkipped = (uid: string, task: Task, date: string, skipped: boolean) =>
  write(uid, () => updateDoc(doc(db(), "users", uid, "tasks", task.id), { [`skipped.${date}`]: skipped, [`completions.${date}`]: false }));

/** Tempo só deste dia (ex: encurtar hoje); null volta ao tempo normal. */
export const setDayEstimate = (uid: string, task: Task, date: string, minutes: number | null) =>
  write(uid, () => updateDoc(doc(db(), "users", uid, "tasks", task.id), { [`estimateFor.${date}`]: minutes === null ? deleteField() : minutes }));

// ---------- Sessões ----------

/** Cria o registro; devolve o id (para desfazer). */
export async function addSession(uid: string, s: Omit<Session, "id">) {
  const ref = uid === PREVIEW_UID ? { id: `preview-${Date.now()}` } : doc(col(uid, "sessions"));
  await write(uid, () => setDoc(ref as ReturnType<typeof doc>, clean(s)));
  return ref.id;
}
export const updateSession = (uid: string, id: string, patch: Partial<Session>) => write(uid, () => updateDoc(doc(db(), "users", uid, "sessions", id), patch));
export const deleteSession = (uid: string, id: string) => write(uid, () => deleteDoc(doc(db(), "users", uid, "sessions", id)));
/** Regrava um registro apagado, com o mesmo id (desfazer). */
export const restoreSession = (uid: string, s: Session) => {
  const { id, ...data } = s;
  return write(uid, () => setDoc(doc(db(), "users", uid, "sessions", id), clean(data)));
};

// ---------- Dias (fila e fechamento) ----------

/** Dias a partir de `fromDate` (inclusive), por chave "yyyy-MM-dd". */
export function watchDays(uid: string, fromDate: string, cb: (d: Record<string, DayDoc>) => void): Unsubscribe {
  return onSnapshot(query(col(uid, "days"), where(documentId(), ">=", fromDate)), (snap) =>
    cb(Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as DayDoc]))),
  );
}

const dayRef = (uid: string, date: string) => doc(db(), "users", uid, "days", date);

/** Fila do dia (ids na ordem). */
export const setDayOrder = (uid: string, date: string, order: string[]) => write(uid, () => setDoc(dayRef(uid, date), { order }, { merge: true }));

/** Fotografia do dia que passou (fechamento). */
export const closeDay = (uid: string, date: string, snap: Pick<DayDoc, "plannedMin" | "doneMin">) =>
  write(uid, () => setDoc(dayRef(uid, date), { ...snap, closedAt: new Date().toISOString() }, { merge: true }));

// ---------- Configurações ----------

/** Cada campo enviado é substituído por inteiro (mapas inclusive), os outros são mantidos. */
export const saveSettings = (uid: string, patch: Partial<Settings>) =>
  write(uid, () => setDoc(settingsRef(uid), patch, { mergeFields: Object.keys(patch) }));

// ---------- Seus dados (LGPD) ----------

const USER_COLLECTIONS = ["tasks", "sessions", "meta", "days"] as const;

/** Tudo da conta num objeto só, para baixar como arquivo (direito de acesso e portabilidade). */
export async function exportUserData(uid: string) {
  const out: Record<string, unknown[]> = {};
  for (const name of USER_COLLECTIONS) {
    const snap = await getDocs(col(uid, name));
    out[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return out;
}

/**
 * Apaga todos os documentos da conta (direito de exclusão). Lotes de até 450 escritas (o limite é 500).
 * Diferente das outras gravações, aqui o erro sobe: quem chama precisa saber se apagou mesmo.
 */
export async function deleteUserData(uid: string) {
  for (const name of USER_COLLECTIONS) {
    const snap = await getDocs(col(uid, name));
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = writeBatch(db());
      snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}

// ---------- Assinatura ----------

/** Situação da assinatura (só leitura: quem grava é o servidor). Sem permissão ou sem documento = null. */
export function watchBilling(uid: string, cb: (b: Billing | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db(), "billing", uid),
    (snap) => cb(snap.exists() ? (snap.data() as Billing) : null),
    () => cb(null),
  );
}
