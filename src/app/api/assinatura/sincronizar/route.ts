import { caller } from "@/lib/server/admin";
import { mpConfigured, syncBilling } from "@/lib/server/mercadopago";

// Atualiza billing/{uid} a partir do Mercado Pago (ao voltar do pagamento e de tempos em tempos).
export async function POST(req: Request) {
  if (!mpConfigured) return Response.json({ error: "Pagamento ainda não configurado." }, { status: 503 });
  const who = await caller(req);
  if (!who) return Response.json({ error: "Não autorizado." }, { status: 401 });
  try {
    return Response.json({ billing: await syncBilling(who.uid) });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Não foi possível consultar a assinatura." }, { status: 502 });
  }
}
