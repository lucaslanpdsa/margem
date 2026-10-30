import "server-only";
import { adminDb } from "./admin";

// Google Agenda, só leitura. O acesso permanente (refresh token) fica em agenda/{uid}, que só o servidor lê e grava
// (regras do Firestore negam tudo ao app). O app nunca vê o token: ele pede os eventos para /api/agenda.
// GOOGLE_CLIENT_ID (= NEXT_PUBLIC_GOOGLE_CLIENT_ID) e GOOGLE_CLIENT_SECRET: Google Cloud › APIs e serviços › Credenciais.

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
export const googleConfigured = !!(CLIENT_ID && CLIENT_SECRET && process.env.FIREBASE_SERVICE_ACCOUNT);

/** Acesso tirado pela pessoa (no Google) ou expirado: precisa conectar de novo. */
export class ReconnectError extends Error {}

const ref = (uid: string) => adminDb().collection("agenda").doc(uid);

async function token(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...body }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.error === "invalid_grant") throw new ReconnectError();
    throw new Error(`Google token: ${data.error ?? res.status}`);
  }
  return data as { access_token: string; refresh_token?: string; scope?: string };
}

/** Troca o código do botão "Conectar" (janela do Google) pelo acesso permanente e guarda. */
export async function connect(uid: string, code: string) {
  // "postmessage" = o código veio da janela do Google aberta pelo próprio app (Google Identity Services).
  const t = await token({ code, grant_type: "authorization_code", redirect_uri: "postmessage" });
  if (!t.scope?.includes("calendar")) throw new Error("Sem permissão de agenda.");
  const prev = (await ref(uid).get()).data();
  // O Google só manda o refresh token na primeira vez; ao reconectar, vale o que já estava guardado.
  const refresh = t.refresh_token ?? prev?.refreshToken;
  if (!refresh) throw new ReconnectError();
  await ref(uid).set({ refreshToken: refresh, updatedAt: new Date().toISOString() });
}

export async function disconnect(uid: string) {
  const prev = (await ref(uid).get()).data();
  if (prev?.refreshToken) {
    await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", body: new URLSearchParams({ token: prev.refreshToken }) }).catch(() => {});
  }
  await ref(uid).delete();
}

async function accessToken(uid: string) {
  const prev = (await ref(uid).get()).data();
  if (!prev?.refreshToken) throw new ReconnectError();
  try {
    return (await token({ refresh_token: prev.refreshToken, grant_type: "refresh_token" })).access_token;
  } catch (e) {
    if (e instanceof ReconnectError) await ref(uid).delete();
    throw e;
  }
}

async function get<T>(at: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${at}` }, cache: "no-store" });
  if (res.status === 401 || res.status === 403) throw new ReconnectError();
  if (!res.ok) throw new Error(`Google Agenda: ${res.status}`);
  return res.json();
}

/** Evento como o app usa (ver agenda.ts). */
export interface RawEvent {
  id: string;
  title: string;
  /** ISO com fuso (com horário) ou "yyyy-MM-dd" (dia inteiro). */
  start: string;
  end: string;
  allDay: boolean;
  /** Marcado como "Disponível" no Google: não ocupa tempo. */
  free: boolean;
}

interface GEvent {
  id: string;
  status?: string;
  summary?: string;
  transparency?: string;
  eventType?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
}

/** Eventos entre timeMin e timeMax (ISO) das agendas marcadas como visíveis no Google. */
export async function events(uid: string, timeMin: string, timeMax: string): Promise<RawEvent[]> {
  const at = await accessToken(uid);
  const list = await get<{ items: { id: string; selected?: boolean; primary?: boolean; hidden?: boolean }[] }>(
    at,
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
  );
  // As mesmas agendas que a pessoa vê marcadas no Google Agenda (e sempre a principal).
  const cals = list.items.filter((c) => !c.hidden && (c.primary || c.selected));
  const all = await Promise.all(
    cals.map(async (c) => {
      const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
      const r = await get<{ items: GEvent[] }>(at, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.id)}/events?${q}`);
      return r.items;
    }),
  );
  const out: RawEvent[] = [];
  const seen = new Set<string>();
  for (const e of all.flat()) {
    if (e.status === "cancelled" || seen.has(e.id)) continue;
    // Convite recusado não ocupa a agenda.
    if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
    // "Fora do escritório" e "Local de trabalho" não são compromissos.
    if (e.eventType === "workingLocation" || e.eventType === "outOfOffice") continue;
    const start = e.start?.dateTime ?? e.start?.date;
    const end = e.end?.dateTime ?? e.end?.date;
    if (!start || !end) continue;
    seen.add(e.id);
    out.push({ id: e.id, title: e.summary?.trim() || "(sem título)", start, end, allDay: !e.start?.dateTime, free: e.transparency === "transparent" });
  }
  return out;
}
