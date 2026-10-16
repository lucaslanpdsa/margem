"use client";

import {
  addDoc,
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
import { DEFAULT_SETTINGS, type Session, type Settings, type Task } from "./types";

const col = (uid: string, name: string) => collection(db(), "users", uid, name);
const settingsRef = (uid: string) => doc(db(), "users", uid, "meta", "settings");

/** Firestore não aceita campos undefined. */
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
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

export function watchSettings(uid: string, cb: (s: Settings) => void): Unsubscribe {
  return onSnapshot(settingsRef(uid), (snap) => cb({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings>) }));
}

// ---------- Tarefas ----------

export const addTask = (uid: string, task: Omit<Task, "id" | "createdAt">) =>
  addDoc(col(uid, "tasks"), clean({ ...task, createdAt: new Date().toISOString() }));

export const updateTask = (uid: string, id: string, patch: Partial<Task>) =>
  updateDoc(doc(db(), "users", uid, "tasks", id), clean(patch) as Record<string, unknown>);

/** Substitui a tarefa inteira (usado no formulário de edição, para limpar campos removidos). */
export const replaceTask = (uid: string, task: Task) => {
  const { id, ...data } = task;
  return setDoc(doc(db(), "users", uid, "tasks", id), clean(data));
};

export const deleteTask = (uid: string, id: string) => deleteDoc(doc(db(), "users", uid, "tasks", id));

export function toggleDone(uid: string, task: Task, date: string, done: boolean) {
  if (task.repeat === "weekdays") {
    return updateDoc(doc(db(), "users", uid, "tasks", task.id), { [`completions.${date}`]: done });
  }
  return setDoc(
    doc(db(), "users", uid, "tasks", task.id),
    { completedAt: done ? new Date().toISOString() : null },
    { merge: true },
  );
}

/** Pular (ou desfazer o pulo de) uma tarefa que repete, só neste dia. */
export const setSkipped = (uid: string, task: Task, date: string, skipped: boolean) =>
  updateDoc(doc(db(), "users", uid, "tasks", task.id), { [`skipped.${date}`]: skipped, [`completions.${date}`]: false });

/** Tempo só deste dia (ex: encurtar hoje); null volta ao tempo normal. */
export const setDayEstimate = (uid: string, task: Task, date: string, minutes: number | null) =>
  updateDoc(doc(db(), "users", uid, "tasks", task.id), { [`estimateFor.${date}`]: minutes === null ? deleteField() : minutes });

// ---------- Sessões ----------

export const addSession = (uid: string, s: Omit<Session, "id">) => addDoc(col(uid, "sessions"), s);
export const updateSession = (uid: string, id: string, patch: Partial<Session>) =>
  updateDoc(doc(db(), "users", uid, "sessions", id), patch);
export const deleteSession = (uid: string, id: string) => deleteDoc(doc(db(), "users", uid, "sessions", id));

// ---------- Configurações ----------

/** Cada campo enviado é substituído por inteiro (mapas inclusive), os outros são mantidos. */
export const saveSettings = (uid: string, patch: Partial<Settings>) =>
  setDoc(settingsRef(uid), patch, { mergeFields: Object.keys(patch) });
