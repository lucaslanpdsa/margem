import { caller } from "@/lib/server/admin";
import { ReconnectError, events, googleConfigured } from "@/lib/server/google";

// Compromissos do Google Agenda entre ?de= e ?ate= (ISO). O app calcula o intervalo no fuso da pessoa.
export async function GET(req: Request) {
  if (!googleConfigured) return Response.json({ error: "Google Agenda ainda não configurado." }, { status: 503 });
  const who = await caller(req);
  if (!who) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const from = q.get("de");
  const to = q.get("ate");
  if (!from || !to || isNaN(Date.parse(from)) || isNaN(Date.parse(to))) return Response.json({ error: "Intervalo inválido." }, { status: 400 });
  try {
    return Response.json({ events: await events(who.uid, from, to) });
  } catch (e) {
    if (e instanceof ReconnectError) return Response.json({ error: "Conecte o Google Agenda de novo.", reconnect: true }, { status: 409 });
    console.error(e);
    return Response.json({ error: "Não foi possível ler o Google Agenda." }, { status: 502 });
  }
}
