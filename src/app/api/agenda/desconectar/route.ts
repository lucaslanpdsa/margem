import { caller } from "@/lib/server/admin";
import { disconnect, googleConfigured } from "@/lib/server/google";

// Tira o acesso ao Google Agenda (revoga no Google e apaga o que estava guardado).
export async function POST(req: Request) {
  if (!googleConfigured) return Response.json({ ok: true });
  const who = await caller(req);
  if (!who) return Response.json({ error: "Não autorizado." }, { status: 401 });
  try {
    await disconnect(who.uid);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Não foi possível desconectar." }, { status: 502 });
  }
}
