// Grátis ou Pro. Pura e testada: quem decide é a situação gravada pelo servidor (billing/{uid}) e a data de criação da conta.
// Enquanto a cobrança não estiver ligada (NEXT_PUBLIC_BILLING_ENABLED !== "1"), todo mundo tem o Pro.

import { PRICES } from "./legal";

export type BillingStatus = "active" | "pending" | "paused" | "cancelled" | "none";

/** Gravado só pelo servidor em billing/{uid} (as regras do Firestore não deixam o app escrever). */
export interface Billing {
  status: BillingStatus;
  period?: "monthly" | "yearly";
  /** Próxima cobrança (ativa) ou até quando vale o que já foi pago (cancelada). ISO. */
  paidUntil?: string | null;
  preapprovalId?: string | null;
  updatedAt?: string;
}

export const billingEnabled = process.env.NEXT_PUBLIC_BILLING_ENABLED === "1";

export interface Plan {
  pro: boolean;
  /** aberto = cobrança ainda desligada; assinante; teste = dias grátis da conta nova; gratis. */
  reason: "aberto" | "assinante" | "teste" | "gratis";
  trialDaysLeft?: number;
}

const DAY = 86400000;

export function planOf(billing: Billing | null, accountCreatedAt: string | undefined, now: number, enabled = billingEnabled): Plan {
  if (!enabled) return { pro: true, reason: "aberto" };
  const paid = billing?.paidUntil ? new Date(billing.paidUntil).getTime() : 0;
  if (billing?.status === "active") return { pro: true, reason: "assinante" };
  // Cancelada ou pausada continua Pro até o fim do que já foi pago.
  if (paid > now) return { pro: true, reason: "assinante" };
  const created = accountCreatedAt ? new Date(accountCreatedAt).getTime() : NaN;
  if (!Number.isNaN(created)) {
    const left = Math.ceil((created + PRICES.trialDays * DAY - now) / DAY);
    if (left > 0) return { pro: true, reason: "teste", trialDaysLeft: left };
  }
  return { pro: false, reason: "gratis" };
}
