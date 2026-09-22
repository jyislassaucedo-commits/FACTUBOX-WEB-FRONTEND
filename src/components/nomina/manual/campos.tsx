"use client";

import { Field, FieldError, Input, Select } from "@/components/ui";
import { soloVigentes, type EntradaCatalogoNomina } from "@/lib/catalogosNominaShared";

/* Piezas chicas que comparten los pasos del asistente de nómina manual. */

/** Un campo con su error debajo, solo cuando toca mostrarlo. */
export function Campo({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Field label={label} hint={error ? undefined : hint}>
        {children}
      </Field>
      <FieldError mensaje={error} />
    </div>
  );
}

/** Un select sobre un catálogo del SAT, con "clave - texto" y solo vigentes. */
export function SelectCatalogo({
  lista,
  value,
  onChange,
  placeholder = "Selecciona…",
  className,
  disabled,
}: {
  lista: EntradaCatalogoNomina[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  // La clave que ya trae un renglón viejo se sigue mostrando aunque haya
  // vencido: quitársela en silencio sería cambiarle el recibo.
  const opciones = soloVigentes(lista);
  const faltante = value && !opciones.some((o) => o.id === value) ? lista.find((o) => o.id === value) : null;
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={className} disabled={disabled}>
      <option value="">{placeholder}</option>
      {faltante && (
        <option value={faltante.id}>{faltante.id} - {faltante.texto} (no vigente)</option>
      )}
      {opciones.map((o) => (
        <option key={o.id} value={o.id}>
          {o.id} - {o.texto}
        </option>
      ))}
    </Select>
  );
}

/** Importe en pesos: dos decimales, sin negativos. */
export function InputDinero(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "step" | "min">) {
  return <Input type="number" step="0.01" min="0" inputMode="decimal" {...props} />;
}

export function InputEntero(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "step">) {
  return <Input type="number" step="1" inputMode="numeric" {...props} />;
}

/** Título de un bloque dentro de un paso. */
export function Titulo({ children, accion }: { children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">{children}</p>
      {accion}
    </div>
  );
}

export function BotonQuitar({ onClick, title = "Quitar" }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="focus-brand rounded-md px-2 py-1 text-[12px] font-semibold text-ink-3 transition hover:bg-danger-bg hover:text-danger"
    >
      ✕
    </button>
  );
}
