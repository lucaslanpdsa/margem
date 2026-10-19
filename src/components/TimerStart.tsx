"use client";

import { useState } from "react";
import { setTimerStart } from "@/lib/pomodoro";
import { useStore } from "./store";
import { cx } from "./ui";

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "Começou às 10:33 · Mudar": ajusta a hora em que o timer rodando começou, como no ClickUp. */
export function TimerStart({ className }: { className?: string }) {
  const { uid, settings } = useStore();
  const t = settings.activeTimer;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  if (!t || t.waiting || t.phase !== "focus") return null;
  const started = hhmm(new Date(t.startedAt));

  async function save() {
    const err = await setTimerStart(uid, settings, value);
    if (err) return setError(err);
    setEditing(false);
    setError("");
  }

  if (editing) {
    return (
      <form
        className={cx("flex flex-wrap items-center gap-2 text-[13px]", className)}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <span className="text-muted">Começou às</span>
        <input
          type="time"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          className="tabular h-8 rounded-md border border-brand bg-surface px-2 font-semibold text-ink outline-none"
          aria-label="Hora em que começou"
        />
        <button type="submit" className="font-semibold text-brand hover:underline">
          Salvar
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-muted hover:text-ink">
          Cancelar
        </button>
        {error && <span className="w-full text-over">{error}</span>}
      </form>
    );
  }

  return (
    <span className={cx("text-[13px] text-muted", className)}>
      Começou às <span className="tabular font-medium text-ink">{started}</span> ·{" "}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setValue(started);
          setEditing(true);
        }}
        className="font-medium text-brand hover:underline"
      >
        Mudar
      </button>
    </span>
  );
}
