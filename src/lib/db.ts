"use client";

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  deleteField,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { PREVIEW_UID } from "./preview";
import { DEFAULT_SETTINGS, type Session, type Settings, type Task } from "./types";

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

export function toggleDone(uid: string, task: Task, date: string, done: boolean) {
  if (task.repeat === "weekdays") {
    return write(uid, () => updateDoc(doc(db(), "users", uid, "tasks", task.id), { [`completions.${date}`]: done }));
  }
  return write(uid, () => setDoc(doc(db(), "users", uid, "tasks", task.id), { completedAt: done ? new Date().toISOString() : null }, { merge: true }));
}

/** Pular (ou desfazer o pulo de) uma tarefa que repete, só neste dia. */
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

// ---------- Configurações ----------

/** Cada campo enviado é substituído por inteiro (mapas inclusive), os outros são mantidos. */
export const saveSettings = (uid: string, patch: Partial<Settings>) =>
  write(uid, () => setDoc(settingsRef(uid), patch, { mergeFields: Object.keys(patch) }));
