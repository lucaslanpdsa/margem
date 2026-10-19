import { caller } from "@/lib/server/admin";
import { createSubscription, mpConfigured } from "@/lib/server/mercadopago";

// Cria a assinatura no Mercado Pago e devolve o link de pagamento.
export async function POST(req: Request) {
  if (!mpConfigured) return Response.json({ error: "Pagamento ainda não configurado." }, { status: 503 });
  const who = await caller(req);
  if (!who) return Response.json({ error: "Entre de novo para assinar." }, { status: 401 });
  const { period } = (await req.json().catch(() => ({}))) as { period?: string };
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  try {
    const url = await createSubscription(who.uid, who.email, period === "yearly" ? "yearly" : "monthly", site);
    return Response.json({ url });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Não foi possível abrir o pagamento. Tente de novo." }, { status: 502 });
  }
}
