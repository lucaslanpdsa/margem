"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

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
export const db = (): Firestore => getFirestore(getApp());
