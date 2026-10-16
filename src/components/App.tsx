"use client";

import { CalendarDays, ChevronLeft, ChevronRight, CircleHelp, ListChecks, LogOut, Plus, Settings, Sun } from "lucide-react";
import { useState } from "react";
import { fromKey, shiftDay, todayKey, weekDays } from "@/lib/dates";
import { firebaseConfigured } from "@/lib/firebase";
import { DialogsProvider, useDialogs } from "./dialogs";
import { HelpDialog, HowItWorks, Onboarding } from "./Onboarding";
import { StoreProvider, useStore } from "./store";
import { Timer } from "./Timer";
import { Button, IconButton, cx } from "./ui";
import { DayView, SettingsView, TasksView, WeekView } from "./views";

type Tab = "dia" | "semana" | "tarefas" | "ajustes";
const TABS: { id: Tab; label: string; icon: typeof Sun }[] = [
  { id: "dia", label: "Dia", icon: Sun },
  { id: "semana", label: "Semana", icon: CalendarDays },
  { id: "tarefas", label: "Tarefas", icon: ListChecks },
  { id: "ajustes", label: "Ajustes", icon: Settings },
];

export default function App() {
  if (!firebaseConfigured) return <SetupNeeded />;
  return (
    <StoreProvider>
      <DialogsProvider>
        <Shell />
      </DialogsProvider>
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
  const { ready, user, login, logout, date, setDate, settings, settingsReady } = useStore();
  const { editTask } = useDialogs();
  const [tab, setTab] = useState<Tab>("dia");
  const [help, setHelp] = useState(false);
  const [error, setError] = useState("");

  if (!ready) return <div className="grid min-h-screen place-items-center text-sm text-muted">Carregando…</div>;

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-md">
          <Logo />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Saiba quanto ainda cabe no seu dia.</h1>
          <p className="mt-2 text-muted">Para rotinas flexíveis: tarefas com estimativa, agenda e pomodoro na mesma conta.</p>
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
  const days = weekDays(date);
  const fmt = (k: string, o: Intl.DateTimeFormatOptions) => fromKey(k).toLocaleDateString("pt-BR", o);
  const titles: Record<Tab, string> = {
    dia: isToday ? "Hoje" : fmt(date, { weekday: "long" }),
    semana: days.includes(todayKey()) ? "Esta semana" : "Semana",
    tarefas: "Tarefas",
    ajustes: "Ajustes",
  };
  const subtitle =
    tab === "dia"
      ? fmt(date, { weekday: isToday ? "long" : undefined, day: "numeric", month: "long" })
      : tab === "semana"
        ? `${fmt(days[0], { day: "numeric", month: "short" })} a ${fmt(days[6], { day: "numeric", month: "short" })}`
        : tab === "tarefas"
          ? "Tudo o que você cadastrou"
          : "Seu horário e pomodoro";
  const step = tab === "semana" ? 7 : 1;
  const showNav = tab === "dia" || tab === "semana";
  const backToNow = tab === "semana" ? !days.includes(todayKey()) : !isToday;

  return (
    <div className="lg:flex">
      {/* Navegação lateral (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <Button variant="primary" className="mt-6 w-full" onClick={() => editTask({ repeat: "once", date })}>
          <Plus size={16} /> Nova tarefa
        </Button>
        <nav className="mt-6 space-y-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                tab === t.id ? "bg-todo/10 text-todo" : "text-muted hover:bg-sunken hover:text-ink",
              )}
            >
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-0.5">
          <button onClick={() => setHelp(true)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-sunken hover:text-ink">
            <CircleHelp size={18} /> Como funciona
          </button>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-sunken text-xs font-semibold">{user.displayName?.[0] ?? "?"}</span>
            )}
            <span className="min-w-0 flex-1 truncate text-[13px]">{user.displayName ?? user.email}</span>
            <IconButton label="Sair" onClick={logout}>
              <LogOut size={15} />
            </IconButton>
          </div>
        </div>
      </aside>

      <div className={cx("min-w-0 flex-1 px-4 pt-4 pb-28 sm:px-6 lg:px-8 lg:pt-7 lg:pb-10", settings.activeTimer && "pb-48 lg:pb-32")}>
        <div className="mx-auto max-w-[1400px]">
          {/* Topo */}
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <Logo />
            <IconButton label="Como funciona" onClick={() => setHelp(true)}>
              <CircleHelp size={18} />
            </IconButton>
          </div>
          <header className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="mr-auto">
              <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">{titles[tab]}</h1>
              <p className="text-sm text-muted first-letter:uppercase">{subtitle}</p>
            </div>
            {showNav && (
              <div className="flex items-center gap-1.5">
                {backToNow && (
                  <Button variant="secondary" onClick={() => setDate(todayKey())}>
                    {tab === "semana" ? "Esta semana" : "Hoje"}
                  </Button>
                )}
                <div className="flex rounded-lg border border-line bg-surface">
                  <IconButton label={tab === "semana" ? "Semana anterior" : "Dia anterior"} onClick={() => setDate(shiftDay(date, -step))} className="h-9 w-9 rounded-r-none">
                    <ChevronLeft size={18} />
                  </IconButton>
                  <IconButton label={tab === "semana" ? "Próxima semana" : "Próximo dia"} onClick={() => setDate(shiftDay(date, step))} className="h-9 w-9 rounded-l-none border-l border-line">
                    <ChevronRight size={18} />
                  </IconButton>
                </div>
              </div>
            )}
          </header>

          <main>
            {tab === "dia" && <DayView />}
            {tab === "semana" && (
              <WeekView
                onPickDay={(d) => {
                  setDate(d);
                  setTab("dia");
                }}
              />
            )}
            {tab === "tarefas" && <TasksView />}
            {tab === "ajustes" && <SettingsView key={JSON.stringify([settings.windows, settings.breaks, settings.focusMin, settings.breakMin])} />}
          </main>
        </div>
      </div>

      {/* Navegação inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        {TABS.slice(0, 2).map((t) => (
          <MobileTab key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />
        ))}
        <button
          onClick={() => editTask({ repeat: "once", date })}
          className="mx-1 -mt-5 grid h-12 w-12 shrink-0 place-items-center self-start rounded-full bg-brand text-white shadow-lg"
          aria-label="Nova tarefa"
        >
          <Plus size={22} />
        </button>
        {TABS.slice(2).map((t) => (
          <MobileTab key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />
        ))}
      </nav>

      <Timer />
      {settingsReady && !settings.scheduleSet && <Onboarding />}
      {help && <HelpDialog onClose={() => setHelp(false)} />}
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
