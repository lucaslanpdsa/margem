"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ListChecks, PanelLeftClose, PanelLeftOpen, Plus, Sun, Timer as TimerIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { fromKey, shiftDay, todayKey } from "@/lib/dates";
import { firebaseConfigured } from "@/lib/firebase";
import { DialogsProvider, useDialogs } from "./dialogs";
import { AssignDialog, FocusView } from "./FocusView";
import { HelpDialog, HowItWorks, Onboarding } from "./Onboarding";
import { StoreProvider, useStore } from "./store";
import { Timer } from "./Timer";
import { OfflineNotice, ToastProvider } from "./toast";
import { AccountMenu } from "./AccountMenu";
import { SlotAlerts } from "./SlotAlerts";
import { Button, IconButton, cx } from "./ui";
import { TasksPage } from "./TasksPage";
import { DayView } from "./views";

type Tab = "dia" | "foco" | "tarefas";
const TAB_IDS: Tab[] = ["dia", "foco", "tarefas"];

/** Aba atual guardada no endereço (#tarefas), para sobreviver ao recarregar e o "voltar" do celular funcionar. */
function useTab(): [Tab, (t: Tab) => void] {
  const [tab, setTabState] = useState<Tab>("dia");
  useEffect(() => {
    const read = () => {
      const raw = window.location.hash.slice(1);
      // "#semana" e "#ajustes" eram abas antigas, que viraram parte de Tarefas.
      const h = (raw === "semana" || raw === "ajustes" ? "tarefas" : raw) as Tab;
      setTabState(TAB_IDS.includes(h) ? h : "dia");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const setTab = (t: Tab) => {
    if (t === tab) return;
    const url = t === "dia" ? window.location.pathname + window.location.search : `#${t}`;
    window.history.pushState(null, "", url);
    setTabState(t);
  };
  return [tab, setTab];
}
const TABS: { id: Tab; label: string; icon: typeof Sun }[] = [
  { id: "dia", label: "Dia", icon: Sun },
  { id: "tarefas", label: "Tarefas", icon: ListChecks },
  { id: "foco", label: "Foco", icon: TimerIcon },
];


export default function App() {
  if (!firebaseConfigured) return <SetupNeeded />;
  return (
    <StoreProvider>
      <ToastProvider>
        <DialogsProvider>
          <Shell />
        </DialogsProvider>
      </ToastProvider>
    </StoreProvider>
  );
}

function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="h-7 w-7" />
      <span className="text-[17px] font-semibold tracking-tight">Margem</span>
    </span>
  );
}

export function Shell() {
  const { ready, user, login, date, setDate, settings, settingsReady } = useStore();
  const { editTask } = useDialogs();
  const [tab, setTab] = useTab();
  const [help, setHelp] = useState(false);
  const go = setTab;
  const isActive = (id: Tab) => tab === id;
  // Barra lateral recolhida (só ícones), lembrada neste navegador.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("margem.sidebar") === "recolhida";
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("margem.sidebar", c ? "aberta" : "recolhida");
      } catch {
        /* sem armazenamento, só não lembra */
      }
      return !c;
    });
  const [error, setError] = useState("");

  if (!ready) return <LoadingSkeleton />;

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-md">
          <Logo />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Saiba quanto ainda cabe no seu dia.</h1>
          <p className="mt-2 text-muted">Diga seu horário e suas tarefas, registre o que fez, e o app mostra a qualquer hora se dá tempo.</p>
          <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
            <HowItWorks />
          </div>
          <Button
            variant="primary"
            className="mt-6 h-11 w-full"
            onClick={() => login().catch((e) => setError(e?.code === "auth/unauthorized-domain" ? "Este domínio não está autorizado no Firebase." : e?.message ?? "Não foi possível entrar."))}
          >
            Entrar com Google
          </Button>
          {error && <p className="mt-3 text-sm text-over">{error}</p>}
        </div>
      </main>
    );
  }

  const isToday = date === todayKey();
  const fmt = (k: string, o: Intl.DateTimeFormatOptions) => fromKey(k).toLocaleDateString("pt-BR", o);
  const titles: Record<Tab, string> = {
    dia: isToday ? "Hoje" : fmt(date, { weekday: "long" }),
    foco: "Foco",
    tarefas: "Tarefas",
  };
  const subtitle =
    tab === "dia"
      ? fmt(date, { weekday: isToday ? "long" : undefined, day: "numeric", month: "long" })
      : tab === "foco"
        ? "Pomodoro ou cronômetro, com ou sem tarefa"
        : "Seu horário e o que você faz em cada dia";
  const showNav = tab === "dia";

  return (
    <div className="lg:flex">
      {/* Navegação lateral (desktop) */}
      <aside
        className={cx(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface py-5 transition-[width] lg:flex",
          collapsed ? "w-[68px] items-center px-2" : "w-60 px-3",
        )}
      >
        <div className={cx("flex items-center", collapsed ? "justify-center" : "justify-between px-2")}>
          {collapsed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icon.svg" alt="Margem" className="h-7 w-7" />
          ) : (
            <Logo />
          )}
        </div>
        {collapsed ? (
          <button
            onClick={() => editTask({ repeat: "once", date })}
            className="mt-6 grid h-10 w-10 place-items-center rounded-lg bg-brand text-white hover:bg-brand/90"
            aria-label="Nova tarefa"
            title="Nova tarefa"
          >
            <Plus size={18} />
          </button>
        ) : (
          <Button variant="primary" className="mt-6 w-full" onClick={() => editTask({ repeat: "once", date })}>
            <Plus size={16} /> Nova tarefa
          </Button>
        )}
        <nav className={cx("mt-6 space-y-0.5", collapsed && "flex flex-col items-center")}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              title={collapsed ? t.label : undefined}
              aria-label={t.label}
              className={cx(
                "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                collapsed ? "h-10 w-10 justify-center" : "w-full px-3 py-2",
                isActive(t.id) ? "bg-todo/10 text-todo" : "text-muted hover:bg-sunken hover:text-ink",
              )}
            >
              <t.icon size={18} /> {!collapsed && t.label}
            </button>
          ))}
        </nav>
        <div className={cx("mt-auto space-y-0.5", collapsed && "flex flex-col items-center")}>
          <AccountMenu variant={collapsed ? "sidebar-collapsed" : "sidebar"} onHelp={() => setHelp(true)} />
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Abrir barra lateral" : "Recolher barra lateral"}
            aria-label={collapsed ? "Abrir barra lateral" : "Recolher barra lateral"}
            className={cx(
              "flex items-center gap-3 rounded-lg text-sm font-medium text-muted hover:bg-sunken hover:text-ink",
              collapsed ? "h-10 w-10 justify-center" : "w-full px-3 py-2",
            )}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />} {!collapsed && "Recolher"}
          </button>
        </div>
      </aside>

      <div className={cx("min-w-0 flex-1 px-4 pt-4 pb-28 sm:px-6 lg:px-8 lg:pt-7 lg:pb-10", settings.activeTimer && tab !== "foco" && "pb-48 lg:pb-32")}>
        <div className="mx-auto max-w-[1400px]">
          <header className={cx("mx-auto mb-5 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-3 lg:max-w-6xl", tab === "foco" && "sr-only")}>
            <div className="mr-auto">
              <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">{titles[tab]}</h1>
              {tab === "dia" ? (
                // Toque na data abre o calendário para ir direto a um dia.
                <label className="relative inline-flex cursor-pointer items-center gap-1 text-sm text-muted hover:text-ink" title="Escolher o dia">
                  <span className="first-letter:uppercase">{subtitle}</span>
                  <ChevronDown size={14} />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {
                        /* navegador sem showPicker: o campo abre normalmente */
                      }
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Escolher o dia"
                  />
                </label>
              ) : (
                <p className="text-sm text-muted first-letter:uppercase">{subtitle}</p>
              )}
            </div>
            {showNav && (
              <div className="flex items-center gap-1.5">
                {!isToday && (
                  <Button variant="secondary" onClick={() => setDate(todayKey())}>
                    Hoje
                  </Button>
                )}
                <div className="flex rounded-lg border border-line bg-surface">
                  <IconButton label="Dia anterior" onClick={() => setDate(shiftDay(date, -1))} className="h-9 w-9 rounded-r-none">
                    <ChevronLeft size={18} />
                  </IconButton>
                  <IconButton label="Próximo dia" onClick={() => setDate(shiftDay(date, 1))} className="h-9 w-9 rounded-l-none border-l border-line">
                    <ChevronRight size={18} />
                  </IconButton>
                </div>
              </div>
            )}
            <div className="lg:hidden">
              <AccountMenu variant="header" onHelp={() => setHelp(true)} />
            </div>
          </header>

          <main>
            {tab === "dia" && <DayView onGoTasks={() => setTab("tarefas")} />}
            {tab === "foco" && <FocusView />}
            {tab === "tarefas" && (
              <TasksPage
                onOpenDay={(d) => {
                  setDate(d);
                  setTab("dia");
                }}
              />
            )}
          </main>
        </div>
      </div>

      {/* Navegação inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        {TABS.slice(0, 2).map((t) => (
          <MobileTab key={t.id} active={isActive(t.id)} onClick={() => go(t.id)} icon={t.icon} label={t.label} />
        ))}
        <button
          onClick={() => editTask({ repeat: "once", date })}
          className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium text-muted"
          aria-label="Nova tarefa"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-white">
            <Plus size={16} strokeWidth={2.5} />
          </span>
          Nova
        </button>
        {TABS.slice(2).map((t) => (
          <MobileTab key={t.id} active={isActive(t.id)} onClick={() => go(t.id)} icon={t.icon} label={t.label} />
        ))}
      </nav>

      <Timer hidden={tab === "foco"} onOpen={() => setTab("foco")} />
      <SlotAlerts />
      <OfflineNotice />
      <AssignDialog />
      {settingsReady && !settings.scheduleSet && <Onboarding />}
      {help && <HelpDialog onClose={() => setHelp(false)} />}
    </div>
  );
}

/** Esqueleto da tela enquanto carrega (em vez de só "Carregando…"). */
function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-4 px-4 pt-6" aria-label="Carregando" role="status">
      <div className="h-7 w-32 rounded-lg bg-line/70" />
      <div className="h-4 w-48 rounded bg-line/50" />
      <div className="h-44 rounded-2xl bg-line/40" />
      <div className="h-64 rounded-2xl bg-line/40" />
    </div>
  );
}

function MobileTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Sun; label: string }) {
  return (
    <button onClick={onClick} className={cx("flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium", active ? "text-todo" : "text-muted")}>
      <Icon size={20} />
      {label}
    </button>
  );
}

function SetupNeeded() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold">Falta configurar o Firebase</h1>
      <p className="mt-2 text-muted">
        Crie o arquivo <code>.env.local</code> (ou as variáveis de ambiente na Vercel) com as chaves do seu projeto Firebase, seguindo o{" "}
        <code>.env.example</code>. O passo a passo está no README.
      </p>
    </main>
  );
}
