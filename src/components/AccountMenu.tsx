"use client";

import { Bell, BellOff, CircleHelp, Database, LogOut, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fromKey } from "@/lib/dates";
import { exportUserData } from "@/lib/db";
import { LEGAL } from "@/lib/legal";
import { billingApi, SubscribeDialog, usePlan } from "./Pro";
import { useStore } from "./store";
import { useToast } from "./toast";
import { Button, Modal, cx } from "./ui";

type Perm = NotificationPermission | "unsupported";
const readPerm = (): Perm => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

/** Foto ou inicial do usuário. */
function Avatar({ size = 28 }: { size?: number }) {
  const { user } = useStore();
  const style = { width: size, height: size };
  if (user?.photoURL)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.photoURL} alt="" style={style} className="shrink-0 rounded-full" referrerPolicy="no-referrer" />;
  return (
    <span style={style} className="grid shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold">
      {(user?.displayName ?? user?.email ?? "?")[0].toUpperCase()}
    </span>
  );
}

/**
 * Menu da conta: quem está conectado, notificações, como funciona e sair.
 * É o lugar fixo dessas coisas (antes espalhadas entre Tarefas, Foco e a barra lateral).
 */
export function AccountMenu({ onHelp, variant }: { onHelp: () => void; variant: "header" | "sidebar" | "sidebar-collapsed" }) {
  const { user, logout } = useStore();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"dados" | "assinar" | "assinatura" | null>(null);
  const plan = usePlan();
  const show = (d: typeof dialog) => {
    setOpen(false);
    setDialog(d);
  };
  const [perm, setPerm] = useState<Perm>("unsupported");
  const toggle = () => {
    setPerm(readPerm());
    setOpen((v) => !v);
  };

  const trigger =
    variant === "sidebar" ? (
      <button onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-sunken">
        <Avatar />
        <span className="min-w-0 flex-1 truncate text-[13px]">{user?.displayName ?? user?.email}</span>
      </button>
    ) : (
      <button onClick={toggle} aria-expanded={open} aria-label="Conta e ajuda" title="Conta e ajuda" className="grid h-10 w-10 place-items-center rounded-full hover:bg-sunken">
        <Avatar size={variant === "header" ? 30 : 28} />
      </button>
    );

  return (
    <div className="relative">
      {trigger}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cx(
              "absolute z-50 w-72 rounded-2xl border border-line bg-surface p-2 shadow-xl",
              variant === "header" ? "top-full right-0 mt-2" : "bottom-full left-0 mb-2",
            )}
          >
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.displayName ?? "Você"}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
            </div>
            <div className="my-1 border-t border-line" />

            <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm">
              {perm === "granted" ? <Bell size={17} className="text-done" /> : <BellOff size={17} className="text-muted" />}
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Notificações</span>
                <span className="block text-xs text-muted">
                  {perm === "granted" && "Ativadas: avisos do timer e do horário das tarefas."}
                  {perm === "default" && "Para avisar no fim do timer e no horário das tarefas."}
                  {perm === "denied" && "Bloqueadas. Libere nas configurações do navegador para este site."}
                  {perm === "unsupported" && "Este navegador não permite notificações."}
                </span>
              </span>
              {perm === "default" && (
                <button onClick={() => Notification.requestPermission().then(setPerm)} className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-ink">
                  Ativar
                </button>
              )}
            </div>

            {/* Plano: só aparece com a cobrança ligada. */}
            {plan.reason !== "aberto" && (
              <MenuButton onClick={() => show(plan.reason === "assinante" ? "assinatura" : "assinar")}>
                <Sparkles size={17} className={plan.pro ? "text-accent" : "text-muted"} />
                <span className="min-w-0 flex-1">
                  <span className="block">{plan.reason === "assinante" ? "Assinatura Pro" : plan.reason === "teste" ? "Pro grátis" : "Plano grátis"}</span>
                  <span className="block text-xs font-normal text-muted">
                    {plan.reason === "teste" && `Faltam ${plan.trialDaysLeft} ${plan.trialDaysLeft === 1 ? "dia" : "dias"} · Assinar`}
                    {plan.reason === "gratis" && "Conhecer o Pro"}
                    {plan.reason === "assinante" && "Ver ou cancelar"}
                  </span>
                </span>
              </MenuButton>
            )}
            <MenuButton onClick={() => show("dados")}>
              <Database size={17} className="text-muted" /> Seus dados
            </MenuButton>
            <MenuButton
              onClick={() => {
                setOpen(false);
                onHelp();
              }}
            >
              <CircleHelp size={17} className="text-muted" /> Como funciona
            </MenuButton>
            <MenuButton onClick={logout}>
              <LogOut size={17} className="text-muted" /> Sair
            </MenuButton>
            <div className="mt-1 flex gap-3 border-t border-line px-2 pt-2 pb-1 text-xs text-muted">
              <a href="/privacidade" target="_blank" rel="noreferrer" className="hover:text-ink">
                Privacidade
              </a>
              <a href="/termos" target="_blank" rel="noreferrer" className="hover:text-ink">
                Termos
              </a>
            </div>
          </div>
        </>
      )}
      {dialog === "dados" && <DataDialog onClose={() => setDialog(null)} />}
      {dialog === "assinar" && <SubscribeDialog onClose={() => setDialog(null)} />}
      {dialog === "assinatura" && <SubscriptionDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

const fmtDate = (iso?: string | null) => (iso ? fromKey(iso.slice(0, 10)).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");

/** Assinatura ativa ou cancelada: até quando vale e cancelar. */
function SubscriptionDialog({ onClose }: { onClose: () => void }) {
  const { billing } = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = billing?.status === "active";
  async function cancel() {
    setBusy(true);
    try {
      await billingApi("/api/assinatura/cancelar");
      toast("Assinatura cancelada. O Pro continua até o fim do período pago.", "info");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }
  return (
    <Modal title="Assinatura Pro" onClose={onClose}>
      <div className="rounded-xl bg-sunken p-4 text-sm">
        <p className="font-semibold">{billing?.period === "yearly" ? "Anual" : "Mensal"}</p>
        <p className="mt-1 text-muted">
          {active ? `Próxima cobrança em ${fmtDate(billing?.paidUntil)}.` : `Cancelada. O Pro vale até ${fmtDate(billing?.paidUntil)}.`}
        </p>
      </div>
      {active &&
        (confirm ? (
          <div className="mt-4 rounded-xl border border-over/30 p-4 text-sm">
            <p>Cancelar a renovação? Você continua com o Pro até {fmtDate(billing?.paidUntil)} e não há nova cobrança.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Voltar
              </Button>
              <Button variant="danger" className="border border-over/40" onClick={cancel} disabled={busy}>
                {busy ? "Cancelando…" : "Cancelar assinatura"}
              </Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="mt-4 text-sm font-medium text-over hover:underline">
            Cancelar assinatura
          </button>
        ))}
      <p className="mt-4 text-xs text-muted">Reembolso em até 7 dias da primeira cobrança: escreva para {LEGAL.contactEmail || "o contato da página de termos"}.</p>
    </Modal>
  );
}

/** Seus dados (LGPD): baixar tudo e excluir a conta. */
function DataDialog({ onClose }: { onClose: () => void }) {
  const { uid, deleteAccount } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState<"menu" | "excluir">("menu");
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const data = await exportUserData(uid);
      const blob = new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "margem-meus-dados.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast("Não foi possível baixar agora. Confira a internet.", "error");
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteAccount();
      router.replace("/?site");
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast(code === "auth/popup-closed-by-user" ? "Exclusão cancelada." : "Não foi possível excluir. Tente de novo.", code === "auth/popup-closed-by-user" ? "info" : "error");
      setBusy(false);
    }
  }

  return (
    <Modal title="Seus dados" description="Tudo o que o Margem guarda é seu: horário, tarefas, registros e preferências." onClose={onClose}>
      {step === "menu" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-line p-4">
            <p className="text-sm font-semibold">Baixar meus dados</p>
            <p className="mt-0.5 text-[13px] text-muted">Um arquivo com tudo da sua conta, para guardar ou levar para outro lugar.</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={download} disabled={busy}>
              Baixar arquivo
            </Button>
          </div>
          <div className="rounded-xl border border-line p-4">
            <p className="text-sm font-semibold">Excluir minha conta</p>
            <p className="mt-0.5 text-[13px] text-muted">Apaga tudo de forma definitiva. Não dá para desfazer.</p>
            <Button size="sm" variant="ghost" className="mt-3 text-over" onClick={() => setStep("excluir")}>
              Excluir conta…
            </Button>
          </div>
          <p className="text-xs text-muted">
            Como cuidamos dos dados:{" "}
            <a href="/privacidade" target="_blank" rel="noreferrer" className="text-accent underline">
              política de privacidade
            </a>
            .
          </p>
        </div>
      ) : (
        <div>
          <div className="rounded-xl border border-over/30 bg-over/[0.05] p-4 text-sm">
            <p className="font-semibold">Excluir a conta e todos os dados?</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>Tarefas, registros, horário e preferências são apagados na hora.</li>
              <li>Se você assina o Pro, cancele a assinatura antes (menu da conta › Assinatura).</li>
              <li>O Google vai pedir para você entrar de novo, para confirmar que é você.</li>
            </ul>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => setStep("menu")}>
              Voltar
            </Button>
            <Button variant="danger" className="border border-over/40" onClick={remove} disabled={busy}>
              {busy ? "Excluindo…" : "Excluir tudo"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MenuButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium hover:bg-sunken">
      {children}
    </button>
  );
}
