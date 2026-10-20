"use client";

import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        size === "md" ? "h-9 px-3.5 text-sm" : "h-8 px-2.5 text-[13px]",
        variant === "primary" && "bg-brand text-brand-ink hover:bg-brand/90",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-sunken",
        variant === "ghost" && "text-muted hover:bg-sunken hover:text-ink",
        variant === "danger" && "text-over hover:bg-over/10",
        className,
      )}
    />
  );
}

export function IconButton({ label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cx(
        // Área de toque maior que o desenho (44px no celular), sem mudar o visual.
        "relative grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-30 sm:before:-inset-0.5",
        className,
      )}
    />
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-2xl border border-line bg-surface", className)}>{children}</section>;
}

export function PanelHeader({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {right}
    </header>
  );
}

export function Modal({
  title,
  description,
  onClose,
  children,
  wide,
  action,
  header,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** true = médio; "xl" = largo (janela da tarefa, duas colunas no computador). */
  wide?: boolean | "xl";
  /** Botão extra no cabeçalho, ao lado do fechar (ex: Editar). */
  action?: ReactNode;
  /** Cabeçalho próprio no lugar do título (ex: nome editável). O título continua como rótulo da janela. */
  header?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl",
          wide === "xl" ? "sm:max-w-4xl" : wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          {header ?? (
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {action}
            <IconButton label="Fechar" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        </div>
        <div className="px-6 pt-4 pb-6">{children}</div>
      </div>
    </div>
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15";

export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-line")}
      >
        <span className={cx("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </button>
    </label>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-sunken p-0.5">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const PRIORITY_LABEL = { 1: "Alta", 2: "Média", 3: "Baixa" } as const;
export const PRIORITY_COLOR = { 1: "text-over", 2: "text-break", 3: "text-muted" } as const;

const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

/** Escolha de horário em 24h, de 15 em 15 minutos (igual em todo navegador). */
export function TimeSelect({
  value,
  onChange,
  label,
  emptyLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  /** Se definido, oferece uma opção vazia com esse texto (ex: "Sem horário"). */
  emptyLabel?: string;
  className?: string;
}) {
  const options = !value || TIMES.includes(value) ? TIMES : [...TIMES, value].sort();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx("tabular h-9 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-brand", className)}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
