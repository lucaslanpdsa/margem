import { caller } from "@/lib/server/admin";
import { cancelSubscription, mpConfigured } from "@/lib/server/mercadopago";

// Cancela a assinatura; o Pro continua até o fim do período pago.
export async function POST(req: Request) {
  if (!mpConfigured) return Response.json({ error: "Pagamento ainda não configurado." }, { status: 503 });
  const who = await caller(req);
  if (!who) return Response.json({ error: "Não autorizado." }, { status: 401 });
  try {
    return Response.json({ billing: await cancelSubscription(who.uid) });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Não foi possível cancelar. Tente de novo ou cancele no Mercado Pago." }, { status: 502 });
  }
}
