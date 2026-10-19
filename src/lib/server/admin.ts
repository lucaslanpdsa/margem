import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Firebase com permissão de servidor: confere quem está chamando e grava billing/{uid},
// que o app não consegue gravar (regras do Firestore).
// FIREBASE_SERVICE_ACCOUNT = o JSON da conta de serviço (Firebase › Configurações › Contas de serviço › Gerar chave).

export const adminConfigured = !!process.env.FIREBASE_SERVICE_ACCOUNT;

function app() {
  if (getApps().length) return getApps()[0];
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
  return initializeApp({ credential: cert(sa) });
}

export const adminDb = () => getFirestore(app());

/** Uid e e-mail de quem chamou, pelo token do Firebase no cabeçalho Authorization. null se inválido. */
export async function caller(req: Request): Promise<{ uid: string; email: string } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  try {
    const d = await getAuth(app()).verifyIdToken(token);
    return { uid: d.uid, email: d.email ?? "" };
  } catch {
    return null;
  }
}
