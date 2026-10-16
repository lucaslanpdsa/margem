"use client";

import { useState } from "react";
import { fromKey, shiftDay, todayKey, weekDays } from "@/lib/dates";
import { firebaseConfigured } from "@/lib/firebase";
import { DialogsProvider } from "./dialogs";
import { StoreProvider, useStore } from "./store";
import { Timer } from "./Timer";
import { Button, cx } from "./ui";
import { DayView, SettingsView, TasksView, WeekView } from "./views";

type Tab = "dia" | "semana" | "tarefas" | "ajustes";
const TABS: { id: Tab; label: string }[] = [
  { id: "dia", label: "Dia" },
  { id: "semana", label: "Semana" },
  { id: "tarefas", label: "Tarefas" },
  { id: "ajustes", label: "Ajustes" },
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
    <span className="font-display text-2xl tracking-tight">
      margem<span className="text-done">.</span>
    </span>
  );
}

function Shell() {
  const { ready, user, login, date, setDate, settings } = useStore();
  const [tab, setTab] = useState<Tab>("dia");
  const [error, setError] = useState("");

  if (!ready) return <div className="grid min-h-screen place-items-center text-muted">Carregando…</div>;

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="max-w-sm text-center">
          <Logo />
          <p className="mt-3 text-muted">Rotina flexível: quanto cabe no seu dia, quanto já foi feito e quanto ainda sobra.</p>
          <Button
            variant="primary"
            className="mt-6 px-5 py-2.5"
            onClick={() => login().catch((e) => setError(e?.message ?? "Não foi possível entrar."))}
          >
            Entrar com Google
          </Button>
          {error && <p className="mt-3 text-sm text-warn">{error}</p>}
        </div>
      </main>
    );
  }

  const step = tab === "semana" ? 7 : 1;
  const days = weekDays(date);
  const fmt = (k: string, o: Intl.DateTimeFormatOptions) => fromKey(k).toLocaleDateString("pt-BR", o);
  const label =
    tab === "semana"
      ? `${fmt(days[0], { day: "numeric", month: "short" })} – ${fmt(days[6], { day: "numeric", month: "short" })}`
      : fmt(date, { weekday: "long", day: "numeric", month: "long" });
  const showNav = tab === "dia" || tab === "semana";

  return (
    <div className={cx("mx-auto w-full max-w-7xl px-4 pt-4 pb-28 sm:px-6", settings.activeTimer && "pb-36")}>
      <header className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Logo />
        <nav className="flex rounded-xl bg-card p-1 ring-1 ring-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx("rounded-lg px-3 py-1.5 text-sm", tab === t.id ? "bg-ink text-paper" : "text-muted hover:text-ink")}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {showNav && (
          <div className="flex items-center gap-1 sm:ml-auto">
            <Button variant="ghost" onClick={() => setDate(shiftDay(date, -step))} aria-label="Anterior">
              ←
            </Button>
            <span className="min-w-44 text-center text-sm font-medium first-letter:uppercase">{label}</span>
            <Button variant="ghost" onClick={() => setDate(shiftDay(date, step))} aria-label="Próximo">
              →
            </Button>
            {date !== todayKey() && (
              <Button variant="soft" onClick={() => setDate(todayKey())}>
                Hoje
              </Button>
            )}
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
        {tab === "ajustes" && <SettingsView key={JSON.stringify([settings.capacityByWeekday, settings.slack, settings.focusMin, settings.breakMin])} />}
      </main>

      <Timer />
    </div>
  );
}

function SetupNeeded() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <Logo />
      <h1 className="mt-6 font-display text-2xl">Falta configurar o Firebase</h1>
      <p className="mt-2 text-muted">
        Crie o arquivo <code>.env.local</code> (ou as variáveis de ambiente na Vercel) com as chaves do seu projeto Firebase, seguindo o{" "}
        <code>.env.example</code>. O passo a passo está no README.
      </p>
    </main>
  );
}
