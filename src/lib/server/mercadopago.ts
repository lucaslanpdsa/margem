import "server-only";
import { PRICES } from "@/lib/legal";
import type { Billing } from "@/lib/plan";
import { adminConfigured, adminDb } from "./admin";

// Assinatura no Mercado Pago, sem plano cadastrado (preapproval): o link de pagamento é criado na hora.
// A situação é sempre lida da API do Mercado Pago com o nosso token: um aviso falso não libera o Pro.
// MP_ACCESS_TOKEN = Mercado Pago › Suas integrações › Credenciais de produção › Access token.

const API = "https://api.mercadopago.com";
export const mpConfigured = !!process.env.MP_ACCESS_TOKEN && adminConfigured;

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

interface Preapproval {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  external_reference?: string;
  next_payment_date?: string;
  date_created?: string;
  auto_recurring?: { frequency: number; frequency_type: string };
  init_point?: string;
}

/** Cria a assinatura pendente e devolve o link onde a pessoa paga. */
export async function createSubscription(uid: string, email: string, period: "monthly" | "yearly", siteUrl: string) {
  const yearly = period === "yearly";
  const p = await mp<Preapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: yearly ? "Margem Pro (anual)" : "Margem Pro (mensal)",
      external_reference: uid,
      payer_email: email,
      auto_recurring: {
        frequency: yearly ? 12 : 1,
        frequency_type: "months",
        transaction_amount: yearly ? PRICES.yearly.amount : PRICES.monthly.amount,
        currency_id: "BRL",
      },
      back_url: `${siteUrl}/app?assinatura=ok`,
      status: "pending",
    }),
  });
  return p.init_point!;
}

const toBilling = (p: Preapproval | undefined): Billing => {
  if (!p) return { status: "none", updatedAt: new Date().toISOString() };
  const status = p.status === "authorized" ? "active" : p.status;
  return {
    status,
    period: p.auto_recurring?.frequency === 12 ? "yearly" : "monthly",
    paidUntil: p.next_payment_date ?? null,
    preapprovalId: p.id,
    updatedAt: new Date().toISOString(),
  };
};

/** Lê no Mercado Pago a assinatura mais relevante da pessoa (ativa primeiro) e grava em billing/{uid}. */
export async function syncBilling(uid: string): Promise<Billing> {
  const { results } = await mp<{ results: Preapproval[] }>(`/preapproval/search?external_reference=${encodeURIComponent(uid)}`);
  const sorted = [...(results ?? [])].sort((a, b) => (b.date_created ?? "").localeCompare(a.date_created ?? ""));
  const best = sorted.find((p) => p.status === "authorized") ?? sorted.find((p) => p.status !== "pending") ?? sorted[0];
  const billing = toBilling(best);
  await adminDb().doc(`billing/${uid}`).set(billing);
  return billing;
}

/** Aviso do Mercado Pago: descobre de quem é a assinatura e sincroniza. */
export async function syncFromPreapproval(id: string) {
  const p = await mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`);
  if (p.external_reference) await syncBilling(p.external_reference);
}

/** Cancela a assinatura ativa (o Pro continua até o fim do período pago). */
export async function cancelSubscription(uid: string) {
  const current = await syncBilling(uid);
  if (current.preapprovalId && current.status !== "cancelled") {
    await mp(`/preapproval/${current.preapprovalId}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  }
  return syncBilling(uid);
}
