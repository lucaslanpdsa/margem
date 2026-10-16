"use client";

import { useState } from "react";
import { fmtMin, parseDuration } from "@/lib/dates";
import { addSession, deleteSession } from "@/lib/db";
import type { Task } from "@/lib/types";
import { useStore } from "./store";
import { Button, Field, Modal, inputCls } from "./ui";

/** Registro manual de tempo (ex: treino, algo feito sem timer) e correção de sessões. */
export function LogTimeForm({ task, onClose }: { task: Task; onClose: () => void }) {
  const { uid, date: focusDate, sessions } = useStore();
  const [minutes, setMinutes] = useState("");
  const date = focusDate;
  const [error, setError] = useState("");

  const list = sessions.filter((s) => s.taskId === task.id && s.date === date).sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  async function save() {
    const m = parseDuration(minutes);
    if (!m) return setError("Escreva o tempo, por exemplo 30m ou 2h.");
    const now = new Date().toISOString();
    await addSession(uid, { taskId: task.id, date, minutes: m, kind: "manual", startedAt: now, endedAt: now });
    setMinutes("");
    setError("");
  }

  return (
    <Modal title="Registrar tempo" description={`Para algo feito sem o timer em “${task.title}”. Conta como feito no dia escolhido.`} onClose={onClose}>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Quanto tempo?">
          <input autoFocus className={inputCls} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="30m, 2h" />
        </Field>
        <Button type="submit" variant="primary" className="h-10!">
          Registrar
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-over">{error}</p>}

      <div className="mt-5">
        <p className="mb-2 text-[13px] font-medium">Registros neste dia</p>
        {list.length === 0 && <p className="text-sm text-muted">Nada registrado ainda.</p>}
        <ul className="divide-y divide-line">
          {list.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="tabular font-medium">{fmtMin(s.minutes)}</span>{" "}
                <span className="text-muted">
                  {s.kind === "pomodoro"
                    ? `pomodoro às ${new Date(s.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : "manual"}
                </span>
              </span>
              <Button variant="danger" onClick={() => deleteSession(uid, s.id)}>
                Remover
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
