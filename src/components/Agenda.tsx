"use client";

import { CalendarDays, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { eventsOn } from "@/lib/agenda";
import { fmtMin, todayKey } from "@/lib/dates";
import { saveSettings } from "@/lib/db";
import { auth } from "@/lib/firebase";
import type { DayMetrics } from "@/lib/metrics";
import { toMin } from "@/lib/schedule";
import { useNow } from "./Timer";
import { useStore } from "./store";
import { useToast } from "./toast";
import { Button, Modal, Panel, cx } from "./ui";

// Google Agenda, só leitura: os compromissos saem do tempo do dia (como pausas). Horário é da agenda; o Dia é das tarefas.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

interface CodeClient {
  requestCode: () => void;
}
type GoogleOAuth = {
  accounts: {
    oauth2: {
      initCodeClient: (o: {
        client_id: string;
        scope: string;
        ux_mode: "popup";
        login_hint?: string;
        prompt?: string;
        callback: (r: { code?: string; error?: string }) => void;
        error_callback?: (e: { type: string }) => void;
      }) => CodeClient;
    };
  };
};

/** Carrega o script do Google (Google Identity Services) uma vez. */
let gis: Promise<GoogleOAuth> | null = null;
function loadGis(): Promise<GoogleOAuth> {
  const w = window as unknown as { google?: GoogleOAuth };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  gis ??= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google ? ok(w.google) : fail(new Error("Google indisponível.")));
    s.onerror = () => {
      gis = null;
      fail(new Error("Não deu para abrir o Google. Confira a internet."));
    };
    document.head.appendChild(s);
  });
  return gis;
}

async function api(path: string, body?: unknown) {
  const u = auth().currentUser;
  if (!u) throw new Error("Entre de novo.");
  const res = await fetch(path, {
    method: "POST",
    headers: { authorization: `Bearer ${await u.getIdToken()}`, "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Não deu certo. Tente de novo.");
  return data;
}

/** Conectar e desconectar o Google Agenda. */
export function useAgendaConnection(preload = true) {
  const { uid, user, refreshAgenda } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // Já carrega o script do Google: a janela dele precisa abrir logo no toque (senão o navegador bloqueia).
  useEffect(() => {
    if (CLIENT_ID && preload) loadGis().catch(() => {});
  }, [preload]);

  async function connect() {
    if (!CLIENT_ID) return toast("O Google Agenda ainda não foi configurado no app.", "error");
    setBusy(true);
    try {
      const google = await loadGis();
      // A janela do Google precisa abrir no toque: o script já está carregado aqui na maioria das vezes.
      const code = await new Promise<string>((ok, fail) => {
        google.accounts.oauth2
          .initCodeClient({
            client_id: CLIENT_ID,
            scope: SCOPE,
            ux_mode: "popup",
            login_hint: user?.email ?? undefined,
            // "consent" garante o acesso permanente (sem pedir de novo a cada hora).
            prompt: "consent",
            callback: (r) => (r.code ? ok(r.code) : fail(new Error(r.error === "access_denied" ? "Você não liberou o acesso." : "O Google não liberou o acesso."))),
            error_callback: (e) => fail(new Error(e.type === "popup_closed" ? "Janela do Google fechada." : "Não deu para abrir a janela do Google.")),
          })
          .requestCode();
      });
      await api("/api/agenda/conectar", { code });
      await saveSettings(uid, { agenda: { connectedAt: new Date().toISOString() } });
      refreshAgenda?.();
      toast("Google Agenda conectado. Os compromissos já saem do seu tempo livre.", "info");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await api("/api/agenda/desconectar");
      await saveSettings(uid, { agenda: null });
      toast("Google Agenda desconectado.", "info");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return { connect, disconnect, busy };
}

/** "Agenda" no Dia: os compromissos do dia (só leitura). Some sem Google Agenda conectado. */
export function AgendaCard({ m }: { m: DayMetrics }) {
  const { settings, days, agendaStatus, refreshAgenda } = useStore();
  const { connect, busy } = useAgendaConnection(agendaStatus === "reconnect");
  const now = new Date(useNow(60000));
  if (!settings.agenda) return null;
  const list = eventsOn(days[m.date]?.agenda ?? [], m.date);
  const timed = list.filter((d) => d.start);
  const allDay = list.filter((d) => !d.start);
  const busyMin = m.agendaMin;
  const isToday = m.date === todayKey();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (agendaStatus === "reconnect")
    return (
      <Panel className="p-5">
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <CalendarDays size={17} className="text-muted" /> Agenda
        </p>
        <p className="mt-1 text-sm text-muted">O acesso ao Google Agenda caiu. Sem ele, os compromissos não saem do seu tempo livre.</p>
        <Button size="sm" variant="primary" className="mt-3" onClick={connect} disabled={busy}>
          Conectar de novo
        </Button>
      </Panel>
    );

  return (
    <Panel className="p-5">
      <div className="flex items-center gap-2">
        <CalendarDays size={17} className="shrink-0 text-accent" />
        <p className="flex-1 text-[15px] font-semibold">Agenda</p>
        {busyMin > 0 && <span className="tabular text-sm font-semibold">{fmtMin(busyMin)}</span>}
        <button
          onClick={() => refreshAgenda?.()}
          aria-label="Atualizar agenda"
          title={agendaStatus === "error" ? "Não deu para ler o Google Agenda. Tocar para tentar de novo." : "Atualizar agenda"}
          className={cx("grid h-8 w-8 place-items-center rounded-full hover:bg-sunken", agendaStatus === "error" ? "text-over" : "text-muted")}
        >
          <RefreshCw size={14} className={cx(agendaStatus === "loading" && "animate-spin")} />
        </button>
      </div>
      {agendaStatus === "error" && <p className="mt-1 text-xs text-over">Não deu para ler o Google Agenda agora. Mostrando o que já tinha.</p>}
      {!list.length ? (
        <p className="mt-1 text-sm text-muted">{agendaStatus === "loading" ? "Lendo o Google Agenda…" : isToday ? "Nada na agenda hoje." : "Nada na agenda neste dia."}</p>
      ) : (
        <>
          {busyMin > 0 && <p className="mt-0.5 text-[13px] text-muted">Já saiu do seu tempo livre.</p>}
          <ul className="mt-3 space-y-1.5">
            {allDay.map((d) => (
              <li key={d.event.id} className="flex items-baseline gap-3 text-sm text-muted">
                <span className="tabular w-[92px] shrink-0 text-xs">Dia inteiro</span>
                <span className="min-w-0 flex-1 truncate">{d.event.title}</span>
              </li>
            ))}
            {timed.map((d) => {
              const past = isToday && toMin(d.end) <= nowMin;
              return (
                <li key={d.event.id} className={cx("flex items-baseline gap-3 text-sm", past && "opacity-50")}>
                  <span className="tabular w-[92px] shrink-0 text-xs text-muted">
                    {d.start}–{d.end === "24:00" ? "00:00" : d.end}
                  </span>
                  <span className={cx("min-w-0 flex-1 truncate", past && "line-through")}>{d.event.title}</span>
                  {!d.busy && <span className="shrink-0 rounded bg-sunken px-1.5 text-[11px] text-muted" title="Marcado como Disponível no Google: não desconta">livre</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}

/** Janela do menu da conta: conectar, explicar e desconectar. */
export function AgendaDialog({ onClose }: { onClose: () => void }) {
  const { settings } = useStore();
  const { connect, disconnect, busy } = useAgendaConnection();
  const on = !!settings.agenda;
  return (
    <Modal title="Google Agenda" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p>Organize seus horários no Google Agenda. O Margem só lê: os compromissos saem do tempo livre do dia, e a tela do Dia fica para as tarefas.</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Conta: compromisso com horário (reunião, aula, trabalho, consulta).</li>
          <li>
            Não conta: evento de dia inteiro e evento marcado como <b className="font-medium text-ink">Disponível</b> no Google. Use isso para blocos de foco, como
            “Estudar 19h–21h”, que já são o tempo das tarefas.
          </li>
          <li>Entram as agendas que aparecem marcadas no seu Google Agenda.</li>
          <li>O Margem nunca cria, muda ou apaga eventos.</li>
        </ul>
        {settings.work && (
          <p className="rounded-xl bg-sunken p-3 text-[13px]">
            Você também usa o ponto. Se o trabalho estiver na agenda, o mesmo horário não é descontado duas vezes: vale o maior intervalo entre os dois.
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {on ? (
          <>
            <Button variant="danger" onClick={() => disconnect().then(onClose)} disabled={busy}>
              Desconectar
            </Button>
            <Button variant="primary" onClick={onClose}>
              Pronto
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Agora não
            </Button>
            <Button variant="primary" onClick={() => connect().then(onClose)} disabled={busy}>
              Conectar Google Agenda
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
