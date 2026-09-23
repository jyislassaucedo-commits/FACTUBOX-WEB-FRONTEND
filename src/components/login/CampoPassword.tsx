"use client";

import { useState } from "react";
import { Input } from "@/components/ui";

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export function CampoPassword({
  id,
  value,
  onChange,
  autoComplete,
  autoFocus,
  invalido,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
  invalido?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalido || undefined}
        className="h-11 pr-20"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-controls={id}
        aria-pressed={visible}
        className="focus-brand absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-ink-3 transition hover:text-ink"
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
