import { mpConfigured, syncFromPreapproval } from "@/lib/server/mercadopago";

// Avisos do Mercado Pago (URL de notificação: /api/mercadopago).
// Não confiamos no conteúdo do aviso: só usamos o id para buscar a assinatura na API com o nosso token.
export async function POST(req: Request) {
  if (!mpConfigured) return new Response(null, { status: 200 });
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string } };
  const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (id && type?.startsWith("subscription_preapproval") && type !== "subscription_preapproval_plan") {
    try {
      await syncFromPreapproval(id);
    } catch (e) {
      console.error(e);
      // Erro faz o Mercado Pago tentar de novo mais tarde.
      return new Response(null, { status: 500 });
    }
  }
  return new Response(null, { status: 200 });
}
