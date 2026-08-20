/* ---------------------------------------------------------------------------
   Helpers de clases: SIN "use client".
   ---------------------------------------------------------------------------
   Viven aparte de components/ui/index.tsx porque un Server Component no puede
   *invocar* una funcion exportada desde un modulo marcado "use client" (solo
   puede renderizar sus componentes). Cualquier helper que se llame tanto en
   servidor como en cliente va aqui.
--------------------------------------------------------------------------- */

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-ink border-brand hover:bg-brand-600 hover:border-brand-600 shadow-card",
  secondary: "bg-surface text-ink border-line hover:bg-surface-2 hover:border-ink-4",
  ghost: "bg-transparent text-ink-2 border-transparent hover:bg-line-2 hover:text-ink",
  danger: "bg-transparent text-danger border-transparent hover:bg-danger-bg",
};

export const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-sm rounded-[10px] gap-2",
};

/** Mismo look que <Button>, para cuando el elemento debe ser un <Link>. */
export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string
) {
  return cx(
    "focus-brand inline-flex items-center justify-center whitespace-nowrap border font-medium transition disabled:pointer-events-none disabled:opacity-50",
    BUTTON_VARIANT[variant],
    BUTTON_SIZE[size],
    className
  );
}

export const inputClass =
  "focus-brand w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink transition placeholder:text-ink-4 focus:border-brand disabled:bg-surface-2 disabled:text-ink-3 read-only:bg-surface-2 read-only:text-ink-3";

export type PillTone =
  | "neutral"
  | "brand"
  | "ok"
  | "warn"
  | "danger"
  | "info"
  | "violet"
  | "teal";

export const PILL_TONE: Record<PillTone, string> = {
  neutral: "bg-line-2 text-ink-2",
  brand: "bg-brand-050 text-brand-600",
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  violet: "bg-violet-bg text-violet",
  teal: "bg-teal-bg text-teal",
};

export type NoteTone = "ok" | "warn" | "danger" | "info";

export const NOTE_TONE: Record<NoteTone, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
};
