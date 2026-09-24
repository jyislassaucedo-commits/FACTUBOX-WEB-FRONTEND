"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cx } from "@/components/ui";
import { EMITIR } from "@/lib/facturasNav";

/* ---------------------------------------------------------------------------
   "Nueva": botón dividido.
   ---------------------------------------------------------------------------
   El 72 % de lo que se emite son facturas de ingreso (8.596 de 11.864 al mes,
   medido en producción). Mandar a todo el mundo al asistente de tipos para
   llegar siempre al mismo sitio son dos clics de más cada vez.

   Así que el botón lleva directo a la factura de ingreso, y la flecha abre el
   resto. El asistente completo sigue existiendo, al final del menú: es la
   puerta para lo que no está en la lista corta.
--------------------------------------------------------------------------- */

/** Todo menos la factura de ingreso, que ya es el botón. */
const OTROS = EMITIR.slice(1);

export function NuevaSplitButton({
  hayEmisor,
  alinear = "izquierda",
}: {
  hayEmisor: boolean;
  /** De qué lado abre el menú: a la derecha cuando el botón está al borde derecho. */
  alinear?: "izquierda" | "derecha";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Sin emisor concreto no se emite nada: el botón lo dice en vez de llevar a
  // una pantalla que va a rebotar.
  if (!hayEmisor) {
    return (
      <p className="rounded-[10px] border border-dashed border-line bg-surface-2 px-3 py-2.5 text-[12.5px] leading-snug text-ink-3">
        Elige un emisor arriba para poder emitir.
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="relative flex">
      <Link
        href="/facturas/nueva"
        className="focus-brand flex-grow rounded-l-[10px] bg-brand px-3 py-2.5 text-center text-[13.5px] font-semibold text-white transition hover:bg-brand-600"
      >
        Nueva factura
      </Link>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Otros tipos de comprobante"
        onClick={() => setOpen((v) => !v)}
        className="focus-brand rounded-r-[10px] border-l border-white/25 bg-brand px-2.5 text-white transition hover:bg-brand-600"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={cx("transition", open && "rotate-180")}
          aria-hidden
        >
          <path d="M1 3.5L5 7l4-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={cx(
            "absolute top-[calc(100%+6px)] z-30 w-[280px] rounded-2xl border border-line bg-surface p-1.5 shadow-pop",
            alinear === "derecha" ? "right-0" : "left-0"
          )}
        >
          {OTROS.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="focus-brand block rounded-xl px-3 py-2.5 transition hover:bg-surface-2"
            >
              <span className="block text-[13px] font-semibold text-ink">{o.label}</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-3">
                {o.detalle}
              </span>
            </Link>
          ))}

          <div className="mt-1 border-t border-line-2 pt-1">
            <Link
              href="/facturas/nueva"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="focus-brand block rounded-xl px-3 py-2 text-[12.5px] font-medium text-brand hover:bg-surface-2"
            >
              Ver todos los tipos…
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
