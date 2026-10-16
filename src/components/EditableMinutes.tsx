"use client";

import { useState } from "react";
import { fmtMin, parseDuration } from "@/lib/dates";
import { updateSession } from "@/lib/db";
import type { Session } from "@/lib/types";
import { useStore } from "./store";
import { cx } from "./ui";

/** Tempo de um registro: toque para editar (ex: 45m, 1h30), Enter ou tocar fora salva, Esc cancela. */
export function EditableMinutes({ session, className }: { session: Session; className?: string }) {
  const { uid } = useStore();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  async function commit() {
    if (draft === null) return;
    const m = parseDuration(draft);
    if (!m) {
      setInvalid(true);
      return;
    }
    setDraft(null);
    setInvalid(false);
    if (m !== session.minutes) await updateSession(uid, session.id, { minutes: m });
  }

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(fmtMin(session.minutes))}
        className={cx("tabular rounded-md px-1.5 py-0.5 font-semibold underline decoration-line decoration-dotted underline-offset-4 hover:bg-sunken", className)}
        title="Editar o tempo deste registro"
      >
        {fmtMin(session.minutes)}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(null);
          setInvalid(false);
        }
      }}
      aria-label="Tempo do registro"
      aria-invalid={invalid}
      className={cx(
        "tabular mr-1.5 h-8 w-20 rounded-md border bg-surface px-2 text-sm font-semibold outline-none",
        invalid ? "border-over" : "border-brand",
        className,
      )}
    />
  );
}
