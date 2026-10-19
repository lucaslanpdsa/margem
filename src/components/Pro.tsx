"use client";

import { Lock, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PRICES } from "@/lib/legal";
import { billingEnabled, planOf, type Billing } from "@/lib/plan";
import { auth } from "@/lib/firebase";
import { useStore } from "./store";
import { useNow } from "./Timer";
import { useToast } from "./toast";
import { Button, Modal, Panel, cx } from "./ui";

/** Grátis ou Pro, para a conta conectada. */
export function usePlan() {
  const { user, billing } = useStore();
  const now = useNow(60000);
  return planOf(billing, user?.metadata?.creationTime, now);
}

/** Chama uma rota de assinatura com o token do Firebase. */
async function billingApi(path: string, body?: object) {
  const token = await auth().currentUser?.getIdToken();
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; billing?: Billing; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Algo deu errado. Tente de novo.");
  return data;
}

/** Escolher mensal ou anual e ir para o pagamento no Mercado Pago. */
export function SubscribeDialog({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const option = (p: "monthly" | "yearly", title: string, price: string, note: string) => (
    <button
      type="button"
      onClick={() => setPeriod(p)}
      aria-pressed={period === p}
      className={cx("w-full rounded-xl border-2 p-4 text-left transition-colors", period === p ? "border-brand bg-brand/[0.04]" : "border-line hover:border-muted/40")}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <span className="tabular text-lg font-semibold">{price}</span>
      </span>
      <span className="mt-0.5 block text-[13px] text-muted">{note}</span>
    </button>
  );

  async function go() {
    setBusy(true);
    setError("");
    try {
      const { url } = await billingApi("/api/assinatura", { period });
      window.location.href = url!;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Margem Pro" description="Meta da semana, encaixe para recuperar o atraso e constância." onClose={onClose}>
      <div className="space-y-2">
        {option("yearly", "Anual", PRICES.yearly.label, `${PRICES.yearly.per}, ${PRICES.yearly.note}`)}
        {option("monthly", "Mensal", PRICES.monthly.label, PRICES.monthly.per)}
      </div>
      <p className="mt-3 text-xs text-muted">
        Pagamento pelo Mercado Pago, com renovação automática. Cancele quando quiser no menu da conta. Reembolso integral em até 7 dias.
      </p>
      {error && <p className="mt-3 text-sm text-over">{error}</p>}
      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>
          Agora não
        </Button>
        <Button variant="primary" onClick={go} disabled={busy}>
          {busy ? "Abrindo…" : "Assinar"}
        </Button>
      </div>
    </Modal>
  );
}

/** No lugar de um recurso Pro, para quem está no grátis: o que ele faz e o botão de assinar. */
export function ProLocked({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
          <Lock size={10} /> Pro
        </span>
      </div>
      <p className="mt-1 text-[13px] text-muted">{text}</p>
      <Button size="sm" variant="primary" className="mt-3" onClick={() => setOpen(true)}>
        <Sparkles size={13} /> Conhecer o Pro
      </Button>
      {open && <SubscribeDialog onClose={() => setOpen(false)} />}
    </Panel>
  );
}

/**
 * Mantém billing/{uid} em dia: ao voltar do pagamento (?assinatura=ok) e uma vez por dia.
 * O aviso do Mercado Pago (/api/mercadopago) também atualiza; isto cobre quando o aviso falhar.
 */
export function BillingSync() {
  const { user, billing } = useStore();
  const toast = useToast();
  const done = useRef(false);
  useEffect(() => {
    if (!billingEnabled || !user || done.current) return;
    const back = new URLSearchParams(window.location.search).get("assinatura") === "ok";
    const stale = !billing?.updatedAt || Date.now() - new Date(billing.updatedAt).getTime() > 86400000;
    if (!back && !(billing && stale)) return;
    done.current = true;
    if (back) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    billingApi("/api/assinatura/sincronizar")
      .then(({ billing: b }) => {
        if (back) toast(b?.status === "active" ? "Assinatura confirmada. Bem-vindo ao Pro!" : "Pagamento em análise. O Pro libera assim que for aprovado.", b?.status === "active" ? "ok" : "info");
      })
      .catch(() => back && toast("Não deu para confirmar a assinatura agora. Tente abrir o app de novo.", "error"));
  }, [user, billing, toast]);
  return null;
}

export { billingApi };
