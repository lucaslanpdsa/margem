"use client";

import { Check, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { entryTimes, fmtMin, parseTimeEntry } from "@/lib/dates";
import { deleteSession, updateSession } from "@/lib/db";
import type { Session } from "@/lib/types";
import { useStore } from "./store";
import { IconButton, cx } from "./ui";

/**
 * Tempo de um registro + ações: lápis para editar (45m, 1h30 ou 14:00-15:30) e lixeira para apagar.
 * Na edição: Enter ou ✓ salva, Esc cancela.
 */
export function RecordTime({ session, className }: { session: Session; className?: string }) {
  const { uid } = useStore();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  async function commit() {
    if (draft === null) return;
    const entry = parseTimeEntry(draft);
    if (!entry) return setInvalid(true);
    setDraft(null);
    setInvalid(false);
    // Intervalo ("14:00-15:30") também corrige o horário do registro.
    if (entry.start) await updateSession(uid, session.id, { minutes: entry.minutes, ...entryTimes(entry, session.date) });
    else if (entry.minutes !== session.minutes) await updateSession(uid, session.id, { minutes: entry.minutes });
  }
  const cancel = () => {
    setDraft(null);
    setInvalid(false);
  };

  if (draft !== null) {
    return (
      <span className="flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          aria-label="Novo tempo do registro"
          aria-invalid={invalid}
          placeholder="45m"
          className={cx("tabular h-8 w-28 rounded-md border bg-surface px-2 text-sm font-semibold outline-none", invalid ? "border-over" : "border-brand")}
        />
        <IconButton label="Salvar tempo" onClick={commit} className="text-todo">
          <Check size={16} />
        </IconButton>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-0.5">
      <span className={cx("tabular mr-1 font-semibold", className)}>{fmtMin(session.minutes)}</span>
      <IconButton label="Editar tempo do registro" onClick={() => setDraft(fmtMin(session.minutes))}>
        <Pencil size={15} />
      </IconButton>
      <IconButton label="Apagar registro" onClick={() => deleteSession(uid, session.id)}>
        <Trash2 size={15} />
      </IconButton>
    </span>
  );
}
