"use client";

/* ---------------------------------------------------------------------------
   Primitivas de UI compartidas.
   ---------------------------------------------------------------------------
   Todo lo visual de la app deberia salir de aqui. Regla: ningun componente de
   pantalla escribe colores crudos de Tailwind (bg-white, text-neutral-700...);
   usa estas primitivas o las utilidades de token (bg-surface, text-ink-2...).
--------------------------------------------------------------------------- */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  NOTE_TONE,
  PILL_TONE,
  buttonClass,
  cx,
  inputClass,
  type ButtonSize,
  type ButtonVariant,
  type NoteTone,
  type PillTone,
} from "./styles";

export { buttonClass, cx, inputClass };
export type { ButtonSize, ButtonVariant, NoteTone, PillTone };

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cx(
        "overflow-hidden rounded-card border border-line bg-surface shadow-card",
        className
      )}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-start justify-between gap-4 border-b border-line-2 px-5 py-4",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description && (
          <p className="mt-1 max-w-[62ch] text-[12.5px] text-ink-3">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx("p-5", className)} />;
}

/* -------------------------------------------------------------------------- */
/* Pill                                                                       */
/* -------------------------------------------------------------------------- */

export function Pill({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: PillTone }) {
  return (
    <span
      {...props}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold",
        PILL_TONE[tone],
        className
      )}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Campos de formulario                                                       */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  badge,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="flex items-center gap-2 text-xs font-semibold text-ink-2">
        {label}
        {badge}
      </span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-4">{hint}</span>}
    </label>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, className)} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputClass, "pr-8", className)} />;
}

/* -------------------------------------------------------------------------- */
/* Toolbar: busqueda + filtros segmentados                                    */
/* -------------------------------------------------------------------------- */

export function Toolbar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cx(
        "flex flex-wrap items-center gap-2 border-b border-line-2 px-5 py-3",
        className
      )}
    />
  );
}

export function SearchInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cx("relative min-w-[190px] flex-1", className)}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input {...props} type="search" className={cx(inputClass, "pl-9")} />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-0.5 rounded-[10px] border border-line bg-surface-2 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cx(
              "focus-brand rounded-lg px-3 py-1 text-[12.5px] font-semibold transition",
              active
                ? "bg-surface text-ink shadow-card"
                : "text-ink-3 hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabla                                                                      */
/* -------------------------------------------------------------------------- */

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={cx(
        "whitespace-nowrap border-b border-line-2 bg-surface-2 px-5 py-2.5 text-[10.8px] font-bold uppercase tracking-[0.07em] text-ink-3",
        className
      )}
    />
  );
}

export function Td({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...props}
      className={cx(
        "border-b border-line-2 px-5 py-3 align-middle text-[13.3px] text-ink-2",
        className
      )}
    />
  );
}

/** Acciones de fila: aparecen al hacer hover, siempre visibles con teclado. */
export function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
      {children}
    </div>
  );
}

/**
 * Boton destructivo en dos pasos: el primer clic pide confirmacion en el
 * propio boton, el segundo ejecuta. Evita meter un dialogo por cada borrado
 * y evita borrados accidentales al pasar el mouse por la fila.
 */
export function ConfirmButton({
  onConfirm,
  children = "Eliminar",
  confirmLabel = "¿Seguro?",
  pendingLabel = "Eliminando…",
  pending,
}: {
  onConfirm: () => void;
  children?: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  pending?: boolean;
}) {
  const [armado, setArmado] = useState(false);

  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 4000);
    return () => clearTimeout(t);
  }, [armado]);

  if (pending) {
    return (
      <Button variant="danger" size="sm" disabled>
        {pendingLabel}
      </Button>
    );
  }

  return (
    <Button
      variant="danger"
      size="sm"
      onBlur={() => setArmado(false)}
      onClick={() => {
        if (armado) {
          setArmado(false);
          onConfirm();
        } else {
          setArmado(true);
        }
      }}
      className={armado ? "bg-danger-bg font-bold" : undefined}
    >
      {armado ? confirmLabel : children}
    </Button>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-12 text-center">
      {icon && <div className="mb-3 flex justify-center text-ink-4">{icon}</div>}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 text-[13px] text-ink-3">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Notas y barras de progreso                                                 */
/* -------------------------------------------------------------------------- */

export function Note({
  tone = "info",
  title,
  children,
}: {
  tone?: NoteTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-[11px] px-3.5 py-3 text-[12.8px] leading-relaxed",
        NOTE_TONE[tone]
      )}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "brand",
}: {
  /** 0 a 100 */
  value: number;
  tone?: "brand" | "ok" | "warn" | "danger";
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill =
    tone === "ok"
      ? "bg-ok"
      : tone === "warn"
        ? "bg-warn"
        : tone === "danger"
          ? "bg-danger"
          : "bg-brand";
  return (
    <div
      className="h-[7px] overflow-hidden rounded-full bg-line-2"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cx("h-full rounded-full transition-all", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export function Modal({
  title,
  onClose,
  footer,
  children,
  wide,
}: {
  title: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  // onClose casi siempre es un closure inline (`() => setX(false)`), asi que
  // cambia de identidad en cada render del padre - por ejemplo, en cada
  // keystroke de un input dentro del modal. Se guarda en un ref para que el
  // efecto de abajo pueda llamar siempre la version mas reciente sin tener
  // que declarar onClose como dependencia (lo que reejecutaria el efecto, y
  // con el ref.current?.focus() de abajo, robaria el foco del input activo
  // en cada tecla).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "w-full rounded-2xl border border-line bg-surface shadow-pop outline-none",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <div className="flex items-center justify-between border-b border-line-2 px-5 py-4">
          <h3 id={titleId} className="text-[15.5px] font-semibold text-ink">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="focus-brand grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-3 transition hover:bg-surface-2 hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line-2 bg-surface-2 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Zona de archivo (input file con look de dropzone)                          */
/* -------------------------------------------------------------------------- */

export function FileDrop({
  label,
  hint,
  accept,
  file,
  done,
  onFile,
}: {
  label: string;
  hint?: string;
  accept?: string;
  file: File | null;
  /** true = ya hay uno cargado en el servidor (se pinta en verde) */
  done?: boolean;
  onFile: (file: File | null) => void;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activo = Boolean(file) || done;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files?.[0] ?? null);
      }}
      className={cx(
        "rounded-xl border p-4 text-center transition",
        over
          ? "border-brand bg-brand-050"
          : activo
            ? "border-solid border-ok bg-ok-bg"
            : "border-dashed border-line bg-surface-2 hover:border-brand"
      )}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="focus-brand w-full rounded-lg"
      >
        <p className={cx("text-[13px] font-semibold", activo ? "text-ok" : "text-ink")}>
          {file ? file.name : label}
        </p>
        <p className={cx("mt-0.5 text-[11.5px]", activo ? "text-ok" : "text-ink-3")}>
          {file ? "Listo para subir" : done ? "Ya cargado · haz clic para reemplazar" : hint}
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {file && (
        <button
          type="button"
          onClick={() => {
            onFile(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="focus-brand mt-1 rounded text-[11.5px] font-medium text-ink-3 underline hover:text-ink"
        >
          Quitar
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                     */
/* -------------------------------------------------------------------------- */

type Toast = { id: number; message: string; tone: "ok" | "danger" };

const ToastContext = createContext<(message: string, tone?: "ok" | "danger") => void>(
  () => {}
);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: "ok" | "danger" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(
              "pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium shadow-pop",
              toast.tone === "danger"
                ? "bg-danger text-white"
                : "bg-ink text-background"
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
