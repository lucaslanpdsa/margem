"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = !!(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | undefined;

// Inicialização preguiçosa: só roda no navegador, quando algo pede.
function getApp() {
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return app;
}

export const auth = (): Auth => getAuth(getApp());
let store: Firestore | undefined;

/**
 * Firestore com cache no aparelho: funciona sem internet (lê o que já tinha e guarda as mudanças
 * para enviar quando voltar), em várias abas ao mesmo tempo.
 */
export function db(): Firestore {
  if (store) return store;
  try {
    store = initializeFirestore(getApp(), { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    // Já inicializado (ex: recarga do módulo em desenvolvimento) ou navegador sem IndexedDB.
    store = getFirestore(getApp());
  }
  return store;
}
