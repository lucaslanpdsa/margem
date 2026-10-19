"use client";

import { Bell, BellOff, CircleHelp, LogOut } from "lucide-react";
import { useState } from "react";
import { useStore } from "./store";
import { cx } from "./ui";

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
                <button onClick={() => Notification.requestPermission().then(setPerm)} className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-[13px] font-semibold text-white">
                  Ativar
                </button>
              )}
            </div>

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
          </div>
        </>
      )}
    </div>
  );
}

function MenuButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium hover:bg-sunken">
      {children}
    </button>
  );
}
