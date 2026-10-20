"use client";

/**
 * Prévia do app com dados de exemplo, sem login e sem Firebase. Só em desenvolvimento.
 *
 *   /dev?cenario=dia            (dia | apertado | timer | vazio | onboarding | entrar)
 *   /dev?cenario=dia#tarefas    (aba: #tarefas, #foco)
 *   /dev?abrir=tarefa           (abre uma janela: tarefa | nova | editar)
 *
 * Nada é salvo: as ações que gravam no banco falham em silêncio.
 */
import type { User } from "firebase/auth";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/App";
import { DialogsProvider, useDialogs } from "@/components/dialogs";
import { StoreCtx } from "@/components/store";
import { ToastProvider } from "@/components/toast";
import { PREVIEW_UID, SCENARIOS, previewData, type Scenario } from "@/dev/fixtures";
import { shiftDay, todayKey } from "@/lib/dates";
import { taskTimeBlocks } from "@/lib/schedule";
import type { Task } from "@/lib/types";

export default function DevPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  // Só monta no navegador (lê o endereço e o relógio), para não divergir do HTML do servidor.
  const [ready, setReady] = useState<{ scenario: Scenario; open: string | null; now: number } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const scenario = (SCENARIOS.find((x) => x.id === q.get("cenario"))?.id ?? "dia") as Scenario;
    setTimeout(() => setReady({ scenario, open: q.get("abrir"), now: Date.now() }), 0);
  }, []);
  if (!ready) return null;

  const data = previewData(ready.scenario, ready.now);
  const t0 = todayKey(new Date(ready.now));
  const dates = Array.from({ length: 21 }, (_, i) => shiftDay(t0, i - 7));
  const user = data.signedIn ? ({ uid: PREVIEW_UID, email: "voce@exemplo.com", displayName: "Você" } as User) : null;

  return (
    <StoreCtx.Provider
      value={{
        user,
        uid: PREVIEW_UID,
        ready: true,
        tasks: data.tasks,
        blocks: taskTimeBlocks(data.tasks, dates),
        sessions: data.sessions,
        settings: data.settings,
        settingsReady: true,
        date: t0,
        setDate: () => {},
        login: async () => {},
        logout: async () => {},
        deleteAccount: async () => {},
        billing: null,
      }}
    >
      <ToastProvider>
        <DialogsProvider>
          <Shell />
          <OpenOnLoad what={ready.open} task={data.tasks[0]} />
        </DialogsProvider>
      </ToastProvider>
    </StoreCtx.Provider>
  );
}

function OpenOnLoad({ what, task }: { what: string | null; task?: Task }) {
  const { openTask, editTask } = useDialogs();
  useEffect(() => {
    if (what === "tarefa" && task) openTask(task);
    if (what === "editar" && task) editTask(task);
    if (what === "nova") editTask({ repeat: "once", date: todayKey() });
    // Abre uma vez ao carregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
