import { caller } from "@/lib/server/admin";
import { ReconnectError, connect, googleConfigured } from "@/lib/server/google";

// Recebe o código da janela do Google ("Conectar Google Agenda") e guarda o acesso de leitura.
export async function POST(req: Request) {
  if (!googleConfigured) return Response.json({ error: "Google Agenda ainda não configurado." }, { status: 503 });
  const who = await caller(req);
  if (!who) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const { code } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || !code) return Response.json({ error: "Código ausente." }, { status: 400 });
  try {
    await connect(who.uid, code);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof ReconnectError) return Response.json({ error: "O Google não liberou o acesso. Tente de novo.", reconnect: true }, { status: 409 });
    console.error(e);
    return Response.json({ error: "Não foi possível conectar o Google Agenda." }, { status: 502 });
  }
}
